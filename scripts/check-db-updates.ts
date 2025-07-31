#!/usr/bin/env ts-node

import { db } from '../src/database/database';

async function checkDatabaseUpdates() {
    console.log('🔍 Checking Database Updates...\n');

    try {
        await db.$connect();

        // Check market data count
        const marketDataCount = await db.marketData.count();
        console.log(`📊 Total Market Data Records: ${marketDataCount}`);

        // Check recent market data
        const recentMarketData = await db.marketData.findMany({
            orderBy: { timestamp: 'desc' },
            take: 5,
            include: { instrument: true }
        });

        if (recentMarketData.length > 0) {
            console.log('\n📈 Recent Market Data:');
            console.log('=====================');

            recentMarketData.forEach((data, index) => {
                console.log(`${index + 1}. ${data.instrument.symbol}: ₹${data.close} at ${data.timestamp.toLocaleString()}`);
            });

            const latest = recentMarketData[0]!;
            const now = new Date();
            const timeDiff = now.getTime() - latest.timestamp.getTime();

            console.log(`\n⏱️  Latest data is ${Math.round(timeDiff / 1000)} seconds old`);

            if (timeDiff < 60) {
                console.log('✅ Database is being updated with LIVE data!');
            } else if (timeDiff < 300) {
                console.log('⚠️  Database has recent data but may not be live');
            } else {
                console.log('❌ Database data is old');
            }
        }

        // Check candle data count
        const candleDataCount = await db.candleData.count();
        console.log(`\n🕯️  Total Candle Data Records: ${candleDataCount}`);

        // Check recent candle data
        const recentCandleData = await db.candleData.findMany({
            orderBy: { timestamp: 'desc' },
            take: 3,
            include: { instrument: true, timeframe: true }
        });

        if (recentCandleData.length > 0) {
            console.log('\n📊 Recent Candle Data:');
            console.log('=====================');

            recentCandleData.forEach((candle, index) => {
                console.log(`${index + 1}. ${candle.instrument.symbol} (${candle.timeframe.name}): ₹${candle.close} at ${candle.timestamp.toLocaleString()}`);
            });
        }

        // Check if data is being added continuously
        console.log('\n🔄 Checking for continuous updates...');

        const oneMinuteAgo = new Date(Date.now() - 60000);
        const recentUpdates = await db.marketData.count({
            where: {
                timestamp: {
                    gte: oneMinuteAgo
                }
            }
        });

        console.log(`📊 Records added in last minute: ${recentUpdates}`);

        if (recentUpdates > 0) {
            console.log('✅ Database is actively being updated!');
        } else {
            console.log('❌ No recent updates detected');
        }

    } catch (error) {
        console.error('❌ Error checking database:', error);
    } finally {
        await db.$disconnect();
    }
}

checkDatabaseUpdates(); 