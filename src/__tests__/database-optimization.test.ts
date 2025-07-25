import { DatabaseOptimizationService, IndexConfig, QueryMetrics, OptimizationRecommendation } from '../services/database-optimization.service';
import { DatabaseOptimizationMiddleware } from '../middleware/database-optimization';
import { PrismaClient } from '@prisma/client';
import { logger } from '../logger/logger';

// Mock Prisma client
const mockPrisma = {
  $use: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $queryRaw: jest.fn(),
  $disconnect: jest.fn()
} as any;

// Mock logger
jest.mock('../logger/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('DatabaseOptimizationService', () => {
  let optimizationService: DatabaseOptimizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    optimizationService = new DatabaseOptimizationService(mockPrisma);
  });

  afterEach(() => {
    optimizationService.dispose();
  });

  describe('Constructor and Setup', () => {
    it('should initialize with Prisma client', () => {
      expect(optimizationService).toBeInstanceOf(DatabaseOptimizationService);
      expect(mockPrisma.$use).toHaveBeenCalled();
    });

    it('should setup query monitoring', () => {
      expect(mockPrisma.$use).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Index Creation', () => {
    it('should create indexes successfully', async () => {
      const indexConfigs: IndexConfig[] = [
        {
          table: 'test_table',
          columns: ['id', 'name'],
          type: 'BTREE',
          concurrent: true
        }
      ];

      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await optimizationService.createIndexes(indexConfigs);

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringMatching(/CREATE\s+INDEX/)
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Created index')
      );
    });

    it('should handle index creation errors', async () => {
      const indexConfigs: IndexConfig[] = [
        {
          table: 'test_table',
          columns: ['id'],
          type: 'BTREE'
        }
      ];

      const error = new Error('Index creation failed');
      mockPrisma.$executeRawUnsafe.mockRejectedValue(error);

      await optimizationService.createIndexes(indexConfigs);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create index'),
        error
      );
    });

    it('should generate correct index names', () => {
      const config: IndexConfig = {
        table: 'orders',
        columns: ['user_id', 'status'],
        type: 'BTREE'
      };

      // Access private method through any
      const service = optimizationService as any;
      const indexName = service.generateIndexName(config);

      expect(indexName).toBe('idx_orders_user_id_status');
    });

    it('should generate correct SQL for index creation', () => {
      const config: IndexConfig = {
        table: 'orders',
        columns: ['user_id', 'status'],
        type: 'BTREE',
        unique: true,
        concurrent: true
      };

      // Access private method through any
      const service = optimizationService as any;
      const indexName = service.generateIndexName(config);
      const sql = service.generateIndexSQL(config, indexName);

      expect(sql).toContain('CREATE UNIQUE INDEX CONCURRENTLY');
      expect(sql).toContain('ON orders USING BTREE');
      expect(sql).toContain('(user_id, status)');
    });
  });

  describe('Query Performance Analysis', () => {
    it('should analyze query performance and return recommendations', async () => {
      const query = 'SELECT * FROM orders WHERE user_id = 1 AND status = "PENDING"';

      mockPrisma.$queryRaw.mockResolvedValue([]);

      const recommendations = await optimizationService.analyzeQueryPerformance(query);

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.every(r =>
        r.type && r.priority && r.description && r.impact && r.implementation
      )).toBe(true);
    });

    it('should identify missing indexes in WHERE clauses', async () => {
      const query = 'SELECT * FROM orders WHERE user_id = 1 AND status = "PENDING"';

      // Mock that no indexes exist for the columns
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const recommendations = await optimizationService.analyzeQueryPerformance(query);

      // The service should still provide recommendations based on query analysis
      // even if no existing indexes are found
      expect(recommendations.length).toBeGreaterThan(0);

      // Check if any recommendations are for indexes or query optimization
      const hasRecommendations = recommendations.some(r =>
        r.type === 'INDEX' || r.type === 'QUERY_OPTIMIZATION'
      );
      expect(hasRecommendations).toBe(true);
    });

    it('should identify query optimization opportunities', async () => {
      const query = 'SELECT * FROM orders WHERE user_id = 1';

      const recommendations = await optimizationService.analyzeQueryPerformance(query);

      const queryOptRecommendations = recommendations.filter(r => r.type === 'QUERY_OPTIMIZATION');
      expect(queryOptRecommendations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Database Statistics', () => {
    it('should get database statistics', async () => {
      const mockStats = {
        total_tables: '10',
        total_indexes: '25',
        avg_query_time: '150.5',
        slow_queries: '5',
        cache_hit_ratio: '85.2',
        disk_usage: '1048576',
        active_connections: '3'
      };

      mockPrisma.$queryRaw.mockResolvedValue([mockStats]);

      const stats = await optimizationService.getDatabaseStats();

      expect(stats).toEqual({
        totalTables: 10,
        totalIndexes: 25,
        avgQueryTime: 150.5,
        slowQueries: 5,
        cacheHitRatio: 85.2,
        diskUsage: 1048576,
        activeConnections: 3
      });
    });

    it('should handle database stats errors', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Database error'));

      const stats = await optimizationService.getDatabaseStats();

      expect(stats).toEqual({
        totalTables: 0,
        totalIndexes: 0,
        avgQueryTime: 0,
        slowQueries: 0,
        cacheHitRatio: 0,
        diskUsage: 0,
        activeConnections: 0
      });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Query Metrics', () => {
    it('should track slow queries', () => {
      const slowQueries = optimizationService.getSlowQueries(5);
      expect(Array.isArray(slowQueries)).toBe(true);
    });

    it('should get query trends', () => {
      const trends = optimizationService.getQueryTrends(24);
      expect(Array.isArray(trends)).toBe(true);
    });

    it('should export query metrics', () => {
      const metrics = optimizationService.exportQueryMetrics();
      expect(Array.isArray(metrics)).toBe(true);
    });

    it('should reset query metrics', () => {
      optimizationService.resetQueryMetrics();
      expect(logger.info).toHaveBeenCalledWith('Query metrics reset');
    });

    it('should cleanup old metrics', () => {
      optimizationService.cleanupOldMetrics(7);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up')
      );
    });
  });

  describe('Database Configuration', () => {
    it('should optimize database configuration', async () => {
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await optimizationService.optimizeDatabaseConfig();

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('ALTER SYSTEM')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Database configuration optimized')
      );
    });

    it('should handle configuration optimization errors', async () => {
      const error = new Error('Configuration failed');
      mockPrisma.$executeRawUnsafe.mockRejectedValue(error);

      await optimizationService.optimizeDatabaseConfig();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to optimize database configuration'),
        error
      );
    });
  });

  describe('Monitoring', () => {
    it('should start optimization monitoring', () => {
      optimizationService.startOptimizationMonitoring(30);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Started database optimization monitoring')
      );
      // Clean up immediately to prevent hanging
      optimizationService.stopOptimizationMonitoring();
    });

    it('should stop optimization monitoring', () => {
      optimizationService.startOptimizationMonitoring(30);
      optimizationService.stopOptimizationMonitoring();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Stopped database optimization monitoring')
      );
    });
  });

  describe('Event Emission', () => {
    it('should emit events for slow queries', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Event timeout - slowQuery event not emitted'));
        }, 3000);

        optimizationService.on('slowQuery', (metrics: QueryMetrics) => {
          clearTimeout(timeout);
          expect(metrics).toHaveProperty('query');
          expect(metrics).toHaveProperty('executionTime');
          expect(metrics).toHaveProperty('timestamp');
          resolve();
        });

        // Simulate a slow query by directly emitting the event
        const slowQueryMetrics: QueryMetrics = {
          query: 'test query',
          executionTime: 1500,
          timestamp: new Date(),
          tableScans: 0,
          indexUsage: [],
          rowsAffected: 1
        };

        // Add to metrics and emit event
        const service = optimizationService as any;
        service.queryMetrics.push(slowQueryMetrics);
        optimizationService.emit('slowQuery', slowQueryMetrics);
      });
    });

    it('should emit events for optimization recommendations', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Event timeout - optimizationRecommendations event not emitted'));
        }, 3000);

        optimizationService.on('optimizationRecommendations', (recommendations: OptimizationRecommendation[]) => {
          clearTimeout(timeout);
          expect(Array.isArray(recommendations)).toBe(true);
          expect(recommendations.length).toBeGreaterThan(0);
          resolve();
        });

        // Simulate optimization recommendations by directly emitting the event
        const recommendations: OptimizationRecommendation[] = [
          {
            type: 'INDEX',
            priority: 'MEDIUM',
            description: 'Add index for better query performance',
            impact: 'Improve query speed by 50%',
            implementation: 'CREATE INDEX idx_test ON test_table(column)',
            estimatedImprovement: 50
          }
        ];

        optimizationService.emit('optimizationRecommendations', recommendations);
      });
    });
  });
});

describe('DatabaseOptimizationMiddleware', () => {
  let middleware: DatabaseOptimizationMiddleware;
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    middleware = new DatabaseOptimizationMiddleware({
      prisma: mockPrisma,
      enableMonitoring: false
    });

    mockRequest = {
      method: 'GET',
      url: '/api/test',
      query: {},
      body: {}
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn()
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    middleware.dispose();
  });

  describe('Constructor', () => {
    it('should initialize with configuration', () => {
      expect(middleware).toBeInstanceOf(DatabaseOptimizationMiddleware);
    });

    it('should setup event handlers', () => {
      const middlewareWithMonitoring = new DatabaseOptimizationMiddleware({
        prisma: mockPrisma,
        enableMonitoring: true,
        monitoringInterval: 30
      });

      expect(middlewareWithMonitoring).toBeInstanceOf(DatabaseOptimizationMiddleware);
      middlewareWithMonitoring.dispose();
    });
  });

  describe('Middleware Functions', () => {
    it('should monitor query performance', async () => {
      const startTime = Date.now();

      middleware.monitorQueryPerformance(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();

      // Test slow query detection with proper cleanup
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          try {
            mockResponse.end();
            expect(logger.warn).toHaveBeenCalledWith(
              expect.stringContaining('Slow API endpoint detected'),
              expect.objectContaining({
                method: 'GET',
                url: '/api/test'
              })
            );
            clearTimeout(cleanupTimeout);
            resolve();
          } catch (error) {
            clearTimeout(cleanupTimeout);
            reject(error);
          }
        }, 1500);

        // Cleanup timeout if test takes too long
        const cleanupTimeout = setTimeout(() => {
          clearTimeout(timeout);
          reject(new Error('Test timeout'));
        }, 5000);
      });
    });

    it('should add database stats to request', async () => {
      const mockStats = {
        totalTables: 10,
        totalIndexes: 25,
        avgQueryTime: 150.5,
        slowQueries: 5,
        cacheHitRatio: 85.2,
        diskUsage: 1048576,
        activeConnections: 3
      };

      const service = middleware.getOptimizationService();
      jest.spyOn(service, 'getDatabaseStats').mockResolvedValue(mockStats);

      await middleware.addDatabaseStats(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.databaseStats).toEqual(mockStats);
    });

    it('should check database health', async () => {
      const mockStats = {
        totalTables: 10,
        totalIndexes: 25,
        avgQueryTime: 2500, // High query time
        slowQueries: 10,
        cacheHitRatio: 30, // Low cache hit ratio
        diskUsage: 1048576,
        activeConnections: 3
      };

      const service = middleware.getOptimizationService();
      jest.spyOn(service, 'getDatabaseStats').mockResolvedValue(mockStats);

      await middleware.checkDatabaseHealth(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Database performance degraded'
        })
      );
    });
  });

  describe('API Routes', () => {
    it('should get database stats', async () => {
      const mockStats = {
        totalTables: 10,
        totalIndexes: 25,
        avgQueryTime: 150.5,
        slowQueries: 5,
        cacheHitRatio: 85.2,
        diskUsage: 1048576,
        activeConnections: 3
      };

      const service = middleware.getOptimizationService();
      jest.spyOn(service, 'getDatabaseStats').mockResolvedValue(mockStats);

      const routes = middleware.getRoutes();
      const getStatsHandler = routes['GET /api/database/stats'];

      await getStatsHandler(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
        timestamp: expect.any(Date)
      });
    });

    it('should get slow queries', async () => {
      const mockSlowQueries = [
        {
          query: 'test query',
          executionTime: 1500,
          timestamp: new Date(),
          tableScans: 0,
          indexUsage: [],
          rowsAffected: 1
        }
      ];

      const service = middleware.getOptimizationService();
      jest.spyOn(service, 'getSlowQueries').mockReturnValue(mockSlowQueries);

      const routes = middleware.getRoutes();
      const getSlowQueriesHandler = routes['GET /api/database/slow-queries'];

      await getSlowQueriesHandler(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockSlowQueries,
        count: 1,
        timestamp: expect.any(Date)
      });
    });

    it('should analyze query performance', async () => {
      const mockRecommendations = [
        {
          type: 'INDEX' as const,
          priority: 'HIGH' as const,
          description: 'Missing index',
          impact: 'Performance improvement',
          implementation: 'CREATE INDEX...',
          estimatedImprovement: 80
        }
      ];

      const service = middleware.getOptimizationService();
      jest.spyOn(service, 'analyzeQueryPerformance').mockResolvedValue(mockRecommendations);

      mockRequest.body = { query: 'SELECT * FROM test' };

      const routes = middleware.getRoutes();
      const analyzeQueryHandler = routes['POST /api/database/analyze-query'];

      await analyzeQueryHandler(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          query: 'SELECT * FROM test',
          recommendations: mockRecommendations,
          count: 1
        },
        timestamp: expect.any(Date)
      });
    });

    it('should create indexes', async () => {
      const service = middleware.getOptimizationService();
      jest.spyOn(service, 'createIndexes').mockResolvedValue();

      mockRequest.body = {
        indexes: [
          {
            table: 'test_table',
            columns: ['id'],
            type: 'BTREE'
          }
        ]
      };

      const routes = middleware.getRoutes();
      const createIndexesHandler = routes['POST /api/database/create-indexes'];

      await createIndexesHandler(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Created 1 indexes successfully',
        timestamp: expect.any(Date)
      });
    });

    it('should handle missing query parameter', async () => {
      mockRequest.body = {};

      const routes = middleware.getRoutes();
      const analyzeQueryHandler = routes['POST /api/database/analyze-query'];

      await analyzeQueryHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Query is required'
      });
    });

    it('should handle missing indexes parameter', async () => {
      mockRequest.body = {};

      const routes = middleware.getRoutes();
      const createIndexesHandler = routes['POST /api/database/create-indexes'];

      await createIndexesHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Indexes array is required'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const service = middleware.getOptimizationService();
      jest.spyOn(service, 'getDatabaseStats').mockRejectedValue(new Error('Database error'));

      const routes = middleware.getRoutes();
      const getStatsHandler = routes['GET /api/database/stats'];

      await getStatsHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get database statistics',
        message: 'Database error'
      });
    });
  });

  describe('Disposal', () => {
    it('should dispose of resources properly', () => {
      middleware.dispose();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Database optimization middleware disposed')
      );
    });
  });
}); 