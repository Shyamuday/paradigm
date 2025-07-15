import { AutoTOTPZerodhaAuth } from '../auth/easy-auth';
export interface ZerodhaInstrument {
    instrument_token: number;
    exchange_token: number;
    tradingsymbol: string;
    name: string;
    last_price: number;
    expiry: string;
    strike: number;
    tick_size: number;
    lot_size: number;
    instrument_type: string;
    segment: string;
    exchange: string;
}
export interface MarketQuote {
    instrument_token: number;
    last_price: number;
    last_quantity: number;
    average_price: number;
    volume: number;
    buy_quantity: number;
    sell_quantity: number;
    ohlc: {
        open: number;
        high: number;
        low: number;
        close: number;
    };
    net_change: number;
    oi: number;
    oi_day_high: number;
    oi_day_low: number;
    timestamp: string;
    last_trade_time: string;
}
export interface HistoricalData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    oi?: number;
}
export declare class InstrumentsManager {
    private auth;
    private instruments;
    private marketData;
    private dataDir;
    private updateInterval;
    private watchlist;
    constructor(auth: AutoTOTPZerodhaAuth);
    getAllInstruments(): Promise<ZerodhaInstrument[]>;
    getInstrumentsByExchange(exchange: 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'CDS' | 'MCX'): Promise<ZerodhaInstrument[]>;
    searchInstruments(query: string): ZerodhaInstrument[];
    getMarketQuotes(instrumentTokens: number[]): Promise<Map<number, MarketQuote>>;
    getLTP(instrumentTokens: number[]): Promise<Map<number, number>>;
    getOHLC(instrumentTokens: number[]): Promise<Map<number, any>>;
    getHistoricalData(instrumentToken: number, interval: 'minute' | '3minute' | '5minute' | '15minute' | '30minute' | 'hour' | 'day', fromDate: string, toDate: string): Promise<HistoricalData[]>;
    addToWatchlist(instrumentTokens: number[]): void;
    removeFromWatchlist(instrumentTokens: number[]): void;
    startAutoUpdates(intervalMs?: number): void;
    stopAutoUpdates(): void;
    updateWatchlistData(): Promise<void>;
    getMarketData(instrumentToken: number): MarketQuote | null;
    getAllMarketData(): Map<number, MarketQuote>;
    getWatchlist(): number[];
    exportMarketData(filename?: string): void;
    private parseInstrumentsCSV;
    private saveInstrumentsToFile;
}
//# sourceMappingURL=instruments-manager.service.d.ts.map