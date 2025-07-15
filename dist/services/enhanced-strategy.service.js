"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancedStrategyService = exports.EnhancedStrategyService = void 0;
const database_1 = require("../database/database");
const logger_1 = require("../logger/logger");
const strategy_engine_service_1 = require("./strategy-engine.service");
const strategy_factory_service_1 = require("./strategy-factory.service");
const enhanced_market_data_service_1 = require("./enhanced-market-data.service");
class EnhancedStrategyService {
    constructor() {
        this.marketDataService = new enhanced_market_data_service_1.EnhancedMarketDataService();
    }
    async createStrategy(config) {
        try {
            const validation = await strategy_engine_service_1.strategyEngine.validateStrategy(config);
            if (!validation.valid) {
                throw new Error(`Strategy validation failed: ${validation.errors.join(', ')}`);
            }
            const strategy = await strategy_factory_service_1.strategyFactory.createStrategy(config);
            await strategy_engine_service_1.strategyEngine.registerStrategy(strategy);
            const dbStrategy = await database_1.db.strategy.create({
                data: {
                    name: config.name,
                    description: config.description || null,
                    isActive: config.enabled,
                    config: config,
                },
            });
            logger_1.logger.info('Strategy created and registered:', config.name);
            return dbStrategy;
        }
        catch (error) {
            logger_1.logger.error('Failed to create strategy:', error);
            throw error;
        }
    }
    async createStrategyFromTemplate(templateId, customConfig) {
        try {
            const strategy = await strategy_factory_service_1.strategyFactory.createStrategyFromTemplate(templateId, customConfig);
            await strategy_engine_service_1.strategyEngine.registerStrategy(strategy);
            const dbStrategy = await database_1.db.strategy.create({
                data: {
                    name: customConfig.name || strategy.name,
                    description: customConfig.description || strategy.description || null,
                    isActive: customConfig.enabled !== false,
                    config: strategy.config,
                },
            });
            logger_1.logger.info('Strategy created from template:', dbStrategy.name);
            return dbStrategy;
        }
        catch (error) {
            logger_1.logger.error('Failed to create strategy from template:', error);
            throw error;
        }
    }
    async getStrategy(strategyId) {
        try {
            const strategy = await database_1.db.strategy.findUnique({
                where: { id: strategyId },
                include: {
                    trades: {
                        include: {
                            instrument: true,
                            session: true,
                        },
                    },
                },
            });
            return strategy;
        }
        catch (error) {
            logger_1.logger.error('Failed to get strategy:', error);
            throw error;
        }
    }
    async getStrategyByName(name) {
        try {
            const strategy = await database_1.db.strategy.findUnique({
                where: { name },
                include: {
                    trades: {
                        include: {
                            instrument: true,
                            session: true,
                        },
                    },
                },
            });
            return strategy;
        }
        catch (error) {
            logger_1.logger.error('Failed to get strategy by name:', error);
            throw error;
        }
    }
    async getAllStrategies() {
        try {
            const strategies = await database_1.db.strategy.findMany({
                orderBy: { name: 'asc' },
            });
            return strategies;
        }
        catch (error) {
            logger_1.logger.error('Failed to get all strategies:', error);
            throw error;
        }
    }
    async getActiveStrategies() {
        try {
            const strategies = await database_1.db.strategy.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
            });
            return strategies;
        }
        catch (error) {
            logger_1.logger.error('Failed to get active strategies:', error);
            throw error;
        }
    }
    async updateStrategy(strategyId, updates) {
        try {
            const updateData = {};
            if (updates.name !== undefined)
                updateData.name = updates.name;
            if (updates.description !== undefined)
                updateData.description = updates.description;
            if (updates.enabled !== undefined)
                updateData.isActive = updates.enabled;
            if (updates !== undefined)
                updateData.config = updates;
            const strategy = await database_1.db.strategy.update({
                where: { id: strategyId },
                data: updateData,
            });
            const engineStrategy = await strategy_engine_service_1.strategyEngine.getStrategyState(strategy.name);
            if (engineStrategy) {
                const updatedStrategy = await strategy_factory_service_1.strategyFactory.createStrategy(updates);
                await strategy_engine_service_1.strategyEngine.registerStrategy(updatedStrategy);
            }
            logger_1.logger.info('Strategy updated:', strategy.name);
            return strategy;
        }
        catch (error) {
            logger_1.logger.error('Failed to update strategy:', error);
            throw error;
        }
    }
    async toggleStrategy(strategyId, enabled) {
        try {
            const strategy = await database_1.db.strategy.update({
                where: { id: strategyId },
                data: { isActive: enabled },
            });
            logger_1.logger.info('Strategy toggled:', strategy.name, enabled ? 'enabled' : 'disabled');
            return strategy;
        }
        catch (error) {
            logger_1.logger.error('Failed to toggle strategy:', error);
            throw error;
        }
    }
    async deleteStrategy(strategyId) {
        try {
            const strategy = await database_1.db.strategy.delete({
                where: { id: strategyId },
            });
            logger_1.logger.info('Strategy deleted:', strategy.name);
            return strategy;
        }
        catch (error) {
            logger_1.logger.error('Failed to delete strategy:', error);
            throw error;
        }
    }
    async executeStrategy(strategyName, marketData) {
        try {
            logger_1.logger.info('Executing strategy:', strategyName);
            const strategy = await this.getStrategyByName(strategyName);
            if (!strategy || !strategy.isActive) {
                return {
                    success: false,
                    signals: [],
                    error: 'Strategy not found or inactive',
                };
            }
            const result = await strategy_engine_service_1.strategyEngine.executeStrategy(strategyName, marketData);
            if (result.success && result.signals.length > 0) {
                await this.saveSignalsToDatabase(result.signals, strategy.id);
            }
            return result;
        }
        catch (error) {
            logger_1.logger.error('Strategy execution failed:', error);
            return {
                success: false,
                signals: [],
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async executeStrategyWithLiveData(strategyName, symbol, timeframe) {
        try {
            const marketData = await this.marketDataService.getMultiTimeframeData(symbol, timeframe, 100);
            if (!marketData || marketData.length === 0) {
                return {
                    success: false,
                    signals: [],
                    error: 'No market data available',
                };
            }
            return this.executeStrategy(strategyName, marketData);
        }
        catch (error) {
            logger_1.logger.error('Live strategy execution failed:', error);
            return {
                success: false,
                signals: [],
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async getStrategyPerformance(strategyId) {
        try {
            const trades = await database_1.db.trade.findMany({
                where: { strategyId },
                include: {
                    instrument: true,
                },
                orderBy: { orderTime: 'asc' },
            });
            if (trades.length === 0) {
                return null;
            }
            return this.calculatePerformanceMetrics(trades);
        }
        catch (error) {
            logger_1.logger.error('Failed to get strategy performance:', error);
            throw error;
        }
    }
    async getStrategyState(strategyName) {
        try {
            return await strategy_engine_service_1.strategyEngine.getStrategyState(strategyName);
        }
        catch (error) {
            logger_1.logger.error('Failed to get strategy state:', error);
            return null;
        }
    }
    async getAvailableTemplates() {
        try {
            return strategy_factory_service_1.strategyFactory.getAvailableTemplates();
        }
        catch (error) {
            logger_1.logger.error('Failed to get templates:', error);
            throw error;
        }
    }
    async getTemplate(templateId) {
        try {
            return strategy_factory_service_1.strategyFactory.getTemplate(templateId);
        }
        catch (error) {
            logger_1.logger.error('Failed to get template:', error);
            throw error;
        }
    }
    async registerTemplate(template) {
        try {
            await strategy_factory_service_1.strategyFactory.registerTemplate(template);
        }
        catch (error) {
            logger_1.logger.error('Failed to register template:', error);
            throw error;
        }
    }
    async validateStrategy(config) {
        try {
            return await strategy_engine_service_1.strategyEngine.validateStrategy(config);
        }
        catch (error) {
            logger_1.logger.error('Strategy validation failed:', error);
            return {
                valid: false,
                errors: [error instanceof Error ? error.message : 'Unknown validation error']
            };
        }
    }
    async shouldExitPosition(position, strategyName, marketData) {
        try {
            const strategy = await strategy_engine_service_1.strategyEngine.getStrategyState(strategyName);
            if (!strategy)
                return false;
            const availableStrategies = await strategy_engine_service_1.strategyEngine.getAvailableStrategies();
            if (availableStrategies.includes(strategyName)) {
                return false;
            }
            return false;
        }
        catch (error) {
            logger_1.logger.error('Failed to check exit conditions:', error);
            return false;
        }
    }
    async saveSignalsToDatabase(signals, strategyId) {
        try {
            for (const signal of signals) {
                await database_1.db.trade.create({
                    data: {
                        sessionId: 'default',
                        instrumentId: 'default',
                        strategyId,
                        action: signal.action,
                        quantity: signal.quantity,
                        price: signal.price,
                        orderType: 'MARKET',
                        status: 'PENDING',
                        stopLoss: signal.stopLoss,
                        target: signal.target,
                        orderTime: signal.timestamp,
                    },
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to save signals to database:', error);
        }
    }
    calculatePerformanceMetrics(trades) {
        const completedTrades = trades.filter(t => t.status === 'COMPLETE');
        const winningTrades = completedTrades.filter(t => (t.realizedPnL || 0) > 0);
        const losingTrades = completedTrades.filter(t => (t.realizedPnL || 0) < 0);
        const totalPnL = completedTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
        const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0;
        const totalReturn = totalPnL / 100000;
        const maxDrawdown = this.calculateMaxDrawdown(completedTrades);
        return {
            id: `perf_${Date.now()}`,
            strategyId: trades[0]?.strategyId || '',
            period: 'ALL',
            startDate: trades[0]?.orderTime || new Date(),
            endDate: trades[trades.length - 1]?.orderTime || new Date(),
            totalReturn,
            annualizedReturn: totalReturn * 252,
            sharpeRatio: this.calculateSharpeRatio(completedTrades),
            sortinoRatio: this.calculateSortinoRatio(completedTrades),
            calmarRatio: totalReturn / maxDrawdown,
            maxDrawdown,
            winRate,
            profitFactor: this.calculateProfitFactor(winningTrades, losingTrades),
            averageWin: winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0) / winningTrades.length : 0,
            averageLoss: losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + Math.abs(t.realizedPnL || 0), 0) / losingTrades.length : 0,
            largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.realizedPnL || 0)) : 0,
            largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.realizedPnL || 0)) : 0,
            totalTrades: trades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            averageHoldingPeriod: this.calculateAverageHoldingPeriod(completedTrades),
            volatility: this.calculateVolatility(completedTrades),
            beta: 1,
            alpha: 0,
            informationRatio: 0,
            treynorRatio: 0,
            jensenAlpha: 0,
            createdAt: new Date()
        };
    }
    calculateMaxDrawdown(trades) {
        let peak = 0;
        let maxDrawdown = 0;
        let runningPnL = 0;
        for (const trade of trades) {
            runningPnL += trade.realizedPnL || 0;
            if (runningPnL > peak) {
                peak = runningPnL;
            }
            const drawdown = (peak - runningPnL) / peak;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }
        return maxDrawdown * 100;
    }
    calculateSharpeRatio(trades) {
        if (trades.length < 2)
            return 0;
        const returns = trades.map(t => t.realizedPnL || 0);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        return stdDev > 0 ? avgReturn / stdDev : 0;
    }
    calculateSortinoRatio(trades) {
        if (trades.length < 2)
            return 0;
        const returns = trades.map(t => t.realizedPnL || 0);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const negativeReturns = returns.filter(r => r < 0);
        const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const downsideDeviation = Math.sqrt(downsideVariance);
        return downsideDeviation > 0 ? avgReturn / downsideDeviation : 0;
    }
    calculateProfitFactor(winningTrades, losingTrades) {
        const totalWins = winningTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
        const totalLosses = losingTrades.reduce((sum, t) => sum + Math.abs(t.realizedPnL || 0), 0);
        return totalLosses > 0 ? totalWins / totalLosses : 0;
    }
    calculateAverageHoldingPeriod(trades) {
        const holdingPeriods = trades
            .filter(t => t.executionTime && t.orderTime)
            .map(t => (new Date(t.executionTime).getTime() - new Date(t.orderTime).getTime()) / (1000 * 60 * 60 * 24));
        return holdingPeriods.length > 0 ? holdingPeriods.reduce((sum, h) => sum + h, 0) / holdingPeriods.length : 0;
    }
    calculateVolatility(trades) {
        if (trades.length < 2)
            return 0;
        const returns = trades.map(t => t.realizedPnL || 0);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        return Math.sqrt(variance);
    }
}
exports.EnhancedStrategyService = EnhancedStrategyService;
exports.enhancedStrategyService = new EnhancedStrategyService();
//# sourceMappingURL=enhanced-strategy.service.js.map