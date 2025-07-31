#!/usr/bin/env ts-node

import { db } from '../src/database/database';
import { logger } from '../src/logger/logger';

async function checkTimeframes() {
    try {
        console.log('🔍 Checking available timeframes...\n');

        const timeframes = await db.timeframeConfig.findMany({
            orderBy: { intervalMinutes: 'asc' }
        });

        console.log('📊 Available Timeframes:');
        console.log('========================');

        timeframes.forEach(tf => {
            console.log(`   ${tf.name.padEnd(8)} | ${tf.intervalMinutes.toString().padStart(4)} min | ${tf.isActive ? '✅ Active' : '❌ Inactive'} | ${tf.description}`);
        });

        console.log(`\n📈 Total timeframes: ${timeframes.length}`);

        // Check which timeframes have data
        console.log('\n📊 Timeframes with data:');
        console.log('=======================');

        const instruments = await db.instrument.findMany({
            where: { symbol: { in: ['NIFTY', 'BANKNIFTY', 'RELIANCE'] } }
        });

        for (const instrument of instruments) {
            console.log(`\n${instrument.symbol}:`);
            for (const tf of timeframes) {
                const count = await db.candleData.count({
                    where: {
                        instrumentId: instrument.id,
                        timeframeId: tf.id
                    }
                });

                if (count > 0) {
                    console.log(`   ${tf.name.padEnd(8)} | ${count.toString().padStart(6)} candles`);
                }
            }
        }

    } catch (error) {
        console.error('❌ Error checking timeframes:', error);
    } finally {
        await db.$disconnect();
    }
}

checkTimeframes(); 