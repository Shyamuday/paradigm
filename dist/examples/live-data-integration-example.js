"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveDataIntegrationExample = liveDataIntegrationExample;
exports.zerodhaWebsocketIntegrationExample = zerodhaWebsocketIntegrationExample;
exports.realTimeStrategyIntegrationExample = realTimeStrategyIntegrationExample;
exports.runLiveDataExamples = runLiveDataExamples;
const live_data_integration_service_1 = require("../services/live-data-integration.service");
const logger_1 = require("../logger/logger");
const database_1 = require("../database/database");
async function liveDataIntegrationExample() {
    const liveDataService = new live_data_integration_service_1.LiveDataIntegrationService();
    try {
        logger_1.logger.info('Starting live data integration example...');
        const symbols = ['NIFTY', 'BANKNIFTY', 'RELIANCE'];
        await liveDataService.startLiveMonitoring(symbols);
        logger_1.logger.info('Simulating live tick data from Zerodha...');
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
            await liveDataService.processLiveTickData(sampleZerodhaTick);
            const realTimeData = await liveDataService.getRealTimeMultiTimeframeData('NIFTY');
            logger_1.logger.info('Real-time multi-timeframe data:');
            for (const [timeframe, candle] of Object.entries(realTimeData)) {
                if (candle && typeof candle === 'object' && 'close' in candle && 'volume' in candle) {
                    logger_1.logger.info(`  ${timeframe}: Close=${candle.close}, Volume=${candle.volume}`);
                }
            }
        };
        for (let i = 0; i < 5; i++) {
            await simulateLiveTicks();
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        logger_1.logger.info('Monitoring data quality...');
        const quality = await liveDataService.monitorDataQuality('NIFTY');
        logger_1.logger.info('Data quality:', quality);
        const status = liveDataService.getConnectionStatus();
        logger_1.logger.info('Connection status:', status);
        logger_1.logger.info('Live data integration example completed!');
    }
    catch (error) {
        logger_1.logger.error('Error in live data integration example:', error);
    }
    finally {
        await liveDataService.stopLiveMonitoring();
    }
}
async function zerodhaWebsocketIntegrationExample() {
    const liveDataService = new live_data_integration_service_1.LiveDataIntegrationService();
    try {
        logger_1.logger.info('Setting up Zerodha websocket integration...');
        const setupWebsocketHandlers = () => {
            const onTick = async (ticks) => {
                for (const tick of ticks) {
                    await liveDataService.processLiveTickData(tick);
                }
            };
            const onCandle = async (candles) => {
                for (const candle of candles) {
                    await liveDataService.processLiveCandleData(candle);
                }
            };
            const onConnect = () => {
                logger_1.logger.info('Zerodha websocket connected');
                liveDataService.startLiveMonitoring(['NIFTY', 'BANKNIFTY']);
            };
            const onDisconnect = () => {
                logger_1.logger.warn('Zerodha websocket disconnected');
                liveDataService.stopLiveMonitoring();
            };
            return { onTick, onCandle, onConnect, onDisconnect };
        };
        const handlers = setupWebsocketHandlers();
        logger_1.logger.info('Websocket handlers configured');
        const subscribeToInstruments = async () => {
            const instruments = [
                { instrument_token: 256265, tradingsymbol: 'NIFTY' },
                { instrument_token: 260105, tradingsymbol: 'BANKNIFTY' }
            ];
            logger_1.logger.info(`Subscribed to ${instruments.length} instruments`);
        };
        await subscribeToInstruments();
        logger_1.logger.info('Zerodha websocket integration example completed!');
    }
    catch (error) {
        logger_1.logger.error('Error in Zerodha websocket integration:', error);
    }
}
async function realTimeStrategyIntegrationExample() {
    const liveDataService = new live_data_integration_service_1.LiveDataIntegrationService();
    try {
        logger_1.logger.info('Setting up real-time strategy integration...');
        class RealTimeMultiTimeframeStrategy {
            async generateSignals(symbol) {
                try {
                    const data = await liveDataService.getRealTimeMultiTimeframeData(symbol);
                    const signals = [];
                    if (data['5min'] && data['15min']) {
                        const fiveMinClose = data['5min'].close;
                        const fifteenMinClose = data['15min'].close;
                        if (fiveMinClose > fifteenMinClose) {
                            signals.push({
                                symbol,
                                action: 'BUY',
                                timeframe: '5min',
                                price: fiveMinClose,
                                timestamp: new Date()
                            });
                        }
                        else if (fiveMinClose < fifteenMinClose) {
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
                }
                catch (error) {
                    logger_1.logger.error('Error generating signals:', error);
                    return [];
                }
            }
        }
        const strategy = new RealTimeMultiTimeframeStrategy();
        const processRealTimeSignals = async (symbol) => {
            const signals = await strategy.generateSignals(symbol);
            if (signals.length > 0) {
                logger_1.logger.info(`Generated ${signals.length} signals for ${symbol}:`, signals);
            }
        };
        logger_1.logger.info('Simulating real-time signal generation...');
        for (let i = 0; i < 3; i++) {
            await processRealTimeSignals('NIFTY');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        logger_1.logger.info('Real-time strategy integration example completed!');
    }
    catch (error) {
        logger_1.logger.error('Error in real-time strategy integration:', error);
    }
}
async function runLiveDataExamples() {
    try {
        await database_1.db.$connect();
        logger_1.logger.info('Connected to database');
        await liveDataIntegrationExample();
        await zerodhaWebsocketIntegrationExample();
        await realTimeStrategyIntegrationExample();
        logger_1.logger.info('All live data examples completed successfully!');
    }
    catch (error) {
        logger_1.logger.error('Error running live data examples:', error);
    }
    finally {
        await database_1.db.$disconnect();
        logger_1.logger.info('Disconnected from database');
    }
}
if (require.main === module) {
    runLiveDataExamples().catch(console.error);
}
//# sourceMappingURL=live-data-integration-example.js.map