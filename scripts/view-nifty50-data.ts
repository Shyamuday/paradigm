#!/usr/bin/env ts-node

import { DatabaseManager } from '../src/database/database';
import { db } from '../src/database/database';
import { logger } from '../src/logger/logger';

export async function viewNifty50Data() {
    try {
        console.log('📊 Viewing Nifty 50 Data from Database...\n');

        const dbManager = DatabaseManager.getInstance();
        await dbManager.connect();

        // Get all Nifty 50 related instruments
        const niftyInstruments = await db.instrument.findMany({
            where: {
                OR: [
                    { symbol: { contains: 'NIFTY', mode: 'insensitive' } },
                    { symbol: { in: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY'] } }
                ]
            },
            include: {
                candleData: {
                    include: {
                        timeframe: true
                    },
                    orderBy: {
                        timestamp: 'desc'
                    },
                    take: 5
                }
            }
        });

        console.log(`📈 Found ${niftyInstruments.length} Nifty 50 instruments in database\n`);

        for (const instrument of niftyInstruments) {
            console.log(`📊 ${instrument.symbol} (${instrument.name})`);
            console.log(`   Type: ${instrument.instrumentType}`);
            console.log(`   Exchange: ${instrument.exchange}`);
            console.log(`   Candle Data Records: ${instrument.candleData.length}`);

            if (instrument.candleData.length > 0) {
                console.log('   📋 Recent Data:');
                instrument.candleData.forEach(candle => {
                    console.log(`      ${candle.timestamp.toISOString().split('T')[0]} | O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close} V:${candle.volume}`);
                });
            }
            console.log('');
        }

        // Get summary statistics
        const totalCandles = await db.candleData.count();
        const timeframeCount = await db.candleData.groupBy({
            by: ['timeframeId'],
            _count: {
                id: true
            }
        });

        console.log('📊 DATABASE SUMMARY');
        console.log('==================================================');
        console.log(`Total Candle Records: ${totalCandles}`);
        console.log('Timeframe Distribution:');
        timeframeCount.forEach(stat => {
            console.log(`   Timeframe ${stat.timeframeId}: ${stat._count.id} records`);
        });

        // Get latest data for each instrument
        console.log('\n📈 LATEST DATA BY INSTRUMENT');
        console.log('==================================================');

        for (const instrument of niftyInstruments) {
            const latestCandle = await db.candleData.findFirst({
                where: {
                    instrumentId: instrument.id
                },
                orderBy: {
                    timestamp: 'desc'
                },
                include: {
                    timeframe: true
                }
            });

            if (latestCandle) {
                const change = latestCandle.close - latestCandle.open;
                const changePercent = (change / latestCandle.open) * 100;
                const changeSymbol = change >= 0 ? '📈' : '📉';

                console.log(`${changeSymbol} ${instrument.symbol}: ${latestCandle.close} (${change >= 0 ? '+' : ''}${change.toFixed(2)} | ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`);
                console.log(`   Date: ${latestCandle.timestamp.toISOString().split('T')[0]} | Volume: ${latestCandle.volume.toLocaleString()}`);
            }
        }

        console.log('\n✅ Data viewing completed!');
        console.log('💡 You can now use this data for:');
        console.log('   - Strategy backtesting');
        console.log('   - Technical analysis');
        console.log('   - Risk management');
        console.log('   - Portfolio optimization');

    } catch (error) {
        logger.error('Error viewing Nifty 50 data:', error);
        console.error('❌ Error:', error);
    } finally {
        await DatabaseManager.getInstance().disconnect();
    }
}

// Run the script if called directly
if (require.main === module) {
    viewNifty50Data();
} 