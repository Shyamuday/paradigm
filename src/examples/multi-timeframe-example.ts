import { EnhancedMarketDataService } from '../services/enhanced-market-data.service';
import { logger } from '../logger/logger';
import { db } from '../database/database';

/**
 * Example demonstrating multi-timeframe data storage and retrieval
 */
async function multiTimeframeExample() {
    const marketDataService = new EnhancedMarketDataService();

    try {
        logger.info('Starting multi-timeframe data example...');

        // 1. Save sample tick data (this will automatically aggregate to all timeframes)
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

        logger.info('Saving tick data...');
        await marketDataService.saveTickDataAndAggregate(sampleTickData);

        // 2. Get latest data for all timeframes
        logger.info('Getting latest multi-timeframe data...');
        const latestData = await marketDataService.getLatestMultiTimeframeData('NIFTY');

        logger.info('Latest data by timeframe:');
        for (const [timeframe, candle] of Object.entries(latestData)) {
            if (candle) {
                logger.info(`${timeframe}: Close=${candle.close}, Volume=${candle.volume}, Change=${candle.priceChange}%`);
            } else {
                logger.info(`${timeframe}: No data available`);
            }
        }

        // 3. Get historical data for specific timeframes
        logger.info('Getting historical data...');
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 7); // 7 days ago
        const toDate = new Date();

        const historicalData = await marketDataService.getMultiTimeframeData(
            'NIFTY',
            ['5min', '15min', '1hour'],
            fromDate,
            toDate,
            50
        );

        logger.info('Historical data summary:');
        for (const [timeframe, candles] of Object.entries(historicalData)) {
            logger.info(`${timeframe}: ${candles.length} candles`);
            if (candles.length > 0) {
                const latest = candles[0]; // Most recent first
                if (latest) {
                    logger.info(`  Latest: Close=${latest.close}, Volume=${latest.volume}`);
                }
            }
        }

        // 4. Get price change information
        logger.info('Getting price change information...');
        const priceChange = await marketDataService.getPriceChange('NIFTY', '1day');
        if (priceChange) {
            logger.info(`Daily change: ${priceChange.change} (${priceChange.changePercent}%)`);
            logger.info(`Open: ${priceChange.open}, Close: ${priceChange.close}`);
        }

        // 5. Get instrument statistics
        logger.info('Getting instrument statistics...');
        const stats = await marketDataService.getInstrumentStats('NIFTY');
        logger.info(`Total ticks: ${stats.totalTicks}`);
        logger.info('Candles by timeframe:', stats.totalCandles);
        logger.info(`Last update: ${stats.lastUpdate}`);

        // 6. Get available timeframes
        logger.info('Getting available timeframes...');
        const timeframes = await marketDataService.getAvailableTimeframes();
        logger.info('Available timeframes:');
        for (const timeframe of timeframes) {
            logger.info(`  ${timeframe.name}: ${timeframe.description} (${timeframe.intervalMinutes} minutes)`);
        }

        // 7. Simulate multiple tick updates
        logger.info('Simulating multiple tick updates...');
        for (let i = 1; i <= 5; i++) {
            const tickUpdate = {
                ...sampleTickData,
                ltp: sampleTickData.ltp + (i * 10),
                high: sampleTickData.high + (i * 10),
                close: sampleTickData.close + (i * 10),
                volume: sampleTickData.volume + (i * 100),
                change: sampleTickData.change + (i * 10),
                changePercent: sampleTickData.changePercent + (i * 0.1),
                timestamp: new Date(Date.now() + (i * 60000)) // 1 minute apart
            };

            await marketDataService.saveTickDataAndAggregate(tickUpdate);
            logger.info(`Updated tick ${i}: LTP=${tickUpdate.ltp}, Volume=${tickUpdate.volume}`);
        }

        // 8. Get updated latest data
        logger.info('Getting updated latest data...');
        const updatedLatestData = await marketDataService.getLatestMultiTimeframeData('NIFTY');

        logger.info('Updated latest data:');
        for (const [timeframe, candle] of Object.entries(updatedLatestData)) {
            if (candle) {
                logger.info(`${timeframe}: Close=${candle.close}, Volume=${candle.volume}`);
            }
        }

        logger.info('Multi-timeframe example completed successfully!');

    } catch (error) {
        logger.error('Error in multi-timeframe example:', error);
    }
}

/**
 * Example demonstrating data cleanup and management
 */
async function dataManagementExample() {
    const marketDataService = new EnhancedMarketDataService();

    try {
        logger.info('Starting data management example...');

        // 1. Get current statistics
        const initialStats = await marketDataService.getInstrumentStats('NIFTY');
        logger.info('Initial statistics:', initialStats);

        // 2. Clean up old data
        logger.info('Cleaning up old data...');
        await marketDataService.cleanupOldData();

        // 3. Get updated statistics
        const finalStats = await marketDataService.getInstrumentStats('NIFTY');
        logger.info('Final statistics:', finalStats);

        logger.info('Data management example completed!');

    } catch (error) {
        logger.error('Error in data management example:', error);
    }
}

/**
 * Example demonstrating volume profile analysis
 */
async function volumeProfileExample() {
    const marketDataService = new EnhancedMarketDataService();

    try {
        logger.info('Starting volume profile example...');

        // Get volume profile for today
        const today = new Date();
        const volumeProfile = await marketDataService.getVolumeProfile('NIFTY', '1day', today);

        if (volumeProfile.length > 0) {
            logger.info(`Volume profile for ${today.toDateString()}:`);

            // Sort by volume (highest first)
            const sortedProfile = volumeProfile.sort((a, b) => b.volume - a.volume);

            // Show top 5 volume levels
            for (let i = 0; i < Math.min(5, sortedProfile.length); i++) {
                const level = sortedProfile[i];
                const pocIndicator = level.poc ? ' (POC)' : '';
                logger.info(`  ${level.priceLevel}: ${level.volume} volume${pocIndicator}`);
            }
        } else {
            logger.info('No volume profile data available');
        }

        logger.info('Volume profile example completed!');

    } catch (error) {
        logger.error('Error in volume profile example:', error);
    }
}

/**
 * Main function to run all examples
 */
async function runAllExamples() {
    try {
        // Connect to database
        await db.$connect();
        logger.info('Connected to database');

        // Run examples
        await multiTimeframeExample();
        await dataManagementExample();
        await volumeProfileExample();

        logger.info('All examples completed successfully!');

    } catch (error) {
        logger.error('Error running examples:', error);
    } finally {
        // Disconnect from database
        await db.$disconnect();
        logger.info('Disconnected from database');
    }
}

// Run the examples if this file is executed directly
if (require.main === module) {
    runAllExamples().catch(console.error);
}

export {
    multiTimeframeExample,
    dataManagementExample,
    volumeProfileExample,
    runAllExamples
}; 