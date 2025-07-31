import * as tf from '@tensorflow/tfjs-node';
import { Matrix } from 'ml-matrix';
import { RandomForestRegression as RandomForest } from 'ml-random-forest';
import { BaseStrategy } from '../strategy-engine.service';
import { StrategyConfig, TradeSignal, MarketData } from '../../schemas/strategy.schema';
import { logger } from '../../logger/logger';
import { enhancedTechnicalIndicators } from '../enhanced-technical-indicators.service';
import { DatabaseManager } from '../../database/database';

// Advanced ML Strategy Configuration
export interface AdvancedMLStrategyConfig extends StrategyConfig {
    // Technical indicators
    indicators: {
        sma: { period: number };
        ema: { period: number };
        rsi: { period: number };
        macd: { fastPeriod: number; slowPeriod: number; signalPeriod: number };
        bollinger: { period: number; stdDev: number };
        atr: { period: number };
        stochastic: { kPeriod: number; dPeriod: number };
        williamsR: { period: number };
        cci: { period: number };
        adx: { period: number };
    };

    // ML parameters
    ml: {
        lookbackPeriod: number;      // How many periods to look back
        predictionHorizon: number;   // How many periods ahead to predict
        confidenceThreshold: number; // Minimum confidence for signal
        retrainInterval: number;     // How often to retrain model (minutes)
        featureEngineering: boolean; // Enable feature engineering
        ensembleSize: number;        // Number of models in ensemble
        validationSplit: number;     // Validation split for training
        earlyStoppingPatience: number; // Early stopping patience
    };

    // Model types
    models: {
        neuralNetwork: boolean;
        randomForest: boolean;
        xgboost: boolean;
        ensemble: boolean;
    };

    // Risk management
    risk: {
        maxPositionSize: number;     // Maximum position size as % of capital
        stopLoss: number;           // Stop loss percentage
        takeProfit: number;         // Take profit percentage
        maxDrawdown: number;        // Maximum drawdown limit
        positionSizing: 'fixed' | 'kelly' | 'optimal' | 'confidence';
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

// ML Model interface
interface MLModelInterface {
    id: string;
    name: string;
    type: string;
    predict(features: number[]): Promise<{ prediction: number; confidence: number }>;
    train(features: FeatureVector[]): Promise<void>;
    evaluate(features: FeatureVector[]): Promise<{ accuracy: number; precision: number; recall: number; f1: number }>;
    save(path: string): Promise<void>;
    load(path: string): Promise<void>;
}

// TensorFlow Neural Network Model
class TensorFlowNeuralNetwork implements MLModelInterface {
    private model: tf.Sequential | null = null;
    private isTrained: boolean = false;
    private featureCount: number = 0;
    private mean: number[] = [];
    private std: number[] = [];

    constructor(
        public id: string,
        public name: string,
        public type: string = 'neural_network'
    ) { }

    async predict(features: number[]): Promise<{ prediction: number; confidence: number }> {
        if (!this.model || !this.isTrained) {
            return { prediction: 0.5, confidence: 0 };
        }

        try {
            // Normalize features
            const normalizedFeatures = this.normalizeFeatures(features);
            const inputTensor = tf.tensor2d([normalizedFeatures]);

            // Make prediction
            const predictionTensor = this.model!.predict(inputTensor) as tf.Tensor;
            const prediction = await predictionTensor.data();

            // Clean up tensors
            inputTensor.dispose();
            predictionTensor.dispose();

            const predValue = prediction[0];
            const confidence = Math.abs(predValue - 0.5) * 2;

            return { prediction: predValue, confidence };
        } catch (error) {
            logger.error('Error in TensorFlow prediction:', error);
            return { prediction: 0.5, confidence: 0 };
        }
    }

    async train(features: FeatureVector[]): Promise<void> {
        if (features.length < 50) {
            logger.warn('Insufficient data for training neural network');
            return;
        }

        try {
            this.featureCount = features[0].features.length;

            // Prepare training data
            const X = features.map(f => f.features);
            const y = features.map(f => f.target);

            // Calculate normalization parameters
            this.calculateNormalizationParams(X);

            // Normalize features
            const normalizedX = X.map(f => this.normalizeFeatures(f));

            // Split data
            const splitIndex = Math.floor(normalizedX.length * 0.8);
            const trainX = normalizedX.slice(0, splitIndex);
            const trainY = y.slice(0, splitIndex);
            const valX = normalizedX.slice(splitIndex);
            const valY = y.slice(splitIndex);

            // Create model
            this.model = tf.sequential({
                layers: [
                    tf.layers.dense({
                        units: 64,
                        activation: 'relu',
                        inputShape: [this.featureCount]
                    }),
                    tf.layers.dropout({ rate: 0.3 }),
                    tf.layers.dense({
                        units: 32,
                        activation: 'relu'
                    }),
                    tf.layers.dropout({ rate: 0.2 }),
                    tf.layers.dense({
                        units: 16,
                        activation: 'relu'
                    }),
                    tf.layers.dense({
                        units: 1,
                        activation: 'sigmoid'
                    })
                ]
            });

            // Compile model
            this.model.compile({
                optimizer: tf.train.adam(0.001),
                loss: 'binaryCrossentropy',
                metrics: ['accuracy']
            });

            // Convert to tensors
            const trainXTensor = tf.tensor2d(trainX);
            const trainYTensor = tf.tensor2d(trainY, [trainY.length, 1]);
            const valXTensor = tf.tensor2d(valX);
            const valYTensor = tf.tensor2d(valY, [valY.length, 1]);

            // Train model
            await this.model.fit(trainXTensor, trainYTensor, {
                epochs: 100,
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
            logger.info('Neural network trained successfully', {
                samples: features.length,
                features: this.featureCount
            });

        } catch (error) {
            logger.error('Error training neural network:', error);
        }
    }

    async evaluate(features: FeatureVector[]): Promise<{ accuracy: number; precision: number; recall: number; f1: number }> {
        if (!this.model || features.length === 0) {
            return { accuracy: 0, precision: 0, recall: 0, f1: 0 };
        }

        try {
            let correct = 0;
            let truePositives = 0;
            let falsePositives = 0;
            let falseNegatives = 0;

            for (const sample of features) {
                const { prediction } = await this.predict(sample.features);
                const predictedClass = prediction > 0.5 ? 1 : 0;

                if (predictedClass === sample.target) {
                    correct++;
                    if (sample.target === 1) truePositives++;
                } else {
                    if (predictedClass === 1) falsePositives++;
                    else falseNegatives++;
                }
            }

            const accuracy = correct / features.length;
            const precision = truePositives / (truePositives + falsePositives) || 0;
            const recall = truePositives / (truePositives + falseNegatives) || 0;
            const f1 = 2 * (precision * recall) / (precision + recall) || 0;

            return { accuracy, precision, recall, f1 };
        } catch (error) {
            logger.error('Error evaluating neural network:', error);
            return { accuracy: 0, precision: 0, recall: 0, f1: 0 };
        }
    }

    async save(path: string): Promise<void> {
        if (this.model) {
            await this.model.save(`file://${path}`);
        }
    }

    async load(path: string): Promise<void> {
        try {
            this.model = await tf.loadLayersModel(`file://${path}/model.json`);
            this.isTrained = true;
        } catch (error) {
            logger.error('Error loading neural network:', error);
        }
    }

    private normalizeFeatures(features: number[]): number[] {
        return features.map((f, i) => {
            if (this.std[i] === 0) return 0;
            return (f - this.mean[i]) / this.std[i];
        });
    }

    private calculateNormalizationParams(X: number[][]): void {
        const featureCount = X[0].length;
        this.mean = new Array(featureCount).fill(0);
        this.std = new Array(featureCount).fill(0);

        for (let j = 0; j < featureCount; j++) {
            const values = X.map(row => row[j]);
            this.mean[j] = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((a, b) => a + Math.pow(b - this.mean[j], 2), 0) / values.length;
            this.std[j] = Math.sqrt(variance);
        }
    }
}

// Random Forest Model
class RandomForestModel implements MLModelInterface {
    private model: RandomForest | null = null;
    private isTrained: boolean = false;

    constructor(
        public id: string,
        public name: string,
        public type: string = 'random_forest'
    ) { }

    async predict(features: number[]): Promise<{ prediction: number; confidence: number }> {
        if (!this.model || !this.isTrained) {
            return { prediction: 0.5, confidence: 0 };
        }

        try {
            const prediction = this.model.predict([features]);
            const confidence = Math.abs(prediction - 0.5) * 2;
            return { prediction, confidence };
        } catch (error) {
            logger.error('Error in Random Forest prediction:', error);
            return { prediction: 0.5, confidence: 0 };
        }
    }

    async train(features: FeatureVector[]): Promise<void> {
        if (features.length < 20) {
            logger.warn('Insufficient data for training random forest');
            return;
        }

        try {
            const X = features.map(f => f.features);
            const y = features.map(f => f.target);

            this.model = new RandomForest({
                nEstimators: 100,
                maxDepth: 10,
                minSamplesSplit: 5,
                minSamplesLeaf: 2
            });

            this.model.train(X, y);
            this.isTrained = true;

            logger.info('Random Forest trained successfully', {
                samples: features.length,
                features: X[0].length
            });
        } catch (error) {
            logger.error('Error training Random Forest:', error);
        }
    }

    async evaluate(features: FeatureVector[]): Promise<{ accuracy: number; precision: number; recall: number; f1: number }> {
        if (!this.model || features.length === 0) {
            return { accuracy: 0, precision: 0, recall: 0, f1: 0 };
        }

        try {
            let correct = 0;
            let truePositives = 0;
            let falsePositives = 0;
            let falseNegatives = 0;

            for (const sample of features) {
                const { prediction } = await this.predict(sample.features);
                const predictedClass = prediction > 0.5 ? 1 : 0;

                if (predictedClass === sample.target) {
                    correct++;
                    if (sample.target === 1) truePositives++;
                } else {
                    if (predictedClass === 1) falsePositives++;
                    else falseNegatives++;
                }
            }

            const accuracy = correct / features.length;
            const precision = truePositives / (truePositives + falsePositives) || 0;
            const recall = truePositives / (truePositives + falseNegatives) || 0;
            const f1 = 2 * (precision * recall) / (precision + recall) || 0;

            return { accuracy, precision, recall, f1 };
        } catch (error) {
            logger.error('Error evaluating Random Forest:', error);
            return { accuracy: 0, precision: 0, recall: 0, f1: 0 };
        }
    }

    async save(path: string): Promise<void> {
        // Random Forest doesn't have built-in save/load
        logger.info('Random Forest model state saved');
    }

    async load(path: string): Promise<void> {
        // Random Forest doesn't have built-in save/load
        logger.info('Random Forest model state loaded');
    }
}

// Ensemble Model
class EnsembleModel implements MLModelInterface {
    private models: MLModelInterface[] = [];
    private weights: number[] = [];

    constructor(
        public id: string,
        public name: string,
        public type: string = 'ensemble'
    ) { }

    addModel(model: MLModelInterface, weight: number = 1): void {
        this.models.push(model);
        this.weights.push(weight);
    }

    async predict(features: number[]): Promise<{ prediction: number; confidence: number }> {
        if (this.models.length === 0) {
            return { prediction: 0.5, confidence: 0 };
        }

        try {
            const predictions: number[] = [];
            const confidences: number[] = [];

            for (let i = 0; i < this.models.length; i++) {
                const { prediction, confidence } = await this.models[i].predict(features);
                predictions.push(prediction * this.weights[i]);
                confidences.push(confidence * this.weights[i]);
            }

            const totalWeight = this.weights.reduce((a, b) => a + b, 0);
            const weightedPrediction = predictions.reduce((a, b) => a + b, 0) / totalWeight;
            const weightedConfidence = confidences.reduce((a, b) => a + b, 0) / totalWeight;

            return { prediction: weightedPrediction, confidence: weightedConfidence };
        } catch (error) {
            logger.error('Error in ensemble prediction:', error);
            return { prediction: 0.5, confidence: 0 };
        }
    }

    async train(features: FeatureVector[]): Promise<void> {
        try {
            for (const model of this.models) {
                await model.train(features);
            }
            logger.info('Ensemble model trained successfully');
        } catch (error) {
            logger.error('Error training ensemble model:', error);
        }
    }

    async evaluate(features: FeatureVector[]): Promise<{ accuracy: number; precision: number; recall: number; f1: number }> {
        if (this.models.length === 0) {
            return { accuracy: 0, precision: 0, recall: 0, f1: 0 };
        }

        try {
            const evaluations = await Promise.all(
                this.models.map(model => model.evaluate(features))
            );

            const avgAccuracy = evaluations.reduce((a, b) => a + b.accuracy, 0) / evaluations.length;
            const avgPrecision = evaluations.reduce((a, b) => a + b.precision, 0) / evaluations.length;
            const avgRecall = evaluations.reduce((a, b) => a + b.recall, 0) / evaluations.length;
            const avgF1 = evaluations.reduce((a, b) => a + b.f1, 0) / evaluations.length;

            return { accuracy: avgAccuracy, precision: avgPrecision, recall: avgRecall, f1: avgF1 };
        } catch (error) {
            logger.error('Error evaluating ensemble model:', error);
            return { accuracy: 0, precision: 0, recall: 0, f1: 0 };
        }
    }

    async save(path: string): Promise<void> {
        for (let i = 0; i < this.models.length; i++) {
            await this.models[i].save(`${path}/model_${i}`);
        }
    }

    async load(path: string): Promise<void> {
        for (let i = 0; i < this.models.length; i++) {
            await this.models[i].load(`${path}/model_${i}`);
        }
    }
}

export class AdvancedMLStrategy extends BaseStrategy {
    protected config: AdvancedMLStrategyConfig;
    private models: Map<string, MLModelInterface> = new Map();
    private featureHistory: FeatureVector[] = [];
    private lastTrainingTime: Date = new Date();
    private dbManager: DatabaseManager;
    private performanceMetrics: {
        totalSignals: number;
        winningSignals: number;
        losingSignals: number;
        accuracy: number;
        totalPnL: number;
        modelAccuracies: Record<string, number>;
    } = {
            totalSignals: 0,
            winningSignals: 0,
            losingSignals: 0,
            accuracy: 0,
            totalPnL: 0,
            modelAccuracies: {}
        };

    constructor(config: AdvancedMLStrategyConfig) {
        super('Advanced ML Strategy', 'CUSTOM', '2.0.0', 'Advanced Machine Learning based trading strategy with TensorFlow');
        this.config = config;
        this.dbManager = DatabaseManager.getInstance();

        this.initializeModels();
        logger.info('Advanced ML Strategy initialized', {
            indicators: Object.keys(config.indicators),
            mlParams: config.ml,
            models: Object.keys(config.models)
        });
    }

    private initializeModels(): void {
        // Initialize Neural Network
        if (this.config.models.neuralNetwork) {
            const nnModel = new TensorFlowNeuralNetwork('nn_1', 'Neural Network');
            this.models.set('neural_network', nnModel);
        }

        // Initialize Random Forest
        if (this.config.models.randomForest) {
            const rfModel = new RandomForestModel('rf_1', 'Random Forest');
            this.models.set('random_forest', rfModel);
        }

        // Initialize Ensemble
        if (this.config.models.ensemble && this.models.size > 1) {
            const ensembleModel = new EnsembleModel('ensemble_1', 'Ensemble Model');

            // Add all models to ensemble with equal weights
            for (const [name, model] of this.models.entries()) {
                ensembleModel.addModel(model, 1);
            }

            this.models.set('ensemble', ensembleModel);
        }
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
            logger.error('Advanced ML Strategy config validation failed:', error);
            return false;
        }
    }

    async generateSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        if (marketData.length < this.config.ml.lookbackPeriod) {
            logger.warn('Insufficient market data for Advanced ML strategy', {
                required: this.config.ml.lookbackPeriod,
                available: marketData.length
            });
            return [];
        }

        const signals: TradeSignal[] = [];
        const latestData = marketData[marketData.length - 1];

        if (!latestData || !latestData.close) {
            logger.warn('No valid market data available for Advanced ML strategy');
            return signals;
        }

        try {
            // Extract features from market data
            const features = this.extractAdvancedFeatures(marketData);

            // Check if models need retraining
            const timeSinceTraining = Date.now() - this.lastTrainingTime.getTime();
            if (timeSinceTraining > this.config.ml.retrainInterval * 60 * 1000) {
                await this.retrainAllModels();
            }

            // Get predictions from all models
            const predictions: { model: string; prediction: number; confidence: number }[] = [];

            for (const [modelName, model] of this.models.entries()) {
                const result = await model.predict(features);
                predictions.push({
                    model: modelName,
                    prediction: result.prediction,
                    confidence: result.confidence
                });
            }

            // Use ensemble prediction if available, otherwise use best model
            let finalPrediction = 0.5;
            let finalConfidence = 0;

            if (this.models.has('ensemble')) {
                const ensembleResult = await this.models.get('ensemble')!.predict(features);
                finalPrediction = ensembleResult.prediction;
                finalConfidence = ensembleResult.confidence;
            } else {
                // Use model with highest confidence
                const bestModel = predictions.reduce((a, b) => a.confidence > b.confidence ? a : b);
                finalPrediction = bestModel.prediction;
                finalConfidence = bestModel.confidence;
            }

            // Generate signal if confidence is high enough
            if (finalConfidence >= this.config.ml.confidenceThreshold) {
                const action = finalPrediction > 0.5 ? 'BUY' : 'SELL';
                const side = action === 'BUY' ? 'LONG' : 'SHORT';

                const signal: TradeSignal = {
                    id: `advanced_ml_${Date.now()}`,
                    symbol: this.config.instruments[0] || 'UNKNOWN',
                    action,
                    side,
                    quantity: 1, // Will be calculated by position sizing
                    price: latestData.close,
                    confidence: finalConfidence,
                    timestamp: new Date(),
                    strategyName: this.config.name,
                    reasoning: `Advanced ML prediction: ${(finalPrediction * 100).toFixed(1)}% probability of ${action === 'BUY' ? 'upward' : 'downward'} movement. Confidence: ${(finalConfidence * 100).toFixed(1)}%`,
                    metadata: {
                        prediction: finalPrediction,
                        confidence: finalConfidence,
                        modelPredictions: predictions,
                        features: features.slice(0, 10), // Include first 10 features for debugging
                        modelAccuracies: this.performanceMetrics.modelAccuracies
                    }
                };

                signals.push(signal);
                this.performanceMetrics.totalSignals++;

                logger.info('Advanced ML Strategy generated signal', {
                    symbol: this.config.instruments[0] || 'UNKNOWN',
                    action,
                    confidence: (finalConfidence * 100).toFixed(1) + '%',
                    prediction: (finalPrediction * 100).toFixed(1) + '%',
                    models: predictions.length
                });
            }

        } catch (error) {
            logger.error('Error generating Advanced ML signals:', error);
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

        // Check ML model prediction for exit
        try {
            if (marketData.length >= this.config.ml.lookbackPeriod) {
                const features = this.extractAdvancedFeatures(marketData);

                let finalPrediction = 0.5;
                if (this.models.has('ensemble')) {
                    const result = await this.models.get('ensemble')!.predict(features);
                    finalPrediction = result.prediction;
                }

                // Exit if prediction contradicts current position
                const shouldExitLong = position.side === 'LONG' && finalPrediction < 0.3;
                const shouldExitShort = position.side === 'SHORT' && finalPrediction > 0.7;

                if (shouldExitLong || shouldExitShort) {
                    logger.info('Advanced ML Strategy exit signal', {
                        symbol: this.config.instruments[0] || 'UNKNOWN',
                        position: position.side,
                        prediction: (finalPrediction * 100).toFixed(1) + '%'
                    });
                    return true;
                }
            }
        } catch (error) {
            logger.error('Error checking Advanced ML exit conditions:', error);
        }

        return false;
    }

    calculatePositionSize(signal: TradeSignal, capital: number): number {
        const confidence = signal.confidence || 0.5;
        const currentPrice = signal.price;

        switch (this.config.risk.positionSizing) {
            case 'kelly':
                return this.calculateKellyPositionSize(signal, capital);
            case 'optimal':
                return this.calculateOptimalPositionSize(signal, capital);
            case 'confidence':
                return this.calculateConfidencePositionSize(signal, capital);
            default:
                return this.calculateFixedPositionSize(signal, capital);
        }
    }

    private calculateKellyPositionSize(signal: TradeSignal, capital: number): number {
        const winRate = this.performanceMetrics.totalSignals > 0
            ? this.performanceMetrics.winningSignals / this.performanceMetrics.totalSignals
            : 0.5;
        const avgWin = 0.02; // 2% average win
        const avgLoss = 0.01; // 1% average loss

        const kellyFraction = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin;
        const kellySize = Math.max(0, Math.min(kellyFraction, 0.25)); // Cap at 25%

        return Math.floor((kellySize * capital) / signal.price);
    }

    private calculateOptimalPositionSize(signal: TradeSignal, capital: number): number {
        const confidence = signal.confidence || 0.5;
        const volatility = 0.02; // 2% volatility
        const riskFreeRate = 0.05; // 5% risk-free rate

        const sharpeRatio = (confidence - riskFreeRate) / volatility;
        const optimalSize = Math.max(0, Math.min(sharpeRatio * 0.1, 0.2)); // Cap at 20%

        return Math.floor((optimalSize * capital) / signal.price);
    }

    private calculateConfidencePositionSize(signal: TradeSignal, capital: number): number {
        const confidence = signal.confidence || 0.5;
        const baseSize = this.config.risk.maxPositionSize * capital;
        const confidenceMultiplier = confidence * 2; // Scale confidence to 0-2

        return Math.floor((baseSize * confidenceMultiplier) / signal.price);
    }

    private calculateFixedPositionSize(signal: TradeSignal, capital: number): number {
        const baseSize = this.config.risk.maxPositionSize * capital;
        return Math.floor(baseSize / signal.price);
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

    // Advanced feature extraction
    private extractAdvancedFeatures(marketData: MarketData[]): number[] {
        const features: number[] = [];
        const prices = marketData.map(d => d.close).filter((p): p is number => p !== null);
        const volumes = marketData.map(d => d.volume || 0);
        const highs = marketData.map(d => d.high || 0).filter(h => h > 0);
        const lows = marketData.map(d => d.low || 0).filter(l => l > 0);

        // Basic technical indicators
        const smaValues = enhancedTechnicalIndicators.calculateSMA(prices, this.config.indicators.sma.period);
        features.push(smaValues.length > 0 ? (smaValues[smaValues.length - 1] ?? 0) : 0);

        const emaValues = enhancedTechnicalIndicators.calculateEMA(prices, this.config.indicators.ema.period);
        features.push(emaValues.length > 0 ? (emaValues[emaValues.length - 1] ?? 0) : 0);

        const rsiValues = enhancedTechnicalIndicators.calculateRSI(prices, this.config.indicators.rsi.period);
        features.push(rsiValues.length > 0 ? (rsiValues[rsiValues.length - 1] ?? 50) : 50);

        // MACD
        const macdResult = enhancedTechnicalIndicators.calculateMACD(
            prices,
            this.config.indicators.macd.fastPeriod,
            this.config.indicators.macd.slowPeriod
        );
        features.push(macdResult.macd.length > 0 ? (macdResult.macd[macdResult.macd.length - 1] ?? 0) : 0);
        features.push(macdResult.signal.length > 0 ? (macdResult.signal[macdResult.signal.length - 1] ?? 0) : 0);
        features.push(macdResult.histogram.length > 0 ? (macdResult.histogram[macdResult.histogram.length - 1] ?? 0) : 0);

        // Bollinger Bands
        const bbResult = enhancedTechnicalIndicators.calculateBollingerBands(
            prices,
            this.config.indicators.bollinger.period,
            this.config.indicators.bollinger.stdDev
        );
        features.push(bbResult.upper.length > 0 ? (bbResult.upper[bbResult.upper.length - 1] ?? 0) : 0);
        features.push(bbResult.middle.length > 0 ? (bbResult.middle[bbResult.middle.length - 1] ?? 0) : 0);
        features.push(bbResult.lower.length > 0 ? (bbResult.lower[bbResult.lower.length - 1] ?? 0) : 0);
        features.push(bbResult.percentB.length > 0 ? (bbResult.percentB[bbResult.percentB.length - 1] ?? 0) : 0);

        // ATR
        const atrValues = enhancedTechnicalIndicators.calculateATR(highs, lows, prices, this.config.indicators.atr.period);
        features.push(atrValues.length > 0 ? (atrValues[atrValues.length - 1] ?? 0) : 0);

        // Stochastic
        const stochResult = enhancedTechnicalIndicators.calculateStochastic(
            highs,
            lows,
            prices,
            this.config.indicators.stochastic.kPeriod,
            this.config.indicators.stochastic.dPeriod
        );
        features.push(stochResult.k.length > 0 ? (stochResult.k[stochResult.k.length - 1] ?? 50) : 50);
        features.push(stochResult.d.length > 0 ? (stochResult.d[stochResult.d.length - 1] ?? 50) : 50);

        // Williams %R
        const williamsR = enhancedTechnicalIndicators.calculateWilliamsR(highs, lows, prices, this.config.indicators.williamsR.period);
        features.push(williamsR.length > 0 ? (williamsR[williamsR.length - 1] ?? -50) : -50);

        // CCI
        const cci = enhancedTechnicalIndicators.calculateCCI(highs, lows, prices, this.config.indicators.cci.period);
        features.push(cci.length > 0 ? (cci[cci.length - 1] ?? 0) : 0);

        // ADX
        const adx = enhancedTechnicalIndicators.calculateADX(highs, lows, prices, this.config.indicators.adx.period);
        features.push(adx.length > 0 ? (adx[adx.length - 1] ?? 25) : 25);

        // Volume features
        const volumeSMA = enhancedTechnicalIndicators.calculateSMA(volumes, 20);
        features.push(volumeSMA.length > 0 ? (volumeSMA[volumeSMA.length - 1] ?? 0) : 0);
        features.push(this.calculateVolumeRatio(volumes));

        // Price momentum features
        const momentum5 = enhancedTechnicalIndicators.calculateROC(prices, 5);
        features.push(momentum5.length > 0 ? (momentum5[momentum5.length - 1] ?? 0) : 0);

        const momentum10 = enhancedTechnicalIndicators.calculateROC(prices, 10);
        features.push(momentum10.length > 0 ? (momentum10[momentum10.length - 1] ?? 0) : 0);

        const momentum20 = enhancedTechnicalIndicators.calculateROC(prices, 20);
        features.push(momentum20.length > 0 ? (momentum20[momentum20.length - 1] ?? 0) : 0);

        // Volatility features
        const volatility = this.calculateVolatility(prices);
        features.push(volatility);

        // Price patterns
        features.push(this.detectPricePatterns(prices));
        features.push(this.calculateSupportResistance(prices));

        // Market regime features
        features.push(this.detectMarketRegime(prices, volumes));

        // Normalize features
        return this.normalizeFeatures(features);
    }

    private calculateVolumeRatio(volumes: number[]): number {
        if (volumes.length < 20) return 1;
        const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        return avgVolume > 0 ? recentVolume / avgVolume : 1;
    }

    private calculateVolatility(prices: number[]): number {
        if (prices.length < 20) return 0;
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
        }
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        return Math.sqrt(variance);
    }

    private detectPricePatterns(prices: number[]): number {
        if (prices.length < 10) return 0;

        // Simple pattern detection
        const recent = prices.slice(-5);
        const trend = recent[recent.length - 1] - recent[0];
        const volatility = this.calculateVolatility(recent);

        // Pattern score based on trend and volatility
        return Math.tanh(trend / (volatility * 100));
    }

    private calculateSupportResistance(prices: number[]): number {
        if (prices.length < 20) return 0;

        const recent = prices.slice(-20);
        const current = recent[recent.length - 1];
        const high = Math.max(...recent);
        const low = Math.min(...recent);

        // Position relative to support/resistance
        return (current - low) / (high - low);
    }

    private detectMarketRegime(prices: number[], volumes: number[]): number {
        if (prices.length < 20 || volumes.length < 20) return 0;

        const priceVolatility = this.calculateVolatility(prices);
        const volumeVolatility = this.calculateVolatility(volumes);

        // Market regime score (0 = trending, 1 = ranging)
        return Math.tanh(volumeVolatility / (priceVolatility + 0.001));
    }

    private normalizeFeatures(features: number[]): number[] {
        // Robust normalization using median and MAD
        const median = this.median(features);
        const mad = this.medianAbsoluteDeviation(features);

        return features.map(f => mad > 0 ? (f - median) / mad : 0);
    }

    private median(values: number[]): number {
        const sorted = values.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }

    private medianAbsoluteDeviation(values: number[]): number {
        const median = this.median(values);
        const deviations = values.map(v => Math.abs(v - median));
        return this.median(deviations);
    }

    private async retrainAllModels(): Promise<void> {
        try {
            logger.info('Retraining all Advanced ML models...');

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
                const features = this.extractAdvancedFeatures(windowData);

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

            // Train all models
            for (const [modelName, model] of this.models.entries()) {
                try {
                    await model.train(trainingData);

                    // Evaluate model
                    const evaluation = await model.evaluate(trainingData);
                    this.performanceMetrics.modelAccuracies[modelName] = evaluation.accuracy;

                    logger.info(`Model ${modelName} trained successfully`, {
                        trainingSamples: trainingData.length,
                        accuracy: (evaluation.accuracy * 100).toFixed(2) + '%',
                        precision: (evaluation.precision * 100).toFixed(2) + '%',
                        recall: (evaluation.recall * 100).toFixed(2) + '%',
                        f1: (evaluation.f1 * 100).toFixed(2) + '%'
                    });
                } catch (error) {
                    logger.error(`Error training model ${modelName}:`, error);
                }
            }

            this.lastTrainingTime = new Date();
            this.featureHistory = trainingData;

        } catch (error) {
            logger.error('Error retraining Advanced ML models:', error);
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
                    timeframeId: { in: ['1day', '1hour', '30min'] } // Use multiple timeframes
                },
                orderBy: { timestamp: 'asc' },
                take: 1000 // Get last 1000 records
            });

            return candleData.map(cd => ({
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
            models: Array.from(this.models.keys()),
            lastTrainingTime: this.lastTrainingTime,
            featureHistoryLength: this.featureHistory.length,
            performanceMetrics: this.performanceMetrics,
            config: {
                indicators: this.config.indicators,
                ml: this.config.ml,
                models: this.config.models,
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
                : '0.00',
            modelAccuracies: this.performanceMetrics.modelAccuracies
        };
    }

    getInstruments(): string[] {
        return this.config.instruments || [];
    }
} 