import { ZerodhaAuth } from '../auth/zerodha-auth';
import { logger } from '../logger/logger';
import * as fs from 'fs';
import * as path from 'path';

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

export interface MarketDepth {
    price: number;
    quantity: number;
    orders: number;
}

export interface MarketQuote {
    instrument_token: number;
    timestamp: string;
    last_trade_time: string;
    last_price: number;
    last_quantity: number;
    buy_quantity: number;
    sell_quantity: number;
    volume: number;
    average_price: number;
    oi: number;
    oi_day_high: number;
    oi_day_low: number;
    net_change: number;
    lower_circuit_limit: number;
    upper_circuit_limit: number;
    ohlc: {
        open: number;
        high: number;
        low: number;
        close: number;
    };
    depth: {
        buy: MarketDepth[];
        sell: MarketDepth[];
    };
}

export interface OHLCQuote {
    instrument_token: number;
    last_price: number;
    ohlc: {
        open: number;
        high: number;
        low: number;
        close: number;
    };
}

export interface LTPQuote {
    instrument_token: number;
    last_price: number;
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

export class InstrumentsManager {
    private auth: ZerodhaAuth;
    private instruments: Map<string, ZerodhaInstrument> = new Map();
    private instrumentsByToken: Map<number, ZerodhaInstrument> = new Map();
    private marketData: Map<string, MarketQuote> = new Map();
    private dataDir: string;
    private updateInterval: NodeJS.Timeout | null = null;
    private watchlist: Set<string> = new Set();

    constructor(auth: ZerodhaAuth) {
        this.auth = auth;
        this.dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    /**
     * Get all available instruments from all exchanges
     * Returns CSV dump of all tradable instruments
     */
    async getAllInstruments(): Promise<ZerodhaInstrument[]> {
        try {
            logger.info('📊 Fetching all instruments...');

            const kite = this.auth.getKite();
            const instrumentsRaw = await kite.getInstruments();

            const instruments: ZerodhaInstrument[] = this.parseInstrumentsResponse(instrumentsRaw);

            // Store in memory for quick access
            this.instruments.clear();
            this.instrumentsByToken.clear();

            instruments.forEach(instrument => {
                this.instruments.set(instrument.tradingsymbol, instrument);
                this.instrumentsByToken.set(instrument.instrument_token, instrument);
            });

            // Save to file for offline access
            await this.saveInstrumentsToFile(instruments);

            logger.info(`✅ Loaded ${instruments.length} instruments`);
            return instruments;

        } catch (error) {
            logger.error('❌ Failed to fetch instruments:', error);
            throw new Error(`Failed to fetch instruments: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get instruments for a specific exchange
     */
    async getInstrumentsByExchange(exchange: 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'CDS' | 'MCX'): Promise<ZerodhaInstrument[]> {
        try {
            logger.info(`📊 Fetching instruments for ${exchange}...`);

            const kite = this.auth.getKite();
            const instrumentsRaw = await kite.getInstruments([exchange]);

            const instruments: ZerodhaInstrument[] = this.parseInstrumentsResponse(instrumentsRaw);

            logger.info(`✅ Loaded ${instruments.length} instruments for ${exchange}`);
            return instruments;

        } catch (error) {
            logger.error(`❌ Failed to fetch instruments for ${exchange}:`, error);
            throw new Error(`Failed to fetch instruments for ${exchange}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Search instruments by symbol or name
     */
    searchInstruments(query: string): ZerodhaInstrument[] {
        const results: ZerodhaInstrument[] = [];
        const searchQuery = query.toLowerCase();

        for (const instrument of this.instruments.values()) {
            if (
                instrument.tradingsymbol.toLowerCase().includes(searchQuery) ||
                instrument.name.toLowerCase().includes(searchQuery)
            ) {
                results.push(instrument);
            }
        }

        return results.slice(0, 50); // Limit results to 50
    }

    /**
     * Get instrument by trading symbol
     */
    getInstrumentBySymbol(tradingsymbol: string): ZerodhaInstrument | null {
        return this.instruments.get(tradingsymbol) || null;
    }

    /**
     * Get instrument by token
     */
    getInstrumentByToken(instrumentToken: number): ZerodhaInstrument | null {
        return this.instrumentsByToken.get(instrumentToken) || null;
    }

    /**
     * Get full market quotes for multiple instruments (up to 500)
     * Returns complete market data including depth, OHLC, and OI
     */
    async getMarketQuotes(instruments: string[]): Promise<Map<string, MarketQuote>> {
        try {
            if (instruments.length > 500) {
                throw new Error('Cannot fetch quotes for more than 500 instruments at once');
            }

            logger.info(`📈 Fetching full market quotes for ${instruments.length} instruments...`);

            const kite = this.auth.getKite();
            const response = await kite.getQuote(instruments);

            const quotes = new Map<string, MarketQuote>();

            for (const [key, data] of Object.entries(response)) {
                if (data && typeof data === 'object') {
                    const quote = this.parseMarketQuote(data);
                    quotes.set(key, quote);
                }
            }

            logger.info(`✅ Fetched full quotes for ${quotes.size} instruments`);
            return quotes;

        } catch (error) {
            logger.error('❌ Failed to fetch market quotes:', error);
            throw new Error(`Failed to fetch market quotes: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get OHLC quotes for multiple instruments (up to 1000)
     */
    async getOHLCQuotes(instruments: string[]): Promise<Map<string, OHLCQuote>> {
        try {
            if (instruments.length > 1000) {
                throw new Error('Cannot fetch OHLC quotes for more than 1000 instruments at once');
            }

            logger.info(`📊 Fetching OHLC quotes for ${instruments.length} instruments...`);

            const kite = this.auth.getKite();
            const response = await kite.getOHLC(instruments);

            const quotes = new Map<string, OHLCQuote>();

            for (const [key, data] of Object.entries(response)) {
                if (data && typeof data === 'object') {
                    const quote = this.parseOHLCQuote(data);
                    quotes.set(key, quote);
                }
            }

            logger.info(`✅ Fetched OHLC quotes for ${quotes.size} instruments`);
            return quotes;

        } catch (error) {
            logger.error('❌ Failed to fetch OHLC quotes:', error);
            throw new Error(`Failed to fetch OHLC quotes: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get LTP quotes for multiple instruments (up to 1000)
     */
    async getLTPQuotes(instruments: string[]): Promise<Map<string, LTPQuote>> {
        try {
            if (instruments.length > 1000) {
                throw new Error('Cannot fetch LTP quotes for more than 1000 instruments at once');
            }

            logger.info(`💰 Fetching LTP quotes for ${instruments.length} instruments...`);

            const kite = this.auth.getKite();
            const response = await kite.getLTP(instruments);

            const quotes = new Map<string, LTPQuote>();

            for (const [key, data] of Object.entries(response)) {
                if (data && typeof data === 'object') {
                    const quote = this.parseLTPQuote(data);
                    quotes.set(key, quote);
                }
            }

            logger.info(`✅ Fetched LTP quotes for ${quotes.size} instruments`);
            return quotes;

        } catch (error) {
            logger.error('❌ Failed to fetch LTP quotes:', error);
            throw new Error(`Failed to fetch LTP quotes: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get historical data for an instrument
     */
    async getHistoricalData(
        instrumentToken: number,
        interval: 'minute' | '3minute' | '5minute' | '10minute' | '15minute' | '30minute' | '60minute' | 'day',
        fromDate: string,
        toDate: string
    ): Promise<HistoricalData[]> {
        try {
            logger.info(`📈 Fetching historical data for ${instrumentToken}...`);

            const kite = this.auth.getKite();
            const data = await kite.getHistoricalData(instrumentToken, interval, fromDate, toDate);

            const historicalData: HistoricalData[] = Array.isArray(data) ?
                data.map(candle => this.parseHistoricalCandle(candle)) : [];

            logger.info(`✅ Fetched ${historicalData.length} historical data points`);
            return historicalData;

        } catch (error) {
            logger.error('❌ Failed to fetch historical data:', error);
            throw new Error(`Failed to fetch historical data: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Add instruments to watchlist for monitoring
     */
    addToWatchlist(instruments: string[]): void {
        instruments.forEach(instrument => this.watchlist.add(instrument));
        logger.info(`📋 Added ${instruments.length} instruments to watchlist`);
    }

    /**
     * Remove instruments from watchlist
     */
    removeFromWatchlist(instruments: string[]): void {
        instruments.forEach(instrument => this.watchlist.delete(instrument));
        logger.info(`📋 Removed ${instruments.length} instruments from watchlist`);
    }

    /**
     * Get watchlist instruments
     */
    getWatchlist(): string[] {
        return Array.from(this.watchlist);
    }

    /**
     * Start automatic data updates
     */
    startAutoUpdates(intervalMs: number = 30000): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        logger.info(`🔄 Starting auto-updates every ${intervalMs}ms`);

        this.updateInterval = setInterval(async () => {
            try {
                await this.updateWatchlistData();
            } catch (error) {
                logger.error('❌ Auto-update failed:', error);
            }
        }, intervalMs);
    }

    /**
     * Stop automatic data updates
     */
    stopAutoUpdates(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            logger.info('⏹️ Auto-updates stopped');
        }
    }

    /**
     * Update market data for watchlist instruments
     */
    async updateWatchlistData(): Promise<void> {
        if (this.watchlist.size === 0) return;

        try {
            const watchlistInstruments = Array.from(this.watchlist);
            const quotes = await this.getMarketQuotes(watchlistInstruments);

            // Update local market data
            for (const [key, quote] of quotes) {
                this.marketData.set(key, quote);
            }

            logger.info(`🔄 Updated data for ${quotes.size} watchlist instruments`);
        } catch (error) {
            logger.error('❌ Failed to update watchlist data:', error);
        }
    }

    /**
     * Get current market data for a specific instrument
     */
    getMarketData(instrumentKey: string): MarketQuote | null {
        return this.marketData.get(instrumentKey) || null;
    }

    /**
     * Get all current market data
     */
    getAllMarketData(): Map<string, MarketQuote> {
        return new Map(this.marketData);
    }

    /**
     * Export market data to JSON file
     */
    async exportMarketData(filename?: string): Promise<void> {
        try {
            const exportData = {
                timestamp: new Date().toISOString(),
                instruments: Array.from(this.instruments.entries()),
                marketData: Array.from(this.marketData.entries()),
                watchlist: Array.from(this.watchlist)
            };

            const filePath = path.join(this.dataDir, filename || 'market_data_export.json');
            await fs.promises.writeFile(filePath, JSON.stringify(exportData, null, 2));
            logger.info(`📁 Market data exported to ${filePath}`);
        } catch (error) {
            logger.error('❌ Failed to export market data:', error);
            throw new Error(`Failed to export market data: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Load instruments from cache file
     */
    async loadInstrumentsFromCache(): Promise<ZerodhaInstrument[]> {
        try {
            const filePath = path.join(this.dataDir, 'instruments.json');

            if (!fs.existsSync(filePath)) {
                return [];
            }

            const data = await fs.promises.readFile(filePath, 'utf-8');
            const parsed = JSON.parse(data);

            if (parsed.instruments && Array.isArray(parsed.instruments)) {
                const instruments = parsed.instruments as ZerodhaInstrument[];

                // Populate maps
                this.instruments.clear();
                this.instrumentsByToken.clear();

                instruments.forEach(instrument => {
                    this.instruments.set(instrument.tradingsymbol, instrument);
                    this.instrumentsByToken.set(instrument.instrument_token, instrument);
                });

                logger.info(`📁 Loaded ${instruments.length} instruments from cache`);
                return instruments;
            }

            return [];
        } catch (error) {
            logger.error('❌ Failed to load instruments from cache:', error);
            return [];
        }
    }

    /**
     * Check if key exists in response before accessing
     */
    private checkKeyExists(response: any, key: string): boolean {
        return response && typeof response === 'object' && key in response;
    }

    // Private helper methods

    private parseInstrumentsResponse(rawInstruments: any[]): ZerodhaInstrument[] {
        return rawInstruments.map(inst => ({
            instrument_token: Number(inst.instrument_token) || 0,
            exchange_token: Number(inst.exchange_token) || 0,
            tradingsymbol: String(inst.tradingsymbol || ''),
            name: String(inst.name || ''),
            last_price: Number(inst.last_price) || 0,
            expiry: String(inst.expiry || ''),
            strike: Number(inst.strike) || 0,
            tick_size: Number(inst.tick_size) || 0,
            lot_size: Number(inst.lot_size) || 0,
            instrument_type: String(inst.instrument_type || ''),
            segment: String(inst.segment || ''),
            exchange: String(inst.exchange || '')
        }));
    }

    private parseMarketQuote(data: any): MarketQuote {
        return {
            instrument_token: Number(data.instrument_token) || 0,
            timestamp: String(data.timestamp || ''),
            last_trade_time: String(data.last_trade_time || ''),
            last_price: Number(data.last_price) || 0,
            last_quantity: Number(data.last_quantity) || 0,
            buy_quantity: Number(data.buy_quantity) || 0,
            sell_quantity: Number(data.sell_quantity) || 0,
            volume: Number(data.volume) || 0,
            average_price: Number(data.average_price) || 0,
            oi: Number(data.oi) || 0,
            oi_day_high: Number(data.oi_day_high) || 0,
            oi_day_low: Number(data.oi_day_low) || 0,
            net_change: Number(data.net_change) || 0,
            lower_circuit_limit: Number(data.lower_circuit_limit) || 0,
            upper_circuit_limit: Number(data.upper_circuit_limit) || 0,
            ohlc: {
                open: Number(data.ohlc?.open) || 0,
                high: Number(data.ohlc?.high) || 0,
                low: Number(data.ohlc?.low) || 0,
                close: Number(data.ohlc?.close) || 0
            },
            depth: {
                buy: this.parseMarketDepth(data.depth?.buy),
                sell: this.parseMarketDepth(data.depth?.sell)
            }
        };
    }

    private parseOHLCQuote(data: any): OHLCQuote {
        return {
            instrument_token: Number(data.instrument_token) || 0,
            last_price: Number(data.last_price) || 0,
            ohlc: {
                open: Number(data.ohlc?.open) || 0,
                high: Number(data.ohlc?.high) || 0,
                low: Number(data.ohlc?.low) || 0,
                close: Number(data.ohlc?.close) || 0
            }
        };
    }

    private parseLTPQuote(data: any): LTPQuote {
        return {
            instrument_token: Number(data.instrument_token) || 0,
            last_price: Number(data.last_price) || 0
        };
    }

    private parseHistoricalCandle(candle: any): HistoricalData {
        return {
            date: candle.date instanceof Date ? candle.date.toISOString() : String(candle.date),
            open: Number(candle.open) || 0,
            high: Number(candle.high) || 0,
            low: Number(candle.low) || 0,
            close: Number(candle.close) || 0,
            volume: Number(candle.volume) || 0,
            ...(candle.oi !== undefined ? { oi: Number(candle.oi) || 0 } : {})
        };
    }

    private parseMarketDepth(depthData: any[]): MarketDepth[] {
        if (!Array.isArray(depthData)) return [];

        return depthData.map(item => ({
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 0,
            orders: Number(item.orders) || 0
        }));
    }

    private async saveInstrumentsToFile(instruments: ZerodhaInstrument[]): Promise<void> {
        try {
            const filePath = path.join(this.dataDir, 'instruments.json');
            const data = {
                timestamp: new Date().toISOString(),
                count: instruments.length,
                instruments: instruments
            };

            await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
            logger.info(`📁 Instruments saved to ${filePath}`);
        } catch (error) {
            logger.error('❌ Failed to save instruments to file:', error);
        }
    }
} 