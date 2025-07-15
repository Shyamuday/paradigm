interface BacktestConfig {
    startDate: Date;
    endDate: Date;
    initialCapital: number;
    symbols: string[];
    strategyId: string;
    includeFees: boolean;
    timeframe: string;
    riskParameters?: {
        maxPositionSize: number;
        stopLoss?: number;
        takeProfit?: number;
        maxDrawdown: number;
    };
    optionsConfig?: {
        enableOptions: boolean;
        maxExposure: number;
        greeksLimits: {
            maxDelta: number;
            maxGamma: number;
            maxTheta: number;
            maxVega: number;
        };
    };
}
interface BacktestResult {
    id?: string;
    strategyId: string;
    startDate: Date;
    endDate: Date;
    initialCapital: number;
    finalCapital: number;
    totalReturn: number;
    annualizedReturn: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    volatility: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    totalOptionsTrades: number;
    optionsWinRate: number;
    averageOptionsPnL: number;
    greeksExposure: {
        avgDelta: number;
        avgGamma: number;
        avgTheta: number;
        avgVega: number;
    };
    trades: BacktestTrade[];
    dailyReturns: {
        date: Date;
        return: number;
        pnl: number;
    }[];
    monthlyReturns: {
        month: string;
        return: number;
    }[];
    recommendations: TradeRecommendation[];
    riskMetrics: RiskMetrics;
    createdAt?: Date;
    updatedAt?: Date;
}
interface BacktestTrade {
    id?: string;
    symbol: string;
    entryDate: Date;
    exitDate: Date;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    side: 'LONG' | 'SHORT';
    pnl: number;
    fees: number;
    instrumentType: 'EQUITY' | 'OPTION';
    strikePrice?: number;
    optionType?: 'CE' | 'PE';
    expiryDate?: Date;
    entryGreeks?: {
        delta: number;
        gamma: number;
        theta: number;
        vega: number;
        iv: number;
    };
    exitGreeks?: {
        delta: number;
        gamma: number;
        theta: number;
        vega: number;
        iv: number;
    };
    technicalSignals: {
        adx: number;
        rsi: number;
        macd: {
            macd: number;
            signal: number;
            histogram: number;
        };
        bollinger: {
            upper: number;
            middle: number;
            lower: number;
        };
    };
}
interface TradeRecommendation {
    symbol: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    instrumentType: 'EQUITY' | 'OPTION';
    confidence: number;
    strategyType?: string;
    strikePrice?: number;
    optionType?: 'CE' | 'PE';
    expiryDate?: Date;
    reasoning: string;
    technicalAnalysis: {
        trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
        momentum: 'STRONG' | 'WEAK' | 'NEUTRAL';
        volatility: 'HIGH' | 'LOW' | 'NORMAL';
    };
    riskReward: {
        stopLoss: number;
        takeProfit: number;
        riskRewardRatio: number;
    };
    positionSize: number;
    maxRisk: number;
}
interface RiskMetrics {
    var95: number;
    cvar95: number;
    beta: number;
    alpha: number;
    informationRatio: number;
    calmarRatio: number;
    sterlingRatio: number;
    totalGreeksExposure: {
        delta: number;
        gamma: number;
        theta: number;
        vega: number;
    };
    correlationToMarket: number;
    diversificationRatio: number;
}
export declare class EnhancedBacktestService {
    private marketDataService;
    private strategyService;
    private orderService;
    private transactionCostService;
    private optionsTechnicalService;
    private timeframeService;
    constructor();
    runBacktest(config: BacktestConfig): Promise<BacktestResult>;
    private getEnhancedHistoricalData;
    private getOptionsHistoricalData;
    private getTechnicalAnalysisForPeriod;
    private calculateEnhancedPositionSize;
    private createBacktestTrade;
    private closeBacktestTrade;
    private calculateGreeks;
    private extractTechnicalSignals;
    private sortAndGroupHistoricalData;
    private updateTradeStatistics;
    private calculateAdvancedMetrics;
    private calculateMonthlyReturns;
    private closeRemainingPositions;
    private generateTradeRecommendations;
    private createTradeRecommendation;
    private determineTrend;
    private determineMomentum;
    private determineVolatility;
    private generateRecommendationReasoning;
    private calculateRiskMetrics;
    private calculateVaR;
    private calculateCVaR;
    private calculateBeta;
    private calculateMarketCorrelation;
    private calculateDiversificationRatio;
    private initializeRiskMetrics;
    saveBacktestResult(result: BacktestResult): Promise<any>;
    getBacktestResults(strategyId?: string): Promise<BacktestResult[]>;
    getTradeRecommendations(symbols: string[], timeframe?: string): Promise<TradeRecommendation[]>;
}
export {};
//# sourceMappingURL=enhanced-backtest.service.d.ts.map