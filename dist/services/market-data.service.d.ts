import { TickData, CandleData, InstrumentConfig } from '../types';
export declare class MarketDataService {
    createInstrument(config: InstrumentConfig): Promise<{
        symbol: string;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        exchange: string;
        instrumentType: string;
        lotSize: number | null;
        tickSize: number | null;
        isActive: boolean;
    }>;
    getInstrumentBySymbol(symbol: string): Promise<({
        marketData: {
            timestamp: Date;
            close: number | null;
            id: string;
            instrumentId: string;
            open: number | null;
            high: number | null;
            low: number | null;
            volume: number | null;
            ltp: number | null;
            change: number | null;
            changePercent: number | null;
        }[];
    } & {
        symbol: string;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        exchange: string;
        instrumentType: string;
        lotSize: number | null;
        tickSize: number | null;
        isActive: boolean;
    }) | null>;
    getAllInstruments(): Promise<{
        symbol: string;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        exchange: string;
        instrumentType: string;
        lotSize: number | null;
        tickSize: number | null;
        isActive: boolean;
    }[]>;
    saveTickData(tickData: TickData): Promise<{
        timestamp: Date;
        close: number | null;
        id: string;
        instrumentId: string;
        open: number | null;
        high: number | null;
        low: number | null;
        volume: number | null;
        ltp: number | null;
        change: number | null;
        changePercent: number | null;
    } | undefined>;
    saveCandleData(candleData: CandleData): Promise<{
        timestamp: Date;
        close: number | null;
        id: string;
        instrumentId: string;
        open: number | null;
        high: number | null;
        low: number | null;
        volume: number | null;
        ltp: number | null;
        change: number | null;
        changePercent: number | null;
    } | undefined>;
    getLatestMarketData(symbol: string): Promise<({
        instrument: {
            symbol: string;
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            exchange: string;
            instrumentType: string;
            lotSize: number | null;
            tickSize: number | null;
            isActive: boolean;
        };
    } & {
        timestamp: Date;
        close: number | null;
        id: string;
        instrumentId: string;
        open: number | null;
        high: number | null;
        low: number | null;
        volume: number | null;
        ltp: number | null;
        change: number | null;
        changePercent: number | null;
    })[]>;
    getPreviousClose(symbol: string): Promise<number>;
    getCurrentPrice(instrumentId: string): Promise<number>;
    getHistoricalData(symbol: string, from: Date, to: Date): Promise<{
        timestamp: Date;
        close: number | null;
        id: string;
        instrumentId: string;
        open: number | null;
        high: number | null;
        low: number | null;
        volume: number | null;
        ltp: number | null;
        change: number | null;
        changePercent: number | null;
    }[]>;
    getInstrumentsByExchange(exchange: string): Promise<{
        symbol: string;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        exchange: string;
        instrumentType: string;
        lotSize: number | null;
        tickSize: number | null;
        isActive: boolean;
    }[]>;
    updateInstrument(symbol: string, updates: Partial<InstrumentConfig>): Promise<{
        symbol: string;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        exchange: string;
        instrumentType: string;
        lotSize: number | null;
        tickSize: number | null;
        isActive: boolean;
    }>;
    deactivateInstrument(symbol: string): Promise<{
        symbol: string;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        exchange: string;
        instrumentType: string;
        lotSize: number | null;
        tickSize: number | null;
        isActive: boolean;
    }>;
}
//# sourceMappingURL=market-data.service.d.ts.map