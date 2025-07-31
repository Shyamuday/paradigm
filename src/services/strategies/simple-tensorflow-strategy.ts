import * as tf from '@tensorflow/tfjs-node';
import { BaseStrategy } from '../strategy-engine.service';
import { StrategyConfig, TradeSignal, MarketData } from '../../schemas/strategy.schema';
import { logger } from '../../logger/logger';
import { enhancedTechnicalIndicators } from '../enhanced-technical-indicators.service';
import { DatabaseManager } from '../../database/database';

// Simple TensorFlow Strategy Configuration
export interface SimpleTensorFlowConfig extends StrategyConfig {
    // Technical indicators
    indicators: {
        sma: { period: number };
        ema: { period: number };
        rsi: { period: number };
        macd: { fastPeriod: number; slowPeriod: number; signalPeriod: number };
        bollinger: { period: number; stdDev: number };
        atr: { period: number };
    };

    // ML parameters
    ml: {
        lookbackPeriod: number;      // How many periods to look back
        predictionHorizon: number;   // How many periods ahead to predict
        confidenceThreshold: number; // Minimum confidence for signal
        retrainInterval: number;     // How often to retrain model (minutes)
        hiddenLayers: number[];      // Hidden layer sizes
        learningRate: number;        // Learning rate for training
        epochs: number;              // Number of training epochs
    };

    // Risk management
    risk: {
        maxPositionSize: number;     // Maximum position size as % of capital
        stopLoss: number;           // Stop loss percentage
        takeProfit: number;         // Take profit percentage
        maxDrawdown: number;        // Maximum drawdown limit
    };
}

// Feature vector for ML model
interface FeatureVector {
    timestamp: Date;
    features: number[];
    target: number; // 1 for up, 0 for down
    price: number;
    volume: number;
}

export class SimpleTensorFlowStrategy extends BaseStrategy {
    protected config: SimpleTensorFlowConfig;
    private model: tf.Sequential | null = null;
    private isTrained: boolean = false;
    private featureCount: number = 0;
    private mean: number[] = [];
    private std: number[] = [];
    private featureHistory: FeatureVector[] = [];
    private lastTrainingTime: Date = new Date();
    private dbManager: DatabaseManager;
    private performanceMetrics: {
        totalSignals: number;
        winningSignals: number;
        losingSignals: number;
        accuracy: number;
        totalPnL: number;
    } = {
            totalSignals: 0,
            winningSignals: 0,
            losingSignals: 0,
            accuracy: 0,
            totalPnL: 0
        };

    constructor(config: SimpleTensorFlowConfig) {
        super('Simple TensorFlow Strategy', 'CUSTOM', '1.0.0', 'Simple TensorFlow-based trading strategy');
        this.config = config;
        this.dbManager = DatabaseManager.getInstance();

        logger.info('Simple TensorFlow Strategy initialized', {
            indicators: Object.keys(config.indicators),
            mlParams: config.ml
        });
    }

    validateConfig(config: StrategyConfig): boolean {
        try {
            // Validate technical indicators
            if (!this.config.indicators?.sma?.period || this.config.indicators.sma.period < 1) {
                return false;
            }
            if (!this.config.indicators?.rsi?.period || this.config.indicators.rsi.period < 1) {
                return false;
            }

            // Validate ML parameters
            if (!this.config.ml?.lookbackPeriod || this.config.ml.lookbackPeriod < 10) {
                return false;
            }
            if (!this.config.ml?.confidenceThreshold || this.config.ml.confidenceThreshold < 0.1 || this.config.ml.confidenceThreshold > 0.9) {
                return false;
            }

            // Validate risk parameters
            if (!this.config.risk?.maxPositionSize || this.config.risk.maxPositionSize <= 0 || this.config.risk.maxPositionSize > 1) {
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Simple TensorFlow Strategy config validation failed:', error);
            return false;
        }
    }

    async generateSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        if (marketData.length < this.config.ml.lookbackPeriod) {
            logger.warn('Insufficient market data for TensorFlow strategy', {
                required: this.config.ml.lookbackPeriod,
                available: marketData.length
            });
            return [];
        }

        const signals: TradeSignal[] = [];
        const latestData = marketData[marketData.length - 1];

        if (!latestData || !latestData.close) {
            logger.warn('No valid market data available for TensorFlow strategy');
            return signals;
        }

        try {
            // Extract features from market data
            const features = this.extractFeatures(marketData);

            // Check if model needs retraining
            const timeSinceTraining = Date.now() - this.lastTrainingTime.getTime();
            if (timeSinceTraining > this.config.ml.retrainInterval * 60 * 1000) {
                await this.retrainModel();
            }

            // Make prediction if model is trained
            if (this.model && this.isTrained) {
                const { prediction, confidence } = await this.predict(features);

                // Generate signal if confidence is high enough
                if (confidence >= this.config.ml.confidenceThreshold) {
                    const action = prediction > 0.5 ? 'BUY' : 'SELL';
                    const side = action === 'BUY' ? 'LONG' : 'SHORT';

                    const signal: TradeSignal = {
                        id: `tensorflow_${Date.now()}`,
                        symbol: this.config.instruments[0] || 'UNKNOWN',
                        action,
                        side,
                        quantity: 1, // Will be calculated by position sizing
                        price: latestData.close,
                        confidence,
                        timestamp: new Date(),
                        strategyName: this.config.name,
                        reasoning: `TensorFlow prediction: ${(prediction * 100).toFixed(1)}% probability of ${action === 'BUY' ? 'upward' : 'downward'} movement. Confidence: ${(confidence * 100).toFixed(1)}%`,
                        metadata: {
                            prediction,
                            confidence,
                            features: features.slice(0, 10), // Include first 10 features for debugging
                            modelAccuracy: this.performanceMetrics.accuracy
                        }
                    };

                    signals.push(signal);
                    this.performanceMetrics.totalSignals++;

                    logger.info('TensorFlow Strategy generated signal', {
                        symbol: this.config.instruments[0] || 'UNKNOWN',
                        action,
                        confidence: (confidence * 100).toFixed(1) + '%',
                        prediction: (prediction * 100).toFixed(1) + '%'
                    });
                }
            } else {
                logger.warn('TensorFlow model not trained yet');
            }

        } catch (error) {
            logger.error('Error generating TensorFlow signals:', error);
        }

        return signals;
    }

    async shouldExit(position: any, marketData: MarketData[]): Promise<boolean> {
        if (!marketData || marketData.length === 0) return false;

        const currentPrice = marketData[marketData.length - 1]?.close;
        if (!currentPrice) return false;

        // Check stop loss and take profit
        if (position.side === 'LONG') {
            if (currentPrice <= position.stopLoss || currentPrice >= position.takeProfit) {
                return true;
            }
        } else {
            if (currentPrice >= position.stopLoss || currentPrice <= position.takeProfit) {
                return true;
            }
        }

        // Check TensorFlow model prediction for exit
        try {
            if (marketData.length >= this.config.ml.lookbackPeriod && this.model && this.isTrained) {
                const features = this.extractFeatures(marketData);
                const { prediction } = await this.predict(features);

                // Exit if prediction contradicts current position
                const shouldExitLong = position.side === 'LONG' && prediction < 0.3;
                const shouldExitShort = position.side === 'SHORT' && prediction > 0.7;

                if (shouldExitLong || shouldExitShort) {
                    logger.info('TensorFlow Strategy exit signal', {
                        symbol: this.config.instruments[0] || 'UNKNOWN',
                        position: position.side,
                        prediction: (prediction * 100).toFixed(1) + '%'
                    });
                    return true;
                }
            }
        } catch (error) {
            logger.error('Error checking TensorFlow exit conditions:', error);
        }

        return false;
    }

    calculatePositionSize(signal: TradeSignal, capital: number): number {
        const confidence = signal.confidence || 0.5;
        const currentPrice = signal.price;
        const baseSize = this.config.risk.maxPositionSize * capital;
        const confidenceMultiplier = confidence * 2; // Scale confidence to 0-2
        return Math.floor((baseSize * confidenceMultiplier) / currentPrice);
    }

    protected calculateStopLoss(signal: TradeSignal, stopLossConfig: any): number {
        const currentPrice = signal.price;
        const stopLossPercent = this.config.risk.stopLoss / 100;
        return signal.action === 'BUY'
            ? currentPrice * (1 - stopLossPercent)
            : currentPrice * (1 + stopLossPercent);
    }

    protected calculateTakeProfit(signal: TradeSignal, takeProfitConfig: any): number {
        const currentPrice = signal.price;
        const takeProfitPercent = this.config.risk.takeProfit / 100;
        return signal.action === 'BUY'
            ? currentPrice * (1 + takeProfitPercent)
            : currentPrice * (1 - takeProfitPercent);
    }

    // Private methods
    private extractFeatures(marketData: MarketData[]): number[] {
        const features: number[] = [];
        const prices = marketData.map(d => d.close).filter((p): p is number => p !== null);
        const volumes = marketData.map(d => d.volume || 0);
        const highs = marketData.map(d => d.high || 0).filter(h => h > 0);
        const lows = marketData.map(d => d.low || 0).filter(l => l > 0);

        if (prices.length < 20) {
            // Return default features if insufficient data
            return new Array(20).fill(0.5);
        }

        // Basic technical indicators
        const smaValues = enhancedTechnicalIndicators.calculateSMA(prices, this.config.indicators.sma.period);
        features.push(smaValues.length > 0 ? (smaValues[smaValues.length - 1] ?? 0) : 0);

        const emaValues = enhancedTechnicalIndicators.calculateEMA(prices, this.config.indicators.ema.period);
        features.push(emaValues.length > 0 ? (emaValues[emaValues.length - 1] ?? 0) : 0);

        const rsiValues = enhancedTechnicalIndicators.calculateRSI(prices, this.config.indicators.rsi.period);
        features.push(rsiValues.length > 0 ? (rsiValues[rsiValues.length - 1] ?? 50) : 50);

        // MACD
        try {
            const macdResult = enhancedTechnicalIndicators.calculateMACD(
                prices,
                this.config.indicators.macd.fastPeriod,
                this.config.indicators.macd.slowPeriod
            );
            features.push(macdResult?.macd?.length > 0 ? (macdResult.macd[macdResult.macd.length - 1] ?? 0) : 0);
            features.push(macdResult?.signal?.length > 0 ? (macdResult.signal[macdResult.signal.length - 1] ?? 0) : 0);
            features.push(macdResult?.histogram?.length > 0 ? (macdResult.histogram[macdResult.histogram.length - 1] ?? 0) : 0);
        } catch (error) {
            features.push(0, 0, 0); // Default values for MACD
        }

        // Bollinger Bands
        try {
            const bbResult = enhancedTechnicalIndicators.calculateBollingerBands(
                prices,
                this.config.indicators.bollinger.period,
                this.config.indicators.bollinger.stdDev
            );
            features.push(bbResult?.upper?.length > 0 ? (bbResult.upper[bbResult.upper.length - 1] ?? 0) : 0);
            features.push(bbResult?.middle?.length > 0 ? (bbResult.middle[bbResult.middle.length - 1] ?? 0) : 0);
            features.push(bbResult?.lower?.length > 0 ? (bbResult.lower[bbResult.lower.length - 1] ?? 0) : 0);
            features.push(bbResult?.percentB?.length > 0 ? (bbResult.percentB[bbResult.percentB.length - 1] ?? 0) : 0);
        } catch (error) {
            features.push(0, 0, 0, 0); // Default values for Bollinger Bands
        }

        // ATR
        try {
            const atrValues = enhancedTechnicalIndicators.calculateATR(highs, lows, prices, this.config.indicators.atr.period);
            features.push(atrValues?.length > 0 ? (atrValues[atrValues.length - 1] ?? 0) : 0);
        } catch (error) {
            features.push(0); // Default value for ATR
        }

        // Volume features
        try {
            const volumeSMA = enhancedTechnicalIndicators.calculateSMA(volumes, 20);
            features.push(volumeSMA?.length > 0 ? (volumeSMA[volumeSMA.length - 1] ?? 0) : 0);
            features.push(this.calculateVolumeRatio(volumes));
        } catch (error) {
            features.push(0, 1); // Default values for volume features
        }

        // Price momentum features
        try {
            const momentum5 = enhancedTechnicalIndicators.calculateROC(prices, 5);
            features.push(momentum5?.length > 0 ? (momentum5[momentum5.length - 1] ?? 0) : 0);

            const momentum10 = enhancedTechnicalIndicators.calculateROC(prices, 10);
            features.push(momentum10?.length > 0 ? (momentum10[momentum10.length - 1] ?? 0) : 0);

            const momentum20 = enhancedTechnicalIndicators.calculateROC(prices, 20);
            features.push(momentum20?.length > 0 ? (momentum20[momentum20.length - 1] ?? 0) : 0);
        } catch (error) {
            features.push(0, 0, 0); // Default values for momentum features
        }

        // Volatility features
        features.push(this.calculatePriceVolatility(prices));

        // Normalize features
        return this.normalizeFeatures(features);
    }

    private calculateVolumeRatio(volumes: number[]): number {
        if (volumes.length < 20) return 1;
        const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        return avgVolume > 0 ? recentVolume / avgVolume : 1;
    }

    private calculatePriceVolatility(prices: number[]): number {
        if (prices.length < 20) return 0;
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            const current = prices[i];
            const previous = prices[i - 1];
            if (current && previous && previous > 0) {
                returns.push((current - previous) / previous);
            }
        }
        if (returns.length === 0) return 0;
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        return Math.sqrt(variance);
    }

    private normalizeFeatures(features: number[]): number[] {
        // Simple min-max normalization
        const min = Math.min(...features);
        const max = Math.max(...features);
        const range = max - min;

        return features.map(f => range > 0 ? (f - min) / range : 0.5);
    }

    private async predict(features: number[]): Promise<{ prediction: number; confidence: number }> {
        if (!this.model || !this.isTrained) {
            return { prediction: 0.5, confidence: 0 };
        }

        try {
            // Normalize features
            const normalizedFeatures = this.normalizeFeatures(features);
            const inputTensor = tf.tensor2d([normalizedFeatures]);

            // Make prediction
            const predictionTensor = this.model!.predict(inputTensor) as tf.Tensor;
            const predictionData = await predictionTensor.data();

            // Clean up tensors
            inputTensor.dispose();
            predictionTensor.dispose();

            const prediction = predictionData[0] || 0.5;
            const confidence = Math.abs(prediction - 0.5) * 2;

            return { prediction, confidence };
        } catch (error) {
            logger.error('Error in TensorFlow prediction:', error);
            return { prediction: 0.5, confidence: 0 };
        }
    }

    private async retrainModel(): Promise<void> {
        try {
            logger.info('Retraining TensorFlow model...');

            // Get historical data for training
            const historicalData = await this.getHistoricalMarketData();

            if (historicalData.length < this.config.ml.lookbackPeriod * 2) {
                logger.warn('Insufficient historical data for retraining');
                return;
            }

            // Prepare training data
            const trainingData: FeatureVector[] = [];

            for (let i = this.config.ml.lookbackPeriod; i < historicalData.length - this.config.ml.predictionHorizon; i++) {
                const windowData = historicalData.slice(i - this.config.ml.lookbackPeriod, i);
                const features = this.extractFeatures(windowData);

                // Calculate target (future price movement)
                const currentData = historicalData[i];
                const futureData = historicalData[i + this.config.ml.predictionHorizon];

                if (!currentData?.close || !futureData?.close) continue;

                const currentPrice = currentData.close;
                const futurePrice = futureData.close;
                const target = futurePrice > currentPrice ? 1 : 0;

                trainingData.push({
                    timestamp: currentData.timestamp,
                    features,
                    target,
                    price: currentPrice,
                    volume: currentData.volume || 0
                });
            }

            if (trainingData.length < 50) {
                logger.warn('Insufficient training data');
                return;
            }

            // Create model
            this.featureCount = trainingData[0]?.features?.length || 0;
            this.model = tf.sequential({
                layers: [
                    tf.layers.dense({
                        units: this.config.ml.hiddenLayers[0] || 64,
                        activation: 'relu',
                        inputShape: [this.featureCount]
                    }),
                    tf.layers.dropout({ rate: 0.3 }),
                    tf.layers.dense({
                        units: this.config.ml.hiddenLayers[1] || 32,
                        activation: 'relu'
                    }),
                    tf.layers.dropout({ rate: 0.2 }),
                    tf.layers.dense({
                        units: 1,
                        activation: 'sigmoid'
                    })
                ]
            });

            // Compile model
            this.model.compile({
                optimizer: tf.train.adam(this.config.ml.learningRate || 0.001),
                loss: 'binaryCrossentropy',
                metrics: ['accuracy']
            });

            // Prepare training data
            const X = trainingData.map(f => f.features);
            const y = trainingData.map(f => f.target);

            // Split data
            const splitIndex = Math.floor(X.length * 0.8);
            const trainX = X.slice(0, splitIndex);
            const trainY = y.slice(0, splitIndex);
            const valX = X.slice(splitIndex);
            const valY = y.slice(splitIndex);

            // Convert to tensors
            const trainXTensor = tf.tensor2d(trainX);
            const trainYTensor = tf.tensor2d(trainY, [trainY.length, 1]);
            const valXTensor = tf.tensor2d(valX);
            const valYTensor = tf.tensor2d(valY, [valY.length, 1]);

            // Train model
            await this.model.fit(trainXTensor, trainYTensor, {
                epochs: this.config.ml.epochs || 100,
                batchSize: 32,
                validationData: [valXTensor, valYTensor],
                callbacks: [
                    tf.callbacks.earlyStopping({
                        patience: 10,
                        restoreBestWeights: true
                    })
                ],
                verbose: 0
            });

            // Clean up tensors
            trainXTensor.dispose();
            trainYTensor.dispose();
            valXTensor.dispose();
            valYTensor.dispose();

            this.isTrained = true;
            this.lastTrainingTime = new Date();
            this.featureHistory = trainingData;

            // Calculate accuracy
            let correct = 0;
            for (const sample of trainingData) {
                const { prediction } = await this.predict(sample.features);
                const predictedClass = prediction > 0.5 ? 1 : 0;
                if (predictedClass === sample.target) correct++;
            }
            this.performanceMetrics.accuracy = correct / trainingData.length;

            logger.info('TensorFlow model trained successfully', {
                trainingSamples: trainingData.length,
                accuracy: (this.performanceMetrics.accuracy * 100).toFixed(2) + '%',
                features: this.featureCount
            });

        } catch (error) {
            logger.error('Error retraining TensorFlow model:', error);
        }
    }

    private async getHistoricalMarketData(): Promise<MarketData[]> {
        try {
            await this.dbManager.connect();
            const db = this.dbManager.getPrisma();

            const symbol = this.config.instruments[0];
            if (!symbol) return [];

            const instrument = await db.instrument.findFirst({
                where: { symbol, exchange: 'NSE' }
            });

            if (!instrument) return [];

            const candleData = await db.candleData.findMany({
                where: {
                    instrumentId: instrument.id,
                    timeframeId: { in: ['1day', '1hour', '30min'] }
                },
                orderBy: { timestamp: 'asc' },
                take: 1000
            });

            return candleData.map(cd => ({
                symbol: symbol,
                timestamp: cd.timestamp,
                open: cd.open,
                high: cd.high,
                low: cd.low,
                close: cd.close,
                volume: cd.volume
            }));

        } catch (error) {
            logger.error('Error getting historical market data:', error);
            return [];
        }
    }

    getState(): any {
        return {
            name: this.name,
            type: this.type,
            version: this.version,
            modelTrained: this.isTrained,
            lastTrainingTime: this.lastTrainingTime,
            featureHistoryLength: this.featureHistory.length,
            performanceMetrics: this.performanceMetrics,
            config: {
                indicators: this.config.indicators,
                ml: this.config.ml,
                risk: this.config.risk
            }
        };
    }

    getPerformance(): any {
        const winRate = this.performanceMetrics.totalSignals > 0
            ? (this.performanceMetrics.winningSignals / this.performanceMetrics.totalSignals) * 100
            : 0;

        return {
            name: this.name,
            type: this.type,
            version: this.version,
            totalSignals: this.performanceMetrics.totalSignals,
            winningSignals: this.performanceMetrics.winningSignals,
            losingSignals: this.performanceMetrics.losingSignals,
            winRate: winRate.toFixed(2) + '%',
            accuracy: (this.performanceMetrics.accuracy * 100).toFixed(2) + '%',
            totalPnL: this.performanceMetrics.totalPnL,
            averagePnL: this.performanceMetrics.totalSignals > 0
                ? (this.performanceMetrics.totalPnL / this.performanceMetrics.totalSignals).toFixed(2)
                : '0.00'
        };
    }

    getInstruments(): string[] {
        return this.config.instruments || [];
    }
} 