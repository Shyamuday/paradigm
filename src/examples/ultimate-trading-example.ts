import { logger } from '../logger/logger';
import { mathUtils } from '../services/math-utils.service';
import { cacheService } from '../services/cache.service';
import { performanceMonitor } from '../services/performance-monitor.service';
import { notificationService } from '../services/notification.service';
import { jobScheduler } from '../services/job-scheduler.service';
import { mlService } from '../services/machine-learning.service';
import { chartingService } from '../services/advanced-charting.service';
import { websocketAPIService } from '../services/websocket-api.service';
import { advancedTradingEngine, defaultEngineConfig } from '../services/advanced-trading-engine.service';
import { ZerodhaAuth } from '../auth/zerodha-auth';
import { MarketDataService } from '../services/market-data.service';
import { StrategyEngineService } from '../services/strategy-engine.service';
import { PortfolioService } from '../services/portfolio.service';
import { RiskService } from '../services/risk.service';

/**
 * Ultimate Trading Example - Demonstrates all enhanced features working together
 */
export async function ultimateTradingExample(): Promise<void> {
  try {
    logger.info('🚀 Starting Ultimate Trading Example with all enhanced features...');

    // 1. Initialize all services
    await initializeAllServices();

    // 2. Start the advanced trading engine
    await startAdvancedTradingEngine();

    // 3. Setup real-time monitoring and charts
    await setupRealTimeMonitoring();

    // 4. Configure ML models and training
    await setupMachineLearning();

    // 5. Start automated trading strategies
    await startAutomatedTrading();

    // 6. Setup WebSocket API for external connections
    await setupWebSocketAPI();

    // 7. Run performance monitoring
    await runPerformanceMonitoring();

    logger.info('✅ Ultimate Trading Example started successfully!');
    
    // Keep the application running
    await keepAlive();

  } catch (error) {
    logger.error('❌ Error in Ultimate Trading Example', error);
    throw error;
  }
}

/**
 * Initialize all core services
 */
async function initializeAllServices(): Promise<void> {
  logger.info('🔧 Initializing all services...');

  // Start performance monitoring
  performanceMonitor.start();
  logger.info('✅ Performance monitoring started');

  // Initialize cache service
  await cacheService.connect();
  logger.info('✅ Cache service initialized');

  // Start job scheduler
  jobScheduler.start();
  logger.info('✅ Job scheduler started');

  // Initialize notification service
  notificationService.initialize();
  logger.info('✅ Notification service initialized');

  // Initialize market data service
  const marketDataService = new MarketDataService();
  await marketDataService.start();
  logger.info('✅ Market data service started');

  // Initialize strategy engine
  const strategyEngine = new StrategyEngineService();
  await strategyEngine.start();
  logger.info('✅ Strategy engine started');

  // Initialize portfolio service
  const portfolioService = new PortfolioService();
  await portfolioService.initialize();
  logger.info('✅ Portfolio service initialized');

  // Initialize risk service
  const riskService = new RiskService();
  await riskService.initialize();
  logger.info('✅ Risk service initialized');

  logger.info('🎉 All services initialized successfully!');
}

/**
 * Start the advanced trading engine
 */
async function startAdvancedTradingEngine(): Promise<void> {
  logger.info('🚀 Starting Advanced Trading Engine...');

  // Customize engine configuration
  const customConfig = {
    ...defaultEngineConfig,
    maxPositions: 5,
    maxRiskPerTrade: 5000,
    maxDailyLoss: 25000,
    enableML: true,
    enableRealTimeCharts: true,
    enableWebSocketAPI: true,
    autoRebalance: true,
    riskManagement: {
      stopLoss: 3, // 3%
      takeProfit: 8, // 8%
      trailingStop: true,
      maxDrawdown: 15 // 15%
    }
  };

  // Start the engine
  await advancedTradingEngine.start();
  logger.info('✅ Advanced Trading Engine started with custom configuration');
}

/**
 * Setup real-time monitoring and charts
 */
async function setupRealTimeMonitoring(): Promise<void> {
  logger.info('📊 Setting up real-time monitoring and charts...');

  // Start charting service
  chartingService.start();

  // Create charts for multiple symbols
  const symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK'];
  
  symbols.forEach(symbol => {
    chartingService.createCandlestickChart(symbol, {
      width: 800,
      height: 600,
      title: `${symbol} - Real-time Chart`,
      showVolume: true,
      showIndicators: true,
      updateInterval: 1000
    });
  });

  // Create performance dashboard
  chartingService.createPerformanceChart({
    portfolioValue: [100000, 101000, 102500, 101800, 103200],
    pnl: [0, 1000, 2500, 1800, 3200],
    timestamps: [
      new Date(Date.now() - 4 * 60000),
      new Date(Date.now() - 3 * 60000),
      new Date(Date.now() - 2 * 60000),
      new Date(Date.now() - 1 * 60000),
      new Date()
    ],
    riskMetrics: {
      sharpeRatio: 1.2,
      maxDrawdown: 5.2,
      volatility: 12.5
    }
  });

  logger.info('✅ Real-time monitoring and charts setup complete');
}

/**
 * Setup machine learning models
 */
async function setupMachineLearning(): Promise<void> {
  logger.info('🤖 Setting up Machine Learning models...');

  // Enable ML service
  mlService.enable();

  // Generate sample training data
  const symbols = ['RELIANCE', 'TCS', 'INFY'];
  
  for (const symbol of symbols) {
    // Generate synthetic training data
    const trainingData = generateTrainingData(symbol);
    
    // Add training data to ML service
    trainingData.features.forEach((features, index) => {
      mlService.addTrainingData(
        symbol,
        features,
        trainingData.targets[index],
        trainingData.timestamps[index]
      );
    });

    // Train model if enough data
    if (trainingData.features.length > 50) {
      await mlService.trainLinearModel(symbol, trainingData);
      logger.info(`✅ ML model trained for ${symbol}`);
    }
  }

  // Setup ML prediction monitoring
  mlService.on('prediction', (prediction) => {
    logger.info('🤖 ML Prediction received', {
      symbol: prediction.symbol,
      prediction: prediction.prediction,
      confidence: prediction.confidence
    });
  });

  logger.info('✅ Machine Learning setup complete');
}

/**
 * Start automated trading strategies
 */
async function startAutomatedTrading(): Promise<void> {
  logger.info('📈 Starting automated trading strategies...');

  // Add scheduled trading jobs
  jobScheduler.addJob('market_analysis', '*/5 * * * *', async () => {
    await performMarketAnalysis();
  });

  jobScheduler.addJob('portfolio_rebalance', '0 */2 * * *', async () => {
    await rebalancePortfolio();
  });

  jobScheduler.addJob('risk_check', '*/1 * * * *', async () => {
    await performRiskCheck();
  });

  // Add custom trading signals
  advancedTradingEngine.on('signal', async (signal) => {
    logger.info('📊 Trading signal received', {
      symbol: signal.symbol,
      action: signal.action,
      confidence: signal.confidence,
      source: signal.source
    });
  });

  logger.info('✅ Automated trading strategies started');
}

/**
 * Setup WebSocket API
 */
async function setupWebSocketAPI(): Promise<void> {
  logger.info('🌐 Setting up WebSocket API...');

  // Start WebSocket API service
  await websocketAPIService.start();

  // Add custom endpoints
  websocketAPIService.addEndpoint({
    path: '/trading/status',
    method: 'GET',
    handler: async (req, res) => {
      const status = advancedTradingEngine.getStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
    }
  });

  websocketAPIService.addEndpoint({
    path: '/trading/positions',
    method: 'GET',
    handler: async (req, res) => {
      const positions = advancedTradingEngine.getPositions();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ positions }));
    }
  });

  // Handle WebSocket connections
  websocketAPIService.on('clientConnected', (clientId) => {
    logger.info('🌐 WebSocket client connected', { clientId });
  });

  websocketAPIService.on('clientDisconnected', (clientId) => {
    logger.info('🌐 WebSocket client disconnected', { clientId });
  });

  logger.info('✅ WebSocket API setup complete');
}

/**
 * Run performance monitoring
 */
async function runPerformanceMonitoring(): Promise<void> {
  logger.info('📊 Starting performance monitoring...');

  // Add performance monitoring jobs
  jobScheduler.addJob('performance_report', '0 */1 * * *', async () => {
    await generatePerformanceReport();
  });

  jobScheduler.addJob('cache_cleanup', '0 2 * * *', async () => {
    await cleanupCache();
  });

  // Monitor key metrics
  setInterval(() => {
    const metrics = performanceMonitor.getMetrics();
    const engineStatus = advancedTradingEngine.getStatus();
    
    logger.info('📊 Performance Metrics', {
      cpuUsage: metrics.cpuUsage,
      memoryUsage: metrics.memoryUsage,
      activeConnections: websocketAPIService.getStatus().clients,
      tradingEngineStatus: engineStatus.isRunning,
      activePositions: engineStatus.positions,
      totalPnL: engineStatus.totalPnL
    });
  }, 30000); // Every 30 seconds

  logger.info('✅ Performance monitoring started');
}

/**
 * Generate synthetic training data
 */
function generateTrainingData(symbol: string): any {
  const features = [];
  const targets = [];
  const timestamps = [];
  
  for (let i = 0; i < 100; i++) {
    const timestamp = new Date(Date.now() - (100 - i) * 60000);
    
    // Generate synthetic features
    const featureSet = {
      price_change: (Math.random() - 0.5) * 0.1,
      rsi: 30 + Math.random() * 40,
      volume_ratio: 0.5 + Math.random() * 1.5,
      momentum_5: (Math.random() - 0.5) * 0.05,
      bb_position: Math.random()
    };
    
    features.push(Object.values(featureSet));
    
    // Generate synthetic target (1 for BUY, -1 for SELL, 0 for HOLD)
    const target = Math.random() > 0.7 ? 1 : Math.random() > 0.3 ? -1 : 0;
    targets.push(target);
    timestamps.push(timestamp);
  }
  
  return { features, targets, timestamps, symbols: Array(100).fill(symbol) };
}

/**
 * Perform market analysis
 */
async function performMarketAnalysis(): Promise<void> {
  try {
    logger.info('🔍 Performing market analysis...');
    
    const symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK'];
    
    for (const symbol of symbols) {
      // Get current market data
      const marketData = await getMockMarketData(symbol);
      
      // Extract features for ML
      const features = mlService.extractFeatures(marketData);
      
      // Make ML prediction
      try {
        const prediction = await mlService.predict(symbol, features);
        logger.info(`🤖 ML Prediction for ${symbol}`, {
          prediction: prediction.prediction,
          confidence: prediction.confidence
        });
      } catch (error) {
        logger.debug(`No ML model available for ${symbol}`);
      }
      
      // Update charts
      chartingService.updateChart(symbol, {
        symbol,
        prices: marketData.map(d => d.close),
        volumes: marketData.map(d => d.volume || 0),
        timestamps: marketData.map(d => new Date(d.timestamp))
      });
    }
    
    logger.info('✅ Market analysis completed');
  } catch (error) {
    logger.error('❌ Error in market analysis', error);
  }
}

/**
 * Rebalance portfolio
 */
async function rebalancePortfolio(): Promise<void> {
  try {
    logger.info('⚖️ Rebalancing portfolio...');
    
    const positions = advancedTradingEngine.getPositions();
    const totalValue = positions.reduce((sum, pos) => sum + (pos.quantity * pos.currentPrice), 0);
    
    // Simple rebalancing logic
    for (const position of positions) {
      const currentWeight = (position.quantity * position.currentPrice) / totalValue;
      const targetWeight = 0.25; // Equal weight (25% each)
      
      if (Math.abs(currentWeight - targetWeight) > 0.05) {
        logger.info(`Rebalancing ${position.symbol}`, {
          currentWeight: (currentWeight * 100).toFixed(1) + '%',
          targetWeight: (targetWeight * 100).toFixed(1) + '%'
        });
      }
    }
    
    logger.info('✅ Portfolio rebalancing completed');
  } catch (error) {
    logger.error('❌ Error in portfolio rebalancing', error);
  }
}

/**
 * Perform risk check
 */
async function performRiskCheck(): Promise<void> {
  try {
    logger.info('⚠️ Performing risk check...');
    
    const status = advancedTradingEngine.getStatus();
    
    // Check daily loss limit
    if (status.dailyPnL < -20000) {
      logger.warn('🚨 Daily loss limit approaching!', { dailyPnL: status.dailyPnL });
      notificationService.sendTradeNotification(
        'Risk Alert',
        `Daily P&L: ${status.dailyPnL.toFixed(2)} - Approaching loss limit`
      );
    }
    
    // Check position count
    if (status.positions > 8) {
      logger.warn('🚨 High position count', { positions: status.positions });
    }
    
    logger.info('✅ Risk check completed');
  } catch (error) {
    logger.error('❌ Error in risk check', error);
  }
}

/**
 * Generate performance report
 */
async function generatePerformanceReport(): Promise<void> {
  try {
    logger.info('📊 Generating performance report...');
    
    const metrics = advancedTradingEngine.getMetrics();
    const status = advancedTradingEngine.getStatus();
    
    const report = {
      timestamp: new Date().toISOString(),
      totalTrades: metrics.totalTrades,
      winRate: (metrics.winRate * 100).toFixed(1) + '%',
      totalPnL: metrics.totalPnL.toFixed(2),
      dailyPnL: status.dailyPnL.toFixed(2),
      activePositions: status.positions,
      uptime: (status.uptime / 3600).toFixed(1) + ' hours'
    };
    
    // Cache the report
    await cacheService.set('performance_report', report, 3600);
    
    // Send notification
    notificationService.sendTradeNotification(
      'Performance Report',
      `Trades: ${report.totalTrades}, Win Rate: ${report.winRate}, P&L: ${report.totalPnL}`
    );
    
    logger.info('✅ Performance report generated', report);
  } catch (error) {
    logger.error('❌ Error generating performance report', error);
  }
}

/**
 * Cleanup cache
 */
async function cleanupCache(): Promise<void> {
  try {
    logger.info('🧹 Cleaning up cache...');
    
    // Clear old performance data
    await cacheService.delete('old_performance_data');
    
    // Clear old market data
    await cacheService.delete('old_market_data');
    
    logger.info('✅ Cache cleanup completed');
  } catch (error) {
    logger.error('❌ Error in cache cleanup', error);
  }
}

/**
 * Get mock market data
 */
async function getMockMarketData(symbol: string): Promise<any[]> {
  const data = [];
  const basePrice = 1000 + Math.random() * 500;
  
  for (let i = 0; i < 50; i++) {
    const price = basePrice + (Math.random() - 0.5) * 50;
    data.push({
      timestamp: Date.now() - (50 - i) * 60000,
      open: price * (0.99 + Math.random() * 0.02),
      high: price * (1.0 + Math.random() * 0.01),
      low: price * (0.99 - Math.random() * 0.01),
      close: price,
      volume: 1000000 + Math.random() * 500000
    });
  }
  
  return data;
}

/**
 * Keep the application alive
 */
async function keepAlive(): Promise<void> {
  logger.info('🔄 Keeping application alive... Press Ctrl+C to exit');
  
  return new Promise(() => {
    // Keep the process running
    process.on('SIGINT', async () => {
      logger.info('🛑 Shutting down gracefully...');
      
      // Stop all services
      await advancedTradingEngine.stop();
      chartingService.stop();
      websocketAPIService.stop();
      jobScheduler.stop();
      performanceMonitor.stop();
      await cacheService.disconnect();
      
      logger.info('✅ Shutdown complete');
      process.exit(0);
    });
  });
}

// Export the example function
export { ultimateTradingExample }; 