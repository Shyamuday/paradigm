"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstrumentsManager = void 0;
const logger_1 = require("../logger/logger");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class InstrumentsManager {
    constructor(auth) {
        this.instruments = new Map();
        this.marketData = new Map();
        this.updateInterval = null;
        this.watchlist = new Set();
        this.auth = auth;
        this.dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }
    async getAllInstruments() {
        try {
            logger_1.logger.info('📊 Fetching all instruments...');
            const response = await this.auth.apiCall('/instruments');
            const instruments = this.parseInstrumentsCSV(response);
            this.instruments.clear();
            instruments.forEach(instrument => {
                this.instruments.set(instrument.tradingsymbol, instrument);
            });
            this.saveInstrumentsToFile(instruments);
            logger_1.logger.info(`✅ Loaded ${instruments.length} instruments`);
            return instruments;
        }
        catch (error) {
            logger_1.logger.error('❌ Failed to fetch instruments:', error);
            throw error;
        }
    }
    async getInstrumentsByExchange(exchange) {
        try {
            logger_1.logger.info(`📊 Fetching instruments for ${exchange}...`);
            const response = await this.auth.apiCall(`/instruments/${exchange}`);
            const instruments = this.parseInstrumentsCSV(response);
            logger_1.logger.info(`✅ Loaded ${instruments.length} instruments for ${exchange}`);
            return instruments;
        }
        catch (error) {
            logger_1.logger.error(`❌ Failed to fetch instruments for ${exchange}:`, error);
            throw error;
        }
    }
    searchInstruments(query) {
        const results = [];
        const searchQuery = query.toLowerCase();
        for (const instrument of this.instruments.values()) {
            if (instrument.tradingsymbol.toLowerCase().includes(searchQuery) ||
                instrument.name.toLowerCase().includes(searchQuery)) {
                results.push(instrument);
            }
        }
        return results.slice(0, 50);
    }
    async getMarketQuotes(instrumentTokens) {
        try {
            const tokenString = instrumentTokens.join(',');
            logger_1.logger.info(`📈 Fetching quotes for ${instrumentTokens.length} instruments...`);
            const response = await this.auth.apiCall(`/quote?i=${tokenString}`);
            const quotes = new Map();
            for (const [key, data] of Object.entries(response.data)) {
                const instrumentToken = parseInt(key);
                quotes.set(instrumentToken, data);
            }
            logger_1.logger.info(`✅ Fetched quotes for ${quotes.size} instruments`);
            return quotes;
        }
        catch (error) {
            logger_1.logger.error('❌ Failed to fetch market quotes:', error);
            throw error;
        }
    }
    async getLTP(instrumentTokens) {
        try {
            const tokenString = instrumentTokens.join(',');
            logger_1.logger.info(`💰 Fetching LTP for ${instrumentTokens.length} instruments...`);
            const response = await this.auth.apiCall(`/ltp?i=${tokenString}`);
            const ltps = new Map();
            for (const [key, data] of Object.entries(response.data)) {
                const instrumentToken = parseInt(key);
                ltps.set(instrumentToken, data.last_price);
            }
            logger_1.logger.info(`✅ Fetched LTP for ${ltps.size} instruments`);
            return ltps;
        }
        catch (error) {
            logger_1.logger.error('❌ Failed to fetch LTP:', error);
            throw error;
        }
    }
    async getOHLC(instrumentTokens) {
        try {
            const tokenString = instrumentTokens.join(',');
            logger_1.logger.info(`📊 Fetching OHLC for ${instrumentTokens.length} instruments...`);
            const response = await this.auth.apiCall(`/ohlc?i=${tokenString}`);
            const ohlcData = new Map();
            for (const [key, data] of Object.entries(response.data)) {
                const instrumentToken = parseInt(key);
                ohlcData.set(instrumentToken, data);
            }
            logger_1.logger.info(`✅ Fetched OHLC for ${ohlcData.size} instruments`);
            return ohlcData;
        }
        catch (error) {
            logger_1.logger.error('❌ Failed to fetch OHLC:', error);
            throw error;
        }
    }
    async getHistoricalData(instrumentToken, interval, fromDate, toDate) {
        try {
            logger_1.logger.info(`📈 Fetching historical data for ${instrumentToken}...`);
            const response = await this.auth.apiCall(`/instruments/historical/${instrumentToken}/${interval}?from=${fromDate}&to=${toDate}`);
            const historicalData = response.data.candles.map((candle) => ({
                date: candle[0],
                open: candle[1],
                high: candle[2],
                low: candle[3],
                close: candle[4],
                volume: candle[5],
                oi: candle[6] || undefined
            }));
            logger_1.logger.info(`✅ Fetched ${historicalData.length} historical records`);
            return historicalData;
        }
        catch (error) {
            logger_1.logger.error('❌ Failed to fetch historical data:', error);
            throw error;
        }
    }
    addToWatchlist(instrumentTokens) {
        instrumentTokens.forEach(token => this.watchlist.add(token));
        logger_1.logger.info(`📋 Added ${instrumentTokens.length} instruments to watchlist`);
    }
    removeFromWatchlist(instrumentTokens) {
        instrumentTokens.forEach(token => this.watchlist.delete(token));
        logger_1.logger.info(`📋 Removed ${instrumentTokens.length} instruments from watchlist`);
    }
    startAutoUpdates(intervalMs = 30000) {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        logger_1.logger.info(`🔄 Starting auto-updates every ${intervalMs}ms`);
        this.updateInterval = setInterval(async () => {
            try {
                await this.updateWatchlistData();
            }
            catch (error) {
                logger_1.logger.error('❌ Auto-update failed:', error);
            }
        }, intervalMs);
    }
    stopAutoUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            logger_1.logger.info('⏹️ Auto-updates stopped');
        }
    }
    async updateWatchlistData() {
        if (this.watchlist.size === 0)
            return;
        const watchlistArray = Array.from(this.watchlist);
        const quotes = await this.getMarketQuotes(watchlistArray);
        for (const [token, quote] of quotes) {
            this.marketData.set(token, quote);
        }
        logger_1.logger.info(`🔄 Updated data for ${quotes.size} watchlist instruments`);
    }
    getMarketData(instrumentToken) {
        return this.marketData.get(instrumentToken) || null;
    }
    getAllMarketData() {
        return new Map(this.marketData);
    }
    getWatchlist() {
        return Array.from(this.watchlist);
    }
    exportMarketData(filename) {
        const exportData = {
            timestamp: new Date().toISOString(),
            instruments: Array.from(this.instruments.entries()),
            marketData: Array.from(this.marketData.entries()),
            watchlist: Array.from(this.watchlist)
        };
        const filePath = path.join(this.dataDir, filename || 'market_data_export.json');
        fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
        logger_1.logger.info(`📁 Market data exported to ${filePath}`);
    }
    parseInstrumentsCSV(csvData) {
        const lines = csvData.split('\n');
        const instruments = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line)
                continue;
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
    saveInstrumentsToFile(instruments) {
        const filePath = path.join(this.dataDir, 'instruments.json');
        const data = {
            timestamp: new Date().toISOString(),
            count: instruments.length,
            instruments: instruments
        };
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        logger_1.logger.info(`📁 Instruments saved to ${filePath}`);
    }
}
exports.InstrumentsManager = InstrumentsManager;
//# sourceMappingURL=instruments-manager.service.js.map