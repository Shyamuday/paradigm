import { logger } from '../logger/logger';
import { MarketData } from '../schemas/strategy.schema';
import { BaseStrategy } from './strategy-engine.service';

// Backtest configuration
export interface BacktestConfig {
    startDate: Date;
    endDate: Date;
    initialCapital: number;
    commission: number;           // Commission per trade
    slippage: number;            // Slippage percentage
    dataSource: string;          // Data source identifier
    instruments: string[];       // Instruments to backtest
    strategies: string[];        // Strategy names to test
    walkForward: {
        enabled: boolean;
        windowSize: number;        // Days for training window
        stepSize: number;          // Days to step forward
        minTestPeriod: number;     // Minimum test period
    };
    monteCarlo: {
        enabled: boolean;
        simulations: number;       // Number of simulations
        confidenceLevel: number;   // Confidence level for intervals
    };
    riskManagement: {
        maxDrawdown: number;       // Maximum drawdown limit
        stopLoss: number;         // Stop loss percentage
        takeProfit: number;       // Take profit percentage
        positionSizing: 'fixed' | 'kelly' | 'optimal';
    };
}

// Trade execution result
export interface BacktestTrade {
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    quantity: number;
    entryPrice: number;
    exitPrice: number;
    entryTime: Date;
    exitTime: Date;
    pnl: number;
    commission: number;
    slippage: number;
    strategy: string;
    signal: any;
}

// Portfolio state at any point
export interface PortfolioState {
    timestamp: Date;
    capital: number;
    positions: Map<string, {
        symbol: string;
        side: 'LONG' | 'SHORT';
        quantity: number;
        entryPrice: number;
        currentPrice: number;
        unrealizedPnL: number;
    }>;
    cash: number;
    totalValue: number;
    dailyPnL: number;
    cumulativePnL: number;
}

// Performance metrics
export interface PerformanceMetrics {
    // Returns
    totalReturn: number;
    annualizedReturn: number;
    dailyReturns: number[];

    // Risk metrics
    volatility: number;
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    maxDrawdown: number;
    var95: number;
    var99: number;

    // Trade metrics
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    averageWin: number;
    averageLoss: number;
    profitFactor: number;
    averageTradeDuration: number;

    // Additional metrics
    bestTrade: number;
    worstTrade: number;
    consecutiveWins: number;
    consecutiveLosses: number;
    recoveryFactor: number;
    ulcerIndex: number;
    gainToPainRatio: number;
}

// Walk-forward analysis result
export interface WalkForwardResult {
    period: {
        start: Date;
        end: Date;
        type: 'training' | 'testing';
    };
    metrics: PerformanceMetrics;
    trades: BacktestTrade[];
    equity: { timestamp: Date; value: number }[];
}

// Monte Carlo simulation result
export interface MonteCarloResult {
    simulations: number;
    confidenceLevel: number;
    expectedReturn: number;
    expectedVolatility: number;
    worstCaseReturn: number;
    bestCaseReturn: number;
    probabilityOfLoss: number;
    probabilityOfDrawdown: number;
    returnDistribution: number[];
}

export class AdvancedBacktestEngine {
    private config: BacktestConfig;
    private strategies: Map<string, BaseStrategy> = new Map();
    private marketData: Map<string, MarketData[]> = new Map();
    private results: {
        trades: BacktestTrade[];
        portfolioStates: PortfolioState[];
        metrics: PerformanceMetrics;
        walkForward: WalkForwardResult[];
        monteCarlo: MonteCarloResult | null;
    } = {
            trades: [],
            portfolioStates: [],
            metrics: this.getDefaultMetrics(),
            walkForward: [],
            monteCarlo: null
        };

    constructor(config: BacktestConfig) {
        this.config = config;
        logger.info('Advanced Backtest Engine initialized', { config });
    }

    /**
     * Add strategy to backtest
     */
    addStrategy(name: string, strategy: BaseStrategy): void {
        this.strategies.set(name, strategy);
        logger.info('Strategy added to backtest', { name });
    }

    /**
     * Add market data for instrument
     */
    addMarketData(symbol: string, data: MarketData[]): void {
        this.marketData.set(symbol, data);
        logger.info('Market data added', { symbol, dataPoints: data.length });
    }

    /**
     * Run complete backtest
     */
    async runBacktest(): Promise<{
        metrics: PerformanceMetrics;
        trades: BacktestTrade[];
        walkForward: WalkForwardResult[];
        monteCarlo: MonteCarloResult | null;
    }> {
        logger.info('Starting advanced backtest...');

        try {
            // Run standard backtest
            await this.runStandardBacktest();

            // Run walk-forward analysis if enabled
            if (this.config.walkForward.enabled) {
                await this.runWalkForwardAnalysis();
            }

            // Run Monte Carlo simulation if enabled
            if (this.config.monteCarlo.enabled) {
                await this.runMonteCarloSimulation();
            }

            logger.info('Backtest completed successfully', {
                totalTrades: this.results.trades.length,
                totalReturn: this.results.metrics.totalReturn
            });

            return {
                metrics: this.results.metrics,
                trades: this.results.trades,
                walkForward: this.results.walkForward,
                monteCarlo: this.results.monteCarlo
            };

        } catch (error) {
            logger.error('Backtest failed:', error);
            throw error;
        }
    }

    /**
     * Run standard backtest
     */
    private async runStandardBacktest(): Promise<void> {
        const portfolio = this.initializePortfolio();
        const allData = this.getAllMarketData();

        // Sort all data by timestamp
        const sortedData = allData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Filter data by date range
        const filteredData = sortedData.filter(data =>
            data.timestamp >= this.config.startDate &&
            data.timestamp <= this.config.endDate
        );

        logger.info('Running standard backtest', {
            dataPoints: filteredData.length,
            startDate: this.config.startDate,
            endDate: this.config.endDate
        });

        // Process each data point
        for (const data of filteredData) {
            // Update portfolio with current market data
            this.updatePortfolioPrices(portfolio, data);

            // Generate signals from all strategies
            const signals = await this.generateSignals(data);

            // Execute signals
            for (const signal of signals) {
                const trade = this.executeSignal(portfolio, signal, data);
                if (trade) {
                    this.results.trades.push(trade);
                }
            }

            // Check exit conditions
            await this.checkExitConditions(portfolio, data);

            // Record portfolio state
            this.results.portfolioStates.push(this.clonePortfolioState(portfolio));
        }

        // Calculate final metrics
        this.results.metrics = this.calculatePerformanceMetrics();
    }

    /**
     * Run walk-forward analysis
     */
    private async runWalkForwardAnalysis(): Promise<void> {
        logger.info('Running walk-forward analysis...');

        const windowSize = this.config.walkForward.windowSize;
        const stepSize = this.config.walkForward.stepSize;
        const minTestPeriod = this.config.walkForward.minTestPeriod;

        let currentDate = new Date(this.config.startDate);
        const endDate = new Date(this.config.endDate);

        while (currentDate < endDate) {
            // Training period
            const trainingStart = new Date(currentDate);
            const trainingEnd = new Date(currentDate.getTime() + windowSize * 24 * 60 * 60 * 1000);

            // Testing period
            const testingStart = new Date(trainingEnd);
            const testingEnd = new Date(testingStart.getTime() + minTestPeriod * 24 * 60 * 60 * 1000);

            if (testingEnd > endDate) break;

            // Run training backtest
            const trainingResult = await this.runPeriodBacktest(trainingStart, trainingEnd, 'training');

            // Run testing backtest
            const testingResult = await this.runPeriodBacktest(testingStart, testingEnd, 'testing');

            this.results.walkForward.push(trainingResult, testingResult);

            // Move forward
            currentDate = new Date(currentDate.getTime() + stepSize * 24 * 60 * 60 * 1000);
        }

        logger.info('Walk-forward analysis completed', {
            periods: this.results.walkForward.length
        });
    }

    /**
     * Run Monte Carlo simulation
     */
    private async runMonteCarloSimulation(): Promise<void> {
        logger.info('Running Monte Carlo simulation...');

        const dailyReturns = this.results.metrics.dailyReturns;
        const simulations = this.config.monteCarlo.simulations;
        const confidenceLevel = this.config.monteCarlo.confidenceLevel;

        const returnDistributions: number[] = [];

        for (let i = 0; i < simulations; i++) {
            // Bootstrap sample from daily returns
            const bootstrappedReturns = this.bootstrapSample(dailyReturns, dailyReturns.length);

            // Calculate cumulative return
            const cumulativeReturn = bootstrappedReturns.reduce((total, ret) => total * (1 + ret), 1) - 1;
            returnDistributions.push(cumulativeReturn);
        }

        // Calculate statistics
        const sortedReturns = returnDistributions.sort((a, b) => a - b);
        const expectedReturn = returnDistributions.reduce((sum, ret) => sum + ret, 0) / simulations;
        const expectedVolatility = Math.sqrt(
            returnDistributions.reduce((sum, ret) => sum + Math.pow(ret - expectedReturn, 2), 0) / simulations
        );

        const worstCaseIndex = Math.floor((1 - confidenceLevel) * simulations);
        const bestCaseIndex = Math.floor(confidenceLevel * simulations);

        const worstCaseReturn = sortedReturns[worstCaseIndex] || 0;
        const bestCaseReturn = sortedReturns[bestCaseIndex] || 0;

        const probabilityOfLoss = returnDistributions.filter(ret => ret < 0).length / simulations;
        const probabilityOfDrawdown = returnDistributions.filter(ret => ret < -0.1).length / simulations;

        this.results.monteCarlo = {
            simulations,
            confidenceLevel,
            expectedReturn,
            expectedVolatility,
            worstCaseReturn,
            bestCaseReturn,
            probabilityOfLoss,
            probabilityOfDrawdown,
            returnDistribution: returnDistributions
        };

        logger.info('Monte Carlo simulation completed', {
            simulations,
            expectedReturn: (expectedReturn * 100).toFixed(2) + '%',
            probabilityOfLoss: (probabilityOfLoss * 100).toFixed(2) + '%'
        });
    }

    /**
     * Run backtest for a specific period
     */
    private async runPeriodBacktest(startDate: Date, endDate: Date, type: 'training' | 'testing'): Promise<WalkForwardResult> {
        const portfolio = this.initializePortfolio();
        const allData = this.getAllMarketData();

        const filteredData = allData.filter(data =>
            data.timestamp >= startDate && data.timestamp <= endDate
        );

        const trades: BacktestTrade[] = [];
        const equity: { timestamp: Date; value: number }[] = [];

        for (const data of filteredData) {
            this.updatePortfolioPrices(portfolio, data);

            const signals = await this.generateSignals(data);

            for (const signal of signals) {
                const trade = this.executeSignal(portfolio, signal, data);
                if (trade) {
                    trades.push(trade);
                }
            }

            await this.checkExitConditions(portfolio, data);

            equity.push({
                timestamp: data.timestamp,
                value: portfolio.totalValue
            });
        }

        const metrics = this.calculatePerformanceMetricsForTrades(trades, equity);

        return {
            period: { start: startDate, end: endDate, type },
            metrics,
            trades,
            equity
        };
    }

    /**
     * Initialize portfolio
     */
    private initializePortfolio(): PortfolioState {
        return {
            timestamp: new Date(),
            capital: this.config.initialCapital,
            positions: new Map(),
            cash: this.config.initialCapital,
            totalValue: this.config.initialCapital,
            dailyPnL: 0,
            cumulativePnL: 0
        };
    }

    /**
     * Get all market data
     */
    private getAllMarketData(): MarketData[] {
        const allData: MarketData[] = [];
        for (const [symbol, data] of this.marketData) {
            allData.push(...data);
        }
        return allData;
    }

    /**
     * Update portfolio prices
     */
    private updatePortfolioPrices(portfolio: PortfolioState, data: MarketData): void {
        for (const [symbol, position] of portfolio.positions) {
            if (symbol === data.symbol && data.close !== null) {
                position.currentPrice = data.close;
                position.unrealizedPnL = position.side === 'LONG'
                    ? (data.close - position.entryPrice) * position.quantity
                    : (position.entryPrice - data.close) * position.quantity;
            }
        }

        // Recalculate total value
        const positionsValue = Array.from(portfolio.positions.values())
            .reduce((sum, pos) => sum + (pos.currentPrice * pos.quantity), 0);

        portfolio.totalValue = portfolio.cash + positionsValue;
        portfolio.timestamp = data.timestamp;
    }

    /**
     * Generate signals from all strategies
     */
    private async generateSignals(data: MarketData): Promise<any[]> {
        const signals: any[] = [];

        for (const [name, strategy] of this.strategies) {
            if (this.config.strategies.includes(name)) {
                try {
                    const strategySignals = await strategy.generateSignals([data]);
                    signals.push(...strategySignals);
                } catch (error) {
                    logger.error(`Error generating signals for strategy ${name}:`, error);
                }
            }
        }

        return signals;
    }

    /**
     * Execute a trading signal
     */
    private executeSignal(portfolio: PortfolioState, signal: any, data: MarketData): BacktestTrade | null {
        // Check if we have enough cash
        const requiredCash = signal.quantity * signal.price * (1 + this.config.commission + this.config.slippage);

        if (requiredCash > portfolio.cash) {
            logger.warn('Insufficient cash for trade', { requiredCash, availableCash: portfolio.cash });
            return null;
        }

        // Execute trade
        const commission = signal.quantity * signal.price * this.config.commission;
        const slippage = signal.quantity * signal.price * this.config.slippage;

        portfolio.cash -= requiredCash;

        // Add position
        portfolio.positions.set(signal.symbol, {
            symbol: signal.symbol,
            side: signal.side,
            quantity: signal.quantity,
            entryPrice: signal.price,
            currentPrice: signal.price,
            unrealizedPnL: 0
        });

        return {
            id: signal.id,
            symbol: signal.symbol,
            side: signal.side,
            quantity: signal.quantity,
            entryPrice: signal.price,
            exitPrice: 0, // Will be set when position is closed
            entryTime: data.timestamp,
            exitTime: new Date(), // Will be set when position is closed
            pnl: 0, // Will be calculated when position is closed
            commission,
            slippage,
            strategy: signal.strategyName,
            signal
        };
    }

    /**
     * Check exit conditions for all positions
     */
    private async checkExitConditions(portfolio: PortfolioState, data: MarketData): Promise<void> {
        for (const [symbol, position] of portfolio.positions) {
            if (symbol === data.symbol) {
                let shouldExit = false;
                let exitReason = '';

                // Check stop loss
                if (data.close !== null && position.side === 'LONG' && data.close <= position.entryPrice * (1 - this.config.riskManagement.stopLoss / 100)) {
                    shouldExit = true;
                    exitReason = 'Stop Loss';
                } else if (data.close !== null && position.side === 'SHORT' && data.close >= position.entryPrice * (1 + this.config.riskManagement.stopLoss / 100)) {
                    shouldExit = true;
                    exitReason = 'Stop Loss';
                }

                // Check take profit
                if (data.close !== null && position.side === 'LONG' && data.close >= position.entryPrice * (1 + this.config.riskManagement.takeProfit / 100)) {
                    shouldExit = true;
                    exitReason = 'Take Profit';
                } else if (data.close !== null && position.side === 'SHORT' && data.close <= position.entryPrice * (1 - this.config.riskManagement.takeProfit / 100)) {
                    shouldExit = true;
                    exitReason = 'Take Profit';
                }

                // Check strategy exit conditions
                for (const [name, strategy] of this.strategies) {
                    if (this.config.strategies.includes(name)) {
                        try {
                            const shouldExitStrategy = await strategy.shouldExit(position as any, [data]);
                            if (shouldExitStrategy) {
                                shouldExit = true;
                                exitReason = `Strategy ${name}`;
                                break;
                            }
                        } catch (error) {
                            logger.error(`Error checking exit conditions for strategy ${name}:`, error);
                        }
                    }
                }

                if (shouldExit) {
                    this.closePosition(portfolio, position, data, exitReason);
                }
            }
        }
    }

    /**
     * Close a position
     */
    private closePosition(portfolio: PortfolioState, position: any, data: MarketData, reason: string): void {
        if (data.close === null) {
            logger.warn('Cannot close position: data.close is null', { symbol: position.symbol });
            return;
        }

        const exitValue = position.quantity * data.close;
        const commission = exitValue * this.config.commission;
        const slippage = exitValue * this.config.slippage;

        const pnl = position.side === 'LONG'
            ? exitValue - (position.quantity * position.entryPrice) - commission - slippage
            : (position.quantity * position.entryPrice) - exitValue - commission - slippage;

        portfolio.cash += exitValue - commission - slippage;
        portfolio.positions.delete(position.symbol);

        // Update trade record
        const trade = this.results.trades.find(t => t.symbol === position.symbol && t.exitPrice === 0);
        if (trade) {
            trade.exitPrice = data.close;
            trade.exitTime = data.timestamp;
            trade.pnl = pnl;
        }

        logger.info('Position closed', {
            symbol: position.symbol,
            side: position.side,
            pnl,
            reason
        });
    }

    /**
     * Calculate performance metrics
     */
    private calculatePerformanceMetrics(): PerformanceMetrics {
        return this.calculatePerformanceMetricsForTrades(this.results.trades, this.results.portfolioStates.map(s => ({
            timestamp: s.timestamp,
            value: s.totalValue
        })));
    }

    /**
     * Calculate performance metrics for specific trades and equity curve
     */
    private calculatePerformanceMetricsForTrades(trades: BacktestTrade[], equity: { timestamp: Date; value: number }[]): PerformanceMetrics {
        if (trades.length === 0 || equity.length === 0) {
            return this.getDefaultMetrics();
        }

        // Calculate returns
        if (equity.length === 0) {
            return this.getDefaultMetrics();
        }

        const totalReturn = (equity[equity.length - 1]!.value - this.config.initialCapital) / this.config.initialCapital;

        // Calculate daily returns
        const dailyReturns: number[] = [];
        for (let i = 1; i < equity.length; i++) {
            const current = equity[i]!;
            const previous = equity[i - 1]!;
            const dailyReturn = (current.value - previous.value) / previous.value;
            dailyReturns.push(dailyReturn);
        }

        // Calculate annualized return
        const days = (equity[equity.length - 1]!.timestamp.getTime() - equity[0]!.timestamp.getTime()) / (1000 * 60 * 60 * 24);
        const annualizedReturn = Math.pow(1 + totalReturn, 365 / days) - 1;

        // Calculate volatility
        const meanReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
        const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / dailyReturns.length;
        const volatility = Math.sqrt(variance * 252); // Annualized

        // Calculate Sharpe ratio
        const riskFreeRate = 0.05; // 5% risk-free rate
        const sharpeRatio = volatility > 0 ? (annualizedReturn - riskFreeRate) / volatility : 0;

        // Calculate Sortino ratio
        const downsideReturns = dailyReturns.filter(ret => ret < meanReturn);
        const downsideDeviation = downsideReturns.length > 0
            ? Math.sqrt(downsideReturns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / downsideReturns.length)
            : 0;
        const sortinoRatio = downsideDeviation > 0 ? (annualizedReturn - riskFreeRate) / (downsideDeviation * Math.sqrt(252)) : 0;

        // Calculate max drawdown
        const maxDrawdown = this.calculateMaxDrawdown(equity.map(e => e.value));

        // Calculate Calmar ratio
        const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

        // Calculate VaR
        const var95 = this.calculateVaR(dailyReturns, 0.95);
        const var99 = this.calculateVaR(dailyReturns, 0.99);

        // Calculate trade metrics
        const winningTrades = trades.filter(t => t.pnl > 0);
        const losingTrades = trades.filter(t => t.pnl < 0);
        const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;

        const averageWin = winningTrades.length > 0
            ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
            : 0;

        const averageLoss = losingTrades.length > 0
            ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length)
            : 0;

        const profitFactor = averageLoss > 0 ? (averageWin * winningTrades.length) / (averageLoss * losingTrades.length) : 0;

        // Calculate average trade duration
        const tradeDurations = trades.map(t => t.exitTime.getTime() - t.entryTime.getTime());
        const averageTradeDuration = tradeDurations.length > 0
            ? tradeDurations.reduce((sum, d) => sum + d, 0) / tradeDurations.length
            : 0;

        // Calculate best and worst trades
        const bestTrade = trades.length > 0 ? Math.max(...trades.map(t => t.pnl)) : 0;
        const worstTrade = trades.length > 0 ? Math.min(...trades.map(t => t.pnl)) : 0;

        // Calculate consecutive wins/losses
        const consecutiveWins = this.calculateConsecutiveWins(trades);
        const consecutiveLosses = this.calculateConsecutiveLosses(trades);

        // Calculate recovery factor
        const recoveryFactor = maxDrawdown > 0 ? totalReturn / maxDrawdown : 0;

        // Calculate ulcer index
        const ulcerIndex = this.calculateUlcerIndex(equity.map(e => e.value));

        // Calculate gain to pain ratio
        const totalGains = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
        const gainToPainRatio = totalLosses > 0 ? totalGains / totalLosses : 0;

        return {
            totalReturn,
            annualizedReturn,
            dailyReturns,
            volatility,
            sharpeRatio,
            sortinoRatio,
            calmarRatio,
            maxDrawdown,
            var95,
            var99,
            totalTrades: trades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            winRate,
            averageWin,
            averageLoss,
            profitFactor,
            averageTradeDuration,
            bestTrade,
            worstTrade,
            consecutiveWins,
            consecutiveLosses,
            recoveryFactor,
            ulcerIndex,
            gainToPainRatio
        };
    }

    // Helper methods
    private calculateMaxDrawdown(values: number[]): number {
        if (values.length === 0) return 0;

        let maxDrawdown = 0;
        let peak = values[0]!;

        for (const value of values) {
            if (value > peak) {
                peak = value;
            }
            const drawdown = (peak - value) / peak;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }

        return maxDrawdown;
    }

    private calculateVaR(returns: number[], confidence: number): number {
        if (returns.length === 0) return 0;

        const sortedReturns = [...returns].sort((a, b) => a - b);
        const index = Math.floor((1 - confidence) * sortedReturns.length);
        return Math.abs(sortedReturns[index] || 0);
    }

    private calculateConsecutiveWins(trades: BacktestTrade[]): number {
        let maxConsecutive = 0;
        let currentConsecutive = 0;

        for (const trade of trades) {
            if (trade.pnl > 0) {
                currentConsecutive++;
                maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
            } else {
                currentConsecutive = 0;
            }
        }

        return maxConsecutive;
    }

    private calculateConsecutiveLosses(trades: BacktestTrade[]): number {
        let maxConsecutive = 0;
        let currentConsecutive = 0;

        for (const trade of trades) {
            if (trade.pnl < 0) {
                currentConsecutive++;
                maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
            } else {
                currentConsecutive = 0;
            }
        }

        return maxConsecutive;
    }

    private calculateUlcerIndex(values: number[]): number {
        if (values.length < 2) return 0;

        let peak = values[0]!;
        let sumSquaredDrawdowns = 0;

        for (const value of values) {
            if (value > peak) {
                peak = value;
            }
            const drawdown = (peak - value) / peak;
            sumSquaredDrawdowns += drawdown * drawdown;
        }

        return Math.sqrt(sumSquaredDrawdowns / values.length);
    }

    private bootstrapSample(data: number[], size: number): number[] {
        const sample: number[] = [];
        for (let i = 0; i < size; i++) {
            const randomIndex = Math.floor(Math.random() * data.length);
            const value = data[randomIndex];
            if (value !== undefined) {
                sample.push(value);
            }
        }
        return sample;
    }

    private clonePortfolioState(portfolio: PortfolioState): PortfolioState {
        return {
            timestamp: new Date(portfolio.timestamp),
            capital: portfolio.capital,
            positions: new Map(portfolio.positions),
            cash: portfolio.cash,
            totalValue: portfolio.totalValue,
            dailyPnL: portfolio.dailyPnL,
            cumulativePnL: portfolio.cumulativePnL
        };
    }

    private getDefaultMetrics(): PerformanceMetrics {
        return {
            totalReturn: 0,
            annualizedReturn: 0,
            dailyReturns: [],
            volatility: 0,
            sharpeRatio: 0,
            sortinoRatio: 0,
            calmarRatio: 0,
            maxDrawdown: 0,
            var95: 0,
            var99: 0,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            averageWin: 0,
            averageLoss: 0,
            profitFactor: 0,
            averageTradeDuration: 0,
            bestTrade: 0,
            worstTrade: 0,
            consecutiveWins: 0,
            consecutiveLosses: 0,
            recoveryFactor: 0,
            ulcerIndex: 0,
            gainToPainRatio: 0
        };
    }
} 