"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BacktestService = void 0;
const database_1 = require("../database/database");
const logger_1 = require("../logger/logger");
const market_data_service_1 = require("./market-data.service");
const order_service_1 = require("./order.service");
const transaction_cost_service_1 = require("./transaction-cost.service");
class BacktestService {
    constructor() {
        this.marketDataService = new market_data_service_1.MarketDataService();
        this.strategyService = new StrategyService();
        this.orderService = new order_service_1.OrderService();
        this.transactionCostService = new transaction_cost_service_1.TransactionCostService();
    }
    async runBacktest(config) {
        try {
            const strategy = await this.strategyService.getStrategy(config.strategyId);
            if (!strategy) {
                throw new Error('Strategy not found');
            }
            logger_1.logger.info('Starting backtest for strategy:', strategy.name);
            const result = {
                strategyId: config.strategyId,
                startDate: config.startDate,
                endDate: config.endDate,
                initialCapital: config.initialCapital,
                finalCapital: config.initialCapital,
                totalReturn: 0,
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                winRate: 0,
                maxDrawdown: 0,
                trades: [],
                dailyReturns: []
            };
            const historicalData = await this.getHistoricalDataForSymbols(config.symbols, config.startDate, config.endDate);
            if (!historicalData.length) {
                throw new Error('No historical data available for the specified period');
            }
            const sortedData = this.sortAndGroupHistoricalData(historicalData);
            let currentCapital = config.initialCapital;
            let highWaterMark = currentCapital;
            let currentDrawdown = 0;
            const openPositions = new Map();
            for (const [date, dayData] of sortedData) {
                const signals = await this.strategyService.executeStrategy(strategy.name, dayData);
                if (!signals.success || !signals.signals.length) {
                    continue;
                }
                for (const signal of signals.signals) {
                    const currentPrice = dayData.find(d => d.symbol === signal.symbol)?.close || 0;
                    if (!currentPrice)
                        continue;
                    const positionSize = this.calculatePositionSize(currentCapital, currentPrice, signal.quantity);
                    if (signal.action === 'BUY' && !openPositions.has(signal.symbol)) {
                        const trade = {
                            symbol: signal.symbol,
                            entryDate: new Date(date),
                            exitDate: new Date(date),
                            entryPrice: currentPrice,
                            exitPrice: currentPrice,
                            quantity: positionSize,
                            side: 'LONG',
                            pnl: 0
                        };
                        if (config.includeFees) {
                            trade.fees = this.transactionCostService.calculateTradingFees({
                                price: currentPrice,
                                quantity: positionSize,
                                action: 'BUY'
                            }).totalFees;
                            currentCapital -= trade.fees;
                        }
                        openPositions.set(signal.symbol, trade);
                        currentCapital -= (currentPrice * positionSize);
                    }
                    else if (signal.action === 'SELL' && openPositions.has(signal.symbol)) {
                        const trade = openPositions.get(signal.symbol);
                        trade.exitDate = new Date(date);
                        trade.exitPrice = currentPrice;
                        const grossPnl = (currentPrice - trade.entryPrice) * trade.quantity;
                        if (config.includeFees) {
                            const exitFees = this.transactionCostService.calculateTradingFees({
                                price: currentPrice,
                                quantity: trade.quantity,
                                action: 'SELL'
                            }).totalFees;
                            trade.fees = (trade.fees || 0) + exitFees;
                            trade.pnl = grossPnl - trade.fees;
                        }
                        else {
                            trade.pnl = grossPnl;
                        }
                        currentCapital += (currentPrice * trade.quantity);
                        currentCapital -= (trade.fees || 0);
                        result.trades.push(trade);
                        result.totalTrades++;
                        if (trade.pnl > 0)
                            result.winningTrades++;
                        else if (trade.pnl < 0)
                            result.losingTrades++;
                        openPositions.delete(signal.symbol);
                    }
                }
                const dailyReturn = (currentCapital - result.initialCapital) / result.initialCapital;
                result.dailyReturns.push({ date: new Date(date), return: dailyReturn });
                if (currentCapital > highWaterMark) {
                    highWaterMark = currentCapital;
                }
                currentDrawdown = (highWaterMark - currentCapital) / highWaterMark;
                result.maxDrawdown = Math.max(result.maxDrawdown, currentDrawdown);
            }
            for (const [symbol, trade] of openPositions) {
                const lastPrice = sortedData.get([...sortedData.keys()].pop())?.find(d => d.symbol === symbol)?.close || 0;
                if (!lastPrice)
                    continue;
                trade.exitDate = config.endDate;
                trade.exitPrice = lastPrice;
                const grossPnl = (lastPrice - trade.entryPrice) * trade.quantity;
                if (config.includeFees) {
                    const exitFees = this.transactionCostService.calculateTradingFees({
                        price: lastPrice,
                        quantity: trade.quantity,
                        action: 'SELL'
                    }).totalFees;
                    trade.fees = (trade.fees || 0) + exitFees;
                    trade.pnl = grossPnl - trade.fees;
                }
                else {
                    trade.pnl = grossPnl;
                }
                currentCapital += (lastPrice * trade.quantity);
                currentCapital -= (trade.fees || 0);
                result.trades.push(trade);
                result.totalTrades++;
                if (trade.pnl > 0)
                    result.winningTrades++;
                else if (trade.pnl < 0)
                    result.losingTrades++;
            }
            result.finalCapital = currentCapital;
            result.totalReturn = (currentCapital - config.initialCapital) / config.initialCapital;
            result.winRate = result.totalTrades > 0 ? result.winningTrades / result.totalTrades : 0;
            logger_1.logger.info('Backtest completed:', {
                strategy: strategy.name,
                totalReturn: (result.totalReturn * 100).toFixed(2) + '%',
                trades: result.totalTrades,
                winRate: (result.winRate * 100).toFixed(2) + '%'
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Backtest failed:', error);
            throw error;
        }
    }
    async getHistoricalDataForSymbols(symbols, startDate, endDate) {
        const allData = [];
        for (const symbol of symbols) {
            const data = await this.marketDataService.getHistoricalData(symbol, startDate, endDate);
            allData.push(...data);
        }
        return allData;
    }
    sortAndGroupHistoricalData(data) {
        const groupedData = new Map();
        for (const point of data) {
            const date = new Date(point.timestamp).toISOString().split('T')[0];
            if (!groupedData.has(date)) {
                groupedData.set(date, []);
            }
            groupedData.get(date).push(point);
        }
        return new Map([...groupedData.entries()].sort());
    }
    calculatePositionSize(availableCapital, currentPrice, suggestedQuantity) {
        const maxQuantity = Math.floor(availableCapital / currentPrice);
        return Math.min(suggestedQuantity, maxQuantity);
    }
    async saveBacktestResult(result) {
        try {
            const savedResult = await database_1.db.backtestResult.create({
                data: {
                    strategyId: result.strategyId,
                    startDate: result.startDate,
                    endDate: result.endDate,
                    initialCapital: result.initialCapital,
                    finalCapital: result.finalCapital,
                    totalReturn: result.totalReturn,
                    totalTrades: result.totalTrades,
                    winningTrades: result.winningTrades,
                    losingTrades: result.losingTrades,
                    winRate: result.winRate,
                    maxDrawdown: result.maxDrawdown,
                    trades: JSON.stringify(result.trades),
                    dailyReturns: JSON.stringify(result.dailyReturns)
                }
            });
            logger_1.logger.info('Backtest result saved:', savedResult.id);
            return savedResult;
        }
        catch (error) {
            logger_1.logger.error('Failed to save backtest result:', error);
            throw error;
        }
    }
    async getBacktestResults(strategyId) {
        try {
            const where = strategyId ? { strategyId } : {};
            const results = await database_1.db.backtestResult.findMany({
                where,
                orderBy: { startDate: 'desc' },
                include: {
                    strategy: true
                }
            });
            return results.map(result => ({
                ...result,
                trades: JSON.parse(result.trades),
                dailyReturns: JSON.parse(result.dailyReturns)
            }));
        }
        catch (error) {
            logger_1.logger.error('Failed to get backtest results:', error);
            throw error;
        }
    }
}
exports.BacktestService = BacktestService;
//# sourceMappingURL=backtest.service.js.map