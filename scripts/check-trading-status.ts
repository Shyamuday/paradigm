#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { PersonalTradingSystem } from '../src/examples/personal-trading-setup';
import { ConfigManager } from '../src/config/config-manager';
import { logger } from '../src/logger/logger';

// Load environment variables
config();

async function checkTradingStatus() {
    try {
        logger.info('🔍 Checking trading system status...');

        // Load configuration
        const configManager = new ConfigManager();
        const botConfig = await configManager.getConfig();

        // Create personal trading config from bot config
        const personalConfig = {
            apiKey: process.env.KITE_API_KEY || '',
            apiSecret: process.env.KITE_API_SECRET || '',
            accessToken: process.env.KITE_ACCESS_TOKEN || '',
            instruments: botConfig.marketData.instruments.map(i => i.symbol),
            capital: botConfig.trading.capital,
            maxRiskPerTrade: botConfig.trading.maxPositionSize,
            maxDailyLoss: botConfig.trading.maxDailyLoss,
            tradingHours: {
                start: '09:15',
                end: '15:30'
            },
            strategies: {},
            telegram: {
                botToken: process.env.TELEGRAM_BOT_TOKEN || '',
                chatId: process.env.TELEGRAM_CHAT_ID || '',
                enabled: true,
                notifications: {
                    tradeSignals: true,
                    tradeExecutions: true,
                    positionUpdates: true,
                    performanceUpdates: true,
                    systemAlerts: true,
                    dailyReports: true,
                    errorAlerts: true
                },
                updateInterval: 30
            }
        };

        // Create trading system instance
        const tradingSystem = new PersonalTradingSystem(personalConfig);

        // Check system status
        const status = await tradingSystem.getStatus();

        console.log('\n📊 TRADING SYSTEM STATUS');
        console.log('========================');

        // System Status
        console.log(`\n🖥️  System Status:`);
        console.log(`   Status: ${status.isRunning ? '🟢 RUNNING' : '🔴 STOPPED'}`);
        console.log(`   Trading Hours: ${status.isTradingHours ? '🟢 OPEN' : '🔴 CLOSED'}`);
        console.log(`   Last Update: ${status.lastUpdate}`);

        // API Status
        console.log(`\n🔗 API Status:`);
        console.log(`   Zerodha API: ${status.apiStatus.zerodha ? '🟢 CONNECTED' : '🔴 DISCONNECTED'}`);
        console.log(`   Telegram: ${status.apiStatus.telegram ? '🟢 CONNECTED' : '🔴 DISCONNECTED'}`);
        console.log(`   Database: ${status.apiStatus.database ? '🟢 CONNECTED' : '🔴 DISCONNECTED'}`);

        // Trading Status
        console.log(`\n💰 Trading Status:`);
        console.log(`   Capital: ₹${status.capital.toLocaleString()}`);
        console.log(`   Available Capital: ₹${status.availableCapital.toLocaleString()}`);
        console.log(`   Daily P&L: ${status.dailyPnL >= 0 ? '🟢' : '🔴'} ₹${status.dailyPnL.toLocaleString()}`);
        console.log(`   Total P&L: ${status.totalPnL >= 0 ? '🟢' : '🔴'} ₹${status.totalPnL.toLocaleString()}`);
        console.log(`   Daily Loss Limit: ₹${status.dailyLossLimit.toLocaleString()}`);
        console.log(`   Risk Per Trade: ₹${status.riskPerTrade.toLocaleString()}`);

        // Position Status
        console.log(`\n📈 Position Status:`);
        console.log(`   Active Positions: ${status.positions.length}`);
        console.log(`   Total Positions Value: ₹${status.totalPositionValue.toLocaleString()}`);

        if (status.positions.length > 0) {
            console.log(`\n   Current Positions:`);
            status.positions.forEach((pos, index) => {
                const pnlColor = pos.pnl >= 0 ? '🟢' : '🔴';
                console.log(`   ${index + 1}. ${pos.symbol} (${pos.side}) - Qty: ${pos.quantity} - P&L: ${pnlColor} ₹${pos.pnl.toLocaleString()}`);
            });
        }

        // Strategy Status
        console.log(`\n🎯 Strategy Status:`);
        console.log(`   Active Strategies: ${status.activeStrategies.length}`);
        console.log(`   Total Signals Today: ${status.totalSignalsToday}`);
        console.log(`   Winning Trades: ${status.winningTrades}`);
        console.log(`   Losing Trades: ${status.losingTrades}`);

        if (status.activeStrategies.length > 0) {
            console.log(`\n   Active Strategies:`);
            status.activeStrategies.forEach((strategy, index) => {
                console.log(`   ${index + 1}. ${strategy.name} - Status: ${strategy.status}`);
            });
        }

        // Risk Status
        console.log(`\n⚠️  Risk Status:`);
        console.log(`   Daily Loss Limit Reached: ${status.dailyLossLimitReached ? '🔴 YES' : '🟢 NO'}`);
        console.log(`   Max Positions Reached: ${status.maxPositionsReached ? '🔴 YES' : '🟢 NO'}`);
        console.log(`   Capital Utilization: ${((status.totalPositionValue / status.capital) * 100).toFixed(2)}%`);

        // Performance Metrics
        console.log(`\n📊 Performance Metrics:`);
        console.log(`   Win Rate: ${status.winRate.toFixed(2)}%`);
        console.log(`   Average Win: ₹${status.averageWin.toLocaleString()}`);
        console.log(`   Average Loss: ₹${status.averageLoss.toLocaleString()}`);
        console.log(`   Profit Factor: ${status.profitFactor.toFixed(2)}`);

        // Recent Activity
        console.log(`\n🕒 Recent Activity:`);
        console.log(`   Last Trade: ${status.lastTrade || 'No trades today'}`);
        console.log(`   Last Signal: ${status.lastSignal || 'No signals today'}`);
        console.log(`   Last Error: ${status.lastError || 'No errors'}`);

        console.log('\n✅ Status check completed successfully!');

    } catch (error) {
        logger.error('Failed to check trading status:', error);
        console.error('❌ Error checking trading status:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    checkTradingStatus();
}

export { checkTradingStatus }; 