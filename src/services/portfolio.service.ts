import { db } from '../database/database';
import { logger } from '../logger/logger';
import { MarketDataService } from './market-data.service';
import { OrderService } from './order.service';
import { KiteConnect, Position as KitePosition, Holding as KiteHolding } from 'kiteconnect';
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

    constructor(
        private kite: KiteConnect,
        marketDataService: MarketDataService,
        orderService: OrderService
    ) {
        this.marketDataService = marketDataService;
        this.orderService = orderService;
    }

    async getPortfolioMetrics(sessionId: string): Promise<PortfolioMetrics> {
        try {
            // Get positions from both Zerodha and database
            const [zerodhaPositions, dbPositions] = await Promise.all([
                this.getZerodhaPositions(),
                this.getPositions(sessionId)
            ]);

            // Merge positions data
            const positions = await this.mergePositionsData(zerodhaPositions, dbPositions);
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

    private async getZerodhaPositions(): Promise<KitePosition[]> {
        try {
            const positions = await this.kite.getPositions();
            return positions.net;
        } catch (error) {
            logger.error('Failed to get Zerodha positions:', error);
            return [];
        }
    }

    private async getZerodhaHoldings(): Promise<KiteHolding[]> {
        try {
            return await this.kite.getHoldings();
        } catch (error) {
            logger.error('Failed to get Zerodha holdings:', error);
            return [];
        }
    }

    private async mergePositionsData(
        zerodhaPositions: KitePosition[],
        dbPositions: PortfolioPosition[]
    ): Promise<PortfolioPosition[]> {
        const mergedPositions: PortfolioPosition[] = [];

        // Process Zerodha positions
        for (const zPos of zerodhaPositions) {
            const dbPos = dbPositions.find(p =>
                p.instrument.symbol === zPos.tradingsymbol &&
                p.instrument.exchange === zPos.exchange
            );

            if (dbPos) {
                // Update existing position with real-time data
                mergedPositions.push({
                    ...dbPos,
                    currentPrice: zPos.last_price,
                    value: zPos.value,
                    unrealizedPnL: zPos.unrealised ?? 0,
                    realizedPnL: zPos.realised ?? 0,
                    quantity: zPos.quantity,
                    averagePrice: zPos.average_price,
                    dayChange: 0, // Not available in KitePosition
                    dayChangePercent: 0 // Not available in KitePosition
                });
            } else {
                // Create new position entry
                const instrument = await db.instrument.findFirst({
                    where: {
                        symbol: zPos.tradingsymbol,
                        exchange: zPos.exchange
                    }
                });

                if (instrument) {
                    mergedPositions.push({
                        id: `temp_${Date.now()}`,
                        sessionId: '', // Will be set properly
                        instrumentId: instrument.id,
                        tradeId: null,
                        quantity: zPos.quantity,
                        averagePrice: zPos.average_price,
                        currentPrice: zPos.last_price,
                        unrealizedPnL: zPos.unrealised ?? 0,
                        realizedPnL: zPos.realised ?? 0,
                        side: zPos.quantity > 0 ? 'LONG' : 'SHORT',
                        stopLoss: null,
                        target: null,
                        trailingStop: false,
                        openTime: null,
                        closeTime: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        instrument,
                        weight: 0, // Will be calculated later
                        value: zPos.value,
                        dayChange: 0, // Not available in KitePosition
                        dayChangePercent: 0 // Not available in KitePosition
                    });
                }
            }
        }

        // Calculate weights
        const totalValue = mergedPositions.reduce((sum, pos) => sum + pos.value, 0);
        return mergedPositions.map(pos => ({
            ...pos,
            weight: totalValue > 0 ? pos.value / totalValue : 0
        }));
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

            // Get real-time data from Zerodha
            const zerodhaPositions = await this.getZerodhaPositions();
            const zerodhaHoldings = await this.getZerodhaHoldings();

            return Promise.all(positions.map(async (pos) => {
                // Try to find matching Zerodha position or holding
                const zPos = zerodhaPositions.find(p =>
                    p.tradingsymbol === pos.instrument.symbol &&
                    p.exchange === pos.instrument.exchange
                );

                const zHolding = zerodhaHoldings.find(h =>
                    h.tradingsymbol === pos.instrument.symbol &&
                    h.exchange === pos.instrument.exchange
                );

                // Use real-time data if available
                const currentPrice = zPos?.last_price || zHolding?.last_price || pos.currentPrice || pos.averagePrice;
                const value = pos.quantity * currentPrice;

                return {
                    ...pos,
                    currentPrice,
                    value,
                    unrealizedPnL: (zPos?.unrealised ?? zHolding?.pnl ?? pos.unrealizedPnL) ?? 0,
                    realizedPnL: (zPos?.realised ?? pos.realizedPnL) ?? 0,
                    dayChange: 0, // Not available in KitePosition/KiteHolding
                    dayChangePercent: 0, // Not available in KitePosition/KiteHolding
                    weight: 0 // Will be calculated after all positions are processed
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