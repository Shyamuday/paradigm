import { LiveDataIntegrationService } from '../services/live-data-integration.service';
import { logger } from '../logger/logger';
import { db } from '../database/database';

/**
 * Example showing how to integrate multi-timeframe system with live Zerodha data
 */
async function liveDataIntegrationExample() {
    const liveDataService = new LiveDataIntegrationService();

    try {
        logger.info('Starting live data integration example...');

        // 1. Start live monitoring for symbols
        const symbols = ['NIFTY', 'BANKNIFTY', 'RELIANCE'];
        await liveDataService.startLiveMonitoring(symbols);

        // 2. Simulate incoming live tick data from Zerodha websocket
        logger.info('Simulating live tick data from Zerodha...');

        const simulateLiveTicks = async () => {
            const sampleZerodhaTick = {
                instrument_token: 256265,
                tradingsymbol: 'NIFTY',
                last_price: 19500.50,
                ohlc: {
                    open: 19450.00,
                    high: 19520.00,
                    low: 19430.00
                },
                volume: 1000,
                change: 50.50,
                change_percent: 0.26,
                timestamp: Date.now()
            };

            // Process the live tick data
            await liveDataService.processLiveTickData(sampleZerodhaTick);

            // Get real-time multi-timeframe data
            const realTimeData = await liveDataService.getRealTimeMultiTimeframeData('NIFTY');

            logger.info('Real-time multi-timeframe data:');
            for (const [timeframe, candle] of Object.entries(realTimeData)) {
                if (candle && typeof candle === 'object' && 'close' in candle && 'volume' in candle) {
                    logger.info(`  ${timeframe}: Close=${(candle as any).close}, Volume=${(candle as any).volume}`);
                }
            }
        };

        // Simulate multiple ticks
        for (let i = 0; i < 5; i++) {
            await simulateLiveTicks();
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        }

        // 3. Monitor data quality
        logger.info('Monitoring data quality...');
        const quality = await liveDataService.monitorDataQuality('NIFTY');
        logger.info('Data quality:', quality);

        // 4. Get connection status
        const status = liveDataService.getConnectionStatus();
        logger.info('Connection status:', status);

        logger.info('Live data integration example completed!');

    } catch (error) {
        logger.error('Error in live data integration example:', error);
    } finally {
        // Stop live monitoring
        await liveDataService.stopLiveMonitoring();
    }
}

/**
 * Example showing integration with actual Zerodha websocket
 */
async function zerodhaWebsocketIntegrationExample() {
    const liveDataService = new LiveDataIntegrationService();

    try {
        logger.info('Setting up Zerodha websocket integration...');

        // This would be your actual Zerodha websocket connection
        // For demonstration, we'll show the structure

        // 1. Initialize Zerodha websocket connection
        // const kite = new KiteConnect({
        //   api_key: process.env.ZERODHA_API_KEY,
        //   access_token: process.env.ZERODHA_ACCESS_TOKEN
        // });

        // 2. Set up websocket event handlers
        const setupWebsocketHandlers = () => {
            // Tick data handler
            const onTick = async (ticks: any[]) => {
                for (const tick of ticks) {
                    await liveDataService.processLiveTickData(tick);
                }
            };

            // Candle data handler
            const onCandle = async (candles: any[]) => {
                for (const candle of candles) {
                    await liveDataService.processLiveCandleData(candle);
                }
            };

            // Connection handlers
            const onConnect = () => {
                logger.info('Zerodha websocket connected');
                liveDataService.startLiveMonitoring(['NIFTY', 'BANKNIFTY']);
            };

            const onDisconnect = () => {
                logger.warn('Zerodha websocket disconnected');
                liveDataService.stopLiveMonitoring();
            };

            // Return handlers for use with actual websocket
            return { onTick, onCandle, onConnect, onDisconnect };
        };

        const handlers = setupWebsocketHandlers();
        logger.info('Websocket handlers configured');

        // 3. Subscribe to instruments
        const subscribeToInstruments = async () => {
            const instruments = [
                { instrument_token: 256265, tradingsymbol: 'NIFTY' },
                { instrument_token: 260105, tradingsymbol: 'BANKNIFTY' }
            ];

            // This would be your actual subscription call
            // await kite.subscribe(instruments);
            // await kite.setMode('full', instruments);

            logger.info(`Subscribed to ${instruments.length} instruments`);
        };

        await subscribeToInstruments();

        logger.info('Zerodha websocket integration example completed!');

    } catch (error) {
        logger.error('Error in Zerodha websocket integration:', error);
    }
}

/**
 * Example showing real-time strategy integration
 */
async function realTimeStrategyIntegrationExample() {
    const liveDataService = new LiveDataIntegrationService();

    try {
        logger.info('Setting up real-time strategy integration...');

        // 1. Strategy that uses multi-timeframe data
        class RealTimeMultiTimeframeStrategy {
            async generateSignals(symbol: string): Promise<any[]> {
                try {
                    // Get real-time multi-timeframe data
                    const data = await liveDataService.getRealTimeMultiTimeframeData(symbol);

                    const signals = [];

                    // Example: Simple moving average crossover on 5min and 15min
                    if (data['5min'] && data['15min']) {
                        const fiveMinClose = data['5min'].close;
                        const fifteenMinClose = data['15min'].close;

                        // Simple signal generation logic
                        if (fiveMinClose > fifteenMinClose) {
                            signals.push({
                                symbol,
                                action: 'BUY',
                                timeframe: '5min',
                                price: fiveMinClose,
                                timestamp: new Date()
                            });
                        } else if (fiveMinClose < fifteenMinClose) {
                            signals.push({
                                symbol,
                                action: 'SELL',
                                timeframe: '5min',
                                price: fiveMinClose,
                                timestamp: new Date()
                            });
                        }
                    }

                    return signals;
                } catch (error) {
                    logger.error('Error generating signals:', error);
                    return [];
                }
            }
        }

        // 2. Set up real-time signal generation
        const strategy = new RealTimeMultiTimeframeStrategy();

        const processRealTimeSignals = async (symbol: string) => {
            const signals = await strategy.generateSignals(symbol);

            if (signals.length > 0) {
                logger.info(`Generated ${signals.length} signals for ${symbol}:`, signals);

                // Here you would execute the signals
                // await orderService.executeSignals(signals);
            }
        };

        // 3. Simulate real-time processing
        logger.info('Simulating real-time signal generation...');

        for (let i = 0; i < 3; i++) {
            await processRealTimeSignals('NIFTY');
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        }

        logger.info('Real-time strategy integration example completed!');

    } catch (error) {
        logger.error('Error in real-time strategy integration:', error);
    }
}

/**
 * Main function to run all live data examples
 */
async function runLiveDataExamples() {
    try {
        // Connect to database
        await db.$connect();
        logger.info('Connected to database');

        // Run examples
        await liveDataIntegrationExample();
        await zerodhaWebsocketIntegrationExample();
        await realTimeStrategyIntegrationExample();

        logger.info('All live data examples completed successfully!');

    } catch (error) {
        logger.error('Error running live data examples:', error);
    } finally {
        // Disconnect from database
        await db.$disconnect();
        logger.info('Disconnected from database');
    }
}

// Run the examples if this file is executed directly
if (require.main === module) {
    runLiveDataExamples().catch(console.error);
}

export {
    liveDataIntegrationExample,
    zerodhaWebsocketIntegrationExample,
    realTimeStrategyIntegrationExample,
    runLiveDataExamples
}; 