import { Strategy } from '@prisma/client';
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
    dailyReturns: {
        date: Date;
        return: number;
    }[];
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
export declare class BacktestService {
    private marketDataService;
    private strategyService;
    private orderService;
    private transactionCostService;
    constructor();
    runBacktest(config: BacktestConfig): Promise<BacktestResult>;
    private getHistoricalDataForSymbols;
    private sortAndGroupHistoricalData;
    private calculatePositionSize;
    saveBacktestResult(result: BacktestResult): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        strategyId: string;
        startDate: Date;
        endDate: Date;
        totalReturn: number;
        sharpeRatio: number | null;
        sortinoRatio: number | null;
        calmarRatio: number | null;
        maxDrawdown: number;
        winRate: number;
        profitFactor: number;
        averageWin: number;
        averageLoss: number;
        largestWin: number;
        largestLoss: number;
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        initialCapital: number;
        finalCapital: number;
        annualReturn: number;
        consecutiveWins: number;
        consecutiveLosses: number;
    }>;
    getBacktestResults(strategyId?: string): Promise<{
        trades: BacktestTrade[];
        dailyReturns: {
            date: string;
            return: number;
        }[];
        name: string;
        id: string;
        createdAt: Date;
        strategyId: string;
        startDate: Date;
        endDate: Date;
        totalReturn: number;
        sharpeRatio: number | null;
        sortinoRatio: number | null;
        calmarRatio: number | null;
        maxDrawdown: number;
        winRate: number;
        profitFactor: number;
        averageWin: number;
        averageLoss: number;
        largestWin: number;
        largestLoss: number;
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        initialCapital: number;
        finalCapital: number;
        annualReturn: number;
        consecutiveWins: number;
        consecutiveLosses: number;
        strategy: Strategy;
    }[]>;
}
export {};
//# sourceMappingURL=backtest.service.d.ts.map