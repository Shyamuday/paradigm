import { db } from './database/database';
import { logger } from './logger/logger';
import { EnhancedMarketDataService } from './services/enhanced-market-data.service';

async function testMultiTimeframeSystem() {
    try {
        logger.info('Testing multi-timeframe data storage system...');

        // Connect to database
        await db.$connect();
        logger.info('Connected to database');

        // Initialize the enhanced market data service
        const marketDataService = new EnhancedMarketDataService();

        // Test 1: Check available timeframes
        logger.info('Test 1: Checking available timeframes...');
        const timeframes = await marketDataService.getAvailableTimeframes();
        logger.info(`Found ${timeframes.length} timeframes:`);
        timeframes.forEach(tf => {
            logger.info(`  - ${tf.name}: ${tf.description} (${tf.intervalMinutes} minutes)`);
        });

        // Test 2: Save sample tick data
        logger.info('Test 2: Saving sample tick data...');
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
        logger.info('Sample tick data saved and aggregated');

        // Test 3: Get latest data
        logger.info('Test 3: Getting latest data...');
        const latestData = await marketDataService.getLatestMultiTimeframeData('NIFTY');

        logger.info('Latest data by timeframe:');
        for (const [timeframe, candle] of Object.entries(latestData)) {
            if (candle) {
                logger.info(`  ${timeframe}: Close=${candle.close}, Volume=${candle.volume}`);
            } else {
                logger.info(`  ${timeframe}: No data available`);
            }
        }

        // Test 4: Get instrument statistics
        logger.info('Test 4: Getting instrument statistics...');
        const stats = await marketDataService.getInstrumentStats('NIFTY');
        logger.info(`Total ticks: ${stats.totalTicks}`);
        logger.info('Candles by timeframe:', stats.totalCandles);

        logger.info('All tests completed successfully!');

    } catch (error) {
        logger.error('Test failed:', error);
    } finally {
        // Disconnect from database
        await db.$disconnect();
        logger.info('Disconnected from database');
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testMultiTimeframeSystem().catch(console.error);
}

export { testMultiTimeframeSystem }; 