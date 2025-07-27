#!/usr/bin/env ts-node

import { logger } from '../src/logger/logger';
import { performanceMonitor } from '../src/services/performance-monitor.service';
import { NotificationService } from '../src/services/notification.service';

/**
 * Stop Trading Script
 * Gracefully stops all trading processes and cleans up resources
 */

class TradingStopManager {
    private isStopping: boolean = false;

    async stopTrading(): Promise<void> {
        if (this.isStopping) {
            logger.info('Trading stop already in progress...');
            return;
        }

        this.isStopping = true;
        logger.info('🛑 Stopping trading system...');

        try {
            // 1. Stop performance monitoring
            logger.info('Stopping performance monitoring...');
            performanceMonitor.stop();

            // 2. Stop WebSocket connections
            logger.info('Stopping WebSocket connections...');
            try {
                // WebSocketManager requires KiteConnect instance
                // For now, we'll just log that we're stopping it
                logger.info('WebSocket connections will be closed by process termination');
            } catch (error) {
                logger.warn('WebSocket disconnect error:', error);
            }

            // 3. Stop live data integration
            logger.info('Stopping live data integration...');
            try {
                // LiveDataIntegrationService requires InstrumentsManager and KiteConnect
                // For now, we'll just log that we're stopping it
                logger.info('Live data integration will be stopped by process termination');
            } catch (error) {
                logger.warn('Live data stop error:', error);
            }

            // 4. Send shutdown notification
            logger.info('Sending shutdown notification...');
            try {
                const notificationService = new NotificationService({
                    telegram: {
                        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
                        chatId: process.env.TELEGRAM_CHAT_ID || ''
                    }
                });
                await notificationService.sendSystemAlert({
                    type: 'INFO',
                    message: '🛑 Trading system stopped gracefully',
                    timestamp: new Date()
                });
            } catch (error) {
                logger.warn('Notification error:', error);
            }

            // 5. Close any remaining processes
            logger.info('Closing remaining processes...');
            await this.closeRemainingProcesses();

            logger.info('✅ Trading system stopped successfully');
            process.exit(0);

        } catch (error) {
            logger.error('❌ Error stopping trading system:', error);
            process.exit(1);
        }
    }

    private async closeRemainingProcesses(): Promise<void> {
        // Kill any remaining Node.js processes related to trading
        try {
            const { exec } = require('child_process');
            const util = require('util');
            const execAsync = util.promisify(exec);

            // Find and kill trading-related processes
            const { stdout } = await execAsync('ps aux | grep -E "(trading|paradigm|ts-node.*src)" | grep -v grep');

            if (stdout.trim()) {
                logger.info('Found trading processes, killing them...');
                const lines = stdout.trim().split('\n');

                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    const pid = parts[1];
                    if (pid && !isNaN(Number(pid))) {
                        try {
                            await execAsync(`kill -TERM ${pid}`);
                            logger.info(`Killed process ${pid}`);
                        } catch (error) {
                            logger.warn(`Failed to kill process ${pid}:`, error);
                        }
                    }
                }
            }
        } catch (error) {
            logger.warn('Error finding/killing processes:', error);
        }
    }

    async forceStop(): Promise<void> {
        logger.warn('⚠️ Force stopping trading system...');

        try {
            // Force kill all related processes
            const { exec } = require('child_process');
            const util = require('util');
            const execAsync = util.promisify(exec);

            await execAsync('pkill -f "trading|paradigm|ts-node.*src"');
            logger.info('✅ Force stop completed');
            process.exit(0);
        } catch (error) {
            logger.error('❌ Force stop failed:', error);
            process.exit(1);
        }
    }
}

// Main execution
async function main() {
    const stopManager = new TradingStopManager();

    // Check command line arguments
    const args = process.argv.slice(2);

    if (args.includes('--force') || args.includes('-f')) {
        await stopManager.forceStop();
    } else {
        await stopManager.stopTrading();
    }
}

// Handle process signals
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, stopping trading...');
    const stopManager = new TradingStopManager();
    await stopManager.stopTrading();
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, stopping trading...');
    const stopManager = new TradingStopManager();
    await stopManager.stopTrading();
});

// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        logger.error('Failed to stop trading:', error);
        process.exit(1);
    });
}

export { TradingStopManager }; 