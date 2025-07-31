#!/usr/bin/env ts-node

import { ZerodhaAuth } from '../src/auth/zerodha-auth';
import { NiftyCategorizationService } from '../src/services/nifty-categorization.service';
import { DatabaseManager } from '../src/database/database';
import { db } from '../src/database/database';
import { logger } from '../src/logger/logger';

export async function checkAvailableData() {
    try {
        console.log('📊 Checking Available Data and Permissions...\n');

        // Initialize services
        const auth = new ZerodhaAuth();
        const niftyService = new NiftyCategorizationService();
        const dbManager = DatabaseManager.getInstance();

        // Check authentication
        if (!(await auth.hasValidSession())) {
            console.log('❌ No valid session found. Please login first.');
            return;
        }

        console.log('✅ Authentication successful');
        await dbManager.connect();

        const kite = auth.getKite();

        // Test API permissions
        console.log('🔍 Testing API Permissions...\n');

        try {
            // Test 1: Get profile
            const profile = await kite.getProfile();
            console.log('✅ Profile Access: SUCCESS');
            console.log(`   User: ${profile.user_name}`);
            console.log(`   User ID: ${profile.user_id}`);
            console.log(`   Email: ${profile.email}`);

            // Test 2: Get instruments
            const instruments = await kite.getInstruments('NSE');
            console.log('✅ Instruments Access: SUCCESS');
            console.log(`   Total NSE Instruments: ${instruments.length}`);

            // Test 3: Get Nifty 50 constituents
            const nifty50Constituents = await niftyService.getNifty50Constituents();
            console.log('✅ Nifty 50 Constituents: SUCCESS');
            console.log(`   Constituent Count: ${nifty50Constituents.length}`);

            // Test 4: Try to get historical data for a single instrument
            console.log('\n🔍 Testing Historical Data Access...');

            // Get first Nifty 50 constituent
            const firstConstituent = nifty50Constituents[0];
            console.log(`   Testing with: ${firstConstituent}`);

            // Find the instrument in database
            const instrument = await db.instrument.findFirst({
                where: {
                    symbol: firstConstituent,
                    exchange: 'NSE',
                    instrumentType: 'EQ'
                }
            });

            if (instrument) {
                console.log(`   Found instrument: ${instrument.name} (Token: ${instrument.symbol})`);

                // Try different timeframes
                const timeframes = ['day', 'minute', '15minute', '30minute', '60minute'] as const;
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 7); // Last 7 days

                for (const timeframe of timeframes) {
                    try {
                        console.log(`   Testing ${timeframe} data...`);
                        const historicalData = await kite.getHistoricalData(
                            parseInt(instrument.symbol),
                            timeframe,
                            startDate,
                            endDate,
                            false
                        );

                        if (historicalData && Array.isArray(historicalData) && historicalData.length > 0) {
                            console.log(`   ✅ ${timeframe}: SUCCESS (${historicalData.length} records)`);
                        } else {
                            console.log(`   ⚠️  ${timeframe}: No data available`);
                        }
                    } catch (error: any) {
                        console.log(`   ❌ ${timeframe}: ${error.message || 'Permission denied'}`);
                    }
                }
            } else {
                console.log(`   ⚠️  Instrument ${firstConstituent} not found in database`);
            }

        } catch (error: any) {
            console.log('❌ API Test Failed:', error.message);
        }

        // Check existing data in database
        console.log('\n📋 Checking Existing Data in Database...\n');

        // Count instruments
        const instrumentCount = await db.instrument.count();
        console.log(`📈 Total Instruments in Database: ${instrumentCount}`);

        // Count Nifty 50 constituents
        const nifty50Instruments = await db.instrument.findMany({
            where: {
                symbol: {
                    in: nifty50Constituents
                },
                exchange: 'NSE',
                instrumentType: 'EQ'
            }
        });
        console.log(`📊 Nifty 50 Constituents in Database: ${nifty50Instruments.length}`);

        // Count candle data
        const candleDataCount = await db.candleData.count();
        console.log(`🕯️  Total Candle Data Records: ${candleDataCount}`);

        // Count timeframe configurations
        const timeframeCount = await db.timeframeConfig.count();
        console.log(`⏱️  Timeframe Configurations: ${timeframeCount}`);

        // Show sample candle data
        if (candleDataCount > 0) {
            console.log('\n📊 Sample Candle Data:');
            const sampleData = await db.candleData.findMany({
                include: {
                    instrument: true,
                    timeframeConfig: true
                },
                orderBy: {
                    timestamp: 'desc'
                },
                take: 5
            });

            sampleData.forEach(record => {
                console.log(`   ${record.instrument?.symbol || 'Unknown'} | ${record.timeframeConfig?.name || 'Unknown'} | ${record.timestamp.toISOString().split('T')[0]} | O:${record.open} H:${record.high} L:${record.low} C:${record.close} V:${record.volume}`);
            });
        }

        // Show Nifty 50 constituents with their tokens
        console.log('\n📋 Nifty 50 Constituents with Tokens:');
        nifty50Instruments.forEach((instrument, index) => {
            console.log(`   ${index + 1}. ${instrument.symbol} - ${instrument.name} (Token: ${instrument.symbol})`);
        });

        // Summary and recommendations
        console.log('\n📊 SUMMARY AND RECOMMENDATIONS');
        console.log('==================================================');

        if (candleDataCount > 0) {
            console.log('✅ You have existing historical data in the database');
            console.log('💡 You can use this data for backtesting and analysis');
        } else {
            console.log('⚠️  No historical data found in database');
        }

        console.log(`📈 Nifty 50 Constituents Available: ${nifty50Instruments.length}/50`);

        if (nifty50Instruments.length === 50) {
            console.log('✅ All Nifty 50 constituents are available in database');
        } else {
            console.log(`⚠️  Missing ${50 - nifty50Instruments.length} constituents`);
        }

        console.log('\n🔧 Next Steps:');
        console.log('1. If you have historical data, you can run backtesting');
        console.log('2. If you need more data, check your Zerodha subscription level');
        console.log('3. Consider using alternative data sources for historical data');
        console.log('4. Use the existing data for strategy development and testing');

        console.log('\n✅ Data availability check completed!');

    } catch (error) {
        logger.error('Error checking available data:', error);
        console.error('❌ Error:', error);
    } finally {
        await DatabaseManager.getInstance().disconnect();
    }
}

// Run the script if called directly
if (require.main === module) {
    checkAvailableData();
} 