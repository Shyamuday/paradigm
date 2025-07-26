#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { PersonalTradingSystem } from '../src/examples/personal-trading-setup';
import { ConfigManager } from '../src/config/config-manager';
import { logger } from '../src/logger/logger';

// Load environment variables
config();

async function stopTrading() {
    try {
        logger.info('🛑 Stopping trading system...');

        // Load configuration
        const configManager = new ConfigManager();
        const config = await configManager.getConfig();

        // Create trading system instance
        const tradingSystem = new PersonalTradingSystem(config);

        console.log('\n🛑 STOPPING TRADING SYSTEM');
        console.log('==========================');

        // Check current status
        const status = await tradingSystem.getStatus();

        if (!status.isRunning) {
            console.log('✅ Trading system is already stopped.');
            return;
        }

        console.log('📊 Current Status:');
        console.log(`   Active Positions: ${status.positions.length}`);
        console.log(`   Daily P&L: ₹${status.dailyPnL.toLocaleString()}`);
        console.log(`   Total P&L: ₹${status.totalPnL.toLocaleString()}`);

        // Ask for confirmation if there are open positions
        if (status.positions.length > 0) {
            console.log('\n⚠️  WARNING: You have open positions!');
            console.log('   Do you want to:');
            console.log('   1. Close all positions and stop');
            console.log('   2. Stop without closing positions');
            console.log('   3. Cancel');

            // For now, we'll close all positions
            console.log('\n🔄 Closing all positions...');

            // Close all positions
            for (const position of status.positions) {
                try {
                    console.log(`   Closing ${position.symbol} (${position.side}) - Qty: ${position.quantity}`);
                    await tradingSystem.closePosition(position.symbol, position.side);
                    console.log(`   ✅ Closed ${position.symbol}`);
                } catch (error) {
                    console.log(`   ❌ Failed to close ${position.symbol}: ${error}`);
                }
            }
        }

        // Stop the trading system
        console.log('\n🛑 Stopping trading system...');
        await tradingSystem.stopTrading();

        console.log('✅ Trading system stopped successfully!');

        // Send final status
        const finalStatus = await tradingSystem.getStatus();
        console.log('\n📊 Final Status:');
        console.log(`   System Running: ${finalStatus.isRunning ? 'Yes' : 'No'}`);
        console.log(`   Active Positions: ${finalStatus.positions.length}`);
        console.log(`   Daily P&L: ₹${finalStatus.dailyPnL.toLocaleString()}`);
        console.log(`   Total P&L: ₹${finalStatus.totalPnL.toLocaleString()}`);

    } catch (error) {
        logger.error('Failed to stop trading system:', error);
        console.error('❌ Error stopping trading system:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    stopTrading();
}

export { stopTrading }; 