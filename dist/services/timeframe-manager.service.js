"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeframeManagerService = void 0;
const database_1 = require("../database/database");
const logger_1 = require("../logger/logger");
class TimeframeManagerService {
    constructor() {
        this.initializeTimeframes();
    }
    async initializeTimeframes() {
        try {
            for (const timeframe of TimeframeManagerService.DEFAULT_TIMEFRAMES) {
                await this.createTimeframeIfNotExists(timeframe);
            }
            logger_1.logger.info('Timeframes initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize timeframes:', error);
        }
    }
    async createTimeframeIfNotExists(timeframe) {
        try {
            const existing = await database_1.db.timeframeConfig.findUnique({
                where: { name: timeframe.name }
            });
            if (!existing) {
                await database_1.db.timeframeConfig.create({
                    data: {
                        name: timeframe.name,
                        description: timeframe.description,
                        intervalMinutes: timeframe.minutes,
                        isActive: true
                    }
                });
                logger_1.logger.info(`Created timeframe: ${timeframe.name}`);
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to create timeframe ${timeframe.name}:`, error);
        }
    }
    async getActiveTimeframes() {
        try {
            return await database_1.db.timeframeConfig.findMany({
                where: { isActive: true },
                orderBy: { intervalMinutes: 'asc' }
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get active timeframes:', error);
            throw error;
        }
    }
    async getTimeframeByName(name) {
        try {
            return await database_1.db.timeframeConfig.findUnique({
                where: { name }
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to get timeframe ${name}:`, error);
            throw error;
        }
    }
    async saveTickData(tickData) {
        try {
            const savedTick = await database_1.db.tickData.create({
                data: {
                    instrumentId: tickData.instrumentId,
                    timestamp: tickData.timestamp,
                    ltp: tickData.ltp,
                    volume: tickData.volume,
                    change: tickData.change,
                    changePercent: tickData.changePercent
                },
                include: {
                    instrument: true
                }
            });
            logger_1.logger.debug(`Tick data saved for instrument ${tickData.instrumentId}`);
            return savedTick;
        }
        catch (error) {
            logger_1.logger.error('Failed to save tick data:', error);
            throw error;
        }
    }
    async aggregateToCandles(instrumentId, timeframeName, fromTime, toTime) {
        try {
            const timeframe = await this.getTimeframeByName(timeframeName);
            if (!timeframe) {
                throw new Error(`Timeframe ${timeframeName} not found`);
            }
            const tickData = await database_1.db.tickData.findMany({
                where: {
                    instrumentId,
                    timestamp: {
                        gte: fromTime,
                        lte: toTime
                    }
                },
                orderBy: { timestamp: 'asc' }
            });
            if (tickData.length === 0) {
                return [];
            }
            const candles = this.groupTicksIntoCandles(tickData, timeframe.intervalMinutes);
            const savedCandles = [];
            for (const candle of candles) {
                const savedCandle = await this.saveCandleData({
                    ...candle,
                    timeframeId: timeframe.id
                });
                savedCandles.push(savedCandle);
            }
            logger_1.logger.info(`Aggregated ${tickData.length} ticks into ${savedCandles.length} candles for ${timeframeName}`);
            return savedCandles;
        }
        catch (error) {
            logger_1.logger.error('Failed to aggregate to candles:', error);
            throw error;
        }
    }
    groupTicksIntoCandles(tickData, intervalMinutes) {
        const candles = [];
        const intervalMs = intervalMinutes * 60 * 1000;
        let currentCandle = null;
        let intervalStart = 0;
        for (const tick of tickData) {
            const tickTime = new Date(tick.timestamp).getTime();
            const intervalStartTime = Math.floor(tickTime / intervalMs) * intervalMs;
            if (intervalStartTime !== intervalStart || !currentCandle) {
                if (currentCandle) {
                    candles.push(currentCandle);
                }
                intervalStart = intervalStartTime;
                currentCandle = {
                    instrumentId: tick.instrumentId,
                    timestamp: new Date(intervalStartTime),
                    open: tick.ltp,
                    high: tick.ltp,
                    low: tick.ltp,
                    close: tick.ltp,
                    volume: tick.volume,
                    typicalPrice: (tick.ltp + tick.ltp + tick.ltp) / 3,
                    weightedPrice: (tick.ltp + tick.ltp + tick.ltp + tick.ltp) / 4,
                    priceChange: 0,
                    priceChangePercent: 0,
                    upperShadow: 0,
                    lowerShadow: 0,
                    bodySize: 0,
                    totalRange: 0
                };
            }
            else {
                currentCandle.high = Math.max(currentCandle.high, tick.ltp);
                currentCandle.low = Math.min(currentCandle.low, tick.ltp);
                currentCandle.close = tick.ltp;
                currentCandle.volume += tick.volume;
                currentCandle.typicalPrice = (currentCandle.high + currentCandle.low + currentCandle.close) / 3;
                currentCandle.weightedPrice = (currentCandle.high + currentCandle.low + currentCandle.close + currentCandle.close) / 4;
                currentCandle.priceChange = currentCandle.close - currentCandle.open;
                currentCandle.priceChangePercent = ((currentCandle.close - currentCandle.open) / currentCandle.open) * 100;
                currentCandle.upperShadow = currentCandle.high - Math.max(currentCandle.open, currentCandle.close);
                currentCandle.lowerShadow = Math.min(currentCandle.open, currentCandle.close) - currentCandle.low;
                currentCandle.bodySize = Math.abs(currentCandle.close - currentCandle.open);
                currentCandle.totalRange = currentCandle.high - currentCandle.low;
            }
        }
        if (currentCandle) {
            candles.push(currentCandle);
        }
        return candles;
    }
    async saveCandleData(candleData) {
        try {
            const savedCandle = await database_1.db.candleData.create({
                data: {
                    instrumentId: candleData.instrumentId,
                    timeframeId: candleData.timeframeId,
                    timestamp: candleData.timestamp,
                    open: candleData.open,
                    high: candleData.high,
                    low: candleData.low,
                    close: candleData.close,
                    volume: candleData.volume,
                    typicalPrice: candleData.typicalPrice,
                    weightedPrice: candleData.weightedPrice,
                    priceChange: candleData.priceChange,
                    priceChangePercent: candleData.priceChangePercent,
                    upperShadow: candleData.upperShadow,
                    lowerShadow: candleData.lowerShadow,
                    bodySize: candleData.bodySize,
                    totalRange: candleData.totalRange
                },
                include: {
                    instrument: true,
                    timeframe: true
                }
            });
            return savedCandle;
        }
        catch (error) {
            logger_1.logger.error('Failed to save candle data:', error);
            throw error;
        }
    }
    async getCandleData(request) {
        try {
            const timeframe = await this.getTimeframeByName(request.timeframe);
            if (!timeframe) {
                throw new Error(`Timeframe ${request.timeframe} not found`);
            }
            const instrument = await database_1.db.instrument.findUnique({
                where: { symbol: request.symbol }
            });
            if (!instrument) {
                throw new Error(`Instrument ${request.symbol} not found`);
            }
            const candles = await database_1.db.candleData.findMany({
                where: {
                    instrumentId: instrument.id,
                    timeframeId: timeframe.id,
                    timestamp: {
                        gte: request.from,
                        lte: request.to
                    }
                },
                orderBy: { timestamp: 'desc' },
                take: request.limit || 100,
                include: {
                    instrument: true,
                    timeframe: true
                }
            });
            const totalCount = await database_1.db.candleData.count({
                where: {
                    instrumentId: instrument.id,
                    timeframeId: timeframe.id,
                    timestamp: {
                        gte: request.from,
                        lte: request.to
                    }
                }
            });
            return {
                symbol: request.symbol,
                timeframe: request.timeframe,
                candles,
                totalCount,
                hasMore: totalCount > (request.limit || 100)
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get candle data:', error);
            throw error;
        }
    }
    async getLatestCandle(symbol, timeframe) {
        try {
            const timeframeConfig = await this.getTimeframeByName(timeframe);
            if (!timeframeConfig) {
                throw new Error(`Timeframe ${timeframe} not found`);
            }
            const instrument = await database_1.db.instrument.findUnique({
                where: { symbol }
            });
            if (!instrument) {
                return null;
            }
            return await database_1.db.candleData.findFirst({
                where: {
                    instrumentId: instrument.id,
                    timeframeId: timeframeConfig.id
                },
                orderBy: { timestamp: 'desc' },
                include: {
                    instrument: true,
                    timeframe: true
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get latest candle:', error);
            throw error;
        }
    }
    async cleanupOldTickData(retentionDays = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
            const result = await database_1.db.tickData.deleteMany({
                where: {
                    timestamp: {
                        lt: cutoffDate
                    }
                }
            });
            logger_1.logger.info(`Cleaned up ${result.count} old tick data records`);
            return result.count;
        }
        catch (error) {
            logger_1.logger.error('Failed to cleanup old tick data:', error);
            throw error;
        }
    }
    async getVolumeProfile(symbol, timeframe, date) {
        try {
            const timeframeConfig = await this.getTimeframeByName(timeframe);
            if (!timeframeConfig) {
                throw new Error(`Timeframe ${timeframe} not found`);
            }
            const instrument = await database_1.db.instrument.findUnique({
                where: { symbol }
            });
            if (!instrument) {
                return [];
            }
            return await database_1.db.volumeProfile.findMany({
                where: {
                    instrumentId: instrument.id,
                    timeframeId: timeframeConfig.id,
                    date: {
                        gte: new Date(date.setHours(0, 0, 0, 0)),
                        lt: new Date(date.setHours(23, 59, 59, 999))
                    }
                },
                orderBy: { volume: 'desc' },
                include: {
                    instrument: true,
                    timeframe: true
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get volume profile:', error);
            throw error;
        }
    }
}
exports.TimeframeManagerService = TimeframeManagerService;
TimeframeManagerService.DEFAULT_TIMEFRAMES = [
    { name: '1min', minutes: 1, description: '1 Minute' },
    { name: '3min', minutes: 3, description: '3 Minutes' },
    { name: '5min', minutes: 5, description: '5 Minutes' },
    { name: '15min', minutes: 15, description: '15 Minutes' },
    { name: '30min', minutes: 30, description: '30 Minutes' },
    { name: '1hour', minutes: 60, description: '1 Hour' },
    { name: '1day', minutes: 1440, description: '1 Day' }
];
//# sourceMappingURL=timeframe-manager.service.js.map