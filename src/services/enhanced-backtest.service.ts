import { db } from '../database/database';
import { logger } from '../logger/logger';
import { MarketDataService } from './market-data.service';
import { EnhancedStrategyService } from './enhanced-strategy.service';
import { OrderService } from './order.service';
import { TransactionCostService } from './transaction-cost.service';
import { OptionsTechnicalAnalysisService } from './options-technical-analysis';
import { TimeframeManagerService } from './timeframe-manager.service';
import { Prisma, BacktestResult as PrismaBacktestResult, Strategy, Instrument } from '@prisma/client';

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

    // Trade statistics
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;

    // Options-specific metrics
    totalOptionsTrades: number;
    optionsWinRate: number;
    averageOptionsPnL: number;
    greeksExposure: {
        avgDelta: number;
        avgGamma: number;
        avgTheta: number;
        avgVega: number;
    };

    // Performance metrics
    trades: BacktestTrade[];
    dailyReturns: { date: Date; return: number; pnl: number }[];
    monthlyReturns: { month: string; return: number }[];

    // Analysis results
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

    // Options-specific fields
    instrumentType: 'EQUITY' | 'OPTION';
    strikePrice?: number;
    optionType?: 'CE' | 'PE';
    expiryDate?: Date;

    // Greeks at entry and exit
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

    // Technical indicators at trade
    technicalSignals: {
        adx: number;
        rsi: number;
        macd: { macd: number; signal: number; histogram: number };
        bollinger: { upper: number; middle: number; lower: number };
    };
}

interface TradeRecommendation {
    symbol: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    instrumentType: 'EQUITY' | 'OPTION';
    confidence: number; // 0-100

    // For options
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
    var95: number; // Value at Risk (95%)
    cvar95: number; // Conditional Value at Risk
    beta: number;
    alpha: number;
    informationRatio: number;
    calmarRatio: number;
    sterlingRatio: number;

    // Options-specific risk
    totalGreeksExposure: {
        delta: number;
        gamma: number;
        theta: number;
        vega: number;
    };

    // Correlation analysis
    correlationToMarket: number;
    diversificationRatio: number;
}

export class EnhancedBacktestService {
    private marketDataService: MarketDataService;
    private strategyService: EnhancedStrategyService;
    private orderService: OrderService;
    private transactionCostService: TransactionCostService;
    private optionsTechnicalService: OptionsTechnicalAnalysisService;
    private timeframeService: TimeframeManagerService;

    constructor() {
        this.marketDataService = new MarketDataService();
        this.strategyService = new EnhancedStrategyService();
        this.orderService = new OrderService();
        this.transactionCostService = new TransactionCostService();
        this.optionsTechnicalService = new OptionsTechnicalAnalysisService();
        this.timeframeService = new TimeframeManagerService();
    }

    async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
        try {
            logger.info('Starting enhanced backtest with options support', { config });

            // Get strategy
            const strategy = await this.strategyService.getStrategy(config.strategyId);
            if (!strategy) {
                throw new Error('Strategy not found');
            }

            // Initialize result structure
            const result: BacktestResult = {
                strategyId: config.strategyId,
                startDate: config.startDate,
                endDate: config.endDate,
                initialCapital: config.initialCapital,
                finalCapital: config.initialCapital,
                totalReturn: 0,
                annualizedReturn: 0,
                sharpeRatio: 0,
                sortinoRatio: 0,
                maxDrawdown: 0,
                volatility: 0,
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                winRate: 0,
                avgWin: 0,
                avgLoss: 0,
                profitFactor: 0,
                totalOptionsTrades: 0,
                optionsWinRate: 0,
                averageOptionsPnL: 0,
                greeksExposure: { avgDelta: 0, avgGamma: 0, avgTheta: 0, avgVega: 0 },
                trades: [],
                dailyReturns: [],
                monthlyReturns: [],
                recommendations: [],
                riskMetrics: this.initializeRiskMetrics()
            };

            // Get historical data for all symbols with timeframe support
            const historicalData = await this.getEnhancedHistoricalData(
                config.symbols,
                config.startDate,
                config.endDate,
                config.timeframe
            );

            if (!historicalData.length) {
                throw new Error('No historical data available for the specified period');
            }

            // Sort and group data by timestamp
            const sortedData = this.sortAndGroupHistoricalData(historicalData);

            // Initialize portfolio tracking
            let currentCapital = config.initialCapital;
            let highWaterMark = currentCapital;
            const openPositions = new Map<string, BacktestTrade>();
            const dailyReturns: number[] = [];
            const greeksTracking: Array<{ delta: number; gamma: number; theta: number; vega: number }> = [];

            // Process each time period's data
            for (const [timestamp, periodData] of sortedData) {
                const currentDate = new Date(timestamp);

                // Get technical analysis for this period
                const technicalAnalysis = await this.getTechnicalAnalysisForPeriod(
                    periodData,
                    config.timeframe
                );

                // Generate signals using enhanced strategy
                const signals = await this.strategyService.generateSignals(
                    strategy.name,
                    periodData,
                    technicalAnalysis
                );

                if (!signals.success || !signals.signals.length) {
                    continue;
                }

                // Process each signal
                for (const signal of signals.signals) {
                    const instrument = periodData.find(d => d.symbol === signal.symbol);
                    if (!instrument) continue;

                    const currentPrice = instrument.close;

                    // Calculate position size with risk management
                    const positionSize = this.calculateEnhancedPositionSize(
                        currentCapital,
                        currentPrice,
                        signal.quantity,
                        config.riskParameters
                    );

                    if (signal.action === 'BUY' && !openPositions.has(signal.symbol)) {
                        // Open position
                        const trade = await this.createBacktestTrade(
                            signal,
                            instrument,
                            currentDate,
                            currentPrice,
                            positionSize,
                            technicalAnalysis[signal.symbol],
                            config
                        );

                        if (trade) {
                            openPositions.set(signal.symbol, trade);
                            currentCapital -= (currentPrice * positionSize) + trade.fees;
                        }
                    }
                    else if (signal.action === 'SELL' && openPositions.has(signal.symbol)) {
                        // Close position
                        const trade = openPositions.get(signal.symbol)!;
                        await this.closeBacktestTrade(
                            trade,
                            currentDate,
                            currentPrice,
                            technicalAnalysis[signal.symbol],
                            config
                        );

                        // Update capital and statistics
                        currentCapital += (currentPrice * trade.quantity) - trade.fees;
                        result.trades.push(trade);
                        this.updateTradeStatistics(result, trade);

                        // Track Greeks for options
                        if (trade.instrumentType === 'OPTION' && trade.exitGreeks) {
                            greeksTracking.push(trade.exitGreeks);
                        }

                        openPositions.delete(signal.symbol);
                    }
                }

                // Calculate daily returns and risk metrics
                const dailyReturn = (currentCapital - config.initialCapital) / config.initialCapital;
                const dailyPnL = currentCapital - config.initialCapital;

                result.dailyReturns.push({
                    date: currentDate,
                    return: dailyReturn,
                    pnl: dailyPnL
                });

                dailyReturns.push(dailyReturn);

                // Update drawdown
                if (currentCapital > highWaterMark) {
                    highWaterMark = currentCapital;
                }

                const currentDrawdown = (highWaterMark - currentCapital) / highWaterMark;
                result.maxDrawdown = Math.max(result.maxDrawdown, currentDrawdown);
            }

            // Close remaining positions
            await this.closeRemainingPositions(
                openPositions,
                config.endDate,
                sortedData,
                result,
                config
            );

            // Calculate final statistics
            result.finalCapital = currentCapital;
            result.totalReturn = (currentCapital - config.initialCapital) / config.initialCapital;

            // Calculate advanced metrics
            this.calculateAdvancedMetrics(result, dailyReturns, greeksTracking);

            // Generate trade recommendations
            result.recommendations = await this.generateTradeRecommendations(
                result,
                config.symbols,
                config.timeframe
            );

            // Calculate risk metrics
            result.riskMetrics = await this.calculateRiskMetrics(result, config);

            logger.info('Enhanced backtest completed', {
                strategy: strategy.name,
                totalReturn: (result.totalReturn * 100).toFixed(2) + '%',
                trades: result.totalTrades,
                optionsTrades: result.totalOptionsTrades,
                winRate: (result.winRate * 100).toFixed(2) + '%',
                sharpeRatio: result.sharpeRatio.toFixed(2)
            });

            return result;
        } catch (error) {
            logger.error('Enhanced backtest failed:', error);
            throw error;
        }
    }

    private async getEnhancedHistoricalData(
        symbols: string[],
        startDate: Date,
        endDate: Date,
        timeframe: string
    ) {
        const allData = [];

        for (const symbol of symbols) {
            // Get both equity and options data
            const equityData = await this.timeframeService.getHistoricalData(
                symbol,
                timeframe,
                startDate,
                endDate
            );

            // Get options chain data if options are enabled
            const optionsData = await this.getOptionsHistoricalData(
                symbol,
                startDate,
                endDate
            );

            allData.push(...equityData, ...optionsData);
        }

        return allData;
    }

    private async getOptionsHistoricalData(symbol: string, startDate: Date, endDate: Date) {
        try {
            const optionsChain = await db.optionsChain.findMany({
                where: {
                    underlyingSymbol: symbol,
                    timestamp: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                include: {
                    contracts: {
                        include: {
                            instrument: true
                        }
                    }
                }
            });

            return optionsChain.flatMap(chain =>
                chain.contracts.map(contract => ({
                    symbol: contract.instrument.symbol,
                    timestamp: chain.timestamp,
                    open: contract.open,
                    high: contract.high,
                    low: contract.low,
                    close: contract.close,
                    volume: contract.volume,
                    instrumentType: 'OPTION',
                    strikePrice: contract.strikePrice,
                    optionType: contract.optionType,
                    expiryDate: contract.expiryDate,
                    impliedVolatility: contract.impliedVolatility
                }))
            );
        } catch (error) {
            logger.warn('Failed to get options historical data:', error);
            return [];
        }
    }

    private async getTechnicalAnalysisForPeriod(periodData: any[], timeframe: string) {
        const analysis: Record<string, any> = {};

        for (const instrument of periodData) {
            try {
                if (instrument.instrumentType === 'OPTION') {
                    // Options technical analysis
                    const optionsAnalysis = await this.optionsTechnicalService.analyzeOptionsData(
                        instrument.symbol,
                        timeframe,
                        'ALL'
                    );
                    analysis[instrument.symbol] = optionsAnalysis;
                } else {
                    // Equity technical analysis
                    const technicalData = await this.optionsTechnicalService.calculateTechnicalIndicators(
                        [instrument],
                        timeframe
                    );
                    analysis[instrument.symbol] = technicalData;
                }
            } catch (error) {
                logger.warn(`Failed to get technical analysis for ${instrument.symbol}:`, error);
                analysis[instrument.symbol] = null;
            }
        }

        return analysis;
    }

    private calculateEnhancedPositionSize(
        availableCapital: number,
        currentPrice: number,
        suggestedQuantity: number,
        riskParams?: BacktestConfig['riskParameters']
    ): number {
        if (!riskParams) {
            return Math.min(
                suggestedQuantity,
                Math.floor(availableCapital / currentPrice)
            );
        }

        // Risk-based position sizing
        const maxPositionValue = availableCapital * riskParams.maxPositionSize;
        const maxQuantityByRisk = Math.floor(maxPositionValue / currentPrice);
        const maxQuantityByCapital = Math.floor(availableCapital / currentPrice);

        return Math.min(suggestedQuantity, maxQuantityByRisk, maxQuantityByCapital);
    }

    private async createBacktestTrade(
        signal: any,
        instrument: any,
        date: Date,
        price: number,
        quantity: number,
        technicalAnalysis: any,
        config: BacktestConfig
    ): Promise<BacktestTrade | null> {
        const fees = config.includeFees ?
            this.transactionCostService.calculateTradingFees({
                price,
                quantity,
                action: 'BUY'
            }).totalFees : 0;

        const trade: BacktestTrade = {
            symbol: signal.symbol,
            entryDate: date,
            exitDate: date, // Will be updated on exit
            entryPrice: price,
            exitPrice: price, // Will be updated on exit
            quantity,
            side: 'LONG',
            pnl: 0,
            fees,
            instrumentType: instrument.instrumentType || 'EQUITY',
            strikePrice: instrument.strikePrice,
            optionType: instrument.optionType,
            expiryDate: instrument.expiryDate,
            technicalSignals: this.extractTechnicalSignals(technicalAnalysis)
        };

        // Add Greeks for options
        if (trade.instrumentType === 'OPTION') {
            trade.entryGreeks = await this.calculateGreeks(instrument, price, date);
        }

        return trade;
    }

    private async closeBacktestTrade(
        trade: BacktestTrade,
        date: Date,
        price: number,
        technicalAnalysis: any,
        config: BacktestConfig
    ) {
        const exitFees = config.includeFees ?
            this.transactionCostService.calculateTradingFees({
                price,
                quantity: trade.quantity,
                action: 'SELL'
            }).totalFees : 0;

        trade.exitDate = date;
        trade.exitPrice = price;
        trade.fees += exitFees;

        // Calculate P&L
        const grossPnl = (price - trade.entryPrice) * trade.quantity;
        trade.pnl = grossPnl - trade.fees;

        // Add exit Greeks for options
        if (trade.instrumentType === 'OPTION') {
            trade.exitGreeks = await this.calculateGreeks(
                {
                    symbol: trade.symbol,
                    strikePrice: trade.strikePrice,
                    optionType: trade.optionType,
                    expiryDate: trade.expiryDate
                },
                price,
                date
            );
        }
    }

    private async calculateGreeks(instrument: any, price: number, date: Date) {
        try {
            // Simplified Greeks calculation - in real implementation, 
            // you would use Black-Scholes or similar model
            const timeToExpiry = instrument.expiryDate ?
                (new Date(instrument.expiryDate).getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365) : 0;

            return {
                delta: Math.random() * 0.8 + 0.1, // Simplified
                gamma: Math.random() * 0.1,
                theta: -Math.random() * 0.05,
                vega: Math.random() * 0.3,
                iv: Math.random() * 0.5 + 0.1
            };
        } catch (error) {
            logger.warn('Failed to calculate Greeks:', error);
            return {
                delta: 0,
                gamma: 0,
                theta: 0,
                vega: 0,
                iv: 0
            };
        }
    }

    private extractTechnicalSignals(analysis: any) {
        if (!analysis) {
            return {
                adx: 0,
                rsi: 50,
                macd: { macd: 0, signal: 0, histogram: 0 },
                bollinger: { upper: 0, middle: 0, lower: 0 }
            };
        }

        return {
            adx: analysis.adx?.adx || 0,
            rsi: analysis.rsi?.rsi || 50,
            macd: analysis.macd || { macd: 0, signal: 0, histogram: 0 },
            bollinger: analysis.bollinger || { upper: 0, middle: 0, lower: 0 }
        };
    }

    private sortAndGroupHistoricalData(data: any[]) {
        const groupedData = new Map<string, any[]>();

        for (const point of data) {
            const timestamp = new Date(point.timestamp).toISOString();
            if (!groupedData.has(timestamp)) {
                groupedData.set(timestamp, []);
            }
            groupedData.get(timestamp)!.push(point);
        }

        return new Map([...groupedData.entries()].sort());
    }

    private updateTradeStatistics(result: BacktestResult, trade: BacktestTrade) {
        result.totalTrades++;

        if (trade.instrumentType === 'OPTION') {
            result.totalOptionsTrades++;
        }

        if (trade.pnl > 0) {
            result.winningTrades++;
        } else if (trade.pnl < 0) {
            result.losingTrades++;
        }

        result.winRate = result.totalTrades > 0 ? result.winningTrades / result.totalTrades : 0;

        if (result.totalOptionsTrades > 0) {
            const optionsTrades = result.trades.filter(t => t.instrumentType === 'OPTION');
            const optionsWins = optionsTrades.filter(t => t.pnl > 0).length;
            result.optionsWinRate = optionsWins / result.totalOptionsTrades;
            result.averageOptionsPnL = optionsTrades.reduce((sum, t) => sum + t.pnl, 0) / result.totalOptionsTrades;
        }
    }

    private calculateAdvancedMetrics(
        result: BacktestResult,
        dailyReturns: number[],
        greeksTracking: Array<{ delta: number; gamma: number; theta: number; vega: number }>
    ) {
        if (dailyReturns.length === 0) return;

        // Calculate annualized return
        const totalDays = dailyReturns.length;
        const annualizedReturn = Math.pow(1 + result.totalReturn, 365 / totalDays) - 1;
        result.annualizedReturn = annualizedReturn;

        // Calculate volatility
        const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
        const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
        result.volatility = Math.sqrt(variance * 365);

        // Calculate Sharpe ratio (assuming 4% risk-free rate)
        const riskFreeRate = 0.04;
        result.sharpeRatio = result.volatility > 0 ?
            (result.annualizedReturn - riskFreeRate) / result.volatility : 0;

        // Calculate Sortino ratio
        const negativeReturns = dailyReturns.filter(r => r < 0);
        if (negativeReturns.length > 0) {
            const downside = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length;
            const downsideDeviation = Math.sqrt(downside * 365);
            result.sortinoRatio = downsideDeviation > 0 ?
                (result.annualizedReturn - riskFreeRate) / downsideDeviation : 0;
        }

        // Calculate win/loss metrics
        const winningTrades = result.trades.filter(t => t.pnl > 0);
        const losingTrades = result.trades.filter(t => t.pnl < 0);

        if (winningTrades.length > 0) {
            result.avgWin = winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length;
        }

        if (losingTrades.length > 0) {
            result.avgLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length);
        }

        // Calculate profit factor
        const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
        result.profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

        // Calculate average Greeks exposure
        if (greeksTracking.length > 0) {
            result.greeksExposure = {
                avgDelta: greeksTracking.reduce((sum, g) => sum + g.delta, 0) / greeksTracking.length,
                avgGamma: greeksTracking.reduce((sum, g) => sum + g.gamma, 0) / greeksTracking.length,
                avgTheta: greeksTracking.reduce((sum, g) => sum + g.theta, 0) / greeksTracking.length,
                avgVega: greeksTracking.reduce((sum, g) => sum + g.vega, 0) / greeksTracking.length
            };
        }

        // Calculate monthly returns
        const monthlyReturns = this.calculateMonthlyReturns(result.dailyReturns);
        result.monthlyReturns = monthlyReturns;
    }

    private calculateMonthlyReturns(dailyReturns: { date: Date; return: number; pnl: number }[]) {
        const monthlyData = new Map<string, number[]>();

        for (const daily of dailyReturns) {
            const monthKey = `${daily.date.getFullYear()}-${String(daily.date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyData.has(monthKey)) {
                monthlyData.set(monthKey, []);
            }
            monthlyData.get(monthKey)!.push(daily.return);
        }

        return Array.from(monthlyData.entries()).map(([month, returns]) => ({
            month,
            return: returns[returns.length - 1] || 0 // Take last return of the month
        }));
    }

    private async closeRemainingPositions(
        openPositions: Map<string, BacktestTrade>,
        endDate: Date,
        sortedData: Map<string, any[]>,
        result: BacktestResult,
        config: BacktestConfig
    ) {
        const lastDataPoint = [...sortedData.values()].pop();
        if (!lastDataPoint) return;

        for (const [symbol, trade] of openPositions) {
            const lastPrice = lastDataPoint.find(d => d.symbol === symbol)?.close || trade.entryPrice;

            await this.closeBacktestTrade(trade, endDate, lastPrice, null, config);
            result.trades.push(trade);
            this.updateTradeStatistics(result, trade);
        }
    }

    private async generateTradeRecommendations(
        result: BacktestResult,
        symbols: string[],
        timeframe: string
    ): Promise<TradeRecommendation[]> {
        const recommendations: TradeRecommendation[] = [];

        try {
            for (const symbol of symbols) {
                // Get current technical analysis
                const analysis = await this.optionsTechnicalService.analyzeOptionsData(
                    symbol,
                    timeframe,
                    'ALL'
                );

                if (!analysis.success) continue;

                // Generate recommendations based on technical analysis
                const recommendation = await this.createTradeRecommendation(
                    symbol,
                    analysis,
                    result
                );

                if (recommendation) {
                    recommendations.push(recommendation);
                }
            }
        } catch (error) {
            logger.error('Failed to generate trade recommendations:', error);
        }

        return recommendations;
    }

    private async createTradeRecommendation(
        symbol: string,
        analysis: any,
        backtestResult: BacktestResult
    ): Promise<TradeRecommendation | null> {
        try {
            const { adx, rsi, macd, bollinger } = analysis.indicators;

            // Determine trend and momentum
            const trend = this.determineTrend(adx, macd);
            const momentum = this.determineMomentum(rsi, macd);
            const volatility = this.determineVolatility(bollinger);

            // Calculate confidence based on signal alignment
            let confidence = 50;
            if (trend === 'BULLISH' && momentum === 'STRONG') confidence += 30;
            if (trend === 'BEARISH' && momentum === 'STRONG') confidence += 30;
            if (adx.adx > 25) confidence += 10; // Strong trend
            if (Math.abs(rsi.rsi - 50) > 20) confidence += 10; // Clear momentum

            // Determine action
            let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
            if (trend === 'BULLISH' && momentum === 'STRONG' && confidence > 70) {
                action = 'BUY';
            } else if (trend === 'BEARISH' && momentum === 'STRONG' && confidence > 70) {
                action = 'SELL';
            }

            // Calculate position size based on historical performance
            const symbolTrades = backtestResult.trades.filter(t => t.symbol === symbol);
            const winRate = symbolTrades.length > 0 ?
                symbolTrades.filter(t => t.pnl > 0).length / symbolTrades.length : 0.5;

            const positionSize = Math.min(0.1, 0.05 + (winRate * 0.05)); // 5-10% based on performance

            // Get current market price (simplified)
            const currentPrice = 100; // This should be fetched from live data

            const recommendation: TradeRecommendation = {
                symbol,
                action,
                instrumentType: 'EQUITY',
                confidence: Math.min(confidence, 95),
                reasoning: this.generateRecommendationReasoning(analysis, trend, momentum),
                technicalAnalysis: { trend, momentum, volatility },
                riskReward: {
                    stopLoss: currentPrice * (action === 'BUY' ? 0.95 : 1.05),
                    takeProfit: currentPrice * (action === 'BUY' ? 1.10 : 0.90),
                    riskRewardRatio: 2.0
                },
                positionSize,
                maxRisk: 0.02 // 2% of portfolio
            };

            return recommendation;
        } catch (error) {
            logger.error(`Failed to create recommendation for ${symbol}:`, error);
            return null;
        }
    }

    private determineTrend(adx: any, macd: any): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
        if (adx.adx > 25) {
            if (macd.macd > macd.signal) return 'BULLISH';
            if (macd.macd < macd.signal) return 'BEARISH';
        }
        return 'NEUTRAL';
    }

    private determineMomentum(rsi: any, macd: any): 'STRONG' | 'WEAK' | 'NEUTRAL' {
        const rsiValue = rsi.rsi;
        const macdHistogram = macd.histogram;

        if ((rsiValue > 60 && macdHistogram > 0) || (rsiValue < 40 && macdHistogram < 0)) {
            return 'STRONG';
        }
        if ((rsiValue > 45 && rsiValue < 55) && Math.abs(macdHistogram) < 0.1) {
            return 'WEAK';
        }
        return 'NEUTRAL';
    }

    private determineVolatility(bollinger: any): 'HIGH' | 'LOW' | 'NORMAL' {
        const bandwidth = (bollinger.upper - bollinger.lower) / bollinger.middle;
        if (bandwidth > 0.1) return 'HIGH';
        if (bandwidth < 0.05) return 'LOW';
        return 'NORMAL';
    }

    private generateRecommendationReasoning(analysis: any, trend: string, momentum: string): string {
        const { adx, rsi, macd } = analysis.indicators;

        let reasoning = `Technical analysis shows ${trend.toLowerCase()} trend with ${momentum.toLowerCase()} momentum. `;

        if (adx.adx > 25) {
            reasoning += `Strong trend confirmed by ADX (${adx.adx.toFixed(1)}). `;
        }

        if (rsi.rsi > 70) {
            reasoning += `RSI indicates overbought conditions (${rsi.rsi.toFixed(1)}). `;
        } else if (rsi.rsi < 30) {
            reasoning += `RSI indicates oversold conditions (${rsi.rsi.toFixed(1)}). `;
        }

        if (macd.macd > macd.signal) {
            reasoning += `MACD shows bullish crossover. `;
        } else if (macd.macd < macd.signal) {
            reasoning += `MACD shows bearish crossover. `;
        }

        return reasoning.trim();
    }

    private async calculateRiskMetrics(result: BacktestResult, config: BacktestConfig): Promise<RiskMetrics> {
        const returns = result.dailyReturns.map(r => r.return);

        return {
            var95: this.calculateVaR(returns, 0.95),
            cvar95: this.calculateCVaR(returns, 0.95),
            beta: await this.calculateBeta(returns),
            alpha: result.annualizedReturn - (0.04 + 1.0 * (0.08 - 0.04)), // Simplified alpha
            informationRatio: result.sharpeRatio,
            calmarRatio: result.maxDrawdown > 0 ? result.annualizedReturn / result.maxDrawdown : 0,
            sterlingRatio: result.maxDrawdown > 0 ? result.annualizedReturn / Math.abs(result.maxDrawdown) : 0,
            totalGreeksExposure: result.greeksExposure,
            correlationToMarket: await this.calculateMarketCorrelation(returns),
            diversificationRatio: this.calculateDiversificationRatio(result.trades)
        };
    }

    private calculateVaR(returns: number[], confidence: number): number {
        const sortedReturns = [...returns].sort((a, b) => a - b);
        const index = Math.floor((1 - confidence) * sortedReturns.length);
        return sortedReturns[index] || 0;
    }

    private calculateCVaR(returns: number[], confidence: number): number {
        const var95 = this.calculateVaR(returns, confidence);
        const tailReturns = returns.filter(r => r <= var95);
        return tailReturns.length > 0 ?
            tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length : 0;
    }

    private async calculateBeta(returns: number[]): Promise<number> {
        // Simplified beta calculation - in real implementation, 
        // you would correlate with market returns
        return 1.0;
    }

    private async calculateMarketCorrelation(returns: number[]): Promise<number> {
        // Simplified correlation - in real implementation, 
        // you would correlate with market index
        return 0.7;
    }

    private calculateDiversificationRatio(trades: BacktestTrade[]): number {
        const symbols = new Set(trades.map(t => t.symbol));
        const totalTrades = trades.length;
        return totalTrades > 0 ? symbols.size / totalTrades : 0;
    }

    private initializeRiskMetrics(): RiskMetrics {
        return {
            var95: 0,
            cvar95: 0,
            beta: 1,
            alpha: 0,
            informationRatio: 0,
            calmarRatio: 0,
            sterlingRatio: 0,
            totalGreeksExposure: { delta: 0, gamma: 0, theta: 0, vega: 0 },
            correlationToMarket: 0,
            diversificationRatio: 0
        };
    }

    async saveBacktestResult(result: BacktestResult): Promise<any> {
        try {
            const savedResult = await db.backtestResult.create({
                data: {
                    strategyId: result.strategyId,
                    startDate: result.startDate,
                    endDate: result.endDate,
                    initialCapital: result.initialCapital,
                    instruments: JSON.stringify(Array.from(new Set(result.trades.map(t => t.symbol)))),
                    finalCapital: result.finalCapital,
                    totalReturn: result.totalReturn,
                    annualizedReturn: result.annualizedReturn,
                    maxDrawdown: result.maxDrawdown,
                    sharpeRatio: result.sharpeRatio,
                    sortinoRatio: result.sortinoRatio,
                    totalOptionsTrades: result.totalOptionsTrades,
                    optionsWinRate: result.optionsWinRate,
                    averageOptionsPnL: result.averageOptionsPnL
                }
            });

            // Save trades
            for (const trade of result.trades) {
                const instrument = await db.instrument.findFirst({
                    where: { symbol: trade.symbol }
                });

                if (instrument) {
                    await db.backtestTrade.create({
                        data: {
                            backtestId: savedResult.id,
                            instrumentId: instrument.id,
                            action: trade.side === 'LONG' ? 'BUY' : 'SELL',
                            quantity: trade.quantity,
                            price: trade.entryPrice,
                            timestamp: trade.entryDate,
                            pnl: trade.pnl,
                            strikePrice: trade.strikePrice,
                            optionType: trade.optionType,
                            expiryDate: trade.expiryDate
                        }
                    });
                }
            }

            logger.info('Enhanced backtest result saved:', savedResult.id);
            return savedResult;
        } catch (error) {
            logger.error('Failed to save enhanced backtest result:', error);
            throw error;
        }
    }

    async getBacktestResults(strategyId?: string): Promise<BacktestResult[]> {
        try {
            const where: Prisma.BacktestResultWhereInput = strategyId ? { strategyId } : {};
            const results = await db.backtestResult.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: {
                    strategy: true,
                    trades: {
                        include: {
                            instrument: true
                        }
                    }
                }
            });

            return results.map(result => ({
                id: result.id,
                strategyId: result.strategyId,
                startDate: result.startDate,
                endDate: result.endDate,
                initialCapital: result.initialCapital,
                finalCapital: result.finalCapital,
                totalReturn: result.totalReturn,
                annualizedReturn: result.annualizedReturn,
                sharpeRatio: result.sharpeRatio || 0,
                sortinoRatio: result.sortinoRatio || 0,
                maxDrawdown: result.maxDrawdown,
                volatility: 0, // Calculate from trades if needed
                totalTrades: result.trades.length,
                winningTrades: result.trades.filter(t => (t.pnl || 0) > 0).length,
                losingTrades: result.trades.filter(t => (t.pnl || 0) < 0).length,
                winRate: result.trades.length > 0 ?
                    result.trades.filter(t => (t.pnl || 0) > 0).length / result.trades.length : 0,
                avgWin: 0, // Calculate if needed
                avgLoss: 0, // Calculate if needed
                profitFactor: 0, // Calculate if needed
                totalOptionsTrades: result.totalOptionsTrades,
                optionsWinRate: result.optionsWinRate || 0,
                averageOptionsPnL: result.averageOptionsPnL || 0,
                greeksExposure: { avgDelta: 0, avgGamma: 0, avgTheta: 0, avgVega: 0 },
                trades: result.trades.map(trade => ({
                    id: trade.id,
                    symbol: trade.instrument.symbol,
                    entryDate: trade.timestamp,
                    exitDate: trade.timestamp, // Simplified
                    entryPrice: trade.price,
                    exitPrice: trade.price, // Simplified
                    quantity: trade.quantity,
                    side: trade.action === 'BUY' ? 'LONG' : 'SHORT',
                    pnl: trade.pnl || 0,
                    fees: 0,
                    instrumentType: trade.instrument.instrumentType === 'OPT' ? 'OPTION' : 'EQUITY',
                    strikePrice: trade.strikePrice,
                    optionType: trade.optionType as 'CE' | 'PE' | undefined,
                    expiryDate: trade.expiryDate,
                    technicalSignals: {
                        adx: 0,
                        rsi: 50,
                        macd: { macd: 0, signal: 0, histogram: 0 },
                        bollinger: { upper: 0, middle: 0, lower: 0 }
                    }
                })),
                dailyReturns: [],
                monthlyReturns: [],
                recommendations: [],
                riskMetrics: this.initializeRiskMetrics(),
                createdAt: result.createdAt
            }));
        } catch (error) {
            logger.error('Failed to get enhanced backtest results:', error);
            throw error;
        }
    }

    async getTradeRecommendations(symbols: string[], timeframe: string = '1day'): Promise<TradeRecommendation[]> {
        try {
            const recommendations: TradeRecommendation[] = [];

            for (const symbol of symbols) {
                const analysis = await this.optionsTechnicalService.analyzeOptionsData(
                    symbol,
                    timeframe,
                    'ALL'
                );

                if (analysis.success) {
                    const recommendation = await this.createTradeRecommendation(
                        symbol,
                        analysis,
                        {
                            trades: [],
                            totalTrades: 0,
                            winningTrades: 0,
                            losingTrades: 0
                        } as BacktestResult
                    );

                    if (recommendation) {
                        recommendations.push(recommendation);
                    }
                }
            }

            return recommendations.sort((a, b) => b.confidence - a.confidence);
        } catch (error) {
            logger.error('Failed to get trade recommendations:', error);
            throw error;
        }
    }
} 