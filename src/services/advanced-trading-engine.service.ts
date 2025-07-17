import { EventEmitter } from 'events';
import { logger } from '../logger/logger';
import { mathUtils } from './math-utils.service';
import { cacheService } from './cache.service';
import { performanceMonitor } from './performance-monitor.service';
import { notificationService } from './notification.service';
import { jobScheduler } from './job-scheduler.service';
import { mlService } from './machine-learning.service';
import { chartingService } from './advanced-charting.service';
import { websocketAPIService } from './websocket-api.service';
import { strategyEngine } from './strategy-engine.service';
import { orderManager } from './order-manager.service';
import { portfolioService } from './portfolio.service';
import { riskService } from './risk.service';
import { marketDataService } from './market-data.service';

export interface TradingSignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  price: number;
  quantity: number;
  timestamp: Date;
  source: 'strategy' | 'ml' | 'manual' | 'risk';
  metadata: Record<string, any>;
}

export interface TradingPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  timestamp: Date;
}

export interface TradingMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalPnL: number;
  dailyPnL: number;
}

export interface EngineConfig {
  maxPositions: number;
  maxRiskPerTrade: number;
  maxDailyLoss: number;
  enableML: boolean;
  enableRealTimeCharts: boolean;
  enableWebSocketAPI: boolean;
  autoRebalance: boolean;
  riskManagement: {
    stopLoss: number;
    takeProfit: number;
    trailingStop: boolean;
    maxDrawdown: number;
  };
}

export class AdvancedTradingEngine extends EventEmitter {
  private config: EngineConfig;
  private positions: Map<string, TradingPosition> = new Map();
  private signals: TradingSignal[] = [];
  private metrics: TradingMetrics;
  private isRunning = false;
  private tradingSession: {
    startTime: Date;
    dailyPnL: number;
    tradesToday: number;
  };

  constructor(config: EngineConfig) {
    super();
    this.config = config;
    this.initializeMetrics();
    this.initializeTradingSession();
    this.setupEventHandlers();
  }

  /**
   * Start the advanced trading engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Trading engine already running');
      return;
    }

    try {
      logger.info('Starting advanced trading engine...');

      // Start all services
      await this.startServices();

      // Initialize trading session
      this.initializeTradingSession();

      // Start monitoring jobs
      this.startMonitoringJobs();

      this.isRunning = true;
      this.emit('started');
      
      logger.info('Advanced trading engine started successfully');
      notificationService.sendNotification('Trading Engine Started', 'Advanced trading engine is now running');
    } catch (error) {
      logger.error('Failed to start trading engine', error);
      throw error;
    }
  }

  /**
   * Stop the advanced trading engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Trading engine not running');
      return;
    }

    try {
      logger.info('Stopping advanced trading engine...');

      // Close all positions if configured
      if (this.config.autoRebalance) {
        await this.closeAllPositions();
      }

      // Stop all services
      await this.stopServices();

      this.isRunning = false;
      this.emit('stopped');
      
      logger.info('Advanced trading engine stopped');
      notificationService.sendNotification('Trading Engine Stopped', 'Advanced trading engine has been stopped');
    } catch (error) {
      logger.error('Error stopping trading engine', error);
      throw error;
    }
  }

  /**
   * Process trading signal
   */
  async processSignal(signal: TradingSignal): Promise<void> {
    try {
      performanceMonitor.startTimer('signal_processing');

      // Validate signal
      if (!this.validateSignal(signal)) {
        logger.warn('Invalid trading signal', signal);
        return;
      }

      // Check risk limits
      if (!this.checkRiskLimits(signal)) {
        logger.warn('Signal rejected due to risk limits', signal);
        return;
      }

      // Add signal to queue
      this.signals.push(signal);

      // Execute signal
      await this.executeSignal(signal);

      // Update metrics
      this.updateMetrics(signal);

      // Broadcast signal via WebSocket
      websocketAPIService.broadcastToTopic('trading_signals', {
        type: 'trading_signal',
        data: signal,
        timestamp: Date.now()
      });

      performanceMonitor.endTimer('signal_processing');
      logger.info('Trading signal processed', { 
        symbol: signal.symbol, 
        action: signal.action, 
        confidence: signal.confidence 
      });
    } catch (error) {
      logger.error('Error processing trading signal', error);
      performanceMonitor.recordMetric('signal_processing_errors', 1);
    }
  }

  /**
   * Execute trading signal
   */
  private async executeSignal(signal: TradingSignal): Promise<void> {
    try {
      const order = await orderManager.placeOrder({
        symbol: signal.symbol,
        side: signal.action,
        quantity: signal.quantity,
        price: signal.price,
        orderType: 'MARKET',
        metadata: {
          signal: signal,
          engine: 'advanced'
        }
      });

      // Update position
      this.updatePosition(signal);

      // Send notification
      notificationService.sendNotification(
        `Trade Executed: ${signal.action} ${signal.symbol}`,
        `Quantity: ${signal.quantity}, Price: ${signal.price}, Confidence: ${signal.confidence}`
      );

      logger.info('Signal executed successfully', { orderId: order.orderId });
    } catch (error) {
      logger.error('Error executing signal', error);
      throw error;
    }
  }

  /**
   * Update trading position
   */
  private updatePosition(signal: TradingSignal): void {
    const existingPosition = this.positions.get(signal.symbol);
    
    if (signal.action === 'BUY') {
      if (existingPosition) {
        // Add to existing position
        const totalQuantity = existingPosition.quantity + signal.quantity;
        const totalValue = (existingPosition.quantity * existingPosition.averagePrice) + 
                          (signal.quantity * signal.price);
        const newAveragePrice = totalValue / totalQuantity;

        this.positions.set(signal.symbol, {
          ...existingPosition,
          quantity: totalQuantity,
          averagePrice: newAveragePrice,
          currentPrice: signal.price,
          timestamp: new Date()
        });
      } else {
        // Create new position
        this.positions.set(signal.symbol, {
          symbol: signal.symbol,
          quantity: signal.quantity,
          averagePrice: signal.price,
          currentPrice: signal.price,
          unrealizedPnL: 0,
          realizedPnL: 0,
          timestamp: new Date()
        });
      }
    } else if (signal.action === 'SELL' && existingPosition) {
      // Calculate P&L
      const realizedPnL = (signal.price - existingPosition.averagePrice) * signal.quantity;
      const remainingQuantity = existingPosition.quantity - signal.quantity;

      if (remainingQuantity > 0) {
        // Partial sell
        this.positions.set(signal.symbol, {
          ...existingPosition,
          quantity: remainingQuantity,
          realizedPnL: existingPosition.realizedPnL + realizedPnL,
          timestamp: new Date()
        });
      } else {
        // Full sell - remove position
        this.positions.delete(signal.symbol);
      }

      // Update metrics
      this.metrics.totalTrades++;
      if (realizedPnL > 0) {
        this.metrics.winningTrades++;
        this.metrics.averageWin = (this.metrics.averageWin * (this.metrics.winningTrades - 1) + realizedPnL) / this.metrics.winningTrades;
      } else {
        this.metrics.losingTrades++;
        this.metrics.averageLoss = (this.metrics.averageLoss * (this.metrics.losingTrades - 1) + Math.abs(realizedPnL)) / this.metrics.losingTrades;
      }

      this.metrics.totalPnL += realizedPnL;
      this.tradingSession.dailyPnL += realizedPnL;
      this.tradingSession.tradesToday++;
    }
  }

  /**
   * Validate trading signal
   */
  private validateSignal(signal: TradingSignal): boolean {
    if (!signal.symbol || !signal.action || signal.quantity <= 0 || signal.price <= 0) {
      return false;
    }

    if (signal.confidence < 0 || signal.confidence > 1) {
      return false;
    }

    if (!['BUY', 'SELL', 'HOLD'].includes(signal.action)) {
      return false;
    }

    return true;
  }

  /**
   * Check risk limits
   */
  private checkRiskLimits(signal: TradingSignal): boolean {
    // Check daily loss limit
    if (this.tradingSession.dailyPnL < -this.config.maxDailyLoss) {
      logger.warn('Daily loss limit exceeded', { 
        dailyPnL: this.tradingSession.dailyPnL, 
        limit: this.config.maxDailyLoss 
      });
      return false;
    }

    // Check position limit
    if (this.positions.size >= this.config.maxPositions && signal.action === 'BUY') {
      logger.warn('Maximum positions limit reached', { 
        current: this.positions.size, 
        limit: this.config.maxPositions 
      });
      return false;
    }

    // Check risk per trade
    const tradeValue = signal.quantity * signal.price;
    if (tradeValue > this.config.maxRiskPerTrade) {
      logger.warn('Risk per trade limit exceeded', { 
        tradeValue, 
        limit: this.config.maxRiskPerTrade 
      });
      return false;
    }

    return true;
  }

  /**
   * Start all services
   */
  private async startServices(): Promise<void> {
    // Start WebSocket API
    if (this.config.enableWebSocketAPI) {
      await websocketAPIService.start();
    }

    // Start charting service
    if (this.config.enableRealTimeCharts) {
      chartingService.start();
    }

    // Enable ML service
    if (this.config.enableML) {
      mlService.enable();
    }

    // Start market data service
    await marketDataService.start();

    // Start strategy engine
    await strategyEngine.start();

    logger.info('All services started');
  }

  /**
   * Stop all services
   */
  private async stopServices(): Promise<void> {
    // Stop WebSocket API
    if (this.config.enableWebSocketAPI) {
      websocketAPIService.stop();
    }

    // Stop charting service
    if (this.config.enableRealTimeCharts) {
      chartingService.stop();
    }

    // Disable ML service
    if (this.config.enableML) {
      mlService.disable();
    }

    // Stop market data service
    await marketDataService.stop();

    // Stop strategy engine
    await strategyEngine.stop();

    logger.info('All services stopped');
  }

  /**
   * Start monitoring jobs
   */
  private startMonitoringJobs(): void {
    // Portfolio monitoring job
    jobScheduler.addJob('portfolio_monitor', '*/5 * * * *', async () => {
      await this.monitorPortfolio();
    });

    // Risk monitoring job
    jobScheduler.addJob('risk_monitor', '*/1 * * * *', async () => {
      await this.monitorRisk();
    });

    // Performance monitoring job
    jobScheduler.addJob('performance_monitor', '0 */1 * * *', async () => {
      await this.monitorPerformance();
    });

    // ML model retraining job
    if (this.config.enableML) {
      jobScheduler.addJob('ml_retrain', '0 2 * * *', async () => {
        await this.retrainMLModels();
      });
    }

    logger.info('Monitoring jobs started');
  }

  /**
   * Monitor portfolio
   */
  private async monitorPortfolio(): Promise<void> {
    try {
      const portfolio = await portfolioService.getPortfolio();
      
      // Update position prices
      for (const [symbol, position] of this.positions.entries()) {
        const currentPrice = await marketDataService.getCurrentPrice(symbol);
        if (currentPrice) {
          position.currentPrice = currentPrice;
          position.unrealizedPnL = (currentPrice - position.averagePrice) * position.quantity;
        }
      }

      // Check for stop loss/take profit
      for (const [symbol, position] of this.positions.entries()) {
        const pnlPercent = (position.unrealizedPnL / (position.averagePrice * position.quantity)) * 100;

        if (pnlPercent <= -this.config.riskManagement.stopLoss) {
          // Stop loss triggered
          await this.processSignal({
            symbol,
            action: 'SELL',
            confidence: 1.0,
            price: position.currentPrice,
            quantity: position.quantity,
            timestamp: new Date(),
            source: 'risk',
            metadata: { reason: 'stop_loss', pnlPercent }
          });
        } else if (pnlPercent >= this.config.riskManagement.takeProfit) {
          // Take profit triggered
          await this.processSignal({
            symbol,
            action: 'SELL',
            confidence: 1.0,
            price: position.currentPrice,
            quantity: position.quantity,
            timestamp: new Date(),
            source: 'risk',
            metadata: { reason: 'take_profit', pnlPercent }
          });
        }
      }

      // Broadcast portfolio update
      websocketAPIService.broadcastToTopic('portfolio', {
        type: 'portfolio_update',
        data: {
          positions: Array.from(this.positions.values()),
          totalValue: portfolio.totalValue,
          totalPnL: this.metrics.totalPnL
        },
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error monitoring portfolio', error);
    }
  }

  /**
   * Monitor risk
   */
  private async monitorRisk(): Promise<void> {
    try {
      const riskMetrics = await riskService.calculateRiskMetrics();
      
      // Check max drawdown
      if (riskMetrics.maxDrawdown > this.config.riskManagement.maxDrawdown) {
        logger.warn('Maximum drawdown exceeded', { 
          current: riskMetrics.maxDrawdown, 
          limit: this.config.riskManagement.maxDrawdown 
        });
        
        notificationService.sendNotification(
          'Risk Alert: Maximum Drawdown Exceeded',
          `Current drawdown: ${riskMetrics.maxDrawdown.toFixed(2)}%`
        );

        // Close all positions if configured
        if (this.config.autoRebalance) {
          await this.closeAllPositions();
        }
      }

      // Broadcast risk metrics
      websocketAPIService.broadcastToTopic('risk', {
        type: 'risk_update',
        data: riskMetrics,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error monitoring risk', error);
    }
  }

  /**
   * Monitor performance
   */
  private async monitorPerformance(): Promise<void> {
    try {
      // Calculate performance metrics
      this.metrics.winRate = this.metrics.winningTrades / this.metrics.totalTrades;
      this.metrics.profitFactor = this.metrics.averageWin / this.metrics.averageLoss;

      // Get performance data from monitor
      const performanceData = performanceMonitor.getMetrics();

      // Send performance report
      notificationService.sendNotification(
        'Daily Performance Report',
        `Trades: ${this.tradingSession.tradesToday}, P&L: ${this.tradingSession.dailyPnL.toFixed(2)}, Win Rate: ${(this.metrics.winRate * 100).toFixed(1)}%`
      );

      // Reset daily metrics
      this.tradingSession.dailyPnL = 0;
      this.tradingSession.tradesToday = 0;

      // Cache performance data
      await cacheService.set('performance_metrics', this.metrics, 3600);

    } catch (error) {
      logger.error('Error monitoring performance', error);
    }
  }

  /**
   * Retrain ML models
   */
  private async retrainMLModels(): Promise<void> {
    try {
      logger.info('Starting ML model retraining...');

      // Get training data for all symbols
      const symbols = Array.from(this.positions.keys());
      
      for (const symbol of symbols) {
        const trainingData = mlService.getTrainingData(symbol);
        if (trainingData && trainingData.features.length > 100) {
          await mlService.trainLinearModel(symbol, trainingData);
        }
      }

      logger.info('ML model retraining completed');
    } catch (error) {
      logger.error('Error retraining ML models', error);
    }
  }

  /**
   * Close all positions
   */
  private async closeAllPositions(): Promise<void> {
    logger.info('Closing all positions...');

    for (const [symbol, position] of this.positions.entries()) {
      try {
        await this.processSignal({
          symbol,
          action: 'SELL',
          confidence: 1.0,
          price: position.currentPrice,
          quantity: position.quantity,
          timestamp: new Date(),
          source: 'risk',
          metadata: { reason: 'emergency_close' }
        });
      } catch (error) {
        logger.error(`Error closing position for ${symbol}`, error);
      }
    }
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): void {
    this.metrics = {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      totalPnL: 0,
      dailyPnL: 0
    };
  }

  /**
   * Initialize trading session
   */
  private initializeTradingSession(): void {
    this.tradingSession = {
      startTime: new Date(),
      dailyPnL: 0,
      tradesToday: 0
    };
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle strategy signals
    strategyEngine.on('signal', async (signal: TradingSignal) => {
      signal.source = 'strategy';
      await this.processSignal(signal);
    });

    // Handle ML predictions
    mlService.on('prediction', async (prediction: any) => {
      if (prediction.confidence > 0.7) {
        const signal: TradingSignal = {
          symbol: prediction.symbol,
          action: prediction.prediction,
          confidence: prediction.confidence,
          price: prediction.price,
          quantity: 1, // Default quantity
          timestamp: prediction.timestamp,
          source: 'ml',
          metadata: { model: prediction.model }
        };
        await this.processSignal(signal);
      }
    });

    // Handle market data updates
    marketDataService.on('price_update', (data: any) => {
      // Update charts if enabled
      if (this.config.enableRealTimeCharts) {
        chartingService.updateChart(data.symbol, {
          symbol: data.symbol,
          prices: [data.price],
          volumes: [data.volume || 0],
          timestamps: [new Date()]
        });
      }

      // Broadcast price update
      websocketAPIService.broadcastToTopic('market_data', {
        type: 'price_update',
        data,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Get engine status
   */
  getStatus(): {
    isRunning: boolean;
    positions: number;
    totalPnL: number;
    dailyPnL: number;
    winRate: number;
    uptime: number;
  } {
    return {
      isRunning: this.isRunning,
      positions: this.positions.size,
      totalPnL: this.metrics.totalPnL,
      dailyPnL: this.tradingSession.dailyPnL,
      winRate: this.metrics.winRate,
      uptime: process.uptime()
    };
  }

  /**
   * Get all positions
   */
  getPositions(): TradingPosition[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get trading metrics
   */
  getMetrics(): TradingMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent signals
   */
  getRecentSignals(limit: number = 50): TradingSignal[] {
    return this.signals.slice(-limit);
  }
}

// Export default configuration
export const defaultEngineConfig: EngineConfig = {
  maxPositions: 10,
  maxRiskPerTrade: 10000,
  maxDailyLoss: 50000,
  enableML: true,
  enableRealTimeCharts: true,
  enableWebSocketAPI: true,
  autoRebalance: false,
  riskManagement: {
    stopLoss: 5, // 5%
    takeProfit: 10, // 10%
    trailingStop: true,
    maxDrawdown: 20 // 20%
  }
};

// Export singleton instance
export const advancedTradingEngine = new AdvancedTradingEngine(defaultEngineConfig); 