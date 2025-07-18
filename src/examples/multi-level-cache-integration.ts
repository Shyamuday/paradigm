import { MultiLevelCacheService, MultiLevelCacheConfig } from '../services/multi-level-cache.service';
import { MultiLevelCacheMiddleware } from '../middleware/multi-level-cache';
import { PrismaClient } from '@prisma/client';
import { logger } from '../logger/logger';

/**
 * Example: Multi-Level Cache Integration
 * 
 * This example demonstrates how to integrate multi-level caching
 * features into your trading platform for improved performance.
 */
export class MultiLevelCacheExample {
  private cacheService: MultiLevelCacheService;
  private middleware: MultiLevelCacheMiddleware;
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
    
    // Configure multi-level cache
    const cacheConfig: MultiLevelCacheConfig = {
      l1: {
        level: 'L1',
        ttl: 300, // 5 minutes
        maxSize: 1000,
        strategy: 'LRU',
        enabled: true
      },
      l2: {
        level: 'L2',
        ttl: 3600, // 1 hour
        strategy: 'LRU',
        enabled: true
      },
      l3: {
        level: 'L3',
        ttl: 86400, // 24 hours
        strategy: 'LRU',
        enabled: true
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: 0
      },
      prisma: this.prisma,
      enableMetrics: true,
      enableCompression: false,
      enableEncryption: false
    };

    this.cacheService = new MultiLevelCacheService(cacheConfig);
    this.middleware = new MultiLevelCacheMiddleware({
      cacheService: this.cacheService,
      enableResponseCaching: true,
      enableRequestCaching: false,
      ttl: 300,
      tags: ['trading', 'api'],
      excludePaths: ['/api/health', '/api/metrics', '/api/cache'],
      enableMetrics: true
    });
  }

  /**
   * Example: Basic cache operations
   */
  async demonstrateBasicOperations(): Promise<void> {
    logger.info('Demonstrating basic cache operations...');

    try {
      // Set data in cache
      const userData = {
        id: 'user123',
        name: 'John Doe',
        portfolio: {
          totalValue: 100000,
          positions: [
            { symbol: 'RELIANCE', quantity: 100, avgPrice: 2500 },
            { symbol: 'TCS', quantity: 50, avgPrice: 3500 }
          ]
        }
      };

      await this.cacheService.set('user:123', userData, ['user', 'portfolio'], 600);
      logger.info('✅ Data cached successfully');

      // Get data from cache
      const cachedData = await this.cacheService.get('user:123');
      logger.info('✅ Retrieved from cache:', cachedData ? 'Found' : 'Not found');

      // Update data
      userData.portfolio.totalValue = 105000;
      await this.cacheService.set('user:123', userData, ['user', 'portfolio'], 600);
      logger.info('✅ Data updated in cache');

      // Delete data
      await this.cacheService.delete('user:123');
      logger.info('✅ Data deleted from cache');

    } catch (error) {
      logger.error('❌ Basic operations failed:', error);
      throw error;
    }
  }

  /**
   * Example: Trading-specific caching
   */
  async demonstrateTradingCaching(): Promise<void> {
    logger.info('Demonstrating trading-specific caching...');

    try {
      // Cache market data
      const marketData = {
        symbol: 'RELIANCE',
        price: 2500.50,
        change: 25.50,
        volume: 1000000,
        timestamp: new Date()
      };

      await this.cacheService.setMarketData('RELIANCE', '1m', marketData, 60);
      logger.info('✅ Market data cached');

      // Cache portfolio data
      const portfolioData = {
        userId: 'user123',
        totalValue: 100000,
        positions: [
          { symbol: 'RELIANCE', quantity: 100, currentValue: 250000 },
          { symbol: 'TCS', quantity: 50, currentValue: 175000 }
        ],
        lastUpdated: new Date()
      };

      await this.cacheService.setPortfolio('user123', portfolioData);
      logger.info('✅ Portfolio data cached');

      // Cache orders
      const ordersData = [
        { id: 'order1', symbol: 'RELIANCE', quantity: 10, price: 2500, status: 'PENDING' },
        { id: 'order2', symbol: 'TCS', quantity: 5, price: 3500, status: 'COMPLETED' }
      ];

      await this.cacheService.setOrders('user123', 'PENDING', ordersData);
      logger.info('✅ Orders data cached');

      // Retrieve cached data
      const cachedMarketData = await this.cacheService.getMarketData('RELIANCE', '1m');
      const cachedPortfolio = await this.cacheService.getPortfolio('user123');
      const cachedOrders = await this.cacheService.getOrders('user123', 'PENDING');

      logger.info('✅ Retrieved cached trading data:', {
        marketData: cachedMarketData ? 'Found' : 'Not found',
        portfolio: cachedPortfolio ? 'Found' : 'Not found',
        orders: cachedOrders ? 'Found' : 'Not found'
      });

    } catch (error) {
      logger.error('❌ Trading caching failed:', error);
      throw error;
    }
  }

  /**
   * Example: Cache invalidation strategies
   */
  async demonstrateCacheInvalidation(): Promise<void> {
    logger.info('Demonstrating cache invalidation strategies...');

    try {
      // Set data with different tags
      await this.cacheService.set('data1', { value: 'data1' }, ['tag1', 'tag2']);
      await this.cacheService.set('data2', { value: 'data2' }, ['tag2', 'tag3']);
      await this.cacheService.set('data3', { value: 'data3' }, ['tag1', 'tag3']);

      logger.info('✅ Data set with tags');

      // Invalidate by specific tag
      await this.cacheService.invalidateByTags(['tag1']);
      logger.info('✅ Invalidated cache by tag1');

      // Check what remains
      const data1 = await this.cacheService.get('data1');
      const data2 = await this.cacheService.get('data2');
      const data3 = await this.cacheService.get('data3');

      logger.info('✅ After invalidation:', {
        data1: data1 ? 'Found' : 'Not found',
        data2: data2 ? 'Found' : 'Not found',
        data3: data3 ? 'Found' : 'Not found'
      });

      // Invalidate user-specific data
      await this.cacheService.invalidateUserData('user123');
      logger.info('✅ Invalidated user data');

      // Invalidate market data
      await this.cacheService.invalidateMarketData('RELIANCE');
      logger.info('✅ Invalidated market data for RELIANCE');

    } catch (error) {
      logger.error('❌ Cache invalidation failed:', error);
      throw error;
    }
  }

  /**
   * Example: Performance monitoring and statistics
   */
  async demonstratePerformanceMonitoring(): Promise<void> {
    logger.info('Demonstrating performance monitoring...');

    try {
      // Setup event listeners for monitoring
      this.cacheService.on('cacheHit', (level: string, key: string) => {
        logger.info(`🎯 Cache hit on ${level}: ${key}`);
      });

      this.cacheService.on('cacheMiss', (level: string, key: string) => {
        logger.info(`❌ Cache miss on ${level}: ${key}`);
      });

      this.cacheService.on('redisError', (error: any) => {
        logger.error(`🔴 Redis error: ${error.message}`);
      });

      // Perform some cache operations
      for (let i = 0; i < 10; i++) {
        await this.cacheService.set(`test:${i}`, { value: i }, ['test']);
        await this.cacheService.get(`test:${i}`);
      }

      // Get cache statistics
      const stats = this.cacheService.getStats();
      logger.info('📊 Cache statistics:', Object.fromEntries(stats));

      // Get recent operations
      const operations = this.cacheService.getOperations(10);
      logger.info(`📈 Recent operations: ${operations.length} operations`);

      // Calculate performance metrics
      let totalHits = 0;
      let totalMisses = 0;

      for (const [level, stat] of stats) {
        totalHits += stat.hits;
        totalMisses += stat.misses;
      }

      const overallHitRate = totalHits + totalMisses > 0 ? 
        (totalHits / (totalHits + totalMisses)) * 100 : 0;

      logger.info(`📊 Overall hit rate: ${overallHitRate.toFixed(2)}%`);

    } catch (error) {
      logger.error('❌ Performance monitoring failed:', error);
      throw error;
    }
  }

  /**
   * Example: Express integration
   */
  getExpressIntegrationExample(): any {
    return {
      // Middleware setup
      setupMiddleware: (app: any) => {
        // Add cache middleware
        app.use(this.middleware.cacheInvalidation);
        app.use(this.middleware.cacheStats);
        app.use(this.middleware.responseCache);

        // Add cache management routes
        const routes = this.middleware.getRoutes();
        Object.entries(routes).forEach(([route, handler]) => {
          const [method, path] = route.split(' ');
          if (method && path) {
            app[method.toLowerCase()](path, handler);
          }
        });

        logger.info('✅ Multi-level cache middleware integrated');
      },

      // Example API endpoints with caching
      apiExamples: {
        getPortfolio: 'GET /api/portfolio/:userId',
        getMarketData: 'GET /api/market-data/:symbol',
        getOrders: 'GET /api/orders/:userId',
        updatePortfolio: 'PUT /api/portfolio/:userId',
        placeOrder: 'POST /api/orders'
      },

      // Cache management endpoints
      cacheEndpoints: {
        getStats: 'GET /api/cache/stats',
        getOperations: 'GET /api/cache/operations',
        clearCache: 'POST /api/cache/clear',
        invalidateCache: 'POST /api/cache/invalidate',
        getHealth: 'GET /api/cache/health'
      }
    };
  }

  /**
   * Example: Advanced caching strategies
   */
  async demonstrateAdvancedStrategies(): Promise<void> {
    logger.info('Demonstrating advanced caching strategies...');

    try {
      // 1. Time-based caching with different TTLs
      const shortLivedData = { type: 'short', value: 'expires soon' };
      const longLivedData = { type: 'long', value: 'stays longer' };

      await this.cacheService.set('short:data', shortLivedData, ['short'], 60); // 1 minute
      await this.cacheService.set('long:data', longLivedData, ['long'], 3600); // 1 hour

      logger.info('✅ Time-based caching implemented');

      // 2. Priority-based caching
      const highPriorityData = { priority: 'high', value: 'important data' };
      const lowPriorityData = { priority: 'low', value: 'less important' };

      await this.cacheService.set('high:priority', highPriorityData, ['high-priority'], 300);
      await this.cacheService.set('low:priority', lowPriorityData, ['low-priority'], 300);

      logger.info('✅ Priority-based caching implemented');

      // 3. Pattern-based invalidation
      await this.cacheService.set('user:123:profile', { name: 'John' }, ['user', 'profile']);
      await this.cacheService.set('user:123:settings', { theme: 'dark' }, ['user', 'settings']);
      await this.cacheService.set('user:456:profile', { name: 'Jane' }, ['user', 'profile']);

      // Invalidate all user profiles
      await this.cacheService.invalidateByTags(['user', 'profile']);
      logger.info('✅ Pattern-based invalidation implemented');

      // 4. Cache warming
      const popularSymbols = ['RELIANCE', 'TCS', 'INFY', 'HDFC'];
      for (const symbol of popularSymbols) {
        const mockData = {
          symbol,
          price: Math.random() * 5000,
          timestamp: new Date()
        };
        await this.cacheService.setMarketData(symbol, '1m', mockData, 300);
      }
      logger.info('✅ Cache warming implemented');

    } catch (error) {
      logger.error('❌ Advanced strategies failed:', error);
      throw error;
    }
  }

  /**
   * Example: Real-time trading cache optimization
   */
  async demonstrateTradingOptimization(): Promise<void> {
    logger.info('Demonstrating trading cache optimization...');

    try {
      // Simulate real-time market data updates
      const symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFC', 'ICICIBANK'];
      
      for (let i = 0; i < 5; i++) {
        for (const symbol of symbols) {
          const marketData = {
            symbol,
            price: 2000 + Math.random() * 1000,
            volume: 100000 + Math.random() * 500000,
            timestamp: new Date()
          };

          // Cache with short TTL for real-time data
          await this.cacheService.setMarketData(symbol, '1s', marketData, 5);
        }

        // Simulate some delay
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.info('✅ Real-time market data caching');

      // Simulate portfolio updates
      const userIds = ['user1', 'user2', 'user3'];
      for (const userId of userIds) {
        const portfolio = {
          userId,
          totalValue: 50000 + Math.random() * 100000,
          positions: [
            { symbol: 'RELIANCE', quantity: 10 + Math.floor(Math.random() * 50) },
            { symbol: 'TCS', quantity: 5 + Math.floor(Math.random() * 25) }
          ],
          lastUpdated: new Date()
        };

        await this.cacheService.setPortfolio(userId, portfolio);
      }

      logger.info('✅ Portfolio caching optimization');

      // Demonstrate cache hit rates
      const stats = this.cacheService.getStats();
      for (const [level, stat] of stats) {
        logger.info(`📊 ${level} Cache - Hit Rate: ${stat.hitRate.toFixed(2)}%, Size: ${stat.size}`);
      }

    } catch (error) {
      logger.error('❌ Trading optimization failed:', error);
      throw error;
    }
  }

  /**
   * Example: Cache performance benchmarking
   */
  async demonstratePerformanceBenchmarking(): Promise<void> {
    logger.info('Demonstrating cache performance benchmarking...');

    try {
      const iterations = 1000;
      const testData = { value: 'test data', timestamp: Date.now() };

      // Benchmark L1 cache (in-memory)
      const l1Start = Date.now();
      for (let i = 0; i < iterations; i++) {
        await this.cacheService.set(`l1:test:${i}`, testData, ['benchmark'], 60);
        await this.cacheService.get(`l1:test:${i}`);
      }
      const l1Time = Date.now() - l1Start;

      // Benchmark L2 cache (Redis)
      const l2Start = Date.now();
      for (let i = 0; i < iterations; i++) {
        await this.cacheService.set(`l2:test:${i}`, testData, ['benchmark'], 60);
        await this.cacheService.get(`l2:test:${i}`);
      }
      const l2Time = Date.now() - l2Start;

      logger.info('📊 Performance Benchmarking Results:');
      logger.info(`L1 Cache (${iterations} operations): ${l1Time}ms (${(l1Time / iterations).toFixed(2)}ms/op)`);
      logger.info(`L2 Cache (${iterations} operations): ${l2Time}ms (${(l2Time / iterations).toFixed(2)}ms/op)`);
      logger.info(`L1 vs L2 speedup: ${(l2Time / l1Time).toFixed(2)}x faster`);

      // Memory usage analysis
      const stats = this.cacheService.getStats();
      const l1Stats = stats.get('L1');
      if (l1Stats) {
        logger.info(`L1 Cache Memory Usage: ${l1Stats.size} items, ${l1Stats.maxSize} max capacity`);
        logger.info(`L1 Cache Evictions: ${l1Stats.evictions}`);
      }

    } catch (error) {
      logger.error('❌ Performance benchmarking failed:', error);
      throw error;
    }
  }

  /**
   * Example: Cache health monitoring
   */
  async demonstrateHealthMonitoring(): Promise<void> {
    logger.info('Demonstrating cache health monitoring...');

    try {
      // Monitor cache health
      const stats = this.cacheService.getStats();
      const healthStatus = {
        overall: 'healthy',
        levels: {} as Record<string, any>,
        recommendations: [] as string[]
      };

      for (const [level, stat] of stats) {
        const levelHealth = {
          status: stat.hitRate > 70 ? 'excellent' : 
                  stat.hitRate > 50 ? 'good' : 
                  stat.hitRate > 30 ? 'fair' : 'poor',
          hitRate: stat.hitRate,
          size: stat.size,
          maxSize: stat.maxSize,
          evictions: stat.evictions
        };

        healthStatus.levels[level] = levelHealth;

        // Generate recommendations
        if (stat.hitRate < 50) {
          healthStatus.recommendations.push(`Increase ${level} cache size or optimize cache keys`);
        }
        if (stat.evictions > 100) {
          healthStatus.recommendations.push(`High eviction rate on ${level} - consider increasing cache size`);
        }
      }

      logger.info('🏥 Cache Health Status:', healthStatus);

      // Simulate cache stress test
      logger.info('🧪 Running cache stress test...');
      for (let i = 0; i < 100; i++) {
        await this.cacheService.set(`stress:${i}`, { data: `stress test ${i}` }, ['stress'], 10);
      }

      // Check health after stress test
      const postStressStats = this.cacheService.getStats();
      logger.info('📊 Post-stress test stats:', Object.fromEntries(postStressStats));

    } catch (error) {
      logger.error('❌ Health monitoring failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup and dispose resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up multi-level cache resources...');
    
    try {
      await this.middleware.dispose();
      await this.prisma.$disconnect();
      
      logger.info('✅ Multi-level cache cleanup completed');
    } catch (error) {
      logger.error('❌ Cleanup failed:', error);
      throw error;
    }
  }
}

/**
 * Example usage
 */
export async function runMultiLevelCacheExample(): Promise<void> {
  const example = new MultiLevelCacheExample();
  
  try {
    logger.info('🚀 Starting Multi-Level Cache Example');
    
    // Basic operations
    await example.demonstrateBasicOperations();
    
    // Trading-specific caching
    await example.demonstrateTradingCaching();
    
    // Cache invalidation
    await example.demonstrateCacheInvalidation();
    
    // Performance monitoring
    await example.demonstratePerformanceMonitoring();
    
    // Advanced strategies
    await example.demonstrateAdvancedStrategies();
    
    // Trading optimization
    await example.demonstrateTradingOptimization();
    
    // Performance benchmarking
    await example.demonstratePerformanceBenchmarking();
    
    // Health monitoring
    await example.demonstrateHealthMonitoring();
    
    // Show Express integration
    const integration = example.getExpressIntegrationExample();
    logger.info('Express integration setup:', integration);
    
    logger.info('✅ Multi-Level Cache Example completed successfully');
    
  } catch (error) {
    logger.error('❌ Multi-Level Cache Example failed:', error);
    throw error;
  } finally {
    await example.cleanup();
  }
}

// Export for use in other modules
export { MultiLevelCacheExample }; 