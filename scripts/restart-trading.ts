#!/usr/bin/env ts-node

import { logger } from '../src/logger/logger';
import { TradingStopManager } from './stop-trading';

/**
 * Restart Trading Script
 * Stops and restarts the trading system
 */

class TradingRestartManager {
    private stopManager: TradingStopManager;

    constructor() {
        this.stopManager = new TradingStopManager();
    }

    async restartTrading(): Promise<void> {
        logger.info('🔄 Restarting trading system...');

        try {
            // Step 1: Stop current trading processes
            logger.info('Step 1: Stopping current trading processes...');
            await this.stopManager.stopTrading();

            // Step 2: Wait a moment for cleanup
            logger.info('Step 2: Waiting for cleanup...');
            await this.sleep(3000); // 3 seconds

            // Step 3: Start trading system again
            logger.info('Step 3: Starting trading system...');
            await this.startTradingSystem();

            logger.info('✅ Trading system restarted successfully');

        } catch (error) {
            logger.error('❌ Failed to restart trading system:', error);
            throw error;
        }
    }

    async forceRestart(): Promise<void> {
        logger.warn('⚠️ Force restarting trading system...');

        try {
            // Step 1: Force stop
            logger.info('Step 1: Force stopping...');
            await this.stopManager.forceStop();

            // Step 2: Wait for cleanup
            logger.info('Step 2: Waiting for cleanup...');
            await this.sleep(5000); // 5 seconds

            // Step 3: Start trading system
            logger.info('Step 3: Starting trading system...');
            await this.startTradingSystem();

            logger.info('✅ Trading system force restarted successfully');

        } catch (error) {
            logger.error('❌ Failed to force restart trading system:', error);
            throw error;
        }
    }

    private async startTradingSystem(): Promise<void> {
        try {
            const { spawn } = require('child_process');

            // Start the main trading system
            const tradingProcess = spawn('npm', ['run', 'trading:start'], {
                stdio: 'inherit',
                detached: true
            });

            // Wait a moment to see if it starts successfully
            await this.sleep(2000);

            // Check if process is still running
            if (tradingProcess.exitCode === null) {
                logger.info('✅ Trading system started successfully');
            } else {
                throw new Error(`Trading system failed to start (exit code: ${tradingProcess.exitCode})`);
            }

        } catch (error) {
            logger.error('Failed to start trading system:', error);
            throw error;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async checkRestartStatus(): Promise<{
        isRunning: boolean;
        uptime: number;
        status: string;
    }> {
        try {
            // Check if trading processes are running
            const { execSync } = require('child_process');
            const output = execSync('ps aux | grep -E "(trading|paradigm|ts-node.*src)" | grep -v grep', { encoding: 'utf8' });

            const isRunning = output.trim().length > 0;

            if (isRunning) {
                // Get process uptime
                const lines = output.trim().split('\n');
                const firstProcess = lines[0];
                const parts = firstProcess.trim().split(/\s+/);

                // Calculate uptime (this is simplified)
                const uptime = process.uptime();

                return {
                    isRunning: true,
                    uptime: Math.floor(uptime),
                    status: 'running'
                };
            } else {
                return {
                    isRunning: false,
                    uptime: 0,
                    status: 'stopped'
                };
            }
        } catch (error) {
            return {
                isRunning: false,
                uptime: 0,
                status: 'error'
            };
        }
    }
}

// Main execution
async function main() {
    const restartManager = new TradingRestartManager();

    // Check command line arguments
    const args = process.argv.slice(2);

    if (args.includes('--force') || args.includes('-f')) {
        await restartManager.forceRestart();
    } else if (args.includes('--status') || args.includes('-s')) {
        const status = await restartManager.checkRestartStatus();
        console.log('📊 Trading System Status:');
        console.log(`   Running: ${status.isRunning ? '✅ Yes' : '❌ No'}`);
        console.log(`   Uptime: ${status.uptime}s`);
        console.log(`   Status: ${status.status}`);
    } else {
        await restartManager.restartTrading();
    }
}

// Handle process signals
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, stopping restart process...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, stopping restart process...');
    process.exit(0);
});

// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        logger.error('Failed to restart trading:', error);
        process.exit(1);
    });
}

export { TradingRestartManager }; 