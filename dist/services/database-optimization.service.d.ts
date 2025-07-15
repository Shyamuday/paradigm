export declare class DatabaseOptimizationService {
    monitorPerformance(tableName: string, operation: string, startTime: number): Promise<void>;
    analyzeQueryPerformance(): Promise<any>;
    monitorDataQuality(tableName: string, metricType: string, value: number, threshold: number): Promise<void>;
    checkDataGaps(tableName: string, instrumentId: string, timeframe: string): Promise<any[]>;
    private getTimeframeInterval;
    archiveOldData(tableName: string, retentionDays: number): Promise<number>;
    optimizeIndexes(): Promise<void>;
    monitorConnectionPool(): Promise<void>;
    cacheData(key: string, value: any, ttlMinutes?: number): Promise<void>;
    getCachedData(key: string): Promise<any | null>;
    cleanupExpiredCache(): Promise<number>;
    getDatabaseStats(): Promise<any>;
    setupRetentionPolicies(): Promise<void>;
}
//# sourceMappingURL=database-optimization.service.d.ts.map