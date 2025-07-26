import { BaseStrategy } from '../strategy-engine.service';
import { StrategyConfig, TradeSignal, MarketData } from '../../schemas/strategy.schema';
import { logger } from '../../logger/logger';

// ML Strategy Configuration
export interface MLStrategyConfig extends StrategyConfig {
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
        retrainInterval: number;     // How often to retrain model
        featureEngineering: boolean; // Enable feature engineering
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
}

// ML Model interface
interface MLModel {
    predict(features: number[]): { prediction: number; confidence: number };
    train(features: FeatureVector[]): void;
    evaluate(features: FeatureVector[]): { accuracy: number; precision: number; recall: number };
}

// Simple ML model implementation (you can replace with TensorFlow.js, ML5.js, etc.)
class SimpleMLModel implements MLModel {
    private weights: number[] = [];
    private bias: number = 0;
    private isTrained: boolean = false;

    predict(features: number[]): { prediction: number; confidence: number } {
        if (!this.isTrained || this.weights.length !== features.length) {
            return { prediction: 0.5, confidence: 0 };
        }

        // Simple linear model: y = wx + b
        let prediction = this.bias;
        for (let i = 0; i < features.length; i++) {
            prediction += (this.weights[i] || 0) * (features[i] || 0);
        }

        // Sigmoid activation
        prediction = 1 / (1 + Math.exp(-prediction));

        // Calculate confidence based on distance from 0.5
        const confidence = Math.abs(prediction - 0.5) * 2;

        return { prediction, confidence };
    }

    train(features: FeatureVector[]): void {
        if (features.length === 0) return;

        const numFeatures = features[0]?.features?.length || 0;
        this.weights = new Array(numFeatures).fill(0);
        this.bias = 0;

        // Simple gradient descent training
        const learningRate = 0.01;
        const epochs = 100;

        for (let epoch = 0; epoch < epochs; epoch++) {
            for (const sample of features) {
                const { prediction } = this.predict(sample.features);
                const error = sample.target - prediction;

                // Update weights
                for (let i = 0; i < numFeatures; i++) {
                    this.weights[i] = (this.weights[i] || 0) + learningRate * error * (sample.features[i] || 0);
                }
                this.bias += learningRate * error;
            }
        }

        this.isTrained = true;
        logger.info('ML model trained successfully', {
            samples: features.length,
            features: numFeatures
        });
    }

    evaluate(features: FeatureVector[]): { accuracy: number; precision: number; recall: number } {
        if (features.length === 0) return { accuracy: 0, precision: 0, recall: 0 };

        let correct = 0;
        let truePositives = 0;
        let falsePositives = 0;
        let falseNegatives = 0;

        for (const sample of features) {
            const { prediction } = this.predict(sample.features);
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

        return { accuracy, precision, recall };
    }
}

export class MLStrategy extends BaseStrategy {
    protected config: MLStrategyConfig;
    private model: MLModel;
    private featureHistory: FeatureVector[] = [];
    private lastTrainingTime: Date = new Date();
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

    constructor(config: MLStrategyConfig) {
        super('ML Strategy', 'CUSTOM', '1.0.0', 'Machine Learning based trading strategy');
        this.config = config;
        this.model = new SimpleMLModel();

        logger.info('ML Strategy initialized', {
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
            logger.error('ML Strategy config validation failed:', error);
            return false;
        }
    }

    async generateSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        if (marketData.length < this.config.ml.lookbackPeriod) {
            logger.warn('Insufficient market data for ML strategy', {
                required: this.config.ml.lookbackPeriod,
                available: marketData.length
            });
            return [];
        }

        const signals: TradeSignal[] = [];
        const latestData = marketData[marketData.length - 1];

        if (!latestData || !latestData.close) {
            logger.warn('No valid market data available for ML strategy');
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

            // Make prediction
            const { prediction, confidence } = this.model.predict(features);

            // Generate signal if confidence is high enough
            if (confidence >= this.config.ml.confidenceThreshold) {
                const action = prediction > 0.5 ? 'BUY' : 'SELL';
                const side = action === 'BUY' ? 'LONG' : 'SHORT';

                // Create a temporary signal for calculations
                const tempSignal: TradeSignal = {
                    id: `temp_${Date.now()}`,
                    symbol: this.config.instruments[0] || 'UNKNOWN',
                    action,
                    side,
                    quantity: 1,
                    price: latestData.close,
                    confidence,
                    timestamp: new Date(),
                    strategyName: this.config.name
                };

                // Calculate position size based on confidence and risk
                const positionSize = this.calculatePositionSize(tempSignal, 100000); // Assuming 100k capital

                // Calculate stop loss and take profit
                const stopLoss = this.calculateStopLoss(tempSignal, {});
                const takeProfit = this.calculateTakeProfit(tempSignal, {});

                const signal: TradeSignal = {
                    id: `ml_${Date.now()}`,
                    symbol: this.config.instruments[0] || 'UNKNOWN',
                    action,
                    side,
                    quantity: positionSize,
                    price: latestData.close,
                    confidence,
                    timestamp: new Date(),
                    strategyName: this.config.name,
                    stopLoss,
                    takeProfit,
                    reasoning: `ML prediction: ${(prediction * 100).toFixed(1)}% probability of ${action === 'BUY' ? 'upward' : 'downward'} movement. Confidence: ${(confidence * 100).toFixed(1)}%`,
                    metadata: {
                        prediction,
                        confidence,
                        features: features.slice(0, 5), // Include first 5 features for debugging
                        modelAccuracy: this.performanceMetrics.accuracy
                    }
                };

                signals.push(signal);
                this.performanceMetrics.totalSignals++;

                logger.info('ML Strategy generated signal', {
                    symbol: this.config.instruments[0] || 'UNKNOWN',
                    action,
                    confidence: (confidence * 100).toFixed(1) + '%',
                    prediction: (prediction * 100).toFixed(1) + '%'
                });
            }

        } catch (error) {
            logger.error('Error generating ML signals:', error);
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
                const features = this.extractFeatures(marketData);
                const { prediction, confidence } = this.model.predict(features);

                // Exit if prediction contradicts current position
                const shouldExitLong = position.side === 'LONG' && prediction < 0.3 && confidence > 0.7;
                const shouldExitShort = position.side === 'SHORT' && prediction > 0.7 && confidence > 0.7;

                if (shouldExitLong || shouldExitShort) {
                    logger.info('ML Strategy exit signal', {
                        symbol: this.config.instruments[0] || 'UNKNOWN',
                        position: position.side,
                        prediction: (prediction * 100).toFixed(1) + '%',
                        confidence: (confidence * 100).toFixed(1) + '%'
                    });
                    return true;
                }
            }
        } catch (error) {
            logger.error('Error checking ML exit conditions:', error);
        }

        return false;
    }

    getState(): any {
        return {
            name: this.name,
            type: this.type,
            version: this.version,
            modelTrained: this.model instanceof SimpleMLModel,
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

    // Private methods
    private extractFeatures(marketData: MarketData[]): number[] {
        const features: number[] = [];
        const prices = marketData.map(d => d.close).filter((p): p is number => p !== null);
        const volumes = marketData.map(d => d.volume || 0);

        // Price-based features
        features.push(this.calculateSMA(prices, this.config.indicators.sma.period));
        features.push(this.calculateEMA(prices, this.config.indicators.ema.period));
        features.push(this.calculateRSI(marketData, this.config.indicators.rsi.period));

        const macd = this.calculateMACD(marketData, this.config.indicators.macd.fastPeriod,
            this.config.indicators.macd.slowPeriod);
        features.push(macd);
        features.push(macd * 0.8); // Approximate signal line
        features.push(macd * 0.2); // Approximate histogram

        const bb = this.calculateBollingerBands(prices, this.config.indicators.bollinger.period,
            this.config.indicators.bollinger.stdDev);
        features.push(bb.upper);
        features.push(bb.middle);
        features.push(bb.lower);
        features.push(bb.percentB);

        features.push(this.calculateATR(this.config.instruments[0] || 'UNKNOWN'));

        // Volume-based features
        features.push(this.calculateVolumeSMA(volumes, 20));
        features.push(this.calculateVolumeRatio(volumes));

        // Price momentum features
        features.push(this.calculatePriceMomentum(prices, 5));
        features.push(this.calculatePriceMomentum(prices, 10));
        features.push(this.calculatePriceMomentum(prices, 20));

        // Volatility features
        features.push(this.calculateVolatility(this.config.instruments[0] || 'UNKNOWN'));
        features.push(this.calculateVolatility(this.config.instruments[0] || 'UNKNOWN') * 0.8); // Approximate different period

        // Normalize features
        return this.normalizeFeatures(features);
    }

    private async retrainModel(): Promise<void> {
        try {
            logger.info('Retraining ML model...');

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
                    target
                });
            }

            // Train model
            this.model.train(trainingData);
            this.lastTrainingTime = new Date();

            // Evaluate model
            const evaluation = this.model.evaluate(trainingData);
            this.performanceMetrics.accuracy = evaluation.accuracy;

            logger.info('ML model retrained successfully', {
                trainingSamples: trainingData.length,
                accuracy: (evaluation.accuracy * 100).toFixed(2) + '%',
                precision: (evaluation.precision * 100).toFixed(2) + '%',
                recall: (evaluation.recall * 100).toFixed(2) + '%'
            });

        } catch (error) {
            logger.error('Error retraining ML model:', error);
        }
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

    // Technical indicator calculations
    private calculateSMA(prices: number[], period: number): number {
        if (prices.length < period) return prices[prices.length - 1] || 0;
        const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }

    private calculateEMA(prices: number[], period: number): number {
        if (prices.length < period) return prices[prices.length - 1] || 0;
        const multiplier = 2 / (period + 1);
        let ema = prices[0] || 0;
        for (let i = 1; i < prices.length; i++) {
            ema = ((prices[i] || 0) * multiplier) + (ema * (1 - multiplier));
        }
        return ema;
    }

    protected calculateRSI(data: MarketData[], period: number): number {
        const prices = data.map(d => d.close).filter((p): p is number => p !== null);
        if (prices.length < period + 1) return 50;

        let gains = 0;
        let losses = 0;

        for (let i = 1; i <= period; i++) {
            const currentPrice = prices[prices.length - i] || 0;
            const prevPrice = prices[prices.length - i - 1] || 0;
            const change = currentPrice - prevPrice;
            if (change > 0) gains += change;
            else losses -= change;
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    protected calculateMACD(data: MarketData[], fastPeriod: number, slowPeriod: number): number {
        const prices = data.map(d => d.close).filter((p): p is number => p !== null);
        const fastEMA = this.calculateEMA(prices, fastPeriod);
        const slowEMA = this.calculateEMA(prices, slowPeriod);
        const macd = fastEMA - slowEMA;

        return macd;
    }

    private calculateBollingerBands(prices: number[], period: number, stdDev: number): { upper: number; middle: number; lower: number; percentB: number } {
        const sma = this.calculateSMA(prices, period);
        const variance = prices.slice(-period).reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
        const standardDeviation = Math.sqrt(variance);

        const upper = sma + (standardDeviation * stdDev);
        const lower = sma - (standardDeviation * stdDev);
        const currentPrice = prices[prices.length - 1] || 0;
        const percentB = (currentPrice - lower) / (upper - lower);

        return { upper, middle: sma, lower, percentB };
    }

    protected calculateATR(symbol: string): number {
        // This should be implemented to get market data for the symbol
        // For now, return a default value
        return 0;
    }

    private calculateVolumeSMA(volumes: number[], period: number): number {
        if (volumes.length < period) return volumes[volumes.length - 1] || 0;
        const sum = volumes.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }

    private calculateVolumeRatio(volumes: number[]): number {
        if (volumes.length < 20) return 1;
        const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        return avgVolume > 0 ? recentVolume / avgVolume : 1;
    }

    private calculatePriceMomentum(prices: number[], period: number): number {
        if (prices.length < period + 1) return 0;
        const currentPrice = prices[prices.length - 1] || 0;
        const pastPrice = prices[prices.length - period - 1] || 0;
        return pastPrice > 0 ? ((currentPrice - pastPrice) / pastPrice) * 100 : 0;
    }

    protected calculateVolatility(symbol: string): number {
        // This should be implemented to get market data for the symbol
        // For now, return a default value
        return 0;
    }

    private normalizeFeatures(features: number[]): number[] {
        // Simple min-max normalization
        const min = Math.min(...features);
        const max = Math.max(...features);
        const range = max - min;

        return features.map(f => range > 0 ? (f - min) / range : 0.5);
    }

    private async getRecentMarketData(): Promise<MarketData[]> {
        // This should be implemented to get recent market data
        // For now, return empty array
        return [];
    }

    private async getHistoricalMarketData(): Promise<MarketData[]> {
        // This should be implemented to get historical market data
        // For now, return empty array
        return [];
    }
} 