#!/usr/bin/env ts-node

import { TelegramNotificationService } from '../src/services/telegram-notification.service';
import { logger } from '../src/logger/logger';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testTelegramNotifications() {
    logger.info('🧪 Testing Telegram Notifications...');

    // Validate environment variables
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
        logger.error('❌ Missing Telegram configuration:');
        logger.error('   TELEGRAM_BOT_TOKEN:', botToken ? '✅ Set' : '❌ Missing');
        logger.error('   TELEGRAM_CHAT_ID:', chatId ? '✅ Set' : '❌ Missing');
        logger.error('');
        logger.error('Please add these to your .env file:');
        logger.error('TELEGRAM_BOT_TOKEN=your_bot_token_here');
        logger.error('TELEGRAM_CHAT_ID=your_chat_id_here');
        process.exit(1);
    }

    // Create Telegram service
    const telegramConfig = {
        botToken,
        chatId,
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
    };

    const telegramService = new TelegramNotificationService(telegramConfig);

    try {
        // Test connection
        logger.info('🔗 Testing bot connection...');
        const isConnected = await telegramService.testConnection();

        if (!isConnected) {
            logger.error('❌ Failed to connect to Telegram bot');
            logger.error('Please check your bot token and try again');
            process.exit(1);
        }

        logger.info('✅ Bot connection successful');

        // Initialize service
        await telegramService.initialize();

        // Test different notification types
        logger.info('📱 Testing notification types...');

        // 1. Test trade signal
        logger.info('Testing trade signal notification...');
        await telegramService.sendTradeSignal({
            symbol: 'NIFTY',
            action: 'BUY',
            price: 19250.00,
            confidence: 85,
            reasoning: 'Short MA (19200) crossed above Long MA (19150)',
            strategy: 'Moving Average Crossover'
        });

        await sleep(2000);

        // 2. Test trade execution
        logger.info('Testing trade execution notification...');
        await telegramService.sendTradeExecution({
            symbol: 'NIFTY',
            action: 'BUY',
            quantity: 50,
            price: 19250.00,
            orderId: 'TEST123456',
            status: 'SUCCESS'
        });

        await sleep(2000);

        // 3. Test position update
        logger.info('Testing position update notification...');
        await telegramService.sendPositionUpdate([
            {
                symbol: 'NIFTY',
                side: 'LONG',
                quantity: 50,
                entryPrice: 19250.00,
                currentPrice: 19300.00,
                unrealizedPnL: 2500.00,
                unrealizedPnLPercent: 2.60
            }
        ]);

        await sleep(2000);

        // 4. Test performance update
        logger.info('Testing performance update notification...');
        await telegramService.sendPerformanceUpdate({
            totalPnL: 15250.00,
            dailyPnL: 2500.00,
            winRate: 65.5,
            totalTrades: 45,
            openPositions: 2,
            capital: 100000.00
        });

        await sleep(2000);

        // 5. Test system alert
        logger.info('Testing system alert notification...');
        await telegramService.sendSystemAlert({
            type: 'INFO',
            message: 'This is a test system alert',
            timestamp: new Date()
        });

        await sleep(2000);

        // 6. Test error alert
        logger.info('Testing error alert notification...');
        await telegramService.sendErrorAlert(
            new Error('This is a test error message'),
            'Telegram Test'
        );

        await sleep(2000);

        // 7. Test daily report
        logger.info('Testing daily report notification...');
        await telegramService.sendDailyReport({
            totalPnL: 15250.00,
            dailyPnL: 2500.00,
            winRate: 65.5,
            totalTrades: 45,
            winningTrades: 30,
            losingTrades: 15,
            averageWin: 850.00,
            averageLoss: 350.00,
            largestWin: 2500.00,
            largestLoss: 800.00,
            sharpeRatio: 1.85,
            maxDrawdown: 8.5,
            bestStrategy: 'Moving Average Crossover',
            bestStrategyPnL: 8500.00
        });

        await sleep(2000);

        // 8. Test market update
        logger.info('Testing market update notification...');
        await telegramService.sendMarketUpdate([
            {
                symbol: 'NIFTY',
                open: 19200.00,
                high: 19350.00,
                low: 19150.00,
                close: 19300.00,
                volume: 1500000
            },
            {
                symbol: 'BANKNIFTY',
                open: 44500.00,
                high: 44800.00,
                low: 44400.00,
                close: 44700.00,
                volume: 800000
            }
        ]);

        await sleep(2000);

        // 9. Test strategy status
        logger.info('Testing strategy status notification...');
        await telegramService.sendStrategyStatus([
            {
                name: 'Moving Average Crossover',
                isHealthy: true,
                performance: 8500.00,
                signals: 25,
                errors: 0,
                lastExecution: '2024-01-15 14:30:00'
            },
            {
                name: 'RSI Mean Reversion',
                isHealthy: true,
                performance: 6750.00,
                signals: 20,
                errors: 1,
                lastExecution: '2024-01-15 14:30:00'
            }
        ]);

        await sleep(2000);

        // 10. Test custom message
        logger.info('Testing custom message notification...');
        await telegramService.sendCustomMessage(`
🧪 **TELEGRAM TEST COMPLETED** 🧪

✅ All notification types tested successfully
📱 Your Telegram bot is working perfectly!
🤖 Ready for live trading notifications

⏰ Test completed at ${new Date().toLocaleString()}
        `.trim());

        logger.info('✅ All Telegram notification tests completed successfully!');
        logger.info('');
        logger.info('📱 Check your Telegram chat to see all the test messages');
        logger.info('🚀 Your trading system is ready to send real notifications');

    } catch (error) {
        logger.error('❌ Telegram test failed:', error);
        process.exit(1);
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the test
testTelegramNotifications().catch((error) => {
    logger.error('❌ Fatal error during Telegram test:', error);
    process.exit(1);
}); 