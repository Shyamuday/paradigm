import { Position as PrismaPosition } from '@prisma/client';
import { Position as KitePosition, Holding as KiteHolding } from 'kiteconnect';

export interface PortfolioMetrics {
    totalValue: number;
    totalPnL: number;
    unrealizedPnL: number;
    realizedPnL: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    returns: {
        daily: number;
        weekly: number;
        monthly: number;
        yearly: number;
    };
}

export interface PortfolioAllocation {
    instrumentId: string;
    targetWeight: number;
    currentWeight: number;
    difference: number;
}

export interface RebalanceAction {
    instrumentId: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    currentPrice: number;
    targetValue: number;
}

export interface PortfolioPosition extends PrismaPosition {
    instrument: {
        id: string;
        symbol: string;
        exchange: string;
    };
    weight: number;
    value: number;
    currentPrice: number;
    unrealizedPnL: number;
    realizedPnL: number;
    dayChange: number;
    dayChangePercent: number;
}

export interface HistoricalReturn {
    date: Date;
    value: number;
    return: number;
    drawdown: number;
}

export interface RiskMetrics {
    volatility: number;
    beta: number;
    alpha: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    valueAtRisk: number;
    expectedShortfall: number;
} 