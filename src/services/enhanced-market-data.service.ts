import { db } from '../database/database';
import { logger } from '../logger/logger';
import { TimeframeManagerService } from './timeframe-manager.service';
import {
    TickData,
    CandleData,
    InstrumentConfig,
    MultiTimeframeCandleData,
    CandleAggregationRequest,
    CandleAggregationResult,
    TimeframeConfig
} from '../types';

export class EnhancedMarketDataService {
    private timeframeManager: TimeframeManagerService;

    constructor() {
        this.timeframeManager = new TimeframeManagerService();
    }

    /**
     * Save tick data and automatically aggregate to all timeframes
     */
    async saveTickDataAndAggregate(tickData: TickData): Promise<void> {
        try {
            // Get or create instrument
            const instrument = await this.getOrCreateInstrument({
                symbol: tickData.symbol,
                exchange: 'NSE', // Default exchange
                instrumentType: 'EQ'
            });

            // Save tick data
            await this.timeframeManager.saveTickData({
                instrumentId: instrument.id,
                timestamp: tickData.timestamp,
                ltp: tickData.ltp,
                volume: tickData.volume,
                change: tickData.change,
                changePercent: tickData.changePercent
            });

            // Get all active timeframes
            const timeframes = await this.timeframeManager.getActiveTimeframes();

            // Aggregate to each timeframe
            for (const timeframe of timeframes) {
                await this.aggregateToTimeframe(instrument.id, timeframe.name, tickData.timestamp);
            }

            logger.debug(`Processed tick data for ${tickData.symbol} across ${timeframes.length} timeframes`);
        } catch (error) {
            logger.error('Failed to save tick data and aggregate:', error);
            throw error;
        }
    }

    /**
     * Aggregate data to a specific timeframe
     */
    private async aggregateToTimeframe(instrumentId: string, timeframeName: string, currentTime: Date): Promise<void> {
        try {
            const timeframe = await this.timeframeManager.getTimeframeByName(timeframeName);
            if (!timeframe) {
                logger.warn(`Timeframe ${timeframeName} not found`);
                return;
            }

            // Calculate the time window for aggregation
            const intervalMs = timeframe.intervalMinutes * 60 * 1000;
            const currentIntervalStart = Math.floor(currentTime.getTime() / intervalMs) * intervalMs;
            const fromTime = new Date(currentIntervalStart);
            const toTime = new Date(currentIntervalStart + intervalMs);

            // Check if we already have a candle for this interval
            const existingCandle = await db.candleData.findFirst({
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
                // Update existing candle with new tick data
                await this.updateExistingCandle(existingCandle.id, currentTime, timeframe.intervalMinutes);
            } else {
                // Create new candle
                await this.timeframeManager.aggregateToCandles(instrumentId, timeframeName, fromTime, toTime);
            }
        } catch (error) {
            logger.error(`Failed to aggregate to timeframe ${timeframeName}:`, error);
        }
    }

    /**
     * Update existing candle with new tick data
     */
    private async updateExistingCandle(candleId: string, currentTime: Date, intervalMinutes: number): Promise<void> {
        try {
            // Get the latest tick data for this instrument
            const candle = await db.candleData.findUnique({
                where: { id: candleId },
                include: { instrument: true }
            });

            if (!candle) return;

            // Get latest tick data
            const latestTick = await db.tickData.findFirst({
                where: { instrumentId: candle.instrumentId },
                orderBy: { timestamp: 'desc' }
            });

            if (!latestTick) return;

            // Update candle with new data
            await db.candleData.update({
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
        } catch (error) {
            logger.error('Failed to update existing candle:', error);
        }
    }

    /**
     * Get or create instrument
     */
    private async getOrCreateInstrument(config: InstrumentConfig) {
        try {
            let instrument = await db.instrument.findUnique({
                where: { symbol: config.symbol }
            });

            if (!instrument) {
                instrument = await db.instrument.create({
                    data: {
                        symbol: config.symbol,
                        name: config.symbol,
                        exchange: config.exchange,
                        instrumentType: config.instrumentType,
                        lotSize: config.lotSize || null,
                        tickSize: config.tickSize || null,
                    },
                });
                logger.info('Instrument created:', instrument.symbol);
            }

            return instrument;
        } catch (error) {
            logger.error('Failed to get or create instrument:', error);
            throw error;
        }
    }

    /**
     * Get candle data for multiple timeframes
     */
    async getMultiTimeframeData(
        symbol: string,
        timeframes: string[],
        from: Date,
        to: Date,
        limit: number = 100
    ): Promise<Record<string, MultiTimeframeCandleData[]>> {
        try {
            const result: Record<string, MultiTimeframeCandleData[]> = {};

            for (const timeframe of timeframes) {
                const request: CandleAggregationRequest = {
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
        } catch (error) {
            logger.error('Failed to get multi-timeframe data:', error);
            throw error;
        }
    }

    /**
     * Get latest candles for all timeframes
     */
    async getLatestMultiTimeframeData(symbol: string): Promise<Record<string, MultiTimeframeCandleData | null>> {
        try {
            const timeframes = await this.timeframeManager.getActiveTimeframes();
            const result: Record<string, MultiTimeframeCandleData | null> = {};

            for (const timeframe of timeframes) {
                result[timeframe.name] = await this.timeframeManager.getLatestCandle(symbol, timeframe.name);
            }

            return result;
        } catch (error) {
            logger.error('Failed to get latest multi-timeframe data:', error);
            throw error;
        }
    }

    /**
     * Get historical data with timeframe support
     */
    async getHistoricalData(
        symbol: string,
        timeframe: string,
        from: Date,
        to: Date,
        limit: number = 1000
    ): Promise<CandleAggregationResult> {
        try {
            const request: CandleAggregationRequest = {
                symbol,
                timeframe,
                from,
                to,
                limit
            };

            return await this.timeframeManager.getCandleData(request);
        } catch (error) {
            logger.error('Failed to get historical data:', error);
            throw error;
        }
    }

    /**
     * Get current price from latest tick data
     */
    async getCurrentPrice(symbol: string): Promise<number | null> {
        try {
            const instrument = await db.instrument.findUnique({
                where: { symbol }
            });

            if (!instrument) {
                return null;
            }

            const latestTick = await db.tickData.findFirst({
                where: { instrumentId: instrument.id },
                orderBy: { timestamp: 'desc' }
            });

            return latestTick?.ltp || null;
        } catch (error) {
            logger.error('Failed to get current price:', error);
            throw error;
        }
    }

    /**
     * Get price change information
     */
    async getPriceChange(symbol: string, timeframe: string = '1day'): Promise<{
        change: number;
        changePercent: number;
        open: number;
        close: number;
    } | null> {
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
        } catch (error) {
            logger.error('Failed to get price change:', error);
            throw error;
        }
    }

    /**
     * Get volume profile for analysis
     */
    async getVolumeProfile(symbol: string, timeframe: string, date: Date): Promise<any[]> {
        try {
            return await this.timeframeManager.getVolumeProfile(symbol, timeframe, date);
        } catch (error) {
            logger.error('Failed to get volume profile:', error);
            throw error;
        }
    }

    /**
     * Clean up old data for performance
     */
    async cleanupOldData(): Promise<void> {
        try {
            // Clean up old tick data (keep 7 days)
            await this.timeframeManager.cleanupOldTickData(7);

            // Clean up old candle data (keep 90 days for daily, 30 days for hourly, 7 days for others)
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 90);

            await db.candleData.deleteMany({
                where: {
                    timestamp: {
                        lt: cutoffDate
                    },
                    timeframe: {
                        name: '1day'
                    }
                }
            });

            logger.info('Old data cleanup completed');
        } catch (error) {
            logger.error('Failed to cleanup old data:', error);
            throw error;
        }
    }

    /**
     * Get all available timeframes
     */
    async getAvailableTimeframes(): Promise<TimeframeConfig[]> {
        try {
            return await this.timeframeManager.getActiveTimeframes();
        } catch (error) {
            logger.error('Failed to get available timeframes:', error);
            throw error;
        }
    }

    /**
     * Get instrument statistics
     */
    async getInstrumentStats(symbol: string): Promise<{
        totalTicks: number;
        totalCandles: Record<string, number>;
        lastUpdate: Date | null;
    }> {
        try {
            const instrument = await db.instrument.findUnique({
                where: { symbol }
            });

            if (!instrument) {
                throw new Error(`Instrument ${symbol} not found`);
            }

            const totalTicks = await db.tickData.count({
                where: { instrumentId: instrument.id }
            });

            const timeframes = await this.timeframeManager.getActiveTimeframes();
            const totalCandles: Record<string, number> = {};

            for (const timeframe of timeframes) {
                const count = await db.candleData.count({
                    where: {
                        instrumentId: instrument.id,
                        timeframeId: timeframe.id
                    }
                });
                totalCandles[timeframe.name] = count;
            }

            const lastTick = await db.tickData.findFirst({
                where: { instrumentId: instrument.id },
                orderBy: { timestamp: 'desc' }
            });

            return {
                totalTicks,
                totalCandles,
                lastUpdate: lastTick?.timestamp || null
            };
        } catch (error) {
            logger.error('Failed to get instrument stats:', error);
            throw error;
        }
    }
} 