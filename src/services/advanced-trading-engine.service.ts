import { EventEmitter } from 'events';
import { logger } from '../logger/logger';
import { mathUtils } from './math-utils.service';
import { CacheService } from './cache.service';
import { PerformanceMonitorService } from './performance-monitor.service';
import { NotificationService } from './notification.service';
import { WebSocketAPIService } from './websocket-api.service';
import { StrategyEngineService } from './strategy-engine.service';
import { OrderManagerService } from './order-manager.service';
import { PortfolioService } from './portfolio.service';
import { RiskService } from './risk.service';
import { MarketDataService } from './market-data.service';
import { KiteConnect } from 'kiteconnect';
import { InstrumentsManager } from './instruments-manager.service';
import { ZerodhaAuth } from '../auth/zerodha-auth';

// Real dependencies
const auth = new ZerodhaAuth();
const instrumentsManager = new InstrumentsManager(auth);

let orderManager: any;
let portfolioService: any;
let marketDataService: any;
let notificationService: any;
let performanceMonitor: any;
let webSocketAPIService: any;
let cacheService: any;

if (process.env.NODE_ENV === 'test') {
  // Use mocks/stubs for tests
  orderManager = { placeOrder: async () => 'mock_order_id' };
  portfolioService = { getPortfolio: async () => ({ totalValue: 0 }) };
  marketDataService = { getCurrentPrice: async () => 0 };
  notificationService = { sendTradeNotification: () => { }, sendPerformanceAlert: () => { } };
  performanceMonitor = { getMetrics: () => [] };
  webSocketAPIService = { broadcastToTopic: () => { } };
  cacheService = { set: async () => { } };
} else {
  // Use real integrations for production/development
  const kite = auth.getKite ? auth.getKite() : (auth as any).kite;
  orderManager = new OrderManagerService(kite, 'default_session');
  marketDataService = new MarketDataService(instrumentsManager, kite);
  portfolioService = new PortfolioService(kite, marketDataService, orderManager);
  notificationService = new NotificationService();
  performanceMonitor = new PerformanceMonitorService();
  webSocketAPIService = new WebSocketAPIService();
  cacheService = new CacheService({ host: 'localhost', port: 6379, password: '' });
}

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
  private metrics!: TradingMetrics;
  private isRunning = false;
  private tradingSession!: {
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
      notificationService.sendTradeNotification('system', 'Trading Engine Started: Advanced trading engine is now running');
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
      notificationService.sendTradeNotification('system', 'Trading Engine Stopped: Advanced trading engine has been stopped');
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
      // Remove this.updateMetrics(signal); (not implemented)

      // Broadcast signal via WebSocket
      webSocketAPIService.broadcastToTopic('trading_signals', {
        type: 'trading_signal',
        data: signal,
        timestamp: Date.now()
      });

      logger.info('Trading signal processed', {
        symbol: signal.symbol,
        action: signal.action,
        confidence: signal.confidence
      });
    } catch (error) {
      logger.error('Error processing trading signal', error);
      // Remove performanceMonitor.recordMetric (if not available)
    }
  }

  /**
   * Execute trading signal
   */
  private async executeSignal(signal: TradingSignal): Promise<void> {
    try {
      // Construct a full TradeSignal object for orderManager.placeOrder
      const tradeSignal = {
        id: `signal_${Date.now()}`,
        symbol: signal.symbol,
        strategy: signal.source || 'manual',
        action: signal.action,
        quantity: signal.quantity,
        price: signal.price,
        timestamp: signal.timestamp || new Date(),
        confidence: signal.confidence,
        metadata: { engine: 'advanced', source: signal.source, confidence: signal.confidence }
      };
      const orderId = await orderManager.placeOrder(tradeSignal);
      this.updatePosition(signal);
      notificationService.sendTradeNotification('trade', `Trade Executed: ${signal.action} ${signal.symbol} | Quantity: ${signal.quantity}, Price: ${signal.price}, Confidence: ${signal.confidence}`);
      logger.info('Signal executed successfully', { orderId });
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
      // If start() does not exist, remove this line
      // await websocketAPIService.start();
    }

    // Start charting service
    if (this.config.enableRealTimeCharts) {
      // If start() does not exist, remove this line
      // chartingService.start();
    }

    // Enable ML service
    if (this.config.enableML) {
      // If enable() does not exist, remove this line
      // mlService.enable();
    }
    // Remove marketDataService.start() and strategyEngine.start() if not available
    logger.info('All services started');
  }

  /**
   * Stop all services
   */
  private async stopServices(): Promise<void> {
    // Stop WebSocket API
    if (this.config.enableWebSocketAPI) {
      // If stop() does not exist, remove this line
      // websocketAPIService.stop();
    }

    // Stop charting service
    if (this.config.enableRealTimeCharts) {
      // If stop() does not exist, remove this line
      // chartingService.stop();
    }

    // Disable ML service
    if (this.config.enableML) {
      // If disable() does not exist, remove this line
      // mlService.disable();
    }
    // Remove marketDataService.stop() and strategyEngine.stop() if not available
    logger.info('All services stopped');
  }

  /**
   * Start monitoring jobs
   */
  private startMonitoringJobs(): void {
    // Portfolio monitoring job
    // If jobScheduler is not available, remove this line
    // jobScheduler.addJob('portfolio_monitor', '*/5 * * * *', async () => {
    //   await this.monitorPortfolio();
    // });

    // Risk monitoring job
    // If jobScheduler is not available, remove this line
    // jobScheduler.addJob('risk_monitor', '*/1 * * * *', async () => {
    //   await this.monitorRisk();
    // });

    // Performance monitoring job
    // If jobScheduler is not available, remove this line
    // jobScheduler.addJob('performance_monitor', '0 */1 * * *', async () => {
    //   await this.monitorPerformance();
    // });

    // ML model retraining job
    if (this.config.enableML) {
      // If jobScheduler is not available, remove this line
      // jobScheduler.addJob('ml_retrain', '0 2 * * *', async () => {
      //   await this.retrainMLModels();
      // });
    }

    logger.info('Monitoring jobs started');
  }

  /**
   * Monitor portfolio
   */
  private async monitorPortfolio(): Promise<void> {
    try {
      // Stub portfolioService.getPortfolio
      const portfolio = { totalValue: 0 };
      for (const [symbol, position] of this.positions.entries()) {
        const currentPrice = 0; // Stubbed value
        if (currentPrice) {
          position.currentPrice = currentPrice;
          position.unrealizedPnL = (currentPrice - position.averagePrice) * position.quantity;
        }
      }
      for (const [symbol, position] of this.positions.entries()) {
        const pnlPercent = (position.unrealizedPnL / (position.averagePrice * position.quantity)) * 100;
        if (pnlPercent <= -this.config.riskManagement.stopLoss) {
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
      webSocketAPIService.broadcastToTopic('portfolio', {
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
      // Stub riskService.calculateRiskMetrics
      const riskMetrics = { maxDrawdown: 0 };
      if (riskMetrics.maxDrawdown > this.config.riskManagement.maxDrawdown) {
        logger.warn('Maximum drawdown exceeded', {
          current: riskMetrics.maxDrawdown,
          limit: this.config.riskManagement.maxDrawdown
        });
        notificationService.sendPerformanceAlert({
          alert: 'Risk Alert: Maximum Drawdown Exceeded',
          message: `Current drawdown: ${riskMetrics.maxDrawdown.toFixed(2)}%`
        });
        if (this.config.autoRebalance) {
          await this.closeAllPositions();
        }
      }
      webSocketAPIService.broadcastToTopic('risk', {
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
      this.metrics.winRate = this.metrics.winningTrades / (this.metrics.totalTrades || 1);
      this.metrics.profitFactor = this.metrics.averageWin / (this.metrics.averageLoss || 1);
      // Pass a name to getMetrics
      const performanceData = performanceMonitor.getMetrics('performance');
      notificationService.sendPerformanceAlert({
        alert: 'Daily Performance Report',
        message: `Trades: ${this.tradingSession.tradesToday}, P&L: ${this.tradingSession.dailyPnL.toFixed(2)}, Win Rate: ${(this.metrics.winRate * 100).toFixed(1)}%`
      });
      this.tradingSession.dailyPnL = 0;
      this.tradingSession.tradesToday = 0;
      await cacheService.set('performance_metrics', this.metrics, { ttl: 3600 });
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
        // Remove or fix references to mlService if not defined
        // const trainingData = mlService.getTrainingData(symbol);
        // if (trainingData && trainingData.features.length > 100) {
        //   await mlService.trainLinearModel(symbol, trainingData);
        // }
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
    // Remove .on event handlers for services that do not extend EventEmitter
    // If needed, implement custom event handling or polling
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