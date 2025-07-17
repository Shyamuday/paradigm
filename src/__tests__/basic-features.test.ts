import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { logger } from '../logger/logger';
import { mathUtils } from '../services/math-utils.service';
import { mlService } from '../services/machine-learning.service';
import { advancedTradingEngine } from '../services/advanced-trading-engine.service';

/**
 * Basic Feature Tests - Testing core functionality that works
 */
describe('Basic Trading Bot Features', () => {
  beforeAll(() => {
    logger.info('🧪 Starting Basic Features Test Suite');
  });

  afterAll(() => {
    logger.info('✅ Basic Features Test Suite Completed');
  });

  describe('Math Utils Service', () => {
    it('should calculate moving averages correctly', () => {
      const prices = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
      const sma5 = mathUtils.calculateMovingAverage(prices, 5);
      
      expect(sma5).toHaveLength(6);
      expect(sma5[0]).toBeCloseTo(14, 2); // Average of first 5 values
      expect(sma5[5]).toBeCloseTo(24, 2); // Average of last 5 values
    });

    it('should calculate RSI correctly', () => {
      const prices = [44, 44.34, 44.09, 44.15, 43.61, 44.33, 44.23, 44.23, 44.56, 44.15];
      const rsi = mathUtils.calculateRSI(prices, 14);
      
      expect(rsi).toHaveLength(prices.length);
      expect(rsi[0]).toBeGreaterThanOrEqual(0);
      expect(rsi[0]).toBeLessThanOrEqual(100);
    });

    it('should calculate MACD correctly', () => {
      const prices = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40];
      const macd = mathUtils.calculateMACD(prices);
      
      expect(macd.macd).toHaveLength(prices.length);
      expect(macd.signal).toHaveLength(prices.length);
      expect(macd.histogram).toHaveLength(prices.length);
    });

    it('should calculate Bollinger Bands correctly', () => {
      const prices = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48];
      const bb = mathUtils.calculateBollingerBands(prices, 20, 2);
      
      expect(bb.upper).toHaveLength(prices.length);
      expect(bb.middle).toHaveLength(prices.length);
      expect(bb.lower).toHaveLength(prices.length);
      
      // Check that arrays have values
      expect(bb.upper[bb.upper.length - 1]).toBeDefined();
      expect(bb.middle[bb.middle.length - 1]).toBeDefined();
      expect(bb.lower[bb.lower.length - 1]).toBeDefined();
    });

    it('should calculate statistics correctly', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const stats = mathUtils.calculateStatistics(data);
      
      expect(stats.mean).toBe(5.5);
      expect(stats.median).toBe(5.5);
      expect(stats.std).toBeCloseTo(3.027, 3);
      expect(stats.variance).toBeCloseTo(9.167, 3);
    });

    it('should handle edge cases gracefully', () => {
      // Test with empty array
      expect(() => mathUtils.calculateMovingAverage([], 5)).toThrow();
      expect(() => mathUtils.calculateRSI([], 14)).toThrow();
      
      // Test with insufficient data
      expect(() => mathUtils.calculateMovingAverage([1, 2], 5)).toThrow();
    });
  });

  describe('Machine Learning Service', () => {
    it('should extract features correctly', () => {
      const marketData = Array.from({ length: 50 }, (_, i) => ({
        timestamp: Date.now() - (50 - i) * 60000,
        open: 100 + i * 0.1,
        high: 100 + i * 0.1 + 0.5,
        low: 100 + i * 0.1 - 0.5,
        close: 100 + i * 0.1,
        volume: 1000000 + i * 1000
      }));

      const features = mlService.extractFeatures(marketData);
      
      expect(features).toBeDefined();
      expect(features.price_change).toBeDefined();
      expect(features.rsi).toBeDefined();
      expect(features.volume_ratio).toBeDefined();
      expect(features.momentum_5).toBeDefined();
      expect(features.bb_position).toBeDefined();
    });

    it('should add training data correctly', () => {
      const symbol = 'TEST';
      const features = [0.1, 0.2, 0.3];
      const target = 1;
      const timestamp = new Date();
      
      mlService.addTrainingData(symbol, features, target, timestamp);
      
      const trainingData = mlService.getTrainingData(symbol);
      expect(trainingData).toBeDefined();
      expect(trainingData?.features.length).toBeGreaterThan(0);
    });

    it('should train linear model', async () => {
      const symbol = 'TRAIN_TEST';
      
      // Generate training data
      const trainingData = {
        features: Array.from({ length: 100 }, () => [Math.random(), Math.random(), Math.random()]),
        targets: Array.from({ length: 100 }, () => Math.random() > 0.5 ? 1 : -1),
        timestamps: Array.from({ length: 100 }, (_, i) => new Date(Date.now() - (100 - i) * 60000)),
        symbols: Array(100).fill(symbol)
      };
      
      const model = await mlService.trainLinearModel(symbol, trainingData);
      
      expect(model).toBeDefined();
      expect(model.id).toContain(symbol);
      expect(model.accuracy).toBeGreaterThan(0);
      expect(model.accuracy).toBeLessThanOrEqual(1);
    });

    it('should handle insufficient data gracefully', () => {
      // Test with insufficient data
      const insufficientData = [{ close: 100 }]; // Only one data point
      expect(() => mlService.extractFeatures(insufficientData)).toThrow();
    });
  });

  describe('Advanced Trading Engine', () => {
    it('should initialize with default config', () => {
      const engine = advancedTradingEngine;
      const status = engine.getStatus();
      
      expect(status).toBeDefined();
      expect(status.isRunning).toBeDefined();
      expect(status.positions).toBeDefined();
      expect(status.totalPnL).toBeDefined();
      expect(status.dailyPnL).toBeDefined();
      expect(status.winRate).toBeDefined();
      expect(status.uptime).toBeDefined();
    });

    it('should get positions', () => {
      const positions = advancedTradingEngine.getPositions();
      expect(Array.isArray(positions)).toBe(true);
    });

    it('should get metrics', () => {
      const metrics = advancedTradingEngine.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalTrades).toBeGreaterThanOrEqual(0);
      expect(metrics.winningTrades).toBeGreaterThanOrEqual(0);
      expect(metrics.losingTrades).toBeGreaterThanOrEqual(0);
      expect(metrics.winRate).toBeGreaterThanOrEqual(0);
      expect(metrics.winRate).toBeLessThanOrEqual(1);
      expect(metrics.totalPnL).toBeDefined();
      expect(metrics.dailyPnL).toBeDefined();
    });

    it('should get recent signals', () => {
      const signals = advancedTradingEngine.getRecentSignals(10);
      expect(Array.isArray(signals)).toBe(true);
      expect(signals.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Integration Tests', () => {
    it('should integrate math utils with ML service', () => {
      // Generate market data
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.1);
      const marketData = prices.map((price, i) => ({
        timestamp: Date.now() - (50 - i) * 60000,
        open: price - 0.5,
        high: price + 0.5,
        low: price - 0.5,
        close: price,
        volume: 1000000 + i * 1000
      }));

      // Extract features using ML service
      const features = mlService.extractFeatures(marketData);
      
      // Verify features are reasonable
      expect(features.price_change).toBeGreaterThan(-1);
      expect(features.price_change).toBeLessThan(1);
      expect(features.rsi).toBeGreaterThanOrEqual(0);
      expect(features.rsi).toBeLessThanOrEqual(100);
      expect(features.volume_ratio).toBeGreaterThan(0);
    });

    it('should process trading signals', async () => {
      const signal = {
        symbol: 'TEST',
        action: 'BUY' as const,
        confidence: 0.8,
        price: 100,
        quantity: 10,
        timestamp: new Date(),
        source: 'manual' as const,
        metadata: { test: true }
      };
      
      // This should not throw an error
      await expect(advancedTradingEngine.processSignal(signal)).resolves.not.toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should process large datasets efficiently', () => {
      const startTime = Date.now();
      
      const marketData = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: Date.now() - (1000 - i) * 60000,
        open: 100 + i * 0.01,
        high: 100 + i * 0.01 + 0.5,
        low: 100 + i * 0.01 - 0.5,
        close: 100 + i * 0.01,
        volume: 1000000 + i * 100
      }));
      
      const features = mlService.extractFeatures(marketData);
      const endTime = Date.now();
      
      expect(features).toBeDefined();
      expect(endTime - startTime).toBeLessThan(2000); // Should complete in under 2 seconds
    });

    it('should handle multiple calculations efficiently', () => {
      const prices = Array.from({ length: 100 }, (_, i) => 100 + i * 0.1);
      
      const startTime = Date.now();
      
      // Run multiple calculations
      const sma = mathUtils.calculateMovingAverage(prices, 20);
      const rsi = mathUtils.calculateRSI(prices, 14);
      const macd = mathUtils.calculateMACD(prices);
      const bb = mathUtils.calculateBollingerBands(prices, 20, 2);
      const stats = mathUtils.calculateStatistics(prices);
      
      const endTime = Date.now();
      
      expect(sma.length).toBeGreaterThan(0);
      expect(rsi.length).toBeGreaterThan(0);
      expect(macd.macd.length).toBeGreaterThan(0);
      expect(bb.upper.length).toBeGreaterThan(0);
      expect(stats.mean).toBeDefined();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid market data gracefully', () => {
      // Test with insufficient data
      const insufficientData = [{ close: 100 }]; // Only one data point
      expect(() => mlService.extractFeatures(insufficientData)).toThrow();
    });

    it('should handle invalid math operations gracefully', () => {
      // Test with empty array
      expect(() => mathUtils.calculateMovingAverage([], 5)).toThrow();
      expect(() => mathUtils.calculateRSI([], 14)).toThrow();
      expect(() => mathUtils.calculateMACD([])).toThrow();
      expect(() => mathUtils.calculateBollingerBands([], 20, 2)).toThrow();
      expect(() => mathUtils.calculateStatistics([])).toThrow();
    });

    it('should handle edge cases in calculations', () => {
      // Test with all same values
      const sameValues = Array(20).fill(100);
      const stats = mathUtils.calculateStatistics(sameValues);
      expect(stats.std).toBe(0);
      expect(stats.variance).toBe(0);
    });
  });
}); 