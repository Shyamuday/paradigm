#!/usr/bin/env ts-node

import { db } from '../src/database/database';

async function checkDataSource() {
    console.log('🔍 Checking Data Source...\n');

    try {
        await db.$connect();

        // Check recent market data
        console.log('📊 Recent Market Data:');
        console.log('=====================');

        const recentData = await db.marketData.findMany({
            orderBy: {
                timestamp: 'desc'
            },
            take: 10,
            include: {
                instrument: true
            }
        });

        if (recentData.length > 0) {
            console.log(`📈 Found ${recentData.length} recent entries`);

            const latest = recentData[0];
            const now = new Date();
            const timeDiff = now.getTime() - latest.timestamp.getTime();

            console.log(`🕐 Latest data: ${latest.timestamp.toLocaleString()}`);
            console.log(`🕐 Current time: ${now.toLocaleString()}`);
            console.log(`⏱️  Time difference: ${Math.round(timeDiff / 1000)} seconds`);

            if (timeDiff < 60) {
                console.log('✅ Data is very recent - could be live');
            } else if (timeDiff < 300) {
                console.log('⚠️  Data is recent but not live');
            } else {
                console.log('❌ Data is old - not live');
            }

            // Check data patterns
            console.log('\n🔍 Data Patterns:');
            console.log('================');

            const prices = recentData.map(d => d.close || 0);
            const uniquePrices = new Set(prices);
            const repetitionRate = 1 - (uniquePrices.size / prices.length);

            console.log(`📊 Total entries: ${recentData.length}`);
            console.log(`📊 Unique prices: ${uniquePrices.size}`);
            console.log(`📊 Price repetition rate: ${(repetitionRate * 100).toFixed(1)}%`);

            if (repetitionRate > 0.3) {
                console.log('⚠️  High repetition rate - likely mock data');
            } else {
                console.log('✅ Low repetition rate - could be real data');
            }

            // Check time intervals
            const timestamps = recentData.map(d => d.timestamp.getTime()).sort((a, b) => a - b);
            if (timestamps.length > 1) {
                const intervals = timestamps.slice(1).map((time, i) => time - timestamps[i]);
                const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;

                console.log(`📊 Average time interval: ${Math.round(avgInterval / 1000)} seconds`);

                if (Math.abs(avgInterval - 1000) < 100) {
                    console.log('⚠️  Regular 1-second intervals - likely mock data generator');
                } else {
                    console.log('✅ Irregular intervals - could be real market data');
                }
            }

            // Check symbols
            console.log('\n📈 Symbols with data:');
            console.log('====================');

            const symbols = [...new Set(recentData.map(d => d.instrument.symbol))];
            symbols.forEach(symbol => {
                const symbolData = recentData.filter(d => d.instrument.symbol === symbol);
                console.log(`   ${symbol}: ${symbolData.length} entries`);
            });

        } else {
            console.log('❌ No recent market data found');
        }

        // Check candle data
        console.log('\n🕯️  Recent Candle Data:');
        console.log('======================');

        const recentCandles = await db.candleData.findMany({
            orderBy: {
                timestamp: 'desc'
            },
            take: 5,
            include: {
                instrument: true,
                timeframe: true
            }
        });

        if (recentCandles.length > 0) {
            console.log(`📊 Found ${recentCandles.length} recent candles`);

            const latestCandle = recentCandles[0];
            const candleTimeDiff = new Date().getTime() - latestCandle.timestamp.getTime();

            console.log(`🕐 Latest candle: ${latestCandle.timestamp.toLocaleString()}`);
            console.log(`📊 Timeframe: ${latestCandle.timeframe.name}`);
            console.log(`⏱️  Time difference: ${Math.round(candleTimeDiff / 1000)} seconds`);

            if (candleTimeDiff < 300) {
                console.log('✅ Candle data is recent');
            } else {
                console.log('⚠️  Candle data is old');
            }
        } else {
            console.log('❌ No recent candle data found');
        }

        // Summary
        console.log('\n📋 Summary:');
        console.log('===========');

        if (recentData.length > 0) {
            const timeDiff = new Date().getTime() - recentData[0].timestamp.getTime();
            if (timeDiff < 60) {
                console.log('✅ Data appears to be LIVE/REAL-TIME');
            } else if (timeDiff < 300) {
                console.log('⚠️  Data is RECENT but may not be live');
            } else {
                console.log('❌ Data is OLD - not live');
            }
        } else {
            console.log('❌ No data available');
        }

    } catch (error) {
        console.error('❌ Error checking data source:', error);
    } finally {
        await db.$disconnect();
    }
}

// Run the check
checkDataSource(); 