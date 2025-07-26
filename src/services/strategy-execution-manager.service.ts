import { EventEmitter } from 'events';
import { logger } from '../logger/logger';
import { IStrategy } from './strategies/strategy.interface';
import { MarketData, TradeSignal } from '../schemas/strategy.schema';

// Strategy execution configuration
export interface StrategyExecutionConfig {
    maxConcurrentStrategies: number;    // Maximum strategies running simultaneously
    executionInterval: number;          // Execution interval in milliseconds
    cpuThreshold: number;               // CPU usage threshold (0-100)
    memoryThreshold: number;            // Memory usage threshold (0-100)
    priorityLevels: {
        HIGH: number;
        MEDIUM: number;
        LOW: number;
    };
    batchSize: number;                  // Number of strategies to process in batch
    enableCaching: boolean;             // Enable result caching
    cacheTTL: number;                   // Cache TTL in milliseconds
}

// Strategy execution task
export interface StrategyTask {
    id: string;
    strategy: IStrategy;
    marketData: MarketData[];
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    timestamp: Date;
    retryCount: number;
    maxRetries: number;
}

// Execution result
export interface ExecutionResult {
    taskId: string;
    strategyName: string;
    signals: TradeSignal[];
    executionTime: number;
    cpuUsage: number;
    memoryUsage: number;
    success: boolean;
    error?: string;
}

// System resource metrics
export interface SystemMetrics {
    cpuUsage: number;
    memoryUsage: number;
    activeStrategies: number;
    queuedTasks: number;
    averageExecutionTime: number;
    throughput: number; // signals per second
}

export class StrategyExecutionManager extends EventEmitter {
    private config: StrategyExecutionConfig;
    private taskQueue: StrategyTask[] = [];
    private activeTasks: Map<string, StrategyTask> = new Map();
    private executionCache: Map<string, { result: ExecutionResult; timestamp: number }> = new Map();
    private isRunning: boolean = false;
    private executionInterval: NodeJS.Timeout | null = null;
    private metrics: SystemMetrics = {
        cpuUsage: 0,
        memoryUsage: 0,
        activeStrategies: 0,
        queuedTasks: 0,
        averageExecutionTime: 0,
        throughput: 0
    };

    constructor(config: Partial<StrategyExecutionConfig> = {}) {
        super();

        this.config = {
            maxConcurrentStrategies: 3,
            executionInterval: 1000, // 1 second
            cpuThreshold: 80,
            memoryThreshold: 85,
            priorityLevels: {
                HIGH: 3,
                MEDIUM: 2,
                LOW: 1
            },
            batchSize: 2,
            enableCaching: true,
            cacheTTL: 5000, // 5 seconds
            ...config
        };

        logger.info('Strategy Execution Manager initialized', { config: this.config });
    }

    /**
     * Start the execution manager
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Strategy Execution Manager is already running');
            return;
        }

        this.isRunning = true;
        this.startExecutionLoop();
        this.startMetricsMonitoring();

        logger.info('Strategy Execution Manager started');
    }

    /**
     * Stop the execution manager
     */
    async stop(): Promise<void> {
        this.isRunning = false;

        if (this.executionInterval) {
            clearInterval(this.executionInterval);
            this.executionInterval = null;
        }

        // Wait for active tasks to complete
        await this.waitForActiveTasks();

        logger.info('Strategy Execution Manager stopped');
    }

    /**
     * Add a strategy task to the queue
     */
    addTask(task: Omit<StrategyTask, 'id' | 'timestamp' | 'retryCount'>): string {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fullTask: StrategyTask = {
            ...task,
            id: taskId,
            timestamp: new Date(),
            retryCount: 0,
            maxRetries: 3
        };

        // Insert based on priority
        this.insertTaskByPriority(fullTask);

        this.metrics.queuedTasks = this.taskQueue.length;
        this.emit('taskAdded', taskId);

        logger.debug('Task added to queue', {
            taskId,
            strategyName: task.strategy.name,
            priority: task.priority,
            queueLength: this.taskQueue.length
        });

        return taskId;
    }

    /**
     * Insert task into queue based on priority
     */
    private insertTaskByPriority(task: StrategyTask): void {
        const priorityValue = this.config.priorityLevels[task.priority];

        let insertIndex = 0;
        for (let i = 0; i < this.taskQueue.length; i++) {
            const currentPriority = this.config.priorityLevels[this.taskQueue[i].priority];
            if (priorityValue > currentPriority) {
                insertIndex = i;
                break;
            }
            insertIndex = i + 1;
        }

        this.taskQueue.splice(insertIndex, 0, task);
    }

    /**
     * Start the main execution loop
     */
    private startExecutionLoop(): void {
        this.executionInterval = setInterval(async () => {
            if (!this.isRunning) return;

            try {
                await this.processTaskQueue();
            } catch (error) {
                logger.error('Error in execution loop:', error);
            }
        }, this.config.executionInterval);
    }

    /**
     * Process tasks in the queue
     */
    private async processTaskQueue(): Promise<void> {
        // Check system resources
        if (!this.canExecuteMoreTasks()) {
            logger.debug('System resources constrained, skipping execution cycle');
            return;
        }

        // Process tasks in batches
        const tasksToProcess = this.getTasksToProcess();

        if (tasksToProcess.length === 0) {
            return;
        }

        logger.debug(`Processing ${tasksToProcess.length} tasks`);

        // Execute tasks in parallel with limited concurrency
        const executionPromises = tasksToProcess.map(task => this.executeTask(task));
        const results = await Promise.allSettled(executionPromises);

        // Process results
        results.forEach((result, index) => {
            const task = tasksToProcess[index];
            if (result.status === 'fulfilled') {
                this.handleSuccessfulExecution(result.value);
            } else {
                this.handleFailedExecution(task, result.reason);
            }
        });

        this.updateMetrics();
    }

    /**
     * Check if more tasks can be executed
     */
    private canExecuteMoreTasks(): boolean {
        const currentCpuUsage = this.metrics.cpuUsage;
        const currentMemoryUsage = this.metrics.memoryUsage;
        const activeTaskCount = this.activeTasks.size;

        return (
            currentCpuUsage < this.config.cpuThreshold &&
            currentMemoryUsage < this.config.memoryThreshold &&
            activeTaskCount < this.config.maxConcurrentStrategies
        );
    }

    /**
     * Get tasks to process in current cycle
     */
    private getTasksToProcess(): StrategyTask[] {
        const availableSlots = this.config.maxConcurrentStrategies - this.activeTasks.size;
        const maxTasks = Math.min(availableSlots, this.config.batchSize, this.taskQueue.length);

        return this.taskQueue.splice(0, maxTasks);
    }

    /**
     * Execute a single strategy task
     */
    private async executeTask(task: StrategyTask): Promise<ExecutionResult> {
        const startTime = Date.now();

        // Check cache first
        if (this.config.enableCaching) {
            const cachedResult = this.getCachedResult(task);
            if (cachedResult) {
                logger.debug('Using cached result', { taskId: task.id });
                return cachedResult;
            }
        }

        // Add to active tasks
        this.activeTasks.set(task.id, task);
        this.metrics.activeStrategies = this.activeTasks.size;

        try {
            // Execute strategy with timeout
            const signals = await this.executeWithTimeout(
                task.strategy.generateSignals(task.marketData),
                30000 // 30 second timeout
            );

            const executionTime = Date.now() - startTime;
            const result: ExecutionResult = {
                taskId: task.id,
                strategyName: task.strategy.name,
                signals,
                executionTime,
                cpuUsage: this.metrics.cpuUsage,
                memoryUsage: this.metrics.memoryUsage,
                success: true
            };

            // Cache result
            if (this.config.enableCaching) {
                this.cacheResult(task, result);
            }

            return result;

        } catch (error) {
            const executionTime = Date.now() - startTime;
            const result: ExecutionResult = {
                taskId: task.id,
                strategyName: task.strategy.name,
                signals: [],
                executionTime,
                cpuUsage: this.metrics.cpuUsage,
                memoryUsage: this.metrics.memoryUsage,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };

            throw result;
        } finally {
            // Remove from active tasks
            this.activeTasks.delete(task.id);
            this.metrics.activeStrategies = this.activeTasks.size;
        }
    }

    /**
     * Execute with timeout
     */
    private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        return Promise.race([
            promise,
            new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Execution timeout')), timeoutMs);
            })
        ]);
    }

    /**
     * Get cached result
     */
    private getCachedResult(task: StrategyTask): ExecutionResult | null {
        const cacheKey = this.generateCacheKey(task);
        const cached = this.executionCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
            return cached.result;
        }

        return null;
    }

    /**
     * Cache result
     */
    private cacheResult(task: StrategyTask, result: ExecutionResult): void {
        const cacheKey = this.generateCacheKey(task);
        this.executionCache.set(cacheKey, {
            result,
            timestamp: Date.now()
        });

        // Clean old cache entries
        this.cleanCache();
    }

    /**
     * Generate cache key
     */
    private generateCacheKey(task: StrategyTask): string {
        const dataHash = JSON.stringify(task.marketData.slice(-10)); // Last 10 data points
        return `${task.strategy.name}_${dataHash}`;
    }

    /**
     * Clean old cache entries
     */
    private cleanCache(): void {
        const now = Date.now();
        for (const [key, value] of this.executionCache.entries()) {
            if (now - value.timestamp > this.config.cacheTTL) {
                this.executionCache.delete(key);
            }
        }
    }

    /**
     * Handle successful execution
     */
    private handleSuccessfulExecution(result: ExecutionResult): void {
        this.emit('executionSuccess', result);

        logger.info('Strategy execution successful', {
            taskId: result.taskId,
            strategyName: result.strategyName,
            signalCount: result.signals.length,
            executionTime: result.executionTime
        });
    }

    /**
     * Handle failed execution
     */
    private handleFailedExecution(task: StrategyTask, error: any): void {
        task.retryCount++;

        if (task.retryCount < task.maxRetries) {
            // Re-queue with lower priority
            const retryTask = { ...task, priority: 'LOW' as const };
            this.insertTaskByPriority(retryTask);

            logger.warn('Task failed, retrying', {
                taskId: task.id,
                strategyName: task.strategy.name,
                retryCount: task.retryCount,
                error: error.error || error.message
            });
        } else {
            // Max retries reached
            this.emit('executionFailed', { taskId: task.id, error });

            logger.error('Task failed permanently', {
                taskId: task.id,
                strategyName: task.strategy.name,
                maxRetries: task.maxRetries
            });
        }
    }

    /**
     * Wait for active tasks to complete
     */
    private async waitForActiveTasks(): Promise<void> {
        const maxWaitTime = 30000; // 30 seconds
        const startTime = Date.now();

        while (this.activeTasks.size > 0 && Date.now() - startTime < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (this.activeTasks.size > 0) {
            logger.warn(`${this.activeTasks.size} tasks did not complete within timeout`);
        }
    }

    /**
     * Start metrics monitoring
     */
    private startMetricsMonitoring(): void {
        setInterval(() => {
            this.updateSystemMetrics();
        }, 5000); // Update every 5 seconds
    }

    /**
     * Update system metrics
     */
    private updateSystemMetrics(): void {
        // Simulate CPU and memory usage (in real implementation, use actual system metrics)
        this.metrics.cpuUsage = Math.min(100, this.metrics.activeStrategies * 15 + Math.random() * 10);
        this.metrics.memoryUsage = Math.min(100, this.metrics.activeStrategies * 8 + Math.random() * 5);

        this.emit('metricsUpdated', this.metrics);
    }

    /**
     * Update execution metrics
     */
    private updateMetrics(): void {
        this.metrics.queuedTasks = this.taskQueue.length;

        // Calculate average execution time and throughput
        // This would be implemented with actual execution history
    }

    /**
     * Get current metrics
     */
    getMetrics(): SystemMetrics {
        return { ...this.metrics };
    }

    /**
     * Get queue status
     */
    getQueueStatus(): {
        queuedTasks: number;
        activeTasks: number;
        maxConcurrent: number;
        averageWaitTime: number;
    } {
        const now = Date.now();
        const waitTimes = this.taskQueue.map(task => now - task.timestamp.getTime());
        const averageWaitTime = waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0;

        return {
            queuedTasks: this.taskQueue.length,
            activeTasks: this.activeTasks.size,
            maxConcurrent: this.config.maxConcurrentStrategies,
            averageWaitTime
        };
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<StrategyExecutionConfig>): void {
        this.config = { ...this.config, ...newConfig };
        logger.info('Strategy Execution Manager config updated', { config: this.config });
    }

    /**
     * Clear queue
     */
    clearQueue(): void {
        this.taskQueue = [];
        this.metrics.queuedTasks = 0;
        logger.info('Strategy execution queue cleared');
    }

    /**
     * Get active tasks
     */
    getActiveTasks(): StrategyTask[] {
        return Array.from(this.activeTasks.values());
    }

    /**
     * Get queued tasks
     */
    getQueuedTasks(): StrategyTask[] {
        return [...this.taskQueue];
    }
} 