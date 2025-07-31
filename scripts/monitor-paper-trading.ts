#!/usr/bin/env ts-node

import { db } from '../src/database/database';
import * as fs from 'fs/promises';
import * as path from 'path';

async function monitorPaperTrading() {
    console.log('📊 ENHANCED PAPER TRADING MONITOR\n');
    console.log('🎯 Strategy: Conservative (98.6% Success Rate)');
    console.log('⏰ Trading Hours: 2:00-3:00 PM (except Fridays)');
    console.log('💰 Capital: ₹100,000');
    console.log('📈 Position Size: 10% per trade');
    console.log('🛡️ Max Daily Loss: ₹1,000');
    console.log('📦 Max Positions: 5');
    console.log('');

    try {
        await db.$connect();

        let lastCheck = new Date();

        while (true) {
            const now = new Date();

            // Clear console (optional)
            console.clear();
            console.log('📊 ENHANCED PAPER TRADING MONITOR\n');
            console.log(`⏰ Last Updated: ${now.toLocaleTimeString()}`);
            console.log('');

            // Check if paper trading is running
            const processes = await new Promise<string>((resolve) => {
                const { exec } = require('child_process');
                exec('ps aux | grep enhanced-paper-trading | grep -v grep', (error: any, stdout: string) => {
                    resolve(stdout);
                });
            });

            if (processes.trim()) {
                console.log('✅ PAPER TRADING STATUS: RUNNING');
                console.log('📊 Process Active: Yes');
            } else {
                console.log('❌ PAPER TRADING STATUS: STOPPED');
                console.log('📊 Process Active: No');
            }

            // Check trading hours
            const hour = now.getHours();
            const day = now.getDay();
            const shouldTrade = hour >= 14 && hour <= 15 && day !== 5;

            console.log(`\n⏰ TRADING HOURS: ${shouldTrade ? '✅ ACTIVE' : '⏸️ PAUSED'}`);
            console.log(`   Current Time: ${now.toLocaleString()}`);
            console.log(`   Trading Window: 2:00-3:00 PM (except Fridays)`);

            // Check for results file
            const resultsDir = path.join(__dirname, '..', 'data', 'paper-trading-results');
            const files = await fs.readdir(resultsDir);
            const paperTradingFiles = files.filter(f => f.includes('enhanced-paper-trading'));

            if (paperTradingFiles.length > 0) {
                console.log('\n📋 PAPER TRADING RESULTS:');
                for (const file of paperTradingFiles) {
                    const filePath = path.join(resultsDir, file);
                    const stats = await fs.stat(filePath);
                    console.log(`   📄 ${file} (${stats.size} bytes, ${stats.mtime.toLocaleTimeString()})`);

                    // Try to read and display summary
                    try {
                        const content = await fs.readFile(filePath, 'utf8');
                        const data = JSON.parse(content);
                        if (data.session) {
                            const session = data.session;
                            const successRate = session.totalTrades > 0
                                ? (session.successfulTrades / session.totalTrades * 100).toFixed(1)
                                : '0.0';

                            console.log(`      💰 Capital: ₹${session.currentCapital?.toFixed(2) || 'N/A'}`);
                            console.log(`      📊 Trades: ${session.totalTrades || 0} (${session.successfulTrades || 0}✅ ${session.failedTrades || 0}❌)`);
                            console.log(`      🎯 Success Rate: ${successRate}%`);
                            console.log(`      📈 Total P&L: ₹${session.totalPnl?.toFixed(2) || '0.00'}`);
                            console.log(`      📦 Open Positions: ${session.openPositions?.length || 0}`);
                        }
                    } catch (e) {
                        console.log(`      📄 File exists but couldn't parse content`);
                    }
                }
            } else {
                console.log('\n📋 PAPER TRADING RESULTS: No results file yet (may be still running)');
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
        console.error('❌ Error monitoring paper trading:', error);
    } finally {
        await db.$disconnect();
    }
}

if (require.main === module) {
    monitorPaperTrading();
} 