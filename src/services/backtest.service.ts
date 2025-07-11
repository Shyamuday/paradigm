import { db } from '../database/database';
import { logger } from '../logger/logger';
import { MarketDataService } from './market-data.service';
import { StrategyService } from './strategy.service';
import { OrderService } from './order.service';
import { TransactionCostService } from './transaction-cost.service';
import { Prisma, BacktestResult as PrismaBacktestResult, Strategy } from '@prisma/client';

interface BacktestConfig {
    startDate: Date;
    endDate: Date;
    initialCapital: number;
    symbols: string[];
    strategyId: string;
    includeFees: boolean;
}

interface BacktestResult {
    id?: string;
    strategyId: string;
    startDate: Date;
    endDate: Date;
    initialCapital: number;
    finalCapital: number;
    totalReturn: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    maxDrawdown: number;
    trades: BacktestTrade[];
    dailyReturns: { date: Date; return: number }[];
    createdAt?: Date;
    updatedAt?: Date;
}

interface BacktestTrade {
    symbol: string;
    entryDate: Date;
    exitDate: Date;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    side: 'LONG' | 'SHORT';
    pnl: number;
    fees?: number;
}

type BacktestResultWithStrategy = PrismaBacktestResult & {
    strategy: Strategy;
};

export class BacktestService {
    private marketDataService: MarketDataService;
    private strategyService: StrategyService;
    private orderService: OrderService;
    private transactionCostService: TransactionCostService;

    constructor() {
        this.marketDataService = new MarketDataService();
        this.strategyService = new StrategyService();
        this.orderService = new OrderService();
        this.transactionCostService = new TransactionCostService();
    }

    async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
        try {
            // Get strategy
            const strategy = await this.strategyService.getStrategy(config.strategyId);
            if (!strategy) {
                throw new Error('Strategy not found');
            }

            logger.info('Starting backtest for strategy:', strategy.name);

            // Initialize result structure
            const result: BacktestResult = {
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

            // Get historical data for all symbols
            const historicalData = await this.getHistoricalDataForSymbols(config.symbols, config.startDate, config.endDate);
            if (!historicalData.length) {
                throw new Error('No historical data available for the specified period');
            }

            // Sort data by timestamp
            const sortedData = this.sortAndGroupHistoricalData(historicalData);

            // Initialize portfolio tracking
            let currentCapital = config.initialCapital;
            let highWaterMark = currentCapital;
            let currentDrawdown = 0;
            const openPositions = new Map<string, BacktestTrade>();

            // Process each day's data
            for (const [date, dayData] of sortedData) {
                // Generate signals for this day's data
                const signals = await this.strategyService.executeStrategy(strategy.name, dayData);

                if (!signals.success || !signals.signals.length) {
                    continue;
                }

                // Process each signal
                for (const signal of signals.signals) {
                    const currentPrice = dayData.find(d => d.symbol === signal.symbol)?.close || 0;
                    if (!currentPrice) continue;

                    // Calculate position size based on available capital
                    const positionSize = this.calculatePositionSize(currentCapital, currentPrice, signal.quantity);

                    if (signal.action === 'BUY' && !openPositions.has(signal.symbol)) {
                        // Open long position
                        const trade: BacktestTrade = {
                            symbol: signal.symbol,
                            entryDate: new Date(date),
                            exitDate: new Date(date), // Will be updated on exit
                            entryPrice: currentPrice,
                            exitPrice: currentPrice, // Will be updated on exit
                            quantity: positionSize,
                            side: 'LONG',
                            pnl: 0 // Will be updated on exit
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
                        // Close long position
                        const trade = openPositions.get(signal.symbol)!;
                        trade.exitDate = new Date(date);
                        trade.exitPrice = currentPrice;

                        // Calculate P&L
                        const grossPnl = (currentPrice - trade.entryPrice) * trade.quantity;

                        if (config.includeFees) {
                            const exitFees = this.transactionCostService.calculateTradingFees({
                                price: currentPrice,
                                quantity: trade.quantity,
                                action: 'SELL'
                            }).totalFees;
                            trade.fees = (trade.fees || 0) + exitFees;
                            trade.pnl = grossPnl - trade.fees;
                        } else {
                            trade.pnl = grossPnl;
                        }

                        // Update capital and trade statistics
                        currentCapital += (currentPrice * trade.quantity);
                        currentCapital -= (trade.fees || 0);

                        result.trades.push(trade);
                        result.totalTrades++;
                        if (trade.pnl > 0) result.winningTrades++;
                        else if (trade.pnl < 0) result.losingTrades++;

                        openPositions.delete(signal.symbol);
                    }
                }

                // Calculate daily returns and drawdown
                const dailyReturn = (currentCapital - result.initialCapital) / result.initialCapital;
                result.dailyReturns.push({ date: new Date(date), return: dailyReturn });

                if (currentCapital > highWaterMark) {
                    highWaterMark = currentCapital;
                }

                currentDrawdown = (highWaterMark - currentCapital) / highWaterMark;
                result.maxDrawdown = Math.max(result.maxDrawdown, currentDrawdown);
            }

            // Close any remaining positions at the last price
            for (const [symbol, trade] of openPositions) {
                const lastPrice = sortedData.get([...sortedData.keys()].pop()!)?.find(d => d.symbol === symbol)?.close || 0;
                if (!lastPrice) continue;

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
                } else {
                    trade.pnl = grossPnl;
                }

                currentCapital += (lastPrice * trade.quantity);
                currentCapital -= (trade.fees || 0);

                result.trades.push(trade);
                result.totalTrades++;
                if (trade.pnl > 0) result.winningTrades++;
                else if (trade.pnl < 0) result.losingTrades++;
            }

            // Calculate final statistics
            result.finalCapital = currentCapital;
            result.totalReturn = (currentCapital - config.initialCapital) / config.initialCapital;
            result.winRate = result.totalTrades > 0 ? result.winningTrades / result.totalTrades : 0;

            logger.info('Backtest completed:', {
                strategy: strategy.name,
                totalReturn: (result.totalReturn * 100).toFixed(2) + '%',
                trades: result.totalTrades,
                winRate: (result.winRate * 100).toFixed(2) + '%'
            });

            return result;
        } catch (error) {
            logger.error('Backtest failed:', error);
            throw error;
        }
    }

    private async getHistoricalDataForSymbols(symbols: string[], startDate: Date, endDate: Date) {
        const allData = [];
        for (const symbol of symbols) {
            const data = await this.marketDataService.getHistoricalData(symbol, startDate, endDate);
            allData.push(...data);
        }
        return allData;
    }

    private sortAndGroupHistoricalData(data: any[]) {
        const groupedData = new Map<string, any[]>();

        // Group data by date
        for (const point of data) {
            const date = new Date(point.timestamp).toISOString().split('T')[0];
            if (!groupedData.has(date)) {
                groupedData.set(date, []);
            }
            groupedData.get(date)!.push(point);
        }

        // Sort by date
        return new Map([...groupedData.entries()].sort());
    }

    private calculatePositionSize(availableCapital: number, currentPrice: number, suggestedQuantity: number): number {
        // Calculate maximum quantity based on available capital
        const maxQuantity = Math.floor(availableCapital / currentPrice);

        // Return the minimum of suggested and maximum possible quantity
        return Math.min(suggestedQuantity, maxQuantity);
    }

    async saveBacktestResult(result: BacktestResult) {
        try {
            const savedResult = await db.backtestResult.create({
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

            logger.info('Backtest result saved:', savedResult.id);
            return savedResult;
        } catch (error) {
            logger.error('Failed to save backtest result:', error);
            throw error;
        }
    }

    async getBacktestResults(strategyId?: string) {
        try {
            const where: Prisma.BacktestResultWhereInput = strategyId ? { strategyId } : {};
            const results = await db.backtestResult.findMany({
                where,
                orderBy: { startDate: 'desc' },
                include: {
                    strategy: true
                }
            }) as BacktestResultWithStrategy[];

            // Parse JSON fields and convert to proper types
            return results.map(result => ({
                ...result,
                trades: JSON.parse(result.trades) as BacktestTrade[],
                dailyReturns: JSON.parse(result.dailyReturns) as { date: string; return: number }[]
            }));
        } catch (error) {
            logger.error('Failed to get backtest results:', error);
            throw error;
        }
    }
} 