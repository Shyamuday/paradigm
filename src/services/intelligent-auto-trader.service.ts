import { logger } from '../logger/logger';
import { EnhancedStrategyService } from './enhanced-strategy.service';
import { AdvancedRiskService, PositionRisk, RiskMetrics } from './advanced-risk.service';
import { TelegramNotificationService } from './telegram-notification.service';
import { ConfigManager } from '../config/config-manager';
import { MarketData } from '../schemas/strategy.schema';
import KiteConnect from 'kiteconnect';

// Intelligent Auto-Trader Configuration
export interface IntelligentAutoTraderConfig {
    // API Configuration
    apiKey: string;
    apiSecret: string;
    accessToken: string;

    // Trading Parameters
    capital: number;
    maxRiskPerTrade: number;
    maxDailyLoss: number;
    maxOpenPositions: number;

    // Market Analysis
    instruments: string[];
    analysisInterval: number; // seconds
    signalConfidence: number; // minimum confidence for execution

    // Risk Management
    riskLimits: {
        maxPortfolioVar: number;
        maxPositionVar: number;
        maxDrawdown: number;
        maxLeverage: number;
        maxConcentration: number;
    };

    // Strategy Configuration
    strategies: {
        [key: string]: {
            enabled: boolean;
            weight: number; // 0-1, relative importance
            allocation: number; // percentage of capital
            parameters: any;
        };
    };

    // Market Conditions
    marketConditions: {
        volatilityThreshold: number;
        volumeThreshold: number;
        trendStrengthThreshold: number;
        correlationThreshold: number;
    };

    // Execution Settings
    execution: {
        enableRealTrading: boolean;
        paperTrading: boolean;
        slippageTolerance: number;
        retryAttempts: number;
        orderTimeout: number;
    };

    // Notifications
    telegram: {
        enabled: boolean;
        botToken: string;
        chatId: string;
        updateInterval: number;
        notifications: {
            tradeSignals: boolean;
            tradeExecutions: boolean;
            positionUpdates: boolean;
            performanceUpdates: boolean;
            systemAlerts: boolean;
            dailyReports: boolean;
            errorAlerts: boolean;
        };
    };
}

// Market Analysis Result
export interface MarketAnalysis {
    timestamp: Date;
    symbol: string;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number; // 0-1
    volatility: number;
    volume: number;
    support: number;
    resistance: number;
    signals: any[];
    riskScore: number; // 0-100
    recommendation: 'BUY' | 'SELL' | 'HOLD';
    confidence: number; // 0-1
}

// Portfolio Analysis
export interface PortfolioAnalysis {
    timestamp: Date;
    totalValue: number;
    cash: number;
    positions: PositionRisk[];
    riskMetrics: RiskMetrics;
    diversification: number; // 0-1
    correlation: number;
    concentration: number;
    leverage: number;
    recommendations: string[];
}

export class IntelligentAutoTrader {
    private config: IntelligentAutoTraderConfig;
    private strategyService: EnhancedStrategyService;
    private riskService: AdvancedRiskService;
    private telegramService: TelegramNotificationService;
    private kite: any; // Use any for KiteConnect
    private configManager: ConfigManager;

    // State management
    private isRunning: boolean = false;
    private currentPositions: Map<string, any> = new Map();
    private marketAnalysis: Map<string, MarketAnalysis> = new Map();
    private portfolioAnalysis: PortfolioAnalysis | null = null;
    private executionHistory: any[] = [];

    // Performance tracking
    private dailyPnL: number = 0;
    private totalPnL: number = 0;
    private winningTrades: number = 0;
    private losingTrades: number = 0;
    private totalTrades: number = 0;

    constructor(config: IntelligentAutoTraderConfig) {
        this.config = config;
        this.strategyService = new EnhancedStrategyService(new ConfigManager());
        this.riskService = new AdvancedRiskService(config.riskLimits);
        this.telegramService = new TelegramNotificationService(config.telegram);
        this.kite = new (KiteConnect as any)({
            api_key: config.apiKey,
            api_secret: config.apiSecret
        });
        this.configManager = new ConfigManager();

        logger.info('Intelligent Auto-Trader initialized', {
            instruments: config.instruments.length,
            strategies: Object.keys(config.strategies).length,
            capital: config.capital
        });
    }

    /**
     * Initialize the auto-trader
     */
    async initialize(): Promise<void> {
        try {
            logger.info('Initializing Intelligent Auto-Trader...');

            // Initialize services
            await this.strategyService.initialize();
            await this.telegramService.initialize();

            // Set access token
            this.kite.setAccessToken(this.config.accessToken);

            // Load current positions
            await this.loadCurrentPositions();

            // Send startup notification
            await this.telegramService.sendSystemAlert({
                type: 'INFO',
                message: `Intelligent Auto-Trader Started\nCapital: ₹${this.config.capital.toLocaleString()}\nInstruments: ${this.config.instruments.length}\nStrategies: ${Object.keys(this.config.strategies).length}`,
                timestamp: new Date()
            });

            logger.info('Intelligent Auto-Trader initialized successfully');

        } catch (error) {
            logger.error('Failed to initialize Intelligent Auto-Trader:', error);
            throw error;
        }
    }

    /**
     * Start automated trading
     */
    async startTrading(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Auto-trader is already running');
            return;
        }

        try {
            logger.info('Starting Intelligent Auto-Trader...');
            this.isRunning = true;

            // Start market analysis loop
            this.startMarketAnalysisLoop();

            // Start portfolio monitoring loop
            this.startPortfolioMonitoringLoop();

            // Start performance reporting loop
            this.startPerformanceReportingLoop();

            await this.telegramService.sendSystemAlert({
                type: 'INFO',
                message: 'Intelligent Auto-Trader is now actively analyzing and executing trades',
                timestamp: new Date()
            });

            logger.info('Intelligent Auto-Trader started successfully');

        } catch (error) {
            logger.error('Failed to start auto-trading:', error);
            await this.telegramService.sendErrorAlert(error as Error, 'Auto-Trading Start');
            throw error;
        }
    }

    /**
     * Stop automated trading
     */
    async stopTrading(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('Auto-trader is not running');
            return;
        }

        try {
            logger.info('Stopping Intelligent Auto-Trader...');
            this.isRunning = false;

            // Close all positions if configured
            if (this.config.execution.enableRealTrading) {
                await this.closeAllPositions();
            }

            await this.telegramService.sendSystemAlert({
                type: 'INFO',
                message: `Auto-Trading Stopped\nFinal P&L: ₹${this.totalPnL.toLocaleString()}\nTotal Trades: ${this.totalTrades}`,
                timestamp: new Date()
            });

            logger.info('Intelligent Auto-Trader stopped successfully');

        } catch (error) {
            logger.error('Failed to stop auto-trading:', error);
            await this.telegramService.sendErrorAlert(error as Error, 'Auto-Trading Stop');
            throw error;
        }
    }

    /**
     * Main market analysis loop
     */
    private startMarketAnalysisLoop(): void {
        setInterval(async () => {
            if (!this.isRunning) return;

            try {
                // Get market data for all instruments
                const marketData = await this.getMarketData();

                // Analyze each instrument
                for (const instrument of this.config.instruments) {
                    const instrumentData = marketData.filter(d => d.symbol === instrument);
                    if (instrumentData.length > 0) {
                        const analysis = await this.analyzeMarket(instrument, instrumentData);
                        this.marketAnalysis.set(instrument, analysis);

                        // Check for trading opportunities
                        await this.evaluateTradingOpportunity(analysis);
                    }
                }

                // Update portfolio analysis
                await this.updatePortfolioAnalysis();

            } catch (error) {
                logger.error('Error in market analysis loop:', error);
                await this.telegramService.sendErrorAlert(error as Error, 'Market Analysis Loop');
            }
        }, this.config.analysisInterval * 1000);
    }

    /**
     * Portfolio monitoring loop
     */
    private startPortfolioMonitoringLoop(): void {
        setInterval(async () => {
            if (!this.isRunning) return;

            try {
                // Monitor existing positions
                await this.monitorPositions();

                // Check risk limits
                await this.checkRiskLimits();

                // Rebalance if necessary
                await this.rebalancePortfolio();

            } catch (error) {
                logger.error('Error in portfolio monitoring loop:', error);
                await this.telegramService.sendErrorAlert(error as Error, 'Portfolio Monitoring Loop');
            }
        }, 60000); // Every minute
    }

    /**
     * Performance reporting loop
     */
    private startPerformanceReportingLoop(): void {
        setInterval(async () => {
            if (!this.isRunning) return;

            try {
                await this.sendPerformanceUpdate();
            } catch (error) {
                logger.error('Error in performance reporting loop:', error);
            }
        }, 300000); // Every 5 minutes
    }

    /**
     * Analyze market conditions for an instrument
     */
    private async analyzeMarket(symbol: string, marketData: MarketData[]): Promise<MarketAnalysis> {
        try {
            // Get strategy signals
            const strategyResults = await this.strategyService.executeAllStrategies(marketData);

            // Aggregate signals
            const signals = strategyResults.flatMap(result => result.signals || []);

            // Calculate technical indicators
            const technicalAnalysis = this.calculateTechnicalIndicators(marketData);

            // Determine trend and strength
            const trend = this.determineTrend(technicalAnalysis);
            const strength = this.calculateTrendStrength(technicalAnalysis);

            // Calculate support and resistance
            const { support, resistance } = this.calculateSupportResistance(marketData);

            // Calculate volatility
            const volatility = this.calculateVolatility(marketData);

            // Calculate volume analysis
            const volume = this.analyzeVolume(marketData);

            // Generate recommendation
            const { recommendation, confidence } = this.generateRecommendation(
                signals, trend, strength, volatility, volume
            );

            // Calculate risk score
            const riskScore = this.calculateRiskScore(volatility, volume, signals);

            return {
                timestamp: new Date(),
                symbol,
                trend,
                strength,
                volatility,
                volume,
                support,
                resistance,
                signals,
                riskScore,
                recommendation,
                confidence
            };

        } catch (error) {
            logger.error(`Error analyzing market for ${symbol}:`, error);
            throw error;
        }
    }

    /**
     * Evaluate trading opportunity based on analysis
     */
    private async evaluateTradingOpportunity(analysis: MarketAnalysis): Promise<void> {
        try {
            // Check if confidence meets threshold
            if (analysis.confidence < this.config.signalConfidence) {
                return;
            }

            // Check if we already have a position
            if (this.currentPositions.has(analysis.symbol)) {
                return;
            }

            // Check if we have enough capital
            if (this.currentPositions.size >= this.config.maxOpenPositions) {
                return;
            }

            // Check market conditions
            if (!this.checkMarketConditions(analysis)) {
                return;
            }

            // Calculate position size
            const positionSize = this.calculateOptimalPositionSize(analysis);

            if (positionSize <= 0) {
                return;
            }

            // Execute trade
            await this.executeTrade(analysis, positionSize);

        } catch (error) {
            logger.error(`Error evaluating trading opportunity for ${analysis.symbol}:`, error);
            await this.telegramService.sendErrorAlert(error as Error, `Trading Opportunity - ${analysis.symbol}`);
        }
    }

    /**
     * Execute a trade
     */
    private async executeTrade(analysis: MarketAnalysis, quantity: number): Promise<void> {
        try {
            const currentPrice = this.getCurrentPrice(analysis.symbol);

            if (!currentPrice) {
                logger.warn(`No current price available for ${analysis.symbol}`);
                return;
            }

            // Prepare order
            const orderParams = {
                tradingsymbol: analysis.symbol,
                exchange: 'NSE',
                transaction_type: analysis.recommendation === 'HOLD' ? 'BUY' : analysis.recommendation,
                quantity: quantity,
                product: 'CNC',
                order_type: 'MARKET'
            };

            let order;

            if (this.config.execution.enableRealTrading && !this.config.execution.paperTrading) {
                // Place real order
                order = await this.kite.placeOrder('regular', orderParams);
            } else {
                // Paper trading - simulate order
                order = {
                    order_id: `PAPER_${Date.now()}`,
                    status: 'COMPLETE'
                };
            }

            // Record execution
            const execution = {
                timestamp: new Date(),
                symbol: analysis.symbol,
                action: analysis.recommendation,
                quantity,
                price: currentPrice,
                orderId: order.order_id,
                analysis: analysis,
                confidence: analysis.confidence
            };

            this.executionHistory.push(execution);

            // Update position tracking
            this.currentPositions.set(analysis.symbol, {
                orderId: order.order_id,
                symbol: analysis.symbol,
                side: analysis.recommendation === 'BUY' ? 'LONG' : 'SHORT',
                quantity,
                entryPrice: currentPrice,
                timestamp: new Date(),
                analysis
            });

            // Send notifications
            if (this.config.telegram.notifications.tradeExecutions) {
                await this.telegramService.sendTradeExecution({
                    symbol: analysis.symbol,
                    action: analysis.recommendation === 'HOLD' ? 'BUY' : analysis.recommendation,
                    quantity,
                    price: currentPrice,
                    orderId: order.order_id,
                    status: 'SUCCESS'
                });
            }

            logger.info(`Trade executed: ${analysis.recommendation} ${quantity} ${analysis.symbol} at ${currentPrice}`);

        } catch (error) {
            logger.error(`Error executing trade for ${analysis.symbol}:`, error);
            await this.telegramService.sendErrorAlert(error as Error, `Trade Execution - ${analysis.symbol}`);
        }
    }

    /**
     * Monitor existing positions
     */
    private async monitorPositions(): Promise<void> {
        for (const [symbol, position] of this.currentPositions) {
            try {
                const currentPrice = this.getCurrentPrice(symbol);

                if (!currentPrice) continue;

                // Check exit conditions
                const shouldExit = await this.shouldExitPosition(position, currentPrice);

                if (shouldExit) {
                    await this.exitPosition(position, currentPrice);
                }

                // Update P&L
                const pnl = this.calculatePnL(position, currentPrice);
                position.currentPnL = pnl;

            } catch (error) {
                logger.error(`Error monitoring position ${symbol}:`, error);
            }
        }
    }

    /**
     * Check if position should be exited
     */
    private async shouldExitPosition(position: any, currentPrice: number): Promise<boolean> {
        // Check stop loss
        const stopLoss = position.entryPrice * (1 - this.config.maxRiskPerTrade);
        if (position.side === 'LONG' && currentPrice <= stopLoss) {
            return true;
        }
        if (position.side === 'SHORT' && currentPrice >= stopLoss) {
            return true;
        }

        // Check take profit
        const takeProfit = position.entryPrice * (1 + this.config.maxRiskPerTrade);
        if (position.side === 'LONG' && currentPrice >= takeProfit) {
            return true;
        }
        if (position.side === 'SHORT' && currentPrice <= takeProfit) {
            return true;
        }

        // Check strategy exit conditions
        const analysis = this.marketAnalysis.get(position.symbol);
        if (analysis) {
            const signalReversal = position.side === 'LONG' && analysis.recommendation === 'SELL';
            const signalReversalShort = position.side === 'SHORT' && analysis.recommendation === 'BUY';

            if ((signalReversal || signalReversalShort) && analysis.confidence > 0.7) {
                return true;
            }
        }

        return false;
    }

    /**
     * Exit a position
     */
    private async exitPosition(position: any, currentPrice: number): Promise<void> {
        try {
            const exitAction = position.side === 'LONG' ? 'SELL' : 'BUY';

            const orderParams = {
                tradingsymbol: position.symbol,
                exchange: 'NSE',
                transaction_type: exitAction,
                quantity: position.quantity,
                product: 'CNC',
                order_type: 'MARKET'
            };

            let order;

            if (this.config.execution.enableRealTrading && !this.config.execution.paperTrading) {
                order = await this.kite.placeOrder('regular', orderParams);
            } else {
                order = {
                    order_id: `PAPER_EXIT_${Date.now()}`,
                    status: 'COMPLETE'
                };
            }

            // Calculate P&L
            const pnl = this.calculatePnL(position, currentPrice);

            // Update tracking
            this.totalPnL += pnl;
            this.dailyPnL += pnl;
            this.totalTrades++;

            if (pnl > 0) {
                this.winningTrades++;
            } else {
                this.losingTrades++;
            }

            // Remove position
            this.currentPositions.delete(position.symbol);

            // Send notification
            if (this.config.telegram.notifications.positionUpdates) {
                await this.telegramService.sendPositionUpdate([{
                    symbol: position.symbol,
                    side: position.side,
                    quantity: position.quantity,
                    entryPrice: position.entryPrice,
                    currentPrice: currentPrice,
                    unrealizedPnL: pnl,
                    unrealizedPnLPercent: (pnl / (position.entryPrice * position.quantity)) * 100
                }]);
            }

            logger.info(`Position exited: ${position.symbol} P&L: ₹${pnl.toFixed(2)}`);

        } catch (error) {
            logger.error(`Error exiting position ${position.symbol}:`, error);
            await this.telegramService.sendErrorAlert(error as Error, `Position Exit - ${position.symbol}`);
        }
    }

    // Helper methods
    private calculateTechnicalIndicators(marketData: MarketData[]): any {
        // Filter out null values and implement technical indicators calculation
        const prices = marketData.map(d => d.close).filter((price): price is number => price !== null && price !== undefined);
        const volumes = marketData.map(d => d.volume || 0);

        return {
            sma: this.calculateSMA(prices, 20),
            ema: this.calculateEMA(prices, 12),
            rsi: this.calculateRSI(prices, 14),
            macd: this.calculateMACD(prices)
        };
    }

    private determineTrend(technicalAnalysis: any): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
        const { sma, ema, rsi, macd } = technicalAnalysis;

        let bullishSignals = 0;
        let bearishSignals = 0;

        if (ema > sma) bullishSignals++;
        else bearishSignals++;

        if (rsi > 50) bullishSignals++;
        else bearishSignals++;

        if (macd > 0) bullishSignals++;
        else bearishSignals++;

        if (bullishSignals > bearishSignals) return 'BULLISH';
        if (bearishSignals > bullishSignals) return 'BEARISH';
        return 'NEUTRAL';
    }

    private calculateTrendStrength(technicalAnalysis: any): number {
        // Simplified trend strength calculation
        return Math.random(); // Replace with actual calculation
    }

    private calculateSupportResistance(marketData: MarketData[]): { support: number; resistance: number } {
        const prices = marketData.map(d => d.close).filter((price): price is number => price !== null && price !== undefined);
        if (prices.length === 0) {
            return { support: 0, resistance: 0 };
        }

        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const current = prices[prices.length - 1];

        return {
            support: min * 0.98,
            resistance: max * 1.02
        };
    }

    private calculateVolatility(marketData: MarketData[]): number {
        const returns = [];
        for (let i = 1; i < marketData.length; i++) {
            const currentData = marketData[i];
            const previousData = marketData[i - 1];

            if (currentData && previousData) {
                const currentClose = currentData.close;
                const previousClose = previousData.close;

                if (currentClose !== null && previousClose !== null && previousClose !== 0) {
                    returns.push((currentClose - previousClose) / previousClose);
                }
            }
        }

        if (returns.length === 0) return 0;

        const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;

        return Math.sqrt(variance);
    }

    private analyzeVolume(marketData: MarketData[]): number {
        const volumes = marketData.map(d => d.volume || 0);
        const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
        const currentVolume = volumes[volumes.length - 1];

        if (currentVolume === undefined || avgVolume === 0) return 1;
        return currentVolume / avgVolume;
    }

    private generateRecommendation(
        signals: any[],
        trend: string,
        strength: number,
        volatility: number,
        volume: number
    ): { recommendation: 'BUY' | 'SELL' | 'HOLD'; confidence: number } {
        // Simplified recommendation logic
        const buySignals = signals.filter(s => s.action === 'BUY').length;
        const sellSignals = signals.filter(s => s.action === 'SELL').length;

        let recommendation: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let confidence = 0;

        if (buySignals > sellSignals && trend === 'BULLISH' && strength > 0.6) {
            recommendation = 'BUY';
            confidence = Math.min(0.9, strength * 0.8 + (buySignals / signals.length) * 0.2);
        } else if (sellSignals > buySignals && trend === 'BEARISH' && strength > 0.6) {
            recommendation = 'SELL';
            confidence = Math.min(0.9, strength * 0.8 + (sellSignals / signals.length) * 0.2);
        }

        return { recommendation, confidence };
    }

    private calculateRiskScore(volatility: number, volume: number, signals: any[]): number {
        // Simplified risk score calculation
        const volatilityRisk = Math.min(100, volatility * 1000);
        const volumeRisk = volume < 0.5 ? 50 : 20;
        const signalRisk = signals.length === 0 ? 80 : 30;

        return (volatilityRisk + volumeRisk + signalRisk) / 3;
    }

    private checkMarketConditions(analysis: MarketAnalysis): boolean {
        return analysis.volatility < this.config.marketConditions.volatilityThreshold &&
            analysis.volume > this.config.marketConditions.volumeThreshold &&
            analysis.strength > this.config.marketConditions.trendStrengthThreshold;
    }

    private calculateOptimalPositionSize(analysis: MarketAnalysis): number {
        const riskAmount = this.config.capital * this.config.maxRiskPerTrade;
        const currentPrice = this.getCurrentPrice(analysis.symbol);

        if (!currentPrice) return 0;

        // Use Kelly Criterion or similar for position sizing
        const kellyFraction = (analysis.confidence * 2 - 1) * 0.5; // Simplified Kelly
        const positionValue = this.config.capital * kellyFraction;

        return Math.floor(positionValue / currentPrice);
    }

    private getCurrentPrice(symbol: string): number | null {
        // In real implementation, get from market data
        return 18000 + Math.random() * 1000; // Mock price
    }

    private calculatePnL(position: any, currentPrice: number): number {
        if (position.side === 'LONG') {
            return (currentPrice - position.entryPrice) * position.quantity;
        } else {
            return (position.entryPrice - currentPrice) * position.quantity;
        }
    }

    // Technical indicator calculations
    private calculateSMA(prices: number[], period: number): number {
        if (prices.length < period) {
            const lastPrice = prices[prices.length - 1];
            return lastPrice !== undefined ? lastPrice : 0;
        }
        const sum = prices.slice(-period).reduce((a, b) => a + (b || 0), 0);
        return sum / period;
    }

    private calculateEMA(prices: number[], period: number): number {
        if (prices.length < period) {
            const lastPrice = prices[prices.length - 1];
            return lastPrice !== undefined ? lastPrice : 0;
        }
        const multiplier = 2 / (period + 1);
        let ema = prices[0] || 0;
        for (let i = 1; i < prices.length; i++) {
            const price = prices[i] || 0;
            ema = (price * multiplier) + (ema * (1 - multiplier));
        }
        return ema;
    }

    private calculateRSI(prices: number[], period: number): number {
        if (prices.length < period + 1) return 50;

        let gains = 0;
        let losses = 0;

        for (let i = 1; i <= period; i++) {
            const currentPrice = prices[prices.length - i];
            const previousPrice = prices[prices.length - i - 1];

            if (currentPrice !== undefined && previousPrice !== undefined) {
                const change = currentPrice - previousPrice;
                if (change > 0) gains += change;
                else losses -= change;
            }
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    private calculateMACD(prices: number[]): number {
        const fastEMA = this.calculateEMA(prices, 12);
        const slowEMA = this.calculateEMA(prices, 26);
        return fastEMA - slowEMA;
    }

    // Additional methods for portfolio management
    private async updatePortfolioAnalysis(): Promise<void> {
        // Implementation for portfolio analysis
    }

    private async checkRiskLimits(): Promise<void> {
        // Implementation for risk limit checking
    }

    private async rebalancePortfolio(): Promise<void> {
        // Implementation for portfolio rebalancing
    }

    private async sendPerformanceUpdate(): Promise<void> {
        // Implementation for performance updates
    }

    private async loadCurrentPositions(): Promise<void> {
        // Implementation for loading current positions
    }

    private async closeAllPositions(): Promise<void> {
        // Implementation for closing all positions
    }

    private async getMarketData(): Promise<MarketData[]> {
        // Implementation for getting market data
        return [];
    }

    // Getter methods for status
    getStatus(): any {
        return {
            isRunning: this.isRunning,
            totalPnL: this.totalPnL,
            dailyPnL: this.dailyPnL,
            totalTrades: this.totalTrades,
            winningTrades: this.winningTrades,
            losingTrades: this.losingTrades,
            winRate: this.totalTrades > 0 ? (this.winningTrades / this.totalTrades) * 100 : 0,
            activePositions: this.currentPositions.size,
            marketAnalysis: Object.fromEntries(this.marketAnalysis),
            portfolioAnalysis: this.portfolioAnalysis
        };
    }
} 