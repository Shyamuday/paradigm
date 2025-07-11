import { db } from '../database/database';
import { logger } from '../logger/logger';
import { MarketDataService } from './market-data.service';
import { OrderService } from './order.service';
import {
    PortfolioMetrics,
    PortfolioAllocation,
    RebalanceAction,
    PortfolioPosition,
    HistoricalReturn,
    RiskMetrics
} from '../types/portfolio.types';

export class PortfolioService {
    private marketDataService: MarketDataService;
    private orderService: OrderService;

    constructor() {
        this.marketDataService = new MarketDataService();
        this.orderService = new OrderService();
    }

    async getPortfolioMetrics(sessionId: string): Promise<PortfolioMetrics> {
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
        } catch (error) {
            logger.error('Failed to get portfolio metrics:', error);
            throw error;
        }
    }

    async getPositions(sessionId: string): Promise<PortfolioPosition[]> {
        try {
            const positions = await db.position.findMany({
                where: {
                    sessionId,
                    closeTime: null // Only open positions
                },
                include: {
                    instrument: true
                }
            });

            const totalValue = positions.reduce((sum, pos) =>
                sum + (pos.quantity * (pos.currentPrice || pos.averagePrice)), 0);

            return Promise.all(positions.map(async (pos) => {
                const currentPrice = pos.currentPrice || pos.averagePrice;
                const value = pos.quantity * currentPrice;
                const weight = value / totalValue;

                // Get day's change
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
        } catch (error) {
            logger.error('Failed to get positions:', error);
            throw error;
        }
    }

    async rebalancePortfolio(sessionId: string, targetAllocations: PortfolioAllocation[]): Promise<RebalanceAction[]> {
        try {
            const positions = await this.getPositions(sessionId);
            const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0);
            const rebalanceActions: RebalanceAction[] = [];

            for (const target of targetAllocations) {
                const position = positions.find(p => p.instrumentId === target.instrumentId);
                const currentPrice = position?.currentPrice || await this.marketDataService.getCurrentPrice(target.instrumentId);

                if (!currentPrice) {
                    throw new Error(`Could not get current price for instrument ${target.instrumentId}`);
                }

                const targetValue = totalValue * target.targetWeight;
                const currentValue = position?.value || 0;
                const valueDifference = targetValue - currentValue;

                if (Math.abs(valueDifference) > totalValue * 0.01) { // 1% threshold
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
        } catch (error) {
            logger.error('Failed to calculate rebalance actions:', error);
            throw error;
        }
    }

    private async getHistoricalReturns(sessionId: string): Promise<HistoricalReturn[]> {
        try {
            const trades = await db.trade.findMany({
                where: { sessionId },
                orderBy: { executionTime: 'asc' },
                include: { positions: true }
            });

            const returns: HistoricalReturn[] = [];
            let portfolioValue = 0;
            let maxValue = 0;

            for (const trade of trades) {
                if (!trade.executionTime) continue;

                // Get execution price from trade record
                const price = trade.price; // Use the trade price as execution price
                if (!price) continue;

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
        } catch (error) {
            logger.error('Failed to get historical returns:', error);
            throw error;
        }
    }

    private async calculateRiskMetrics(returns: HistoricalReturn[]): Promise<RiskMetrics> {
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
        const riskFreeRate = 0.05; // 5% annual risk-free rate

        // Calculate volatility (standard deviation of returns)
        const mean = returnValues.reduce((sum, val) => sum + val, 0) / returnValues.length;
        const variance = returnValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / returnValues.length;
        const volatility = Math.sqrt(variance);

        // Calculate Sharpe Ratio
        const excessReturns = returnValues.map(r => r - (riskFreeRate / 252)); // Daily risk-free rate
        const sharpeRatio = (mean - (riskFreeRate / 252)) / volatility * Math.sqrt(252); // Annualized

        // Calculate Sortino Ratio (using negative returns only)
        const negativeReturns = returnValues.filter(r => r < 0);
        const downsideDeviation = negativeReturns.length > 0
            ? Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length)
            : 0;
        const sortinoRatio = downsideDeviation === 0 ? 0 : (mean - (riskFreeRate / 252)) / downsideDeviation * Math.sqrt(252);

        // Calculate Maximum Drawdown
        const maxDrawdown = Math.max(...returns.map(r => r.drawdown));

        // Calculate Value at Risk (95% confidence)
        const sortedReturns = [...returnValues].sort((a, b) => a - b);
        const varIndex = Math.floor(0.05 * sortedReturns.length);
        const valueAtRisk = varIndex > 0 && sortedReturns[varIndex] !== undefined
            ? -sortedReturns[varIndex]
            : 0;

        // Calculate Expected Shortfall (Average of returns below VaR)
        const expectedShortfall = varIndex > 0 && sortedReturns.slice(0, varIndex).length > 0
            ? -sortedReturns.slice(0, varIndex).reduce((sum, val) => sum + val, 0) / varIndex
            : 0;

        return {
            volatility,
            beta: 1.0, // Assuming market beta for now
            alpha: mean - riskFreeRate, // Simple alpha calculation
            sharpeRatio,
            sortinoRatio,
            maxDrawdown,
            valueAtRisk,
            expectedShortfall
        };
    }

    private async calculateReturns(historicalReturns: HistoricalReturn[]): Promise<{
        daily: number;
        weekly: number;
        monthly: number;
        yearly: number;
    }> {
        if (historicalReturns.length === 0) {
            return { daily: 0, weekly: 0, monthly: 0, yearly: 0 };
        }

        const latest = historicalReturns[historicalReturns.length - 1];
        if (!latest) {
            return { daily: 0, weekly: 0, monthly: 0, yearly: 0 };
        }

        const oneDay = historicalReturns.find(r =>
            r.date >= new Date(Date.now() - 24 * 60 * 60 * 1000));
        const oneWeek = historicalReturns.find(r =>
            r.date >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
        const oneMonth = historicalReturns.find(r =>
            r.date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
        const oneYear = historicalReturns.find(r =>
            r.date >= new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));

        return {
            daily: oneDay ? ((latest.value / oneDay.value) - 1) * 100 : 0,
            weekly: oneWeek ? ((latest.value / oneWeek.value) - 1) * 100 : 0,
            monthly: oneMonth ? ((latest.value / oneMonth.value) - 1) * 100 : 0,
            yearly: oneYear ? ((latest.value / oneYear.value) - 1) * 100 : 0
        };
    }
} 