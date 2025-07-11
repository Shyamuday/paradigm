import { db } from '../database/database';
import { logger } from '../logger/logger';
import { TickData, CandleData, InstrumentConfig } from '../types';

export class MarketDataService {
    async createInstrument(config: InstrumentConfig) {
        try {
            const instrument = await db.instrument.create({
                data: {
                    symbol: config.symbol,
                    name: config.symbol, // Use symbol as name if not provided
                    exchange: config.exchange,
                    instrumentType: config.instrumentType,
                    lotSize: config.lotSize || null,
                    tickSize: config.tickSize || null,
                },
            });

            logger.info('Instrument created:', instrument.symbol);
            return instrument;
        } catch (error) {
            logger.error('Failed to create instrument:', error);
            throw error;
        }
    }

    async getInstrumentBySymbol(symbol: string) {
        try {
            const instrument = await db.instrument.findUnique({
                where: { symbol },
                include: {
                    marketData: {
                        orderBy: { timestamp: 'desc' },
                        take: 100, // Get last 100 records
                    },
                },
            });

            return instrument;
        } catch (error) {
            logger.error('Failed to get instrument by symbol:', error);
            throw error;
        }
    }

    async getAllInstruments() {
        try {
            const instruments = await db.instrument.findMany({
                where: { isActive: true },
                orderBy: { symbol: 'asc' },
            });

            return instruments;
        } catch (error) {
            logger.error('Failed to get all instruments:', error);
            throw error;
        }
    }

    async saveTickData(tickData: TickData) {
        try {
            const instrument = await this.getInstrumentBySymbol(tickData.symbol);
            if (!instrument) {
                logger.warn('Instrument not found for tick data:', tickData.symbol);
                return;
            }

            const marketData = await db.marketData.create({
                data: {
                    instrumentId: instrument.id,
                    timestamp: tickData.timestamp,
                    ltp: tickData.ltp,
                    open: tickData.open,
                    high: tickData.high,
                    low: tickData.low,
                    close: tickData.close,
                    volume: tickData.volume,
                    change: tickData.change,
                    changePercent: tickData.changePercent,
                },
            });

            logger.debug('Tick data saved:', marketData.id);
            return marketData;
        } catch (error) {
            logger.error('Failed to save tick data:', error);
            throw error;
        }
    }

    async saveCandleData(candleData: CandleData) {
        try {
            const instrument = await this.getInstrumentBySymbol(candleData.symbol);
            if (!instrument) {
                logger.warn('Instrument not found for candle data:', candleData.symbol);
                return;
            }

            const marketData = await db.marketData.create({
                data: {
                    instrumentId: instrument.id,
                    timestamp: candleData.timestamp,
                    open: candleData.open,
                    high: candleData.high,
                    low: candleData.low,
                    close: candleData.close,
                    volume: candleData.volume,
                },
            });

            logger.debug('Candle data saved:', marketData.id);
            return marketData;
        } catch (error) {
            logger.error('Failed to save candle data:', error);
            throw error;
        }
    }

    async getLatestMarketData(symbol: string) {
        try {
            const marketData = await db.marketData.findMany({
                where: {
                    instrument: {
                        symbol
                    }
                },
                orderBy: {
                    timestamp: 'desc'
                },
                take: 1,
                include: {
                    instrument: true
                }
            });

            return marketData;
        } catch (error) {
            logger.error('Failed to get latest market data:', error);
            throw error;
        }
    }

    async getPreviousClose(symbol: string): Promise<number> {
        try {
            const previousDay = await db.marketData.findFirst({
                where: {
                    instrument: {
                        symbol
                    },
                    timestamp: {
                        lt: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                },
                orderBy: {
                    timestamp: 'desc'
                }
            });

            if (!previousDay?.close) {
                throw new Error(`No previous close price found for ${symbol}`);
            }

            return previousDay.close;
        } catch (error) {
            logger.error('Failed to get previous close:', error);
            throw error;
        }
    }

    async getCurrentPrice(instrumentId: string): Promise<number> {
        try {
            const latestData = await db.marketData.findFirst({
                where: {
                    instrumentId
                },
                orderBy: {
                    timestamp: 'desc'
                }
            });

            if (!latestData?.ltp && !latestData?.close) {
                throw new Error(`No current price found for instrument ${instrumentId}`);
            }

            return latestData.ltp || latestData.close!;
        } catch (error) {
            logger.error('Failed to get current price:', error);
            throw error;
        }
    }

    async getHistoricalData(symbol: string, from: Date, to: Date) {
        try {
            const instrument = await this.getInstrumentBySymbol(symbol);
            if (!instrument) {
                return [];
            }

            const historicalData = await db.marketData.findMany({
                where: {
                    instrumentId: instrument.id,
                    timestamp: {
                        gte: from,
                        lte: to,
                    },
                },
                orderBy: { timestamp: 'asc' },
            });

            return historicalData;
        } catch (error) {
            logger.error('Failed to get historical data:', error);
            throw error;
        }
    }

    async getInstrumentsByExchange(exchange: string) {
        try {
            const instruments = await db.instrument.findMany({
                where: {
                    exchange,
                    isActive: true,
                },
                orderBy: { symbol: 'asc' },
            });

            return instruments;
        } catch (error) {
            logger.error('Failed to get instruments by exchange:', error);
            throw error;
        }
    }

    async updateInstrument(symbol: string, updates: Partial<InstrumentConfig>) {
        try {
            const instrument = await db.instrument.update({
                where: { symbol },
                data: updates,
            });

            logger.info('Instrument updated:', instrument.symbol);
            return instrument;
        } catch (error) {
            logger.error('Failed to update instrument:', error);
            throw error;
        }
    }

    async deactivateInstrument(symbol: string) {
        try {
            const instrument = await db.instrument.update({
                where: { symbol },
                data: { isActive: false },
            });

            logger.info('Instrument deactivated:', instrument.symbol);
            return instrument;
        } catch (error) {
            logger.error('Failed to deactivate instrument:', error);
            throw error;
        }
    }
} 