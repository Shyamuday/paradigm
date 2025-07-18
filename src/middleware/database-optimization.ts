import { Request, Response, NextFunction } from 'express';
import { DatabaseOptimizationService, IndexConfig, OptimizationRecommendation } from '../services/database-optimization.service';
import { PrismaClient } from '@prisma/client';
import { logger } from '../logger/logger';

export interface DatabaseOptimizationMiddlewareConfig {
  prisma: PrismaClient;
  enableMonitoring?: boolean;
  monitoringInterval?: number;
  slowQueryThreshold?: number;
  enableAutoOptimization?: boolean;
}

export class DatabaseOptimizationMiddleware {
  private optimizationService: DatabaseOptimizationService;
  private config: DatabaseOptimizationMiddlewareConfig;

  constructor(config: DatabaseOptimizationMiddlewareConfig) {
    this.config = {
      enableMonitoring: true,
      monitoringInterval: 60,
      slowQueryThreshold: 1000,
      enableAutoOptimization: false,
      ...config
    };

    this.optimizationService = new DatabaseOptimizationService(config.prisma);
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for optimization service
   */
  private setupEventHandlers(): void {
    this.optimizationService.on('slowQuery', (metrics) => {
      logger.warn('Slow query detected in middleware:', {
        query: metrics.query,
        executionTime: metrics.executionTime,
        timestamp: metrics.timestamp
      });
    });

    this.optimizationService.on('optimizationRecommendations', (recommendations) => {
      logger.info('Database optimization recommendations:', recommendations);
    });

    this.optimizationService.on('cacheHitRatioLow', (ratio) => {
      logger.warn(`Low cache hit ratio detected: ${ratio}%`);
    });

    if (this.config.enableMonitoring) {
      this.optimizationService.startOptimizationMonitoring(this.config.monitoringInterval);
    }
  }

  /**
   * Middleware to monitor query performance
   */
  monitorQueryPerformance = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const config = this.config;
    
    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any, cb?: () => void) {
      const executionTime = Date.now() - startTime;
      
      if (executionTime > (config.slowQueryThreshold || 1000)) {
        logger.warn('Slow API endpoint detected:', {
          method: req.method,
          url: req.url,
          executionTime,
          timestamp: new Date()
        });
      }
      
      return originalEnd.call(this, chunk, encoding, cb);
    };
    
    next();
  };

  /**
   * Middleware to add database stats to response
   */
  addDatabaseStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.optimizationService.getDatabaseStats();
      (req as any).databaseStats = stats;
      next();
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      next();
    }
  };

  /**
   * Middleware to check database health
   */
  checkDatabaseHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.optimizationService.getDatabaseStats();
      
      // Check for critical issues
      if (stats.avgQueryTime > 2000) {
        logger.error('Critical: High average query time detected');
        res.status(503).json({
          error: 'Database performance degraded',
          avgQueryTime: stats.avgQueryTime,
          slowQueries: stats.slowQueries
        });
        return;
      }
      
      if (stats.cacheHitRatio < 50) {
        logger.warn('Warning: Low cache hit ratio detected');
      }
      
      next();
    } catch (error) {
      logger.error('Database health check failed:', error);
      res.status(503).json({
        error: 'Database health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      return;
    }
  };

  /**
   * Get database optimization routes
   */
  getRoutes() {
    return {
      // Get database statistics
      'GET /api/database/stats': this.getDatabaseStats.bind(this),
      
      // Get slow queries
      'GET /api/database/slow-queries': this.getSlowQueries.bind(this),
      
      // Get query trends
      'GET /api/database/query-trends': this.getQueryTrends.bind(this),
      
      // Analyze query performance
      'POST /api/database/analyze-query': this.analyzeQuery.bind(this),
      
      // Create indexes
      'POST /api/database/create-indexes': this.createIndexes.bind(this),
      
      // Optimize database configuration
      'POST /api/database/optimize-config': this.optimizeConfig.bind(this),
      
      // Get optimization recommendations
      'GET /api/database/recommendations': this.getRecommendations.bind(this),
      
      // Start/stop monitoring
      'POST /api/database/monitoring': this.toggleMonitoring.bind(this),
      
      // Clean up old metrics
      'POST /api/database/cleanup': this.cleanupMetrics.bind(this),
      
      // Export query metrics
      'GET /api/database/export-metrics': this.exportMetrics.bind(this)
    };
  }

  /**
   * Get database statistics
   */
  private async getDatabaseStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.optimizationService.getDatabaseStats();
      res.json({
        success: true,
        data: stats,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get database statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get slow queries
   */
  private async getSlowQueries(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const slowQueries = this.optimizationService.getSlowQueries(limit);
      
      res.json({
        success: true,
        data: slowQueries,
        count: slowQueries.length,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to get slow queries:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get slow queries',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get query trends
   */
  private async getQueryTrends(req: Request, res: Response): Promise<void> {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const trends = this.optimizationService.getQueryTrends(hours);
      
      res.json({
        success: true,
        data: trends,
        hours,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to get query trends:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get query trends',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Analyze query performance
   */
  private async analyzeQuery(req: Request, res: Response): Promise<void> {
    try {
      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Query is required'
        });
      }

      const recommendations = await this.optimizationService.analyzeQueryPerformance(query);
      
      res.json({
        success: true,
        data: {
          query,
          recommendations,
          count: recommendations.length
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to analyze query:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze query performance',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create database indexes
   */
  private async createIndexes(req: Request, res: Response): Promise<void> {
    try {
      const { indexes } = req.body;
      
      if (!Array.isArray(indexes)) {
        return res.status(400).json({
          success: false,
          error: 'Indexes array is required'
        });
      }

      await this.optimizationService.createIndexes(indexes as IndexConfig[]);
      
      res.json({
        success: true,
        message: `Created ${indexes.length} indexes successfully`,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to create indexes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create indexes',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Optimize database configuration
   */
  private async optimizeConfig(req: Request, res: Response): Promise<void> {
    try {
      await this.optimizationService.optimizeDatabaseConfig();
      
      res.json({
        success: true,
        message: 'Database configuration optimized successfully',
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to optimize database config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to optimize database configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get optimization recommendations
   */
  private async getRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const { query } = req.query;
      let recommendations: OptimizationRecommendation[] = [];

      if (query) {
        // Analyze specific query
        recommendations = await this.optimizationService.analyzeQueryPerformance(query as string);
      } else {
        // Get general recommendations based on slow queries
        const slowQueries = this.optimizationService.getSlowQueries(5);
        for (const slowQuery of slowQueries) {
          const queryRecommendations = await this.optimizationService.analyzeQueryPerformance(slowQuery.query);
          recommendations.push(...queryRecommendations);
        }
        
        // Remove duplicates and sort by priority
        recommendations = this.removeDuplicateRecommendations(recommendations);
      }
      
      res.json({
        success: true,
        data: recommendations,
        count: recommendations.length,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to get recommendations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get optimization recommendations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Toggle monitoring
   */
  private async toggleMonitoring(req: Request, res: Response): Promise<void> {
    try {
      const { action, interval } = req.body;
      
      if (action === 'start') {
        this.optimizationService.startOptimizationMonitoring(interval || 60);
        res.json({
          success: true,
          message: 'Database monitoring started',
          interval: interval || 60,
          timestamp: new Date()
        });
      } else if (action === 'stop') {
        this.optimizationService.stopOptimizationMonitoring();
        res.json({
          success: true,
          message: 'Database monitoring stopped',
          timestamp: new Date()
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Invalid action. Use "start" or "stop"'
        });
      }
    } catch (error) {
      logger.error('Failed to toggle monitoring:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle monitoring',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Clean up old metrics
   */
  private async cleanupMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { daysToKeep } = req.body;
      this.optimizationService.cleanupOldMetrics(daysToKeep || 7);
      
      res.json({
        success: true,
        message: `Cleaned up metrics older than ${daysToKeep || 7} days`,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to cleanup metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Export query metrics
   */
  private async exportMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = this.optimizationService.exportQueryMetrics();
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="query-metrics.json"');
      
      res.json({
        success: true,
        data: metrics,
        count: metrics.length,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to export metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Remove duplicate recommendations
   */
  private removeDuplicateRecommendations(recommendations: OptimizationRecommendation[]): OptimizationRecommendation[] {
    const seen = new Set<string>();
    return recommendations.filter(rec => {
      const key = `${rec.type}-${rec.description}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Get the optimization service instance
   */
  getOptimizationService(): DatabaseOptimizationService {
    return this.optimizationService;
  }

  /**
   * Dispose of the middleware
   */
  dispose(): void {
    this.optimizationService.dispose();
    logger.info('Database optimization middleware disposed');
  }
} 