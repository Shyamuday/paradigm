import { TimeframeConfig, MultiTimeframeCandleData, TickDataPoint, CandleAggregationRequest, CandleAggregationResult } from '../types';
export declare class TimeframeManagerService {
    private static readonly DEFAULT_TIMEFRAMES;
    constructor();
    private initializeTimeframes;
    private createTimeframeIfNotExists;
    getActiveTimeframes(): Promise<TimeframeConfig[]>;
    getTimeframeByName(name: string): Promise<TimeframeConfig | null>;
    saveTickData(tickData: Omit<TickDataPoint, 'id'>): Promise<TickDataPoint>;
    aggregateToCandles(instrumentId: string, timeframeName: string, fromTime: Date, toTime: Date): Promise<MultiTimeframeCandleData[]>;
    private groupTicksIntoCandles;
    private saveCandleData;
    getCandleData(request: CandleAggregationRequest): Promise<CandleAggregationResult>;
    getLatestCandle(symbol: string, timeframe: string): Promise<MultiTimeframeCandleData | null>;
    cleanupOldTickData(retentionDays?: number): Promise<number>;
    getVolumeProfile(symbol: string, timeframe: string, date: Date): Promise<any[]>;
}
//# sourceMappingURL=timeframe-manager.service.d.ts.map