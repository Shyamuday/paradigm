import { StrategyExecutionManager, StrategyExecutionConfig } from './strategy-execution-manager.service';
import { IStrategy } from './strategies/strategy.interface';
import { MarketData, TradeSignal } from '../schemas/strategy.schema';
import { logger } from '../logger/logger';

// Strategy priority levels
export type StrategyPriority = 'HIGH' | 'MEDIUM' | 'LOW';

// Strategy configuration with priority
export interface OptimizedStrategyConfig {
    strategy: IStrategy;
    priority: StrategyPriority;
    enabled: boolean;
    maxExecutionTime: number; // milliseconds
    retryAttempts: number;
    batchSize: number;
}

// Strategy execution result
export interface OptimizedStrategyResult {
    strategyName: string;
    signals: TradeSignal[];
    executionTime: number;
    success: boolean;
    error?: string;
    priority: StrategyPriority;
}

// Performance metrics
export interface PerformanceMetrics {
    totalStrategies: number;
    activeStrategies: number;
    queuedStrategies: number;
    averageExecutionTime: number;
    cpuUsage: number;
    memoryUsage: number;
    throughput: number;
    successRate: number;
}

export class OptimizedStrategyEngine {
    private executionManager: StrategyExecutionManager;
    private strategies: Map<string, OptimizedStrategyConfig> = new Map();
    private isRunning: boolean = false;
    private executionHistory: OptimizedStrategyResult[] = [];
    private maxHistorySize: number = 1000;

    constructor(config: Partial<StrategyExecutionConfig> = {}) {
        this.executionManager = new StrategyExecutionManager(config);

        // Set up event listeners
        this.executionManager.on('executionSuccess', this.handleExecutionSuccess.bind(this));
        this.executionManager.on('executionFailed', this.handleExecutionFailed.bind(this));
        this.executionManager.on('metricsUpdated', this.handleMetricsUpdate.bind(this));

        logger.info('Optimized Strategy Engine initialized');
    }

    /**
     * Start the optimized strategy engine
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Optimized Strategy Engine is already running');
            return;
        }

        await this.executionManager.start();
        this.isRunning = true;

        logger.info('Optimized Strategy Engine started');
    }

    /**
     * Stop the optimized strategy engine
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('Optimized Strategy Engine is not running');
            return;
        }

        await this.executionManager.stop();
        this.isRunning = false;

        logger.info('Optimized Strategy Engine stopped');
    }

    /**
     * Register a strategy with priority
     */
    registerStrategy(
        name: string,
        strategy: IStrategy,
        priority: StrategyPriority = 'MEDIUM',
        config: Partial<OptimizedStrategyConfig> = {}
    ): void {
        const strategyConfig: OptimizedStrategyConfig = {
            strategy,
            priority,
            enabled: true,
            maxExecutionTime: 30000,
            retryAttempts: 3,
            batchSize: 1,
            ...config
        };

        this.strategies.set(name, strategyConfig);

        logger.info('Strategy registered', {
            name,
            priority,
            enabled: strategyConfig.enabled
        });
    }

    /**
     * Unregister a strategy
     */
    unregisterStrategy(name: string): void {
        if (this.strategies.has(name)) {
            this.strategies.delete(name);
            logger.info('Strategy unregistered', { name });
        }
    }

    /**
     * Execute all strategies with market data
     */
    async executeAllStrategies(marketData: MarketData[]): Promise<OptimizedStrategyResult[]> {
        if (!this.isRunning) {
            throw new Error('Strategy engine is not running');
        }

        const results: OptimizedStrategyResult[] = [];
        const enabledStrategies = Array.from(this.strategies.entries())
            .filter(([_, config]) => config.enabled);

        logger.info(`Executing ${enabledStrategies.length} strategies`);

        // Add tasks to execution manager
        const taskIds: string[] = [];

        for (const [name, config] of enabledStrategies) {
            const taskId = this.executionManager.addTask({
                strategy: config.strategy,
                marketData,
                priority: config.priority,
                maxRetries: config.retryAttempts
            });

            taskIds.push(taskId);
        }

        // Wait for all tasks to complete
        const executionResults = await this.waitForTaskCompletion(taskIds);

        // Convert to OptimizedStrategyResult format
        for (const result of executionResults) {
            const strategyConfig = this.findStrategyByTaskId(result.taskId);
            if (strategyConfig) {
                const optimizedResult: OptimizedStrategyResult = {
                    strategyName: result.strategyName,
                    signals: result.signals,
                    executionTime: result.executionTime,
                    success: result.success,
                    error: result.error,
                    priority: strategyConfig.priority
                };

                results.push(optimizedResult);
                this.addToHistory(optimizedResult);
            }
        }

        return results;
    }

    /**
     * Execute specific strategies
     */
    async executeStrategies(
        strategyNames: string[],
        marketData: MarketData[]
    ): Promise<OptimizedStrategyResult[]> {
        const results: OptimizedStrategyResult[] = [];
        const taskIds: string[] = [];

        for (const name of strategyNames) {
            const config = this.strategies.get(name);
            if (config && config.enabled) {
                const taskId = this.executionManager.addTask({
                    strategy: config.strategy,
                    marketData,
                    priority: config.priority,
                    maxRetries: config.retryAttempts
                });

                taskIds.push(taskId);
            }
        }

        const executionResults = await this.waitForTaskCompletion(taskIds);

        for (const result of executionResults) {
            const strategyConfig = this.findStrategyByTaskId(result.taskId);
            if (strategyConfig) {
                const optimizedResult: OptimizedStrategyResult = {
                    strategyName: result.strategyName,
                    signals: result.signals,
                    executionTime: result.executionTime,
                    success: result.success,
                    error: result.error,
                    priority: strategyConfig.priority
                };

                results.push(optimizedResult);
                this.addToHistory(optimizedResult);
            }
        }

        return results;
    }

    /**
     * Wait for task completion
     */
    private async waitForTaskCompletion(taskIds: string[]): Promise<any[]> {
        return new Promise((resolve) => {
            const results: any[] = [];
            const completedTasks = new Set<string>();

            const checkCompletion = () => {
                if (completedTasks.size === taskIds.length) {
                    resolve(results);
                }
            };

            this.executionManager.on('executionSuccess', (result: any) => {
                if (taskIds.includes(result.taskId)) {
                    results.push(result);
                    completedTasks.add(result.taskId);
                    checkCompletion();
                }
            });

            this.executionManager.on('executionFailed', (result: any) => {
                if (taskIds.includes(result.taskId)) {
                    results.push({ ...result, signals: [], success: false });
                    completedTasks.add(result.taskId);
                    checkCompletion();
                }
            });

            // Timeout after 60 seconds
            setTimeout(() => {
                resolve(results);
            }, 60000);
        });
    }

    /**
     * Find strategy config by task ID
     */
    private findStrategyByTaskId(taskId: string): OptimizedStrategyConfig | null {
        // This is a simplified implementation
        // In a real system, you'd maintain a mapping between task IDs and strategies
        for (const [name, config] of this.strategies) {
            if (config.strategy.name === taskId.split('_')[0]) {
                return config;
            }
        }
        return null;
    }

    /**
     * Add result to history
     */
    private addToHistory(result: OptimizedStrategyResult): void {
        this.executionHistory.push(result);

        // Maintain history size
        if (this.executionHistory.length > this.maxHistorySize) {
            this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Handle successful execution
     */
    private handleExecutionSuccess(result: any): void {
        logger.debug('Strategy execution succeeded', {
            taskId: result.taskId,
            strategyName: result.strategyName,
            executionTime: result.executionTime
        });
    }

    /**
     * Handle failed execution
     */
    private handleExecutionFailed(result: any): void {
        logger.error('Strategy execution failed', {
            taskId: result.taskId,
            error: result.error
        });
    }

    /**
     * Handle metrics update
     */
    private handleMetricsUpdate(metrics: any): void {
        logger.debug('System metrics updated', metrics);
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics(): PerformanceMetrics {
        const metrics = this.executionManager.getMetrics();
        const queueStatus = this.executionManager.getQueueStatus();

        // Calculate success rate from history
        const recentResults = this.executionHistory.slice(-100);
        const successCount = recentResults.filter(r => r.success).length;
        const successRate = recentResults.length > 0 ? (successCount / recentResults.length) * 100 : 0;

        // Calculate average execution time
        const executionTimes = recentResults.map(r => r.executionTime);
        const averageExecutionTime = executionTimes.length > 0
            ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
            : 0;

        return {
            totalStrategies: this.strategies.size,
            activeStrategies: metrics.activeStrategies,
            queuedStrategies: queueStatus.queuedTasks,
            averageExecutionTime,
            cpuUsage: metrics.cpuUsage,
            memoryUsage: metrics.memoryUsage,
            throughput: metrics.throughput,
            successRate
        };
    }

    /**
     * Get strategy status
     */
    getStrategyStatus(): Array<{
        name: string;
        priority: StrategyPriority;
        enabled: boolean;
        lastExecution?: Date;
        successRate: number;
    }> {
        return Array.from(this.strategies.entries()).map(([name, config]) => {
            const strategyResults = this.executionHistory.filter(r => r.strategyName === name);
            const successRate = strategyResults.length > 0
                ? (strategyResults.filter(r => r.success).length / strategyResults.length) * 100
                : 0;

            const result: {
                name: string;
                priority: StrategyPriority;
                enabled: boolean;
                lastExecution?: Date;
                successRate: number;
            } = {
                name,
                priority: config.priority,
                enabled: config.enabled,
                successRate
            };

            if (strategyResults.length > 0) {
                result.lastExecution = new Date();
            }

            return result;
        });
    }

    /**
     * Update strategy configuration
     */
    updateStrategyConfig(
        name: string,
        updates: Partial<OptimizedStrategyConfig>
    ): void {
        const config = this.strategies.get(name);
        if (config) {
            this.strategies.set(name, { ...config, ...updates });
            logger.info('Strategy config updated', { name, updates });
        }
    }

    /**
     * Enable/disable strategy
     */
    setStrategyEnabled(name: string, enabled: boolean): void {
        this.updateStrategyConfig(name, { enabled });
    }

    /**
     * Set strategy priority
     */
    setStrategyPriority(name: string, priority: StrategyPriority): void {
        this.updateStrategyConfig(name, { priority });
    }

    /**
     * Get execution history
     */
    getExecutionHistory(limit: number = 100): OptimizedStrategyResult[] {
        return this.executionHistory.slice(-limit);
    }

    /**
     * Clear execution history
     */
    clearExecutionHistory(): void {
        this.executionHistory = [];
        logger.info('Execution history cleared');
    }

    /**
     * Get queue status
     */
    getQueueStatus() {
        return this.executionManager.getQueueStatus();
    }

    /**
     * Update execution manager configuration
     */
    updateExecutionConfig(config: Partial<StrategyExecutionConfig>): void {
        this.executionManager.updateConfig(config);
    }

    /**
     * Get all registered strategies
     */
    getRegisteredStrategies(): string[] {
        return Array.from(this.strategies.keys());
    }

    /**
     * Check if strategy is registered
     */
    isStrategyRegistered(name: string): boolean {
        return this.strategies.has(name);
    }

    /**
     * Get strategy configuration
     */
    getStrategyConfig(name: string): OptimizedStrategyConfig | undefined {
        return this.strategies.get(name);
    }
} 