import { Matrix } from 'ml-matrix';
import { logger } from '../logger/logger';
import { mathUtils } from './math-utils.service';

export interface MLPrediction {
  symbol: string;
  prediction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  price: number;
  timestamp: Date;
  features: Record<string, number>;
  model: string;
}

export interface MLModel {
  id: string;
  name: string;
  type: 'linear' | 'polynomial' | 'exponential';
  features: string[];
  accuracy: number;
  lastTrained: Date;
  parameters: Record<string, any>;
}

export interface TrainingData {
  features: number[][];
  targets: number[];
  timestamps: Date[];
  symbols: string[];
}

export class MachineLearningService {
  private models: Map<string, MLModel> = new Map();
  private trainingData: Map<string, TrainingData> = new Map();
  private isEnabled = false;

  constructor() {
    this.setupDefaultModels();
  }

  /**
   * Enable/disable ML service
   */
  enable(): void {
    this.isEnabled = true;
    logger.info('Machine Learning service enabled');
  }

  disable(): void {
    this.isEnabled = false;
    logger.info('Machine Learning service disabled');
  }

  /**
   * Extract features from market data
   */
  extractFeatures(marketData: any[]): Record<string, number> {
    if (marketData.length < 20) {
      throw new Error('Insufficient data for feature extraction');
    }

    const prices = marketData.map(d => d.close);
    const volumes = marketData.map(d => d.volume || 0);
    const highs = marketData.map(d => d.high);
    const lows = marketData.map(d => d.low);

    // Technical indicators as features
    const sma5 = mathUtils.calculateMovingAverage(prices, 5);
    const sma10 = mathUtils.calculateMovingAverage(prices, 10);
    const sma20 = mathUtils.calculateMovingAverage(prices, 20);
    const rsi = mathUtils.calculateRSI(prices, 14);
    const macd = mathUtils.calculateMACD(prices);

    // Price-based features
    const priceChange = (prices[prices.length - 1] - prices[prices.length - 2]) / prices[prices.length - 2];
    const priceVolatility = mathUtils.calculateStatistics(prices.slice(-20)).std;
    const priceRange = (Math.max(...prices.slice(-5)) - Math.min(...prices.slice(-5))) / prices[prices.length - 1];

    // Volume-based features
    const volumeChange = volumes.length > 1 ? (volumes[volumes.length - 1] - volumes[volumes.length - 2]) / volumes[volumes.length - 2] : 0;
    const volumeSMA = mathUtils.calculateMovingAverage(volumes, 10);
    const volumeRatio = volumes[volumes.length - 1] / (volumeSMA[volumeSMA.length - 1] || 1);

    // Momentum features
    const momentum5 = prices[prices.length - 1] / prices[prices.length - 6] - 1;
    const momentum10 = prices[prices.length - 1] / prices[prices.length - 11] - 1;

    // Bollinger Bands features
    const bb = mathUtils.calculateBollingerBands(prices, 20, 2);
    const bbPosition = (prices[prices.length - 1] - bb.lower[bb.lower.length - 1]) / (bb.upper[bb.upper.length - 1] - bb.lower[bb.lower.length - 1]);

    return {
      // Price features
      price_change: priceChange,
      price_volatility: priceVolatility,
      price_range: priceRange,
      
      // Moving averages
      sma5_ratio: prices[prices.length - 1] / (sma5[sma5.length - 1] || 1),
      sma10_ratio: prices[prices.length - 1] / (sma10[sma10.length - 1] || 1),
      sma20_ratio: prices[prices.length - 1] / (sma20[sma20.length - 1] || 1),
      
      // RSI
      rsi: rsi[rsi.length - 1] || 50,
      rsi_overbought: (rsi[rsi.length - 1] || 50) > 70 ? 1 : 0,
      rsi_oversold: (rsi[rsi.length - 1] || 50) < 30 ? 1 : 0,
      
      // MACD
      macd_value: macd.macd[macd.macd.length - 1] || 0,
      macd_signal: macd.signal[macd.signal.length - 1] || 0,
      macd_histogram: macd.histogram[macd.histogram.length - 1] || 0,
      
      // Volume features
      volume_change: volumeChange,
      volume_ratio: volumeRatio,
      
      // Momentum
      momentum_5: momentum5,
      momentum_10: momentum10,
      
      // Bollinger Bands
      bb_position: bbPosition,
      bb_squeeze: (bb.upper[bb.upper.length - 1] - bb.lower[bb.lower.length - 1]) / (sma20[sma20.length - 1] || 1),
      
      // Time features
      hour_of_day: new Date().getHours() / 24,
      day_of_week: new Date().getDay() / 7,
      is_market_open: this.isMarketOpen() ? 1 : 0
    };
  }

  /**
   * Train a linear regression model
   */
  async trainLinearModel(symbol: string, trainingData: TrainingData): Promise<MLModel> {
    try {
      logger.info(`Training linear model for ${symbol}`, { 
        samples: trainingData.features.length 
      });

      const X = new Matrix(trainingData.features);
      const y = new Matrix(trainingData.targets.map(t => [t]));

      // Add bias term (intercept)
      const ones = new Matrix(X.rows, 1).fill(1);
      const XWithBias = X.addColumn(0, ones);

      // Calculate coefficients using normal equation: (X^T * X)^(-1) * X^T * y
      const XT = XWithBias.transpose();
      const XTX = XT.mmul(XWithBias);
      const XTy = XT.mmul(y);

      // Solve linear system
      const coefficients = XTX.solve(XTy);

      // Calculate predictions and accuracy
      const predictions = XWithBias.mmul(coefficients);
      const accuracy = this.calculateAccuracy(predictions.to1DArray(), trainingData.targets);

      const model: MLModel = {
        id: `linear_${symbol}_${Date.now()}`,
        name: `Linear Regression - ${symbol}`,
        type: 'linear',
        features: Object.keys(trainingData.features[0] || {}),
        accuracy,
        lastTrained: new Date(),
        parameters: {
          coefficients: coefficients.to1DArray(),
          intercept: coefficients.get(0, 0)
        }
      };

      this.models.set(model.id, model);
      logger.info(`Linear model trained successfully`, { 
        symbol, 
        accuracy: mathUtils.round(accuracy, 4) 
      });

      return model;
    } catch (error) {
      logger.error('Error training linear model', error);
      throw error;
    }
  }

  /**
   * Make prediction using trained model
   */
  async predict(symbol: string, features: Record<string, number>): Promise<MLPrediction> {
    try {
      const model = this.getBestModel(symbol);
      if (!model) {
        throw new Error(`No trained model found for ${symbol}`);
      }

      const featureValues = model.features.map(f => features[f] || 0);
      let prediction: number;

      switch (model.type) {
        case 'linear':
          prediction = this.predictLinear(model, featureValues);
          break;
        case 'polynomial':
          prediction = this.predictPolynomial(model, featureValues);
          break;
        case 'exponential':
          prediction = this.predictExponential(model, featureValues);
          break;
        default:
          throw new Error(`Unknown model type: ${model.type}`);
      }

      // Convert prediction to trading signal
      const signal = this.convertToSignal(prediction);
      const confidence = this.calculateConfidence(prediction, model.accuracy);

      const result: MLPrediction = {
        symbol,
        prediction: signal,
        confidence,
        price: features.price || 0,
        timestamp: new Date(),
        features,
        model: model.name
      };

      logger.debug('ML prediction made', { 
        symbol, 
        prediction: signal, 
        confidence: mathUtils.round(confidence, 4) 
      });

      return result;
    } catch (error) {
      logger.error('Error making ML prediction', error);
      throw error;
    }
  }

  /**
   * Linear prediction
   */
  private predictLinear(model: MLModel, features: number[]): number {
    const coefficients = model.parameters.coefficients;
    let prediction = model.parameters.intercept;

    for (let i = 0; i < features.length; i++) {
      prediction += features[i] * coefficients[i + 1]; // +1 for intercept
    }

    return prediction;
  }

  /**
   * Polynomial prediction
   */
  private predictPolynomial(model: MLModel, features: number[]): number {
    // Simple polynomial: ax^2 + bx + c
    const [a, b, c] = model.parameters.coefficients;
    const x = features[0] || 0;
    return a * x * x + b * x + c;
  }

  /**
   * Exponential prediction
   */
  private predictExponential(model: MLModel, features: number[]): number {
    // Simple exponential: a * e^(bx)
    const [a, b] = model.parameters.coefficients;
    const x = features[0] || 0;
    return a * Math.exp(b * x);
  }

  /**
   * Convert prediction to trading signal
   */
  private convertToSignal(prediction: number): 'BUY' | 'SELL' | 'HOLD' {
    if (prediction > 0.1) return 'BUY';
    if (prediction < -0.1) return 'SELL';
    return 'HOLD';
  }

  /**
   * Calculate prediction confidence
   */
  private calculateConfidence(prediction: number, modelAccuracy: number): number {
    const baseConfidence = Math.abs(prediction);
    return Math.min(baseConfidence * modelAccuracy, 1.0);
  }

  /**
   * Calculate model accuracy
   */
  private calculateAccuracy(predictions: number[], targets: number[]): number {
    if (predictions.length !== targets.length) {
      return 0;
    }

    let correct = 0;
    for (let i = 0; i < predictions.length; i++) {
      const predSignal = this.convertToSignal(predictions[i]);
      const targetSignal = this.convertToSignal(targets[i]);
      if (predSignal === targetSignal) {
        correct++;
      }
    }

    return correct / predictions.length;
  }

  /**
   * Get best model for symbol
   */
  private getBestModel(symbol: string): MLModel | undefined {
    const symbolModels = Array.from(this.models.values())
      .filter(m => m.name.includes(symbol))
      .sort((a, b) => b.accuracy - a.accuracy);

    return symbolModels[0];
  }

  /**
   * Add training data
   */
  addTrainingData(symbol: string, features: number[], target: number, timestamp: Date): void {
    if (!this.trainingData.has(symbol)) {
      this.trainingData.set(symbol, {
        features: [],
        targets: [],
        timestamps: [],
        symbols: []
      });
    }

    const data = this.trainingData.get(symbol)!;
    data.features.push(features);
    data.targets.push(target);
    data.timestamps.push(timestamp);
    data.symbols.push(symbol);

    // Keep only last 1000 samples
    if (data.features.length > 1000) {
      data.features.shift();
      data.targets.shift();
      data.timestamps.shift();
      data.symbols.shift();
    }

    logger.debug('Training data added', { 
      symbol, 
      samples: data.features.length 
    });
  }

  /**
   * Get training data for symbol
   */
  getTrainingData(symbol: string): TrainingData | undefined {
    return this.trainingData.get(symbol);
  }

  /**
   * Setup default models
   */
  private setupDefaultModels(): void {
    // Initialize with some default models
    const defaultModels: MLModel[] = [
      {
        id: 'default_linear',
        name: 'Default Linear Model',
        type: 'linear',
        features: ['price_change', 'rsi', 'volume_ratio'],
        accuracy: 0.6,
        lastTrained: new Date(),
        parameters: {
          coefficients: [0.1, 0.2, 0.3],
          intercept: 0.0
        }
      }
    ];

    defaultModels.forEach(model => this.models.set(model.id, model));
  }

  /**
   * Check if market is open
   */
  private isMarketOpen(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // Indian market hours: 9:15 AM to 3:30 PM, Monday to Friday
    return day >= 1 && day <= 5 && hour >= 9 && hour < 16;
  }

  /**
   * Get all models
   */
  getAllModels(): MLModel[] {
    return Array.from(this.models.values());
  }

  /**
   * Get model by ID
   */
  getModel(id: string): MLModel | undefined {
    return this.models.get(id);
  }

  /**
   * Delete model
   */
  deleteModel(id: string): boolean {
    const deleted = this.models.delete(id);
    if (deleted) {
      logger.info('Model deleted', { id });
    }
    return deleted;
  }

  /**
   * Get service status
   */
  getStatus(): {
    enabled: boolean;
    models: number;
    trainingData: Record<string, number>;
  } {
    const trainingDataCounts: Record<string, number> = {};
    for (const [symbol, data] of this.trainingData.entries()) {
      trainingDataCounts[symbol] = data.features.length;
    }

    return {
      enabled: this.isEnabled,
      models: this.models.size,
      trainingData: trainingDataCounts
    };
  }
}

// Export singleton instance
export const mlService = new MachineLearningService(); 