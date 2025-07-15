"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.multiTimeframeExample = multiTimeframeExample;
exports.dataManagementExample = dataManagementExample;
exports.volumeProfileExample = volumeProfileExample;
exports.runAllExamples = runAllExamples;
const enhanced_market_data_service_1 = require("../services/enhanced-market-data.service");
const logger_1 = require("../logger/logger");
const database_1 = require("../database/database");
async function multiTimeframeExample() {
    const marketDataService = new enhanced_market_data_service_1.EnhancedMarketDataService();
    try {
        logger_1.logger.info('Starting multi-timeframe data example...');
        const sampleTickData = {
            instrumentToken: 256265,
            symbol: 'NIFTY',
            ltp: 19500.50,
            open: 19450.00,
            high: 19520.00,
            low: 19430.00,
            close: 19500.50,
            volume: 1000,
            change: 50.50,
            changePercent: 0.26,
            timestamp: new Date()
        };
        logger_1.logger.info('Saving tick data...');
        await marketDataService.saveTickDataAndAggregate(sampleTickData);
        logger_1.logger.info('Getting latest multi-timeframe data...');
        const latestData = await marketDataService.getLatestMultiTimeframeData('NIFTY');
        logger_1.logger.info('Latest data by timeframe:');
        for (const [timeframe, candle] of Object.entries(latestData)) {
            if (candle) {
                logger_1.logger.info(`${timeframe}: Close=${candle.close}, Volume=${candle.volume}, Change=${candle.priceChange}%`);
            }
            else {
                logger_1.logger.info(`${timeframe}: No data available`);
            }
        }
        logger_1.logger.info('Getting historical data...');
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 7);
        const toDate = new Date();
        const historicalData = await marketDataService.getMultiTimeframeData('NIFTY', ['5min', '15min', '1hour'], fromDate, toDate, 50);
        logger_1.logger.info('Historical data summary:');
        for (const [timeframe, candles] of Object.entries(historicalData)) {
            logger_1.logger.info(`${timeframe}: ${candles.length} candles`);
            if (candles.length > 0) {
                const latest = candles[0];
                if (latest) {
                    logger_1.logger.info(`  Latest: Close=${latest.close}, Volume=${latest.volume}`);
                }
            }
        }
        logger_1.logger.info('Getting price change information...');
        const priceChange = await marketDataService.getPriceChange('NIFTY', '1day');
        if (priceChange) {
            logger_1.logger.info(`Daily change: ${priceChange.change} (${priceChange.changePercent}%)`);
            logger_1.logger.info(`Open: ${priceChange.open}, Close: ${priceChange.close}`);
        }
        logger_1.logger.info('Getting instrument statistics...');
        const stats = await marketDataService.getInstrumentStats('NIFTY');
        logger_1.logger.info(`Total ticks: ${stats.totalTicks}`);
        logger_1.logger.info('Candles by timeframe:', stats.totalCandles);
        logger_1.logger.info(`Last update: ${stats.lastUpdate}`);
        logger_1.logger.info('Getting available timeframes...');
        const timeframes = await marketDataService.getAvailableTimeframes();
        logger_1.logger.info('Available timeframes:');
        for (const timeframe of timeframes) {
            logger_1.logger.info(`  ${timeframe.name}: ${timeframe.description} (${timeframe.intervalMinutes} minutes)`);
        }
        logger_1.logger.info('Simulating multiple tick updates...');
        for (let i = 1; i <= 5; i++) {
            const tickUpdate = {
                ...sampleTickData,
                ltp: sampleTickData.ltp + (i * 10),
                high: sampleTickData.high + (i * 10),
                close: sampleTickData.close + (i * 10),
                volume: sampleTickData.volume + (i * 100),
                change: sampleTickData.change + (i * 10),
                changePercent: sampleTickData.changePercent + (i * 0.1),
                timestamp: new Date(Date.now() + (i * 60000))
            };
            await marketDataService.saveTickDataAndAggregate(tickUpdate);
            logger_1.logger.info(`Updated tick ${i}: LTP=${tickUpdate.ltp}, Volume=${tickUpdate.volume}`);
        }
        logger_1.logger.info('Getting updated latest data...');
        const updatedLatestData = await marketDataService.getLatestMultiTimeframeData('NIFTY');
        logger_1.logger.info('Updated latest data:');
        for (const [timeframe, candle] of Object.entries(updatedLatestData)) {
            if (candle) {
                logger_1.logger.info(`${timeframe}: Close=${candle.close}, Volume=${candle.volume}`);
            }
        }
        logger_1.logger.info('Multi-timeframe example completed successfully!');
    }
    catch (error) {
        logger_1.logger.error('Error in multi-timeframe example:', error);
    }
}
async function dataManagementExample() {
    const marketDataService = new enhanced_market_data_service_1.EnhancedMarketDataService();
    try {
        logger_1.logger.info('Starting data management example...');
        const initialStats = await marketDataService.getInstrumentStats('NIFTY');
        logger_1.logger.info('Initial statistics:', initialStats);
        logger_1.logger.info('Cleaning up old data...');
        await marketDataService.cleanupOldData();
        const finalStats = await marketDataService.getInstrumentStats('NIFTY');
        logger_1.logger.info('Final statistics:', finalStats);
        logger_1.logger.info('Data management example completed!');
    }
    catch (error) {
        logger_1.logger.error('Error in data management example:', error);
    }
}
async function volumeProfileExample() {
    const marketDataService = new enhanced_market_data_service_1.EnhancedMarketDataService();
    try {
        logger_1.logger.info('Starting volume profile example...');
        const today = new Date();
        const volumeProfile = await marketDataService.getVolumeProfile('NIFTY', '1day', today);
        if (volumeProfile.length > 0) {
            logger_1.logger.info(`Volume profile for ${today.toDateString()}:`);
            const sortedProfile = volumeProfile.sort((a, b) => b.volume - a.volume);
            for (let i = 0; i < Math.min(5, sortedProfile.length); i++) {
                const level = sortedProfile[i];
                const pocIndicator = level.poc ? ' (POC)' : '';
                logger_1.logger.info(`  ${level.priceLevel}: ${level.volume} volume${pocIndicator}`);
            }
        }
        else {
            logger_1.logger.info('No volume profile data available');
        }
        logger_1.logger.info('Volume profile example completed!');
    }
    catch (error) {
        logger_1.logger.error('Error in volume profile example:', error);
    }
}
async function runAllExamples() {
    try {
        await database_1.db.$connect();
        logger_1.logger.info('Connected to database');
        await multiTimeframeExample();
        await dataManagementExample();
        await volumeProfileExample();
        logger_1.logger.info('All examples completed successfully!');
    }
    catch (error) {
        logger_1.logger.error('Error running examples:', error);
    }
    finally {
        await database_1.db.$disconnect();
        logger_1.logger.info('Disconnected from database');
    }
}
if (require.main === module) {
    runAllExamples().catch(console.error);
}
//# sourceMappingURL=multi-timeframe-example.js.map