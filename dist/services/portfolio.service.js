"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortfolioService = void 0;
const database_1 = require("../database/database");
const logger_1 = require("../logger/logger");
const market_data_service_1 = require("./market-data.service");
const order_service_1 = require("./order.service");
class PortfolioService {
    constructor() {
        this.marketDataService = new market_data_service_1.MarketDataService();
        this.orderService = new order_service_1.OrderService();
    }
    async getPortfolioMetrics(sessionId) {
        try {
            const positions = await this.getPositions(sessionId);
            const historicalReturns = await this.getHistoricalReturns(sessionId);
            const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0);
            const unrealizedPnL = positions.reduce((sum, pos) => sum + (pos.unrealizedPnL || 0), 0);
            const realizedPnL = positions.reduce((sum, pos) => sum + (pos.realizedPnL || 0), 0);
            const totalPnL = unrealizedPnL + realizedPnL;
            const metrics = await this.calculateRiskMetrics(historicalReturns);
            return {
                totalValue,
                totalPnL,
                unrealizedPnL,
                realizedPnL,
                sharpeRatio: metrics.sharpeRatio,
                sortinoRatio: metrics.sortinoRatio,
                maxDrawdown: metrics.maxDrawdown,
                returns: await this.calculateReturns(historicalReturns)
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get portfolio metrics:', error);
            throw error;
        }
    }
    async getPositions(sessionId) {
        try {
            const positions = await database_1.db.position.findMany({
                where: {
                    sessionId,
                    closeTime: null
                },
                include: {
                    instrument: true
                }
            });
            const totalValue = positions.reduce((sum, pos) => sum + (pos.quantity * (pos.currentPrice || pos.averagePrice)), 0);
            return Promise.all(positions.map(async (pos) => {
                const currentPrice = pos.currentPrice || pos.averagePrice;
                const value = pos.quantity * currentPrice;
                const weight = value / totalValue;
                const previousClose = await this.marketDataService.getPreviousClose(pos.instrument.symbol);
                const dayChange = currentPrice - previousClose;
                const dayChangePercent = (dayChange / previousClose) * 100;
                return {
                    ...pos,
                    weight,
                    value,
                    dayChange,
                    dayChangePercent
                };
            }));
        }
        catch (error) {
            logger_1.logger.error('Failed to get positions:', error);
            throw error;
        }
    }
    async rebalancePortfolio(sessionId, targetAllocations) {
        try {
            const positions = await this.getPositions(sessionId);
            const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0);
            const rebalanceActions = [];
            for (const target of targetAllocations) {
                const position = positions.find(p => p.instrumentId === target.instrumentId);
                const currentPrice = position?.currentPrice || await this.marketDataService.getCurrentPrice(target.instrumentId);
                if (!currentPrice) {
                    throw new Error(`Could not get current price for instrument ${target.instrumentId}`);
                }
                const targetValue = totalValue * target.targetWeight;
                const currentValue = position?.value || 0;
                const valueDifference = targetValue - currentValue;
                if (Math.abs(valueDifference) > totalValue * 0.01) {
                    const quantity = Math.floor(Math.abs(valueDifference) / currentPrice);
                    if (quantity > 0) {
                        rebalanceActions.push({
                            instrumentId: target.instrumentId,
                            action: valueDifference > 0 ? 'BUY' : 'SELL',
                            quantity,
                            currentPrice,
                            targetValue
                        });
                    }
                }
            }
            return rebalanceActions;
        }
        catch (error) {
            logger_1.logger.error('Failed to calculate rebalance actions:', error);
            throw error;
        }
    }
    async getHistoricalReturns(sessionId) {
        try {
            const trades = await database_1.db.trade.findMany({
                where: { sessionId },
                orderBy: { executionTime: 'asc' },
                include: { positions: true }
            });
            const returns = [];
            let portfolioValue = 0;
            let maxValue = 0;
            for (const trade of trades) {
                if (!trade.executionTime)
                    continue;
                const price = trade.price;
                if (!price)
                    continue;
                const tradeValue = trade.quantity * price;
                portfolioValue += trade.action === 'BUY' ? tradeValue : -tradeValue;
                maxValue = Math.max(maxValue, portfolioValue);
                returns.push({
                    date: trade.executionTime,
                    value: portfolioValue,
                    return: ((portfolioValue / maxValue) - 1) * 100,
                    drawdown: ((maxValue - portfolioValue) / maxValue) * 100
                });
            }
            return returns;
        }
        catch (error) {
            logger_1.logger.error('Failed to get historical returns:', error);
            throw error;
        }
    }
    async calculateRiskMetrics(returns) {
        if (returns.length === 0) {
            return {
                volatility: 0,
                beta: 1.0,
                alpha: 0,
                sharpeRatio: 0,
                sortinoRatio: 0,
                maxDrawdown: 0,
                valueAtRisk: 0,
                expectedShortfall: 0
            };
        }
        const returnValues = returns.map(r => r.return);
        const riskFreeRate = 0.05;
        const mean = returnValues.reduce((sum, val) => sum + val, 0) / returnValues.length;
        const variance = returnValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / returnValues.length;
        const volatility = Math.sqrt(variance);
        const excessReturns = returnValues.map(r => r - (riskFreeRate / 252));
        const sharpeRatio = (mean - (riskFreeRate / 252)) / volatility * Math.sqrt(252);
        const negativeReturns = returnValues.filter(r => r < 0);
        const downsideDeviation = negativeReturns.length > 0
            ? Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length)
            : 0;
        const sortinoRatio = downsideDeviation === 0 ? 0 : (mean - (riskFreeRate / 252)) / downsideDeviation * Math.sqrt(252);
        const maxDrawdown = Math.max(...returns.map(r => r.drawdown));
        const sortedReturns = [...returnValues].sort((a, b) => a - b);
        const varIndex = Math.floor(0.05 * sortedReturns.length);
        const valueAtRisk = varIndex > 0 && sortedReturns[varIndex] !== undefined
            ? -sortedReturns[varIndex]
            : 0;
        const expectedShortfall = varIndex > 0 && sortedReturns.slice(0, varIndex).length > 0
            ? -sortedReturns.slice(0, varIndex).reduce((sum, val) => sum + val, 0) / varIndex
            : 0;
        return {
            volatility,
            beta: 1.0,
            alpha: mean - riskFreeRate,
            sharpeRatio,
            sortinoRatio,
            maxDrawdown,
            valueAtRisk,
            expectedShortfall
        };
    }
    async calculateReturns(historicalReturns) {
        if (historicalReturns.length === 0) {
            return { daily: 0, weekly: 0, monthly: 0, yearly: 0 };
        }
        const latest = historicalReturns[historicalReturns.length - 1];
        if (!latest) {
            return { daily: 0, weekly: 0, monthly: 0, yearly: 0 };
        }
        const oneDay = historicalReturns.find(r => r.date >= new Date(Date.now() - 24 * 60 * 60 * 1000));
        const oneWeek = historicalReturns.find(r => r.date >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
        const oneMonth = historicalReturns.find(r => r.date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
        const oneYear = historicalReturns.find(r => r.date >= new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));
        return {
            daily: oneDay ? ((latest.value / oneDay.value) - 1) * 100 : 0,
            weekly: oneWeek ? ((latest.value / oneWeek.value) - 1) * 100 : 0,
            monthly: oneMonth ? ((latest.value / oneMonth.value) - 1) * 100 : 0,
            yearly: oneYear ? ((latest.value / oneYear.value) - 1) * 100 : 0
        };
    }
}
exports.PortfolioService = PortfolioService;
//# sourceMappingURL=portfolio.service.js.map