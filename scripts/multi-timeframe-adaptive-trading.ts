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
    stopLoss: number;
    takeProfit: number;
    target: number;
    positionSize: number;
    volatility: number;
    trend: string;
    momentum: number;
    marketRegime: string;
    riskLevel: string;
    riskRewardRatio: number;
    expectedReturn: number;
    maxDrawdown: number;
    probabilityOfSuccess: number;
    optimalHoldingPeriod: number;
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
    exitPrice?: number;
    exitReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'TARGET' | 'TIME_BASED' | 'TREND_REVERSAL' | 'VOLATILITY_SPIKE';
    exitTimestamp?: Date;
    pnl?: number;
    pnlPercent?: number;
    duration?: number;
    entryVolatility: number;
    entryTrend: string;
    entryMarketRegime: string;
    entryRiskLevel: string;
    mlConfidence: number;
    predictedSuccess: number;
    actualSuccess: boolean;
    riskRewardRatio: number;
    expectedReturn: number;
    optimalHoldingPeriod: number;
}

class MultiTimeframeAdaptiveMLTrading {
    private dbManager: DatabaseManager;
    private isRunning: boolean = false;
    private signalInterval: NodeJS.Timeout | null = null;
    private strategies: Map<string, SimpleTensorFlowStrategy> = new Map();
    private trades: AdaptiveTrade[] = [];
    private capital: number = 100000;
    private maxDrawdown: number = 0.15;
    private marketConditions: Map<string, AdaptiveMarketCondition> = new Map();
    private performanceHistory: any[] = [];
    private volatilityHistory: Map<string, number[]> = new Map();
    private successRateByRegime: Map<string, { wins: number; total: number }> = new Map();

    // Adaptive parameters
    private minConfidence: number = 0.6;
    private maxPositionSize: number = 0.1;
    private baseStopLoss: number = 0.02;
    private baseTakeProfit: number = 0.04;

    // Multi-timeframe configuration
    private readonly TIMEFRAMES = ['15min', '30min', '1hour']; // Using shorter timeframes
    private readonly SYMBOLS = ['RELIANCE']; // Focus on RELIANCE which has good data
    private readonly TIMEFRAME_WEIGHTS = {
        '15min': 0.4,  // 40% weight for 15min signals
        '30min': 0.35, // 35% weight for 30min signals  
        '1hour': 0.25  // 25% weight for 1hour signals
    };

    constructor() {
        this.dbManager = new DatabaseManager();
    }

    async start(): Promise<void> {
        try {
            console.log('🚀 Starting Multi-Timeframe Adaptive ML Trading...\n');

            await this.dbManager.connect();
            console.log('✅ Database connected');

            await this.initializeMultiTimeframeStrategies();
            console.log('✅ Multi-timeframe strategies initialized');

            this.startAdaptiveSignalGeneration();
            console.log('✅ Signal generation started');

            this.isRunning = true;

            // Show initial status
            await this.showMultiTimeframePortfolioStatus();

        } catch (error) {
            console.error('❌ Failed to start multi-timeframe adaptive trading:', error);
            throw error;
        }
    }

    private async initializeMultiTimeframeStrategies(): Promise<void> {
        console.log('🔧 Initializing multi-timeframe strategies...\n');

        for (const timeframe of this.TIMEFRAMES) {
            for (const symbol of this.SYMBOLS) {
                const strategyName = `MultiTF_${symbol}_${timeframe}`;

                const config: SimpleTensorFlowConfig = {
                    name: strategyName,
                    description: `Multi-timeframe adaptive ML strategy for ${symbol} (${timeframe})`,
                    parameters: {
                        timeframes: [timeframe],
                        lookbackPeriod: 50,
                        predictionHorizon: 5,
                        confidenceThreshold: this.minConfidence,
                        maxPositionSize: this.maxPositionSize,
                        stopLossPercentage: this.baseStopLoss,
                        takeProfitPercentage: this.baseTakeProfit
                    },
                    instruments: [symbol],
                    enabled: true
                };

                try {
                    const strategy = new SimpleTensorFlowStrategy(config);
                    await strategy.initialize();

                    this.strategies.set(strategyName, strategy);
                    console.log(`   ✅ ${strategyName} strategy initialized`);
                } catch (error) {
                    console.error(`   ❌ Error initializing ${strategyName} strategy:`, error);
                }
            }
        }

        console.log(`\n📊 Initialized ${this.strategies.size} multi-timeframe strategies`);
    }

    private startAdaptiveSignalGeneration(): void {
        this.signalInterval = setInterval(async () => {
            if (this.isRunning) {
                await this.updateMultiTimeframeMarketConditions();
                await this.generateMultiTimeframeAdaptiveSignals();
                await this.processMultiTimeframeSignals();
                await this.monitorMultiTimeframeTrades();
                await this.adaptMultiTimeframeParameters();
                await this.showMultiTimeframePortfolioStatus();
            }
        }, 60000); // Check every minute
    }

    private async updateMultiTimeframeMarketConditions(): Promise<void> {
        for (const symbol of this.SYMBOLS) {
            for (const timeframe of this.TIMEFRAMES) {
                try {
                    const marketData = await this.getRecentMarketData(symbol, timeframe);
                    if (marketData.length > 0) {
                        const condition = this.analyzeMarketCondition(marketData);
                        const key = `${symbol}_${timeframe}`;
                        this.marketConditions.set(key, condition);
                    }
                } catch (error) {
                    console.error(`   ❌ Error updating market conditions for ${symbol} (${timeframe}):`, error);
                }
            }
        }
    }

    private analyzeMarketCondition(marketData: any[]): AdaptiveMarketCondition {
        if (marketData.length < 20) {
            return {
                volatility: 0,
                trend: 'SIDEWAYS',
                momentum: 0,
                volume: 0,
                atr: 0,
                marketRegime: 'CALM',
                riskLevel: 'LOW'
            };
        }

        const prices = marketData.map(d => d.close);
        const volumes = marketData.map(d => d.volume || 0);

        // Calculate volatility (standard deviation of returns)
        const returns = prices.slice(1).map((price, i) => (price - prices[i]) / prices[i]);
        const volatility = Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length);

        // Calculate trend
        const sma20 = prices.slice(-20).reduce((sum, price) => sum + price, 0) / 20;
        const currentPrice = prices[prices.length - 1];
        const trend = currentPrice > sma20 * 1.01 ? 'BULLISH' : currentPrice < sma20 * 0.99 ? 'BEARISH' : 'SIDEWAYS';

        // Calculate momentum (rate of change)
        const momentum = (currentPrice - prices[prices.length - 10]) / prices[prices.length - 10];

        // Calculate ATR (Average True Range)
        const trueRanges = marketData.slice(1).map((candle, i) => {
            const high = candle.high;
            const low = candle.low;
            const prevClose = marketData[i].close;
            return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        });
        const atr = trueRanges.slice(-14).reduce((sum, tr) => sum + tr, 0) / 14;

        // Determine market regime
        let marketRegime: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'CALM';
        if (volatility > 0.03) marketRegime = 'VOLATILE';
        else if (Math.abs(momentum) > 0.02) marketRegime = 'TRENDING';
        else if (volatility > 0.01) marketRegime = 'RANGING';
        else marketRegime = 'CALM';

        // Determine risk level
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
        if (volatility > 0.05) riskLevel = 'EXTREME';
        else if (volatility > 0.03) riskLevel = 'HIGH';
        else if (volatility > 0.015) riskLevel = 'MEDIUM';
        else riskLevel = 'LOW';

        return {
            volatility,
            trend,
            momentum,
            volume: volumes[volumes.length - 1] || 0,
            atr,
            marketRegime,
            riskLevel
        };
    }

    private async generateMultiTimeframeAdaptiveSignals(): Promise<void> {
        console.log('\n🔄 Generating multi-timeframe adaptive signals...');

        const allSignals: AdaptiveTradeSignal[] = [];

        for (const symbol of this.SYMBOLS) {
            for (const timeframe of this.TIMEFRAMES) {
                const strategyName = `MultiTF_${symbol}_${timeframe}`;
                const strategy = this.strategies.get(strategyName);

                if (!strategy) continue;

                try {
                    const marketData = await this.getRecentMarketData(symbol, timeframe);
                    if (marketData.length === 0) continue;

                    const key = `${symbol}_${timeframe}`;
                    const marketCondition = this.marketConditions.get(key);

                    if (!marketCondition) continue;

                    const signals = await strategy.generateSignals(marketData);

                    for (const signal of signals) {
                        if (signal.confidence >= this.minConfidence) {
                            const adaptiveSignal = this.createMultiTimeframeAdaptiveSignal(
                                signal, symbol, timeframe, marketCondition, marketData
                            );
                            allSignals.push(adaptiveSignal);
                        }
                    }
                } catch (error) {
                    console.error(`   ❌ Error generating adaptive signal for ${symbol} (${timeframe}):`, error);
                }
            }
        }

        // Process signals with timeframe weighting
        if (allSignals.length > 0) {
            await this.processMultiTimeframeSignalsWithWeighting(allSignals);
        } else {
            console.log('   📊 No high-confidence multi-timeframe signals generated');
        }
    }

    private createMultiTimeframeAdaptiveSignal(
        signal: any,
        symbol: string,
        timeframe: string,
        marketCondition: AdaptiveMarketCondition,
        marketData: any[]
    ): AdaptiveTradeSignal {
        const currentPrice = marketData[marketData.length - 1].close;
        const timeframeWeight = this.TIMEFRAME_WEIGHTS[timeframe as keyof typeof this.TIMEFRAME_WEIGHTS] || 0.33;

        // Adjust confidence based on timeframe weight
        const adjustedConfidence = signal.confidence * timeframeWeight;

        // Calculate dynamic parameters
        const stopLossMultiplier = this.getStopLossMultiplier(marketCondition);
        const takeProfitMultiplier = this.getTakeProfitMultiplier(marketCondition);
        const targetMultiplier = this.getTargetMultiplier(marketCondition);
        const positionSizeMultiplier = this.getPositionSizeMultiplier(marketCondition);

        const stopLoss = currentPrice * (1 - this.baseStopLoss * stopLossMultiplier);
        const takeProfit = currentPrice * (1 + this.baseTakeProfit * takeProfitMultiplier);
        const target = currentPrice * (1 + this.baseTakeProfit * targetMultiplier);
        const positionSize = this.maxPositionSize * positionSizeMultiplier * timeframeWeight;

        const expectedReturn = this.calculateExpectedReturn(signal, target, stopLoss, adjustedConfidence, marketCondition);
        const probabilityOfSuccess = this.calculateProbabilityOfSuccess(signal, marketCondition);
        const optimalHoldingPeriod = this.calculateOptimalHoldingPeriod(marketCondition);
        const riskRewardRatio = (target - currentPrice) / (currentPrice - stopLoss);

        const mlPredictions = this.generateMLPredictions(signal, marketData, marketCondition);

        return {
            symbol,
            timeframe,
            action: signal.action,
            price: currentPrice,
            confidence: adjustedConfidence,
            reasoning: `Multi-timeframe ${timeframe} signal with ${(timeframeWeight * 100).toFixed(0)}% weight`,
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
            maxDrawdown: this.maxDrawdown,
            probabilityOfSuccess,
            optimalHoldingPeriod,
            ...mlPredictions
        };
    }

    private getStopLossMultiplier(condition: AdaptiveMarketCondition): number {
        switch (condition.riskLevel) {
            case 'EXTREME': return 2.0;
            case 'HIGH': return 1.5;
            case 'MEDIUM': return 1.0;
            case 'LOW': return 0.7;
            default: return 1.0;
        }
    }

    private getTakeProfitMultiplier(condition: AdaptiveMarketCondition): number {
        switch (condition.marketRegime) {
            case 'TRENDING': return 1.5;
            case 'VOLATILE': return 1.2;
            case 'RANGING': return 0.8;
            case 'CALM': return 0.6;
            default: return 1.0;
        }
    }

    private getTargetMultiplier(condition: AdaptiveMarketCondition): number {
        return this.getTakeProfitMultiplier(condition) * 1.2;
    }

    private getPositionSizeMultiplier(condition: AdaptiveMarketCondition): number {
        switch (condition.riskLevel) {
            case 'EXTREME': return 0.5;
            case 'HIGH': return 0.7;
            case 'MEDIUM': return 1.0;
            case 'LOW': return 1.3;
            default: return 1.0;
        }
    }

    private calculateExpectedReturn(signal: any, target: number, stopLoss: number, confidence: number, condition: AdaptiveMarketCondition): number {
        const riskRewardRatio = (target - signal.price) / (signal.price - stopLoss);
        return (confidence * riskRewardRatio * (target - signal.price)) - ((1 - confidence) * (signal.price - stopLoss));
    }

    private calculateProbabilityOfSuccess(signal: any, condition: AdaptiveMarketCondition): number {
        let baseProbability = signal.confidence;

        // Adjust based on market regime
        switch (condition.marketRegime) {
            case 'TRENDING': baseProbability *= 1.1;
            case 'RANGING': baseProbability *= 0.9;
            case 'VOLATILE': baseProbability *= 0.8;
            case 'CALM': baseProbability *= 1.0;
        }

        // Adjust based on risk level
        switch (condition.riskLevel) {
            case 'LOW': baseProbability *= 1.1;
            case 'MEDIUM': baseProbability *= 1.0;
            case 'HIGH': baseProbability *= 0.9;
            case 'EXTREME': baseProbability *= 0.8;
        }

        return Math.min(baseProbability, 0.95);
    }

    private calculateOptimalHoldingPeriod(condition: AdaptiveMarketCondition): number {
        switch (condition.marketRegime) {
            case 'TRENDING': return 240; // 4 hours
            case 'RANGING': return 60;   // 1 hour
            case 'VOLATILE': return 30;  // 30 minutes
            case 'CALM': return 120;     // 2 hours
            default: return 60;
        }
    }

    private generateMLPredictions(signal: any, marketData: any[], condition: AdaptiveMarketCondition): any {
        return {
            pricePrediction: signal.confidence * 0.8,
            volatilityPrediction: condition.volatility * 1.1,
            trendPrediction: signal.confidence * 0.7,
            volumePrediction: condition.volume * 1.05
        };
    }

    private async processMultiTimeframeSignalsWithWeighting(signals: AdaptiveTradeSignal[]): Promise<void> {
        console.log(`\n📊 Processing ${signals.length} multi-timeframe signals...`);

        // Group signals by symbol
        const signalsBySymbol = new Map<string, AdaptiveTradeSignal[]>();

        for (const signal of signals) {
            if (!signalsBySymbol.has(signal.symbol)) {
                signalsBySymbol.set(signal.symbol, []);
            }
            signalsBySymbol.get(signal.symbol)!.push(signal);
        }

        // Process each symbol's signals
        for (const [symbol, symbolSignals] of signalsBySymbol) {
            console.log(`\n📈 ${symbol} Multi-Timeframe Analysis:`);

            // Calculate weighted consensus
            let totalWeight = 0;
            let weightedAction = 0; // -1 for SELL, 0 for HOLD, 1 for BUY
            let weightedConfidence = 0;
            let weightedPrice = 0;

            for (const signal of symbolSignals) {
                const timeframeWeight = this.TIMEFRAME_WEIGHTS[signal.timeframe as keyof typeof this.TIMEFRAME_WEIGHTS] || 0.33;
                const actionValue = signal.action === 'BUY' ? 1 : signal.action === 'SELL' ? -1 : 0;

                totalWeight += timeframeWeight;
                weightedAction += actionValue * timeframeWeight * signal.confidence;
                weightedConfidence += signal.confidence * timeframeWeight;
                weightedPrice += signal.price * timeframeWeight;

                console.log(`   ${signal.timeframe.padEnd(8)} | ${signal.action.padEnd(4)} | ${(signal.confidence * 100).toFixed(1)}% | ₹${signal.price.toFixed(2)}`);
            }

            if (totalWeight > 0) {
                weightedAction /= totalWeight;
                weightedConfidence /= totalWeight;
                weightedPrice /= totalWeight;

                // Determine consensus action
                let consensusAction: 'BUY' | 'SELL' | 'HOLD';
                if (weightedAction > 0.3) consensusAction = 'BUY';
                else if (weightedAction < -0.3) consensusAction = 'SELL';
                else consensusAction = 'HOLD';

                console.log(`\n🎯 Consensus: ${consensusAction} | Confidence: ${(weightedConfidence * 100).toFixed(1)}% | Price: ₹${weightedPrice.toFixed(2)}`);

                if (consensusAction !== 'HOLD' && weightedConfidence >= this.minConfidence) {
                    // Execute consensus trade
                    const consensusSignal: AdaptiveTradeSignal = {
                        ...symbolSignals[0],
                        action: consensusAction,
                        confidence: weightedConfidence,
                        price: weightedPrice,
                        reasoning: `Multi-timeframe consensus: ${symbolSignals.map(s => `${s.timeframe}(${s.action})`).join(', ')}`
                    };

                    await this.executeMultiTimeframeTrade(consensusSignal);
                }
            }
        }
    }

    private async executeMultiTimeframeTrade(signal: AdaptiveTradeSignal): Promise<void> {
        const tradeId = `MTF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const trade: AdaptiveTrade = {
            id: tradeId,
            symbol: signal.symbol,
            timeframe: 'MULTI', // Multi-timeframe consensus
            action: signal.action,
            quantity: Math.floor((this.capital * signal.positionSize) / signal.price),
            entryPrice: signal.price,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit,
            target: signal.target,
            timestamp: new Date(),
            status: 'PENDING',
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

        console.log(`\n🚀 Executing multi-timeframe trade:`);
        console.log(`   Symbol: ${trade.symbol}`);
        console.log(`   Action: ${trade.action}`);
        console.log(`   Quantity: ${trade.quantity}`);
        console.log(`   Entry: ₹${trade.entryPrice.toFixed(2)}`);
        console.log(`   Stop Loss: ₹${trade.stopLoss.toFixed(2)}`);
        console.log(`   Take Profit: ₹${trade.takeProfit.toFixed(2)}`);
        console.log(`   Target: ₹${trade.target.toFixed(2)}`);
        console.log(`   Confidence: ${(trade.mlConfidence * 100).toFixed(1)}%`);

        trade.status = 'EXECUTED';
    }

    private async monitorMultiTimeframeTrades(): Promise<void> {
        for (const trade of this.trades.filter(t => t.status === 'EXECUTED')) {
            try {
                const currentPrice = await this.getCurrentPrice(trade.symbol);

                // Check exit conditions
                if (trade.action === 'BUY') {
                    if (currentPrice <= trade.stopLoss) {
                        await this.closeMultiTimeframeTrade(trade, currentPrice, 'STOP_LOSS');
                    } else if (currentPrice >= trade.takeProfit) {
                        await this.closeMultiTimeframeTrade(trade, currentPrice, 'TAKE_PROFIT');
                    } else if (currentPrice >= trade.target) {
                        await this.closeMultiTimeframeTrade(trade, currentPrice, 'TARGET');
                    }
                } else if (trade.action === 'SELL') {
                    if (currentPrice >= trade.stopLoss) {
                        await this.closeMultiTimeframeTrade(trade, currentPrice, 'STOP_LOSS');
                    } else if (currentPrice <= trade.takeProfit) {
                        await this.closeMultiTimeframeTrade(trade, currentPrice, 'TAKE_PROFIT');
                    } else if (currentPrice <= trade.target) {
                        await this.closeMultiTimeframeTrade(trade, currentPrice, 'TARGET');
                    }
                }

                // Time-based exit
                const tradeDuration = Date.now() - trade.timestamp.getTime();
                if (tradeDuration > trade.optimalHoldingPeriod * 60 * 1000) {
                    await this.closeMultiTimeframeTrade(trade, currentPrice, 'TIME_BASED');
                }

            } catch (error) {
                console.error(`   ❌ Error monitoring trade ${trade.id}:`, error);
            }
        }
    }

    private async closeMultiTimeframeTrade(trade: AdaptiveTrade, exitPrice: number, reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'TARGET' | 'TIME_BASED'): Promise<void> {
        trade.exitPrice = exitPrice;
        trade.exitReason = reason;
        trade.exitTimestamp = new Date();
        trade.status = 'CLOSED';

        const priceDiff = trade.action === 'BUY' ? exitPrice - trade.entryPrice : trade.entryPrice - exitPrice;
        trade.pnl = priceDiff * trade.quantity;
        trade.pnlPercent = (priceDiff / trade.entryPrice) * 100;
        trade.duration = (trade.exitTimestamp.getTime() - trade.timestamp.getTime()) / (1000 * 60); // minutes
        trade.actualSuccess = trade.pnl > 0;

        console.log(`\n📊 Multi-timeframe trade closed:`);
        console.log(`   Symbol: ${trade.symbol}`);
        console.log(`   Action: ${trade.action}`);
        console.log(`   Exit Reason: ${reason}`);
        console.log(`   Entry: ₹${trade.entryPrice.toFixed(2)} | Exit: ₹${exitPrice.toFixed(2)}`);
        console.log(`   P&L: ₹${trade.pnl?.toFixed(2)} (${trade.pnlPercent?.toFixed(2)}%)`);
        console.log(`   Duration: ${trade.duration?.toFixed(1)} minutes`);
        console.log(`   Success: ${trade.actualSuccess ? '✅' : '❌'}`);

        // Update performance metrics
        this.performanceHistory.push({
            timestamp: new Date(),
            pnl: trade.pnl,
            pnlPercent: trade.pnlPercent,
            success: trade.actualSuccess,
            marketRegime: trade.entryMarketRegime,
            riskLevel: trade.entryRiskLevel,
            timeframe: trade.timeframe
        });
    }

    private async adaptMultiTimeframeParameters(): Promise<void> {
        if (this.performanceHistory.length < 10) return;

        const recentTrades = this.performanceHistory.slice(-20);
        const successRate = recentTrades.filter(t => t.success).length / recentTrades.length;

        // Adapt confidence threshold
        if (successRate < 0.4) {
            this.minConfidence = Math.min(this.minConfidence + 0.05, 0.8);
        } else if (successRate > 0.7) {
            this.minConfidence = Math.max(this.minConfidence - 0.02, 0.5);
        }

        // Adapt position size
        const avgPnl = recentTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / recentTrades.length;
        if (avgPnl < -1000) {
            this.maxPositionSize = Math.max(this.maxPositionSize * 0.9, 0.05);
        } else if (avgPnl > 1000) {
            this.maxPositionSize = Math.min(this.maxPositionSize * 1.1, 0.2);
        }

        console.log(`\n🔄 Adapted Parameters: Confidence=${(this.minConfidence * 100).toFixed(1)}%, Position=${(this.maxPositionSize * 100).toFixed(1)}%`);
    }

    private async showMultiTimeframePortfolioStatus(): Promise<void> {
        const openTrades = this.trades.filter(t => t.status === 'EXECUTED');
        const closedTrades = this.trades.filter(t => t.status === 'CLOSED');

        const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const successRate = closedTrades.length > 0 ? closedTrades.filter(t => t.actualSuccess).length / closedTrades.length : 0;

        console.log('\n📊 Multi-Timeframe Portfolio Status:');
        console.log('====================================');
        console.log(`💰 Total P&L: ₹${totalPnl.toFixed(2)}`);
        console.log(`📈 Success Rate: ${(successRate * 100).toFixed(1)}%`);
        console.log(`📊 Total Trades: ${closedTrades.length}`);
        console.log(`🔄 Open Trades: ${openTrades.length}`);

        if (openTrades.length > 0) {
            console.log('\n🔄 Open Multi-Timeframe Trades:');
            openTrades.forEach(trade => {
                console.log(`   ${trade.symbol} | ${trade.action} | ₹${trade.entryPrice.toFixed(2)} | ${(trade.mlConfidence * 100).toFixed(1)}%`);
            });
        }

        if (closedTrades.length > 0) {
            console.log('\n📊 Recent Multi-Timeframe Trades:');
            closedTrades.slice(-5).forEach(trade => {
                const status = trade.actualSuccess ? '✅' : '❌';
                console.log(`   ${status} ${trade.symbol} | ${trade.action} | ₹${trade.pnl?.toFixed(2)} | ${trade.exitReason}`);
            });
        }
    }

    private async getRecentMarketData(symbol: string, timeframe: string): Promise<any[]> {
        try {
            const timeframeConfig = await this.dbManager.db.timeframeConfig.findFirst({
                where: { name: timeframe }
            });

            if (!timeframeConfig) return [];

            const instrument = await this.dbManager.db.instrument.findFirst({
                where: { symbol }
            });

            if (!instrument) return [];

            const candleData = await this.dbManager.db.candleData.findMany({
                where: {
                    instrumentId: instrument.id,
                    timeframeId: timeframeConfig.id
                },
                orderBy: { timestamp: 'desc' },
                take: 100
            });

            return candleData.reverse().map(candle => ({
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: candle.volume,
                timestamp: candle.timestamp
            }));
        } catch (error) {
            console.error(`   ❌ Error fetching market data for ${symbol} (${timeframe}):`, error);
            return [];
        }
    }

    private async getCurrentPrice(symbol: string): Promise<number> {
        try {
            const latestData = await this.getRecentMarketData(symbol, '1min');
            return latestData.length > 0 ? latestData[latestData.length - 1].close : 0;
        } catch (error) {
            console.error(`   ❌ Error getting current price for ${symbol}:`, error);
            return 0;
        }
    }

    async stop(): Promise<void> {
        console.log('\n🛑 Stopping Multi-Timeframe Adaptive ML Trading...');

        this.isRunning = false;

        if (this.signalInterval) {
            clearInterval(this.signalInterval);
            this.signalInterval = null;
        }

        await this.showFinalMultiTimeframeStatistics();
        await this.dbManager.disconnect();

        console.log('✅ Multi-timeframe adaptive trading stopped');
    }

    private async showFinalMultiTimeframeStatistics(): Promise<void> {
        const closedTrades = this.trades.filter(t => t.status === 'CLOSED');

        if (closedTrades.length === 0) {
            console.log('\n📊 No multi-timeframe trades completed');
            return;
        }

        const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const successRate = closedTrades.filter(t => t.actualSuccess).length / closedTrades.length;
        const avgPnl = totalPnl / closedTrades.length;
        const maxDrawdown = Math.min(...closedTrades.map(t => t.pnl || 0));

        console.log('\n📊 Multi-Timeframe Trading Statistics:');
        console.log('=====================================');
        console.log(`💰 Total P&L: ₹${totalPnl.toFixed(2)}`);
        console.log(`📈 Success Rate: ${(successRate * 100).toFixed(1)}%`);
        console.log(`📊 Average P&L per Trade: ₹${avgPnl.toFixed(2)}`);
        console.log(`📉 Maximum Drawdown: ₹${maxDrawdown.toFixed(2)}`);
        console.log(`🔄 Total Trades: ${closedTrades.length}`);

        // Performance by timeframe
        const performanceByTimeframe = new Map<string, { pnl: number; count: number; success: number }>();

        for (const trade of closedTrades) {
            if (!performanceByTimeframe.has(trade.timeframe)) {
                performanceByTimeframe.set(trade.timeframe, { pnl: 0, count: 0, success: 0 });
            }

            const stats = performanceByTimeframe.get(trade.timeframe)!;
            stats.pnl += trade.pnl || 0;
            stats.count += 1;
            if (trade.actualSuccess) stats.success += 1;
        }

        console.log('\n📊 Performance by Timeframe:');
        for (const [timeframe, stats] of performanceByTimeframe) {
            const successRate = stats.count > 0 ? (stats.success / stats.count) * 100 : 0;
            console.log(`   ${timeframe.padEnd(8)} | P&L: ₹${stats.pnl.toFixed(2)} | Success: ${successRate.toFixed(1)}% | Trades: ${stats.count}`);
        }
    }

    getStatus(): any {
        return {
            isRunning: this.isRunning,
            strategies: this.strategies.size,
            openTrades: this.trades.filter(t => t.status === 'EXECUTED').length,
            totalTrades: this.trades.length,
            timeframes: this.TIMEFRAMES,
            symbols: this.SYMBOLS
        };
    }
}

// Main execution
async function main() {
    const trader = new MultiTimeframeAdaptiveMLTrading();

    try {
        await trader.start();

        // Keep running until interrupted
        process.on('SIGINT', async () => {
            console.log('\n🛑 Received interrupt signal...');
            await trader.stop();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Error in multi-timeframe adaptive trading:', error);
        await trader.stop();
        process.exit(1);
    }
}

if (require.main === module) {
    main();
} 