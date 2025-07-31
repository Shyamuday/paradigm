#!/usr/bin/env ts-node

import { db } from '../src/database/database';
import { logger } from '../src/logger/logger';

class DataSourceChecker {
    private symbols = [
        'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN',
        'BHARTIARTL', 'KOTAKBANK', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'HCLTECH', 'SUNPHARMA'
    ];

    async checkDataSource(): Promise<void> {
        console.log('🔍 Checking Data Source...\n');

        try {
            await db.$connect();

            // Check recent market data
            await this.checkRecentMarketData();

            // Check data patterns
            await this.checkDataPatterns();

            // Check data timestamps
            await this.checkDataTimestamps();

        } catch (error) {
            console.error('❌ Error checking data source:', error);
        } finally {
            await db.$disconnect();
        }
    }

    private async checkRecentMarketData(): Promise<void> {
        console.log('📊 Recent Market Data Analysis:');
        console.log('================================');

        for (const symbol of this.symbols.slice(0, 3)) { // Check first 3 symbols
            try {
                const recentData = await db.marketData.findMany({
                    where: {
                        symbol: symbol
                    },
                    orderBy: {
                        timestamp: 'desc'
                    },
                    take: 10
                });

                if (recentData.length > 0) {
                    console.log(`\n📈 ${symbol}:`);
                    console.log(`   Recent entries: ${recentData.length}`);

                    const latest = recentData[0];
                    const oldest = recentData[recentData.length - 1];
                    const timeDiff = latest.timestamp.getTime() - oldest.timestamp.getTime();

                    console.log(`   Latest: ${latest.timestamp.toLocaleString()}`);
                    console.log(`   Oldest: ${oldest.timestamp.toLocaleString()}`);
                    console.log(`   Time span: ${Math.round(timeDiff / 1000)} seconds`);
                    console.log(`   Price range: ₹${Math.min(...recentData.map(d => d.ltp || 0)).toFixed(2)} - ₹${Math.max(...recentData.map(d => d.ltp || 0)).toFixed(2)}`);

                    // Check if data looks realistic
                    const priceChanges = recentData.slice(1).map((d, i) => {
                        const prev = recentData[i];
                        return Math.abs((d.ltp || 0) - (prev.ltp || 0)) / (prev.ltp || 1);
                    });

                    const avgChange = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
                    console.log(`   Avg price change: ${(avgChange * 100).toFixed(2)}%`);

                    if (avgChange > 0.1) { // More than 10% average change
                        console.log(`   ⚠️  High volatility - likely mock data`);
                    } else if (avgChange < 0.001) { // Less than 0.1% average change
                        console.log(`   ⚠️  Very low volatility - likely mock data`);
                    } else {
                        console.log(`   ✅ Realistic volatility - could be real data`);
                    }
                } else {
                    console.log(`\n📈 ${symbol}: No recent data`);
                }

            } catch (error) {
                console.log(`\n📈 ${symbol}: Error checking data`);
            }
        }
    }

    private async checkDataPatterns(): Promise<void> {
        console.log('\n🔍 Data Pattern Analysis:');
        console.log('=========================');

        try {
            // Check for repetitive patterns in mock data
            const allRecentData = await db.marketData.findMany({
                orderBy: {
                    timestamp: 'desc'
                },
                take: 100
            });

            if (allRecentData.length > 0) {
                // Check for exact price repetitions
                const prices = allRecentData.map(d => d.ltp || 0);
                const uniquePrices = new Set(prices);
                const repetitionRate = 1 - (uniquePrices.size / prices.length);

                console.log(`📊 Total recent entries: ${allRecentData.length}`);
                console.log(`📊 Unique prices: ${uniquePrices.size}`);
                console.log(`📊 Price repetition rate: ${(repetitionRate * 100).toFixed(1)}%`);

                if (repetitionRate > 0.3) {
                    console.log(`   ⚠️  High repetition rate - likely mock data`);
                } else {
                    console.log(`   ✅ Low repetition rate - could be real data`);
                }

                // Check for regular time intervals
                const timestamps = allRecentData.map(d => d.timestamp.getTime()).sort((a, b) => a - b);
                const intervals = timestamps.slice(1).map((time, i) => time - timestamps[i]);
                const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;

                console.log(`📊 Average time interval: ${Math.round(avgInterval / 1000)} seconds`);

                if (Math.abs(avgInterval - 1000) < 100) { // Around 1 second
                    console.log(`   ⚠️  Regular 1-second intervals - likely mock data generator`);
                } else {
                    console.log(`   ✅ Irregular intervals - could be real market data`);
                }
            }

        } catch (error) {
            console.error('❌ Error analyzing data patterns:', error);
        }
    }

    private async checkDataTimestamps(): Promise<void> {
        console.log('\n🕐 Data Timestamp Analysis:');
        console.log('===========================');

        try {
            const now = new Date();
            const recentData = await db.marketData.findMany({
                orderBy: {
                    timestamp: 'desc'
                },
                take: 1
            });

            if (recentData.length > 0) {
                const latestTimestamp = recentData[0].timestamp;
                const timeDiff = now.getTime() - latestTimestamp.getTime();

                console.log(`📊 Current time: ${now.toLocaleString()}`);
                console.log(`📊 Latest data: ${latestTimestamp.toLocaleString()}`);
                console.log(`📊 Time difference: ${Math.round(timeDiff / 1000)} seconds`);

                if (timeDiff < 60) { // Less than 1 minute
                    console.log(`   ✅ Data is very recent - could be live`);
                } else if (timeDiff < 300) { // Less than 5 minutes
                    console.log(`   ⚠️  Data is recent but not live`);
                } else {
                    console.log(`   ❌ Data is old - not live`);
                }

                // Check if data is from market hours
                const hour = latestTimestamp.getHours();
                const isMarketHours = (hour >= 9 && hour < 15) || (hour >= 15 && hour < 16);

                if (isMarketHours) {
                    console.log(`   📈 Data from market hours`);
                } else {
                    console.log(`   🌙 Data from outside market hours`);
                }
            }

        } catch (error) {
            console.error('❌ Error checking timestamps:', error);
        }
    }
}

// Main execution
async function main() {
    const checker = new DataSourceChecker();
    await checker.checkDataSource();
}

if (require.main === module) {
    main();
} 