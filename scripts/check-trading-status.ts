#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { startTradingSystem, getSystemStatus } from '../src/index';
import { ConfigManager } from '../src/config/config-manager';
import { logger } from '../src/logger/logger';

// Load environment variables
config();

async function checkTradingStatus() {
    try {
        logger.info('🔍 Checking trading system status...');

        // Get system status
        const status = await getSystemStatus();

        console.log('\n📊 TRADING SYSTEM STATUS');
        console.log('========================');

        // System Status
        console.log(`\n🖥️  System Status:`);
        console.log(`   Name: ${status.system.name}`);
        console.log(`   Version: ${status.system.version}`);
        console.log(`   Uptime: ${Math.floor(status.system.uptime / 60)} minutes`);
        console.log(`   Memory Usage: ${Math.round(status.system.memory.heapUsed / 1024 / 1024)} MB`);
        console.log(`   Timestamp: ${status.system.timestamp}`);

        // Database Status
        console.log(`\n🗄️  Database Status:`);
        console.log(`   Connected: ${status.database.connected ? '🟢 YES' : '🔴 NO'}`);
        console.log(`   Status: ${status.database.status}`);

        // Cache Status
        console.log(`\n💾 Cache Status:`);
        console.log(`   Status: ${status.cache.status}`);

        // Performance Status
        console.log(`\n⚡ Performance Status:`);
        console.log(`   Monitoring Active: ${status.performance.active ? '🟢 YES' : '🔴 NO'}`);
        console.log(`   Metrics Available: ${Object.keys(status.performance.metrics).length}`);

        // Telegram Status
        console.log(`\n📱 Telegram Status:`);
        console.log(`   Enabled: ${status.telegram.enabled ? '🟢 YES' : '🔴 NO'}`);
        console.log(`   Configured: ${status.telegram.configured ? '🟢 YES' : '🔴 NO'}`);

        // Trading API Status
        console.log(`\n🔗 Trading API Status:`);
        console.log(`   API Configured: ${status.trading.apiConfigured ? '🟢 YES' : '🔴 NO'}`);
        console.log(`   Access Token: ${status.trading.accessToken ? '🟢 AVAILABLE' : '🔴 MISSING'}`);

        // Environment Variables Check
        console.log(`\n🔧 Environment Variables:`);
        console.log(`   TRADING_CAPITAL: ${process.env.TRADING_CAPITAL || '🔴 NOT SET'}`);
        console.log(`   MAX_RISK_PER_TRADE: ${process.env.MAX_RISK_PER_TRADE || '🔴 NOT SET'}`);
        console.log(`   MAX_DAILY_LOSS: ${process.env.MAX_DAILY_LOSS || '🔴 NOT SET'}`);
        console.log(`   TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? '🟢 SET' : '🔴 NOT SET'}`);
        console.log(`   TELEGRAM_CHAT_ID: ${process.env.TELEGRAM_CHAT_ID ? '🟢 SET' : '🔴 NOT SET'}`);

        // Recommendations
        console.log(`\n💡 Recommendations:`);
        if (!status.telegram.configured) {
            console.log(`   ⚠️  Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID for notifications`);
        }
        if (!status.trading.apiConfigured) {
            console.log(`   ⚠️  Configure KITE_API_KEY and KITE_API_SECRET for trading`);
        }
        if (!status.trading.accessToken) {
            console.log(`   ⚠️  Set KITE_ACCESS_TOKEN for API access`);
        }
        if (!process.env.TRADING_CAPITAL) {
            console.log(`   ⚠️  Set TRADING_CAPITAL environment variable`);
        }

        console.log(`\n✅ Status check completed successfully!`);

    } catch (error) {
        logger.error('❌ Failed to check trading status:', error);
        console.error('❌ Error checking status:', error);
    }
}

// Run the status check
if (require.main === module) {
    checkTradingStatus()
        .then(() => {
            console.log('\n🎯 Status check completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Status check failed:', error);
            process.exit(1);
        });
} 