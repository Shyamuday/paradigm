import { PrismaClient } from '@prisma/client';
import { DatabaseOptimizationService, IndexConfig } from '../services/database-optimization.service';
import { DatabaseOptimizationMiddleware } from '../middleware/database-optimization';
import { logger } from '../logger/logger';

/**
 * Example: Database Optimization Integration
 * 
 * This example demonstrates how to integrate database optimization
 * features into your trading platform for improved performance.
 */
export class DatabaseOptimizationExample {
  private prisma: PrismaClient;
  private optimizationService: DatabaseOptimizationService;
  private middleware: DatabaseOptimizationMiddleware;

  constructor() {
    this.prisma = new PrismaClient();
    this.optimizationService = new DatabaseOptimizationService(this.prisma);
    this.middleware = new DatabaseOptimizationMiddleware({
      prisma: this.prisma,
      enableMonitoring: true,
      monitoringInterval: 30,
      slowQueryThreshold: 500,
      enableAutoOptimization: false
    });
  }

  /**
   * Example: Basic database optimization setup
   */
  async setupBasicOptimization(): Promise<void> {
    logger.info('Setting up basic database optimization...');

    try {
      // 1. Create essential indexes for trading data
      const tradingIndexes: IndexConfig[] = [
        {
          table: 'orders',
          columns: ['symbol', 'status'],
          type: 'BTREE',
          concurrent: true
        },
        {
          table: 'orders',
          columns: ['created_at'],
          type: 'BTREE',
          concurrent: true
        },
        {
          table: 'trades',
          columns: ['symbol', 'timestamp'],
          type: 'BTREE',
          concurrent: true
        },
        {
          table: 'portfolio_positions',
          columns: ['user_id', 'symbol'],
          type: 'BTREE',
          unique: true,
          concurrent: true
        },
        {
          table: 'market_data',
          columns: ['symbol', 'timestamp'],
          type: 'BTREE',
          concurrent: true
        }
      ];

      await this.optimizationService.createIndexes(tradingIndexes);
      logger.info('Created trading indexes successfully');

      // 2. Start monitoring
      this.optimizationService.startOptimizationMonitoring(30);
      logger.info('Started database monitoring');

      // 3. Get initial stats
      const stats = await this.optimizationService.getDatabaseStats();
      logger.info('Initial database stats:', stats);

    } catch (error) {
      logger.error('Failed to setup basic optimization:', error);
      throw error;
    }
  }

  /**
   * Example: Advanced optimization with custom indexes
   */
  async setupAdvancedOptimization(): Promise<void> {
    logger.info('Setting up advanced database optimization...');

    try {
      // 1. Create composite indexes for complex queries
      const advancedIndexes: IndexConfig[] = [
        {
          table: 'orders',
          columns: ['user_id', 'symbol', 'status'],
          type: 'BTREE',
          concurrent: true
        },
        {
          table: 'trades',
          columns: ['user_id', 'symbol', 'timestamp'],
          type: 'BTREE',
          concurrent: true
        },
        {
          table: 'market_data',
          columns: ['symbol', 'timestamp', 'price'],
          type: 'BTREE',
          concurrent: true
        },
        {
          table: 'portfolio_positions',
          columns: ['user_id', 'symbol', 'quantity'],
          type: 'BTREE',
          concurrent: true
        }
      ];

      await this.optimizationService.createIndexes(advancedIndexes);
      logger.info('Created advanced indexes successfully');

      // 2. Optimize database configuration
      await this.optimizationService.optimizeDatabaseConfig();
      logger.info('Optimized database configuration');

    } catch (error) {
      logger.error('Failed to setup advanced optimization:', error);
      throw error;
    }
  }

  /**
   * Example: Query performance analysis
   */
  async analyzeQueryPerformance(): Promise<void> {
    logger.info('Analyzing query performance...');

    try {
      // Sample queries to analyze
      const sampleQueries = [
        'SELECT * FROM orders WHERE user_id = ? AND status = ? ORDER BY created_at DESC',
        'SELECT symbol, AVG(price) FROM market_data WHERE timestamp > ? GROUP BY symbol',
        'SELECT * FROM portfolio_positions WHERE user_id = ? AND quantity > 0',
        'SELECT * FROM trades WHERE symbol = ? AND timestamp BETWEEN ? AND ?'
      ];

      for (const query of sampleQueries) {
        logger.info(`Analyzing query: ${query}`);
        const recommendations = await this.optimizationService.analyzeQueryPerformance(query);
        
        if (recommendations.length > 0) {
          logger.info(`Found ${recommendations.length} recommendations for query`);
          recommendations.forEach((rec, index) => {
            logger.info(`  ${index + 1}. ${rec.description} (${rec.priority} priority)`);
          });
        } else {
          logger.info('No optimization recommendations found');
        }
      }

    } catch (error) {
      logger.error('Failed to analyze query performance:', error);
      throw error;
    }
  }

  /**
   * Example: Performance monitoring and alerting
   */
  async setupPerformanceMonitoring(): Promise<void> {
    logger.info('Setting up performance monitoring...');

    try {
      // Setup event listeners for monitoring
      this.optimizationService.on('slowQuery', (metrics) => {
        logger.warn('🚨 SLOW QUERY DETECTED:', {
          query: metrics.query,
          executionTime: metrics.executionTime,
          timestamp: metrics.timestamp
        });
      });

             this.optimizationService.on('optimizationRecommendations', (recommendations) => {
         logger.info('📊 OPTIMIZATION RECOMMENDATIONS:', {
           count: recommendations.length,
           recommendations: recommendations.map((r: any) => ({
             type: r.type,
             priority: r.priority,
             description: r.description,
             estimatedImprovement: r.estimatedImprovement
           }))
         });
       });

      this.optimizationService.on('cacheHitRatioLow', (ratio) => {
        logger.warn('⚠️ LOW CACHE HIT RATIO:', { ratio: `${ratio}%` });
      });

      this.optimizationService.on('monitoringTick', (stats) => {
        logger.info('📈 MONITORING TICK:', {
          avgQueryTime: `${stats.avgQueryTime.toFixed(2)}ms`,
          slowQueries: stats.slowQueries,
          cacheHitRatio: `${stats.cacheHitRatio.toFixed(2)}%`,
          activeConnections: stats.activeConnections
        });
      });

      // Start monitoring
      this.optimizationService.startOptimizationMonitoring(15); // Check every 15 minutes
      logger.info('Performance monitoring started');

    } catch (error) {
      logger.error('Failed to setup performance monitoring:', error);
      throw error;
    }
  }

  /**
   * Example: Trading-specific optimizations
   */
  async setupTradingOptimizations(): Promise<void> {
    logger.info('Setting up trading-specific optimizations...');

    try {
      // 1. Create indexes for real-time trading queries
      const tradingIndexes: IndexConfig[] = [
        {
          table: 'orders',
          columns: ['symbol', 'order_type', 'status'],
          type: 'BTREE',
          concurrent: true
        },
        {
          table: 'market_data',
          columns: ['symbol', 'timestamp'],
          type: 'BTREE',
          partial: 'timestamp > NOW() - INTERVAL \'1 day\'',
          concurrent: true
        },
        {
          table: 'portfolio_positions',
          columns: ['user_id', 'symbol', 'quantity'],
          type: 'BTREE',
          concurrent: true
        },
        {
          table: 'trades',
          columns: ['user_id', 'symbol', 'timestamp'],
          type: 'BTREE',
          concurrent: true
        }
      ];

      await this.optimizationService.createIndexes(tradingIndexes);
      logger.info('Created trading-specific indexes');

      // 2. Analyze common trading queries
      const tradingQueries = [
        'SELECT * FROM orders WHERE symbol = ? AND status IN (?, ?) ORDER BY created_at DESC LIMIT 100',
        'SELECT * FROM market_data WHERE symbol = ? AND timestamp > ? ORDER BY timestamp DESC LIMIT 1000',
        'SELECT symbol, SUM(quantity) FROM portfolio_positions WHERE user_id = ? GROUP BY symbol',
        'SELECT * FROM trades WHERE user_id = ? AND timestamp > ? ORDER BY timestamp DESC'
      ];

      for (const query of tradingQueries) {
        const recommendations = await this.optimizationService.analyzeQueryPerformance(query);
        logger.info(`Trading query analysis for: ${query.substring(0, 50)}...`);
        logger.info(`Found ${recommendations.length} recommendations`);
      }

    } catch (error) {
      logger.error('Failed to setup trading optimizations:', error);
      throw error;
    }
  }

  /**
   * Example: Database maintenance and cleanup
   */
  async performMaintenance(): Promise<void> {
    logger.info('Performing database maintenance...');

    try {
      // 1. Clean up old metrics
      this.optimizationService.cleanupOldMetrics(7); // Keep 7 days
      logger.info('Cleaned up old metrics');

      // 2. Get current performance stats
      const stats = await this.optimizationService.getDatabaseStats();
      logger.info('Current database stats:', {
        totalTables: stats.totalTables,
        totalIndexes: stats.totalIndexes,
        avgQueryTime: `${stats.avgQueryTime.toFixed(2)}ms`,
        slowQueries: stats.slowQueries,
        cacheHitRatio: `${stats.cacheHitRatio.toFixed(2)}%`,
        diskUsage: `${(stats.diskUsage / 1024 / 1024).toFixed(2)}MB`
      });

      // 3. Get slow queries for analysis
      const slowQueries = this.optimizationService.getSlowQueries(5);
      if (slowQueries.length > 0) {
        logger.info(`Found ${slowQueries.length} slow queries to analyze`);
        slowQueries.forEach((query, index) => {
          logger.info(`  ${index + 1}. ${query.executionTime}ms - ${query.query.substring(0, 100)}...`);
        });
      }

      // 4. Get query trends
      const trends = this.optimizationService.getQueryTrends(24);
      logger.info(`Query trends for last 24 hours: ${trends.length} data points`);

    } catch (error) {
      logger.error('Failed to perform maintenance:', error);
      throw error;
    }
  }

  /**
   * Example: Integration with Express app
   */
  getExpressIntegrationExample(): any {
    return {
      // Middleware setup
      setupMiddleware: (app: any) => {
        // Add database optimization middleware
        app.use(this.middleware.monitorQueryPerformance);
        app.use(this.middleware.addDatabaseStats);
        app.use('/api/trading', this.middleware.checkDatabaseHealth);

                 // Add database optimization routes
         const routes = this.middleware.getRoutes();
         Object.entries(routes).forEach(([route, handler]) => {
           const [method, path] = route.split(' ');
           if (method && path) {
             app[method.toLowerCase()](path, handler);
           }
         });

        logger.info('Database optimization middleware integrated');
      },

      // Example API usage
      apiExamples: {
        getStats: 'GET /api/database/stats',
        getSlowQueries: 'GET /api/database/slow-queries?limit=10',
        analyzeQuery: 'POST /api/database/analyze-query',
        createIndexes: 'POST /api/database/create-indexes',
        getRecommendations: 'GET /api/database/recommendations',
        toggleMonitoring: 'POST /api/database/monitoring'
      }
    };
  }

  /**
   * Example: Real-time performance dashboard data
   */
  async getDashboardData(): Promise<any> {
    try {
      const stats = await this.optimizationService.getDatabaseStats();
      const slowQueries = this.optimizationService.getSlowQueries(10);
      const trends = this.optimizationService.getQueryTrends(24);

      return {
        performance: {
          avgQueryTime: stats.avgQueryTime,
          slowQueries: stats.slowQueries,
          cacheHitRatio: stats.cacheHitRatio,
          activeConnections: stats.activeConnections
        },
        trends: trends.map(t => ({
          timestamp: t.timestamp,
          avgTime: t.avgTime,
          count: t.count
        })),
        slowQueries: slowQueries.map(q => ({
          query: q.query,
          executionTime: q.executionTime,
          timestamp: q.timestamp
        })),
        summary: {
          totalTables: stats.totalTables,
          totalIndexes: stats.totalIndexes,
          diskUsage: stats.diskUsage
        }
      };
    } catch (error) {
      logger.error('Failed to get dashboard data:', error);
      throw error;
    }
  }

  /**
   * Example: Automated optimization workflow
   */
  async runAutomatedOptimization(): Promise<void> {
    logger.info('Running automated optimization workflow...');

    try {
      // 1. Check current performance
      const stats = await this.optimizationService.getDatabaseStats();
      
      // 2. If performance is poor, analyze and optimize
      if (stats.avgQueryTime > 1000 || stats.cacheHitRatio < 80) {
        logger.warn('Performance issues detected, running optimization...');
        
        // Get slow queries and analyze them
        const slowQueries = this.optimizationService.getSlowQueries(5);
        for (const query of slowQueries) {
          const recommendations = await this.optimizationService.analyzeQueryPerformance(query.query);
          
          // Apply high-priority recommendations automatically
          const highPriorityRecs = recommendations.filter(r => r.priority === 'HIGH' || r.priority === 'CRITICAL');
          
          if (highPriorityRecs.length > 0) {
            logger.info(`Applying ${highPriorityRecs.length} high-priority optimizations`);
            // In a real implementation, you would apply these automatically
            // For now, just log them
            highPriorityRecs.forEach(rec => {
              logger.info(`Auto-applying: ${rec.description}`);
            });
          }
        }
      }

      // 3. Optimize configuration if needed
      if (stats.cacheHitRatio < 70) {
        logger.info('Low cache hit ratio, optimizing configuration...');
        await this.optimizationService.optimizeDatabaseConfig();
      }

      logger.info('Automated optimization workflow completed');

    } catch (error) {
      logger.error('Failed to run automated optimization:', error);
      throw error;
    }
  }

  /**
   * Cleanup and dispose resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up database optimization resources...');
    
    try {
      this.optimizationService.dispose();
      this.middleware.dispose();
      await this.prisma.$disconnect();
      
      logger.info('Database optimization cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup:', error);
      throw error;
    }
  }
}

/**
 * Example usage
 */
export async function runDatabaseOptimizationExample(): Promise<void> {
  const example = new DatabaseOptimizationExample();
  
  try {
    logger.info('🚀 Starting Database Optimization Example');
    
    // Setup basic optimization
    await example.setupBasicOptimization();
    
    // Setup advanced optimization
    await example.setupAdvancedOptimization();
    
    // Setup trading-specific optimizations
    await example.setupTradingOptimizations();
    
    // Setup performance monitoring
    await example.setupPerformanceMonitoring();
    
    // Analyze query performance
    await example.analyzeQueryPerformance();
    
    // Perform maintenance
    await example.performMaintenance();
    
    // Run automated optimization
    await example.runAutomatedOptimization();
    
    // Get dashboard data
    const dashboardData = await example.getDashboardData();
    logger.info('Dashboard data:', dashboardData);
    
    // Show Express integration
    const integration = example.getExpressIntegrationExample();
    logger.info('Express integration setup:', integration);
    
    logger.info('✅ Database Optimization Example completed successfully');
    
  } catch (error) {
    logger.error('❌ Database Optimization Example failed:', error);
    throw error;
  } finally {
    await example.cleanup();
  }
}

// Export for use in other modules
// Note: DatabaseOptimizationExample is already exported as a class 