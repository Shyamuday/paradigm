import Redis from 'ioredis';
import { logger } from '../logger/logger';

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export class CacheService {
  private redis: Redis;
  private isConnected = false;
  private defaultTTL = 3600; // 1 hour default

  constructor(config: CacheConfig) {
    this.redis = new Redis({
      host: config.host || 'localhost',
      port: config.port || 6379,
      password: config.password,
      db: config.db || 0,
      keyPrefix: config.keyPrefix || 'trading_bot:',
      retryDelayOnFailover: config.retryDelayOnFailover || 100,
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      lazyConnect: config.lazyConnect || true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis connected');
    });

    this.redis.on('ready', () => {
      logger.info('Redis ready');
    });

    this.redis.on('error', (error) => {
      this.isConnected = false;
      logger.error('Redis error', error);
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });
  }

  /**
   * Set a key-value pair in cache
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const fullKey = this.buildKey(key, options.prefix);
      const serializedValue = JSON.stringify(value);
      const ttl = options.ttl || this.defaultTTL;

      await this.redis.setex(fullKey, ttl, serializedValue);
      
      logger.debug('Cache set', { key: fullKey, ttl });
    } catch (error) {
      logger.error('Cache set error', { key, error });
      throw error;
    }
  }

  /**
   * Get a value from cache
   */
  async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const fullKey = this.buildKey(key, options.prefix);
      const value = await this.redis.get(fullKey);

      if (value === null) {
        logger.debug('Cache miss', { key: fullKey });
        return null;
      }

      const parsedValue = JSON.parse(value);
      logger.debug('Cache hit', { key: fullKey });
      return parsedValue;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const fullKey = this.buildKey(key, options.prefix);
      const result = await this.redis.del(fullKey);
      
      logger.debug('Cache delete', { key: fullKey, deleted: result > 0 });
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error', { key, error });
      return false;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const fullKey = this.buildKey(key, options.prefix);
      const result = await this.redis.exists(fullKey);
      
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { key, error });
      return false;
    }
  }

  /**
   * Set expiration time for a key
   */
  async expire(key: string, ttl: number, options: CacheOptions = {}): Promise<boolean> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const fullKey = this.buildKey(key, options.prefix);
      const result = await this.redis.expire(fullKey, ttl);
      
      logger.debug('Cache expire', { key: fullKey, ttl, success: result === 1 });
      return result === 1;
    } catch (error) {
      logger.error('Cache expire error', { key, ttl, error });
      return false;
    }
  }

  /**
   * Get time to live for a key
   */
  async ttl(key: string, options: CacheOptions = {}): Promise<number> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const fullKey = this.buildKey(key, options.prefix);
      const result = await this.redis.ttl(fullKey);
      
      return result;
    } catch (error) {
      logger.error('Cache TTL error', { key, error });
      return -1;
    }
  }

  /**
   * Increment a numeric value
   */
  async increment(key: string, amount: number = 1, options: CacheOptions = {}): Promise<number> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const fullKey = this.buildKey(key, options.prefix);
      const result = await this.redis.incrby(fullKey, amount);
      
      logger.debug('Cache increment', { key: fullKey, amount, result });
      return result;
    } catch (error) {
      logger.error('Cache increment error', { key, amount, error });
      throw error;
    }
  }

  /**
   * Decrement a numeric value
   */
  async decrement(key: string, amount: number = 1, options: CacheOptions = {}): Promise<number> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const fullKey = this.buildKey(key, options.prefix);
      const result = await this.redis.decrby(fullKey, amount);
      
      logger.debug('Cache decrement', { key: fullKey, amount, result });
      return result;
    } catch (error) {
      logger.error('Cache decrement error', { key, amount, error });
      throw error;
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(keyValuePairs: Record<string, any>, options: CacheOptions = {}): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const pipeline = this.redis.pipeline();
      const ttl = options.ttl || this.defaultTTL;

      for (const [key, value] of Object.entries(keyValuePairs)) {
        const fullKey = this.buildKey(key, options.prefix);
        const serializedValue = JSON.stringify(value);
        pipeline.setex(fullKey, ttl, serializedValue);
      }

      await pipeline.exec();
      logger.debug('Cache mset', { count: Object.keys(keyValuePairs).length });
    } catch (error) {
      logger.error('Cache mset error', { error });
      throw error;
    }
  }

  /**
   * Get multiple values
   */
  async mget(keys: string[], options: CacheOptions = {}): Promise<(any | null)[]> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const fullKeys = keys.map(key => this.buildKey(key, options.prefix));
      const values = await this.redis.mget(fullKeys);

      const result = values.map(value => {
        if (value === null) return null;
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      });

      logger.debug('Cache mget', { keys: fullKeys, found: result.filter(v => v !== null).length });
      return result;
    } catch (error) {
      logger.error('Cache mget error', { keys, error });
      return keys.map(() => null);
    }
  }

  /**
   * Delete multiple keys
   */
  async mdelete(keys: string[], options: CacheOptions = {}): Promise<number> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const fullKeys = keys.map(key => this.buildKey(key, options.prefix));
      const result = await this.redis.del(...fullKeys);
      
      logger.debug('Cache mdelete', { keys: fullKeys, deleted: result });
      return result;
    } catch (error) {
      logger.error('Cache mdelete error', { keys, error });
      return 0;
    }
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const fullPattern = this.buildKey(pattern);
      const keys = await this.redis.keys(fullPattern);
      
      logger.debug('Cache keys', { pattern: fullPattern, count: keys.length });
      return keys;
    } catch (error) {
      logger.error('Cache keys error', { pattern, error });
      return [];
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const keys = await this.redis.keys('trading_bot:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      
      logger.info('Cache cleared', { deletedKeys: keys.length });
    } catch (error) {
      logger.error('Cache clear error', { error });
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    totalKeys: number;
    memoryUsage: string;
    info: any;
  }> {
    try {
      if (!this.isConnected) {
        return {
          connected: false,
          totalKeys: 0,
          memoryUsage: '0',
          info: {}
        };
      }

      const [totalKeys, memoryUsage, info] = await Promise.all([
        this.redis.dbsize(),
        this.redis.memory('USAGE'),
        this.redis.info()
      ]);

      return {
        connected: true,
        totalKeys,
        memoryUsage: memoryUsage.toString(),
        info: this.parseRedisInfo(info)
      };
    } catch (error) {
      logger.error('Cache stats error', { error });
      return {
        connected: false,
        totalKeys: 0,
        memoryUsage: '0',
        info: {}
      };
    }
  }

  /**
   * Build cache key with prefix
   */
  private buildKey(key: string, prefix?: string): string {
    if (prefix) {
      return `${prefix}:${key}`;
    }
    return key;
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string): Record<string, any> {
    const lines = info.split('\r\n');
    const result: Record<string, any> = {};

    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      this.isConnected = false;
      logger.info('Redis disconnected');
    } catch (error) {
      logger.error('Redis disconnect error', { error });
    }
  }

  /**
   * Check if Redis is connected
   */
  isRedisConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get Redis client for advanced operations
   */
  getRedisClient(): Redis {
    return this.redis;
  }
}

// Cache prefixes for different data types
export const cachePrefixes = {
  MARKET_DATA: 'market_data',
  USER_SESSION: 'user_session',
  STRATEGY: 'strategy',
  ORDER: 'order',
  POSITION: 'position',
  INSTRUMENT: 'instrument',
  QUOTE: 'quote',
  HISTORICAL: 'historical',
  CONFIG: 'config',
  TEMP: 'temp'
};

// Default cache configuration
export const defaultCacheConfig: CacheConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  keyPrefix: 'trading_bot:',
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
};

// Export singleton instance
export const cache = new CacheService(defaultCacheConfig); 