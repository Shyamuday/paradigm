#!/usr/bin/env ts-node

import * as tf from '@tensorflow/tfjs-node';
import { db } from './database/database';

// ============================================================================
// ADVANCED ML STRATEGY INTERFACES
// ============================================================================

interface AdvancedMLConfig {
    name: string;
    modelType: 'lstm' | 'cnn' | 'transformer' | 'ensemble' | 'reinforcement_learning';
    timeframes: string[];
    features: string[];
    lookbackPeriod: number;
    predictionHorizon: number;
    confidenceThreshold: number;
    autoTargetStopLoss: boolean;
    multiTimeframeWeighting: boolean;
    dynamicPositionSizing: boolean;
    riskManagement: {
        maxRiskPerTrade: number;
        maxDailyLoss: number;
        trailingStop: boolean;
        volatilityAdjustment: boolean;
    };
}

interface MultiTimeframeSignal {
    timeframes: { [key: string]: number };
    weightedSignal: number;
    confidence: number;
    volatility: number;
    trendStrength: number;
    support: number;
    resistance: number;
    dynamicTarget: number;
    dynamicStopLoss: number;
    positionSize: number;
}

interface AdvancedTradeSignal {
    symbol: string;
    signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    entryPrice: number;
    targetPrice: number;
    stopLossPrice: number;
    positionSize: number;
    timeframes: string[];
    reasoning: string[];
    riskMetrics: {
        volatility: number;
        trendStrength: number;
        supportDistance: number;
        resistanceDistance: number;
        riskRewardRatio: number;
    };
}

// ============================================================================
// TENSORFLOW MODELS
// ============================================================================

class TensorFlowModels {
    private models: Map<string, tf.LayersModel> = new Map();

    async createLSTMModel(inputShape: number[], outputShape: number): Promise<tf.LayersModel> {
        const model = tf.sequential({
            layers: [
                tf.layers.lstm({
                    units: 128,
                    returnSequences: true,
                    inputShape: inputShape
                }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.lstm({
                    units: 64,
                    returnSequences: false
                }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({
                    units: 32,
                    activation: 'relu'
                }),
                tf.layers.dense({
                    units: outputShape[0],
                    activation: 'tanh'
                })
            ]
        });

        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'meanSquaredError',
            metrics: ['accuracy']
        });

        return model;
    }

    async createCNNModel(inputShape: number[], outputShape: number): Promise<tf.LayersModel> {
        const model = tf.sequential({
            layers: [
                tf.layers.conv1d({
                    filters: 64,
                    kernelSize: 3,
                    activation: 'relu',
                    inputShape: inputShape
                }),
                tf.layers.maxPooling1d({ poolSize: 2 }),
                tf.layers.conv1d({
                    filters: 32,
                    kernelSize: 3,
                    activation: 'relu'
                }),
                tf.layers.maxPooling1d({ poolSize: 2 }),
                tf.layers.flatten(),
                tf.layers.dense({
                    units: 64,
                    activation: 'relu'
                }),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({
                    units: outputShape[0],
                    activation: 'tanh'
                })
            ]
        });

        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'meanSquaredError',
            metrics: ['accuracy']
        });

        return model;
    }

    async createTransformerModel(inputShape: number[], outputShape: number): Promise<tf.LayersModel> {
        // Simplified transformer for time series
        const model = tf.sequential({
            layers: [
                tf.layers.dense({
                    units: 256,
                    activation: 'relu',
                    inputShape: inputShape
                }),
                tf.layers.layerNormalization(),
                tf.layers.dropout({ rate: 0.1 }),
                tf.layers.dense({
                    units: 128,
                    activation: 'relu'
                }),
                tf.layers.layerNormalization(),
                tf.layers.dropout({ rate: 0.1 }),
                tf.layers.dense({
                    units: 64,
                    activation: 'relu'
                }),
                tf.layers.dense({
                    units: outputShape[0],
                    activation: 'tanh'
                })
            ]
        });

        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'meanSquaredError',
            metrics: ['accuracy']
        });

        return model;
    }

    async trainModel(model: tf.LayersModel, xTrain: tf.Tensor, yTrain: tf.Tensor, epochs: number = 100): Promise<tf.History> {
        return await model.fit(xTrain, yTrain, {
            epochs: epochs,
            batchSize: 32,
            validationSplit: 0.2,
            callbacks: [
                tf.callbacks.earlyStopping({ patience: 10 }),
                tf.callbacks.reduceLROnPlateau({ factor: 0.5, patience: 5 })
            ]
        });
    }

    async predict(model: tf.LayersModel, input: tf.Tensor): Promise<tf.Tensor> {
        return model.predict(input) as tf.Tensor;
    }
}

// ============================================================================
// ADVANCED FEATURE ENGINEERING
// ============================================================================

class AdvancedFeatureEngineering {
    static calculateTechnicalFeatures(data: any[]): any[] {
        const features = [];
        const prices = data.map(d => d.close);
        const highs = data.map(d => d.high);
        const lows = data.map(d => d.low);
        const volumes = data.map(d => d.volume);

        for (let i = 20; i < data.length; i++) {
            const featureSet = {
                // Price-based features
                priceChange: (prices[i] - prices[i - 1]) / prices[i - 1],
                priceChange5: (prices[i] - prices[i - 5]) / prices[i - 5],
                priceChange10: (prices[i] - prices[i - 10]) / prices[i - 10],
                priceChange20: (prices[i] - prices[i - 20]) / prices[i - 20],

                // Volatility features
                volatility: this.calculateVolatility(prices.slice(i - 20, i)),
                atr: this.calculateATR(highs.slice(i - 20, i), lows.slice(i - 20, i), prices.slice(i - 20, i)),

                // Technical indicators
                rsi: this.calculateRSI(prices.slice(i - 20, i)),
                macd: this.calculateMACD(prices.slice(i - 20, i)),
                bbPosition: this.calculateBollingerPosition(prices.slice(i - 20, i)),

                // Volume features
                volumeChange: (volumes[i] - volumes[i - 1]) / volumes[i - 1],
                volumeSMA: this.calculateSMA(volumes.slice(i - 20, i), 20),
                volumeRatio: volumes[i] / this.calculateSMA(volumes.slice(i - 20, i), 20),

                // Momentum features
                momentum: prices[i] - prices[i - 5],
                rateOfChange: (prices[i] - prices[i - 10]) / prices[i - 10],

                // Support/Resistance
                supportLevel: this.findSupport(prices.slice(i - 20, i)),
                resistanceLevel: this.findResistance(prices.slice(i - 20, i)),

                // Time-based features
                hourOfDay: new Date(data[i].timestamp).getHours(),
                dayOfWeek: new Date(data[i].timestamp).getDay(),

                // Target variable (next period return)
                target: i < data.length - 1 ? (prices[i + 1] - prices[i]) / prices[i] : 0
            };

            features.push(featureSet);
        }

        return features;
    }

    static calculateVolatility(prices: number[]): number {
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
        }
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        return Math.sqrt(variance);
    }

    static calculateATR(highs: number[], lows: number[], closes: number[]): number {
        const tr = [];
        for (let i = 1; i < highs.length; i++) {
            const hl = highs[i] - lows[i];
            const hc = Math.abs(highs[i] - closes[i - 1]);
            const lc = Math.abs(lows[i] - closes[i - 1]);
            tr.push(Math.max(hl, hc, lc));
        }
        return tr.reduce((sum, t) => sum + t, 0) / tr.length;
    }

    static calculateRSI(prices: number[], period: number = 14): number {
        let gains = 0, losses = 0;
        for (let i = 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    static calculateMACD(prices: number[]): number {
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);
        return ema12[ema12.length - 1] - ema26[ema26.length - 1];
    }

    static calculateEMA(prices: number[], period: number): number[] {
        const ema = [];
        const multiplier = 2 / (period + 1);

        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += prices[i];
        }
        ema.push(sum / period);

        for (let i = period; i < prices.length; i++) {
            const newEMA = (prices[i] * multiplier) + (ema[ema.length - 1] * (1 - multiplier));
            ema.push(newEMA);
        }
        return ema;
    }

    static calculateBollingerPosition(prices: number[]): number {
        const sma = this.calculateSMA(prices, 20);
        const std = this.calculateStandardDeviation(prices, 20);
        const upper = sma + (2 * std);
        const lower = sma - (2 * std);
        const currentPrice = prices[prices.length - 1];
        return (currentPrice - lower) / (upper - lower);
    }

    static calculateSMA(prices: number[], period: number): number {
        const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }

    static calculateStandardDeviation(prices: number[], period: number): number {
        const sma = this.calculateSMA(prices, period);
        const variance = prices.slice(-period).reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
        return Math.sqrt(variance);
    }

    static findSupport(prices: number[]): number {
        return Math.min(...prices);
    }

    static findResistance(prices: number[]): number {
        return Math.max(...prices);
    }
}

// ============================================================================
// MULTI-TIMEFRAME ANALYSIS
// ============================================================================

class MultiTimeframeAnalysis {
    static async analyzeMultiTimeframe(symbol: string, timeframes: string[]): Promise<MultiTimeframeSignal> {
        const signals: { [key: string]: number } = {};
        const confidences: { [key: string]: number } = {};
        const volatilities: { [key: string]: number } = {};

        // Get data for each timeframe
        for (const timeframe of timeframes) {
            const data = await this.getTimeframeData(symbol, timeframe);
            if (data.length > 0) {
                const analysis = this.analyzeTimeframe(data, timeframe);
                signals[timeframe] = analysis.signal;
                confidences[timeframe] = analysis.confidence;
                volatilities[timeframe] = analysis.volatility;
            }
        }

        // Calculate weighted signal
        const weightedSignal = this.calculateWeightedSignal(signals, confidences);
        const overallConfidence = this.calculateOverallConfidence(confidences);
        const overallVolatility = this.calculateOverallVolatility(volatilities);

        // Calculate support and resistance
        const supportResistance = await this.calculateSupportResistance(symbol, timeframes);

        // Calculate dynamic targets
        const dynamicTarget = this.calculateDynamicTarget(signals, supportResistance);
        const dynamicStopLoss = this.calculateDynamicStopLoss(signals, supportResistance, overallVolatility);

        // Calculate position size
        const positionSize = this.calculatePositionSize(overallConfidence, overallVolatility);

        return {
            timeframes: signals,
            weightedSignal: weightedSignal,
            confidence: overallConfidence,
            volatility: overallVolatility,
            trendStrength: this.calculateTrendStrength(signals),
            support: supportResistance.support,
            resistance: supportResistance.resistance,
            dynamicTarget: dynamicTarget,
            dynamicStopLoss: dynamicStopLoss,
            positionSize: positionSize
        };
    }

    private static async getTimeframeData(symbol: string, timeframe: string): Promise<any[]> {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        return await db.candleData.findMany({
            where: {
                instrument: { symbol },
                timeframe: { name: timeframe },
                timestamp: { gte: oneMonthAgo }
            },
            orderBy: { timestamp: 'asc' }
        });
    }

    private static analyzeTimeframe(data: any[], timeframe: string): { signal: number, confidence: number, volatility: number } {
        const prices = data.map(d => d.close);
        const features = AdvancedFeatureEngineering.calculateTechnicalFeatures(data);

        if (features.length === 0) {
            return { signal: 0, confidence: 0, volatility: 0 };
        }

        // Calculate signal based on multiple indicators
        const rsi = features[features.length - 1].rsi;
        const macd = features[features.length - 1].macd;
        const bbPosition = features[features.length - 1].bbPosition;
        const momentum = features[features.length - 1].momentum;

        let signal = 0;
        let confidence = 0;

        // RSI signals
        if (rsi < 30) signal += 1;
        else if (rsi > 70) signal -= 1;

        // MACD signals
        if (macd > 0) signal += 0.5;
        else signal -= 0.5;

        // Bollinger Bands signals
        if (bbPosition < 0.2) signal += 0.5;
        else if (bbPosition > 0.8) signal -= 0.5;

        // Momentum signals
        if (momentum > 0) signal += 0.3;
        else signal -= 0.3;

        // Normalize signal to [-1, 1]
        signal = Math.max(-1, Math.min(1, signal / 2.3));

        // Calculate confidence based on signal strength and volatility
        const volatility = features[features.length - 1].volatility;
        confidence = Math.abs(signal) * (1 - volatility);

        return { signal, confidence, volatility };
    }

    private static calculateWeightedSignal(signals: { [key: string]: number }, confidences: { [key: string]: number }): number {
        let weightedSum = 0;
        let totalWeight = 0;

        // Higher timeframes get more weight
        const weights = {
            '1min': 0.1,
            '3min': 0.15,
            '5min': 0.2,
            '15min': 0.25,
            '30min': 0.3,
            '60min': 0.4
        };

        for (const [timeframe, signal] of Object.entries(signals)) {
            const weight = weights[timeframe as keyof typeof weights] || 0.2;
            const confidence = confidences[timeframe] || 0;
            weightedSum += signal * weight * confidence;
            totalWeight += weight * confidence;
        }

        return totalWeight > 0 ? weightedSum / totalWeight : 0;
    }

    private static calculateOverallConfidence(confidences: { [key: string]: number }): number {
        const values = Object.values(confidences);
        return values.length > 0 ? values.reduce((sum, c) => sum + c, 0) / values.length : 0;
    }

    private static calculateOverallVolatility(volatilities: { [key: string]: number }): number {
        const values = Object.values(volatilities);
        return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
    }

    private static calculateTrendStrength(signals: { [key: string]: number }): number {
        const values = Object.values(signals);
        return values.length > 0 ? Math.abs(values.reduce((sum, s) => sum + s, 0) / values.length) : 0;
    }

    private static async calculateSupportResistance(symbol: string, timeframes: string[]): Promise<{ support: number, resistance: number }> {
        // Use the highest timeframe for support/resistance
        const highestTimeframe = timeframes[timeframes.length - 1];
        const data = await this.getTimeframeData(symbol, highestTimeframe);

        if (data.length === 0) {
            return { support: 0, resistance: 0 };
        }

        const prices = data.map(d => d.close);
        const highs = data.map(d => d.high);
        const lows = data.map(d => d.low);

        // Find recent support and resistance levels
        const recentHighs = highs.slice(-20);
        const recentLows = lows.slice(-20);

        const resistance = Math.max(...recentHighs);
        const support = Math.min(...recentLows);

        return { support, resistance };
    }

    private static calculateDynamicTarget(signals: { [key: string]: number }, supportResistance: { support: number, resistance: number }, currentPrice: number): number {
        const weightedSignal = this.calculateWeightedSignal(signals, {});

        if (weightedSignal > 0.5) {
            // Bullish signal - target resistance
            return supportResistance.resistance;
        } else if (weightedSignal < -0.5) {
            // Bearish signal - target support
            return supportResistance.support;
        } else {
            // Neutral - use ATR-based target
            return currentPrice * (1 + weightedSignal * 0.02);
        }
    }

    private static calculateDynamicStopLoss(signals: { [key: string]: number }, supportResistance: { support: number, resistance: number }, volatility: number): number {
        const weightedSignal = this.calculateWeightedSignal(signals, {});
        const currentPrice = (supportResistance.support + supportResistance.resistance) / 2;

        if (weightedSignal > 0.5) {
            // Bullish signal - stop loss below support
            return supportResistance.support * (1 - volatility);
        } else if (weightedSignal < -0.5) {
            // Bearish signal - stop loss above resistance
            return supportResistance.resistance * (1 + volatility);
        } else {
            // Neutral - use volatility-based stop loss
            return currentPrice * (1 - weightedSignal * volatility);
        }
    }

    private static calculatePositionSize(confidence: number, volatility: number): number {
        // Base position size
        let positionSize = 1000;

        // Adjust based on confidence
        positionSize *= confidence;

        // Adjust based on volatility (inverse relationship)
        positionSize *= (1 - volatility);

        // Ensure minimum and maximum bounds
        return Math.max(100, Math.min(5000, positionSize));
    }
}

// ============================================================================
// INTELLIGENT RISK MANAGEMENT
// ============================================================================

class IntelligentRiskManagement {
    static calculateDynamicRisk(
        signal: MultiTimeframeSignal,
        currentPrice: number,
        accountBalance: number = 100000
    ): {
        positionSize: number;
        stopLoss: number;
        takeProfit: number;
        maxRisk: number;
        riskRewardRatio: number;
    } {
        // Calculate volatility-adjusted position size
        const volatilityAdjustment = 1 - signal.volatility;
        const confidenceAdjustment = signal.confidence;
        const trendStrengthAdjustment = signal.trendStrength;

        // Base position size
        let positionSize = signal.positionSize;

        // Apply adjustments
        positionSize *= volatilityAdjustment;
        positionSize *= confidenceAdjustment;
        positionSize *= (1 + trendStrengthAdjustment);

        // Risk management
        const maxRiskPerTrade = accountBalance * 0.02; // 2% risk per trade
        const maxRisk = Math.min(maxRiskPerTrade, positionSize * 0.1);

        // Dynamic stop loss based on volatility
        const stopLossDistance = currentPrice * signal.volatility * 2;
        const stopLoss = signal.weightedSignal > 0
            ? currentPrice - stopLossDistance
            : currentPrice + stopLossDistance;

        // Dynamic take profit based on risk-reward ratio
        const riskRewardRatio = 2.5; // Target 2.5:1 ratio
        const takeProfitDistance = stopLossDistance * riskRewardRatio;
        const takeProfit = signal.weightedSignal > 0
            ? currentPrice + takeProfitDistance
            : currentPrice - takeProfitDistance;

        return {
            positionSize: Math.round(positionSize),
            stopLoss: Math.round(stopLoss * 100) / 100,
            takeProfit: Math.round(takeProfit * 100) / 100,
            maxRisk: Math.round(maxRisk),
            riskRewardRatio: riskRewardRatio
        };
    }

    static shouldEnterTrade(signal: MultiTimeframeSignal, marketConditions: any): boolean {
        // Check multiple conditions
        const confidenceCheck = signal.confidence > 0.7;
        const volatilityCheck = signal.volatility < 0.5;
        const trendCheck = signal.trendStrength > 0.3;
        const marketCheck = marketConditions.overallTrend === (signal.weightedSignal > 0 ? 'bullish' : 'bearish');

        return confidenceCheck && volatilityCheck && trendCheck && marketCheck;
    }

    static calculateTrailingStop(currentPrice: number, entryPrice: number, signal: MultiTimeframeSignal): number {
        const atr = signal.volatility * currentPrice;
        const trailingDistance = atr * 2;

        if (signal.weightedSignal > 0) {
            // Long position - trailing stop below current price
            return Math.max(entryPrice, currentPrice - trailingDistance);
        } else {
            // Short position - trailing stop above current price
            return Math.min(entryPrice, currentPrice + trailingDistance);
        }
    }
}

// ============================================================================
// MAIN ADVANCED ML STRATEGY CLASS
// ============================================================================

class AdvancedMLStrategy {
    private tfModels: TensorFlowModels;
    private config: AdvancedMLConfig;

    constructor(config: AdvancedMLConfig) {
        this.tfModels = new TensorFlowModels();
        this.config = config;
    }

    async generateAdvancedSignal(symbol: string): Promise<AdvancedTradeSignal | null> {
        try {
            // Multi-timeframe analysis
            const multiTimeframeSignal = await MultiTimeframeAnalysis.analyzeMultiTimeframe(
                symbol,
                this.config.timeframes
            );

            // Get current market data
            const currentData = await this.getCurrentData(symbol, this.config.timeframes[0]);
            if (!currentData) return null;

            const currentPrice = currentData.close;

            // Check if we should enter a trade
            const marketConditions = await this.analyzeMarketConditions(symbol);
            if (!IntelligentRiskManagement.shouldEnterTrade(multiTimeframeSignal, marketConditions)) {
                return {
                    symbol,
                    signal: 'HOLD',
                    confidence: multiTimeframeSignal.confidence,
                    entryPrice: currentPrice,
                    targetPrice: currentPrice,
                    stopLossPrice: currentPrice,
                    positionSize: 0,
                    timeframes: this.config.timeframes,
                    reasoning: ['Market conditions not favorable'],
                    riskMetrics: {
                        volatility: multiTimeframeSignal.volatility,
                        trendStrength: multiTimeframeSignal.trendStrength,
                        supportDistance: 0,
                        resistanceDistance: 0,
                        riskRewardRatio: 0
                    }
                };
            }

            // Calculate dynamic risk management
            const riskManagement = IntelligentRiskManagement.calculateDynamicRisk(
                multiTimeframeSignal,
                currentPrice
            );

            // Determine signal
            let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
            if (multiTimeframeSignal.weightedSignal > 0.3) {
                signal = 'BUY';
            } else if (multiTimeframeSignal.weightedSignal < -0.3) {
                signal = 'SELL';
            }

            // Generate reasoning
            const reasoning = this.generateReasoning(multiTimeframeSignal, marketConditions);

            // Calculate risk metrics
            const riskMetrics = {
                volatility: multiTimeframeSignal.volatility,
                trendStrength: multiTimeframeSignal.trendStrength,
                supportDistance: Math.abs(currentPrice - multiTimeframeSignal.support) / currentPrice,
                resistanceDistance: Math.abs(currentPrice - multiTimeframeSignal.resistance) / currentPrice,
                riskRewardRatio: riskManagement.riskRewardRatio
            };

            return {
                symbol,
                signal,
                confidence: multiTimeframeSignal.confidence,
                entryPrice: currentPrice,
                targetPrice: riskManagement.takeProfit,
                stopLossPrice: riskManagement.stopLoss,
                positionSize: riskManagement.positionSize,
                timeframes: this.config.timeframes,
                reasoning,
                riskMetrics
            };

        } catch (error) {
            console.error(`Error generating advanced signal for ${symbol}:`, error);
            return null;
        }
    }

    private async getCurrentData(symbol: string, timeframe: string): Promise<any | null> {
        const data = await db.candleData.findMany({
            where: {
                instrument: { symbol },
                timeframe: { name: timeframe }
            },
            orderBy: { timestamp: 'desc' },
            take: 1
        });

        return data.length > 0 ? data[0] : null;
    }

    private async analyzeMarketConditions(symbol: string): Promise<any> {
        // Analyze broader market conditions
        const marketData = await db.candleData.findMany({
            where: {
                timeframe: { name: '60min' }
            },
            orderBy: { timestamp: 'desc' },
            take: 100
        });

        if (marketData.length === 0) {
            return { overallTrend: 'neutral' };
        }

        const prices = marketData.map(d => d.close);
        const trend = this.calculateTrend(prices);

        return {
            overallTrend: trend > 0.01 ? 'bullish' : trend < -0.01 ? 'bearish' : 'neutral',
            volatility: this.calculateVolatility(prices),
            momentum: this.calculateMomentum(prices)
        };
    }

    private calculateTrend(prices: number[]): number {
        if (prices.length < 2) return 0;
        return (prices[prices.length - 1] - prices[0]) / prices[0];
    }

    private calculateVolatility(prices: number[]): number {
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
        }
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        return Math.sqrt(variance);
    }

    private calculateMomentum(prices: number[]): number {
        if (prices.length < 10) return 0;
        return (prices[prices.length - 1] - prices[prices.length - 10]) / prices[prices.length - 10];
    }

    private generateReasoning(signal: MultiTimeframeSignal, marketConditions: any): string[] {
        const reasoning: string[] = [];

        // Add timeframe analysis
        for (const [timeframe, tfSignal] of Object.entries(signal.timeframes)) {
            if (Math.abs(tfSignal) > 0.5) {
                reasoning.push(`${timeframe}: ${tfSignal > 0 ? 'Bullish' : 'Bearish'} signal (${(Math.abs(tfSignal) * 100).toFixed(0)}% strength)`);
            }
        }

        // Add confidence reasoning
        if (signal.confidence > 0.8) {
            reasoning.push('High confidence across multiple timeframes');
        } else if (signal.confidence > 0.6) {
            reasoning.push('Moderate confidence with clear signals');
        }

        // Add trend strength reasoning
        if (signal.trendStrength > 0.7) {
            reasoning.push('Strong trend confirmation');
        } else if (signal.trendStrength > 0.4) {
            reasoning.push('Moderate trend strength');
        }

        // Add market condition reasoning
        reasoning.push(`Market trend: ${marketConditions.overallTrend}`);

        return reasoning;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    AdvancedMLStrategy,
    MultiTimeframeAnalysis,
    IntelligentRiskManagement,
    AdvancedFeatureEngineering,
    TensorFlowModels,
    AdvancedMLConfig,
    MultiTimeframeSignal,
    AdvancedTradeSignal
}; 