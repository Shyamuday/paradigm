"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionService = void 0;
const database_1 = require("../database/database");
const logger_1 = require("../logger/logger");
const order_service_1 = require("./order.service");
const market_data_service_1 = require("./market-data.service");
class ExecutionService {
    constructor() {
        this.orderService = new order_service_1.OrderService();
        this.marketDataService = new market_data_service_1.MarketDataService();
        this.activeExecutions = new Map();
        this.executionInterval = null;
        this.startExecutionLoop();
    }
    async executeVWAP(sessionId, config) {
        try {
            if (!config.startTime)
                config.startTime = new Date();
            if (!config.endTime) {
                config.endTime = new Date(config.startTime.getTime() + 24 * 60 * 60 * 1000);
            }
            if (config.endTime <= config.startTime) {
                throw new Error('End time must be after start time');
            }
            const executionId = await this.createExecution(sessionId, {
                algorithm: 'VWAP',
                symbol: config.symbol,
                side: config.side,
                totalQuantity: config.quantity,
                startTime: config.startTime,
                endTime: config.endTime
            });
            const lookback = config.lookbackPeriods || 20;
            const vwapData = await this.calculateVWAP(config.symbol, lookback);
            const initialVWAP = vwapData.vwap;
            const deviationThreshold = config.deviationThreshold || 0.02;
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
            logger_1.logger.info('VWAP execution started:', executionId);
            return executionId;
        }
        catch (error) {
            logger_1.logger.error('Failed to start VWAP execution:', error);
            throw error;
        }
    }
    async executeTWAP(sessionId, config) {
        try {
            if (!config.startTime)
                config.startTime = new Date();
            if (!config.endTime) {
                config.endTime = new Date(config.startTime.getTime() + 24 * 60 * 60 * 1000);
            }
            if (config.endTime <= config.startTime) {
                throw new Error('End time must be after start time');
            }
            const totalDuration = config.endTime.getTime() - config.startTime.getTime();
            const baseIntervalMs = totalDuration / config.numIntervals;
            const executionId = await this.createExecution(sessionId, {
                algorithm: 'TWAP',
                symbol: config.symbol,
                side: config.side,
                totalQuantity: config.quantity,
                startTime: config.startTime,
                endTime: config.endTime
            });
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
            logger_1.logger.info('TWAP execution started:', executionId);
            return executionId;
        }
        catch (error) {
            logger_1.logger.error('Failed to start TWAP execution:', error);
            throw error;
        }
    }
    async executePoV(sessionId, config) {
        try {
            if (!config.startTime)
                config.startTime = new Date();
            if (!config.endTime) {
                config.endTime = new Date(config.startTime.getTime() + 24 * 60 * 60 * 1000);
            }
            if (config.endTime <= config.startTime) {
                throw new Error('End time must be after start time');
            }
            if (config.participationRate <= 0 || config.participationRate > 1) {
                throw new Error('Participation rate must be between 0 and 1');
            }
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
            logger_1.logger.info('PoV execution started:', executionId);
            return executionId;
        }
        catch (error) {
            logger_1.logger.error('Failed to start PoV execution:', error);
            throw error;
        }
    }
    startExecutionLoop() {
        if (this.executionInterval) {
            clearInterval(this.executionInterval);
        }
        this.executionInterval = setInterval(async () => {
            try {
                for (const [executionId, state] of this.activeExecutions) {
                    if (state.status !== 'ACTIVE')
                        continue;
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
            }
            catch (error) {
                logger_1.logger.error('Error in execution loop:', error);
            }
        }, 1000);
    }
    async processVWAPExecution(executionId, state) {
        try {
            const marketData = await this.marketDataService.getLatestMarketData(state.symbol);
            if (!marketData.length)
                return;
            const currentPrice = marketData[0].close;
            if (!currentPrice)
                return;
            const vwapData = await this.calculateVWAP(state.symbol, 20);
            const currentVWAP = vwapData.vwap;
            const priceDeviation = Math.abs(currentPrice - currentVWAP) / currentVWAP;
            let orderSize = Math.min(Math.ceil(state.remainingQuantity * 0.1), Math.floor(state.remainingQuantity * (1 - priceDeviation)));
            if (orderSize > 0) {
                await this.placeExecutionOrder(executionId, state, orderSize, currentPrice);
            }
        }
        catch (error) {
            logger_1.logger.error('Error processing VWAP execution:', error);
        }
    }
    async processTWAPExecution(executionId, state) {
        try {
            const marketData = await this.marketDataService.getLatestMarketData(state.symbol);
            if (!marketData.length)
                return;
            const currentPrice = marketData[0].close;
            if (!currentPrice)
                return;
            const totalDuration = state.endTime.getTime() - state.startTime.getTime();
            const elapsed = new Date().getTime() - state.startTime.getTime();
            const progress = elapsed / totalDuration;
            const expectedQuantity = Math.floor(state.totalQuantity * progress);
            const orderSize = expectedQuantity - state.executedQuantity;
            if (orderSize > 0) {
                await this.placeExecutionOrder(executionId, state, orderSize, currentPrice);
            }
        }
        catch (error) {
            logger_1.logger.error('Error processing TWAP execution:', error);
        }
    }
    async processPoVExecution(executionId, state) {
        try {
            const marketData = await this.marketDataService.getLatestMarketData(state.symbol);
            if (!marketData.length)
                return;
            const currentPrice = marketData[0].close;
            const currentVolume = marketData[0].volume;
            if (!currentPrice || !currentVolume)
                return;
            const orderSize = Math.min(Math.floor(currentVolume * 0.3), state.remainingQuantity);
            if (orderSize > 0) {
                await this.placeExecutionOrder(executionId, state, orderSize, currentPrice);
            }
        }
        catch (error) {
            logger_1.logger.error('Error processing PoV execution:', error);
        }
    }
    async placeExecutionOrder(executionId, state, quantity, price) {
        try {
            const order = await this.orderService.createTrade(executionId, {
                symbol: state.symbol,
                action: state.side,
                quantity,
                price,
                orderType: 'LIMIT'
            });
            state.executedQuantity += quantity;
            state.remainingQuantity -= quantity;
            state.avgExecutionPrice = (state.avgExecutionPrice * (state.executedQuantity - quantity) + price * quantity) / state.executedQuantity;
            state.lastUpdate = new Date();
            if (state.remainingQuantity <= 0) {
                await this.completeExecution(executionId);
            }
            return order;
        }
        catch (error) {
            logger_1.logger.error('Failed to place execution order:', error);
            throw error;
        }
    }
    async createExecution(sessionId, config) {
        try {
            const execution = await database_1.db.execution.create({
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
        }
        catch (error) {
            logger_1.logger.error('Failed to create execution record:', error);
            throw error;
        }
    }
    async completeExecution(executionId) {
        try {
            const state = this.activeExecutions.get(executionId);
            if (!state)
                return;
            await database_1.db.execution.update({
                where: { id: executionId },
                data: {
                    executedQuantity: state.executedQuantity,
                    avgExecutionPrice: state.avgExecutionPrice,
                    status: 'COMPLETED',
                    completedAt: new Date()
                }
            });
            state.status = 'COMPLETED';
            logger_1.logger.info('Execution completed:', executionId);
        }
        catch (error) {
            logger_1.logger.error('Failed to complete execution:', error);
        }
    }
    async calculateVWAP(symbol, periods) {
        try {
            const marketData = await this.marketDataService.getHistoricalData(symbol, new Date(Date.now() - periods * 24 * 60 * 60 * 1000), new Date());
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
        }
        catch (error) {
            logger_1.logger.error('Failed to calculate VWAP:', error);
            throw error;
        }
    }
    async cancelExecution(executionId) {
        try {
            const state = this.activeExecutions.get(executionId);
            if (!state || state.status !== 'ACTIVE') {
                throw new Error('Execution not found or not active');
            }
            await database_1.db.execution.update({
                where: { id: executionId },
                data: {
                    status: 'CANCELLED',
                    completedAt: new Date()
                }
            });
            state.status = 'CANCELLED';
            this.activeExecutions.delete(executionId);
            logger_1.logger.info('Execution cancelled:', executionId);
        }
        catch (error) {
            logger_1.logger.error('Failed to cancel execution:', error);
            throw error;
        }
    }
    async getExecution(executionId) {
        try {
            const execution = await database_1.db.execution.findUnique({
                where: { id: executionId },
                include: {
                    trades: true
                }
            });
            return execution;
        }
        catch (error) {
            logger_1.logger.error('Failed to get execution:', error);
            throw error;
        }
    }
    async getActiveExecutions() {
        try {
            const executions = await database_1.db.execution.findMany({
                where: { status: 'ACTIVE' },
                include: {
                    trades: true
                },
                orderBy: { startTime: 'desc' }
            });
            return executions;
        }
        catch (error) {
            logger_1.logger.error('Failed to get active executions:', error);
            throw error;
        }
    }
}
exports.ExecutionService = ExecutionService;
//# sourceMappingURL=execution.service.js.map