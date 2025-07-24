import { db } from '../database/database';
import { logger } from '../logger/logger';
import {
    TimeframeConfig,
    MultiTimeframeCandleData,
    TickDataPoint,
    TimeframeInterval,
    CandleAggregationRequest,
    CandleAggregationResult
} from '../types';
import { Instrument } from '../types';

export class TimeframeManagerService {
    private static readonly DEFAULT_TIMEFRAMES: TimeframeInterval[] = [
        { name: '1min', minutes: 1, description: '1 Minute' },
        { name: '3min', minutes: 3, description: '3 Minutes' },
        { name: '5min', minutes: 5, description: '5 Minutes' },
        { name: '15min', minutes: 15, description: '15 Minutes' },
        { name: '30min', minutes: 30, description: '30 Minutes' },
        { name: '1hour', minutes: 60, description: '1 Hour' },
        { name: '1day', minutes: 1440, description: '1 Day' }
    ];

    constructor() {
        this.initializeTimeframes();
    }

    /**
     * Initialize default timeframes in the database
     */
    private async initializeTimeframes(): Promise<void> {
        try {
            for (const timeframe of TimeframeManagerService.DEFAULT_TIMEFRAMES) {
                await this.createTimeframeIfNotExists(timeframe);
            }
            logger.info('Timeframes initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize timeframes:', error);
        }
    }

    /**
     * Create a timeframe configuration if it doesn't exist
     */
    private async createTimeframeIfNotExists(timeframe: TimeframeInterval): Promise<void> {
        try {
            const existing = await db.timeframeConfig.findUnique({
                where: { name: timeframe.name }
            });

            if (!existing) {
                await db.timeframeConfig.create({
                    data: {
                        name: timeframe.name,
                        description: timeframe.description,
                        intervalMinutes: timeframe.minutes,
                        isActive: true
                    }
                });
                logger.info(`Created timeframe: ${timeframe.name}`);
            }
        } catch (error) {
            logger.error(`Failed to create timeframe ${timeframe.name}:`, error);
        }
    }

    /**
     * Get all active timeframes
     */
    async getActiveTimeframes(): Promise<TimeframeConfig[]> {
        try {
            return await db.timeframeConfig.findMany({
                where: { isActive: true },
                orderBy: { intervalMinutes: 'asc' }
            });
        } catch (error) {
            logger.error('Failed to get active timeframes:', error);
            throw error;
        }
    }

    /**
     * Get timeframe by name
     */
    async getTimeframeByName(name: string): Promise<TimeframeConfig | null> {
        try {
            return await db.timeframeConfig.findUnique({
                where: { name }
            });
        } catch (error) {
            logger.error(`Failed to get timeframe ${name}:`, error);
            throw error;
        }
    }

    /**
     * Save tick data for real-time processing
     */
    async saveTickData(tickData: Omit<TickDataPoint, 'id'>): Promise<TickDataPoint> {
        try {
            const savedTick = await db.tickData.create({
                data: {
                    instrumentId: tickData.instrumentId,
                    timestamp: tickData.timestamp,
                    ltp: tickData.ltp,
                    volume: tickData.volume,
                    change: tickData.change ?? 0,
                    changePercent: tickData.changePercent ?? 0
                },
                include: {
                    instrument: true
                }
            });
            logger.debug(`Tick data saved for instrument ${tickData.instrumentId}`);
            const instrument = { ...savedTick.instrument, lotSize: savedTick.instrument.lotSize ?? 0, tickSize: savedTick.instrument.tickSize ?? 0 };
            return { ...savedTick, instrument } as TickDataPoint;
        } catch (error) {
            logger.error('Failed to save tick data:', error);
            throw error;
        }
    }

    /**
     * Aggregate tick data into candles for a specific timeframe
     */
    async aggregateToCandles(
        instrumentId: string,
        timeframeName: string,
        fromTime: Date,
        toTime: Date
    ): Promise<MultiTimeframeCandleData[]> {
        try {
            const timeframe = await this.getTimeframeByName(timeframeName);
            if (!timeframe) {
                throw new Error(`Timeframe ${timeframeName} not found`);
            }

            // Get tick data for the time period
            const tickData = await db.tickData.findMany({
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

            // Group ticks by timeframe intervals
            const candles = this.groupTicksIntoCandles(tickData, timeframe.intervalMinutes);

            // Save candles to database
            const savedCandles: MultiTimeframeCandleData[] = [];
            for (const candle of candles) {
                const savedCandle = await this.saveCandleData({
                    ...candle,
                    timeframeId: timeframe.id
                });
                savedCandles.push(savedCandle);
            }

            logger.info(`Aggregated ${tickData.length} ticks into ${savedCandles.length} candles for ${timeframeName}`);
            // Fix lotSize/tickSize for all returned elements
            return savedCandles.map(c => {
                // Create a proper Instrument object that matches the interface
                const instrument: Instrument = {
                    id: c.instrument.id,
                    symbol: c.instrument.symbol,
                    name: c.instrument.name,
                    exchange: c.instrument.exchange,
                    instrumentType: c.instrument.instrumentType,
                    lotSize: Number(c.instrument.lotSize ?? 1),
                    tickSize: Number(c.instrument.tickSize ?? 0.01),
                    isActive: c.instrument.isActive,
                    createdAt: c.instrument.createdAt,
                    updatedAt: c.instrument.updatedAt
                };
                return { ...c, instrument } as MultiTimeframeCandleData;
            });
        } catch (error) {
            logger.error('Failed to aggregate to candles:', error);
            throw error;
        }
    }

    /**
     * Group tick data into candles based on timeframe interval
     */
    private groupTicksIntoCandles(tickData: any[], intervalMinutes: number): any[] {
        const candles: any[] = [];
        const intervalMs = intervalMinutes * 60 * 1000;

        let currentCandle: any = null;
        let intervalStart: number = 0;

        for (const tick of tickData) {
            const tickTime = new Date(tick.timestamp).getTime();

            // Calculate interval start time
            const intervalStartTime = Math.floor(tickTime / intervalMs) * intervalMs;

            if (intervalStartTime !== intervalStart || !currentCandle) {
                // Save previous candle if exists
                if (currentCandle) {
                    candles.push(currentCandle);
                }

                // Start new candle
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
            } else {
                // Update current candle
                currentCandle.high = Math.max(currentCandle.high, tick.ltp);
                currentCandle.low = Math.min(currentCandle.low, tick.ltp);
                currentCandle.close = tick.ltp;
                currentCandle.volume += tick.volume;

                // Recalculate derived values
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

        // Add the last candle
        if (currentCandle) {
            candles.push(currentCandle);
        }

        return candles;
    }

    /**
     * Save candle data to database
     */
    private async saveCandleData(candleData: any): Promise<MultiTimeframeCandleData> {
        try {
            const savedCandle = await db.candleData.create({
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
            const instrument = {
                ...savedCandle.instrument,
                lotSize: Number(savedCandle.instrument.lotSize) || 0,
                tickSize: Number(savedCandle.instrument.tickSize) || 0
            };
            return { ...savedCandle, instrument } as MultiTimeframeCandleData;
        } catch (error) {
            logger.error('Failed to save candle data:', error);
            throw error;
        }
    }

    /**
     * Get candle data for a specific timeframe
     */
    async getCandleData(request: CandleAggregationRequest): Promise<CandleAggregationResult> {
        try {
            const timeframe = await this.getTimeframeByName(request.timeframe);
            if (!timeframe) {
                throw new Error(`Timeframe ${request.timeframe} not found`);
            }

            const instrument = await db.instrument.findUnique({
                where: { symbol: request.symbol }
            });

            if (!instrument) {
                throw new Error(`Instrument ${request.symbol} not found`);
            }

            const candles = await db.candleData.findMany({
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

            const totalCount = await db.candleData.count({
                where: {
                    instrumentId: instrument.id,
                    timeframeId: timeframe.id,
                    timestamp: {
                        gte: request.from,
                        lte: request.to
                    }
                }
            });

            // Fix lotSize/tickSize for all candles
            const fixedCandles = candles.map(c => {
                const fixedInstrument = {
                    ...c.instrument,
                    lotSize: Number(c.instrument.lotSize) || 0,
                    tickSize: Number(c.instrument.tickSize) || 0
                };
                return { ...c, instrument: fixedInstrument } as MultiTimeframeCandleData;
            });

            return {
                symbol: request.symbol,
                timeframe: request.timeframe,
                candles: fixedCandles,
                totalCount,
                hasMore: totalCount > (request.limit || 100)
            };
        } catch (error) {
            logger.error('Failed to get candle data:', error);
            throw error;
        }
    }

    /**
     * Get latest candle for a symbol and timeframe
     */
    async getLatestCandle(symbol: string, timeframe: string): Promise<MultiTimeframeCandleData | null> {
        try {
            const timeframeConfig = await this.getTimeframeByName(timeframe);
            if (!timeframeConfig) {
                throw new Error(`Timeframe ${timeframe} not found`);
            }

            const instrument = await db.instrument.findUnique({
                where: { symbol }
            });

            if (!instrument) {
                return null;
            }

            const savedCandle = await db.candleData.findFirst({
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

            if (!savedCandle) return null;
            const fixedInstrument = {
                ...savedCandle.instrument,
                lotSize: Number(savedCandle.instrument.lotSize) || 0,
                tickSize: Number(savedCandle.instrument.tickSize) || 0
            };
            return { ...savedCandle, instrument: fixedInstrument } as MultiTimeframeCandleData;
        } catch (error) {
            logger.error('Failed to get latest candle:', error);
            throw error;
        }
    }

    /**
     * Clean up old tick data (keep only recent data for performance)
     */
    async cleanupOldTickData(retentionDays: number = 7): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            const result = await db.tickData.deleteMany({
                where: {
                    timestamp: {
                        lt: cutoffDate
                    }
                }
            });

            logger.info(`Cleaned up ${result.count} old tick data records`);
            return result.count;
        } catch (error) {
            logger.error('Failed to cleanup old tick data:', error);
            throw error;
        }
    }

    /**
     * Get volume profile for a specific date and timeframe
     */
    async getVolumeProfile(symbol: string, timeframe: string, date: Date): Promise<any[]> {
        try {
            const timeframeConfig = await this.getTimeframeByName(timeframe);
            if (!timeframeConfig) {
                throw new Error(`Timeframe ${timeframe} not found`);
            }

            const instrument = await db.instrument.findUnique({
                where: { symbol }
            });

            if (!instrument) {
                return [];
            }

            return await db.volumeProfile.findMany({
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
        } catch (error) {
            logger.error('Failed to get volume profile:', error);
            throw error;
        }
    }

    // Stub for getHistoricalData
    async getHistoricalData(symbol: string, timeframe: string, startDate: Date, endDate: Date): Promise<any[]> {
        // Return mock data for testing
        return [
            { symbol, timestamp: startDate, open: 100, high: 110, low: 90, close: 105, volume: 1000 }
        ];
    }
} 