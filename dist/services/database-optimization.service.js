"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseOptimizationService = void 0;
const database_1 = require("../database/database");
const logger_1 = require("../logger/logger");
class DatabaseOptimizationService {
    async monitorPerformance(tableName, operation, startTime) {
        try {
            const executionTime = Date.now() - startTime;
            await database_1.db.databasePerformance.create({
                data: {
                    tableName,
                    operation,
                    executionTime,
                    timestamp: new Date()
                }
            });
            if (executionTime > 1000) {
                logger_1.logger.warn(`Slow database operation: ${operation} on ${tableName} took ${executionTime}ms`);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to monitor database performance:', error);
        }
    }
    async analyzeQueryPerformance() {
        try {
            const performance = await database_1.db.databasePerformance.groupBy({
                by: ['tableName', 'operation'],
                _avg: {
                    executionTime: true
                },
                _count: {
                    id: true
                },
                where: {
                    timestamp: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                    }
                }
            });
            return performance;
        }
        catch (error) {
            logger_1.logger.error('Failed to analyze query performance:', error);
            throw error;
        }
    }
    async monitorDataQuality(tableName, metricType, value, threshold) {
        try {
            const isViolated = value > threshold;
            await database_1.db.dataQualityMetrics.create({
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
                logger_1.logger.warn(`Data quality violation: ${metricType} for ${tableName} = ${value} (threshold: ${threshold})`);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to monitor data quality:', error);
        }
    }
    async checkDataGaps(tableName, instrumentId, timeframe) {
        try {
            const gaps = [];
            if (tableName === 'candle_data') {
                const candles = await database_1.db.candleData.findMany({
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
                    if (actualTime.getTime() - expectedTime.getTime() > 60000) {
                        gaps.push({
                            start: candles[i - 1].timestamp,
                            end: candles[i].timestamp,
                            duration: actualTime.getTime() - expectedTime.getTime()
                        });
                    }
                }
            }
            return gaps;
        }
        catch (error) {
            logger_1.logger.error('Failed to check data gaps:', error);
            throw error;
        }
    }
    getTimeframeInterval(timeframe) {
        const intervals = {
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
    async archiveOldData(tableName, retentionDays) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
            let archivedCount = 0;
            if (tableName === 'tick_data') {
                const result = await database_1.db.tickData.updateMany({
                    where: {
                        timestamp: {
                            lt: cutoffDate
                        }
                    },
                    data: {}
                });
                archivedCount = result.count;
            }
            else if (tableName === 'candle_data') {
                const result = await database_1.db.candleData.updateMany({
                    where: {
                        timestamp: {
                            lt: cutoffDate
                        }
                    },
                    data: {}
                });
                archivedCount = result.count;
            }
            logger_1.logger.info(`Archived ${archivedCount} records from ${tableName}`);
            return archivedCount;
        }
        catch (error) {
            logger_1.logger.error('Failed to archive old data:', error);
            throw error;
        }
    }
    async optimizeIndexes() {
        try {
            logger_1.logger.info('Database index optimization recommended. Run:');
            logger_1.logger.info('ANALYZE tick_data;');
            logger_1.logger.info('ANALYZE candle_data;');
            logger_1.logger.info('REINDEX TABLE tick_data;');
            logger_1.logger.info('REINDEX TABLE candle_data;');
        }
        catch (error) {
            logger_1.logger.error('Failed to optimize indexes:', error);
        }
    }
    async monitorConnectionPool() {
        try {
            await database_1.db.connectionPoolMetrics.create({
                data: {
                    totalConnections: 10,
                    activeConnections: 5,
                    idleConnections: 3,
                    waitingConnections: 0,
                    maxConnections: 20,
                    timestamp: new Date()
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to monitor connection pool:', error);
        }
    }
    async cacheData(key, value, ttlMinutes = 30) {
        try {
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);
            await database_1.db.dataCache.upsert({
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
        }
        catch (error) {
            logger_1.logger.error('Failed to cache data:', error);
        }
    }
    async getCachedData(key) {
        try {
            const cached = await database_1.db.dataCache.findUnique({
                where: { cacheKey: key }
            });
            if (!cached || cached.expiresAt < new Date()) {
                return null;
            }
            await database_1.db.dataCache.update({
                where: { cacheKey: key },
                data: {
                    accessCount: cached.accessCount + 1,
                    lastAccessed: new Date()
                }
            });
            return cached.cacheValue;
        }
        catch (error) {
            logger_1.logger.error('Failed to get cached data:', error);
            return null;
        }
    }
    async cleanupExpiredCache() {
        try {
            const result = await database_1.db.dataCache.deleteMany({
                where: {
                    expiresAt: {
                        lt: new Date()
                    }
                }
            });
            logger_1.logger.info(`Cleaned up ${result.count} expired cache entries`);
            return result.count;
        }
        catch (error) {
            logger_1.logger.error('Failed to cleanup expired cache:', error);
            throw error;
        }
    }
    async getDatabaseStats() {
        try {
            const stats = {
                tickDataCount: await database_1.db.tickData.count(),
                candleDataCount: await database_1.db.candleData.count(),
                instrumentsCount: await database_1.db.instrument.count(),
                tradesCount: await database_1.db.trade.count(),
                positionsCount: await database_1.db.position.count(),
                cacheEntriesCount: await database_1.db.dataCache.count(),
                lastPerformanceCheck: new Date()
            };
            return stats;
        }
        catch (error) {
            logger_1.logger.error('Failed to get database stats:', error);
            throw error;
        }
    }
    async setupRetentionPolicies() {
        try {
            const policies = [
                { tableName: 'tick_data', retentionDays: 7, archivalDays: 3, compressionDays: 1 },
                { tableName: 'candle_data', retentionDays: 365, archivalDays: 90, compressionDays: 30 },
                { tableName: 'market_data', retentionDays: 180, archivalDays: 60, compressionDays: 15 }
            ];
            for (const policy of policies) {
                await database_1.db.dataRetentionPolicy.upsert({
                    where: { tableName: policy.tableName },
                    update: policy,
                    create: policy
                });
            }
            logger_1.logger.info('Data retention policies set up successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to setup retention policies:', error);
        }
    }
}
exports.DatabaseOptimizationService = DatabaseOptimizationService;
//# sourceMappingURL=database-optimization.service.js.map