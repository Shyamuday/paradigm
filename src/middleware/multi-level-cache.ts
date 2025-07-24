import { Request, Response, NextFunction } from 'express';
import { MultiLevelCacheService, MultiLevelCacheConfig, CacheStats } from '../services/multi-level-cache.service';
import { logger } from '../logger/logger';
import crypto from 'crypto';

export interface CacheMiddlewareConfig {
  cacheService: MultiLevelCacheService;
  enableResponseCaching?: boolean;
  enableRequestCaching?: boolean;
  cacheKeyGenerator?: (req: Request) => string;
  ttl?: number;
  tags?: string[];
  excludePaths?: string[];
  includePaths?: string[];
  enableCompression?: boolean;
  enableMetrics?: boolean;
}

export interface CachedResponse {
  data: any;
  headers: Record<string, string>;
  statusCode: number;
  timestamp: number;
  ttl: number;
}

export class MultiLevelCacheMiddleware {
  private cacheService: MultiLevelCacheService;
  private config: CacheMiddlewareConfig;

  constructor(config: CacheMiddlewareConfig) {
    this.config = {
      enableResponseCaching: true,
      enableRequestCaching: false,
      ttl: 300, // 5 minutes default
      tags: [],
      excludePaths: ['/api/health', '/api/metrics'],
      includePaths: [],
      enableCompression: false,
      enableMetrics: true,
      ...config
    };

    this.cacheService = config.cacheService;
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for cache service
   */
  private setupEventHandlers(): void {
    this.cacheService.on('cacheHit', (level: string, key: string) => {
      logger.debug(`Cache hit on ${level}: ${key}`);
    });

    this.cacheService.on('cacheMiss', (level: string, key: string) => {
      logger.debug(`Cache miss on ${level}: ${key}`);
    });

    this.cacheService.on('redisError', (error: any) => {
      logger.error('Redis cache error in middleware:', error);
    });
  }

  /**
   * Generate cache key from request
   */
  private generateCacheKey(req: Request): string {
    if (this.config.cacheKeyGenerator) {
      return this.config.cacheKeyGenerator(req);
    }

    const method = req.method;
    const url = req.originalUrl || req.url;
    const query = JSON.stringify(req.query);
    const body = req.method !== 'GET' ? JSON.stringify(req.body) : '';
    const userId = (req as any).user?.id || 'anonymous';

    const keyData = `${method}:${url}:${query}:${body}:${userId}`;
    const hash = crypto.createHash('md5').update(keyData).digest('hex');

    return `api:${hash}`;
  }

  /**
   * Check if request should be cached
   */
  private shouldCache(req: Request): boolean {
    const path = req.path;

    // Check exclude paths
    if (this.config.excludePaths?.some(excludePath => path.startsWith(excludePath))) {
      return false;
    }

    // Check include paths (if specified, only cache these paths)
    if (this.config.includePaths && this.config.includePaths.length > 0) {
      return this.config.includePaths.some(includePath => path.startsWith(includePath));
    }

    // Only cache GET requests by default
    if (req.method !== 'GET') {
      return false;
    }

    return true;
  }

  /**
   * Generate cache tags from request
   */
  private generateCacheTags(req: Request): string[] {
    const tags = [...(this.config.tags || [])];

    // Add method tag
    tags.push(`method:${req.method.toLowerCase()}`);

    // Add path tag
    const pathParts = req.path.split('/').filter(Boolean);
    tags.push(`path:${pathParts[0] || 'root'}`);

    // Add user tag if available
    const userId = (req as any).user?.id;
    if (userId) {
      tags.push(`user:${userId}`);
    }

    // Add specific tags for trading endpoints
    if (req.path.includes('/api/trading')) {
      tags.push('trading');
    }
    if (req.path.includes('/api/market-data')) {
      tags.push('market-data');
    }
    if (req.path.includes('/api/portfolio')) {
      tags.push('portfolio');
    }
    if (req.path.includes('/api/orders')) {
      tags.push('orders');
    }

    return tags;
  }

  /**
   * Response caching middleware
   */
  responseCache = async function (this: MultiLevelCacheMiddleware, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!this.config.enableResponseCaching || !this.shouldCache(req)) {
      next();
      return;
    }
    const cacheKey = this.generateCacheKey(req);
    const tags = this.generateCacheTags(req);
    try {
      const cachedResponse = await this.cacheService.get<CachedResponse>(cacheKey, tags);
      if (cachedResponse) {
        Object.entries(cachedResponse.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        res.status(cachedResponse.statusCode).json(cachedResponse.data);
        return;
      }
      const originalJson = res.json;
      const originalSend = res.send;
      res.json = function (this: any, data: any) {
        const response: CachedResponse = {
          data,
          headers: res.getHeaders() as Record<string, string>,
          statusCode: res.statusCode,
          timestamp: Date.now(),
          ttl: this.config.ttl || 300
        };
        (this as MultiLevelCacheMiddleware).cacheService.set(cacheKey, response, tags, (this as MultiLevelCacheMiddleware).config.ttl).catch((error: any) => {
          logger.error('Failed to cache response:', error);
        });
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-Key', cacheKey);
        return originalJson.call(this, data);
      }.bind(this);
      res.send = function (this: any, data: any) {
        const response: CachedResponse = {
          data,
          headers: res.getHeaders() as Record<string, string>,
          statusCode: res.statusCode,
          timestamp: Date.now(),
          ttl: this.config.ttl || 300
        };
        (this as MultiLevelCacheMiddleware).cacheService.set(cacheKey, response, tags, (this as MultiLevelCacheMiddleware).config.ttl).catch((error: any) => {
          logger.error('Failed to cache response:', error);
        });
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-Key', cacheKey);
        return originalSend.call(this, data);
      }.bind(this);
      next();
    } catch (error) {
      logger.error('Error in response cache middleware:', error);
      next();
    }
  } as (this: MultiLevelCacheMiddleware, req: Request, res: Response, next: NextFunction) => Promise<void>;

  /**
   * Request caching middleware (for expensive operations)
   */
  requestCache = async function (this: MultiLevelCacheMiddleware, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!this.config.enableRequestCaching || !this.shouldCache(req)) {
      next();
      return;
    }
    const cacheKey = `request:${this.generateCacheKey(req)}`;
    const tags = this.generateCacheTags(req);
    try {
      const cachedResult = await this.cacheService.get(cacheKey, tags);
      if (cachedResult) {
        res.setHeader('X-Request-Cache', 'HIT');
        res.json(cachedResult);
        return;
      }
      const originalJson = res.json;
      res.json = function (this: any, data: any) {
        (this as MultiLevelCacheMiddleware).cacheService.set(cacheKey, data, tags, (this as MultiLevelCacheMiddleware).config.ttl).catch((error: any) => {
          logger.error('Failed to cache request result:', error);
        });
        res.setHeader('X-Request-Cache', 'MISS');
        return originalJson.call(this, data);
      }.bind(this);
      next();
    } catch (error) {
      logger.error('Error in request cache middleware:', error);
      next();
    }
  } as (this: MultiLevelCacheMiddleware, req: Request, res: Response, next: NextFunction) => Promise<void>;

  /**
   * Cache invalidation middleware
   */
  cacheInvalidation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Add cache invalidation methods to request
    (req as any).invalidateCache = async (tags: string[]) => {
      try {
        await this.cacheService.invalidateByTags(tags);
        logger.info(`Cache invalidated for tags: ${tags.join(', ')}`);
      } catch (error) {
        logger.error('Failed to invalidate cache:', error);
      }
    };

    (req as any).invalidateUserCache = async (userId: string) => {
      try {
        await this.cacheService.invalidateUserData(userId);
        logger.info(`User cache invalidated for: ${userId}`);
      } catch (error) {
        logger.error('Failed to invalidate user cache:', error);
      }
    };

    (req as any).invalidateMarketDataCache = async (symbol?: string) => {
      try {
        await this.cacheService.invalidateMarketData(symbol);
        logger.info(`Market data cache invalidated${symbol ? ` for ${symbol}` : ''}`);
      } catch (error) {
        logger.error('Failed to invalidate market data cache:', error);
      }
    };

    next();
  };

  /**
   * Cache statistics middleware
   */
  cacheStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = this.cacheService.getStats();
      const operations = this.cacheService.getOperations(100);

      (req as any).cacheStats = {
        stats: Object.fromEntries(stats),
        operations,
        summary: this.generateStatsSummary(stats)
      };

      next();
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      next();
    }
  };

  /**
   * Generate cache statistics summary
   */
  private generateStatsSummary(stats: Map<string, CacheStats>): any {
    const summary = {
      totalHits: 0,
      totalMisses: 0,
      overallHitRate: 0,
      totalSize: 0,
      totalEvictions: 0
    };

    for (const [level, stat] of stats) {
      summary.totalHits += stat.hits;
      summary.totalMisses += stat.misses;
      summary.totalSize += stat.size;
      summary.totalEvictions += stat.evictions;
    }

    const totalRequests = summary.totalHits + summary.totalMisses;
    summary.overallHitRate = totalRequests > 0 ? (summary.totalHits / totalRequests) * 100 : 0;

    return summary;
  }

  /**
   * Get cache middleware routes
   */
  getRoutes() {
    return {
      // Get cache statistics
      'GET /api/cache/stats': this.getCacheStats.bind(this),

      // Get cache operations
      'GET /api/cache/operations': this.getCacheOperations.bind(this),

      // Clear cache
      'POST /api/cache/clear': this.clearCache.bind(this),

      // Invalidate cache by tags
      'POST /api/cache/invalidate': this.invalidateCache.bind(this),

      // Get cache health
      'GET /api/cache/health': this.getCacheHealth.bind(this),

      // Cache configuration
      'GET /api/cache/config': this.getCacheConfig.bind(this),

      // Update cache configuration
      'PUT /api/cache/config': this.updateCacheConfig.bind(this)
    };
  }

  /**
   * Get cache statistics
   */
  private async getCacheStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = this.cacheService.getStats();
      const summary = this.generateStatsSummary(stats);

      res.json({
        success: true,
        data: {
          stats: Object.fromEntries(stats),
          summary,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cache statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get cache operations
   */
  private async getCacheOperations(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const operations = this.cacheService.getOperations(limit);

      res.json({
        success: true,
        data: operations,
        count: operations.length,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to get cache operations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cache operations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Clear cache
   */
  private async clearCache(req: Request, res: Response): Promise<void> {
    try {
      await this.cacheService.clear();

      res.json({
        success: true,
        message: 'Cache cleared successfully',
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to clear cache:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear cache',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Invalidate cache by tags
   */
  private async invalidateCache(req: Request, res: Response): Promise<void> {
    try {
      const { tags } = req.body;

      if (!Array.isArray(tags)) {
        res.status(400).json({
          success: false,
          error: 'Tags array is required'
        });
        return;
      }

      await this.cacheService.invalidateByTags(tags);

      res.json({
        success: true,
        message: `Cache invalidated for tags: ${tags.join(', ')}`,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to invalidate cache:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to invalidate cache',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get cache health
   */
  private async getCacheHealth(req: Request, res: Response): Promise<void> {
    try {
      const stats = this.cacheService.getStats();
      const health = {
        status: 'healthy',
        levels: {} as Record<string, any>,
        timestamp: new Date()
      };

      for (const [level, stat] of stats) {
        health.levels[level] = {
          status: stat.hitRate > 50 ? 'healthy' : 'degraded',
          hitRate: stat.hitRate,
          size: stat.size,
          maxSize: stat.maxSize
        };
      }

      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      logger.error('Failed to get cache health:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cache health',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get cache configuration
   */
  private async getCacheConfig(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          ...this.config,
          cacheService: undefined // Don't expose the service instance
        }
      });
    } catch (error) {
      logger.error('Failed to get cache config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cache configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update cache configuration
   */
  private async updateCacheConfig(req: Request, res: Response): Promise<void> {
    try {
      const updates = req.body;

      // Update configuration
      Object.assign(this.config, updates);

      res.json({
        success: true,
        message: 'Cache configuration updated successfully',
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to update cache config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update cache configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get the cache service instance
   */
  getCacheService(): MultiLevelCacheService {
    return this.cacheService;
  }

  /**
   * Dispose of the middleware
   */
  async dispose(): Promise<void> {
    await this.cacheService.dispose();
    logger.info('Multi-level cache middleware disposed');
  }
} 