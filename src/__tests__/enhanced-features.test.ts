import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { logger } from '../logger/logger';
import { mathUtils } from '../services/math-utils.service';
import { CacheService } from '../services/cache.service';
import { performanceMonitor } from '../services/performance-monitor.service';
import { notificationService } from '../services/notification.service';
import { mlService } from '../services/machine-learning.service';
import { chartingService } from '../services/advanced-charting.service';
import { websocketAPIService } from '../services/websocket-api.service';
import { advancedTradingEngine, defaultEngineConfig } from '../services/advanced-trading-engine.service';

/**
 * Comprehensive test suite for all enhanced features
 */
describe('Enhanced Trading Bot Features', () => {
  beforeAll(async () => {
    logger.info('🧪 Starting Enhanced Features Test Suite');
  });

  afterAll(async () => {
    logger.info('✅ Enhanced Features Test Suite Completed');
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
      
      // Upper band should be above middle band
      expect(bb.upper[bb.upper.length - 1]).toBeGreaterThan(bb.middle[bb.middle.length - 1]);
      // Lower band should be below middle band
      expect(bb.lower[bb.lower.length - 1]).toBeLessThan(bb.middle[bb.middle.length - 1]);
    });

    it('should calculate statistics correctly', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const stats = mathUtils.calculateStatistics(data);
      
      expect(stats.mean).toBe(5.5);
      expect(stats.median).toBe(5.5);
      expect(stats.std).toBeCloseTo(3.027, 3);
      expect(stats.variance).toBeCloseTo(9.167, 3);
    });
  });

  describe('Cache Service', () => {
    let cacheService: CacheService;

    beforeAll(async () => {
      cacheService = new CacheService();
      await cacheService.connect();
    });

    afterAll(async () => {
      await cacheService.disconnect();
    });

    it('should set and get values correctly', async () => {
      const key = 'test_key';
      const value = { test: 'data', number: 123 };
      
      await cacheService.set(key, value, 60);
      const retrieved = await cacheService.get(key);
      
      expect(retrieved).toEqual(value);
    });

    it('should handle expiration correctly', async () => {
      const key = 'expire_test';
      const value = 'will expire';
      
      await cacheService.set(key, value, 1); // 1 second expiration
      
      // Should exist immediately
      const immediate = await cacheService.get(key);
      expect(immediate).toBe(value);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should not exist after expiration
      const expired = await cacheService.get(key);
      expect(expired).toBeNull();
    });

    it('should delete values correctly', async () => {
      const key = 'delete_test';
      const value = 'to be deleted';
      
      await cacheService.set(key, value, 60);
      await cacheService.delete(key);
      
      const retrieved = await cacheService.get(key);
      expect(retrieved).toBeNull();
    });

    it('should check existence correctly', async () => {
      const key = 'exists_test';
      const value = 'exists';
      
      // Should not exist initially
      let exists = await cacheService.exists(key);
      expect(exists).toBe(false);
      
      // Should exist after setting
      await cacheService.set(key, value, 60);
      exists = await cacheService.exists(key);
      expect(exists).toBe(true);
    });
  });

  describe('Performance Monitor', () => {
    beforeEach(() => {
      performanceMonitor.start();
    });

    afterEach(() => {
      performanceMonitor.stop();
    });

    it('should record metrics correctly', () => {
      performanceMonitor.recordMetric('test_metric', 100);
      performanceMonitor.recordMetric('test_metric', 200);
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.test_metric).toBe(300); // Sum of both values
    });

    it('should measure timing correctly', () => {
      performanceMonitor.startTimer('test_timer');
      
      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Wait 10ms
      }
      
      performanceMonitor.endTimer('test_timer');
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.test_timer_count).toBe(1);
      expect(metrics.test_timer_total).toBeGreaterThan(0);
    });

    it('should track memory usage', () => {
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(metrics.memoryUsage.heapTotal).toBeGreaterThan(0);
    });

    it('should track CPU usage', () => {
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.cpuUsage).toBeDefined();
      expect(metrics.cpuUsage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Notification Service', () => {
    it('should initialize correctly', () => {
      notificationService.initialize();
      expect(notificationService).toBeDefined();
    });

    it('should send trade notifications', () => {
      const result = notificationService.sendTradeNotification(
        'Test Trade',
        'This is a test trade notification'
      );
      
      expect(result).toBeDefined();
    });

    it('should send risk alerts', () => {
      const result = notificationService.sendRiskAlert(
        'High Risk',
        'Risk level has exceeded threshold'
      );
      
      expect(result).toBeDefined();
    });

    it('should send performance reports', () => {
      const result = notificationService.sendPerformanceReport({
        totalTrades: 100,
        winRate: 0.65,
        totalPnL: 5000,
        dailyPnL: 250
      });
      
      expect(result).toBeDefined();
    });
  });

  describe('Job Scheduler', () => {
    beforeAll(() => {
      jobScheduler.start();
    });

    afterAll(() => {
      jobScheduler.stop();
    });

    it('should add and execute jobs', (done) => {
      let jobExecuted = false;
      
      jobScheduler.addJob('test_job', '* * * * * *', () => {
        jobExecuted = true;
        done();
      });
      
      // Job should execute within 2 seconds
      setTimeout(() => {
        if (!jobExecuted) {
          done(new Error('Job did not execute'));
        }
      }, 2000);
    });

    it('should remove jobs correctly', () => {
      const jobId = 'remove_test_job';
      
      jobScheduler.addJob(jobId, '* * * * * *', () => {});
      const removed = jobScheduler.removeJob(jobId);
      
      expect(removed).toBe(true);
    });

    it('should list active jobs', () => {
      const jobId = 'list_test_job';
      
      jobScheduler.addJob(jobId, '* * * * * *', () => {});
      const jobs = jobScheduler.getActiveJobs();
      
      expect(jobs).toContain(jobId);
      
      // Cleanup
      jobScheduler.removeJob(jobId);
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

    it('should make predictions', async () => {
      const symbol = 'PREDICT_TEST';
      
      // First train a model
      const trainingData = {
        features: Array.from({ length: 50 }, () => [Math.random(), Math.random(), Math.random()]),
        targets: Array.from({ length: 50 }, () => Math.random() > 0.5 ? 1 : -1),
        timestamps: Array.from({ length: 50 }, (_, i) => new Date(Date.now() - (50 - i) * 60000)),
        symbols: Array(50).fill(symbol)
      };
      
      await mlService.trainLinearModel(symbol, trainingData);
      
      // Make prediction
      const features = {
        price_change: 0.05,
        rsi: 65,
        volume_ratio: 1.2,
        momentum_5: 0.02,
        bb_position: 0.6
      };
      
      const prediction = await mlService.predict(symbol, features);
      
      expect(prediction).toBeDefined();
      expect(prediction.symbol).toBe(symbol);
      expect(['BUY', 'SELL', 'HOLD']).toContain(prediction.prediction);
      expect(prediction.confidence).toBeGreaterThan(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
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
    });

    it('should process trading signals', async () => {
      const signal = {
        symbol: 'TEST',
        action: 'BUY' as const,
        confidence: 0.8,
        price: 100,
        quantity: 10,
        timestamp: new Date(),
        source: 'test' as const,
        metadata: { test: true }
      };
      
      // This should not throw an error
      await expect(engine.processSignal(signal)).resolves.not.toThrow();
    });

    it('should get positions', () => {
      const positions = engine.getPositions();
      expect(Array.isArray(positions)).toBe(true);
    });

    it('should get metrics', () => {
      const metrics = engine.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalTrades).toBeGreaterThanOrEqual(0);
      expect(metrics.winRate).toBeGreaterThanOrEqual(0);
      expect(metrics.winRate).toBeLessThanOrEqual(1);
    });
  });

  describe('Integration Tests', () => {
    it('should integrate all services together', async () => {
      // Test cache integration
      await cacheService.set('integration_test', { data: 'test' }, 60);
      const cached = await cacheService.get('integration_test');
      expect(cached).toEqual({ data: 'test' });
      
      // Test performance monitoring
      performanceMonitor.recordMetric('integration_metric', 100);
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.integration_metric).toBe(100);
      
      // Test math utils
      const prices = [10, 12, 14, 16, 18];
      const sma = mathUtils.calculateMovingAverage(prices, 3);
      expect(sma.length).toBeGreaterThan(0);
      
      // Test ML service
      const marketData = Array.from({ length: 20 }, (_, i) => ({
        timestamp: Date.now() - (20 - i) * 60000,
        open: 100 + i,
        high: 100 + i + 1,
        low: 100 + i - 1,
        close: 100 + i,
        volume: 1000000
      }));
      
      const features = mlService.extractFeatures(marketData);
      expect(features).toBeDefined();
      
      // Test notification service
      const notification = notificationService.sendTradeNotification('Integration Test', 'All services working');
      expect(notification).toBeDefined();
    });

    it('should handle real-time data flow', async () => {
      // Simulate market data
      const marketData = {
        symbol: 'REALTIME_TEST',
        prices: [100, 101, 102, 103, 104],
        volumes: [1000000, 1100000, 1200000, 1300000, 1400000],
        timestamps: Array.from({ length: 5 }, (_, i) => new Date(Date.now() - (5 - i) * 60000))
      };
      
      // Extract features
      const features = mlService.extractFeatures(marketData.prices.map((price, i) => ({
        timestamp: marketData.timestamps[i],
        open: price - 0.5,
        high: price + 0.5,
        low: price - 0.5,
        close: price,
        volume: marketData.volumes[i]
      })));
      
      expect(features).toBeDefined();
      
      // Cache the data
      await cacheService.set('realtime_data', marketData, 300);
      const cached = await cacheService.get('realtime_data');
      expect(cached).toEqual(marketData);
      
      // Record performance
      performanceMonitor.recordMetric('realtime_processing', 1);
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.realtime_processing).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle cache connection errors gracefully', async () => {
      // Test with invalid Redis connection
      const invalidCache = new (require('../services/cache.service').CacheService)();
      await expect(invalidCache.connect()).rejects.toThrow();
    });

    it('should handle ML prediction errors gracefully', async () => {
      // Test prediction without trained model
      const features = { price_change: 0.1, rsi: 50 };
      await expect(mlService.predict('UNKNOWN_SYMBOL', features)).rejects.toThrow();
    });

    it('should handle invalid market data gracefully', () => {
      // Test with insufficient data
      const insufficientData = [{ close: 100 }]; // Only one data point
      expect(() => mlService.extractFeatures(insufficientData)).toThrow();
    });

    it('should handle math calculation errors gracefully', () => {
      // Test with empty array
      expect(() => mathUtils.calculateMovingAverage([], 5)).toThrow();
      expect(() => mathUtils.calculateRSI([], 14)).toThrow();
    });
  });

  describe('Performance Benchmarks', () => {
    it('should process 1000 market data points efficiently', () => {
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
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle concurrent cache operations', async () => {
      const operations = Array.from({ length: 100 }, (_, i) => 
        cacheService.set(`concurrent_${i}`, { value: i }, 60)
      );
      
      const startTime = Date.now();
      await Promise.all(operations);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(2000); // Should complete in under 2 seconds
    });
  });
}); 