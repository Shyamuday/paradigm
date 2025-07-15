import { TickData, MultiTimeframeCandleData, CandleAggregationResult, TimeframeConfig } from '../types';
export declare class EnhancedMarketDataService {
    private timeframeManager;
    constructor();
    saveTickDataAndAggregate(tickData: TickData): Promise<void>;
    private aggregateToTimeframe;
    private updateExistingCandle;
    private getOrCreateInstrument;
    getMultiTimeframeData(symbol: string, timeframes: string[], from: Date, to: Date, limit?: number): Promise<Record<string, MultiTimeframeCandleData[]>>;
    getLatestMultiTimeframeData(symbol: string): Promise<Record<string, MultiTimeframeCandleData | null>>;
    getHistoricalData(symbol: string, timeframe: string, from: Date, to: Date, limit?: number): Promise<CandleAggregationResult>;
    getCurrentPrice(symbol: string): Promise<number | null>;
    getPriceChange(symbol: string, timeframe?: string): Promise<{
        change: number;
        changePercent: number;
        open: number;
        close: number;
    } | null>;
    getVolumeProfile(symbol: string, timeframe: string, date: Date): Promise<any[]>;
    cleanupOldData(): Promise<void>;
    getAvailableTimeframes(): Promise<TimeframeConfig[]>;
    getInstrumentStats(symbol: string): Promise<{
        totalTicks: number;
        totalCandles: Record<string, number>;
        lastUpdate: Date | null;
    }>;
}
//# sourceMappingURL=enhanced-market-data.service.d.ts.map