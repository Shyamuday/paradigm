import { ZerodhaAuth } from '../auth/zerodha-auth';
import { logger } from '../logger/logger';

// Example of improved InstrumentsManager based on KiteConnect API documentation
export class ImprovedInstrumentsManager {
    private auth: ZerodhaAuth;
    private instruments: Map<string, any> = new Map();
    private instrumentsByToken: Map<number, any> = new Map();

    constructor(auth: ZerodhaAuth) {
        this.auth = auth;
    }

    /**
     * Get full market quotes (up to 500 instruments)
     * Based on KiteConnect API: /quote
     */
    async getFullMarketQuotes(instruments: string[]): Promise<Map<string, any>> {
        try {
            if (instruments.length > 500) {
                throw new Error('Cannot fetch quotes for more than 500 instruments at once');
            }

            logger.info(`📈 Fetching full market quotes for ${instruments.length} instruments...`);

            const kite = this.auth.getKite();
            const response = await kite.getQuote(instruments);

            const quotes = new Map<string, any>();

            // Always check for key existence before accessing
            for (const [key, data] of Object.entries(response)) {
                if (this.checkKeyExists(response, key) && data) {
                    const quote = this.parseFullMarketQuote(data);
                    quotes.set(key, quote);
                }
            }

            logger.info(`✅ Fetched full quotes for ${quotes.size} instruments`);
            return quotes;

        } catch (error) {
            logger.error('❌ Failed to fetch market quotes:', error);
            throw error;
        }
    }

    /**
     * Get OHLC quotes (up to 1000 instruments)
     * Based on KiteConnect API: /quote/ohlc
     */
    async getOHLCQuotes(instruments: string[]): Promise<Map<string, any>> {
        try {
            if (instruments.length > 1000) {
                throw new Error('Cannot fetch OHLC quotes for more than 1000 instruments at once');
            }

            logger.info(`📊 Fetching OHLC quotes for ${instruments.length} instruments...`);

            const kite = this.auth.getKite();
            const response = await kite.getOHLC(instruments);

            const quotes = new Map<string, any>();

            // Always check for key existence before accessing
            for (const [key, data] of Object.entries(response)) {
                if (this.checkKeyExists(response, key) && data) {
                    const quote = this.parseOHLCQuote(data);
                    quotes.set(key, quote);
                }
            }

            logger.info(`✅ Fetched OHLC quotes for ${quotes.size} instruments`);
            return quotes;

        } catch (error) {
            logger.error('❌ Failed to fetch OHLC quotes:', error);
            throw error;
        }
    }

    /**
     * Get LTP quotes (up to 1000 instruments)
     * Based on KiteConnect API: /quote/ltp
     */
    async getLTPQuotes(instruments: string[]): Promise<Map<string, any>> {
        try {
            if (instruments.length > 1000) {
                throw new Error('Cannot fetch LTP quotes for more than 1000 instruments at once');
            }

            logger.info(`💰 Fetching LTP quotes for ${instruments.length} instruments...`);

            const kite = this.auth.getKite();
            const response = await kite.getLTP(instruments);

            const quotes = new Map<string, any>();

            // Always check for key existence before accessing
            for (const [key, data] of Object.entries(response)) {
                if (this.checkKeyExists(response, key) && data) {
                    const quote = this.parseLTPQuote(data);
                    quotes.set(key, quote);
                }
            }

            logger.info(`✅ Fetched LTP quotes for ${quotes.size} instruments`);
            return quotes;

        } catch (error) {
            logger.error('❌ Failed to fetch LTP quotes:', error);
            throw error;
        }
    }

    /**
     * Get instruments from all exchanges
     * Based on KiteConnect API: /instruments
     */
    async getAllInstruments(): Promise<any[]> {
        try {
            logger.info('📊 Fetching all instruments...');

            const kite = this.auth.getKite();
            const instrumentsRaw = await kite.getInstruments();

            const instruments = this.parseInstrumentsCSV(instrumentsRaw);

            // Store in maps for quick lookup
            this.instruments.clear();
            this.instrumentsByToken.clear();

            instruments.forEach(instrument => {
                this.instruments.set(instrument.tradingsymbol, instrument);
                this.instrumentsByToken.set(instrument.instrument_token, instrument);
            });

            logger.info(`✅ Loaded ${instruments.length} instruments`);
            return instruments;

        } catch (error) {
            logger.error('❌ Failed to fetch instruments:', error);
            throw error;
        }
    }

    /**
     * Get instruments from specific exchange
     * Based on KiteConnect API: /instruments/:exchange
     */
    async getInstrumentsByExchange(exchange: string): Promise<any[]> {
        try {
            logger.info(`📊 Fetching instruments for ${exchange}...`);

            const kite = this.auth.getKite();
            const instrumentsRaw = await kite.getInstruments(exchange);

            const instruments = this.parseInstrumentsCSV(instrumentsRaw);

            logger.info(`✅ Loaded ${instruments.length} instruments for ${exchange}`);
            return instruments;

        } catch (error) {
            logger.error(`❌ Failed to fetch instruments for ${exchange}:`, error);
            throw error;
        }
    }

    // Helper methods for parsing API responses

    private parseFullMarketQuote(data: any): any {
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

    private parseOHLCQuote(data: any): any {
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

    private parseLTPQuote(data: any): any {
        return {
            instrument_token: Number(data.instrument_token) || 0,
            last_price: Number(data.last_price) || 0
        };
    }

    private parseMarketDepth(depthData: any[]): any[] {
        if (!Array.isArray(depthData)) return [];

        return depthData.map(item => ({
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 0,
            orders: Number(item.orders) || 0
        }));
    }

    private parseInstrumentsCSV(csvData: any): any[] {
        // Parse CSV data to instrument objects
        // This would handle the CSV response format
        return Array.isArray(csvData) ? csvData : [];
    }

    private checkKeyExists(response: any, key: string): boolean {
        return response && typeof response === 'object' && key in response;
    }
}

// Example usage
export async function exampleUsage() {
    try {
        // Initialize auth (replace with actual auth initialization)
        const auth = new ZerodhaAuth();
        // await auth.authenticate(); // Use the actual authentication method

        // Initialize improved instruments manager
        const instrumentsManager = new ImprovedInstrumentsManager(auth);

        // Get all instruments
        const allInstruments = await instrumentsManager.getAllInstruments();
        console.log(`Loaded ${allInstruments.length} instruments`);

        // Get NSE instruments only
        const nseInstruments = await instrumentsManager.getInstrumentsByExchange('NSE');
        console.log(`Loaded ${nseInstruments.length} NSE instruments`);

        // Get full market quotes (up to 500 instruments)
        const fullQuotes = await instrumentsManager.getFullMarketQuotes(['NSE:INFY', 'NSE:RELIANCE']);
        console.log('Full market quotes:', fullQuotes);

        // Get OHLC quotes (up to 1000 instruments)
        const ohlcQuotes = await instrumentsManager.getOHLCQuotes([
            'NSE:INFY', 'NSE:RELIANCE', 'BSE:SENSEX', 'NSE:NIFTY 50'
        ]);
        console.log('OHLC quotes:', ohlcQuotes);

        // Get LTP quotes (up to 1000 instruments)
        const ltpQuotes = await instrumentsManager.getLTPQuotes([
            'NSE:INFY', 'NSE:RELIANCE', 'BSE:SENSEX', 'NSE:NIFTY 50'
        ]);
        console.log('LTP quotes:', ltpQuotes);

    } catch (error) {
        console.error('Error:', error);
    }
} 