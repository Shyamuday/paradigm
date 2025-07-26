#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { logger } from '../src/logger/logger';

// Load environment variables
config();

/**
 * Simple CPU Load Simulator
 */
class CPULoadSimulator {
    private isRunning: boolean = false;
    private strategies: Array<{ name: string; priority: string; load: number }> = [];
    private currentLoad: number = 0;
    private maxLoad: number = 100;

    constructor() {
        // Initialize strategies with different CPU loads
        this.strategies = [
            { name: 'ADX Strategy', priority: 'HIGH', load: 25 },
            { name: 'Moving Average Strategy', priority: 'MEDIUM', load: 15 },
            { name: 'RSI Strategy', priority: 'MEDIUM', load: 12 },
            { name: 'Breakout Strategy', priority: 'LOW', load: 18 },
            { name: 'ML Strategy', priority: 'HIGH', load: 35 }
        ];
    }

    /**
     * Start CPU load simulation
     */
    start(): void {
        this.isRunning = true;
        console.log('🚀 Starting CPU Load Simulation');
        console.log('='.repeat(50));

        this.displayInitialState();
        this.startMonitoring();
    }

    /**
     * Stop simulation
     */
    stop(): void {
        this.isRunning = false;
        console.log('\n🛑 CPU Load Simulation Stopped');
    }

    /**
     * Display initial state
     */
    private displayInitialState(): void {
        console.log('📋 Strategy Configuration:');
        this.strategies.forEach(strategy => {
            const priorityIcon = strategy.priority === 'HIGH' ? '🔴' :
                strategy.priority === 'MEDIUM' ? '🟡' : '🟢';
            console.log(`   ${priorityIcon} ${strategy.name.padEnd(25)} ${strategy.priority.padEnd(8)} Load: ${strategy.load}%`);
        });

        console.log('\n⚙️ Optimization Settings:');
        console.log('   Max Concurrent Strategies: 2');
        console.log('   CPU Threshold: 70%');
        console.log('   Memory Threshold: 80%');
        console.log('   Execution Interval: 2 seconds');
        console.log('   Batch Size: 1');
    }

    /**
     * Start monitoring loop
     */
    private startMonitoring(): void {
        let cycle = 0;

        const interval = setInterval(() => {
            if (!this.isRunning) {
                clearInterval(interval);
                return;
            }

            cycle++;
            this.simulateExecution(cycle);

            // Run for 2 minutes
            if (cycle >= 24) { // 24 cycles * 5 seconds = 2 minutes
                this.stop();
                clearInterval(interval);
            }
        }, 5000); // Every 5 seconds
    }

    /**
     * Simulate strategy execution
     */
    private simulateExecution(cycle: number): void {
        console.log(`\n📊 Execution Cycle #${cycle}`);
        console.log('='.repeat(40));

        // Simulate different execution scenarios
        if (cycle <= 6) {
            // Phase 1: All strategies running (high load)
            this.simulateHighLoad();
        } else if (cycle <= 12) {
            // Phase 2: Optimized execution (medium load)
            this.simulateOptimizedLoad();
        } else if (cycle <= 18) {
            // Phase 3: Conservative execution (low load)
            this.simulateConservativeLoad();
        } else {
            // Phase 4: Dynamic optimization
            this.simulateDynamicOptimization();
        }

        this.displayMetrics();
    }

    /**
     * Simulate high CPU load scenario
     */
    private simulateHighLoad(): void {
        console.log('🔴 HIGH LOAD SCENARIO - All strategies running');

        // Simulate all strategies running simultaneously
        this.currentLoad = this.strategies.reduce((total, strategy) => total + strategy.load, 0);

        console.log('   Running all 5 strategies simultaneously');
        console.log('   No optimization applied');
        console.log('   CPU load: Very High');
    }

    /**
     * Simulate optimized load scenario
     */
    private simulateOptimizedLoad(): void {
        console.log('🟡 OPTIMIZED LOAD SCENARIO - Priority-based execution');

        // Simulate priority-based execution
        const highPriorityStrategies = this.strategies.filter(s => s.priority === 'HIGH');
        const mediumPriorityStrategies = this.strategies.filter(s => s.priority === 'MEDIUM');

        // Run high priority + 1 medium priority
        this.currentLoad = highPriorityStrategies.reduce((total, s) => total + s.load, 0);
        if (mediumPriorityStrategies.length > 0) {
            this.currentLoad += mediumPriorityStrategies[0]?.load || 0;
        }

        console.log('   Running high-priority strategies first');
        console.log('   Limited concurrent executions');
        console.log('   CPU load: Moderate');
    }

    /**
     * Simulate conservative load scenario
     */
    private simulateConservativeLoad(): void {
        console.log('🟢 CONSERVATIVE LOAD SCENARIO - Minimal execution');

        // Simulate conservative execution
        const highPriorityStrategies = this.strategies.filter(s => s.priority === 'HIGH');
        this.currentLoad = highPriorityStrategies.reduce((total, s) => total + s.load, 0);

        console.log('   Running only high-priority strategies');
        console.log('   Maximum 1 strategy at a time');
        console.log('   CPU load: Low');
    }

    /**
     * Simulate dynamic optimization
     */
    private simulateDynamicOptimization(): void {
        console.log('⚡ DYNAMIC OPTIMIZATION SCENARIO - Adaptive execution');

        // Simulate dynamic optimization based on load
        if (this.currentLoad > 80) {
            // Reduce load
            this.currentLoad = Math.max(40, this.currentLoad * 0.6);
            console.log('   High load detected - reducing execution');
        } else if (this.currentLoad < 30) {
            // Increase load
            this.currentLoad = Math.min(70, this.currentLoad * 1.5);
            console.log('   Low load detected - increasing execution');
        } else {
            // Maintain current load
            console.log('   Optimal load - maintaining execution');
        }
    }

    /**
     * Display current metrics
     */
    private displayMetrics(): void {
        const cpuStatus = this.currentLoad > 80 ? '🔴' : this.currentLoad > 60 ? '🟡' : '🟢';
        const memoryUsage = this.currentLoad * 0.8 + Math.random() * 10;
        const memoryStatus = memoryUsage > 80 ? '🔴' : memoryUsage > 60 ? '🟡' : '🟢';

        console.log('\n📈 PERFORMANCE METRICS:');
        console.log(`${cpuStatus} CPU Usage: ${this.currentLoad.toFixed(1)}%`);
        console.log(`${memoryStatus} Memory Usage: ${memoryUsage.toFixed(1)}%`);
        console.log(`📋 Total Strategies: ${this.strategies.length}`);
        console.log(`⚡ Active Strategies: ${Math.ceil(this.currentLoad / 20)}`);
        console.log(`⏱️  Avg Execution Time: ${(this.currentLoad * 50).toFixed(0)}ms`);
        console.log(`📈 Success Rate: ${Math.max(85, 100 - this.currentLoad * 0.2).toFixed(1)}%`);

        // Optimization recommendations
        this.displayOptimizationRecommendations();
    }

    /**
     * Display optimization recommendations
     */
    private displayOptimizationRecommendations(): void {
        console.log('\n🔧 OPTIMIZATION RECOMMENDATIONS:');

        if (this.currentLoad > 80) {
            console.log('🔴 HIGH CPU USAGE DETECTED');
            console.log('   → Reduce max concurrent strategies to 1');
            console.log('   → Increase execution interval to 5 seconds');
            console.log('   → Disable low-priority strategies');
            console.log('   → Enable aggressive caching');
        } else if (this.currentLoad > 60) {
            console.log('🟡 MODERATE CPU USAGE');
            console.log('   → Monitor closely');
            console.log('   → Consider reducing batch size');
            console.log('   → Enable result caching');
        } else {
            console.log('🟢 OPTIMAL CPU USAGE');
            console.log('   → System performing well');
            console.log('   → Can increase load if needed');
            console.log('   → Consider adding more strategies');
        }
    }

    /**
     * Demonstrate optimization techniques
     */
    demonstrateOptimizationTechniques(): void {
        console.log('\n🎯 OPTIMIZATION TECHNIQUES DEMONSTRATION');
        console.log('='.repeat(50));

        console.log('1️⃣ Strategy Prioritization:');
        console.log('   HIGH: ADX Strategy, ML Strategy');
        console.log('   MEDIUM: Moving Average, RSI Strategy');
        console.log('   LOW: Breakout Strategy');

        console.log('\n2️⃣ Concurrent Execution Limiting:');
        console.log('   Max 2 strategies running simultaneously');
        console.log('   Prevents CPU overload');
        console.log('   Maintains system stability');

        console.log('\n3️⃣ Result Caching:');
        console.log('   Cache strategy results for 10 seconds');
        console.log('   Avoid redundant calculations');
        console.log('   Reduce CPU usage by 30-50%');

        console.log('\n4️⃣ Dynamic Load Balancing:');
        console.log('   Monitor CPU usage in real-time');
        console.log('   Adjust execution based on load');
        console.log('   Automatic optimization');

        console.log('\n5️⃣ Resource Monitoring:');
        console.log('   Track CPU and memory usage');
        console.log('   Alert when thresholds exceeded');
        console.log('   Automatic scaling');
    }

    /**
     * Show performance comparison
     */
    showPerformanceComparison(): void {
        console.log('\n📊 PERFORMANCE COMPARISON');
        console.log('='.repeat(50));

        console.log('🔴 WITHOUT OPTIMIZATION:');
        console.log('   CPU Usage: 95-100%');
        console.log('   Memory Usage: 85-95%');
        console.log('   Execution Time: 15-20 seconds');
        console.log('   Success Rate: 60-70%');
        console.log('   System Stability: Poor');

        console.log('\n🟡 WITH BASIC OPTIMIZATION:');
        console.log('   CPU Usage: 60-75%');
        console.log('   Memory Usage: 70-80%');
        console.log('   Execution Time: 8-12 seconds');
        console.log('   Success Rate: 85-90%');
        console.log('   System Stability: Good');

        console.log('\n🟢 WITH ADVANCED OPTIMIZATION:');
        console.log('   CPU Usage: 40-60%');
        console.log('   Memory Usage: 50-70%');
        console.log('   Execution Time: 3-8 seconds');
        console.log('   Success Rate: 95-98%');
        console.log('   System Stability: Excellent');
    }
}

/**
 * Main function
 */
async function main() {
    const simulator = new CPULoadSimulator();

    try {
        // Show optimization techniques
        simulator.demonstrateOptimizationTechniques();

        // Show performance comparison
        simulator.showPerformanceComparison();

        // Start simulation
        simulator.start();

    } catch (error) {
        console.error('❌ Error in CPU simulation:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    process.exit(0);
});

// Run if called directly
if (require.main === module) {
    main();
}

export { CPULoadSimulator }; 