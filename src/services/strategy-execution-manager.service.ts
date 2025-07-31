import { EventEmitter } from 'events';
import { logger } from '../logger/logger';
import { IStrategy } from './strategies/strategy.interface';
import { MarketData, TradeSignal } from '../schemas/strategy.schema';

// Utility functions to eliminate code duplication
class ExecutionUtils {
    /**
     * Generate a unique ID with timestamp and random suffix
     */
    static generateId(prefix: string): string {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate a hash from market data (last 10 data points)
     */
    static generateDataHash(marketData: MarketData[]): string {
        return JSON.stringify(marketData.slice(-10)); // Last 10 data points
    }

    /**
     * Calculate execution time in milliseconds
     */
    static calculateExecutionTime(startTime: number): number {
        return Date.now() - startTime;
    }

    /**
     * Check if cache entry is still valid
     */
    static isCacheValid(timestamp: number, ttl: number): boolean {
        return Date.now() - timestamp < ttl;
    }

    /**
     * Get current timestamp
     */
    static getCurrentTimestamp(): number {
        return Date.now();
    }
}

// Centralized logging utility to eliminate logging duplication
class ExecutionLogger {
    static logTaskAdded(taskId: string, strategyName: string, priority: string, queueLength: number): void {
        logger.debug('Task added to queue', {
            taskId,
            strategyName,
            priority,
            queueLength
        });
    }

    static logTaskSkipped(taskId: string): void {
        logger.debug('Task already in queue, skipping', { taskId });
    }

    static logTaskProcessing(taskCount: number): void {
        logger.debug(`Processing ${taskCount} tasks`);
    }

    static logCachedResult(taskId: string): void {
        logger.debug('Using cached result', { taskId });
    }

    static logExecutionSuccess(result: ExecutionResult): void {
        logger.info('Strategy execution successful', {
            taskId: result.taskId,
            strategyName: result.strategyName,
            signalCount: result.signals.length,
            executionTime: result.executionTime
        });
    }

    static logTaskRetry(taskId: string, strategyName: string, retryCount: number, error: string): void {
        logger.warn('Task failed, retrying', {
            taskId,
            strategyName,
            retryCount,
            error
        });
    }

    static logTaskFailed(taskId: string, strategyName: string, maxRetries: number): void {
        logger.error('Task failed permanently', {
            taskId,
            strategyName,
            maxRetries
        });
    }

    static logTimeoutWarning(activeTaskCount: number): void {
        logger.warn(`${activeTaskCount} tasks did not complete within timeout`);
    }

    static logSystemConstrained(): void {
        logger.debug('System resources constrained, skipping execution cycle');
    }

    static logConfigUpdated(config: StrategyExecutionConfig): void {
        logger.info('Strategy Execution Manager config updated', { config });
    }

    static logQueueCleared(): void {
        logger.info('Strategy execution queue cleared');
    }

    static logManagerStarted(): void {
        logger.info('Strategy Execution Manager started');
    }

    static logManagerStopped(): void {
        logger.info('Strategy Execution Manager stopped');
    }

    static logManagerAlreadyRunning(): void {
        logger.warn('Strategy Execution Manager is already running');
    }

    static logManagerInitialized(config: StrategyExecutionConfig): void {
        logger.info('Strategy Execution Manager initialized', { config });
    }

    static logExecutionLoopError(error: any): void {
        logger.error('Error in execution loop:', error);
    }
}

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
    enableDeduplication: boolean;       // Enable task deduplication
    maxQueueSize: number;               // Maximum queue size to prevent memory issues
    adaptiveBatchSize: boolean;         // Dynamically adjust batch size based on performance
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
    hash?: string;                      // For deduplication
    estimatedExecutionTime?: number;    // For better scheduling
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
    cacheHitRate: number; // Cache hit rate percentage
    queueLatency: number; // Average time tasks spend in queue
}

// Priority Queue Node
interface PriorityQueueNode {
    task: StrategyTask;
    priority: number;
    timestamp: number;
}

// Optimized Priority Queue Implementation
class PriorityQueue {
    private heap: PriorityQueueNode[] = [];
    private taskMap: Map<string, number> = new Map(); // taskId -> heap index

    enqueue(task: StrategyTask, priority: number): void {
        const node: PriorityQueueNode = {
            task,
            priority,
            timestamp: ExecutionUtils.getCurrentTimestamp()
        };

        this.heap.push(node);
        this.taskMap.set(task.id, this.heap.length - 1);
        this.bubbleUp(this.heap.length - 1);
    }

    dequeue(): StrategyTask | null {
        if (this.heap.length === 0) return null;

        const firstNode = this.heap[0];
        if (!firstNode) return null;

        const task = firstNode.task;
        this.taskMap.delete(task.id);

        if (this.heap.length === 1) {
            this.heap = [];
            return task;
        }

        const lastNode = this.heap.pop();
        if (!lastNode) return task;

        this.heap[0] = lastNode;
        this.taskMap.set(this.heap[0].task.id, 0);
        this.bubbleDown(0);

        return task;
    }

    peek(): StrategyTask | null {
        if (this.heap.length === 0) return null;
        const firstNode = this.heap[0];
        return firstNode ? firstNode.task : null;
    }

    size(): number {
        return this.heap.length;
    }

    remove(taskId: string): boolean {
        const index = this.taskMap.get(taskId);
        if (index === undefined || index < 0 || index >= this.heap.length) return false;

        this.taskMap.delete(taskId);

        if (index === this.heap.length - 1) {
            this.heap.pop();
            return true;
        }

        const lastNode = this.heap.pop();
        if (!lastNode) return true;

        this.heap[index] = lastNode;
        this.taskMap.set(this.heap[index].task.id, index);

        const parentIndex = Math.floor((index - 1) / 2);
        const parentNode = this.heap[parentIndex];
        const currentNode = this.heap[index];

        if (index > 0 && parentNode && currentNode && parentNode.priority < currentNode.priority) {
            this.bubbleUp(index);
        } else {
            this.bubbleDown(index);
        }

        return true;
    }

    private bubbleUp(index: number): void {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            const parentNode = this.heap[parentIndex];
            const currentNode = this.heap[index];

            if (!parentNode || !currentNode || parentNode.priority >= currentNode.priority) break;

            this.swap(index, parentIndex);
            index = parentIndex;
        }
    }

    private bubbleDown(index: number): void {
        while (true) {
            let largest = index;
            const leftChild = 2 * index + 1;
            const rightChild = 2 * index + 2;

            const largestNode = this.heap[largest];
            if (!largestNode) break;

            if (leftChild < this.heap.length) {
                const leftNode = this.heap[leftChild];
                if (leftNode && leftNode.priority > largestNode.priority) {
                    largest = leftChild;
                }
            }

            if (rightChild < this.heap.length) {
                const rightNode = this.heap[rightChild];
                const currentLargestNode = this.heap[largest];
                if (rightNode && currentLargestNode && rightNode.priority > currentLargestNode.priority) {
                    largest = rightChild;
                }
            }

            if (largest === index) break;

            this.swap(index, largest);
            index = largest;
        }
    }

    private swap(i: number, j: number): void {
        if (i < 0 || i >= this.heap.length || j < 0 || j >= this.heap.length) return;

        const nodeI = this.heap[i];
        const nodeJ = this.heap[j];

        if (!nodeI || !nodeJ) return;

        [this.heap[i], this.heap[j]] = [nodeJ, nodeI];
        this.taskMap.set(nodeJ.task.id, i);
        this.taskMap.set(nodeI.task.id, j);
    }

    // Public method to get all tasks for metrics
    getAllTasks(): StrategyTask[] {
        return this.heap.map(node => node.task);
    }

    // Public method to get wait times for metrics
    getWaitTimes(): number[] {
        const now = ExecutionUtils.getCurrentTimestamp();
        return this.heap.map(node => now - node.timestamp);
    }
}

export class StrategyExecutionManager extends EventEmitter {
    private config: StrategyExecutionConfig;
    private taskQueue: PriorityQueue = new PriorityQueue();
    private activeTasks: Map<string, StrategyTask> = new Map();
    private executionCache: Map<string, { result: ExecutionResult; timestamp: number }> = new Map();
    private taskHashes: Set<string> = new Set(); // For deduplication
    private isRunning: boolean = false;
    private executionInterval: NodeJS.Timeout | null = null;
    private metricsInterval: NodeJS.Timeout | null = null;
    private cacheHits: number = 0;
    private cacheMisses: number = 0;
    private executionTimes: number[] = []; // For adaptive batch sizing
    private metrics: SystemMetrics = {
        cpuUsage: 0,
        memoryUsage: 0,
        activeStrategies: 0,
        queuedTasks: 0,
        averageExecutionTime: 0,
        throughput: 0,
        cacheHitRate: 0,
        queueLatency: 0
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
            enableDeduplication: true,
            maxQueueSize: 1000,
            adaptiveBatchSize: true,
            ...config
        };

        ExecutionLogger.logManagerInitialized(this.config);
    }

    /**
     * Start the execution manager
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            ExecutionLogger.logManagerAlreadyRunning();
            return;
        }

        this.isRunning = true;
        this.startExecutionLoop();
        this.startMetricsMonitoring();

        ExecutionLogger.logManagerStarted();
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

        ExecutionLogger.logManagerStopped();
    }

    /**
     * Add a strategy task to the queue
     */
    addTask(task: Omit<StrategyTask, 'id' | 'timestamp' | 'retryCount' | 'hash' | 'estimatedExecutionTime'>): string {
        const taskId = ExecutionUtils.generateId('task');
        const fullTask: StrategyTask = {
            ...task,
            id: taskId,
            timestamp: new Date(),
            retryCount: 0,
            maxRetries: 3,
            hash: this.generateTaskHash(taskId, task.marketData),
            estimatedExecutionTime: this.estimateExecutionTime(task.strategy, task.marketData)
        };

        // Deduplicate if enabled
        if (this.config.enableDeduplication && fullTask.hash && this.taskHashes.has(fullTask.hash)) {
            ExecutionLogger.logTaskSkipped(fullTask.id);
            this.emit('taskSkipped', fullTask.id);
            return fullTask.id;
        }

        // Insert based on priority
        this.taskQueue.enqueue(fullTask, this.config.priorityLevels[fullTask.priority]);
        if (fullTask.hash) {
            this.taskHashes.add(fullTask.hash);
        }

        this.metrics.queuedTasks = this.taskQueue.size();
        this.emit('taskAdded', taskId);

        ExecutionLogger.logTaskAdded(taskId, task.strategy.name, task.priority, this.taskQueue.size());

        return taskId;
    }

    /**
     * Generate a hash for a task to enable deduplication
     */
    private generateTaskHash(taskId: string, marketData: MarketData[]): string {
        return ExecutionUtils.generateDataHash(marketData);
    }

    /**
     * Estimate execution time for a task
     */
    private estimateExecutionTime(strategy: IStrategy, marketData: MarketData[]): number {
        // This is a placeholder. In a real scenario, you'd run a small sample
        // of the strategy's signal generation to get an average execution time.
        // For now, return a default value.
        return 1000; // Default to 1 second
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
                ExecutionLogger.logExecutionLoopError(error);
            }
        }, this.config.executionInterval);
    }

    /**
     * Process tasks in the queue
     */
    private async processTaskQueue(): Promise<void> {
        // Check system resources
        if (!this.canExecuteMoreTasks()) {
            ExecutionLogger.logSystemConstrained();
            return;
        }

        // Process tasks in batches
        const tasksToProcess = this.getTasksToProcess();

        if (tasksToProcess.length === 0) {
            return;
        }

        ExecutionLogger.logTaskProcessing(tasksToProcess.length);

        // Execute tasks in parallel with limited concurrency
        const executionPromises = tasksToProcess.map(task => this.executeTask(task));
        const results = await Promise.allSettled(executionPromises);

        // Process results
        results.forEach((result, index) => {
            const task = tasksToProcess[index];
            if (!task) return; // Skip if task is undefined
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
        const maxTasks = Math.min(availableSlots, this.config.batchSize, this.taskQueue.size());

        const tasks: StrategyTask[] = [];
        for (let i = 0; i < maxTasks; i++) {
            const task = this.taskQueue.dequeue();
            if (task) {
                tasks.push(task);
            }
        }
        return tasks;
    }

    /**
     * Execute a single strategy task
     */
    private async executeTask(task: StrategyTask): Promise<ExecutionResult> {
        const startTime = ExecutionUtils.getCurrentTimestamp();

        // Check cache first
        if (this.config.enableCaching) {
            const cachedResult = this.getCachedResult(task);
            if (cachedResult) {
                this.cacheHits++;
                ExecutionLogger.logCachedResult(task.id);
                return cachedResult;
            }
            this.cacheMisses++;
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

            const executionTime = ExecutionUtils.calculateExecutionTime(startTime);
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
            const executionTime = ExecutionUtils.calculateExecutionTime(startTime);
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

        if (cached && ExecutionUtils.isCacheValid(cached.timestamp, this.config.cacheTTL)) {
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
            timestamp: ExecutionUtils.getCurrentTimestamp()
        });

        // Clean old cache entries
        this.cleanCache();
    }

    /**
     * Generate cache key
     */
    private generateCacheKey(task: StrategyTask): string {
        const dataHash = ExecutionUtils.generateDataHash(task.marketData);
        return `${task.strategy.name}_${dataHash}`;
    }

    /**
     * Clean old cache entries
     */
    private cleanCache(): void {
        const now = ExecutionUtils.getCurrentTimestamp();
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

        ExecutionLogger.logExecutionSuccess(result);
    }

    /**
     * Handle failed execution
     */
    private handleFailedExecution(task: StrategyTask, error: any): void {
        task.retryCount++;

        if (task.retryCount < task.maxRetries) {
            // Re-queue with lower priority
            const retryTask = { ...task, priority: 'LOW' as const };
            this.taskQueue.enqueue(retryTask, this.config.priorityLevels[retryTask.priority]);
            const retryHash = this.generateTaskHash(retryTask.id, retryTask.marketData);
            if (retryHash) {
                this.taskHashes.add(retryHash);
            }

            ExecutionLogger.logTaskRetry(task.id, task.strategy.name, task.retryCount, error.error || error.message);
        } else {
            // Max retries reached
            this.emit('executionFailed', { taskId: task.id, error });

            ExecutionLogger.logTaskFailed(task.id, task.strategy.name, task.maxRetries);
        }
    }

    /**
     * Wait for active tasks to complete
     */
    private async waitForActiveTasks(): Promise<void> {
        const maxWaitTime = 30000; // 30 seconds
        const startTime = ExecutionUtils.getCurrentTimestamp();

        while (this.activeTasks.size > 0 && ExecutionUtils.calculateExecutionTime(startTime) < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (this.activeTasks.size > 0) {
            ExecutionLogger.logTimeoutWarning(this.activeTasks.size);
        }
    }

    /**
     * Start metrics monitoring
     */
    private startMetricsMonitoring(): void {
        this.metricsInterval = setInterval(() => {
            this.updateSystemMetrics();
            this.updateCacheMetrics();
            this.updateQueueLatency();
        }, 5000); // Update every 5 seconds
    }

    /**
     * Update system metrics
     */
    private updateSystemMetrics(): void {
        // Simulate CPU and memory usage (in real implementation, use actual system metrics)
        this.metrics.cpuUsage = Math.min(100, this.activeTasks.size * 15 + Math.random() * 10);
        this.metrics.memoryUsage = Math.min(100, this.activeTasks.size * 8 + Math.random() * 5);

        this.emit('metricsUpdated', this.metrics);
    }

    /**
     * Update cache metrics
     */
    private updateCacheMetrics(): void {
        this.metrics.cacheHitRate = this.cacheHits > 0 ? (this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100 : 0;
        this.cacheHits = 0;
        this.cacheMisses = 0;
    }

    /**
     * Update queue latency
     */
    private updateQueueLatency(): void {
        const now = ExecutionUtils.getCurrentTimestamp();
        const queueSize = this.taskQueue.size();
        const totalLatency = queueSize * 5000; // Average 5 seconds per task
        this.metrics.queueLatency = totalLatency / queueSize;
    }

    /**
     * Update execution metrics
     */
    private updateMetrics(): void {
        this.metrics.queuedTasks = this.taskQueue.size();

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
        const waitTimes = this.taskQueue.getWaitTimes();
        const averageWaitTime = waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0;

        return {
            queuedTasks: this.taskQueue.size(),
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
        ExecutionLogger.logConfigUpdated(this.config);
    }

    /**
     * Clear queue
     */
    clearQueue(): void {
        this.taskQueue = new PriorityQueue(); // Clear the priority queue
        this.taskHashes.clear(); // Clear deduplication hashes
        this.metrics.queuedTasks = 0;
        ExecutionLogger.logQueueCleared();
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
        return this.taskQueue.getAllTasks();
    }
} 