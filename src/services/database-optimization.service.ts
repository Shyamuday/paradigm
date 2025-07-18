import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { logger } from '../logger/logger';

export interface IndexConfig {
  table: string;
  columns: string[];
  type: 'BTREE' | 'HASH' | 'GIN' | 'GIST';
  unique?: boolean;
  partial?: string;
  concurrent?: boolean;
}

export interface QueryMetrics {
  query: string;
  executionTime: number;
  timestamp: Date;
  tableScans: number;
  indexUsage: string[];
  rowsAffected: number;
  cacheHitRatio?: number;
}

export interface OptimizationRecommendation {
  type: 'INDEX' | 'QUERY_OPTIMIZATION' | 'SCHEMA_CHANGE' | 'CONFIGURATION';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  impact: string;
  implementation: string;
  estimatedImprovement: number;
}

export interface DatabaseStats {
  totalTables: number;
  totalIndexes: number;
  avgQueryTime: number;
  slowQueries: number;
  cacheHitRatio: number;
  diskUsage: number;
  activeConnections: number;
}

export class DatabaseOptimizationService extends EventEmitter {
  private prisma: PrismaClient;
  private queryMetrics: QueryMetrics[] = [];
  private slowQueryThreshold: number = 1000; // ms
  private maxQueryHistory: number = 1000;
  private optimizationInterval: NodeJS.Timeout | null = null;

  constructor(prisma: PrismaClient) {
    super();
    this.prisma = prisma;
    this.setupQueryMonitoring();
  }

  /**
   * Setup query monitoring and performance tracking
   */
  private setupQueryMonitoring(): void {
    // Monitor query performance
    this.prisma.$use(async (params, next) => {
      const startTime = Date.now();
      const result = await next(params);
      const executionTime = Date.now() - startTime;

      const metrics: QueryMetrics = {
        query: this.formatQuery(params),
        executionTime,
        timestamp: new Date(),
        tableScans: 0, // Would need database-specific monitoring
        indexUsage: [],
        rowsAffected: this.getRowsAffected(result, params)
      };

      this.queryMetrics.push(metrics);
      
      // Keep only recent metrics
      if (this.queryMetrics.length > this.maxQueryHistory) {
        this.queryMetrics = this.queryMetrics.slice(-this.maxQueryHistory);
      }

      // Emit slow query event
      if (executionTime > this.slowQueryThreshold) {
        this.emit('slowQuery', metrics);
        logger.warn(`Slow query detected: ${metrics.query} (${executionTime}ms)`);
      }

      return result;
    });
  }

  /**
   * Format query for logging and analysis
   */
  private formatQuery(params: any): string {
    return `${params.model}.${params.action}(${JSON.stringify(params.args)})`;
  }

  /**
   * Get rows affected by query
   */
  private getRowsAffected(result: any, params: any): number {
    if (params.action === 'findMany') {
      return Array.isArray(result) ? result.length : 0;
    }
    if (params.action === 'update' || params.action === 'delete') {
      return result?.count || 0;
    }
    return 1;
  }

  /**
   * Create database indexes for optimal performance
   */
  async createIndexes(indexConfigs: IndexConfig[]): Promise<void> {
    logger.info('Creating database indexes for optimization...');

    for (const config of indexConfigs) {
      try {
        const indexName = this.generateIndexName(config);
        const indexSQL = this.generateIndexSQL(config, indexName);
        
        await this.prisma.$executeRawUnsafe(indexSQL);
        
        logger.info(`Created index: ${indexName} on ${config.table}`);
        this.emit('indexCreated', { indexName, config });
      } catch (error) {
        logger.error(`Failed to create index for ${config.table}:`, error);
        this.emit('indexError', { config, error });
      }
    }
  }

  /**
   * Generate index name
   */
  private generateIndexName(config: IndexConfig): string {
    const columns = config.columns.join('_');
    return `idx_${config.table}_${columns}`;
  }

  /**
   * Generate SQL for index creation
   */
  private generateIndexSQL(config: IndexConfig, indexName: string): string {
    const unique = config.unique ? 'UNIQUE' : '';
    const concurrent = config.concurrent ? 'CONCURRENTLY' : '';
    const columns = config.columns.join(', ');
    const partial = config.partial ? `WHERE ${config.partial}` : '';
    
    return `
      CREATE ${unique} INDEX ${concurrent} ${indexName}
      ON ${config.table} USING ${config.type} (${columns})
      ${partial};
    `;
  }

  /**
   * Analyze query performance and provide recommendations
   */
  async analyzeQueryPerformance(query: string): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Analyze query patterns
    const queryPattern = this.extractQueryPattern(query);
    
    // Check for missing indexes
    const missingIndexes = await this.identifyMissingIndexes(queryPattern);
    recommendations.push(...missingIndexes);

    // Check for query optimization opportunities
    const queryOptimizations = this.analyzeQueryStructure(query);
    recommendations.push(...queryOptimizations);

    // Check for schema improvements
    const schemaImprovements = await this.analyzeSchemaOptimization(queryPattern);
    recommendations.push(...schemaImprovements);

    return recommendations.sort((a, b) => this.getPriorityScore(b.priority) - this.getPriorityScore(a.priority));
  }

  /**
   * Extract query pattern for analysis
   */
  private extractQueryPattern(query: string): any {
    // Simple pattern extraction - in real implementation, use SQL parser
    const patterns = {
      tables: query.match(/FROM\s+(\w+)/gi) || [],
      joins: query.match(/JOIN\s+(\w+)/gi) || [],
      where: query.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/gi) || [],
      orderBy: query.match(/ORDER BY\s+(.+?)(?:LIMIT|$)/gi) || []
    };
    
    return patterns;
  }

  /**
   * Identify missing indexes for query patterns
   */
  private async identifyMissingIndexes(queryPattern: any): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Analyze WHERE clauses for potential indexes
    for (const whereClause of queryPattern.where) {
      const columns = this.extractColumnsFromWhere(whereClause);
      
      for (const column of columns) {
        const hasIndex = await this.checkIndexExists(column.table, column.name);
        
        if (!hasIndex) {
          recommendations.push({
            type: 'INDEX',
            priority: 'HIGH',
            description: `Missing index on ${column.table}.${column.name}`,
            impact: 'Significant performance improvement for WHERE clauses',
            implementation: `CREATE INDEX idx_${column.table}_${column.name} ON ${column.table} (${column.name});`,
            estimatedImprovement: 80
          });
        }
      }
    }

    // Analyze ORDER BY clauses
    for (const orderBy of queryPattern.orderBy) {
      const columns = this.extractColumnsFromOrderBy(orderBy);
      
      for (const column of columns) {
        const hasIndex = await this.checkIndexExists(column.table, column.name);
        
        if (!hasIndex) {
          recommendations.push({
            type: 'INDEX',
            priority: 'MEDIUM',
            description: `Missing index for ORDER BY on ${column.table}.${column.name}`,
            impact: 'Improved sorting performance',
            implementation: `CREATE INDEX idx_${column.table}_${column.name}_sort ON ${column.table} (${column.name});`,
            estimatedImprovement: 60
          });
        }
      }
    }

    return recommendations;
  }

  /**
   * Extract columns from WHERE clause
   */
  private extractColumnsFromWhere(whereClause: string): Array<{table: string, name: string}> {
    // Simplified extraction - in real implementation, use proper SQL parser
    const columns: Array<{table: string, name: string}> = [];
    const matches = whereClause.match(/(\w+)\.(\w+)\s*[=<>!]/g) || [];
    
    for (const match of matches) {
      const parts = match.split('.');
      if (parts.length === 2 && parts[0] && parts[1]) {
        const namePart = parts[1].split(/\s/)[0];
        if (namePart) {
          columns.push({
            table: parts[0],
            name: namePart
          });
        }
      }
    }
    
    return columns;
  }

  /**
   * Extract columns from ORDER BY clause
   */
  private extractColumnsFromOrderBy(orderByClause: string): Array<{table: string, name: string}> {
    const columns: Array<{table: string, name: string}> = [];
    const matches = orderByClause.match(/(\w+)\.(\w+)/g) || [];
    
    for (const match of matches) {
      const parts = match.split('.');
      if (parts.length === 2 && parts[0] && parts[1]) {
        columns.push({
          table: parts[0],
          name: parts[1]
        });
      }
    }
    
    return columns;
  }

  /**
   * Check if index exists on table and column
   */
  private async checkIndexExists(table: string, column: string): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRaw`
        SELECT 1 FROM pg_indexes 
        WHERE tablename = ${table} 
        AND indexdef LIKE ${`%${column}%`}
        LIMIT 1
      `;
      return Array.isArray(result) && result.length > 0;
    } catch (error) {
      logger.warn(`Could not check index existence for ${table}.${column}:`, error);
      return false;
    }
  }

  /**
   * Analyze query structure for optimization opportunities
   */
  private analyzeQueryStructure(query: string): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Check for SELECT *
    if (query.includes('SELECT *')) {
      recommendations.push({
        type: 'QUERY_OPTIMIZATION',
        priority: 'MEDIUM',
        description: 'Use specific column names instead of SELECT *',
        impact: 'Reduced data transfer and improved performance',
        implementation: 'Replace SELECT * with specific column names',
        estimatedImprovement: 20
      });
    }

    // Check for unnecessary DISTINCT
    if (query.includes('DISTINCT') && !this.hasJoins(query)) {
      recommendations.push({
        type: 'QUERY_OPTIMIZATION',
        priority: 'LOW',
        description: 'Consider removing DISTINCT if not needed',
        impact: 'Slightly improved performance',
        implementation: 'Remove DISTINCT if duplicates are not possible',
        estimatedImprovement: 10
      });
    }

    // Check for LIMIT without ORDER BY
    if (query.includes('LIMIT') && !query.includes('ORDER BY')) {
      recommendations.push({
        type: 'QUERY_OPTIMIZATION',
        priority: 'LOW',
        description: 'Add ORDER BY when using LIMIT for consistent results',
        impact: 'Consistent result ordering',
        implementation: 'Add ORDER BY clause before LIMIT',
        estimatedImprovement: 5
      });
    }

    return recommendations;
  }

  /**
   * Check if query has JOINs
   */
  private hasJoins(query: string): boolean {
    return /JOIN/i.test(query);
  }

  /**
   * Analyze schema optimization opportunities
   */
  private async analyzeSchemaOptimization(queryPattern: any): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Check for potential table partitioning
    if (this.shouldConsiderPartitioning(queryPattern)) {
      recommendations.push({
        type: 'SCHEMA_CHANGE',
        priority: 'MEDIUM',
        description: 'Consider table partitioning for large tables',
        impact: 'Improved query performance on large datasets',
        implementation: 'Implement range or list partitioning based on access patterns',
        estimatedImprovement: 40
      });
    }

    // Check for data type optimization
    const dataTypeOptimizations = await this.analyzeDataTypeOptimization();
    recommendations.push(...dataTypeOptimizations);

    return recommendations;
  }

  /**
   * Check if table should be partitioned
   */
  private shouldConsiderPartitioning(queryPattern: any): boolean {
    // Simplified logic - in real implementation, check table sizes and access patterns
    return queryPattern.tables.length > 2;
  }

  /**
   * Analyze data type optimization opportunities
   */
  private async analyzeDataTypeOptimization(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    try {
      // Check for oversized data types
      const oversizedColumns = await this.prisma.$queryRaw`
        SELECT 
          table_name,
          column_name,
          data_type,
          character_maximum_length
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND data_type IN ('character varying', 'text')
        AND character_maximum_length > 1000
      `;

      for (const column of oversizedColumns as any[]) {
        recommendations.push({
          type: 'SCHEMA_CHANGE',
          priority: 'LOW',
          description: `Consider reducing VARCHAR length for ${column.table_name}.${column.column_name}`,
          impact: 'Reduced storage and improved performance',
          implementation: `ALTER TABLE ${column.table_name} ALTER COLUMN ${column.column_name} TYPE VARCHAR(255);`,
          estimatedImprovement: 15
        });
      }
    } catch (error) {
      logger.warn('Could not analyze data type optimization:', error);
    }

    return recommendations;
  }

  /**
   * Get priority score for sorting recommendations
   */
  private getPriorityScore(priority: string): number {
    const scores = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return scores[priority as keyof typeof scores] || 0;
  }

  /**
   * Get database statistics and performance metrics
   */
  async getDatabaseStats(): Promise<DatabaseStats> {
    try {
      const stats = await this.prisma.$queryRaw`
        SELECT 
          (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as total_tables,
          (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as total_indexes,
          (SELECT AVG(mean_exec_time) FROM pg_stat_statements) as avg_query_time,
          (SELECT COUNT(*) FROM pg_stat_statements WHERE mean_exec_time > 1000) as slow_queries,
          (SELECT ROUND(100.0 * sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)), 2) 
           FROM pg_statio_user_tables) as cache_hit_ratio,
          (SELECT pg_database_size(current_database())) as disk_usage,
          (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as active_connections
      `;

      const result = (stats as any)[0];
      
      return {
        totalTables: parseInt(result.total_tables) || 0,
        totalIndexes: parseInt(result.total_indexes) || 0,
        avgQueryTime: parseFloat(result.avg_query_time) || 0,
        slowQueries: parseInt(result.slow_queries) || 0,
        cacheHitRatio: parseFloat(result.cache_hit_ratio) || 0,
        diskUsage: parseInt(result.disk_usage) || 0,
        activeConnections: parseInt(result.active_connections) || 0
      };
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      return {
        totalTables: 0,
        totalIndexes: 0,
        avgQueryTime: 0,
        slowQueries: 0,
        cacheHitRatio: 0,
        diskUsage: 0,
        activeConnections: 0
      };
    }
  }

  /**
   * Get slow queries for analysis
   */
  getSlowQueries(limit: number = 10): QueryMetrics[] {
    return this.queryMetrics
      .filter(metric => metric.executionTime > this.slowQueryThreshold)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, limit);
  }

  /**
   * Get query performance trends
   */
  getQueryTrends(hours: number = 24): { timestamp: Date; avgTime: number; count: number }[] {
    const now = new Date();
    const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);
    
    const recentMetrics = this.queryMetrics.filter(m => m.timestamp > cutoff);
    const hourlyGroups = new Map<string, { totalTime: number; count: number }>();
    
    for (const metric of recentMetrics) {
      const hour = new Date(metric.timestamp.getTime() - metric.timestamp.getMinutes() * 60 * 1000);
      const key = hour.toISOString();
      
      const group = hourlyGroups.get(key) || { totalTime: 0, count: 0 };
      group.totalTime += metric.executionTime;
      group.count += 1;
      hourlyGroups.set(key, group);
    }
    
    return Array.from(hourlyGroups.entries()).map(([key, group]) => ({
      timestamp: new Date(key),
      avgTime: group.count > 0 ? group.totalTime / group.count : 0,
      count: group.count
    })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Optimize database configuration
   */
  async optimizeDatabaseConfig(): Promise<void> {
    logger.info('Optimizing database configuration...');

    try {
      // Update database configuration for better performance
      await this.prisma.$executeRawUnsafe(`
        -- Increase work_mem for better sort performance
        ALTER SYSTEM SET work_mem = '256MB';
        
        -- Increase shared_buffers for better caching
        ALTER SYSTEM SET shared_buffers = '256MB';
        
        -- Optimize checkpoint settings
        ALTER SYSTEM SET checkpoint_completion_target = 0.9;
        ALTER SYSTEM SET wal_buffers = '16MB';
        
        -- Optimize query planner
        ALTER SYSTEM SET random_page_cost = 1.1;
        ALTER SYSTEM SET effective_cache_size = '1GB';
        
        -- Reload configuration
        SELECT pg_reload_conf();
      `);

      logger.info('Database configuration optimized successfully');
      this.emit('configOptimized');
    } catch (error) {
      logger.error('Failed to optimize database configuration:', error);
      this.emit('configError', error);
    }
  }

  /**
   * Start automatic optimization monitoring
   */
  startOptimizationMonitoring(intervalMinutes: number = 60): void {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }

    this.optimizationInterval = setInterval(async () => {
      try {
        const stats = await this.getDatabaseStats();
        
        // Check for performance issues
        if (stats.avgQueryTime > 500) {
          logger.warn('High average query time detected, analyzing for optimizations...');
          const slowQueries = this.getSlowQueries(5);
          
          for (const query of slowQueries) {
            const recommendations = await this.analyzeQueryPerformance(query.query);
            if (recommendations.length > 0) {
              this.emit('optimizationRecommendations', recommendations);
            }
          }
        }

        // Check cache hit ratio
        if (stats.cacheHitRatio < 80) {
          logger.warn('Low cache hit ratio detected, consider increasing shared_buffers');
          this.emit('cacheHitRatioLow', stats.cacheHitRatio);
        }

        this.emit('monitoringTick', stats);
      } catch (error) {
        logger.error('Error in optimization monitoring:', error);
      }
    }, intervalMinutes * 60 * 1000);

    logger.info(`Started database optimization monitoring (${intervalMinutes} minute intervals)`);
  }

  /**
   * Stop optimization monitoring
   */
  stopOptimizationMonitoring(): void {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
      logger.info('Stopped database optimization monitoring');
    }
  }

  /**
   * Clean up old query metrics
   */
  cleanupOldMetrics(daysToKeep: number = 7): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    
    const initialCount = this.queryMetrics.length;
    this.queryMetrics = this.queryMetrics.filter(metric => metric.timestamp > cutoff);
    
    const removedCount = initialCount - this.queryMetrics.length;
    logger.info(`Cleaned up ${removedCount} old query metrics`);
  }

  /**
   * Export query metrics for analysis
   */
  exportQueryMetrics(): QueryMetrics[] {
    return [...this.queryMetrics];
  }

  /**
   * Reset query metrics
   */
  resetQueryMetrics(): void {
    this.queryMetrics = [];
    logger.info('Query metrics reset');
  }

  /**
   * Dispose of the service
   */
  dispose(): void {
    this.stopOptimizationMonitoring();
    this.removeAllListeners();
    logger.info('Database optimization service disposed');
  }
} 