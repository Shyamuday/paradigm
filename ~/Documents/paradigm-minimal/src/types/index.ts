export interface PaperTrade {
    id: string;
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    entryPrice: number;
    exitPrice?: number;
    timestamp: Date;
    pnl?: number;
    status: 'OPEN' | 'CLOSED';
}

export interface PaperTradingConfig {
    symbols: string[];
    initialCapital: number;
    positionSizePercent: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    maxDailyLoss: number;
}

export interface PaperTradingSession {
    id: string;
    startTime: Date;
    endTime?: Date;
    initialCapital: number;
    currentCapital: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    status: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
}

export interface TimeframeConfig {
    name: string;
    interval: string;
    isActive: boolean;
}

export interface TradingSignal {
    symbol: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    timestamp: Date;
    timeframe: string;
    price: number;
} 