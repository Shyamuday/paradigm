import { db } from '../database/database';
import { logger } from '../logger/logger';
import { OrderService } from './order.service';
import { MarketDataService } from './market-data.service';

interface ExecutionConfig {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    startTime?: Date;
    endTime?: Date;
    maxParticipationRate?: number;
    priceLimit?: number;
}

interface VWAPConfig extends ExecutionConfig {
    lookbackPeriods?: number;
    deviationThreshold?: number;
}

interface TWAPConfig extends ExecutionConfig {
    numIntervals: number;
    randomizeInterval?: boolean;
    intervalVariance?: number;
}

interface PoVConfig extends ExecutionConfig {
    participationRate: number;
    minVolume?: number;
    volumeLookback?: number;
}

interface ExecutionState {
    orderId: string;
    algorithm: 'VWAP' | 'TWAP' | 'PoV';
    symbol: string;
    side: 'BUY' | 'SELL';
    totalQuantity: number;
    executedQuantity: number;
    remainingQuantity: number;
    avgExecutionPrice: number;
    startTime: Date;
    endTime: Date;
    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    lastUpdate: Date;
}

export class ExecutionService {
    private orderService: OrderService;
    private marketDataService: MarketDataService;
    private activeExecutions: Map<string, ExecutionState>;
    private executionInterval: NodeJS.Timeout | null;

    constructor() {
        this.orderService = new OrderService();
        this.marketDataService = new MarketDataService();
        this.activeExecutions = new Map();
        this.executionInterval = null;
        this.startExecutionLoop();
    }

    async executeVWAP(sessionId: string, config: VWAPConfig): Promise<string> {
        try {
            // Validate config
            if (!config.startTime) config.startTime = new Date();
            if (!config.endTime) {
                config.endTime = new Date(config.startTime.getTime() + 24 * 60 * 60 * 1000); // Default to 24 hours
            }
            if (config.endTime <= config.startTime) {
                throw new Error('End time must be after start time');
            }

            // Initialize execution state
            const executionId = await this.createExecution(sessionId, {
                algorithm: 'VWAP',
                symbol: config.symbol,
                side: config.side,
                totalQuantity: config.quantity,
                startTime: config.startTime,
                endTime: config.endTime
            });

            // Calculate VWAP parameters
            const lookback = config.lookbackPeriods || 20;
            const vwapData = await this.calculateVWAP(config.symbol, lookback);
            const initialVWAP = vwapData.vwap;
            const deviationThreshold = config.deviationThreshold || 0.02; // 2% default

            // Start execution
            this.activeExecutions.set(executionId, {
                orderId: executionId,
                algorithm: 'VWAP',
                symbol: config.symbol,
                side: config.side,
                totalQuantity: config.quantity,
                executedQuantity: 0,
                remainingQuantity: config.quantity,
                avgExecutionPrice: 0,
                startTime: config.startTime,
                endTime: config.endTime,
                status: 'ACTIVE',
                lastUpdate: new Date()
            });

            logger.info('VWAP execution started:', executionId);
            return executionId;
        } catch (error) {
            logger.error('Failed to start VWAP execution:', error);
            throw error;
        }
    }

    async executeTWAP(sessionId: string, config: TWAPConfig): Promise<string> {
        try {
            // Validate config
            if (!config.startTime) config.startTime = new Date();
            if (!config.endTime) {
                config.endTime = new Date(config.startTime.getTime() + 24 * 60 * 60 * 1000); // Default to 24 hours
            }
            if (config.endTime <= config.startTime) {
                throw new Error('End time must be after start time');
            }

            // Calculate interval size
            const totalDuration = config.endTime.getTime() - config.startTime.getTime();
            const baseIntervalMs = totalDuration / config.numIntervals;

            // Initialize execution state
            const executionId = await this.createExecution(sessionId, {
                algorithm: 'TWAP',
                symbol: config.symbol,
                side: config.side,
                totalQuantity: config.quantity,
                startTime: config.startTime,
                endTime: config.endTime
            });

            // Calculate quantity per interval
            const quantityPerInterval = Math.floor(config.quantity / config.numIntervals);
            const remainingQuantity = config.quantity % config.numIntervals;

            this.activeExecutions.set(executionId, {
                orderId: executionId,
                algorithm: 'TWAP',
                symbol: config.symbol,
                side: config.side,
                totalQuantity: config.quantity,
                executedQuantity: 0,
                remainingQuantity: config.quantity,
                avgExecutionPrice: 0,
                startTime: config.startTime,
                endTime: config.endTime,
                status: 'ACTIVE',
                lastUpdate: new Date()
            });

            logger.info('TWAP execution started:', executionId);
            return executionId;
        } catch (error) {
            logger.error('Failed to start TWAP execution:', error);
            throw error;
        }
    }

    async executePoV(sessionId: string, config: PoVConfig): Promise<string> {
        try {
            // Validate config
            if (!config.startTime) config.startTime = new Date();
            if (!config.endTime) {
                config.endTime = new Date(config.startTime.getTime() + 24 * 60 * 60 * 1000); // Default to 24 hours
            }
            if (config.endTime <= config.startTime) {
                throw new Error('End time must be after start time');
            }
            if (config.participationRate <= 0 || config.participationRate > 1) {
                throw new Error('Participation rate must be between 0 and 1');
            }

            // Initialize execution state
            const executionId = await this.createExecution(sessionId, {
                algorithm: 'PoV',
                symbol: config.symbol,
                side: config.side,
                totalQuantity: config.quantity,
                startTime: config.startTime,
                endTime: config.endTime
            });

            this.activeExecutions.set(executionId, {
                orderId: executionId,
                algorithm: 'PoV',
                symbol: config.symbol,
                side: config.side,
                totalQuantity: config.quantity,
                executedQuantity: 0,
                remainingQuantity: config.quantity,
                avgExecutionPrice: 0,
                startTime: config.startTime,
                endTime: config.endTime,
                status: 'ACTIVE',
                lastUpdate: new Date()
            });

            logger.info('PoV execution started:', executionId);
            return executionId;
        } catch (error) {
            logger.error('Failed to start PoV execution:', error);
            throw error;
        }
    }

    private startExecutionLoop() {
        if (this.executionInterval) {
            clearInterval(this.executionInterval);
        }

        this.executionInterval = setInterval(async () => {
            try {
                for (const [executionId, state] of this.activeExecutions) {
                    if (state.status !== 'ACTIVE') continue;

                    const now = new Date();
                    if (now >= state.endTime) {
                        await this.completeExecution(executionId);
                        continue;
                    }

                    switch (state.algorithm) {
                        case 'VWAP':
                            await this.processVWAPExecution(executionId, state);
                            break;
                        case 'TWAP':
                            await this.processTWAPExecution(executionId, state);
                            break;
                        case 'PoV':
                            await this.processPoVExecution(executionId, state);
                            break;
                    }
                }
            } catch (error) {
                logger.error('Error in execution loop:', error);
            }
        }, 1000); // Check every second
    }

    private async processVWAPExecution(executionId: string, state: ExecutionState) {
        try {
            const marketData = await this.marketDataService.getLatestMarketData(state.symbol);
            if (!marketData.length) return;

            const currentPrice = marketData[0].close;
            if (!currentPrice) return;

            // Calculate VWAP for comparison
            const vwapData = await this.calculateVWAP(state.symbol, 20);
            const currentVWAP = vwapData.vwap;

            // Determine order size based on price relative to VWAP
            const priceDeviation = Math.abs(currentPrice - currentVWAP) / currentVWAP;
            let orderSize = Math.min(
                Math.ceil(state.remainingQuantity * 0.1), // Base slice size is 10% of remaining
                Math.floor(state.remainingQuantity * (1 - priceDeviation)) // Reduce size as deviation increases
            );

            if (orderSize > 0) {
                await this.placeExecutionOrder(executionId, state, orderSize, currentPrice);
            }
        } catch (error) {
            logger.error('Error processing VWAP execution:', error);
        }
    }

    private async processTWAPExecution(executionId: string, state: ExecutionState) {
        try {
            const marketData = await this.marketDataService.getLatestMarketData(state.symbol);
            if (!marketData.length) return;

            const currentPrice = marketData[0].close;
            if (!currentPrice) return;

            // Calculate time-based order size
            const totalDuration = state.endTime.getTime() - state.startTime.getTime();
            const elapsed = new Date().getTime() - state.startTime.getTime();
            const progress = elapsed / totalDuration;

            const expectedQuantity = Math.floor(state.totalQuantity * progress);
            const orderSize = expectedQuantity - state.executedQuantity;

            if (orderSize > 0) {
                await this.placeExecutionOrder(executionId, state, orderSize, currentPrice);
            }
        } catch (error) {
            logger.error('Error processing TWAP execution:', error);
        }
    }

    private async processPoVExecution(executionId: string, state: ExecutionState) {
        try {
            const marketData = await this.marketDataService.getLatestMarketData(state.symbol);
            if (!marketData.length) return;

            const currentPrice = marketData[0].close;
            const currentVolume = marketData[0].volume;
            if (!currentPrice || !currentVolume) return;

            // Calculate participation volume
            const orderSize = Math.min(
                Math.floor(currentVolume * 0.3), // Maximum 30% of current volume
                state.remainingQuantity
            );

            if (orderSize > 0) {
                await this.placeExecutionOrder(executionId, state, orderSize, currentPrice);
            }
        } catch (error) {
            logger.error('Error processing PoV execution:', error);
        }
    }

    private async placeExecutionOrder(executionId: string, state: ExecutionState, quantity: number, price: number) {
        try {
            const order = await this.orderService.createTrade(executionId, {
                symbol: state.symbol,
                action: state.side,
                quantity,
                price,
                orderType: 'LIMIT'
            });

            // Update execution state
            state.executedQuantity += quantity;
            state.remainingQuantity -= quantity;
            state.avgExecutionPrice = (state.avgExecutionPrice * (state.executedQuantity - quantity) + price * quantity) / state.executedQuantity;
            state.lastUpdate = new Date();

            if (state.remainingQuantity <= 0) {
                await this.completeExecution(executionId);
            }

            return order;
        } catch (error) {
            logger.error('Failed to place execution order:', error);
            throw error;
        }
    }

    private async createExecution(sessionId: string, config: {
        algorithm: 'VWAP' | 'TWAP' | 'PoV';
        symbol: string;
        side: 'BUY' | 'SELL';
        totalQuantity: number;
        startTime: Date;
        endTime: Date;
    }) {
        try {
            const execution = await db.execution.create({
                data: {
                    sessionId,
                    algorithm: config.algorithm,
                    symbol: config.symbol,
                    side: config.side,
                    totalQuantity: config.totalQuantity,
                    executedQuantity: 0,
                    avgExecutionPrice: 0,
                    startTime: config.startTime,
                    endTime: config.endTime,
                    status: 'ACTIVE'
                }
            });

            return execution.id;
        } catch (error) {
            logger.error('Failed to create execution record:', error);
            throw error;
        }
    }

    private async completeExecution(executionId: string) {
        try {
            const state = this.activeExecutions.get(executionId);
            if (!state) return;

            await db.execution.update({
                where: { id: executionId },
                data: {
                    executedQuantity: state.executedQuantity,
                    avgExecutionPrice: state.avgExecutionPrice,
                    status: 'COMPLETED',
                    completedAt: new Date()
                }
            });

            state.status = 'COMPLETED';
            logger.info('Execution completed:', executionId);
        } catch (error) {
            logger.error('Failed to complete execution:', error);
        }
    }

    private async calculateVWAP(symbol: string, periods: number) {
        try {
            const marketData = await this.marketDataService.getHistoricalData(
                symbol,
                new Date(Date.now() - periods * 24 * 60 * 60 * 1000),
                new Date()
            );

            let sumPriceVolume = 0;
            let sumVolume = 0;

            for (const data of marketData) {
                const typicalPrice = (data.high + data.low + data.close) / 3;
                sumPriceVolume += typicalPrice * data.volume;
                sumVolume += data.volume;
            }

            return {
                vwap: sumVolume > 0 ? sumPriceVolume / sumVolume : 0,
                volume: sumVolume
            };
        } catch (error) {
            logger.error('Failed to calculate VWAP:', error);
            throw error;
        }
    }

    async cancelExecution(executionId: string) {
        try {
            const state = this.activeExecutions.get(executionId);
            if (!state || state.status !== 'ACTIVE') {
                throw new Error('Execution not found or not active');
            }

            await db.execution.update({
                where: { id: executionId },
                data: {
                    status: 'CANCELLED',
                    completedAt: new Date()
                }
            });

            state.status = 'CANCELLED';
            this.activeExecutions.delete(executionId);

            logger.info('Execution cancelled:', executionId);
        } catch (error) {
            logger.error('Failed to cancel execution:', error);
            throw error;
        }
    }

    async getExecution(executionId: string) {
        try {
            const execution = await db.execution.findUnique({
                where: { id: executionId },
                include: {
                    trades: true
                }
            });

            return execution;
        } catch (error) {
            logger.error('Failed to get execution:', error);
            throw error;
        }
    }

    async getActiveExecutions() {
        try {
            const executions = await db.execution.findMany({
                where: { status: 'ACTIVE' },
                include: {
                    trades: true
                },
                orderBy: { startTime: 'desc' }
            });

            return executions;
        } catch (error) {
            logger.error('Failed to get active executions:', error);
            throw error;
        }
    }
} 