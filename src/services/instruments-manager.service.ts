import { AutoTOTPZerodhaAuth } from '../auth/easy-auth';
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

export class InstrumentsManager {
    private auth: AutoTOTPZerodhaAuth;
    private instruments: Map<string, ZerodhaInstrument> = new Map();
    private marketData: Map<number, MarketQuote> = new Map();
    private dataDir: string;
    private updateInterval: NodeJS.Timeout | null = null;
    private watchlist: Set<number> = new Set();

    constructor(auth: AutoTOTPZerodhaAuth) {
        this.auth = auth;
        this.dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    /**
     * Get all available instruments from all exchanges
     */
    async getAllInstruments(): Promise<ZerodhaInstrument[]> {
        try {
            logger.info('📊 Fetching all instruments...');
            const response = await this.auth.apiCall('/instruments');

            // Parse CSV response
            const instruments = this.parseInstrumentsCSV(response);

            // Store in memory for quick access
            this.instruments.clear();
            instruments.forEach(instrument => {
                this.instruments.set(instrument.tradingsymbol, instrument);
            });

            // Save to file for offline access
            this.saveInstrumentsToFile(instruments);

            logger.info(`✅ Loaded ${instruments.length} instruments`);
            return instruments;

        } catch (error) {
            logger.error('❌ Failed to fetch instruments:', error);
            throw error;
        }
    }

    /**
     * Get instruments for a specific exchange
     */
    async getInstrumentsByExchange(exchange: 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'CDS' | 'MCX'): Promise<ZerodhaInstrument[]> {
        try {
            logger.info(`📊 Fetching instruments for ${exchange}...`);
            const response = await this.auth.apiCall(`/instruments/${exchange}`);

            const instruments = this.parseInstrumentsCSV(response);
            logger.info(`✅ Loaded ${instruments.length} instruments for ${exchange}`);
            return instruments;

        } catch (error) {
            logger.error(`❌ Failed to fetch instruments for ${exchange}:`, error);
            throw error;
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

        return results.slice(0, 50); // Limit results
    }

    /**
     * Get market quotes for multiple instruments
     */
    async getMarketQuotes(instrumentTokens: number[]): Promise<Map<number, MarketQuote>> {
        try {
            const tokenString = instrumentTokens.join(',');
            logger.info(`📈 Fetching quotes for ${instrumentTokens.length} instruments...`);

            const response = await this.auth.apiCall(`/quote?i=${tokenString}`);
            const quotes = new Map<number, MarketQuote>();

            // Process the response data
            for (const [key, data] of Object.entries(response.data)) {
                const instrumentToken = parseInt(key);
                quotes.set(instrumentToken, data as MarketQuote);
            }

            logger.info(`✅ Fetched quotes for ${quotes.size} instruments`);
            return quotes;

        } catch (error) {
            logger.error('❌ Failed to fetch market quotes:', error);
            throw error;
        }
    }

    /**
     * Get Last Traded Price (LTP) for multiple instruments
     */
    async getLTP(instrumentTokens: number[]): Promise<Map<number, number>> {
        try {
            const tokenString = instrumentTokens.join(',');
            logger.info(`💰 Fetching LTP for ${instrumentTokens.length} instruments...`);

            const response = await this.auth.apiCall(`/ltp?i=${tokenString}`);
            const ltps = new Map<number, number>();

            for (const [key, data] of Object.entries(response.data)) {
                const instrumentToken = parseInt(key);
                ltps.set(instrumentToken, (data as any).last_price);
            }

            logger.info(`✅ Fetched LTP for ${ltps.size} instruments`);
            return ltps;

        } catch (error) {
            logger.error('❌ Failed to fetch LTP:', error);
            throw error;
        }
    }

    /**
     * Get OHLC data for multiple instruments
     */
    async getOHLC(instrumentTokens: number[]): Promise<Map<number, any>> {
        try {
            const tokenString = instrumentTokens.join(',');
            logger.info(`📊 Fetching OHLC for ${instrumentTokens.length} instruments...`);

            const response = await this.auth.apiCall(`/ohlc?i=${tokenString}`);
            const ohlcData = new Map<number, any>();

            for (const [key, data] of Object.entries(response.data)) {
                const instrumentToken = parseInt(key);
                ohlcData.set(instrumentToken, data);
            }

            logger.info(`✅ Fetched OHLC for ${ohlcData.size} instruments`);
            return ohlcData;

        } catch (error) {
            logger.error('❌ Failed to fetch OHLC:', error);
            throw error;
        }
    }

    /**
     * Get historical data for an instrument
     */
    async getHistoricalData(
        instrumentToken: number,
        interval: 'minute' | '3minute' | '5minute' | '15minute' | '30minute' | 'hour' | 'day',
        fromDate: string,
        toDate: string
    ): Promise<HistoricalData[]> {
        try {
            logger.info(`📈 Fetching historical data for ${instrumentToken}...`);

            const response = await this.auth.apiCall(
                `/instruments/historical/${instrumentToken}/${interval}?from=${fromDate}&to=${toDate}`
            );

            const historicalData: HistoricalData[] = response.data.candles.map((candle: any[]) => ({
                date: candle[0],
                open: candle[1],
                high: candle[2],
                low: candle[3],
                close: candle[4],
                volume: candle[5],
                oi: candle[6] || undefined
            }));

            logger.info(`✅ Fetched ${historicalData.length} historical records`);
            return historicalData;

        } catch (error) {
            logger.error('❌ Failed to fetch historical data:', error);
            throw error;
        }
    }

    /**
     * Add instruments to watchlist for real-time monitoring
     */
    addToWatchlist(instrumentTokens: number[]): void {
        instrumentTokens.forEach(token => this.watchlist.add(token));
        logger.info(`📋 Added ${instrumentTokens.length} instruments to watchlist`);
    }

    /**
     * Remove instruments from watchlist
     */
    removeFromWatchlist(instrumentTokens: number[]): void {
        instrumentTokens.forEach(token => this.watchlist.delete(token));
        logger.info(`📋 Removed ${instrumentTokens.length} instruments from watchlist`);
    }

    /**
     * Start automatic data updates at specified interval
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

        const watchlistArray = Array.from(this.watchlist);
        const quotes = await this.getMarketQuotes(watchlistArray);

        // Update local market data
        for (const [token, quote] of quotes) {
            this.marketData.set(token, quote);
        }

        logger.info(`🔄 Updated data for ${quotes.size} watchlist instruments`);
    }

    /**
     * Get current market data for a specific instrument
     */
    getMarketData(instrumentToken: number): MarketQuote | null {
        return this.marketData.get(instrumentToken) || null;
    }

    /**
     * Get all current market data
     */
    getAllMarketData(): Map<number, MarketQuote> {
        return new Map(this.marketData);
    }

    /**
     * Get watchlist instruments
     */
    getWatchlist(): number[] {
        return Array.from(this.watchlist);
    }

    /**
     * Export market data to JSON file
     */
    exportMarketData(filename?: string): void {
        const exportData = {
            timestamp: new Date().toISOString(),
            instruments: Array.from(this.instruments.entries()),
            marketData: Array.from(this.marketData.entries()),
            watchlist: Array.from(this.watchlist)
        };

        const filePath = path.join(this.dataDir, filename || 'market_data_export.json');
        fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
        logger.info(`📁 Market data exported to ${filePath}`);
    }

    // Private helper methods

    private parseInstrumentsCSV(csvData: string): ZerodhaInstrument[] {
        const lines = csvData.split('\n');
        const instruments: ZerodhaInstrument[] = [];

        // Skip header line
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(',');
            if (parts.length >= 12) {
                instruments.push({
                    instrument_token: parseInt(parts[0]) || 0,
                    exchange_token: parseInt(parts[1]) || 0,
                    tradingsymbol: parts[2] || '',
                    name: parts[3] || '',
                    last_price: parseFloat(parts[4]) || 0,
                    expiry: parts[5] || '',
                    strike: parseFloat(parts[6]) || 0,
                    tick_size: parseFloat(parts[7]) || 0,
                    lot_size: parseInt(parts[8]) || 0,
                    instrument_type: parts[9] || '',
                    segment: parts[10] || '',
                    exchange: parts[11] || ''
                });
            }
        }

        return instruments;
    }

    private saveInstrumentsToFile(instruments: ZerodhaInstrument[]): void {
        const filePath = path.join(this.dataDir, 'instruments.json');
        const data = {
            timestamp: new Date().toISOString(),
            count: instruments.length,
            instruments: instruments
        };

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        logger.info(`📁 Instruments saved to ${filePath}`);
    }
} 