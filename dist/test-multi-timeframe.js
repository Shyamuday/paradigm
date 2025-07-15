"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testMultiTimeframeSystem = testMultiTimeframeSystem;
const database_1 = require("./database/database");
const logger_1 = require("./logger/logger");
const enhanced_market_data_service_1 = require("./services/enhanced-market-data.service");
async function testMultiTimeframeSystem() {
    try {
        logger_1.logger.info('Testing multi-timeframe data storage system...');
        await database_1.db.$connect();
        logger_1.logger.info('Connected to database');
        const marketDataService = new enhanced_market_data_service_1.EnhancedMarketDataService();
        logger_1.logger.info('Test 1: Checking available timeframes...');
        const timeframes = await marketDataService.getAvailableTimeframes();
        logger_1.logger.info(`Found ${timeframes.length} timeframes:`);
        timeframes.forEach(tf => {
            logger_1.logger.info(`  - ${tf.name}: ${tf.description} (${tf.intervalMinutes} minutes)`);
        });
        logger_1.logger.info('Test 2: Saving sample tick data...');
        const sampleTick = {
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
        await marketDataService.saveTickDataAndAggregate(sampleTick);
        logger_1.logger.info('Sample tick data saved and aggregated');
        logger_1.logger.info('Test 3: Getting latest data...');
        const latestData = await marketDataService.getLatestMultiTimeframeData('NIFTY');
        logger_1.logger.info('Latest data by timeframe:');
        for (const [timeframe, candle] of Object.entries(latestData)) {
            if (candle) {
                logger_1.logger.info(`  ${timeframe}: Close=${candle.close}, Volume=${candle.volume}`);
            }
            else {
                logger_1.logger.info(`  ${timeframe}: No data available`);
            }
        }
        logger_1.logger.info('Test 4: Getting instrument statistics...');
        const stats = await marketDataService.getInstrumentStats('NIFTY');
        logger_1.logger.info(`Total ticks: ${stats.totalTicks}`);
        logger_1.logger.info('Candles by timeframe:', stats.totalCandles);
        logger_1.logger.info('All tests completed successfully!');
    }
    catch (error) {
        logger_1.logger.error('Test failed:', error);
    }
    finally {
        await database_1.db.$disconnect();
        logger_1.logger.info('Disconnected from database');
    }
}
if (require.main === module) {
    testMultiTimeframeSystem().catch(console.error);
}
//# sourceMappingURL=test-multi-timeframe.js.map