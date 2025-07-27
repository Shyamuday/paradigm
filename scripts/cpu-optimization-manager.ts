#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { OptimizedStrategyEngine } from '../src/services/optimized-strategy-engine.service';
import { StrategyExecutionConfig } from '../src/services/strategy-execution-manager.service';
import { ADXStrategy } from '../src/services/strategies/adx-strategy';
import { MovingAverageStrategy } from '../src/services/strategies/moving-average-strategy';
import { RsiStrategy } from '../src/services/strategies/rsi-strategy';
import { BreakoutStrategy } from '../src/services/strategies/breakout-strategy';
import { MarketData } from '../src/schemas/strategy.schema';

// Load environment variables
config();

/**
 * Generate mock market data
 */
function generateMockMarketData(symbol: string, periods: number = 100): MarketData[] {
    const data: MarketData[] = [];
    let price = 18000;
    const now = new Date();

    for (let i = periods; i >= 0; i--) {
        const change = (Math.random() - 0.5) * 100;
        price += change;
        price = Math.max(15000, Math.min(25000, price));

        const timestamp = new Date(now.getTime() - i * 60 * 1000);
        const high = price + Math.random() * 20;
        const low = price - Math.random() * 20;
        const open = price + (Math.random() - 0.5) * 10;
        const close = price;
        const volume = Math.floor(Math.random() * 1000000) + 500000;

        data.push({
            symbol,
            timestamp,
            open,
            high,
            low,
            close,
            volume
        });
    }

    return data.reverse();
}

/**
 * CPU Optimization Manager
 */
class CPUOptimizationManager {
    private strategyEngine: OptimizedStrategyEngine;
    private isRunning: boolean = false;
    private monitoringInterval: NodeJS.Timeout | null = null;
    private executionCount: number = 0;
    private startTime: Date = new Date();

    constructor() {
        // Initialize with CPU-optimized configuration
        const executionConfig: StrategyExecutionConfig = {
            maxConcurrentStrategies: 2,    // Limit concurrent executions
            executionInterval: 2000,       // 2-second intervals
            cpuThreshold: 70,              // 70% CPU threshold
            memoryThreshold: 80,           // 80% memory threshold
            priorityLevels: {
                HIGH: 3,
                MEDIUM: 2,
                LOW: 1
            },
            batchSize: 1,                  // Process one strategy at a time
            enableCaching: true,           // Enable result caching
            cacheTTL: 10000                // 10-second cache TTL
        };

        this.strategyEngine = new OptimizedStrategyEngine(executionConfig);
    }

    /**
     * Initialize and register strategies
     */
    async initialize(): Promise<void> {
        console.log('🚀 Initializing CPU-Optimized Strategy Engine');
        console.log('='.repeat(60));

        // Register strategies with different priorities
        this.strategyEngine.registerStrategy(
            'ADX Strategy',
            new ADXStrategy({ period: 14, threshold: 25 }),
            'HIGH',
            { maxExecutionTime: 15000, retryAttempts: 2 }
        );

        this.strategyEngine.registerStrategy(
            'Moving Average Strategy',
            new MovingAverageStrategy(),
            'MEDIUM',
            { maxExecutionTime: 10000, retryAttempts: 2 }
        );

        this.strategyEngine.registerStrategy(
            'RSI Strategy',
            new RsiStrategy(),
            'MEDIUM',
            { maxExecutionTime: 8000, retryAttempts: 2 }
        );

        this.strategyEngine.registerStrategy(
            'Breakout Strategy',
            new BreakoutStrategy(),
            'LOW',
            { maxExecutionTime: 12000, retryAttempts: 1 }
        );

        console.log('✅ Strategies registered with priorities:');
        const strategies = this.strategyEngine.getStrategyStatus();
        strategies.forEach(strategy => {
            const status = strategy.enabled ? '🟢' : '🔴';
            console.log(`   ${status} ${strategy.name} (${strategy.priority})`);
        });

        console.log('\n⚙️ CPU Optimization Configuration:');
        console.log(`   Max Concurrent Strategies: 2`);
        console.log(`   Execution Interval: 2 seconds`);
        console.log(`   CPU Threshold: 70%`);
        console.log(`   Memory Threshold: 80%`);
        console.log(`   Batch Size: 1`);
        console.log(`   Cache TTL: 10 seconds`);
    }

    /**
     * Start the optimized strategy engine
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            console.log('⚠️  Strategy engine is already running');
            return;
        }

        await this.strategyEngine.start();
        this.isRunning = true;
        this.startTime = new Date();

        console.log('\n🎯 CPU-Optimized Strategy Engine Started!');
        console.log('📊 Monitoring CPU usage and strategy performance...\n');

        // Start monitoring
        this.startMonitoring();
    }

    /**
     * Stop the strategy engine
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            console.log('⚠️  Strategy engine is not running');
            return;
        }

        this.isRunning = false;

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        await this.strategyEngine.stop();
        console.log('\n🛑 Strategy engine stopped');
    }

    /**
     * Start performance monitoring
     */
    private startMonitoring(): void {
        this.monitoringInterval = setInterval(async () => {
            if (!this.isRunning) return;

            try {
                await this.executeStrategies();
                this.displayMetrics();
            } catch (error) {
                console.error('❌ Error in monitoring cycle:', error);
            }
        }, 5000); // Monitor every 5 seconds
    }

    /**
     * Execute strategies with market data
     */
    private async executeStrategies(): Promise<void> {
        const marketData = generateMockMarketData('NIFTY', 50);

        try {
            const results = await this.strategyEngine.executeAllStrategies(marketData);
            this.executionCount++;

            // Log execution results
            if (results.length > 0) {
                const totalSignals = results.reduce((sum, r) => sum + r.signals.length, 0);
                const successfulExecutions = results.filter(r => r.success).length;

                console.log(`📈 Execution #${this.executionCount}: ${successfulExecutions}/${results.length} strategies successful, ${totalSignals} signals generated`);
            }
        } catch (error) {
            console.error('❌ Strategy execution failed:', error);
        }
    }

    /**
     * Display current metrics
     */
    private displayMetrics(): void {
        const metrics = this.strategyEngine.getPerformanceMetrics();
        const queueStatus = this.strategyEngine.getQueueStatus();

        console.log('\n📊 PERFORMANCE METRICS');
        console.log('='.repeat(40));

        // CPU and Memory Usage
        const cpuStatus = metrics.cpuUsage > 70 ? '🔴' : metrics.cpuUsage > 50 ? '🟡' : '🟢';
        const memoryStatus = metrics.memoryUsage > 80 ? '🔴' : metrics.memoryUsage > 60 ? '🟡' : '🟢';

        console.log(`${cpuStatus} CPU Usage: ${metrics.cpuUsage.toFixed(1)}%`);
        console.log(`${memoryStatus} Memory Usage: ${metrics.memoryUsage.toFixed(1)}%`);

        // Strategy Status
        console.log(`📋 Total Strategies: ${metrics.totalStrategies}`);
        console.log(`⚡ Active Strategies: ${metrics.activeStrategies}`);
        console.log(`⏳ Queued Strategies: ${queueStatus.queuedTasks}`);

        // Performance Metrics
        console.log(`⏱️  Avg Execution Time: ${metrics.averageExecutionTime.toFixed(0)}ms`);
        console.log(`📈 Success Rate: ${metrics.successRate.toFixed(1)}%`);
        console.log(`🚀 Throughput: ${metrics.throughput.toFixed(1)} signals/sec`);

        // Queue Information
        if (queueStatus.queuedTasks > 0) {
            console.log(`⏰ Avg Wait Time: ${(queueStatus.averageWaitTime / 1000).toFixed(1)}s`);
        }

        console.log('='.repeat(40));
    }

    /**
     * Display detailed strategy status
     */
    displayStrategyStatus(): void {
        console.log('\n📋 STRATEGY STATUS');
        console.log('='.repeat(50));

        const strategies = this.strategyEngine.getStrategyStatus();
        strategies.forEach(strategy => {
            const status = strategy.enabled ? '🟢' : '🔴';
            const priority = strategy.priority === 'HIGH' ? '🔴' : strategy.priority === 'MEDIUM' ? '🟡' : '🟢';

            console.log(`${status} ${strategy.name.padEnd(25)} ${priority} ${strategy.priority.padEnd(8)} Success: ${strategy.successRate.toFixed(1)}%`);
        });

        console.log('='.repeat(50));
    }

    /**
     * Display queue status
     */
    displayQueueStatus(): void {
        console.log('\n⏳ QUEUE STATUS');
        console.log('='.repeat(30));

        const queueStatus = this.strategyEngine.getQueueStatus();
        console.log(`Queued Tasks: ${queueStatus.queuedTasks}`);
        console.log(`Active Tasks: ${queueStatus.activeTasks}`);
        console.log(`Max Concurrent: ${queueStatus.maxConcurrent}`);
        console.log(`Avg Wait Time: ${(queueStatus.averageWaitTime / 1000).toFixed(1)}s`);

        console.log('='.repeat(30));
    }

    /**
     * Optimize configuration based on current performance
     */
    optimizeConfiguration(): void {
        const metrics = this.strategyEngine.getPerformanceMetrics();

        console.log('\n🔧 OPTIMIZATION RECOMMENDATIONS');
        console.log('='.repeat(40));

        if (metrics.cpuUsage > 80) {
            console.log('🔴 HIGH CPU USAGE DETECTED');
            console.log('   → Reduce max concurrent strategies');
            console.log('   → Increase execution interval');
            console.log('   → Enable more aggressive caching');
        } else if (metrics.cpuUsage > 60) {
            console.log('🟡 MODERATE CPU USAGE');
            console.log('   → Monitor closely');
            console.log('   → Consider reducing batch size');
        } else {
            console.log('🟢 OPTIMAL CPU USAGE');
            console.log('   → System performing well');
            console.log('   → Can increase load if needed');
        }

        if (metrics.successRate < 80) {
            console.log('🔴 LOW SUCCESS RATE');
            console.log('   → Check strategy configurations');
            console.log('   → Increase retry attempts');
            console.log('   → Review error logs');
        }

        if (metrics.averageExecutionTime > 15000) {
            console.log('🟡 SLOW EXECUTION TIMES');
            console.log('   → Optimize strategy algorithms');
            console.log('   → Reduce data processing');
            console.log('   → Consider parallel processing');
        }

        console.log('='.repeat(40));
    }

    /**
     * Run performance test
     */
    async runPerformanceTest(): Promise<void> {
        console.log('\n🧪 RUNNING PERFORMANCE TEST');
        console.log('='.repeat(40));

        const testDuration = 30000; // 30 seconds
        const startTime = Date.now();
        let executionCount = 0;
        let totalSignals = 0;

        while (Date.now() - startTime < testDuration) {
            try {
                const marketData = generateMockMarketData('NIFTY', 50);
                const results = await this.strategyEngine.executeAllStrategies(marketData);

                executionCount++;
                totalSignals += results.reduce((sum, r) => sum + r.signals.length, 0);

                // Small delay to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error('Test execution error:', error);
            }
        }

        const duration = (Date.now() - startTime) / 1000;
        const executionsPerSecond = executionCount / duration;
        const signalsPerSecond = totalSignals / duration;

        console.log(`✅ Performance Test Completed`);
        console.log(`⏱️  Duration: ${duration.toFixed(1)}s`);
        console.log(`📊 Executions: ${executionCount}`);
        console.log(`🚀 Executions/sec: ${executionsPerSecond.toFixed(2)}`);
        console.log(`📈 Signals/sec: ${signalsPerSecond.toFixed(2)}`);
        console.log('='.repeat(40));
    }
}

/**
 * Main function
 */
async function main() {
    const manager = new CPUOptimizationManager();

    try {
        await manager.initialize();
        await manager.start();

        // Run for 2 minutes
        setTimeout(async () => {
            console.log('\n📊 FINAL PERFORMANCE SUMMARY');
            console.log('='.repeat(50));

            manager.displayStrategyStatus();
            manager.displayQueueStatus();
            manager.optimizeConfiguration();

            await manager.stop();
            process.exit(0);
        }, 120000); // 2 minutes

    } catch (error) {
        console.error('❌ Error in CPU optimization manager:', error);
        await manager.stop();
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

// Run if called directly
if (require.main === module) {
    main();
}

export { CPUOptimizationManager }; 