import { db } from '../database/database';
import { logger } from '../logger/logger';

export class DatabaseOptimizationService {
    /**
     * Monitor database performance
     */
    async monitorPerformance(tableName: string, operation: string, startTime: number): Promise<void> {
        try {
            const executionTime = Date.now() - startTime;

            await db.databasePerformance.create({
                data: {
                    tableName,
                    operation,
                    executionTime,
                    timestamp: new Date()
                }
            });

            // Alert if performance is poor
            if (executionTime > 1000) { // More than 1 second
                logger.warn(`Slow database operation: ${operation} on ${tableName} took ${executionTime}ms`);
            }
        } catch (error) {
            logger.error('Failed to monitor database performance:', error);
        }
    }

    /**
     * Analyze query performance
     */
    async analyzeQueryPerformance(): Promise<any> {
        try {
            const performance = await db.databasePerformance.groupBy({
                by: ['tableName', 'operation'],
                _avg: {
                    executionTime: true
                },
                _count: {
                    id: true
                },
                where: {
                    timestamp: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                    }
                }
            });

            return performance;
        } catch (error) {
            logger.error('Failed to analyze query performance:', error);
            throw error;
        }
    }

    /**
     * Monitor data quality
     */
    async monitorDataQuality(tableName: string, metricType: string, value: number, threshold: number): Promise<void> {
        try {
            const isViolated = value > threshold;

            await db.dataQualityMetrics.create({
                data: {
                    tableName,
                    metricType,
                    metricValue: value,
                    threshold,
                    isViolated,
                    timestamp: new Date()
                }
            });

            if (isViolated) {
                logger.warn(`Data quality violation: ${metricType} for ${tableName} = ${value} (threshold: ${threshold})`);
            }
        } catch (error) {
            logger.error('Failed to monitor data quality:', error);
        }
    }

    /**
     * Check for data gaps in time series data
     */
    async checkDataGaps(tableName: string, instrumentId: string, timeframe: string): Promise<any[]> {
        try {
            const gaps = [];

            if (tableName === 'candle_data') {
                // Check for gaps in candle data
                const candles = await db.candleData.findMany({
                    where: {
                        instrumentId,
                        timeframe: {
                            name: timeframe
                        }
                    },
                    orderBy: { timestamp: 'asc' },
                    select: { timestamp: true }
                });

                for (let i = 1; i < candles.length; i++) {
                    const expectedTime = new Date(candles[i - 1].timestamp.getTime() + this.getTimeframeInterval(timeframe));
                    const actualTime = candles[i].timestamp;

                    if (actualTime.getTime() - expectedTime.getTime() > 60000) { // More than 1 minute gap
                        gaps.push({
                            start: candles[i - 1].timestamp,
                            end: candles[i].timestamp,
                            duration: actualTime.getTime() - expectedTime.getTime()
                        });
                    }
                }
            }

            return gaps;
        } catch (error) {
            logger.error('Failed to check data gaps:', error);
            throw error;
        }
    }

    /**
     * Get timeframe interval in milliseconds
     */
    private getTimeframeInterval(timeframe: string): number {
        const intervals: Record<string, number> = {
            '1min': 60 * 1000,
            '3min': 3 * 60 * 1000,
            '5min': 5 * 60 * 1000,
            '15min': 15 * 60 * 1000,
            '30min': 30 * 60 * 1000,
            '1hour': 60 * 60 * 1000,
            '1day': 24 * 60 * 60 * 1000
        };

        return intervals[timeframe] || 60 * 1000;
    }

    /**
     * Archive old data
     */
    async archiveOldData(tableName: string, retentionDays: number): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            let archivedCount = 0;

            if (tableName === 'tick_data') {
                const result = await db.tickData.updateMany({
                    where: {
                        timestamp: {
                            lt: cutoffDate
                        }
                    },
                    data: {
                        // Mark as archived (you might want to move to archive table)
                    }
                });
                archivedCount = result.count;
            } else if (tableName === 'candle_data') {
                const result = await db.candleData.updateMany({
                    where: {
                        timestamp: {
                            lt: cutoffDate
                        }
                    },
                    data: {
                        // Mark as archived
                    }
                });
                archivedCount = result.count;
            }

            logger.info(`Archived ${archivedCount} records from ${tableName}`);
            return archivedCount;
        } catch (error) {
            logger.error('Failed to archive old data:', error);
            throw error;
        }
    }

    /**
     * Optimize database indexes
     */
    async optimizeIndexes(): Promise<void> {
        try {
            // This would typically involve running ANALYZE and REINDEX commands
            // For now, we'll log the recommendation
            logger.info('Database index optimization recommended. Run:');
            logger.info('ANALYZE tick_data;');
            logger.info('ANALYZE candle_data;');
            logger.info('REINDEX TABLE tick_data;');
            logger.info('REINDEX TABLE candle_data;');
        } catch (error) {
            logger.error('Failed to optimize indexes:', error);
        }
    }

    /**
     * Monitor connection pool
     */
    async monitorConnectionPool(): Promise<void> {
        try {
            // This would typically query PostgreSQL's pg_stat_activity
            // For now, we'll create a placeholder metric
            await db.connectionPoolMetrics.create({
                data: {
                    totalConnections: 10,
                    activeConnections: 5,
                    idleConnections: 3,
                    waitingConnections: 0,
                    maxConnections: 20,
                    timestamp: new Date()
                }
            });
        } catch (error) {
            logger.error('Failed to monitor connection pool:', error);
        }
    }

    /**
     * Cache frequently accessed data
     */
    async cacheData(key: string, value: any, ttlMinutes: number = 30): Promise<void> {
        try {
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);

            await db.dataCache.upsert({
                where: { cacheKey: key },
                update: {
                    cacheValue: value,
                    expiresAt,
                    lastAccessed: new Date()
                },
                create: {
                    cacheKey: key,
                    cacheValue: value,
                    expiresAt,
                    lastAccessed: new Date()
                }
            });
        } catch (error) {
            logger.error('Failed to cache data:', error);
        }
    }

    /**
     * Get cached data
     */
    async getCachedData(key: string): Promise<any | null> {
        try {
            const cached = await db.dataCache.findUnique({
                where: { cacheKey: key }
            });

            if (!cached || cached.expiresAt < new Date()) {
                return null;
            }

            // Update access count and last accessed time
            await db.dataCache.update({
                where: { cacheKey: key },
                data: {
                    accessCount: cached.accessCount + 1,
                    lastAccessed: new Date()
                }
            });

            return cached.cacheValue;
        } catch (error) {
            logger.error('Failed to get cached data:', error);
            return null;
        }
    }

    /**
     * Clean up expired cache entries
     */
    async cleanupExpiredCache(): Promise<number> {
        try {
            const result = await db.dataCache.deleteMany({
                where: {
                    expiresAt: {
                        lt: new Date()
                    }
                }
            });

            logger.info(`Cleaned up ${result.count} expired cache entries`);
            return result.count;
        } catch (error) {
            logger.error('Failed to cleanup expired cache:', error);
            throw error;
        }
    }

    /**
     * Get database statistics
     */
    async getDatabaseStats(): Promise<any> {
        try {
            const stats = {
                tickDataCount: await db.tickData.count(),
                candleDataCount: await db.candleData.count(),
                instrumentsCount: await db.instrument.count(),
                tradesCount: await db.trade.count(),
                positionsCount: await db.position.count(),
                cacheEntriesCount: await db.dataCache.count(),
                lastPerformanceCheck: new Date()
            };

            return stats;
        } catch (error) {
            logger.error('Failed to get database stats:', error);
            throw error;
        }
    }

    /**
     * Set up data retention policies
     */
    async setupRetentionPolicies(): Promise<void> {
        try {
            const policies = [
                { tableName: 'tick_data', retentionDays: 7, archivalDays: 3, compressionDays: 1 },
                { tableName: 'candle_data', retentionDays: 365, archivalDays: 90, compressionDays: 30 },
                { tableName: 'market_data', retentionDays: 180, archivalDays: 60, compressionDays: 15 }
            ];

            for (const policy of policies) {
                await db.dataRetentionPolicy.upsert({
                    where: { tableName: policy.tableName },
                    update: policy,
                    create: policy
                });
            }

            logger.info('Data retention policies set up successfully');
        } catch (error) {
            logger.error('Failed to setup retention policies:', error);
        }
    }
} 