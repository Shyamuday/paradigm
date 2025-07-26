#!/usr/bin/env ts-node

import { PersonalTradingSystem } from '../src/examples/personal-trading-setup';
import { logger } from '../src/logger/logger';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
    logger.info('🚀 Starting Personal Trading System...');

    // Validate environment variables
    const requiredEnvVars = ['KITE_API_KEY', 'KITE_API_SECRET', 'KITE_ACCESS_TOKEN'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
        logger.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
        logger.error('Please check your .env file');
        process.exit(1);
    }

    // Personal trading configuration
    const config = {
        apiKey: process.env.KITE_API_KEY!,
        apiSecret: process.env.KITE_API_SECRET!,
        accessToken: process.env.KITE_ACCESS_TOKEN!,
        instruments: ['NIFTY', 'BANKNIFTY'],
        capital: parseInt(process.env.TRADING_CAPITAL || '100000'),
        maxRiskPerTrade: parseFloat(process.env.MAX_RISK_PER_TRADE || '0.02'),
        maxDailyLoss: parseInt(process.env.MAX_DAILY_LOSS || '5000'),
        tradingHours: {
            start: '09:15',
            end: '15:30'
        },
        strategies: {
            moving_average: {
                enabled: true,
                allocation: 0.3,
                parameters: {
                    shortPeriod: 10,
                    longPeriod: 20,
                    volumeThreshold: 1000
                }
            },
            rsi: {
                enabled: true,
                allocation: 0.2,
                parameters: {
                    period: 14,
                    overbought: 70,
                    oversold: 30
                }
            }
        },
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
            updateInterval: 5 // 5 minutes
        }
    };

    // Safety checks
    logger.info('🔍 Performing safety checks...');

    if (config.capital < 10000) {
        logger.warn('⚠️  Warning: Trading capital is less than 10K. Consider starting with more capital.');
    }

    if (config.maxRiskPerTrade > 0.05) {
        logger.error('❌ Risk per trade is too high (>5%). Please reduce to 2% or less.');
        process.exit(1);
    }

    if (config.maxDailyLoss > config.capital * 0.1) {
        logger.error('❌ Daily loss limit is too high (>10% of capital). Please reduce.');
        process.exit(1);
    }

    logger.info('✅ Safety checks passed');

    // Create trading system
    const tradingSystem = new PersonalTradingSystem(config);

    try {
        // Initialize system
        logger.info('🔧 Initializing trading system...');
        await tradingSystem.initialize();

        // Check if within trading hours
        const status = tradingSystem.getStatus();
        if (!status.tradingHours) {
            logger.warn('⚠️  Outside trading hours. System will wait until market opens.');
        }

        // Start trading
        logger.info('📈 Starting trading...');
        await tradingSystem.startTrading();

        // Keep the system running and monitor
        logger.info('🔄 Trading system is running. Press Ctrl+C to stop.');

        const statusInterval = setInterval(() => {
            const currentStatus = tradingSystem.getStatus();
            logger.info('📊 Status Update:', {
                isRunning: currentStatus.isRunning,
                positions: currentStatus.currentPositions,
                dailyPnL: currentStatus.dailyPnL.toFixed(2),
                trades: currentStatus.dailyTrades,
                capital: currentStatus.capital
            });

            // Emergency stop conditions
            if (currentStatus.dailyPnL <= -config.maxDailyLoss) {
                logger.error('🚨 Daily loss limit reached! Stopping trading.');
                clearInterval(statusInterval);
                tradingSystem.stopTrading();
                process.exit(1);
            }
        }, 60000); // Update every minute

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('🛑 Received shutdown signal. Stopping trading system...');
            clearInterval(statusInterval);
            await tradingSystem.stopTrading();
            logger.info('✅ Trading system stopped safely');
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('🛑 Received termination signal. Stopping trading system...');
            clearInterval(statusInterval);
            await tradingSystem.stopTrading();
            logger.info('✅ Trading system stopped safely');
            process.exit(0);
        });

    } catch (error) {
        logger.error('❌ Failed to start trading system:', error);
        process.exit(1);
    }
}

// Run the main function
main().catch((error) => {
    logger.error('❌ Fatal error:', error);
    process.exit(1);
}); 