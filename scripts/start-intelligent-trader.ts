#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { IntelligentAutoTrader } from '../src/services/intelligent-auto-trader.service';
import { ConfigManager } from '../src/config/config-manager';
import { logger } from '../src/logger/logger';

// Load environment variables
config();

async function startIntelligentTrader() {
    try {
        logger.info('🚀 Starting Intelligent Auto-Trader...');

        // Load configuration
        const configManager = new ConfigManager();
        const baseConfig = await configManager.getConfig();

        // Create intelligent trader configuration
        const traderConfig = {
            // API Configuration
            apiKey: process.env.ZERODHA_API_KEY || '',
            apiSecret: process.env.ZERODHA_API_SECRET || '',
            accessToken: process.env.ZERODHA_ACCESS_TOKEN || '',

            // Trading Parameters
            capital: 100000,
            maxRiskPerTrade: 0.02, // 2% per trade
            maxDailyLoss: 0.05,    // 5% daily loss limit
            maxOpenPositions: 5,

            // Market Analysis
            instruments: ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'INFY'],
            analysisInterval: 30, // 30 seconds
            signalConfidence: 0.7, // 70% minimum confidence

            // Risk Management
            riskLimits: {
                maxPortfolioVar: 0.02,    // 2% portfolio VaR
                maxPositionVar: 0.005,    // 0.5% position VaR
                maxDrawdown: 0.15,        // 15% max drawdown
                maxLeverage: 2.0,         // 2x leverage
                maxConcentration: 0.25    // 25% max concentration
            },

            // Strategy Configuration
            strategies: {
                'MovingAverage': {
                    enabled: true,
                    weight: 0.3,
                    allocation: 0.3,
                    parameters: {
                        shortPeriod: 10,
                        longPeriod: 20,
                        stopLoss: 0.02,
                        takeProfit: 0.04
                    }
                },
                'RSI': {
                    enabled: true,
                    weight: 0.25,
                    allocation: 0.25,
                    parameters: {
                        period: 14,
                        overbought: 70,
                        oversold: 30,
                        stopLoss: 0.02,
                        takeProfit: 0.04
                    }
                },
                'Breakout': {
                    enabled: true,
                    weight: 0.25,
                    allocation: 0.25,
                    parameters: {
                        period: 20,
                        multiplier: 2,
                        stopLoss: 0.02,
                        takeProfit: 0.04
                    }
                },
                'ML': {
                    enabled: true,
                    weight: 0.2,
                    allocation: 0.2,
                    parameters: {
                        lookbackPeriod: 50,
                        predictionHorizon: 5,
                        confidenceThreshold: 0.7,
                        retrainInterval: 30
                    }
                }
            },

            // Market Conditions
            marketConditions: {
                volatilityThreshold: 0.03,    // 3% volatility
                volumeThreshold: 0.5,         // 50% of average volume
                trendStrengthThreshold: 0.6,  // 60% trend strength
                correlationThreshold: 0.7     // 70% correlation
            },

            // Execution Settings
            execution: {
                enableRealTrading: false,     // Set to true for live trading
                paperTrading: true,           // Paper trading mode
                slippageTolerance: 0.001,     // 0.1% slippage
                retryAttempts: 3,
                orderTimeout: 30000           // 30 seconds
            },

            // Notifications
            telegram: {
                enabled: true,
                botToken: process.env.TELEGRAM_BOT_TOKEN || '',
                chatId: process.env.TELEGRAM_CHAT_ID || '',
                updateInterval: 300, // 5 minutes
                notifications: {
                    tradeSignals: true,
                    tradeExecutions: true,
                    positionUpdates: true,
                    performanceUpdates: true,
                    systemAlerts: true,
                    dailyReports: true,
                    errorAlerts: true
                }
            }
        };

        // Validate configuration
        if (!traderConfig.apiKey || !traderConfig.apiSecret) {
            throw new Error('Zerodha API credentials not configured');
        }

        if (traderConfig.telegram.enabled && (!traderConfig.telegram.botToken || !traderConfig.telegram.chatId)) {
            throw new Error('Telegram configuration incomplete');
        }

        // Create and initialize intelligent trader
        const trader = new IntelligentAutoTrader(traderConfig);
        await trader.initialize();

        // Start trading
        await trader.startTrading();

        console.log('\n🤖 INTELLIGENT AUTO-TRADER STARTED');
        console.log('====================================');
        console.log(`💰 Capital: ₹${traderConfig.capital.toLocaleString()}`);
        console.log(`📊 Instruments: ${traderConfig.instruments.join(', ')}`);
        console.log(`🎯 Strategies: ${Object.keys(traderConfig.strategies).length}`);
        console.log(`⚡ Analysis Interval: ${traderConfig.analysisInterval}s`);
        console.log(`🎲 Mode: ${traderConfig.execution.paperTrading ? 'Paper Trading' : 'Live Trading'}`);
        console.log(`📱 Notifications: ${traderConfig.telegram.enabled ? 'Enabled' : 'Disabled'}`);

        console.log('\n📈 Monitoring active...');
        console.log('Press Ctrl+C to stop trading');

        // Set up graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Stopping Intelligent Auto-Trader...');
            await trader.stopTrading();

            const status = trader.getStatus();
            console.log('\n📊 Final Status:');
            console.log(`   Total P&L: ₹${status.totalPnL.toFixed(2)}`);
            console.log(`   Total Trades: ${status.totalTrades}`);
            console.log(`   Win Rate: ${status.winRate.toFixed(2)}%`);
            console.log(`   Active Positions: ${status.activePositions}`);

            process.exit(0);
        });

        // Status monitoring loop
        setInterval(() => {
            const status = trader.getStatus();
            console.log(`\n📊 Status Update - P&L: ₹${status.totalPnL.toFixed(2)} | Trades: ${status.totalTrades} | Win Rate: ${status.winRate.toFixed(1)}% | Positions: ${status.activePositions}`);
        }, 300000); // Every 5 minutes

    } catch (error) {
        logger.error('Failed to start Intelligent Auto-Trader:', error);
        console.error('❌ Error starting Intelligent Auto-Trader:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    startIntelligentTrader();
}

export { startIntelligentTrader }; 