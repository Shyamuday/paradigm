"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyService = void 0;
const database_1 = require("../database/database");
const logger_1 = require("../logger/logger");
class StrategyService {
    async createStrategy(config) {
        try {
            const strategy = await database_1.db.strategy.create({
                data: {
                    name: config.name,
                    description: config.description || null,
                    isActive: config.enabled,
                    config: config,
                },
            });
            logger_1.logger.info('Strategy created:', strategy.name);
            return strategy;
        }
        catch (error) {
            logger_1.logger.error('Failed to create strategy:', error);
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
            const signals = await this.generateSignals(strategy, marketData);
            logger_1.logger.info('Strategy signals generated:', signals.length);
            return {
                success: true,
                signals,
            };
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
    async generateSignals(strategy, marketData) {
        const signals = [];
        if (strategy.name === 'simple_ma') {
            const config = strategy.config;
            const maConfig = {
                shortPeriod: config.parameters?.shortPeriod || 10,
                longPeriod: config.parameters?.longPeriod || 20,
                volumeThreshold: config.parameters?.volumeThreshold
            };
            const shortMA = this.calculateSMA(marketData, maConfig.shortPeriod);
            const longMA = this.calculateSMA(marketData, maConfig.longPeriod);
            for (let i = 1; i < marketData.length; i++) {
                const currentData = marketData[i];
                const prevData = marketData[i - 1];
                if (!currentData || !prevData)
                    continue;
                const currentShortMA = shortMA[i];
                const currentLongMA = longMA[i];
                const prevShortMA = shortMA[i - 1];
                const prevLongMA = longMA[i - 1];
                if (!currentShortMA || !currentLongMA || !prevShortMA || !prevLongMA || !currentData.symbol) {
                    continue;
                }
                if (maConfig.volumeThreshold && (!currentData.volume || currentData.volume < maConfig.volumeThreshold)) {
                    continue;
                }
                const currentCrossover = currentShortMA - currentLongMA;
                const previousCrossover = prevShortMA - prevLongMA;
                let action = 'HOLD';
                if (previousCrossover <= 0 && currentCrossover > 0) {
                    action = 'BUY';
                }
                else if (previousCrossover >= 0 && currentCrossover < 0) {
                    action = 'SELL';
                }
                if (action !== 'HOLD') {
                    const signal = this.createSignal(currentData, action, {
                        shortMA: currentShortMA,
                        longMA: currentLongMA,
                        shortPeriod: maConfig.shortPeriod,
                        longPeriod: maConfig.longPeriod
                    });
                    if (signal) {
                        signals.push(signal);
                    }
                }
            }
        }
        return signals;
    }
    calculateSMA(data, period) {
        const sma = new Array(data.length).fill(null);
        let sum = 0;
        let validPoints = 0;
        for (let i = 0; i < data.length; i++) {
            const price = data[i].close || data[i].ltp;
            if (typeof price !== 'number')
                continue;
            sum += price;
            validPoints++;
            if (i >= period - 1 && validPoints >= period) {
                sma[i] = sum / period;
                const oldDataPoint = data[i - (period - 1)];
                if (oldDataPoint) {
                    const oldPrice = oldDataPoint.close || oldDataPoint.ltp;
                    if (typeof oldPrice === 'number') {
                        sum -= oldPrice;
                        validPoints--;
                    }
                }
            }
        }
        return sma;
    }
    createSignal(data, action, metadata) {
        const price = data.close || data.ltp;
        if (!price || !data.symbol)
            return null;
        const atr = this.calculateATR(data);
        if (!atr)
            return null;
        const stopLossMultiplier = 2;
        const targetMultiplier = 3;
        const stopLoss = action === 'BUY'
            ? price - (atr * stopLossMultiplier)
            : price + (atr * stopLossMultiplier);
        const target = action === 'BUY'
            ? price + (atr * targetMultiplier)
            : price - (atr * targetMultiplier);
        return {
            id: `signal_${Date.now()}_${Math.random()}`,
            strategy: 'simple_ma',
            symbol: data.symbol,
            action,
            quantity: 1,
            price,
            stopLoss,
            target,
            timestamp: new Date(data.timestamp),
            metadata: {
                ...metadata,
                atr,
                currentPrice: price
            }
        };
    }
    calculateATR(data, period = 14) {
        const high = data.high;
        const low = data.low;
        const close = data.close || data.ltp;
        if (typeof high !== 'number' || typeof low !== 'number' || typeof close !== 'number') {
            return null;
        }
        const tr = Math.max(high - low, Math.abs(high - close), Math.abs(low - close));
        return tr;
    }
    async getStrategyPerformance(strategyId) {
        try {
            const trades = await database_1.db.trade.findMany({
                where: { strategyId },
                include: {
                    positions: true,
                },
            });
            const totalTrades = trades.length;
            const completedTrades = trades.filter(t => t.status === 'COMPLETE');
            const winningTrades = completedTrades.filter(t => (t.realizedPnL || 0) > 0);
            const losingTrades = completedTrades.filter(t => (t.realizedPnL || 0) < 0);
            const totalPnL = completedTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
            const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0;
            return {
                totalTrades,
                completedTrades: completedTrades.length,
                winningTrades: winningTrades.length,
                losingTrades: losingTrades.length,
                winRate,
                totalPnL,
                averagePnL: completedTrades.length > 0 ? totalPnL / completedTrades.length : 0,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get strategy performance:', error);
            throw error;
        }
    }
}
exports.StrategyService = StrategyService;
//# sourceMappingURL=strategy.service.js.map