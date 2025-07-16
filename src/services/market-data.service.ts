import { db } from '../database/database';
import { logger } from '../logger/logger';
import { TickData, CandleData, InstrumentConfig, ZerodhaInstrument } from '../types';
import { InstrumentsManager } from './instruments-manager.service';
import { KiteConnect } from 'kiteconnect';
import { WebSocketManager } from './websocket-manager.service';
import { MockDataGenerator } from '../database/mock-data';

export class MarketDataService {
    private instrumentsManager: InstrumentsManager;
    private wsManager: WebSocketManager;
    private tickSubscriptions: Map<string, number> = new Map(); // symbol -> instrument_token
    private mockDataInterval: NodeJS.Timeout | null = null;

    constructor(instrumentsManager: InstrumentsManager, private kite: KiteConnect) {
        this.instrumentsManager = instrumentsManager;
        this.wsManager = new WebSocketManager(kite);
        this.setupMockDataStream();
    }

    private async setupMockDataStream() {
        try {
            // Simulate WebSocket connection
            logger.info('Setting up mock data stream');

            // Generate mock data every 1 second for subscribed instruments
            this.mockDataInterval = setInterval(async () => {
                for (const [symbol, token] of this.tickSubscriptions.entries()) {
                    try {
                        const instrument = await db.findUnique('Instrument', { where: { symbol } });
                        if (!instrument) continue;

                        const mockData = MockDataGenerator.createMockMarketData(instrument.id, symbol);

                        // Save to database
                        await db.create('MarketData', mockData);

                        // Emit mock tick data
                        this.wsManager.emit('ticks', [{
                            instrumentToken: token,
                            lastPrice: mockData.ltp || 0,
                            openPrice: mockData.open || 0,
                            highPrice: mockData.high || 0,
                            lowPrice: mockData.low || 0,
                            closePrice: mockData.close || 0,
                            volume: mockData.volume || 0
                        }]);
                    } catch (error) {
                        logger.error(`Error generating mock data for ${symbol}:`, error);
                    }
                }
            }, 1000);

            logger.info('Mock data stream setup completed');
        } catch (error) {
            logger.error('Failed to setup mock data stream:', error);
            throw error;
        }
    }

    async subscribeToSymbol(symbol: string) {
        try {
            // Get or create instrument
            let instrument = await db.findUnique('Instrument', { where: { symbol } });

            if (!instrument) {
                instrument = await db.create('Instrument', MockDataGenerator.createMockInstrument(symbol));
            }

            // Store the subscription with a mock token
            const mockToken = Math.floor(Math.random() * 1000000);
            this.tickSubscriptions.set(symbol, mockToken);

            logger.info(`Subscribed to ${symbol} (${mockToken})`);
            return true;
        } catch (error) {
            logger.error(`Failed to subscribe to ${symbol}:`, error);
            throw error;
        }
    }

    async unsubscribeFromSymbol(symbol: string) {
        try {
            if (!this.tickSubscriptions.has(symbol)) {
                logger.warn(`No subscription found for ${symbol}`);
                return;
            }

            this.tickSubscriptions.delete(symbol);
            logger.info(`Unsubscribed from ${symbol}`);
        } catch (error) {
            logger.error(`Failed to unsubscribe from ${symbol}:`, error);
            throw error;
        }
    }

    async createInstrument(config: InstrumentConfig & { isActive?: boolean }) {
        try {
            const instrument = await db.create('Instrument', {
                ...MockDataGenerator.createMockInstrument(config.symbol),
                ...config,
                isActive: config.isActive ?? true
            });

            // Subscribe to mock data if it's an active instrument
            if (instrument.isActive) {
                await this.subscribeToSymbol(instrument.symbol);
            }

            logger.info('Instrument created:', instrument.symbol);
            return instrument;
        } catch (error) {
            logger.error('Failed to create instrument:', error);
            throw error;
        }
    }

    async getInstrumentBySymbol(symbol: string) {
        try {
            const instrument = await db.findUnique('Instrument', {
                where: { symbol }
            });

            if (instrument) {
                const marketData = await db.findMany('MarketData', {
                    where: { instrumentId: instrument.id },
                    orderBy: { timestamp: 'desc' },
                    limit: 100
                });

                return { ...instrument, marketData };
            }

            return null;
        } catch (error) {
            logger.error('Failed to get instrument by symbol:', error);
            throw error;
        }
    }

    async getAllInstruments() {
        try {
            return await db.findMany('Instrument', {
                where: { isActive: true }
            });
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

            const marketData = await db.create('MarketData', {
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

            const marketData = await db.create('MarketData', {
                instrumentId: instrument.id,
                timestamp: candleData.timestamp,
                open: candleData.open,
                high: candleData.high,
                low: candleData.low,
                close: candleData.close,
                volume: candleData.volume,
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
            // First try to get real-time data if subscribed
            const token = this.tickSubscriptions.get(symbol);
            if (token) {
                try {
                    const quotes = await (this.kite as any).getQuote([token.toString()]);
                    if (quotes && quotes[token]) {
                        const data = quotes[token];
                        return [{
                            timestamp: new Date(),
                            ltp: data.last_price,
                            open: data.ohlc.open,
                            high: data.ohlc.high,
                            low: data.ohlc.low,
                            close: data.ohlc.close,
                            volume: data.volume,
                            instrument: await this.getInstrumentBySymbol(symbol)
                        }];
                    }
                } catch (error) {
                    logger.warn('Failed to get real-time quote, falling back to database:', error);
                }
            }

            // Fallback to database
            const marketData = await db.findMany('MarketData', {
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
            // Try to get from Kite first
            const token = this.tickSubscriptions.get(symbol);
            if (token) {
                try {
                    const quotes = await (this.kite as any).getQuote([token.toString()]);
                    if (quotes && quotes[token] && quotes[token].ohlc.close) {
                        return quotes[token].ohlc.close;
                    }
                } catch (error) {
                    logger.warn('Failed to get quote for previous close, falling back to database:', error);
                }
            }

            // Fallback to database
            const previousDay = await db.findMany('MarketData', {
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
                },
                take: 1
            });

            if (previousDay.length === 0 || !previousDay[0]?.close) {
                throw new Error(`No previous close price found for ${symbol}`);
            }

            return previousDay[0].close;
        } catch (error) {
            logger.error('Failed to get previous close:', error);
            throw error;
        }
    }

    async getHistoricalData(symbol: string, from: Date, to: Date) {
        try {
            const instrument = await db.findUnique('Instrument', { where: { symbol } });
            if (!instrument) {
                throw new Error(`Instrument not found: ${symbol}`);
            }

            // Fallback to database
            const marketData = await db.findMany('MarketData', {
                where: {
                    instrumentId: instrument.id,
                    timestamp: {
                        gte: from,
                        lte: to
                    }
                },
                orderBy: { timestamp: 'desc' }
            });

            return marketData;
        } catch (error) {
            logger.error('Failed to get historical data:', error);
            throw error;
        }
    }

    async getPreviousDayClose(symbol: string): Promise<number | null> {
        try {
            const instrument = await db.findUnique('Instrument', { where: { symbol } });
            if (!instrument) {
                throw new Error(`Instrument not found: ${symbol}`);
            }

            // Get yesterday's date
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);

            // Fallback to database
            const previousDayData = await db.findMany('MarketData', {
                where: {
                    instrumentId: instrument.id,
                    timestamp: {
                        gte: yesterday
                    }
                },
                orderBy: { timestamp: 'desc' },
                limit: 1
            });

            return previousDayData[0]?.close || null;
        } catch (error) {
            logger.error('Failed to get previous day close:', error);
            return null;
        }
    }

    async getCurrentPrice(instrumentId: string): Promise<number> {
        try {
            const instrument = await db.findUnique('Instrument', {
                where: { id: instrumentId }
            });

            if (!instrument) {
                throw new Error(`Instrument not found: ${instrumentId}`);
            }

            // Fallback to database
            const latestData = await db.findMany('MarketData', {
                where: { instrumentId },
                orderBy: { timestamp: 'desc' },
                limit: 1
            });

            if (latestData.length === 0) {
                throw new Error(`No price data found for instrument: ${instrumentId}`);
            }

            return latestData[0].ltp || latestData[0].close || 0;
        } catch (error) {
            logger.error('Failed to get current price:', error);
            throw error;
        }
    }

    async getInstrumentsByExchange(exchange: string) {
        try {
            const instruments = await db.findMany('Instrument', {
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

    async updateInstrument(symbol: string, updates: Partial<InstrumentConfig & { isActive?: boolean }>) {
        try {
            const instrument = await db.update('Instrument',
                { symbol },
                updates
            );

            // If isActive status changed, handle subscriptions
            if (updates.isActive !== undefined) {
                if (updates.isActive) {
                    await this.subscribeToSymbol(symbol);
                } else {
                    await this.unsubscribeFromSymbol(symbol);
                }
            }

            logger.info('Instrument updated:', instrument.symbol);
            return instrument;
        } catch (error) {
            logger.error('Failed to update instrument:', error);
            throw error;
        }
    }

    async deactivateInstrument(symbol: string) {
        try {
            await this.unsubscribeFromSymbol(symbol);

            const instrument = await db.update('Instrument',
                { symbol },
                { isActive: false }
            );

            logger.info('Instrument deactivated:', instrument.symbol);
            return instrument;
        } catch (error) {
            logger.error('Failed to deactivate instrument:', error);
            throw error;
        }
    }

    // Cleanup method
    cleanup() {
        if (this.mockDataInterval) {
            clearInterval(this.mockDataInterval);
            this.mockDataInterval = null;
        }
        this.tickSubscriptions.clear();
    }
} 