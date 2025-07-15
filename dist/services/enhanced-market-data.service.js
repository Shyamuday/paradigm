"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedMarketDataService = void 0;
const database_1 = require("../database/database");
const logger_1 = require("../logger/logger");
const timeframe_manager_service_1 = require("./timeframe-manager.service");
class EnhancedMarketDataService {
    constructor() {
        this.timeframeManager = new timeframe_manager_service_1.TimeframeManagerService();
    }
    async saveTickDataAndAggregate(tickData) {
        try {
            const instrument = await this.getOrCreateInstrument({
                symbol: tickData.symbol,
                exchange: 'NSE',
                instrumentType: 'EQ'
            });
            await this.timeframeManager.saveTickData({
                instrumentId: instrument.id,
                timestamp: tickData.timestamp,
                ltp: tickData.ltp,
                volume: tickData.volume,
                change: tickData.change,
                changePercent: tickData.changePercent
            });
            const timeframes = await this.timeframeManager.getActiveTimeframes();
            for (const timeframe of timeframes) {
                await this.aggregateToTimeframe(instrument.id, timeframe.name, tickData.timestamp);
            }
            logger_1.logger.debug(`Processed tick data for ${tickData.symbol} across ${timeframes.length} timeframes`);
        }
        catch (error) {
            logger_1.logger.error('Failed to save tick data and aggregate:', error);
            throw error;
        }
    }
    async aggregateToTimeframe(instrumentId, timeframeName, currentTime) {
        try {
            const timeframe = await this.timeframeManager.getTimeframeByName(timeframeName);
            if (!timeframe) {
                logger_1.logger.warn(`Timeframe ${timeframeName} not found`);
                return;
            }
            const intervalMs = timeframe.intervalMinutes * 60 * 1000;
            const currentIntervalStart = Math.floor(currentTime.getTime() / intervalMs) * intervalMs;
            const fromTime = new Date(currentIntervalStart);
            const toTime = new Date(currentIntervalStart + intervalMs);
            const existingCandle = await database_1.db.candleData.findFirst({
                where: {
                    instrumentId,
                    timeframeId: timeframe.id,
                    timestamp: {
                        gte: fromTime,
                        lt: toTime
                    }
                }
            });
            if (existingCandle) {
                await this.updateExistingCandle(existingCandle.id, currentTime, timeframe.intervalMinutes);
            }
            else {
                await this.timeframeManager.aggregateToCandles(instrumentId, timeframeName, fromTime, toTime);
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to aggregate to timeframe ${timeframeName}:`, error);
        }
    }
    async updateExistingCandle(candleId, currentTime, intervalMinutes) {
        try {
            const candle = await database_1.db.candleData.findUnique({
                where: { id: candleId },
                include: { instrument: true }
            });
            if (!candle)
                return;
            const latestTick = await database_1.db.tickData.findFirst({
                where: { instrumentId: candle.instrumentId },
                orderBy: { timestamp: 'desc' }
            });
            if (!latestTick)
                return;
            await database_1.db.candleData.update({
                where: { id: candleId },
                data: {
                    high: Math.max(candle.high, latestTick.ltp),
                    low: Math.min(candle.low, latestTick.ltp),
                    close: latestTick.ltp,
                    volume: candle.volume + latestTick.volume,
                    typicalPrice: (Math.max(candle.high, latestTick.ltp) + Math.min(candle.low, latestTick.ltp) + latestTick.ltp) / 3,
                    weightedPrice: (Math.max(candle.high, latestTick.ltp) + Math.min(candle.low, latestTick.ltp) + latestTick.ltp + latestTick.ltp) / 4,
                    priceChange: latestTick.ltp - candle.open,
                    priceChangePercent: ((latestTick.ltp - candle.open) / candle.open) * 100,
                    upperShadow: Math.max(candle.high, latestTick.ltp) - Math.max(candle.open, latestTick.ltp),
                    lowerShadow: Math.min(candle.open, latestTick.ltp) - Math.min(candle.low, latestTick.ltp),
                    bodySize: Math.abs(latestTick.ltp - candle.open),
                    totalRange: Math.max(candle.high, latestTick.ltp) - Math.min(candle.low, latestTick.ltp)
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to update existing candle:', error);
        }
    }
    async getOrCreateInstrument(config) {
        try {
            let instrument = await database_1.db.instrument.findUnique({
                where: { symbol: config.symbol }
            });
            if (!instrument) {
                instrument = await database_1.db.instrument.create({
                    data: {
                        symbol: config.symbol,
                        name: config.symbol,
                        exchange: config.exchange,
                        instrumentType: config.instrumentType,
                        lotSize: config.lotSize || null,
                        tickSize: config.tickSize || null,
                    },
                });
                logger_1.logger.info('Instrument created:', instrument.symbol);
            }
            return instrument;
        }
        catch (error) {
            logger_1.logger.error('Failed to get or create instrument:', error);
            throw error;
        }
    }
    async getMultiTimeframeData(symbol, timeframes, from, to, limit = 100) {
        try {
            const result = {};
            for (const timeframe of timeframes) {
                const request = {
                    symbol,
                    timeframe,
                    from,
                    to,
                    limit
                };
                const candleResult = await this.timeframeManager.getCandleData(request);
                result[timeframe] = candleResult.candles;
            }
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to get multi-timeframe data:', error);
            throw error;
        }
    }
    async getLatestMultiTimeframeData(symbol) {
        try {
            const timeframes = await this.timeframeManager.getActiveTimeframes();
            const result = {};
            for (const timeframe of timeframes) {
                result[timeframe.name] = await this.timeframeManager.getLatestCandle(symbol, timeframe.name);
            }
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to get latest multi-timeframe data:', error);
            throw error;
        }
    }
    async getHistoricalData(symbol, timeframe, from, to, limit = 1000) {
        try {
            const request = {
                symbol,
                timeframe,
                from,
                to,
                limit
            };
            return await this.timeframeManager.getCandleData(request);
        }
        catch (error) {
            logger_1.logger.error('Failed to get historical data:', error);
            throw error;
        }
    }
    async getCurrentPrice(symbol) {
        try {
            const instrument = await database_1.db.instrument.findUnique({
                where: { symbol }
            });
            if (!instrument) {
                return null;
            }
            const latestTick = await database_1.db.tickData.findFirst({
                where: { instrumentId: instrument.id },
                orderBy: { timestamp: 'desc' }
            });
            return latestTick?.ltp || null;
        }
        catch (error) {
            logger_1.logger.error('Failed to get current price:', error);
            throw error;
        }
    }
    async getPriceChange(symbol, timeframe = '1day') {
        try {
            const latestCandle = await this.timeframeManager.getLatestCandle(symbol, timeframe);
            if (!latestCandle) {
                return null;
            }
            return {
                change: latestCandle.priceChange || 0,
                changePercent: latestCandle.priceChangePercent || 0,
                open: latestCandle.open,
                close: latestCandle.close
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get price change:', error);
            throw error;
        }
    }
    async getVolumeProfile(symbol, timeframe, date) {
        try {
            return await this.timeframeManager.getVolumeProfile(symbol, timeframe, date);
        }
        catch (error) {
            logger_1.logger.error('Failed to get volume profile:', error);
            throw error;
        }
    }
    async cleanupOldData() {
        try {
            await this.timeframeManager.cleanupOldTickData(7);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 90);
            await database_1.db.candleData.deleteMany({
                where: {
                    timestamp: {
                        lt: cutoffDate
                    },
                    timeframe: {
                        name: '1day'
                    }
                }
            });
            logger_1.logger.info('Old data cleanup completed');
        }
        catch (error) {
            logger_1.logger.error('Failed to cleanup old data:', error);
            throw error;
        }
    }
    async getAvailableTimeframes() {
        try {
            return await this.timeframeManager.getActiveTimeframes();
        }
        catch (error) {
            logger_1.logger.error('Failed to get available timeframes:', error);
            throw error;
        }
    }
    async getInstrumentStats(symbol) {
        try {
            const instrument = await database_1.db.instrument.findUnique({
                where: { symbol }
            });
            if (!instrument) {
                throw new Error(`Instrument ${symbol} not found`);
            }
            const totalTicks = await database_1.db.tickData.count({
                where: { instrumentId: instrument.id }
            });
            const timeframes = await this.timeframeManager.getActiveTimeframes();
            const totalCandles = {};
            for (const timeframe of timeframes) {
                const count = await database_1.db.candleData.count({
                    where: {
                        instrumentId: instrument.id,
                        timeframeId: timeframe.id
                    }
                });
                totalCandles[timeframe.name] = count;
            }
            const lastTick = await database_1.db.tickData.findFirst({
                where: { instrumentId: instrument.id },
                orderBy: { timestamp: 'desc' }
            });
            return {
                totalTicks,
                totalCandles,
                lastUpdate: lastTick?.timestamp || null
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get instrument stats:', error);
            throw error;
        }
    }
}
exports.EnhancedMarketDataService = EnhancedMarketDataService;
//# sourceMappingURL=enhanced-market-data.service.js.map