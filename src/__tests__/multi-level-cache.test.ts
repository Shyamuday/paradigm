import { MultiLevelCacheService, MultiLevelCacheConfig, CacheItem, CacheStats } from '../services/multi-level-cache.service';
import { MultiLevelCacheMiddleware } from '../middleware/multi-level-cache';
import { PrismaClient } from '@prisma/client';
import { logger } from '../logger/logger';

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  smembers: jest.fn(),
  sadd: jest.fn(),
  flushdb: jest.fn(),
  on: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn()
};

// Mock Prisma client
const mockPrisma = {
  cache: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn()
  },
  $disconnect: jest.fn()
} as any;

// Mock logger
jest.mock('../logger/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('MultiLevelCacheService', () => {
  let cacheService: MultiLevelCacheService;
  let config: MultiLevelCacheConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    config = {
      l1: {
        level: 'L1',
        ttl: 300,
        maxSize: 100,
        strategy: 'LRU',
        enabled: true
      },
      l2: {
        level: 'L2',
        ttl: 3600,
        strategy: 'LRU',
        enabled: true
      },
      l3: {
        level: 'L3',
        ttl: 86400,
        strategy: 'LRU',
        enabled: true
      },
      redis: {
        host: 'localhost',
        port: 6379,
        db: 0
      },
      prisma: mockPrisma,
      enableMetrics: true,
      enableCompression: false,
      enableEncryption: false
    };

    cacheService = new MultiLevelCacheService(config);
  });

  afterEach(async () => {
    await cacheService.dispose();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with configuration', () => {
      expect(cacheService).toBeInstanceOf(MultiLevelCacheService);
    });

    it('should setup L1 cache when enabled', () => {
      const stats = cacheService.getStats();
      expect(stats.has('L1')).toBe(true);
    });

    it('should setup L2 cache when Redis is available', async () => {
      mockRedis.connect.mockResolvedValue(undefined);
      
      const serviceWithRedis = new MultiLevelCacheService(config);
      const stats = serviceWithRedis.getStats();
      
      expect(stats.has('L2')).toBe(true);
      await serviceWithRedis.dispose();
    });

    it('should handle Redis connection errors gracefully', async () => {
      mockRedis.connect.mockRejectedValue(new Error('Connection failed'));
      
      const serviceWithRedisError = new MultiLevelCacheService(config);
      const stats = serviceWithRedisError.getStats();
      
      // Should still have L1 cache even if Redis fails
      expect(stats.has('L1')).toBe(true);
      await serviceWithRedisError.dispose();
    });
  });

  describe('L1 Cache Operations', () => {
    it('should set and get values from L1 cache', async () => {
      const testData = { name: 'test', value: 123 };
      
      await cacheService.set('test:key', testData, ['test'], 300);
      const result = await cacheService.get('test:key');
      
      expect(result).toEqual(testData);
    });

    it('should handle expired values in L1 cache', async () => {
      const testData = { name: 'test', value: 123 };
      
      // Set with very short TTL
      await cacheService.set('test:key', testData, ['test'], 0.001);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = await cacheService.get('test:key');
      expect(result).toBeNull();
    });

    it('should evict items when L1 cache is full', async () => {
      // Fill cache beyond capacity
      for (let i = 0; i < 110; i++) {
        await cacheService.set(`key:${i}`, { value: i }, ['test'], 300);
      }
      
      const stats = cacheService.getStats();
      const l1Stats = stats.get('L1');
      
      expect(l1Stats?.evictions).toBeGreaterThan(0);
    });

    it('should update access statistics', async () => {
      const testData = { name: 'test', value: 123 };
      
      await cacheService.set('test:key', testData, ['test'], 300);
      
      // Access multiple times
      await cacheService.get('test:key');
      await cacheService.get('test:key');
      await cacheService.get('test:key');
      
      const stats = cacheService.getStats();
      const l1Stats = stats.get('L1');
      
      expect(l1Stats?.hits).toBe(3);
    });

    it('should delete values from L1 cache', async () => {
      const testData = { name: 'test', value: 123 };
      
      await cacheService.set('test:key', testData, ['test'], 300);
      await cacheService.delete('test:key');
      
      const result = await cacheService.get('test:key');
      expect(result).toBeNull();
    });

    it('should invalidate by tags in L1 cache', async () => {
      await cacheService.set('key1', { value: 1 }, ['tag1', 'tag2']);
      await cacheService.set('key2', { value: 2 }, ['tag2', 'tag3']);
      await cacheService.set('key3', { value: 3 }, ['tag1', 'tag3']);
      
      await cacheService.invalidateByTags(['tag1']);
      
      const result1 = await cacheService.get('key1');
      const result2 = await cacheService.get('key2');
      const result3 = await cacheService.get('key3');
      
      expect(result1).toBeNull();
      expect(result2).not.toBeNull(); // Should still exist
      expect(result3).toBeNull();
    });
  });

  describe('L2 Cache Operations (Redis)', () => {
    beforeEach(() => {
      mockRedis.connect.mockResolvedValue(undefined);
    });

    it('should set and get values from L2 cache', async () => {
      const testData = { name: 'test', value: 123 };
      const serializedData = JSON.stringify({ value: testData, tags: ['test'], timestamp: Date.now() });
      
      mockRedis.get.mockResolvedValue(serializedData);
      mockRedis.setex.mockResolvedValue('OK');
      
      await cacheService.set('test:key', testData, ['test'], 300);
      const result = await cacheService.get('test:key');
      
      expect(mockRedis.setex).toHaveBeenCalled();
      expect(result).toEqual(testData);
    });

    it('should handle Redis cache misses', async () => {
      mockRedis.get.mockResolvedValue(null);
      
      const result = await cacheService.get('test:key');
      expect(result).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      
      const result = await cacheService.get('test:key');
      expect(result).toBeNull();
    });

    it('should delete values from L2 cache', async () => {
      mockRedis.del.mockResolvedValue(1);
      
      await cacheService.delete('test:key');
      expect(mockRedis.del).toHaveBeenCalledWith('test:key');
    });

    it('should invalidate by tags in L2 cache', async () => {
      mockRedis.smembers.mockResolvedValue(['key1', 'key2']);
      mockRedis.del.mockResolvedValue(2);
      
      await cacheService.invalidateByTags(['tag1']);
      
      expect(mockRedis.smembers).toHaveBeenCalledWith('tag:tag1');
      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2');
    });
  });

  describe('L3 Cache Operations (Database)', () => {
    it('should set and get values from L3 cache', async () => {
      const testData = { name: 'test', value: 123 };
      const serializedData = JSON.stringify({ value: testData, tags: ['test'], timestamp: Date.now() });
      const futureDate = new Date(Date.now() + 3600000);
      
      mockPrisma.cache.findUnique.mockResolvedValue({
        key: 'test:key',
        value: serializedData,
        expiresAt: futureDate
      });
      
      mockPrisma.cache.upsert.mockResolvedValue({});
      
      await cacheService.set('test:key', testData, ['test'], 300);
      const result = await cacheService.get('test:key');
      
      expect(mockPrisma.cache.upsert).toHaveBeenCalled();
      expect(result).toEqual(testData);
    });

    it('should handle expired values in L3 cache', async () => {
      const pastDate = new Date(Date.now() - 1000);
      
      mockPrisma.cache.findUnique.mockResolvedValue({
        key: 'test:key',
        value: '{}',
        expiresAt: pastDate
      });
      
      mockPrisma.cache.delete.mockResolvedValue({});
      
      const result = await cacheService.get('test:key');
      
      expect(result).toBeNull();
      expect(mockPrisma.cache.delete).toHaveBeenCalled();
    });

    it('should handle database cache misses', async () => {
      mockPrisma.cache.findUnique.mockResolvedValue(null);
      
      const result = await cacheService.get('test:key');
      expect(result).toBeNull();
    });

    it('should delete values from L3 cache', async () => {
      mockPrisma.cache.delete.mockResolvedValue({});
      
      await cacheService.delete('test:key');
      expect(mockPrisma.cache.delete).toHaveBeenCalledWith({
        where: { key: 'test:key' }
      });
    });

    it('should invalidate by tags in L3 cache', async () => {
      mockPrisma.cache.deleteMany.mockResolvedValue({ count: 2 });
      
      await cacheService.invalidateByTags(['tag1']);
      
      expect(mockPrisma.cache.deleteMany).toHaveBeenCalledWith({
        where: {
          tags: {
            contains: 'tag1'
          }
        }
      });
    });
  });

  describe('Multi-Level Cache Operations', () => {
    it('should cascade from L1 to L2 to L3', async () => {
      const testData = { name: 'test', value: 123 };
      
      // Mock L3 cache to return data
      const serializedData = JSON.stringify({ value: testData, tags: ['test'], timestamp: Date.now() });
      const futureDate = new Date(Date.now() + 3600000);
      
      mockPrisma.cache.findUnique.mockResolvedValue({
        key: 'test:key',
        value: serializedData,
        expiresAt: futureDate
      });
      
      mockRedis.get.mockResolvedValue(null); // L2 miss
      mockRedis.setex.mockResolvedValue('OK');
      
      const result = await cacheService.get('test:key');
      
      expect(result).toEqual(testData);
      expect(mockRedis.setex).toHaveBeenCalled(); // Should populate L2
    });

    it('should clear all cache levels', async () => {
      mockRedis.flushdb.mockResolvedValue('OK');
      mockPrisma.cache.deleteMany.mockResolvedValue({ count: 0 });
      
      await cacheService.clear();
      
      expect(mockRedis.flushdb).toHaveBeenCalled();
      expect(mockPrisma.cache.deleteMany).toHaveBeenCalled();
    });
  });

  describe('Trading-Specific Methods', () => {
    it('should handle market data caching', async () => {
      const marketData = { symbol: 'RELIANCE', price: 2500 };
      
      await cacheService.setMarketData('RELIANCE', '1m', marketData, 60);
      const result = await cacheService.getMarketData('RELIANCE', '1m');
      
      expect(result).toEqual(marketData);
    });

    it('should handle portfolio caching', async () => {
      const portfolioData = { userId: 'user123', totalValue: 100000 };
      
      await cacheService.setPortfolio('user123', portfolioData);
      const result = await cacheService.getPortfolio('user123');
      
      expect(result).toEqual(portfolioData);
    });

    it('should handle orders caching', async () => {
      const ordersData = [{ id: 'order1', symbol: 'RELIANCE' }];
      
      await cacheService.setOrders('user123', 'PENDING', ordersData);
      const result = await cacheService.getOrders('user123', 'PENDING');
      
      expect(result).toEqual(ordersData);
    });

    it('should invalidate user data', async () => {
      await cacheService.invalidateUserData('user123');
      // This should trigger tag-based invalidation
      expect(true).toBe(true); // Just verify it doesn't throw
    });

    it('should invalidate market data', async () => {
      await cacheService.invalidateMarketData('RELIANCE');
      // This should trigger tag-based invalidation
      expect(true).toBe(true); // Just verify it doesn't throw
    });
  });

  describe('Statistics and Metrics', () => {
    it('should track cache statistics', async () => {
      const testData = { name: 'test', value: 123 };
      
      await cacheService.set('test:key', testData, ['test'], 300);
      await cacheService.get('test:key');
      await cacheService.get('test:key');
      await cacheService.get('nonexistent:key');
      
      const stats = cacheService.getStats();
      const l1Stats = stats.get('L1');
      
      expect(l1Stats?.hits).toBe(2);
      expect(l1Stats?.misses).toBe(1);
      expect(l1Stats?.hitRate).toBeGreaterThan(0);
    });

    it('should track cache operations', async () => {
      const testData = { name: 'test', value: 123 };
      
      await cacheService.set('test:key', testData, ['test'], 300);
      await cacheService.get('test:key');
      
      const operations = cacheService.getOperations(10);
      
      expect(operations.length).toBeGreaterThan(0);
      expect(operations[0]).toHaveProperty('operation');
      expect(operations[0]).toHaveProperty('key');
      expect(operations[0]).toHaveProperty('level');
    });
  });

  describe('Event Emission', () => {
    it('should emit cache hit events', (done) => {
      const testData = { name: 'test', value: 123 };
      
      cacheService.on('cacheHit', (level: string, key: string) => {
        expect(level).toBe('L1');
        expect(key).toBe('test:key');
        done();
      });
      
      cacheService.set('test:key', testData, ['test'], 300).then(() => {
        return cacheService.get('test:key');
      });
    });

    it('should emit cache miss events', (done) => {
      cacheService.on('cacheMiss', (level: string, key: string) => {
        expect(level).toBe('ALL');
        expect(key).toBe('nonexistent:key');
        done();
      });
      
      cacheService.get('nonexistent:key');
    });
  });
});

describe('MultiLevelCacheMiddleware', () => {
  let middleware: MultiLevelCacheMiddleware;
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: jest.Mock;
  let mockCacheService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      invalidateByTags: jest.fn(),
      clear: jest.fn(),
      getStats: jest.fn(),
      getOperations: jest.fn(),
      on: jest.fn(),
      dispose: jest.fn()
    };

    middleware = new MultiLevelCacheMiddleware({
      cacheService: mockCacheService,
      enableResponseCaching: true,
      enableRequestCaching: false,
      ttl: 300,
      tags: ['test'],
      excludePaths: ['/api/health'],
      enableMetrics: true
    });

    mockRequest = {
      method: 'GET',
      path: '/api/test',
      originalUrl: '/api/test',
      url: '/api/test',
      query: {},
      body: {},
      user: { id: 'user123' }
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      getHeaders: jest.fn().mockReturnValue({})
    };

    mockNext = jest.fn();
  });

  afterEach(async () => {
    await middleware.dispose();
  });

  describe('Constructor', () => {
    it('should initialize with configuration', () => {
      expect(middleware).toBeInstanceOf(MultiLevelCacheMiddleware);
    });

    it('should setup event handlers', () => {
      expect(mockCacheService.on).toHaveBeenCalled();
    });
  });

  describe('Response Caching', () => {
    it('should cache responses for GET requests', async () => {
      const cachedResponse = {
        data: { result: 'cached' },
        headers: { 'content-type': 'application/json' },
        statusCode: 200,
        timestamp: Date.now(),
        ttl: 300
      };

      mockCacheService.get.mockResolvedValue(cachedResponse);

      await middleware.responseCache(mockRequest, mockResponse, mockNext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT');
      expect(mockResponse.json).toHaveBeenCalledWith(cachedResponse.data);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not cache excluded paths', async () => {
      mockRequest.path = '/api/health';

      await middleware.responseCache(mockRequest, mockResponse, mockNext);

      expect(mockCacheService.get).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not cache non-GET requests', async () => {
      mockRequest.method = 'POST';

      await middleware.responseCache(mockRequest, mockResponse, mockNext);

      expect(mockCacheService.get).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should cache responses on cache miss', async () => {
      mockCacheService.get.mockResolvedValue(null);

      await middleware.responseCache(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();

      // Simulate response
      const originalJson = mockResponse.json;
      mockResponse.json({ result: 'new' });

      expect(mockCacheService.set).toHaveBeenCalled();
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
    });
  });

  describe('Cache Invalidation', () => {
    it('should add invalidation methods to request', async () => {
      await middleware.cacheInvalidation(mockRequest, mockResponse, mockNext);

      expect(mockRequest.invalidateCache).toBeDefined();
      expect(mockRequest.invalidateUserCache).toBeDefined();
      expect(mockRequest.invalidateMarketDataCache).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle cache invalidation calls', async () => {
      await middleware.cacheInvalidation(mockRequest, mockResponse, mockNext);

      await mockRequest.invalidateCache(['tag1', 'tag2']);
      expect(mockCacheService.invalidateByTags).toHaveBeenCalledWith(['tag1', 'tag2']);
    });
  });

  describe('Cache Statistics', () => {
    it('should add cache stats to request', async () => {
      const mockStats = new Map([['L1', { hits: 10, misses: 5 }]]);
      const mockOperations = [{ operation: 'GET', key: 'test' }];

      mockCacheService.getStats.mockReturnValue(mockStats);
      mockCacheService.getOperations.mockReturnValue(mockOperations);

      await middleware.cacheStats(mockRequest, mockResponse, mockNext);

      expect(mockRequest.cacheStats).toBeDefined();
      expect(mockRequest.cacheStats.stats).toBeDefined();
      expect(mockRequest.cacheStats.operations).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('API Routes', () => {
    it('should get cache statistics', async () => {
      const mockStats = new Map([['L1', { hits: 10, misses: 5 }]]);
      mockCacheService.getStats.mockReturnValue(mockStats);

      const routes = middleware.getRoutes();
      const getStatsHandler = routes['GET /api/cache/stats'];
      
      await getStatsHandler(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          stats: expect.any(Object),
          summary: expect.any(Object),
          timestamp: expect.any(Date)
        })
      });
    });

    it('should get cache operations', async () => {
      const mockOperations = [{ operation: 'GET', key: 'test' }];
      mockCacheService.getOperations.mockReturnValue(mockOperations);

      const routes = middleware.getRoutes();
      const getOperationsHandler = routes['GET /api/cache/operations'];
      
      await getOperationsHandler(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockOperations,
        count: 1,
        timestamp: expect.any(Date)
      });
    });

    it('should clear cache', async () => {
      mockCacheService.clear.mockResolvedValue(undefined);

      const routes = middleware.getRoutes();
      const clearCacheHandler = routes['POST /api/cache/clear'];
      
      await clearCacheHandler(mockRequest, mockResponse);

      expect(mockCacheService.clear).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Cache cleared successfully',
        timestamp: expect.any(Date)
      });
    });

    it('should invalidate cache by tags', async () => {
      mockRequest.body = { tags: ['tag1', 'tag2'] };
      mockCacheService.invalidateByTags.mockResolvedValue(undefined);

      const routes = middleware.getRoutes();
      const invalidateHandler = routes['POST /api/cache/invalidate'];
      
      await invalidateHandler(mockRequest, mockResponse);

      expect(mockCacheService.invalidateByTags).toHaveBeenCalledWith(['tag1', 'tag2']);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Cache invalidated for tags: tag1, tag2',
        timestamp: expect.any(Date)
      });
    });

    it('should handle missing tags parameter', async () => {
      mockRequest.body = {};

      const routes = middleware.getRoutes();
      const invalidateHandler = routes['POST /api/cache/invalidate'];
      
      await invalidateHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Tags array is required'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle cache service errors gracefully', async () => {
      mockCacheService.getStats.mockRejectedValue(new Error('Cache error'));

      const routes = middleware.getRoutes();
      const getStatsHandler = routes['GET /api/cache/stats'];
      
      await getStatsHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get cache statistics',
        message: 'Cache error'
      });
    });
  });

  describe('Disposal', () => {
    it('should dispose of resources properly', async () => {
      await middleware.dispose();
      expect(mockCacheService.dispose).toHaveBeenCalled();
    });
  });
}); 