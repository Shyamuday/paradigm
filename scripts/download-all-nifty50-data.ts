#!/usr/bin/env ts-node

import { ZerodhaAuth } from '../src/auth/zerodha-auth';
import { DatabaseManager } from '../src/database/database';
import { db } from '../src/database/database';
import { logger } from '../src/logger/logger';
import * as fs from 'fs';
import * as path from 'path';

interface HistoricalData {
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    instrumentToken: number;
    symbol: string;
    timeframe: string;
}

type Timeframe = 'minute' | '15minute' | '30minute' | '60minute' | 'day';

interface TimeframeConfig {
    name: string;
    kiteInterval: Timeframe;
    description: string;
    intervalMinutes: number;
}

interface Nifty50Token {
    symbol: string;
    name: string;
    instrumentToken: number;
    exchange: string;
    instrumentType: string;
}

const TIMEFRAMES: TimeframeConfig[] = [
    { name: '1min', kiteInterval: 'minute', description: '1 Minute', intervalMinutes: 1 },
    { name: '15min', kiteInterval: '15minute', description: '15 Minutes', intervalMinutes: 15 },
    { name: '30min', kiteInterval: '30minute', description: '30 Minutes', intervalMinutes: 30 },
    { name: '1hour', kiteInterval: '60minute', description: '1 Hour', intervalMinutes: 60 },
    { name: '1day', kiteInterval: 'day', description: '1 Day', intervalMinutes: 1440 }
];

export async function downloadAllNifty50Data() {
    try {
        console.log('📊 Downloading Historical Data for All Nifty 50 Stocks...\n');

        // Initialize services
        const auth = new ZerodhaAuth();
        const dbManager = DatabaseManager.getInstance();

        // Check authentication
        if (!(await auth.hasValidSession())) {
            console.log('❌ No valid session found. Please authenticate first.');
            return;
        }

        console.log('✅ Authentication verified\n');

        // Get Kite instance
        const kite = auth.getKite();
        if (!kite) {
            console.log('❌ Failed to get Kite instance');
            return;
        }

        // Connect to database
        await dbManager.connect();

        // Load Nifty 50 tokens from file
        const tokensFile = path.join(process.cwd(), 'data', 'nifty50-tokens.json');
        if (!fs.existsSync(tokensFile)) {
            console.log('❌ Nifty 50 tokens file not found. Please run fetch:tokens first.');
            return;
        }

        const tokensData: Nifty50Token[] = JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
        console.log(`✅ Loaded ${tokensData.length} Nifty 50 instrument tokens\n`);

        // Get or create timeframe configurations
        const timeframeConfigs = new Map<string, any>();
        for (const tf of TIMEFRAMES) {
            let config = await db.timeframeConfig.findFirst({
                where: { name: tf.name }
            });

            if (!config) {
                config = await db.timeframeConfig.create({
                    data: {
                        name: tf.name,
                        description: tf.description,
                        intervalMinutes: tf.intervalMinutes
                    }
                });
                console.log(`✅ Created timeframe config: ${tf.name}`);
            }
            timeframeConfigs.set(tf.name, config);
        }

        // Calculate date range (last 1 month)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);

        console.log(`📅 Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`);

        let totalRecords = 0;
        let totalInstruments = 0;
        let totalTimeframes = 0;
        let successCount = 0;
        let errorCount = 0;

        // Process each Nifty 50 stock
        for (const token of tokensData) {
            console.log(`🔄 Processing ${token.symbol} (${token.name})...`);

            try {
                let instrumentSuccessCount = 0;
                let instrumentErrorCount = 0;

                // Test each timeframe
                for (const tf of TIMEFRAMES) {
                    try {
                        console.log(`   📊 Downloading ${tf.description} data...`);

                        // Get historical data from Zerodha
                        const historicalData = await kite.getHistoricalData(
                            token.instrumentToken,
                            tf.kiteInterval,
                            startDate,
                            endDate,
                            false
                        ) as any;

                        if (historicalData && Array.isArray(historicalData)) {
                            console.log(`      ✅ Received ${historicalData.length} records`);

                            // Transform data
                            const transformedData: HistoricalData[] = historicalData.map((record: any) => ({
                                date: new Date(record.date),
                                open: record.open,
                                high: record.high,
                                low: record.low,
                                close: record.close,
                                volume: record.volume,
                                instrumentToken: token.instrumentToken,
                                symbol: token.symbol,
                                timeframe: tf.name
                            }));

                            // Store in database
                            await storeHistoricalData(transformedData, token.symbol, tf.name, timeframeConfigs.get(tf.name)!.id.toString());

                            totalRecords += transformedData.length;
                            totalTimeframes++;
                            instrumentSuccessCount++;
                            console.log(`      💾 Stored ${transformedData.length} records in database`);
                        } else {
                            console.log(`      ⚠️  No data received for ${tf.description}`);
                            instrumentErrorCount++;
                        }

                        // Add delay to avoid rate limiting
                        await new Promise(resolve => setTimeout(resolve, 500));

                    } catch (error: any) {
                        console.log(`      ❌ Error downloading ${tf.description} data: ${error.message}`);
                        instrumentErrorCount++;
                    }
                }

                if (instrumentSuccessCount > 0) {
                    successCount++;
                    console.log(`   ✅ ${token.symbol}: ${instrumentSuccessCount}/${TIMEFRAMES.length} timeframes successful`);
                } else {
                    errorCount++;
                    console.log(`   ❌ ${token.symbol}: All timeframes failed`);
                }

                totalInstruments++;

                // Add delay between instruments
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.log(`   ❌ Error processing ${token.symbol}: ${error}`);
                errorCount++;
            }
        }

        // Summary
        console.log('\n📊 DOWNLOAD SUMMARY');
        console.log('==================================================');
        console.log(`Total Instruments Processed: ${totalInstruments}`);
        console.log(`Successful Instruments: ${successCount}`);
        console.log(`Failed Instruments: ${errorCount}`);
        console.log(`Total Timeframes Processed: ${totalTimeframes}`);
        console.log(`Total Records Downloaded: ${totalRecords}`);
        console.log(`Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
        console.log(`Timeframes: ${TIMEFRAMES.map(tf => tf.name).join(', ')}`);

        // Show sample data
        console.log('\n📋 Sample Data from Database:');
        const sampleData = await db.candleData.findMany({
            orderBy: {
                timestamp: 'desc'
            },
            take: 5
        });

        sampleData.forEach(record => {
            console.log(`   ${record.instrumentId} | ${record.timeframeId} | ${record.timestamp.toISOString().split('T')[0]} | O:${record.open} H:${record.high} L:${record.low} C:${record.close} V:${record.volume}`);
        });

        console.log('\n✅ All Nifty 50 historical data download completed successfully!');
        console.log('💾 Data has been stored in the database');
        console.log('📊 You can now use this data for backtesting and analysis');

    } catch (error) {
        logger.error('Error downloading all Nifty 50 data:', error);
        console.error('❌ Error:', error);
    } finally {
        await DatabaseManager.getInstance().disconnect();
    }
}

async function storeHistoricalData(data: HistoricalData[], symbol: string, timeframe: string, timeframeId: string) {
    try {
        // First, get or create the instrument record
        let instrument = await db.instrument.findUnique({
            where: { symbol: symbol }
        });

        if (!instrument) {
            instrument = await db.instrument.create({
                data: {
                    symbol: symbol,
                    name: symbol,
                    exchange: 'NSE',
                    instrumentType: 'EQ',
                    isActive: true
                }
            });
        }

        // Store in candle_data table
        for (const record of data) {
            await db.candleData.upsert({
                where: {
                    instrumentId_timeframeId_timestamp: {
                        instrumentId: instrument.id.toString(),
                        timeframeId: timeframeId,
                        timestamp: record.date
                    }
                },
                update: {
                    open: record.open,
                    high: record.high,
                    low: record.low,
                    close: record.close,
                    volume: record.volume
                },
                create: {
                    instrumentId: instrument.id.toString(),
                    timeframeId: timeframeId,
                    timestamp: record.date,
                    open: record.open,
                    high: record.high,
                    low: record.low,
                    close: record.close,
                    volume: record.volume
                }
            });
        }
    } catch (error) {
        console.log(`   ⚠️  Error storing data for ${symbol}: ${error}`);
    }
}

// Run the function
if (require.main === module) {
    downloadAllNifty50Data().catch(console.error);
} 