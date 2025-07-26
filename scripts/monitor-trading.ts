#!/usr/bin/env ts-node

import { logger } from '../src/logger/logger';
import { performanceMonitor } from '../src/services/performance-monitor.service';
import { DatabaseManager } from '../src/database/database';

/**
 * Trading Monitor Script
 * Monitors trading system health, performance, and status
 */

interface SystemStatus {
    timestamp: Date;
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu: number;
    database: {
        connected: boolean;
        status: string;
    };
    trading: {
        isRunning: boolean;
        activePositions: number;
        dailyPnL: number;
        totalTrades: number;
    };
    performance: {
        isMonitoring: boolean;
        metrics: any;
    };
    errors: {
        count: number;
        recent: string[];
    };
}

class TradingMonitor {
    private isMonitoring: boolean = false;
    private checkInterval: number = 30000; // 30 seconds
    private intervalId?: NodeJS.Timeout;
    private errorCount: number = 0;
    private recentErrors: string[] = [];

    async startMonitoring(): Promise<void> {
        if (this.isMonitoring) {
            logger.info('Monitoring already active');
            return;
        }

        this.isMonitoring = true;
        logger.info('🔍 Starting trading system monitoring...');

        // Initial status check
        await this.checkSystemStatus();

        // Start periodic monitoring
        this.intervalId = setInterval(async () => {
            await this.checkSystemStatus();
        }, this.checkInterval);

        logger.info(`✅ Monitoring active (checking every ${this.checkInterval / 1000}s)`);
    }

    async stopMonitoring(): Promise<void> {
        if (!this.isMonitoring) {
            logger.info('Monitoring not active');
            return;
        }

        this.isMonitoring = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null as any;
        }

        logger.info('🛑 Monitoring stopped');
    }

    private async checkSystemStatus(): Promise<void> {
        try {
            const status = await this.getSystemStatus();
            this.displayStatus(status);
            this.checkAlerts(status);
        } catch (error) {
            logger.error('Error checking system status:', error);
            this.recordError(error);
        }
    }

    private async getSystemStatus(): Promise<SystemStatus> {
        const startTime = Date.now();

        // Get basic system info
        const uptime = process.uptime();
        const memory = process.memoryUsage();
        const cpu = process.cpuUsage();

        // Check database status
        let dbStatus = { connected: false, status: 'unknown' };
        try {
            const dbManager = DatabaseManager.getInstance();
            dbStatus = {
                connected: dbManager.isConnectionActive(),
                status: dbManager.isConnectionActive() ? 'ok' : 'disconnected'
            };
        } catch (error) {
            dbStatus = { connected: false, status: 'error' };
        }

        // Check performance monitoring
        const perfStatus = performanceMonitor.getStatus();

        // Get trading status (simplified)
        const tradingStatus = {
            isRunning: this.isTradingRunning(),
            activePositions: await this.getActivePositions(),
            dailyPnL: await this.getDailyPnL(),
            totalTrades: await this.getTotalTrades()
        };

        return {
            timestamp: new Date(),
            uptime,
            memory,
            cpu: cpu.user + cpu.system,
            database: dbStatus,
            trading: tradingStatus,
            performance: {
                isMonitoring: perfStatus.isMonitoring,
                metrics: { totalMetrics: perfStatus.totalMetrics, metricNames: perfStatus.metricNames }
            },
            errors: {
                count: this.errorCount,
                recent: this.recentErrors.slice(-5) // Last 5 errors
            }
        };
    }

    private displayStatus(status: SystemStatus): void {
        const timestamp = status.timestamp.toLocaleTimeString();

        console.clear();
        console.log('🤖 TRADING SYSTEM MONITOR');
        console.log('========================');
        console.log(`⏰ Last Check: ${timestamp}`);
        console.log(`🔄 Uptime: ${Math.floor(status.uptime / 3600)}h ${Math.floor((status.uptime % 3600) / 60)}m`);
        console.log('');

        // System Resources
        console.log('💻 SYSTEM RESOURCES');
        console.log(`   Memory: ${Math.round(status.memory.heapUsed / 1024 / 1024)}MB / ${Math.round(status.memory.heapTotal / 1024 / 1024)}MB`);
        console.log(`   CPU: ${Math.round(status.cpu / 1000)}ms`);
        console.log('');

        // Database Status
        console.log('🗄️  DATABASE');
        console.log(`   Status: ${status.database.connected ? '✅ Connected' : '❌ Disconnected'}`);
        console.log(`   Health: ${status.database.status}`);
        console.log('');

        // Trading Status
        console.log('📈 TRADING STATUS');
        console.log(`   Running: ${status.trading.isRunning ? '✅ Yes' : '❌ No'}`);
        console.log(`   Positions: ${status.trading.activePositions}`);
        console.log(`   Daily P&L: ₹${status.trading.dailyPnL.toLocaleString()}`);
        console.log(`   Total Trades: ${status.trading.totalTrades}`);
        console.log('');

        // Performance Monitoring
        console.log('📊 PERFORMANCE');
        console.log(`   Monitoring: ${status.performance.isMonitoring ? '✅ Active' : '❌ Inactive'}`);
        if (status.performance.metrics) {
            console.log(`   Metrics: ${Object.keys(status.performance.metrics).length} active`);
        }
        console.log('');

        // Errors
        console.log('🚨 ERRORS');
        console.log(`   Count: ${status.errors.count}`);
        if (status.errors.recent.length > 0) {
            console.log('   Recent:');
            status.errors.recent.forEach((error, index) => {
                console.log(`     ${index + 1}. ${error.substring(0, 50)}...`);
            });
        }
        console.log('');

        console.log('Press Ctrl+C to stop monitoring');
    }

    private checkAlerts(status: SystemStatus): void {
        // Memory alert
        const memoryUsagePercent = (status.memory.heapUsed / status.memory.heapTotal) * 100;
        if (memoryUsagePercent > 80) {
            logger.warn(`⚠️ High memory usage: ${Math.round(memoryUsagePercent)}%`);
        }

        // Database alert
        if (!status.database.connected) {
            logger.error('🚨 Database disconnected!');
        }

        // Trading alert
        if (!status.trading.isRunning) {
            logger.warn('⚠️ Trading system not running');
        }

        // Error alert
        if (status.errors.count > 10) {
            logger.error('🚨 High error count detected');
        }
    }

    private recordError(error: any): void {
        this.errorCount++;
        const errorMessage = error.message || error.toString();
        this.recentErrors.push(errorMessage);

        // Keep only last 10 errors
        if (this.recentErrors.length > 10) {
            this.recentErrors.shift();
        }
    }

    private isTradingRunning(): boolean {
        // Check if trading processes are running
        try {
            const { execSync } = require('child_process');
            const output = execSync('ps aux | grep -E "(trading|paradigm|ts-node.*src)" | grep -v grep', { encoding: 'utf8' });
            return output.trim().length > 0;
        } catch (error) {
            return false;
        }
    }

    private async getActivePositions(): Promise<number> {
        try {
            // This would normally query the database
            // For now, return a placeholder
            return 0;
        } catch (error) {
            return 0;
        }
    }

    private async getDailyPnL(): Promise<number> {
        try {
            // This would normally query the database
            // For now, return a placeholder
            return 0;
        } catch (error) {
            return 0;
        }
    }

    private async getTotalTrades(): Promise<number> {
        try {
            // This would normally query the database
            // For now, return a placeholder
            return 0;
        } catch (error) {
            return 0;
        }
    }
}

// Main execution
async function main() {
    const monitor = new TradingMonitor();

    // Check command line arguments
    const args = process.argv.slice(2);

    if (args.includes('--stop') || args.includes('-s')) {
        await monitor.stopMonitoring();
    } else {
        await monitor.startMonitoring();
    }
}

// Handle process signals
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, stopping monitoring...');
    const monitor = new TradingMonitor();
    await monitor.stopMonitoring();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, stopping monitoring...');
    const monitor = new TradingMonitor();
    await monitor.stopMonitoring();
    process.exit(0);
});

// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        logger.error('Failed to start monitoring:', error);
        process.exit(1);
    });
}

export { TradingMonitor }; 