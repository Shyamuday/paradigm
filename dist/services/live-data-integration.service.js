"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveDataIntegrationService = void 0;
const enhanced_market_data_service_1 = require("./enhanced-market-data.service");
const logger_1 = require("../logger/logger");
class LiveDataIntegrationService {
    constructor() {
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.marketDataService = new enhanced_market_data_service_1.EnhancedMarketDataService();
    }
    async processLiveTickData(zerodhaTickData) {
        try {
            const tickData = {
                instrumentToken: zerodhaTickData.instrument_token,
                symbol: zerodhaTickData.tradingsymbol,
                ltp: zerodhaTickData.last_price,
                open: zerodhaTickData.ohlc?.open || zerodhaTickData.last_price,
                high: zerodhaTickData.ohlc?.high || zerodhaTickData.last_price,
                low: zerodhaTickData.ohlc?.low || zerodhaTickData.last_price,
                close: zerodhaTickData.last_price,
                volume: zerodhaTickData.volume || 0,
                change: zerodhaTickData.change || 0,
                changePercent: zerodhaTickData.change_percent || 0,
                timestamp: new Date(zerodhaTickData.timestamp || Date.now())
            };
            await this.marketDataService.saveTickDataAndAggregate(tickData);
            logger_1.logger.debug(`Processed live tick for ${tickData.symbol}: ${tickData.ltp}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to process live tick data:', error);
        }
    }
    async processLiveCandleData(zerodhaCandleData) {
        try {
            const candleData = {
                instrumentToken: zerodhaCandleData.instrument_token,
                symbol: zerodhaCandleData.tradingsymbol,
                open: zerodhaCandleData.open,
                high: zerodhaCandleData.high,
                low: zerodhaCandleData.low,
                close: zerodhaCandleData.close,
                volume: zerodhaCandleData.volume,
                timestamp: new Date(zerodhaCandleData.timestamp)
            };
            const tickData = {
                ...candleData,
                ltp: candleData.close,
                change: candleData.close - candleData.open,
                changePercent: ((candleData.close - candleData.open) / candleData.open) * 100
            };
            await this.marketDataService.saveTickDataAndAggregate(tickData);
            logger_1.logger.debug(`Processed live candle for ${candleData.symbol}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to process live candle data:', error);
        }
    }
    async getRealTimeMultiTimeframeData(symbol) {
        try {
            return await this.marketDataService.getLatestMultiTimeframeData(symbol);
        }
        catch (error) {
            logger_1.logger.error('Failed to get real-time multi-timeframe data:', error);
            throw error;
        }
    }
    async monitorDataQuality(symbol) {
        try {
            const stats = await this.marketDataService.getInstrumentStats(symbol);
            const now = new Date();
            const latency = stats.lastUpdate ? now.getTime() - stats.lastUpdate.getTime() : 0;
            const dataGaps = [];
            if (latency > 5 * 60 * 1000) {
                dataGaps.push({
                    timeframe: 'live',
                    duration: latency,
                    message: `No data for ${Math.round(latency / 1000)} seconds`
                });
            }
            return {
                lastUpdate: stats.lastUpdate,
                dataGaps,
                latency
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to monitor data quality:', error);
            throw error;
        }
    }
    async startLiveMonitoring(symbols) {
        try {
            logger_1.logger.info(`Starting live monitoring for ${symbols.length} symbols`);
            setInterval(async () => {
                for (const symbol of symbols) {
                    try {
                        const quality = await this.monitorDataQuality(symbol);
                        if (quality.dataGaps.length > 0) {
                            logger_1.logger.warn(`Data quality issues for ${symbol}:`, quality.dataGaps);
                        }
                        if (quality.latency > 30000) {
                            logger_1.logger.warn(`High latency for ${symbol}: ${quality.latency}ms`);
                        }
                    }
                    catch (error) {
                        logger_1.logger.error(`Failed to monitor ${symbol}:`, error);
                    }
                }
            }, 60000);
            this.isConnected = true;
            logger_1.logger.info('Live monitoring started successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to start live monitoring:', error);
            throw error;
        }
    }
    async stopLiveMonitoring() {
        try {
            this.isConnected = false;
            logger_1.logger.info('Live monitoring stopped');
        }
        catch (error) {
            logger_1.logger.error('Failed to stop live monitoring:', error);
        }
    }
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts
        };
    }
}
exports.LiveDataIntegrationService = LiveDataIntegrationService;
//# sourceMappingURL=live-data-integration.service.js.map