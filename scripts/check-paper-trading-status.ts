#!/usr/bin/env ts-node

import { db } from '../src/database/database';

async function checkPaperTradingStatus() {
    console.log('🔍 CHECKING PAPER TRADING STATUS\n');

    try {
        await db.$connect();

        // Check if paper trading is running
        const processes = await new Promise<string>((resolve) => {
            const { exec } = require('child_process');
            exec('ps aux | grep enhanced-paper-trading | grep -v grep', (error: any, stdout: string) => {
                resolve(stdout);
            });
        });

        if (processes.trim()) {
            console.log('✅ Enhanced Paper Trading is RUNNING');
            console.log('📊 Process Info:');
            console.log(processes);
        } else {
            console.log('❌ Enhanced Paper Trading is NOT RUNNING');
        }

        // Check recent market data updates
        console.log('\n📈 RECENT MARKET DATA UPDATES:');
        const recentData = await db.marketData.findMany({
            take: 5,
            orderBy: { timestamp: 'desc' },
            include: { instrument: true }
        });

        if (recentData.length > 0) {
            console.log('✅ Database is being updated with live data:');
            recentData.forEach(data => {
                console.log(`   ${data.instrument.symbol}: ₹${data.close} at ${data.timestamp.toLocaleTimeString()}`);
            });
        } else {
            console.log('❌ No recent market data found');
        }

        // Check if we're in trading hours
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();

        console.log('\n⏰ TRADING HOURS CHECK:');
        console.log(`   Current Time: ${now.toLocaleString()}`);
        console.log(`   Hour: ${hour}:00`);
        console.log(`   Day: ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]}`);

        const shouldTrade = hour >= 14 && hour <= 15 && day !== 5;
        console.log(`   Should Trade: ${shouldTrade ? '✅ YES' : '❌ NO'}`);

        if (shouldTrade) {
            console.log('   📊 Paper trading should be active during 2:00-3:00 PM (except Fridays)');
        } else {
            console.log('   ⏸️ Paper trading is paused (outside trading hours or Friday)');
        }

        // Check for any paper trading results
        console.log('\n📋 PAPER TRADING RESULTS:');
        const resultsFiles = await new Promise<string[]>((resolve) => {
            const { exec } = require('child_process');
            exec('ls -la data/paper-trading-results/ | grep enhanced-paper-trading', (error: any, stdout: string) => {
                if (stdout.trim()) {
                    resolve(stdout.trim().split('\n'));
                } else {
                    resolve([]);
                }
            });
        });

        if (resultsFiles.length > 0) {
            console.log('✅ Paper trading results found:');
            resultsFiles.forEach(file => console.log(`   ${file}`));
        } else {
            console.log('📝 No paper trading results yet (may be still running)');
        }

    } catch (error) {
        console.error('❌ Error checking status:', error);
    } finally {
        await db.$disconnect();
    }
}

if (require.main === module) {
    checkPaperTradingStatus();
} 