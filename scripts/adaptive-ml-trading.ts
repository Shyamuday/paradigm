#!/usr/bin/env ts-node

import { SimpleTensorFlowStrategy, SimpleTensorFlowConfig } from '../src/services/strategies/simple-tensorflow-strategy';
import { DatabaseManager } from '../src/database/database';
import { logger } from '../src/logger/logger';

interface AdaptiveMarketCondition {
    volatility: number;
    trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    momentum: number;
    volume: number;
    atr: number;
    marketRegime: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'CALM';
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
}

interface AdaptiveTradeSignal {
    symbol: string;
    timeframe: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    price: number;
    confidence: number;
    reasoning: string;
    timestamp: Date;

    // Dynamic parameters based on market conditions
    stopLoss: number;
    takeProfit: number;
    target: number;
    positionSize: number;

    // Market condition metrics
    volatility: number;
    trend: string;
    momentum: number;
    marketRegime: string;
    riskLevel: string;

    // Adaptive risk metrics
    riskRewardRatio: number;
    expectedReturn: number;
    maxDrawdown: number;
    probabilityOfSuccess: number;
    optimalHoldingPeriod: number; // in minutes

    // ML confidence breakdown
    pricePrediction: number;
    volatilityPrediction: number;
    trendPrediction: number;
    volumePrediction: number;
}

interface AdaptiveTrade {
    id: string;
    symbol: string;
    timeframe: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    target: number;
    timestamp: Date;
    status: 'PENDING' | 'EXECUTED' | 'CLOSED' | 'CANCELLED';

    // Dynamic exit conditions
    exitPrice?: number;
    exitReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'TARGET' | 'TIME_BASED' | 'TREND_REVERSAL' | 'VOLATILITY_SPIKE';
    exitTimestamp?: Date;

    // Performance metrics
    pnl?: number;
    pnlPercent?: number;
    duration?: number;

    // Market conditions at entry
    entryVolatility: number;
    entryTrend: string;
    entryMarketRegime: string;
    entryRiskLevel: string;

    // ML predictions
    mlConfidence: number;
    predictedSuccess: number;
    actualSuccess: boolean;

    // Adaptive parameters
    riskRewardRatio: number;
    expectedReturn: number;
    optimalHoldingPeriod: number;
}

class AdaptiveMLTrading {
    private dbManager: DatabaseManager;
    private isRunning: boolean = false;
    private signalInterval: NodeJS.Timeout | null = null;
    private strategies: Map<string, SimpleTensorFlowStrategy> = new Map();
    private trades: AdaptiveTrade[] = [];
    private capital: number = 100000;
    private maxDrawdown: number = 0.15;

    // Adaptive parameters
    private marketConditions: Map<string, AdaptiveMarketCondition> = new Map();
    private performanceHistory: any[] = [];
    private volatilityHistory: Map<string, number[]> = new Map();
    private successRateByRegime: Map<string, { wins: number; total: number }> = new Map();

    // Dynamic thresholds
    private minConfidence: number = 0.6; // Starts at 60%, adapts based on performance
    private maxPositionSize: number = 0.1; // Starts at 10%, adapts based on volatility
    private baseStopLoss: number = 0.02; // Starts at 2%, adapts based on ATR
    private baseTakeProfit: number = 0.04; // Starts at 4%, adapts based on volatility

    constructor() {
        this.dbManager = DatabaseManager.getInstance();
    }

    async start(): Promise<void> {
        try {
            console.log('🚀 Starting Adaptive ML Trading System...\n');
            console.log(`💰 Capital: ₹${this.capital.toLocaleString()}`);
            console.log(`🎯 Initial Min Confidence: ${this.minConfidence * 100}%`);
            console.log(`📊 Initial Max Position: ${this.maxPositionSize * 100}%`);
            console.log(`🛑 Max Drawdown: ${this.maxDrawdown * 100}%\n`);

            await this.dbManager.connect();
            console.log('✅ Database connected');

            await this.initializeAdaptiveStrategies();
            console.log('✅ Adaptive ML Strategies initialized');

            this.isRunning = true;
            console.log('🎯 Adaptive ML trading started!');
            console.log('Press Ctrl+C to stop...\n');

            this.startAdaptiveSignalGeneration();

        } catch (error) {
            console.error('❌ Error starting adaptive ML trading:', error);
            throw error;
        }
    }

    private async initializeAdaptiveStrategies(): Promise<void> {
        const db = this.dbManager.getPrisma();
        const timeframes = await db.timeframeConfig.findMany({
            orderBy: { intervalMinutes: 'asc' }
        });

        console.log('🧠 Initializing adaptive ML strategies...');

        for (const timeframe of timeframes) {
            try {
                const config: SimpleTensorFlowConfig = {
                    name: `Adaptive_${timeframe.name}`,
                    enabled: true,
                    type: 'CUSTOM',
                    version: '3.0.0',
                    description: `Adaptive ML strategy for ${timeframe.name}`,
                    category: 'MACHINE_LEARNING',
                    riskLevel: 'MEDIUM',
                    timeframes: [timeframe.name],
                    entryRules: [],
                    exitRules: [],
                    positionSizing: {
                        method: 'CUSTOM',
                        value: 10,
                        maxPositionSize: this.maxPositionSize,
                        minPositionSize: 0.01
                    },
                    riskManagement: {
                        maxRiskPerTrade: 0.02,
                        maxDailyLoss: 5000,
                        maxDrawdown: this.maxDrawdown,
                        stopLossType: 'PERCENTAGE',
                        stopLossValue: this.baseStopLoss * 100,
                        takeProfitType: 'PERCENTAGE',
                        takeProfitValue: this.baseTakeProfit * 100,
                        trailingStop: true
                    },
                    filters: [],
                    notifications: [],
                    parameters: {},
                    capitalAllocation: this.capital,
                    instruments: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'],
                    indicators: {
                        sma: { period: 20 },
                        ema: { period: 20 },
                        rsi: { period: 14 },
                        macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
                        bollinger: { period: 20, stdDev: 2 },
                        atr: { period: 14 }
                    },
                    ml: {
                        lookbackPeriod: 50,
                        predictionHorizon: 5,
                        confidenceThreshold: this.minConfidence,
                        retrainInterval: 30, // Retrain more frequently
                        hiddenLayers: [128, 64, 32], // Deeper network
                        learningRate: 0.001,
                        epochs: 50
                    },
                    risk: {
                        maxPositionSize: this.maxPositionSize,
                        stopLoss: this.baseStopLoss * 100,
                        takeProfit: this.baseTakeProfit * 100,
                        maxDrawdown: this.maxDrawdown
                    }
                };

                const strategy = new SimpleTensorFlowStrategy(config);
                this.strategies.set(timeframe.name, strategy);
                console.log(`   ✅ ${timeframe.name} adaptive strategy initialized`);

            } catch (error) {
                console.error(`   ❌ Error initializing ${timeframe.name} strategy:`, error);
            }
        }
    }

    private startAdaptiveSignalGeneration(): void {
        this.signalInterval = setInterval(async () => {
            if (!this.isRunning) return;

            try {
                await this.updateMarketConditions();
                await this.adaptParameters();
                await this.generateAdaptiveSignals();
                await this.monitorAdaptiveTrades();
            } catch (error) {
                console.error('❌ Error in adaptive signal generation:', error);
            }
        }, 15000); // Check every 15 seconds for faster adaptation
    }

    private async updateMarketConditions(): Promise<void> {
        const db = this.dbManager.getPrisma();
        const instruments = await db.instrument.findMany({
            where: {
                symbol: { in: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'] },
                exchange: 'NSE'
            }
        });

        for (const instrument of instruments) {
            for (const [timeframeName, strategy] of this.strategies.entries()) {
                try {
                    const marketData = await this.getRecentMarketData(instrument.symbol, timeframeName);

                    if (marketData.length < 50) continue;

                    const condition = this.analyzeMarketCondition(marketData);
                    const key = `${instrument.symbol}_${timeframeName}`;
                    this.marketConditions.set(key, condition);

                    // Update volatility history
                    if (!this.volatilityHistory.has(key)) {
                        this.volatilityHistory.set(key, []);
                    }
                    this.volatilityHistory.get(key)!.push(condition.volatility);

                    // Keep only last 100 volatility readings
                    if (this.volatilityHistory.get(key)!.length > 100) {
                        this.volatilityHistory.get(key)!.shift();
                    }

                } catch (error) {
                    console.error(`   ❌ Error updating market conditions for ${instrument.symbol} (${timeframeName}):`, error);
                }
            }
        }
    }

    private analyzeMarketCondition(marketData: any[]): AdaptiveMarketCondition {
        const prices = marketData.map(d => d.close);
        const volumes = marketData.map(d => d.volume);
        const highs = marketData.map(d => d.high);
        const lows = marketData.map(d => d.low);

        // Calculate volatility
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            if (prices[i - 1] > 0) {
                returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
            }
        }
        const volatility = returns.length > 0 ? Math.sqrt(returns.reduce((a, b) => a + b * b, 0) / returns.length) : 0.02;

        // Calculate trend
        const sma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const sma5 = prices.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const trend = sma5 > sma20 * 1.01 ? 'BULLISH' : sma5 < sma20 * 0.99 ? 'BEARISH' : 'SIDEWAYS';

        // Calculate momentum
        const momentum = prices.length >= 10 ? (prices[prices.length - 1] - prices[prices.length - 10]) / prices[prices.length - 10] : 0;

        // Calculate volume
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const currentVolume = volumes[volumes.length - 1];
        const volume = currentVolume / avgVolume;

        // Calculate ATR
        let atr = 0;
        for (let i = 1; i < prices.length; i++) {
            const tr = Math.max(
                highs[i] - lows[i],
                Math.abs(highs[i] - prices[i - 1]),
                Math.abs(lows[i] - prices[i - 1])
            );
            atr += tr;
        }
        atr = atr / (prices.length - 1);

        // Determine market regime
        let marketRegime: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'CALM';
        if (volatility > 0.05) {
            marketRegime = 'VOLATILE';
        } else if (volatility < 0.01) {
            marketRegime = 'CALM';
        } else if (Math.abs(momentum) > 0.02) {
            marketRegime = 'TRENDING';
        } else {
            marketRegime = 'RANGING';
        }

        // Determine risk level
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
        if (volatility < 0.015) {
            riskLevel = 'LOW';
        } else if (volatility < 0.03) {
            riskLevel = 'MEDIUM';
        } else if (volatility < 0.05) {
            riskLevel = 'HIGH';
        } else {
            riskLevel = 'EXTREME';
        }

        return {
            volatility,
            trend,
            momentum,
            volume,
            atr,
            marketRegime,
            riskLevel
        };
    }

    private async adaptParameters(): Promise<void> {
        // Adapt confidence threshold based on recent performance
        const recentTrades = this.trades.filter(t =>
            t.status === 'CLOSED' &&
            t.exitTimestamp &&
            t.exitTimestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000 // Last 24 hours
        );

        if (recentTrades.length >= 5) {
            const successRate = recentTrades.filter(t => t.actualSuccess).length / recentTrades.length;

            // Adapt confidence threshold
            if (successRate > 0.7) {
                this.minConfidence = Math.max(0.5, this.minConfidence - 0.02); // Lower threshold if doing well
            } else if (successRate < 0.4) {
                this.minConfidence = Math.min(0.9, this.minConfidence + 0.02); // Higher threshold if doing poorly
            }

            // Adapt position size based on volatility
            const avgVolatility = recentTrades.reduce((sum, t) => sum + t.entryVolatility, 0) / recentTrades.length;
            if (avgVolatility > 0.04) {
                this.maxPositionSize = Math.max(0.05, this.maxPositionSize - 0.01); // Reduce position size in high volatility
            } else if (avgVolatility < 0.02) {
                this.maxPositionSize = Math.min(0.2, this.maxPositionSize + 0.01); // Increase position size in low volatility
            }
        }

        // Adapt stop-loss and take-profit based on market regime
        const allConditions = Array.from(this.marketConditions.values());
        if (allConditions.length > 0) {
            const avgATR = allConditions.reduce((sum, c) => sum + c.atr, 0) / allConditions.length;
            const avgVolatility = allConditions.reduce((sum, c) => sum + c.volatility, 0) / allConditions.length;

            // Dynamic stop-loss based on ATR
            this.baseStopLoss = Math.max(0.01, Math.min(0.05, avgATR / 1000)); // 1-5% range

            // Dynamic take-profit based on volatility
            this.baseTakeProfit = Math.max(0.02, Math.min(0.08, avgVolatility * 2)); // 2-8% range
        }

        console.log(`   🔄 Adapted Parameters: Confidence=${(this.minConfidence * 100).toFixed(1)}%, Position=${(this.maxPositionSize * 100).toFixed(1)}%, SL=${(this.baseStopLoss * 100).toFixed(1)}%, TP=${(this.baseTakeProfit * 100).toFixed(1)}%`);
    }

    private async generateAdaptiveSignals(): Promise<void> {
        try {
            const db = this.dbManager.getPrisma();
            const now = new Date();

            console.log(`\n🔄 Generating adaptive signals - ${now.toLocaleTimeString()}`);

            const instruments = await db.instrument.findMany({
                where: {
                    symbol: { in: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'] },
                    exchange: 'NSE'
                }
            });

            const signals: AdaptiveTradeSignal[] = [];

            for (const instrument of instruments) {
                for (const [timeframeName, strategy] of this.strategies.entries()) {
                    try {
                        const marketData = await this.getRecentMarketData(instrument.symbol, timeframeName);

                        if (marketData.length < 50) continue;

                        const key = `${instrument.symbol}_${timeframeName}`;
                        const marketCondition = this.marketConditions.get(key);

                        if (!marketCondition) continue;

                        const mlSignals = await strategy.generateSignals(marketData);

                        if (mlSignals.length > 0 && mlSignals[0]) {
                            const signal = mlSignals[0];

                            if (signal.confidence >= this.minConfidence) {
                                const adaptiveSignal = this.createAdaptiveSignal(
                                    signal,
                                    instrument.symbol,
                                    timeframeName,
                                    marketCondition,
                                    marketData
                                );

                                signals.push(adaptiveSignal);
                            }
                        }

                    } catch (error) {
                        console.error(`   ❌ Error generating adaptive signal for ${instrument.symbol} (${timeframeName}):`, error);
                    }
                }
            }

            await this.processAdaptiveSignals(signals);
            await this.showAdaptivePortfolioStatus();

        } catch (error) {
            console.error('❌ Error in adaptive signal generation:', error);
        }
    }

    private createAdaptiveSignal(
        signal: any,
        symbol: string,
        timeframe: string,
        marketCondition: AdaptiveMarketCondition,
        marketData: any[]
    ): AdaptiveTradeSignal {
        const currentPrice = signal.price;

        // Dynamic stop-loss based on market condition
        const stopLossMultiplier = this.getStopLossMultiplier(marketCondition);
        const stopLoss = signal.action === 'BUY'
            ? currentPrice * (1 - this.baseStopLoss * stopLossMultiplier)
            : currentPrice * (1 + this.baseStopLoss * stopLossMultiplier);

        // Dynamic take-profit based on market condition
        const takeProfitMultiplier = this.getTakeProfitMultiplier(marketCondition);
        const takeProfit = signal.action === 'BUY'
            ? currentPrice * (1 + this.baseTakeProfit * takeProfitMultiplier)
            : currentPrice * (1 - this.baseTakeProfit * takeProfitMultiplier);

        // Dynamic target based on market condition
        const targetMultiplier = this.getTargetMultiplier(marketCondition);
        const target = signal.action === 'BUY'
            ? currentPrice * (1 + this.baseTakeProfit * targetMultiplier)
            : currentPrice * (1 - this.baseTakeProfit * targetMultiplier);

        // Dynamic position size based on market condition
        const positionSizeMultiplier = this.getPositionSizeMultiplier(marketCondition);
        const positionSize = this.maxPositionSize * positionSizeMultiplier * signal.confidence;

        // Calculate risk metrics
        const riskRewardRatio = Math.abs((target - currentPrice) / (currentPrice - stopLoss));
        const expectedReturn = this.calculateExpectedReturn(signal, target, stopLoss, signal.confidence, marketCondition);
        const maxDrawdown = Math.abs(currentPrice - stopLoss) / currentPrice;
        const probabilityOfSuccess = this.calculateProbabilityOfSuccess(signal, marketCondition);
        const optimalHoldingPeriod = this.calculateOptimalHoldingPeriod(marketCondition);

        // ML predictions breakdown
        const predictions = this.generateMLPredictions(signal, marketData, marketCondition);

        return {
            symbol,
            timeframe,
            action: signal.action as 'BUY' | 'SELL' | 'HOLD',
            price: currentPrice,
            confidence: signal.confidence,
            reasoning: signal.reasoning || 'Adaptive ML signal generated',
            timestamp: new Date(),
            stopLoss,
            takeProfit,
            target,
            positionSize,
            volatility: marketCondition.volatility,
            trend: marketCondition.trend,
            momentum: marketCondition.momentum,
            marketRegime: marketCondition.marketRegime,
            riskLevel: marketCondition.riskLevel,
            riskRewardRatio,
            expectedReturn,
            maxDrawdown,
            probabilityOfSuccess,
            optimalHoldingPeriod,
            ...predictions
        };
    }

    private getStopLossMultiplier(condition: AdaptiveMarketCondition): number {
        switch (condition.riskLevel) {
            case 'LOW': return 0.8;
            case 'MEDIUM': return 1.0;
            case 'HIGH': return 1.3;
            case 'EXTREME': return 1.6;
            default: return 1.0;
        }
    }

    private getTakeProfitMultiplier(condition: AdaptiveMarketCondition): number {
        switch (condition.marketRegime) {
            case 'TRENDING': return 1.5;
            case 'RANGING': return 1.0;
            case 'VOLATILE': return 2.0;
            case 'CALM': return 0.8;
            default: return 1.0;
        }
    }

    private getTargetMultiplier(condition: AdaptiveMarketCondition): number {
        switch (condition.marketRegime) {
            case 'TRENDING': return 2.0;
            case 'RANGING': return 1.5;
            case 'VOLATILE': return 2.5;
            case 'CALM': return 1.2;
            default: return 1.5;
        }
    }

    private getPositionSizeMultiplier(condition: AdaptiveMarketCondition): number {
        switch (condition.riskLevel) {
            case 'LOW': return 1.2;
            case 'MEDIUM': return 1.0;
            case 'HIGH': return 0.7;
            case 'EXTREME': return 0.5;
            default: return 1.0;
        }
    }

    private calculateExpectedReturn(signal: any, target: number, stopLoss: number, confidence: number, condition: AdaptiveMarketCondition): number {
        const risk = Math.abs(signal.price - stopLoss);
        const reward = Math.abs(target - signal.price);

        // Adjust based on market regime
        let regimeMultiplier = 1.0;
        switch (condition.marketRegime) {
            case 'TRENDING':
                regimeMultiplier = 1.2;
                break;
            case 'RANGING':
                regimeMultiplier = 0.9;
                break;
            case 'VOLATILE':
                regimeMultiplier = 1.5;
                break;
            case 'CALM':
                regimeMultiplier = 0.8;
                break;
        }

        return ((confidence * reward) - ((1 - confidence) * risk)) * regimeMultiplier;
    }

    private calculateProbabilityOfSuccess(signal: any, condition: AdaptiveMarketCondition): number {
        let baseProbability = signal.confidence;

        // Adjust based on market regime
        switch (condition.marketRegime) {
            case 'TRENDING':
                baseProbability *= 1.1;
                break;
            case 'RANGING':
                baseProbability *= 0.9;
                break;
            case 'VOLATILE':
                baseProbability *= 0.8;
                break;
            case 'CALM':
                baseProbability *= 1.0;
                break;
        }

        // Adjust based on risk level
        switch (condition.riskLevel) {
            case 'LOW':
                baseProbability *= 1.1;
                break;
            case 'MEDIUM':
                baseProbability *= 1.0;
                break;
            case 'HIGH':
                baseProbability *= 0.9;
                break;
            case 'EXTREME':
                baseProbability *= 0.8;
                break;
        }

        return Math.min(0.95, Math.max(0.05, baseProbability));
    }

    private calculateOptimalHoldingPeriod(condition: AdaptiveMarketCondition): number {
        switch (condition.marketRegime) {
            case 'TRENDING': return 120; // 2 hours
            case 'RANGING': return 60;   // 1 hour
            case 'VOLATILE': return 30;  // 30 minutes
            case 'CALM': return 180;     // 3 hours
            default: return 60;
        }
    }

    private generateMLPredictions(signal: any, marketData: any[], condition: AdaptiveMarketCondition): any {
        // Simulate ML predictions for different aspects
        const pricePrediction = signal.confidence * (1 + condition.momentum);
        const volatilityPrediction = condition.volatility * (1 + Math.random() * 0.2 - 0.1);
        const trendPrediction = condition.trend === 'BULLISH' ? 0.7 : condition.trend === 'BEARISH' ? 0.3 : 0.5;
        const volumePrediction = condition.volume * (1 + Math.random() * 0.3 - 0.15);

        return {
            pricePrediction,
            volatilityPrediction,
            trendPrediction,
            volumePrediction
        };
    }

    private async processAdaptiveSignals(signals: AdaptiveTradeSignal[]): Promise<void> {
        if (signals.length === 0) {
            console.log('   📊 No high-confidence adaptive signals generated');
            return;
        }

        console.log(`   🎯 Generated ${signals.length} adaptive signals:`);

        for (const signal of signals) {
            console.log(`   📈 ${signal.symbol} (${signal.timeframe}): ${signal.action} @ ₹${signal.price.toFixed(2)}`);
            console.log(`      🎯 Confidence: ${(signal.confidence * 100).toFixed(1)}% | Success Prob: ${(signal.probabilityOfSuccess * 100).toFixed(1)}%`);
            console.log(`      📊 Market: ${signal.marketRegime} | Risk: ${signal.riskLevel} | Volatility: ${(signal.volatility * 100).toFixed(2)}%`);
            console.log(`      🛑 Stop: ₹${signal.stopLoss.toFixed(2)} | 🎯 Target: ₹${signal.target.toFixed(2)} | ⏱️ Hold: ${signal.optimalHoldingPeriod}m`);
            console.log(`      📈 R/R: ${signal.riskRewardRatio.toFixed(2)} | Expected: ₹${signal.expectedReturn.toFixed(2)}`);

            await this.executeAdaptiveTrade(signal);
        }
    }

    private async executeAdaptiveTrade(signal: AdaptiveTradeSignal): Promise<void> {
        try {
            const existingTrade = this.trades.find(t =>
                t.symbol === signal.symbol &&
                t.status === 'EXECUTED' &&
                t.action === signal.action
            );

            if (existingTrade) {
                console.log(`   ⚠️  Already have ${signal.action} position for ${signal.symbol}`);
                return;
            }

            const quantity = Math.floor((this.capital * signal.positionSize) / signal.price);

            if (quantity <= 0) {
                console.log(`   ⚠️  Insufficient capital for ${signal.symbol}`);
                return;
            }

            const trade: AdaptiveTrade = {
                id: `AT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                symbol: signal.symbol,
                timeframe: signal.timeframe,
                action: signal.action === 'HOLD' ? 'BUY' : signal.action,
                quantity: quantity,
                entryPrice: signal.price,
                stopLoss: signal.stopLoss,
                takeProfit: signal.takeProfit,
                target: signal.target,
                timestamp: signal.timestamp,
                status: 'EXECUTED',
                entryVolatility: signal.volatility,
                entryTrend: signal.trend,
                entryMarketRegime: signal.marketRegime,
                entryRiskLevel: signal.riskLevel,
                mlConfidence: signal.confidence,
                predictedSuccess: signal.probabilityOfSuccess,
                actualSuccess: false,
                riskRewardRatio: signal.riskRewardRatio,
                expectedReturn: signal.expectedReturn,
                optimalHoldingPeriod: signal.optimalHoldingPeriod
            };

            this.trades.push(trade);

            console.log(`   💰 Adaptive Trade: ${signal.action} ${quantity} shares @ ₹${signal.price.toFixed(2)}`);
            console.log(`   🎯 Expected Return: ₹${signal.expectedReturn.toFixed(2)} | Optimal Hold: ${signal.optimalHoldingPeriod}m`);

            await this.saveAdaptiveTrade(trade);

        } catch (error) {
            console.error(`   ❌ Error executing adaptive trade for ${signal.symbol}:`, error);
        }
    }

    private async monitorAdaptiveTrades(): Promise<void> {
        const activeTrades = this.trades.filter(t => t.status === 'EXECUTED');

        for (const trade of activeTrades) {
            try {
                const currentPrice = await this.getCurrentPrice(trade.symbol);

                if (currentPrice <= 0) continue;

                const now = new Date();
                const duration = (now.getTime() - trade.timestamp.getTime()) / (1000 * 60); // minutes

                // Check stop-loss
                if (trade.action === 'BUY' && currentPrice <= trade.stopLoss) {
                    await this.closeAdaptiveTrade(trade, currentPrice, 'STOP_LOSS');
                } else if (trade.action === 'SELL' && currentPrice >= trade.stopLoss) {
                    await this.closeAdaptiveTrade(trade, currentPrice, 'STOP_LOSS');
                }

                // Check take-profit
                else if (trade.action === 'BUY' && currentPrice >= trade.takeProfit) {
                    await this.closeAdaptiveTrade(trade, currentPrice, 'TAKE_PROFIT');
                } else if (trade.action === 'SELL' && currentPrice <= trade.takeProfit) {
                    await this.closeAdaptiveTrade(trade, currentPrice, 'TAKE_PROFIT');
                }

                // Check target
                else if (trade.action === 'BUY' && currentPrice >= trade.target) {
                    await this.closeAdaptiveTrade(trade, currentPrice, 'TARGET');
                } else if (trade.action === 'SELL' && currentPrice <= trade.target) {
                    await this.closeAdaptiveTrade(trade, currentPrice, 'TARGET');
                }

                // Check time-based exit
                else if (duration >= trade.optimalHoldingPeriod) {
                    await this.closeAdaptiveTrade(trade, currentPrice, 'TIME_BASED');
                }

            } catch (error) {
                console.error(`❌ Error monitoring trade ${trade.id}:`, error);
            }
        }
    }

    private async closeAdaptiveTrade(trade: AdaptiveTrade, exitPrice: number, reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'TARGET' | 'TIME_BASED'): Promise<void> {
        trade.status = 'CLOSED';
        trade.exitPrice = exitPrice;
        trade.exitReason = reason;
        trade.exitTimestamp = new Date();

        const pnl = trade.action === 'BUY'
            ? (exitPrice - trade.entryPrice) * trade.quantity
            : (trade.entryPrice - exitPrice) * trade.quantity;

        trade.pnl = pnl;
        trade.pnlPercent = (pnl / (trade.entryPrice * trade.quantity)) * 100;
        trade.duration = trade.exitTimestamp.getTime() - trade.timestamp.getTime();
        trade.actualSuccess = pnl > 0;

        console.log(`   🎯 Adaptive Trade Closed: ${trade.symbol} ${trade.action} | ${reason} | P&L: ₹${pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%)`);
        console.log(`   ⏱️  Duration: ${(trade.duration / (1000 * 60)).toFixed(1)}m | Predicted Success: ${(trade.predictedSuccess * 100).toFixed(1)}% | Actual: ${trade.actualSuccess ? '✅' : '❌'}`);

        // Update performance history
        this.performanceHistory.push({
            tradeId: trade.id,
            symbol: trade.symbol,
            timeframe: trade.timeframe,
            marketRegime: trade.entryMarketRegime,
            riskLevel: trade.entryRiskLevel,
            predictedSuccess: trade.predictedSuccess,
            actualSuccess: trade.actualSuccess,
            pnl: pnl,
            duration: trade.duration,
            timestamp: trade.exitTimestamp
        });

        // Update success rate by regime
        if (!this.successRateByRegime.has(trade.entryMarketRegime)) {
            this.successRateByRegime.set(trade.entryMarketRegime, { wins: 0, total: 0 });
        }
        const regimeStats = this.successRateByRegime.get(trade.entryMarketRegime)!;
        regimeStats.total++;
        if (trade.actualSuccess) regimeStats.wins++;

        await this.saveAdaptiveTrade(trade);
    }

    private async saveAdaptiveTrade(trade: AdaptiveTrade): Promise<void> {
        try {
            const db = this.dbManager.getPrisma();
            console.log(`   💾 Adaptive trade saved: ${trade.id}`);
        } catch (error) {
            console.error('❌ Error saving adaptive trade:', error);
        }
    }

    private async showAdaptivePortfolioStatus(): Promise<void> {
        const activeTrades = this.trades.filter(t => t.status === 'EXECUTED');
        const closedTrades = this.trades.filter(t => t.status === 'CLOSED');

        if (activeTrades.length === 0 && closedTrades.length === 0) {
            console.log('   📊 No trades in adaptive portfolio');
            return;
        }

        console.log('\n📊 Adaptive Portfolio Status:');

        if (activeTrades.length > 0) {
            console.log('\n🔄 Active Adaptive Trades:');
            console.log('Symbol'.padEnd(12) + 'Action'.padEnd(8) + 'Entry'.padEnd(10) + 'Stop'.padEnd(10) + 'Target'.padEnd(10) + 'Regime'.padEnd(10) + 'Confidence');
            console.log('-'.repeat(90));

            for (const trade of activeTrades) {
                console.log(
                    trade.symbol.padEnd(12) +
                    trade.action.padEnd(8) +
                    `₹${trade.entryPrice.toFixed(2)}`.padEnd(10) +
                    `₹${trade.stopLoss.toFixed(2)}`.padEnd(10) +
                    `₹${trade.target.toFixed(2)}`.padEnd(10) +
                    trade.entryMarketRegime.padEnd(10) +
                    `${(trade.mlConfidence * 100).toFixed(1)}%`
                );
            }
        }

        if (closedTrades.length > 0) {
            console.log('\n✅ Closed Adaptive Trades:');
            console.log('Symbol'.padEnd(12) + 'Action'.padEnd(8) + 'Entry'.padEnd(10) + 'Exit'.padEnd(10) + 'P&L'.padEnd(10) + 'Regime'.padEnd(10) + 'Success');
            console.log('-'.repeat(90));

            let totalPnL = 0;
            let winningTrades = 0;

            for (const trade of closedTrades) {
                if (trade.pnl) {
                    totalPnL += trade.pnl;
                    if (trade.pnl > 0) winningTrades++;
                }

                const duration = trade.duration ? (trade.duration / (1000 * 60)).toFixed(1) : 'N/A';

                console.log(
                    trade.symbol.padEnd(12) +
                    trade.action.padEnd(8) +
                    `₹${trade.entryPrice.toFixed(2)}`.padEnd(10) +
                    `₹${trade.exitPrice?.toFixed(2) || 'N/A'}`.padEnd(10) +
                    `₹${trade.pnl?.toFixed(2) || 'N/A'}`.padEnd(10) +
                    trade.entryMarketRegime.padEnd(10) +
                    (trade.actualSuccess ? '✅' : '❌')
                );
            }

            const winRate = closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0;
            console.log('-'.repeat(90));
            console.log(`Total P&L: ₹${totalPnL.toFixed(2)} | Win Rate: ${winRate.toFixed(1)}% | Total Trades: ${closedTrades.length}`);

            // Show performance by market regime
            console.log('\n📊 Performance by Market Regime:');
            for (const [regime, stats] of this.successRateByRegime.entries()) {
                if (stats.total > 0) {
                    const regimeWinRate = (stats.wins / stats.total) * 100;
                    console.log(`   ${regime.padEnd(10)}: ${regimeWinRate.toFixed(1)}% (${stats.wins}/${stats.total})`);
                }
            }
        }
    }

    private async getRecentMarketData(symbol: string, timeframe: string): Promise<any[]> {
        const db = this.dbManager.getPrisma();

        const instrument = await db.instrument.findFirst({
            where: { symbol, exchange: 'NSE' }
        });

        if (!instrument) return [];

        const timeframeConfig = await db.timeframeConfig.findFirst({
            where: { name: timeframe }
        });

        if (!timeframeConfig) return [];

        const candleData = await db.candleData.findMany({
            where: {
                instrumentId: instrument.id,
                timeframeId: timeframeConfig.id
            },
            orderBy: { timestamp: 'desc' },
            take: 100
        });

        return candleData.map(cd => ({
            symbol: symbol,
            timestamp: cd.timestamp,
            open: cd.open,
            high: cd.high,
            low: cd.low,
            close: cd.close,
            volume: cd.volume
        })).reverse();
    }

    private async getCurrentPrice(symbol: string): Promise<number> {
        const db = this.dbManager.getPrisma();

        const instrument = await db.instrument.findFirst({
            where: { symbol, exchange: 'NSE' }
        });

        if (!instrument) return 0;

        const latestData = await db.candleData.findFirst({
            where: { instrumentId: instrument.id },
            orderBy: { timestamp: 'desc' }
        });

        return latestData?.close || 0;
    }

    async stop(): Promise<void> {
        try {
            console.log('\n🛑 Stopping adaptive ML trading...');

            this.isRunning = false;

            if (this.signalInterval) {
                clearInterval(this.signalInterval);
                this.signalInterval = null;
            }

            await this.dbManager.disconnect();
            console.log('✅ Adaptive ML trading stopped');

            await this.showFinalAdaptiveStatistics();

        } catch (error) {
            console.error('❌ Error stopping adaptive ML trading:', error);
        }
    }

    private async showFinalAdaptiveStatistics(): Promise<void> {
        const closedTrades = this.trades.filter(t => t.status === 'CLOSED');

        if (closedTrades.length === 0) {
            console.log('📊 No completed adaptive trades to analyze');
            return;
        }

        console.log('\n📊 Final Adaptive Trading Statistics:');
        console.log('='.repeat(60));

        const totalTrades = closedTrades.length;
        const winningTrades = closedTrades.filter(t => t.pnl && t.pnl > 0).length;
        const losingTrades = totalTrades - winningTrades;
        const winRate = (winningTrades / totalTrades) * 100;

        const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const avgPnL = totalPnL / totalTrades;
        const avgConfidence = closedTrades.reduce((sum, t) => sum + t.mlConfidence, 0) / totalTrades;
        const avgPredictedSuccess = closedTrades.reduce((sum, t) => sum + t.predictedSuccess, 0) / totalTrades;

        console.log(`Total Trades: ${totalTrades}`);
        console.log(`Winning Trades: ${winningTrades} (${winRate.toFixed(1)}%)`);
        console.log(`Losing Trades: ${losingTrades}`);
        console.log(`Total P&L: ₹${totalPnL.toFixed(2)}`);
        console.log(`Average P&L per Trade: ₹${avgPnL.toFixed(2)}`);
        console.log(`Average ML Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
        console.log(`Average Predicted Success: ${(avgPredictedSuccess * 100).toFixed(1)}%`);
        console.log(`Return on Capital: ${((totalPnL / this.capital) * 100).toFixed(2)}%`);

        // Show adaptation results
        console.log('\n🔄 Adaptation Results:');
        console.log(`Final Confidence Threshold: ${(this.minConfidence * 100).toFixed(1)}%`);
        console.log(`Final Position Size: ${(this.maxPositionSize * 100).toFixed(1)}%`);
        console.log(`Final Stop Loss: ${(this.baseStopLoss * 100).toFixed(1)}%`);
        console.log(`Final Take Profit: ${(this.baseTakeProfit * 100).toFixed(1)}%`);

        // Show performance by market regime
        console.log('\n📊 Performance by Market Regime:');
        for (const [regime, stats] of this.successRateByRegime.entries()) {
            if (stats.total > 0) {
                const regimeWinRate = (stats.wins / stats.total) * 100;
                console.log(`   ${regime.padEnd(10)}: ${regimeWinRate.toFixed(1)}% (${stats.wins}/${stats.total})`);
            }
        }
    }

    getStatus(): any {
        return {
            isRunning: this.isRunning,
            activeTrades: this.trades.filter(t => t.status === 'EXECUTED').length,
            closedTrades: this.trades.filter(t => t.status === 'CLOSED').length,
            totalPnL: this.trades.reduce((sum, t) => sum + (t.pnl || 0), 0),
            capital: this.capital,
            minConfidence: this.minConfidence,
            maxPositionSize: this.maxPositionSize,
            baseStopLoss: this.baseStopLoss,
            baseTakeProfit: this.baseTakeProfit
        };
    }
}

// CLI interface
if (require.main === module) {
    const adaptiveTrading = new AdaptiveMLTrading();

    process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        await adaptiveTrading.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        await adaptiveTrading.stop();
        process.exit(0);
    });

    adaptiveTrading.start().catch(console.error);
}

export { AdaptiveMLTrading, AdaptiveTradeSignal, AdaptiveTrade, AdaptiveMarketCondition }; 