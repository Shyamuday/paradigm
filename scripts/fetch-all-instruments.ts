#!/usr/bin/env ts-node

import { ZerodhaAuth } from '../src/auth/zerodha-auth';
import { InstrumentsManager } from '../src/services/instruments-manager.service';
import { db } from '../src/database/database';
import { logger } from '../src/logger/logger';
import { DatabaseManager } from '../src/database/database';

/**
 * Script to fetch all instruments from Zerodha API and store in database
 * 
 * This script:
 * 1. Authenticates with Zerodha
 * 2. Fetches all instruments from all exchanges
 * 3. Stores them in the database
 * 4. Provides statistics and progress updates
 */

async function fetchAndStoreInstruments() {
    let auth: ZerodhaAuth | null = null;
    let dbManager: DatabaseManager | null = null;

    try {
        console.log('🚀 Starting instrument fetch and store process...');

        // 1. Initialize database connection
        console.log('\n📊 Connecting to database...');
        dbManager = DatabaseManager.getInstance();
        await dbManager.connect();

        // Check database health
        const isHealthy = await dbManager.healthCheck();
        if (!isHealthy) {
            throw new Error('Database health check failed');
        }
        console.log('✅ Database connected successfully');

        // 2. Initialize authentication
        console.log('\n🔐 Initializing authentication...');
        auth = new ZerodhaAuth();

        // Check if we have a valid session
        const hasValidSession = await auth.hasValidSession();
        if (!hasValidSession) {
            console.log('🔄 No valid session found, starting OAuth login...');
            await auth.startOAuthLogin();
        } else {
            console.log('✅ Using existing valid session');
        }

        // 3. Initialize instruments manager
        console.log('\n📋 Initializing instruments manager...');
        const instrumentsManager = new InstrumentsManager(auth);

        // 4. Fetch all instruments from Zerodha
        console.log('\n📈 Fetching all instruments from Zerodha...');
        const allInstruments = await instrumentsManager.getAllInstruments();
        console.log(`✅ Fetched ${allInstruments.length} instruments from Zerodha`);

        // 5. Analyze instruments by exchange
        const exchangeStats = allInstruments.reduce((acc, inst) => {
            acc[inst.exchange] = (acc[inst.exchange] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        console.log('\n📊 Instruments by exchange:');
        Object.entries(exchangeStats).forEach(([exchange, count]) => {
            console.log(`   ${exchange}: ${count} instruments`);
        });

        // 6. Store instruments in database
        console.log('\n💾 Storing instruments in database...');

        let storedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;
        const batchSize = 100;

        for (let i = 0; i < allInstruments.length; i += batchSize) {
            const batch = allInstruments.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(allInstruments.length / batchSize);

            console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} instruments)...`);

            for (const instrument of batch) {
                try {
                    // Check if instrument already exists
                    const existingInstrument = await db.instrument.findUnique({
                        where: { symbol: instrument.tradingsymbol }
                    });

                    if (existingInstrument) {
                        // Update existing instrument
                        await db.instrument.update({
                            where: { symbol: instrument.tradingsymbol },
                            data: {
                                name: instrument.name,
                                exchange: instrument.exchange,
                                instrumentType: instrument.instrument_type,
                                lotSize: instrument.lot_size || null,
                                tickSize: instrument.tick_size || null,
                                underlyingSymbol: instrument.segment === 'NFO-OPT' || instrument.segment === 'NFO-FUT' ? (instrument.name.split(' ')[0] || null) : null,
                                strikePrice: instrument.strike || null,
                                expiryDate: instrument.expiry ? new Date(instrument.expiry) : null,
                                optionType: instrument.instrument_type === 'CE' || instrument.instrument_type === 'PE' ? instrument.instrument_type : null,
                                contractSize: instrument.lot_size || null,
                                updatedAt: new Date()
                            }
                        });
                        updatedCount++;
                    } else {
                        // Create new instrument
                        await db.instrument.create({
                            data: {
                                symbol: instrument.tradingsymbol,
                                name: instrument.name,
                                exchange: instrument.exchange,
                                instrumentType: instrument.instrument_type,
                                lotSize: instrument.lot_size || null,
                                tickSize: instrument.tick_size || null,
                                underlyingSymbol: instrument.segment === 'NFO-OPT' || instrument.segment === 'NFO-FUT' ? (instrument.name.split(' ')[0] || null) : null,
                                strikePrice: instrument.strike || null,
                                expiryDate: instrument.expiry ? new Date(instrument.expiry) : null,
                                optionType: instrument.instrument_type === 'CE' || instrument.instrument_type === 'PE' ? instrument.instrument_type : null,
                                contractSize: instrument.lot_size || null,
                                isActive: true
                            }
                        });
                        storedCount++;
                    }
                } catch (error) {
                    errorCount++;
                    logger.error(`Failed to store instrument ${instrument.tradingsymbol}:`, error);
                }
            }

            // Progress update
            const progress = ((i + batch.length) / allInstruments.length * 100).toFixed(1);
            console.log(`   Progress: ${progress}% (${storedCount} stored, ${updatedCount} updated, ${errorCount} errors)`);
        }

        // 7. Final statistics
        console.log('\n📈 Final Statistics:');
        console.log(`   Total instruments fetched: ${allInstruments.length}`);
        console.log(`   New instruments stored: ${storedCount}`);
        console.log(`   Existing instruments updated: ${updatedCount}`);
        console.log(`   Errors encountered: ${errorCount}`);
        console.log(`   Success rate: ${((storedCount + updatedCount) / allInstruments.length * 100).toFixed(1)}%`);

        // 8. Database statistics
        const totalInstrumentsInDB = await db.instrument.count();
        const activeInstrumentsInDB = await db.instrument.count({ where: { isActive: true } });

        console.log('\n🗄️ Database Statistics:');
        console.log(`   Total instruments in database: ${totalInstrumentsInDB}`);
        console.log(`   Active instruments: ${activeInstrumentsInDB}`);

        // 9. Exchange breakdown in database
        const dbExchangeStats = await db.instrument.groupBy({
            by: ['exchange'],
            _count: { exchange: true }
        });

        console.log('\n📊 Database instruments by exchange:');
        dbExchangeStats.forEach(stat => {
            console.log(`   ${stat.exchange}: ${stat._count.exchange} instruments`);
        });

        console.log('\n🎉 Instrument fetch and store process completed successfully!');

    } catch (error) {
        console.error('\n❌ Error during instrument fetch and store process:', error);
        logger.error('Instrument fetch and store failed:', error);
        process.exit(1);
    } finally {
        // Cleanup
        if (dbManager) {
            try {
                await dbManager.disconnect();
                console.log('\n📤 Database disconnected');
            } catch (error) {
                console.error('Error disconnecting from database:', error);
            }
        }
    }
}

// Handle script execution
if (require.main === module) {
    fetchAndStoreInstruments()
        .then(() => {
            console.log('\n✅ Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Script failed:', error);
            process.exit(1);
        });
}

export { fetchAndStoreInstruments }; 