import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { logger } from '../logger/logger';

export interface CacheConfig {
  level: 'L1' | 'L2' | 'L3';
  ttl: number; // Time to live in seconds
  maxSize?: number; // Maximum number of items (for L1 cache)
  strategy: 'LRU' | 'LFU' | 'FIFO';
  enabled: boolean;
}

export interface CacheItem<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  tags?: string[];
  priority?: number;
}

export interface CacheStats {
  level: string;
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
  evictions: number;
  avgAccessTime: number;
}

export interface CacheOperation {
  operation: 'GET' | 'SET' | 'DELETE' | 'INVALIDATE';
  key: string;
  level: string;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
}

export interface MultiLevelCacheConfig {
  l1: Partial<CacheConfig>;
  l2: Partial<CacheConfig>;
  l3: Partial<CacheConfig>;
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  prisma?: PrismaClient;
  enableMetrics?: boolean;
  enableCompression?: boolean;
  enableEncryption?: boolean;
  encryptionKey?: string;
}

export class MultiLevelCacheService extends EventEmitter {
  private l1Cache: Map<string, CacheItem> = new Map();
  private redis: Redis | null = null;
  private prisma: PrismaClient | null = null;
  private config: MultiLevelCacheConfig;
  private stats: Map<string, CacheStats> = new Map();
  private operations: CacheOperation[] = [];
  private maxOperationsHistory: number = 1000;
  private compressionEnabled: boolean = false;
  private encryptionEnabled: boolean = false;
  private encryptionKey: string = '';

  constructor(config: MultiLevelCacheConfig) {
    super();
    // Merge config defaults without overwriting
    this.config = {
      l1: { ...{ level: 'L1', ttl: 300, maxSize: 1000, strategy: 'LRU', enabled: true }, ...(config.l1 || {}) },
      l2: { ...{ level: 'L2', ttl: 3600, strategy: 'LRU', enabled: true }, ...(config.l2 || {}) },
      l3: { ...{ level: 'L3', ttl: 86400, strategy: 'LRU', enabled: true }, ...(config.l3 || {}) },
      redis: config.redis || { host: 'localhost', port: 6379 },
      enableMetrics: config.enableMetrics ?? true,
      enableCompression: config.enableCompression ?? false,
      enableEncryption: config.enableEncryption ?? false,
      encryptionKey: config.encryptionKey ?? '',
      ...(config.prisma ? { prisma: config.prisma } : {})
    };
    this.initializeCache();
    this.setupEventHandlers();
  }

  /**
   * Initialize cache levels
   */
  private async initializeCache(): Promise<void> {
    try {
      // Initialize L1 cache (in-memory)
      if (this.config.l1.enabled) {
        this.initializeL1Cache();
      }

      // Initialize L2 cache (Redis)
      if (this.config.l2.enabled && this.config.redis) {
        await this.initializeL2Cache();
      }

      // Initialize L3 cache (Database)
      if (this.config.l3.enabled && this.config.prisma) {
        this.prisma = this.config.prisma;
      }

      // Set compression and encryption
      this.compressionEnabled = this.config.enableCompression || false;
      this.encryptionEnabled = this.config.enableEncryption || false;
      this.encryptionKey = this.config.encryptionKey || '';

      logger.info('Multi-level cache initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize multi-level cache:', error);
      throw error;
    }
  }

  /**
   * Initialize L1 cache (in-memory)
   */
  private initializeL1Cache(): void {
    this.stats.set('L1', {
      level: 'L1',
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      maxSize: this.config.l1.maxSize || 1000,
      evictions: 0,
      avgAccessTime: 0
    });

    // Start cleanup interval
    setInterval(() => {
      this.cleanupL1Cache();
    }, 60000); // Cleanup every minute
  }

  /**
   * Initialize L2 cache (Redis)
   */
  private async initializeL2Cache(): Promise<void> {
    try {
      const redisOptions: any = {
        host: this.config.redis!.host,
        port: this.config.redis!.port,
        db: this.config.redis!.db || 0,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      };
      if (this.config.redis!.password) {
        redisOptions.password = this.config.redis!.password;
      }
      this.redis = new Redis(redisOptions);

      this.redis.on('error', (error) => {
        logger.error('Redis connection error:', error);
        this.emit('redisError', error);
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected successfully');
        this.emit('redisConnected');
      });

      await this.redis.connect();

      this.stats.set('L2', {
        level: 'L2',
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        maxSize: 0,
        evictions: 0,
        avgAccessTime: 0
      });

    } catch (error) {
      logger.error('Failed to initialize Redis cache:', error);
      this.config.l2.enabled = false;
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('cacheHit', (level: string, key: string) => {
      logger.debug(`Cache hit on ${level}: ${key}`);
    });

    this.on('cacheMiss', (level: string, key: string) => {
      logger.debug(`Cache miss on ${level}: ${key}`);
    });

    this.on('cacheEviction', (level: string, key: string) => {
      logger.debug(`Cache eviction on ${level}: ${key}`);
    });
  }

  /**
   * Get value from cache with multi-level fallback
   */
  async get<T>(key: string, tags?: string[]): Promise<T | null> {
    const startTime = Date.now();
    let value: T | null = null;
    let level = '';

    try {
      // Try L1 cache first
      if (this.config.l1.enabled) {
        value = await this.getFromL1<T>(key);
        if (value !== null) {
          level = 'L1';
          this.recordOperation('GET', key, 'L1', Date.now() - startTime, true);
          this.emit('cacheHit', 'L1', key);
          return value;
        }
      }

      // Try L2 cache (Redis)
      if (this.config.l2.enabled && this.redis) {
        value = await this.getFromL2<T>(key);
        if (value !== null) {
          level = 'L2';
          // Populate L1 cache
          if (this.config.l1.enabled) {
            await this.setToL1(key, value, tags);
          }
          this.recordOperation('GET', key, 'L2', Date.now() - startTime, true);
          this.emit('cacheHit', 'L2', key);
          return value;
        }
      }

      // Try L3 cache (Database)
      if (this.config.l3.enabled && this.prisma) {
        value = await this.getFromL3<T>(key);
        if (value !== null) {
          level = 'L3';
          // Populate L1 and L2 caches
          if (this.config.l1.enabled) {
            await this.setToL1(key, value, tags);
          }
          if (this.config.l2.enabled && this.redis) {
            await this.setToL2(key, value, tags);
          }
          this.recordOperation('GET', key, 'L3', Date.now() - startTime, true);
          this.emit('cacheHit', 'L3', key);
          return value;
        }
      }

      // Cache miss on all levels
      this.recordOperation('GET', key, 'MISS', Date.now() - startTime, false);
      this.emit('cacheMiss', 'ALL', key);
      return null;

    } catch (error) {
      logger.error(`Error getting value for key ${key}:`, error);
      this.recordOperation('GET', key, level, Date.now() - startTime, false, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Set value in cache across all levels
   */
  async set<T>(key: string, value: T, tags?: string[], ttl?: number): Promise<void> {
    const startTime = Date.now();

    try {
      // Set in L1 cache
      if (this.config.l1.enabled) {
        await this.setToL1(key, value, tags, ttl);
      }

      // Set in L2 cache (Redis)
      if (this.config.l2.enabled && this.redis) {
        await this.setToL2(key, value, tags, ttl);
      }

      // Set in L3 cache (Database)
      if (this.config.l3.enabled && this.prisma) {
        await this.setToL3(key, value, tags, ttl);
      }

      this.recordOperation('SET', key, 'ALL', Date.now() - startTime, true);
      this.emit('cacheSet', key, value);

    } catch (error) {
      logger.error(`Error setting value for key ${key}:`, error);
      this.recordOperation('SET', key, 'ALL', Date.now() - startTime, false, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Delete value from all cache levels
   */
  async delete(key: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Delete from L1 cache
      if (this.config.l1.enabled) {
        this.deleteFromL1(key);
      }

      // Delete from L2 cache (Redis)
      if (this.config.l2.enabled && this.redis) {
        await this.deleteFromL2(key);
      }

      // Delete from L3 cache (Database)
      if (this.config.l3.enabled && this.prisma) {
        await this.deleteFromL3(key);
      }

      this.recordOperation('DELETE', key, 'ALL', Date.now() - startTime, true);
      this.emit('cacheDelete', key);

    } catch (error) {
      logger.error(`Error deleting value for key ${key}:`, error);
      this.recordOperation('DELETE', key, 'ALL', Date.now() - startTime, false, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    const startTime = Date.now();

    try {
      // Invalidate L1 cache by tags
      if (this.config.l1.enabled) {
        this.invalidateL1ByTags(tags);
      }

      // Invalidate L2 cache by tags
      if (this.config.l2.enabled && this.redis) {
        await this.invalidateL2ByTags(tags);
      }

      // Invalidate L3 cache by tags
      if (this.config.l3.enabled && this.prisma) {
        await this.invalidateL3ByTags(tags);
      }

      this.recordOperation('INVALIDATE', tags.join(','), 'ALL', Date.now() - startTime, true);
      this.emit('cacheInvalidate', tags);

    } catch (error) {
      logger.error(`Error invalidating cache by tags ${tags}:`, error);
      this.recordOperation('INVALIDATE', tags.join(','), 'ALL', Date.now() - startTime, false, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    try {
      // Clear L1 cache
      if (this.config.l1.enabled) {
        this.l1Cache.clear();
        this.updateL1Stats();
      }
      // Clear L2 cache (Redis)
      if (this.config.l2.enabled && this.redis) {
        await this.redis.flushdb();
      }
      // Clear L3 cache (Database)
      if (this.config.l3.enabled && this.prisma) {
        await this.prisma.dataCache.deleteMany();
      }
      this.emit('cacheClear');
      logger.info('All cache levels cleared');
    } catch (error) {
      logger.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): Map<string, CacheStats> {
    return new Map(this.stats);
  }

  /**
   * Get cache operations history
   */
  getOperations(limit: number = 100): CacheOperation[] {
    return this.operations.slice(-limit);
  }

  /**
   * L1 Cache Operations (In-Memory)
   */
  private async getFromL1<T>(key: string): Promise<T | null> {
    const item = this.l1Cache.get(key);

    if (!item) {
      this.updateL1Stats('miss');
      return null;
    }

    // Check if expired
    if (Date.now() > item.timestamp + item.ttl * 1000) {
      this.l1Cache.delete(key);
      this.updateL1Stats('miss');
      return null;
    }

    // Update access statistics
    item.accessCount++;
    item.lastAccessed = Date.now();
    this.l1Cache.set(key, item);

    this.updateL1Stats('hit');
    return item.value as T;
  }

  private async setToL1<T>(key: string, value: T, tags?: string[], ttl?: number): Promise<void> {
    const item: CacheItem<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.l1.ttl || 300,
      accessCount: 1,
      lastAccessed: Date.now(),
      tags: tags || [],
      priority: 1
    };

    // Check if cache is full and evict if necessary
    if (this.l1Cache.size >= (this.config.l1.maxSize || 1000)) {
      this.evictFromL1();
    }

    this.l1Cache.set(key, item);
    this.updateL1Stats();
  }

  private deleteFromL1(key: string): void {
    this.l1Cache.delete(key);
    this.updateL1Stats();
  }

  private invalidateL1ByTags(tags: string[]): void {
    for (const [key, item] of this.l1Cache.entries()) {
      if (item.tags && item.tags.some(tag => tags.includes(tag))) {
        this.l1Cache.delete(key);
      }
    }
    this.updateL1Stats();
  }

  private evictFromL1(): void {
    const strategy = this.config.l1.strategy || 'LRU';
    let keyToEvict: string | null = null;

    switch (strategy) {
      case 'LRU':
        keyToEvict = this.findLRUKey();
        break;
      case 'LFU':
        keyToEvict = this.findLFUKey();
        break;
      case 'FIFO':
        keyToEvict = this.findFIFOKey();
        break;
    }

    if (keyToEvict) {
      this.l1Cache.delete(keyToEvict);
      const stats = this.stats.get('L1');
      if (stats) {
        stats.evictions++;
        this.stats.set('L1', stats);
      }
      this.emit('cacheEviction', 'L1', keyToEvict);
    }
  }

  private findLRUKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.l1Cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private findLFUKey(): string | null {
    let leastFrequentKey: string | null = null;
    let minAccessCount = Infinity;

    for (const [key, item] of this.l1Cache.entries()) {
      if (item.accessCount < minAccessCount) {
        minAccessCount = item.accessCount;
        leastFrequentKey = key;
      }
    }

    return leastFrequentKey;
  }

  private findFIFOKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.l1Cache.entries()) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private cleanupL1Cache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.l1Cache.entries()) {
      if (now > item.timestamp + item.ttl * 1000) {
        this.l1Cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired items from L1 cache`);
      this.updateL1Stats();
    }
  }

  private updateL1Stats(type?: 'hit' | 'miss'): void {
    const stats = this.stats.get('L1');
    if (stats) {
      if (type === 'hit') {
        stats.hits++;
      } else if (type === 'miss') {
        stats.misses++;
      }

      const total = stats.hits + stats.misses;
      stats.hitRate = total > 0 ? (stats.hits / total) * 100 : 0;
      stats.size = this.l1Cache.size;

      this.stats.set('L1', stats);
    }
  }

  /**
   * L2 Cache Operations (Redis)
   */
  private async getFromL2<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;

    try {
      const value = await this.redis.get(key);
      if (value === null) {
        this.updateL2Stats('miss');
        return null;
      }

      const parsedValue = this.parseValue<T>(value);
      this.updateL2Stats('hit');
      return parsedValue;

    } catch (error) {
      logger.error(`Error getting from L2 cache: ${error}`);
      return null;
    }
  }

  private async setToL2<T>(key: string, value: T, tags?: string[], ttl?: number): Promise<void> {
    if (!this.redis) return;

    try {
      const serializedValue = this.serializeValue(value, tags);
      const cacheTtl = ttl || this.config.l2.ttl || 3600;

      await this.redis.setex(key, cacheTtl, serializedValue);

      // Store tags for invalidation
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          await this.redis.sadd(`tag:${tag}`, key);
        }
      }

    } catch (error) {
      logger.error(`Error setting to L2 cache: ${error}`);
    }
  }

  private async deleteFromL2(key: string): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error(`Error deleting from L2 cache: ${error}`);
    }
  }

  private async invalidateL2ByTags(tags: string[]): Promise<void> {
    if (!this.redis) return;

    try {
      for (const tag of tags) {
        const keys = await this.redis.smembers(`tag:${tag}`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          await this.redis.del(`tag:${tag}`);
        }
      }
    } catch (error) {
      logger.error(`Error invalidating L2 cache by tags: ${error}`);
    }
  }

  /**
   * L3 Cache Operations (Database)
   */
  private async getFromL3<T>(key: string): Promise<T | null> {
    if (!this.prisma) return null;
    try {
      const cacheEntry = await this.prisma.dataCache.findUnique({
        where: { cacheKey: key }
      });
      if (!cacheEntry) {
        this.updateL3Stats('miss');
        return null;
      }
      // Check if expired
      if (new Date() > cacheEntry.expiresAt) {
        await this.prisma.dataCache.delete({
          where: { cacheKey: key }
        });
        this.updateL3Stats('miss');
        return null;
      }
      const parsedValue = this.parseValue<T>(JSON.stringify(cacheEntry.cacheValue));
      this.updateL3Stats('hit');
      return parsedValue;
    } catch (error) {
      logger.error(`Error getting from L3 cache: ${error}`);
      return null;
    }
  }

  private async setToL3<T>(key: string, value: T, tags?: string[], ttl?: number): Promise<void> {
    if (!this.prisma) return;
    try {
      const serializedValue = this.serializeValue(value, tags);
      const cacheTtl = ttl || this.config.l3.ttl || 86400;
      const expiresAt = new Date(Date.now() + cacheTtl * 1000);
      await this.prisma.dataCache.upsert({
        where: { cacheKey: key },
        update: {
          cacheValue: JSON.parse(serializedValue),
          expiresAt,
          lastAccessed: new Date(),
          accessCount: { increment: 1 }
        },
        create: {
          cacheKey: key,
          cacheValue: JSON.parse(serializedValue),
          expiresAt,
          lastAccessed: new Date(),
          accessCount: 1
        }
      });
    } catch (error) {
      logger.error(`Error setting to L3 cache: ${error}`);
    }
  }

  private async deleteFromL3(key: string): Promise<void> {
    if (!this.prisma) return;
    try {
      await this.prisma.dataCache.delete({
        where: { cacheKey: key }
      });
    } catch (error) {
      logger.error(`Error deleting from L3 cache: ${error}`);
    }
  }

  private async invalidateL3ByTags(tags: string[]): Promise<void> {
    if (!this.prisma) return;
    try {
      for (const tag of tags) {
        await this.prisma.dataCache.deleteMany({
          where: {
            cacheValue: {
              path: ['tags'],
              array_contains: tag
            }
          }
        });
      }
    } catch (error) {
      logger.error(`Error invalidating L3 cache by tags: ${error}`);
    }
  }

  /**
   * Utility Methods
   */
  private serializeValue<T>(value: T, tags?: string[]): string {
    let serialized = JSON.stringify({
      value,
      tags,
      timestamp: Date.now()
    });

    if (this.compressionEnabled) {
      // Implement compression logic here
      // serialized = compress(serialized);
    }

    if (this.encryptionEnabled && this.encryptionKey) {
      // Implement encryption logic here
      // serialized = encrypt(serialized, this.encryptionKey);
    }

    return serialized;
  }

  private parseValue<T>(serialized: string): T {
    let parsed = serialized;

    if (this.encryptionEnabled && this.encryptionKey) {
      // Implement decryption logic here
      // parsed = decrypt(parsed, this.encryptionKey);
    }

    if (this.compressionEnabled) {
      // Implement decompression logic here
      // parsed = decompress(parsed);
    }

    const data = JSON.parse(parsed);
    return data.value as T;
  }

  private updateL2Stats(type?: 'hit' | 'miss'): void {
    const stats = this.stats.get('L2');
    if (stats) {
      if (type === 'hit') {
        stats.hits++;
      } else if (type === 'miss') {
        stats.misses++;
      }

      const total = stats.hits + stats.misses;
      stats.hitRate = total > 0 ? (stats.hits / total) * 100 : 0;

      this.stats.set('L2', stats);
    }
  }

  private updateL3Stats(type?: 'hit' | 'miss'): void {
    const stats = this.stats.get('L3');
    if (stats) {
      if (type === 'hit') {
        stats.hits++;
      } else if (type === 'miss') {
        stats.misses++;
      }

      const total = stats.hits + stats.misses;
      stats.hitRate = total > 0 ? (stats.hits / total) * 100 : 0;

      this.stats.set('L3', stats);
    }
  }

  private recordOperation(operation: string, key: string, level: string, duration: number, success: boolean, error?: string): void {
    if (!this.config.enableMetrics) return;
    const cacheOp: CacheOperation = {
      operation: operation as any,
      key,
      level,
      timestamp: Date.now(),
      duration,
      success,
      error: error || ''
    };
    this.operations.push(cacheOp);
    // Keep only recent operations
    if (this.operations.length > this.maxOperationsHistory) {
      this.operations = this.operations.slice(-this.maxOperationsHistory);
    }
  }

  /**
   * Trading-specific cache methods
   */
  async getMarketData(symbol: string, timeframe: string): Promise<any> {
    const key = `market_data:${symbol}:${timeframe}`;
    return this.get(key, ['market_data', symbol, timeframe]);
  }

  async setMarketData(symbol: string, timeframe: string, data: any, ttl?: number): Promise<void> {
    const key = `market_data:${symbol}:${timeframe}`;
    await this.set(key, data, ['market_data', symbol, timeframe], ttl);
  }

  async getPortfolio(userId: string): Promise<any> {
    const key = `portfolio:${userId}`;
    return this.get(key, ['portfolio', userId]);
  }

  async setPortfolio(userId: string, data: any): Promise<void> {
    const key = `portfolio:${userId}`;
    await this.set(key, data, ['portfolio', userId]);
  }

  async getOrders(userId: string, status?: string): Promise<any> {
    const key = `orders:${userId}:${status || 'all'}`;
    return this.get(key, ['orders', userId, status || 'all']);
  }

  async setOrders(userId: string, status: string, data: any): Promise<void> {
    const key = `orders:${userId}:${status}`;
    await this.set(key, data, ['orders', userId, status]);
  }

  async invalidateUserData(userId: string): Promise<void> {
    await this.invalidateByTags(['user', userId]);
  }

  async invalidateMarketData(symbol?: string): Promise<void> {
    if (symbol) {
      await this.invalidateByTags(['market_data', symbol]);
    } else {
      await this.invalidateByTags(['market_data']);
    }
  }

  /**
   * Dispose of the service
   */
  async dispose(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.disconnect();
      }

      this.l1Cache.clear();
      this.removeAllListeners();

      logger.info('Multi-level cache service disposed');
    } catch (error) {
      logger.error('Error disposing cache service:', error);
    }
  }
} 