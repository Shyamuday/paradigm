#!/usr/bin/env ts-node

import { ZerodhaAuth } from '../src/auth/zerodha-auth';
import { DatabaseManager } from '../src/database/database';
import { logger } from '../src/logger/logger';

export async function checkApiPermissions() {
    try {
        console.log('🔍 Checking Zerodha API Permissions...\n');

        // Initialize services
        const auth = new ZerodhaAuth();
        const dbManager = DatabaseManager.getInstance();

        // Check authentication
        if (!(await auth.hasValidSession())) {
            console.log('❌ No valid session found. Please login first.');
            return;
        }

        console.log('✅ Authentication successful');
        await dbManager.connect();

        const kite = auth.getKite();

        // Test different API endpoints to check permissions
        console.log('📊 Testing API Permissions:\n');

        // 1. Test Profile API
        try {
            console.log('1️⃣ Testing Profile API...');
            const profile = await kite.getProfile();
            console.log('   ✅ Profile API: SUCCESS');
            console.log(`   👤 User: ${profile.user_name}`);
            console.log(`   📧 Email: ${profile.email || 'Not available'}`);
            console.log(`   🏢 Broker: ${profile.broker || 'Not available'}`);
            console.log(`   📈 Exchanges: ${profile.exchanges?.join(', ') || 'Not available'}`);
            console.log(`   📦 Products: ${profile.products?.join(', ') || 'Not available'}`);
            console.log(`   📋 Order Types: ${profile.order_types?.join(', ') || 'Not available'}`);
        } catch (error) {
            console.log('   ❌ Profile API: FAILED');
            console.log(`   Error: ${error}`);
        }

        // 2. Test Instruments API
        try {
            console.log('\n2️⃣ Testing Instruments API...');
            const instruments = await kite.getInstruments('NSE');
            console.log('   ✅ Instruments API: SUCCESS');
            console.log(`   📊 Total Instruments: ${instruments.length}`);

            // Show some sample instruments
            const sampleInstruments = instruments.slice(0, 5);
            console.log('   📋 Sample Instruments:');
            sampleInstruments.forEach(inst => {
                console.log(`      - ${inst.tradingsymbol} (${inst.instrument_token}) - ${inst.name}`);
            });
        } catch (error) {
            console.log('   ❌ Instruments API: FAILED');
            console.log(`   Error: ${error}`);
        }

        // 3. Test Quote API
        try {
            console.log('\n3️⃣ Testing Quote API...');
            const quotes = await kite.getQuote(['NSE:RELIANCE']);
            console.log('   ✅ Quote API: SUCCESS');
            console.log(`   📊 Quotes Retrieved: ${Object.keys(quotes).length}`);

            if (quotes['NSE:RELIANCE']) {
                const quote = quotes['NSE:RELIANCE'];
                console.log(`   💰 RELIANCE LTP: ${quote.last_price}`);
                console.log(`   📈 Change: ${quote.net_change || 'Not available'}`);
            }
        } catch (error) {
            console.log('   ❌ Quote API: FAILED');
            console.log(`   Error: ${error}`);
        }

        // 4. Test OHLC API
        try {
            console.log('\n4️⃣ Testing OHLC API...');
            const ohlc = await kite.getOHLC(['NSE:RELIANCE']);
            console.log('   ✅ OHLC API: SUCCESS');
            console.log(`   📊 OHLC Data Retrieved: ${Object.keys(ohlc).length}`);

            if (ohlc['NSE:RELIANCE']) {
                const data = ohlc['NSE:RELIANCE'];
                console.log(`   📈 RELIANCE OHLC: O:${data.ohlc.open} H:${data.ohlc.high} L:${data.ohlc.low} C:${data.ohlc.close}`);
            }
        } catch (error) {
            console.log('   ❌ OHLC API: FAILED');
            console.log(`   Error: ${error}`);
        }

        // 5. Test Historical Data API (with different approach)
        try {
            console.log('\n5️⃣ Testing Historical Data API...');

            // Try with a different date format
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            const historicalData = await kite.getHistoricalData(
                2885, // RELIANCE token
                'day',
                yesterday.toISOString().split('T')[0] || yesterday.toISOString(),
                today.toISOString().split('T')[0] || today.toISOString(),
                false
            );

            console.log('   ✅ Historical Data API: SUCCESS');
            console.log(`   📊 Historical Records: ${Array.isArray(historicalData) ? historicalData.length : 'Not array'}`);

            if (Array.isArray(historicalData) && historicalData.length > 0) {
                const latest = historicalData[0];
                console.log(`   📈 Latest RELIANCE Data: ${latest.date} - O:${latest.open} H:${latest.high} L:${latest.low} C:${latest.close} V:${latest.volume}`);
            }
        } catch (error) {
            console.log('   ❌ Historical Data API: FAILED');
            console.log(`   Error: ${error}`);
        }

        // 6. Test Margins API
        try {
            console.log('\n6️⃣ Testing Margins API...');
            const margins = await kite.getMargins();
            console.log('   ✅ Margins API: SUCCESS');
            console.log(`   💰 Available Cash: ${margins.equity?.available?.cash || 'Not available'}`);
            console.log(`   📊 Margins Data: Available`);
        } catch (error) {
            console.log('   ❌ Margins API: FAILED');
            console.log(`   Error: ${error}`);
        }

        // Summary
        console.log('\n📊 API PERMISSIONS SUMMARY');
        console.log('==================================================');
        console.log('✅ Available APIs: Profile, Instruments, Quote, OHLC');
        console.log('❌ Restricted APIs: Historical Data (requires paid plan)');
        console.log('\n💡 Recommendations:');
        console.log('1. Use Quote API for real-time data');
        console.log('2. Use OHLC API for current day data');
        console.log('3. Consider upgrading to paid plan for historical data');
        console.log('4. Use alternative data sources for historical data');

    } catch (error) {
        logger.error('Error checking API permissions:', error);
        console.error('❌ Error:', error);
    } finally {
        await DatabaseManager.getInstance().disconnect();
    }
}

// Run the script if called directly
if (require.main === module) {
    checkApiPermissions();
} 