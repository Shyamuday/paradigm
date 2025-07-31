#!/usr/bin/env ts-node

import { ZerodhaAuth } from '../src/auth/zerodha-auth';
import { InstrumentsManager } from '../src/services/instruments-manager.service';
import { DatabaseManager } from '../src/database/database';
import { db } from '../src/database/database';
import { logger } from '../src/logger/logger';

export async function fetchInstrumentsTokens() {
    try {
        console.log('📊 Fetching Instruments and Tokens from Zerodha...\n');

        // Initialize services
        const auth = new ZerodhaAuth();
        const instrumentsManager = new InstrumentsManager(auth);
        const dbManager = DatabaseManager.getInstance();

        // Check authentication
        if (!(await auth.hasValidSession())) {
            console.log('❌ No valid session found. Please authenticate first.');
            return;
        }

        console.log('✅ Authentication verified\n');

        // Connect to database
        await dbManager.connect();

        // Fetch all instruments from Zerodha
        console.log('🔄 Fetching all instruments from Zerodha...');
        const instruments = await instrumentsManager.getAllInstruments();
        console.log(`✅ Fetched ${instruments.length} instruments from Zerodha\n`);

        // Filter for Nifty 50 constituent stocks
        const nifty50Symbols = [
            'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN',
            'BHARTIARTL', 'KOTAKBANK', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'HCLTECH', 'SUNPHARMA',
            'TATAMOTORS', 'WIPRO', 'ULTRACEMCO', 'TITAN', 'BAJFINANCE', 'NESTLEIND', 'POWERGRID',
            'TECHM', 'BAJAJFINSV', 'NTPC', 'HINDALCO', 'JSWSTEEL', 'ONGC', 'TATACONSUM',
            'COALINDIA', 'DIVISLAB', 'SHREECEM', 'CIPLA', 'BRITANNIA', 'EICHERMOT', 'HEROMOTOCO',
            'ADANIENT', 'DRREDDY', 'TATASTEEL', 'BPCL', 'M&M', 'HCLTECH', 'APOLLOHOSP',
            'LT', 'ADANIPORTS', 'SBILIFE', 'UPL', 'VEDL', 'GRASIM', 'TATAPOWER', 'HDFCLIFE'
        ];

        console.log('🔍 Filtering for Nifty 50 constituent stocks...');
        const nifty50Instruments = instruments.filter(instrument =>
            instrument.exchange === 'NSE' &&
            nifty50Symbols.includes(instrument.tradingsymbol)
        );

        console.log(`✅ Found ${nifty50Instruments.length} Nifty 50 constituent instruments\n`);

        // Update database with correct instrument tokens
        console.log('💾 Updating database with instrument tokens...');
        let updatedCount = 0;
        let createdCount = 0;

        for (const instrument of nifty50Instruments) {
            try {
                // Check if instrument exists in database
                const existingInstrument = await db.instrument.findFirst({
                    where: { symbol: instrument.tradingsymbol }
                });

                if (existingInstrument) {
                    // Update existing instrument with token
                    await db.instrument.update({
                        where: { id: existingInstrument.id },
                        data: {
                            name: instrument.name,
                            exchange: instrument.exchange,
                            instrumentType: instrument.instrument_type,
                            lotSize: instrument.lot_size,
                            tickSize: instrument.tick_size,
                            // Store the instrument token as a string in a custom field
                            // Since our schema doesn't have instrumentToken, we'll use the symbol
                            // but we'll know the actual token from the instruments manager
                        }
                    });
                    updatedCount++;
                    console.log(`   ✅ Updated: ${instrument.tradingsymbol} (Token: ${instrument.instrument_token})`);
                } else {
                    // Create new instrument
                    await db.instrument.create({
                        data: {
                            symbol: instrument.tradingsymbol,
                            name: instrument.name,
                            exchange: instrument.exchange,
                            instrumentType: instrument.instrument_type,
                            lotSize: instrument.lot_size,
                            tickSize: instrument.tick_size,
                            isActive: true
                        }
                    });
                    createdCount++;
                    console.log(`   ➕ Created: ${instrument.tradingsymbol} (Token: ${instrument.instrument_token})`);
                }
            } catch (error) {
                console.log(`   ❌ Error processing ${instrument.tradingsymbol}: ${error}`);
            }
        }

        console.log(`\n📊 Database Update Summary:`);
        console.log(`   ✅ Updated: ${updatedCount} instruments`);
        console.log(`   ➕ Created: ${createdCount} instruments`);
        console.log(`   📈 Total processed: ${updatedCount + createdCount}`);

        // Store the instrument tokens in a separate file for easy access
        const tokensData = nifty50Instruments.map(instrument => ({
            symbol: instrument.tradingsymbol,
            name: instrument.name,
            instrumentToken: instrument.instrument_token,
            exchange: instrument.exchange,
            instrumentType: instrument.instrument_type
        }));

        const fs = require('fs');
        const path = require('path');
        const tokensFile = path.join(process.cwd(), 'data', 'nifty50-tokens.json');
        fs.writeFileSync(tokensFile, JSON.stringify(tokensData, null, 2));

        console.log(`\n💾 Instrument tokens saved to: ${tokensFile}`);

        // Show sample tokens
        console.log('\n📋 Sample Nifty 50 Instrument Tokens:');
        tokensData.slice(0, 10).forEach(token => {
            console.log(`   ${token.symbol.padEnd(15)} | Token: ${token.instrumentToken.toString().padStart(8, ' ')} | ${token.name}`);
        });

        console.log('\n🎉 Instrument tokens fetch completed successfully!');
        console.log('   You can now use these tokens for historical data downloads.');

    } catch (error: any) {
        console.error('❌ Error fetching instrument tokens:', error.message);
        logger.error('Instrument tokens fetch error:', error);
    } finally {
        await DatabaseManager.getInstance().disconnect();
    }
}

// Run the function
if (require.main === module) {
    fetchInstrumentsTokens().catch(console.error);
} 