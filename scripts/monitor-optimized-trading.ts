#!/usr/bin/env ts-node

import { db } from '../src/database/database';
import { join } from 'path';

async function monitorOptimizedTrading() {
    console.log('📊 OPTIMIZED PAPER TRADING MONITOR\n');
    console.log('🎯 Strategy: Smart Timeframe Checking');
    console.log('⏰ Trading Hours: 2:00-3:00 PM (except Fridays)');
    console.log('💰 Capital: ₹100,000');
    console.log('📈 Position Size: 10% per trade');
    console.log('');

    try {
        await db.$connect();

        while (true) {
            const now = new Date();

            // Clear console
            console.clear();
            console.log('📊 OPTIMIZED PAPER TRADING MONITOR\n');
            console.log(`⏰ Last Updated: ${now.toLocaleTimeString()}`);
            console.log('');

            // Check if optimized paper trading is running
            const processes = await new Promise<string>((resolve) => {
                const { exec } = require('child_process');
                exec('ps aux | grep optimized-paper-trading | grep -v grep', (error: any, stdout: string) => {
                    resolve(stdout);
                });
            });

            if (processes.trim()) {
                console.log('✅ OPTIMIZED PAPER TRADING STATUS: RUNNING');
                console.log('📊 Process Active: Yes');
            } else {
                console.log('❌ OPTIMIZED PAPER TRADING STATUS: STOPPED');
                console.log('📊 Process Active: No');
            }

            // Check trading hours
            const hour = now.getHours();
            const day = now.getDay();
            const shouldTrade = hour >= 14 && hour <= 15 && day !== 5;

            console.log(`\n⏰ TRADING HOURS: ${shouldTrade ? '✅ ACTIVE' : '⏸️ PAUSED'}`);
            console.log(`   Current Time: ${now.toLocaleString()}`);
            console.log(`   Trading Window: 2:00-3:00 PM (except Fridays)`);

            // Show timeframe checking schedule
            console.log('\n⏰ TIMEFRAME CHECKING SCHEDULE:');
            console.log('==============================');

            const minutes = now.getMinutes();
            const seconds = now.getSeconds();

            // 15min timeframe check
            const check15min = minutes % 5 === 0 && seconds < 30;
            console.log(`🕐 15min timeframe: ${check15min ? '✅ CHECKING NOW' : '⏸️ Waiting'} (Every 5 min at :00, :05, :10, :15, etc.)`);

            // 30min timeframe check
            const check30min = (minutes % 15 === 0) && seconds < 30;
            console.log(`🕐 30min timeframe: ${check30min ? '✅ CHECKING NOW' : '⏸️ Waiting'} (Every 15 min at :00, :15, :30, :45)`);

            // 1hour timeframe check
            const check1hour = (minutes % 30 === 0) && seconds < 30;
            console.log(`🕐 1hour timeframe: ${check1hour ? '✅ CHECKING NOW' : '⏸️ Waiting'} (Every 30 min at :00, :30)`);

            // 1day timeframe check
            const check1day = hour === 9 && minutes === 0 && seconds < 30;
            console.log(`🕐 1day timeframe: ${check1day ? '✅ CHECKING NOW' : '⏸️ Waiting'} (Once per day at 9:00 AM)`);

            // Show next check times
            console.log('\n⏰ NEXT CHECK TIMES:');
            console.log('===================');

            const next15min = 5 - (minutes % 5);
            const next30min = 15 - (minutes % 15);
            const next1hour = 30 - (minutes % 30);

            console.log(`🕐 15min: ${next15min} minutes (at ${Math.floor(minutes / 5) * 5 + 5}:00)`);
            console.log(`🕐 30min: ${next30min} minutes (at ${Math.floor(minutes / 15) * 15 + 15}:00)`);
            console.log(`🕐 1hour: ${next1hour} minutes (at ${Math.floor(minutes / 30) * 30 + 30}:00)`);

            // Check for results file
            console.log('\n📋 PAPER TRADING RESULTS:');
            const resultsDir = join(__dirname, '..', 'data', 'paper-trading-results');
            const files = await new Promise<string[]>((resolve) => {
                const { exec } = require('child_process');
                exec('ls -la data/paper-trading-results/ | grep optimized-paper-trading', (error: any, stdout: string) => {
                    if (stdout.trim()) {
                        resolve(stdout.trim().split('\n'));
                    } else {
                        resolve([]);
                    }
                });
            });

            if (files.length > 0) {
                console.log('✅ Optimized paper trading results found:');
                files.forEach(file => console.log(`   📄 ${file}`));
            } else {
                console.log('📝 No optimized paper trading results yet (may be still running)');
            }

            // Check recent market data
            console.log('\n📈 MARKET DATA STATUS:');
            const recentData = await db.marketData.findMany({
                take: 3,
                orderBy: { timestamp: 'desc' },
                include: { instrument: true }
            });

            if (recentData.length > 0) {
                console.log('✅ Database has recent market data:');
                recentData.forEach(data => {
                    console.log(`   ${data.instrument.symbol}: ₹${data.close} at ${data.timestamp.toLocaleTimeString()}`);
                });
            } else {
                console.log('❌ No recent market data in database');
            }

            // Check candle data
            const recentCandles = await db.candleData.findMany({
                take: 3,
                orderBy: { timestamp: 'desc' },
                include: { instrument: true, timeframe: true }
            });

            if (recentCandles.length > 0) {
                console.log('\n🕯️ RECENT CANDLE DATA:');
                recentCandles.forEach(candle => {
                    console.log(`   ${candle.instrument.symbol} (${candle.timeframe.name}): ₹${candle.close} at ${candle.timestamp.toLocaleTimeString()}`);
                });
            } else {
                console.log('\n🕯️ CANDLE DATA: No recent candle data');
            }

            console.log('\n🔄 Monitoring... (Press Ctrl+C to stop)');

            // Wait 10 seconds before next check
            await new Promise(resolve => setTimeout(resolve, 10000));
        }

    } catch (error) {
        console.error('❌ Error monitoring optimized trading:', error);
    } finally {
        await db.$disconnect();
    }
}

if (require.main === module) {
    monitorOptimizedTrading();
} 