import { logger } from '../logger/logger';
import { mathUtils } from '../services/math-utils.service';
import { scheduler, tradingJobs } from '../services/scheduler.service';
import { performanceMonitor, tradingMetrics } from '../services/performance-monitor.service';
import { ZerodhaAuth } from '../auth/zerodha-auth';
import { MarketDataService } from '../services/market-data.service';
import { StrategyService } from '../services/strategy.service';
import { OrderManagerService } from '../services/order-manager.service';

/**
 * Enhanced Trading Example demonstrating the use of new packages and services
 */
export class EnhancedTradingExample {
  private auth: ZerodhaAuth;
  private marketData: MarketDataService;
  private strategy: StrategyService;
  private orderManager: OrderManagerService;
  private isRunning = false;

  constructor() {
    logger.info('Initializing Enhanced Trading Example');
  }

  async initialize(): Promise<void> {
    try {
      // Start performance monitoring
      performanceMonitor.start();
      logger.info('Performance monitoring started');

      // Start scheduler
      scheduler.start();
      logger.info('Scheduler started');

      // Initialize authentication
      this.auth = new ZerodhaAuth();
      await this.auth.initialize();
      logger.info('Authentication initialized');

      // Initialize services
      this.marketData = new MarketDataService();
      this.strategy = new StrategyService();
      this.orderManager = new OrderManagerService();

      // Add trading jobs to scheduler
      this.setupTradingJobs();

      logger.info('Enhanced Trading Example initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Enhanced Trading Example', error);
      throw error;
    }
  }

  private setupTradingJobs(): void {
    // Add market data refresh job
    const marketDataJobId = scheduler.addJob({
      name: 'Market Data Refresh',
      cronExpression: '*/30 * 9-15 * * 1-5', // Every 30 seconds during trading hours
      task: async () => {
        await performanceMonitor.measureAsync(
          tradingMetrics.MARKET_DATA_FETCH,
          async () => {
            await this.refreshMarketData();
          }
        );
      },
      maxRetries: 3,
      retryDelay: 5000,
      description: 'Refresh market data every 30 seconds during trading hours'
    });

    // Add strategy execution job
    const strategyJobId = scheduler.addJob({
      name: 'Strategy Execution',
      cronExpression: '*/60 * 9-15 * * 1-5', // Every minute during trading hours
      task: async () => {
        await performanceMonitor.measureAsync(
          tradingMetrics.STRATEGY_EXECUTION,
          async () => {
            await this.executeStrategies();
          }
        );
      },
      maxRetries: 2,
      retryDelay: 10000,
      description: 'Execute trading strategies every minute during trading hours'
    });

    // Add risk check job
    const riskJobId = scheduler.addJob({
      name: 'Risk Check',
      cronExpression: '*/5 * 9-15 * * 1-5', // Every 5 minutes during trading hours
      task: async () => {
        await performanceMonitor.measureAsync(
          tradingMetrics.RISK_CHECK,
          async () => {
            await this.performRiskCheck();
          }
        );
      },
      maxRetries: 2,
      retryDelay: 15000,
      description: 'Perform risk checks every 5 minutes during trading hours'
    });

    logger.info('Trading jobs added to scheduler', {
      marketDataJobId,
      strategyJobId,
      riskJobId
    });
  }

  async refreshMarketData(): Promise<void> {
    try {
      logger.info('Refreshing market data...');
      
      // Simulate market data fetch
      const symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFC', 'ICICIBANK'];
      const marketData = [];

      for (const symbol of symbols) {
        const price = 1000 + Math.random() * 500;
        marketData.push({
          symbol,
          timestamp: new Date(),
          close: price,
          ltp: price + (Math.random() - 0.5) * 10,
          volume: Math.floor(Math.random() * 10000) + 1000,
          high: price + Math.random() * 20,
          low: price - Math.random() * 20
        });
      }

      // Calculate technical indicators using math utils
      for (const data of marketData) {
        const prices = [data.close, data.ltp, data.high, data.low];
        const stats = mathUtils.calculateStatistics(prices);
        
        logger.debug(`Market data for ${data.symbol}`, {
          price: data.ltp,
          volume: data.volume,
          stats: {
            mean: mathUtils.round(stats.mean, 2),
            std: mathUtils.round(stats.std, 2),
            range: mathUtils.round(stats.range, 2)
          }
        });
      }

      // Record performance metric
      performanceMonitor.recordMetric('market_data_refresh_success', 1, 'count');
      
    } catch (error) {
      logger.error('Error refreshing market data', error);
      performanceMonitor.recordMetric('market_data_refresh_error', 1, 'count');
      throw error;
    }
  }

  async executeStrategies(): Promise<void> {
    try {
      logger.info('Executing trading strategies...');

      // Simulate strategy execution
      const strategies = ['Moving Average Crossover', 'RSI Strategy', 'Breakout Strategy'];
      
      for (const strategyName of strategies) {
        await performanceMonitor.measureAsync(
          `${tradingMetrics.STRATEGY_EXECUTION}_${strategyName}`,
          async () => {
            // Simulate strategy analysis
            const prices = Array.from({ length: 20 }, () => 1000 + Math.random() * 100);
            
            // Calculate technical indicators
            const sma = mathUtils.calculateMovingAverage(prices, 10);
            const rsi = mathUtils.calculateRSI(prices, 14);
            const macd = mathUtils.calculateMACD(prices);

            // Generate trading signal
            const signal = this.generateTradingSignal(strategyName, prices, sma, rsi, macd);
            
            if (signal) {
              logger.info(`Strategy ${strategyName} generated signal`, signal);
              
              // Record signal generation performance
              performanceMonitor.recordMetric(
                tradingMetrics.STRATEGY_SIGNAL_GENERATION,
                Math.random() * 100,
                'ms'
              );
            }
          }
        );
      }

      // Record strategy execution success
      performanceMonitor.recordMetric('strategy_execution_success', 1, 'count');
      
    } catch (error) {
      logger.error('Error executing strategies', error);
      performanceMonitor.recordMetric('strategy_execution_error', 1, 'count');
      throw error;
    }
  }

  private generateTradingSignal(
    strategyName: string,
    prices: number[],
    sma: number[],
    rsi: number[],
    macd: { macd: number[]; signal: number[]; histogram: number[] }
  ): any {
    const currentPrice = prices[prices.length - 1];
    const currentSMA = sma[sma.length - 1];
    const currentRSI = rsi[rsi.length - 1];
    const currentMACD = macd.macd[macd.macd.length - 1];
    const currentSignal = macd.signal[macd.signal.length - 1];

    let action = 'HOLD';
    let confidence = 0;

    switch (strategyName) {
      case 'Moving Average Crossover':
        if (currentPrice > currentSMA * 1.02) {
          action = 'BUY';
          confidence = 0.7;
        } else if (currentPrice < currentSMA * 0.98) {
          action = 'SELL';
          confidence = 0.7;
        }
        break;

      case 'RSI Strategy':
        if (currentRSI < 30) {
          action = 'BUY';
          confidence = 0.8;
        } else if (currentRSI > 70) {
          action = 'SELL';
          confidence = 0.8;
        }
        break;

      case 'Breakout Strategy':
        if (currentMACD > currentSignal) {
          action = 'BUY';
          confidence = 0.6;
        } else if (currentMACD < currentSignal) {
          action = 'SELL';
          confidence = 0.6;
        }
        break;
    }

    if (action !== 'HOLD') {
      return {
        strategy: strategyName,
        action,
        confidence,
        price: currentPrice,
        timestamp: new Date(),
        indicators: {
          sma: currentSMA,
          rsi: currentRSI,
          macd: currentMACD,
          signal: currentSignal
        }
      };
    }

    return null;
  }

  async performRiskCheck(): Promise<void> {
    try {
      logger.info('Performing risk check...');

      // Simulate risk calculations
      const portfolioValue = 100000 + Math.random() * 50000;
      const openPositions = Math.floor(Math.random() * 10);
      const dailyPnL = (Math.random() - 0.5) * 5000;
      const maxDrawdown = Math.random() * 0.1; // 0-10%

      // Calculate risk metrics using math utils
      const returns = Array.from({ length: 30 }, () => (Math.random() - 0.5) * 0.02);
      const financialMetrics = mathUtils.calculateFinancialMetrics(
        Array.from({ length: 30 }, (_, i) => 100000 * (1 + returns.slice(0, i + 1).reduce((a, b) => a + b, 0)))
      );

      // Record risk metrics
      performanceMonitor.recordMetric('portfolio_value', portfolioValue, 'INR');
      performanceMonitor.recordMetric('open_positions', openPositions, 'count');
      performanceMonitor.recordMetric('daily_pnl', dailyPnL, 'INR');
      performanceMonitor.recordMetric('max_drawdown', maxDrawdown * 100, 'percentage');
      performanceMonitor.recordMetric('sharpe_ratio', financialMetrics.sharpeRatio, 'ratio');
      performanceMonitor.recordMetric('volatility', financialMetrics.volatility * 100, 'percentage');

      // Check risk thresholds
      if (maxDrawdown > 0.05) { // 5% max drawdown
        logger.warn('Risk threshold exceeded: High drawdown', { maxDrawdown: maxDrawdown * 100 });
      }

      if (Math.abs(dailyPnL) > 3000) { // 3000 INR daily loss limit
        logger.warn('Risk threshold exceeded: High daily P&L', { dailyPnL });
      }

      logger.debug('Risk check completed', {
        portfolioValue: mathUtils.formatCurrency(portfolioValue),
        openPositions,
        dailyPnL: mathUtils.formatCurrency(dailyPnL),
        maxDrawdown: mathUtils.formatPercentage(maxDrawdown),
        sharpeRatio: mathUtils.round(financialMetrics.sharpeRatio, 3),
        volatility: mathUtils.formatPercentage(financialMetrics.volatility)
      });

    } catch (error) {
      logger.error('Error performing risk check', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Enhanced Trading Example already running');
      return;
    }

    try {
      await this.initialize();
      this.isRunning = true;

      logger.info('Enhanced Trading Example started successfully');

      // Generate initial performance report
      setTimeout(() => {
        this.generatePerformanceReport();
      }, 60000); // After 1 minute

    } catch (error) {
      logger.error('Failed to start Enhanced Trading Example', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Enhanced Trading Example not running');
      return;
    }

    try {
      this.isRunning = false;

      // Stop scheduler
      scheduler.stop();
      logger.info('Scheduler stopped');

      // Stop performance monitoring
      performanceMonitor.stop();
      logger.info('Performance monitoring stopped');

      // Generate final performance report
      this.generatePerformanceReport();

      logger.info('Enhanced Trading Example stopped successfully');
    } catch (error) {
      logger.error('Error stopping Enhanced Trading Example', error);
      throw error;
    }
  }

  private generatePerformanceReport(): void {
    try {
      const report = performanceMonitor.generateReport();
      
      logger.info('Performance Report', {
        timestamp: report.timestamp,
        systemMetrics: {
          memory: `${mathUtils.round(report.systemMetrics.memory.percentage, 2)}%`,
          uptime: `${mathUtils.round(report.systemMetrics.uptime / 3600, 2)} hours`
        },
        customMetrics: Object.keys(report.customMetrics).length,
        alerts: report.alerts.length
      });

      // Log detailed metrics
      for (const [metricName, stats] of Object.entries(report.customMetrics)) {
        logger.debug(`Metric: ${metricName}`, {
          count: stats.count,
          avg: mathUtils.round(stats.avg, 2),
          p95: mathUtils.round(stats.p95, 2),
          p99: mathUtils.round(stats.p99, 2)
        });
      }

      // Log alerts
      for (const alert of report.alerts) {
        logger.warn(`Performance Alert: ${alert.level.toUpperCase()}`, {
          metric: alert.metric,
          value: alert.value,
          threshold: alert.threshold,
          message: alert.message
        });
      }

    } catch (error) {
      logger.error('Error generating performance report', error);
    }
  }

  getStatus(): {
    isRunning: boolean;
    schedulerStatus: any;
    performanceStatus: any;
  } {
    return {
      isRunning: this.isRunning,
      schedulerStatus: scheduler.getStatus(),
      performanceStatus: performanceMonitor.getStatus()
    };
  }
}

// Export singleton instance
export const enhancedTradingExample = new EnhancedTradingExample();

// Example usage
export async function runEnhancedTradingExample(): Promise<void> {
  try {
    await enhancedTradingExample.start();
    
    // Run for 5 minutes
    setTimeout(async () => {
      await enhancedTradingExample.stop();
      process.exit(0);
    }, 5 * 60 * 1000);

  } catch (error) {
    logger.error('Error running Enhanced Trading Example', error);
    process.exit(1);
  }
}

// Auto-run if this file is executed directly
if (require.main === module) {
  runEnhancedTradingExample().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
} 