/**
 * Paradigm Trading System - Complete Export Index
 * 
 * This file provides a comprehensive export of all components in the Paradigm Trading System.
 * It's organized into logical sections for easy navigation and import.
 * 
 * Architecture Overview:
 * - Core Infrastructure: Config, Database, Logging
 * - Security & Error Handling: Validation, Circuit Breakers, Error Management
 * - Trading Services: Orders, Portfolio, Risk, Market Data
 * - Strategy Engine: Strategies, Backtesting, ML Integration
 * - Data Management: Caching, Optimization, Live Data
 * - UI & Monitoring: Dashboards, Performance Monitoring
 * - Utilities: Math, Technical Indicators, Notifications
 * - Middleware: Express middleware for all services
 * - Examples: Complete integration examples
 * - Types: TypeScript type definitions
 */

// ============================================================================
// CORE INFRASTRUCTURE
// ============================================================================

// Configuration and Database
export { ConfigManager } from './config/config-manager';
export { DatabaseManager, db, dbManager, initializeDatabase } from './database/database';

// Logging
export { logger } from './logger/logger';

// Authentication
export { ZerodhaAuth } from './auth/zerodha-auth';
export { AuthManagerService } from './services/auth-manager.service';

// ============================================================================
// SECURITY & ERROR HANDLING
// ============================================================================

// Error Handling System
export { 
  errorHandler, 
  ErrorHandler, 
  TradingError, 
  ErrorCategory, 
  ErrorSeverity,
  createAuthenticationError,
  createRateLimitError,
  createNetworkError,
  createDatabaseError,
  createValidationError,
  createTradingError
} from './utils/error-handler';

// Circuit Breaker System
export {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitState,
  circuitBreakerManager,
  createApiCircuitBreaker,
  createDatabaseCircuitBreaker,
  createExternalServiceCircuitBreaker
} from './utils/circuit-breaker';

// Security Validation System
export {
  SecurityValidator,
  SecurityLevel,
  ValidationType,
  securityValidator,
  validateTradingInput,
  validateOrderInput,
  validateUserInput,
  validatePassword,
  hashPassword,
  generateSecureToken,
  generateApiKey
} from './utils/security-validator';

// ============================================================================
// TRADING SERVICES
// ============================================================================

// Order Management
export { OrderService } from './services/order.service';
export { OrderManagerService } from './services/order-manager.service';
export { AdvancedOrderService } from './services/advanced-order.service';

// Portfolio & Risk Management
export { PortfolioService } from './services/portfolio.service';
export { RiskService } from './services/risk.service';

// Market Data & Instruments
export { MarketDataService } from './services/market-data.service';
export { InstrumentsManager } from './services/instruments-manager.service';
export { LiveDataIntegrationService } from './services/live-data-integration.service';

// Transaction Costs
export { TransactionCostService } from './services/transaction-cost.service';

// User Management
export { UserService } from './services/user.service';

// ============================================================================
// STRATEGY ENGINE & BACKTESTING
// ============================================================================

// Strategy Services
export { StrategyService } from './services/strategy.service';
export { StrategyEngineService } from './services/strategy-engine.service';
export { StrategyFactory } from './services/strategy-factory.service';

// Automated Trading
export { AutomatedTradingService } from './services/automated-trading.service';
export { EnhancedBacktestService } from './services/enhanced-backtest.service';
export { advancedTradingEngine, defaultEngineConfig } from './services/advanced-trading-engine.service';

// Strategy Implementations
export { MovingAverageStrategy } from './services/strategies/moving-average-strategy';
export { RsiStrategy } from './services/strategies/rsi-strategy';
export { BreakoutStrategy } from './services/strategies/breakout-strategy';
export { EnhancedMomentumStrategy } from './services/strategies/enhanced-momentum-strategy';
export { OptionsStrategy } from './services/strategies/options-strategy';

// Options Trading
export { OptionsTechnicalAnalysisService } from './services/options-technical-analysis';
export { OptionsTechnicalIndicatorsService } from './services/options-technical-indicators.service';

// ============================================================================
// DATA MANAGEMENT & CACHING
// ============================================================================

// Multi-Level Caching System
export {
  MultiLevelCacheService,
  CacheConfig,
  CacheItem,
  CacheStats,
  CacheOperation,
  MultiLevelCacheConfig
} from './services/multi-level-cache.service';

// Legacy Cache Service
export { CacheService } from './services/cache.service';

// Database Optimization
export {
  DatabaseOptimizationService,
  IndexConfig,
  QueryMetrics,
  OptimizationRecommendation,
  DatabaseStats
} from './services/database-optimization.service';

// Timeframe Management
export { TimeframeManagerService } from './services/timeframe-manager.service';

// ============================================================================
// TECHNICAL ANALYSIS & UTILITIES
// ============================================================================

// Technical Indicators
export { TechnicalIndicatorsService } from './services/technical-indicators.service';

// Advanced Charting
export { chartingService } from './services/advanced-charting.service';

// Math Utilities
export { mathUtils } from './services/math-utils.service';

// Machine Learning
export { mlService } from './services/machine-learning.service';

// ============================================================================
// MONITORING & NOTIFICATIONS
// ============================================================================

// Performance Monitoring
export { performanceMonitor } from './services/performance-monitor.service';

// Notifications
export { notificationService } from './services/notification.service';

// Job Scheduler
export { jobScheduler } from './services/scheduler.service';

// ============================================================================
// WEBSOCKET & API SERVICES
// ============================================================================

// WebSocket Management
export { WebsocketManagerService } from './services/websocket-manager.service';
export { websocketAPIService } from './services/websocket-api.service';

// ============================================================================
// EXPRESS MIDDLEWARE
// ============================================================================

// Error Handling Middleware
export { errorMiddleware } from './middleware/error-handler';

// Circuit Breaker Middleware
export {
  circuitBreakerMiddleware,
  circuitBreakerHealthMiddleware,
  circuitBreakerStatsMiddleware,
  circuitBreakerControlMiddleware,
  circuitBreakerMonitoringMiddleware,
  createZerodhaApiCircuitBreaker,
  createMarketDataApiCircuitBreaker,
  createPostgresCircuitBreaker,
  createRedisCircuitBreaker,
  createNotificationServiceCircuitBreaker,
  createAnalyticsServiceCircuitBreaker
} from './middleware/circuit-breaker';

// Security Validation Middleware
export {
  securityMiddleware,
  inputValidationMiddleware,
  authenticationMiddleware,
  rateLimitMiddleware,
  securityHeadersMiddleware,
  auditLogMiddleware,
  tradingValidationMiddleware,
  userRegistrationMiddleware,
  securityMonitoringMiddleware
} from './middleware/security-validation';

// Rate Limiting Middleware
export { rateLimiter } from './middleware/rate-limiter';

// Multi-Level Cache Middleware
export {
  MultiLevelCacheMiddleware,
  CacheMiddlewareConfig,
  CachedResponse
} from './middleware/multi-level-cache';

// Database Optimization Middleware
export {
  DatabaseOptimizationMiddleware,
  DatabaseOptimizationMiddlewareConfig
} from './middleware/database-optimization';

// ============================================================================
// UI & DASHBOARDS
// ============================================================================

// Web Dashboard
export { runDashboard } from './ui/run-dashboard';

// Terminal Dashboard
export { TerminalDashboard } from './ui/terminal-dashboard';

// ============================================================================
// WEBHOOKS
// ============================================================================

export { startWebhook } from './webhooks/start-webhook';
export { handleOrderUpdate } from './webhooks/order-updates';

// ============================================================================
// COMPLETE INTEGRATION EXAMPLES
// ============================================================================

// Core Examples
export { authExample } from './examples/auth-example';
export { simpleTradingExample } from './examples/simple-trading-example';
export { automatedTradingExample } from './examples/automated-trading-example';
export { completeTradingIntegration } from './examples/complete-trading-integration';
export { enhancedTradingExample } from './examples/enhanced-trading-example';
export { ultimateTradingExample } from './examples/ultimate-trading-example';

// Data Integration Examples
export { liveDataIntegrationExample } from './examples/live-data-integration-example';
export { improvedInstrumentsExample } from './examples/improved-instruments-example';
export { simpleTokensManager } from './examples/simple-tokens-manager';

// System Integration Examples
export { runErrorHandlerIntegration } from './examples/error-handler-integration';
export { runCircuitBreakerIntegration } from './examples/circuit-breaker-integration';
export { runSecurityValidationIntegration } from './examples/security-validation-integration';
export { runMultiLevelCacheExample } from './examples/multi-level-cache-integration';
export { runDatabaseOptimizationExample } from './examples/database-optimization-integration';

// ============================================================================
// SCHEMAS & VALIDATION
// ============================================================================

// Authentication Schema
export * from './schemas/auth.schema';

// Instruments Schema
export * from './schemas/instruments.schema';

// Strategy Schema
export * from './schemas/strategy.schema';

// Configuration Schema
export * from './config/config.schema';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Core Types
export * from './types';
export * from './types/portfolio.types';

// KiteConnect Types
export * from './types/kiteconnect.d';

// ============================================================================
// CONVENIENCE EXPORTS & ALIASES
// ============================================================================

// Common service aliases for easier imports
export const services = {
  // Core
  config: ConfigManager,
  database: DatabaseService,
  logger,
  
  // Trading
  orders: OrderService,
  orderManager: OrderManagerService,
  advancedOrders: AdvancedOrderService,
  portfolio: PortfolioService,
  risk: RiskService,
  marketData: MarketDataService,
  instruments: InstrumentsManagerService,
  liveData: LiveDataIntegrationService,
  transactionCost: TransactionCostService,
  user: UserService,
  
  // Strategy
  strategy: StrategyService,
  strategyEngine: StrategyEngineService,
  strategyFactory: StrategyFactoryService,
  automatedTrading: AutomatedTradingService,
  backtest: EnhancedBacktestService,
  tradingEngine: advancedTradingEngine,
  
  // Data & Caching
  multiLevelCache: MultiLevelCacheService,
  cache: CacheService,
  databaseOptimization: DatabaseOptimizationService,
  timeframe: TimeframeManagerService,
  
  // Analysis
  technicalIndicators: TechnicalIndicatorsService,
  charting: chartingService,
  math: mathUtils,
  ml: mlService,
  
  // Monitoring
  performance: performanceMonitor,
  notifications: notificationService,
  scheduler: jobScheduler,
  
  // WebSocket
  websocket: WebsocketManagerService,
  websocketAPI: websocketAPIService,
  
  // Security & Error Handling
  errorHandler,
  circuitBreaker: circuitBreakerManager,
  security: securityValidator,
  
  // Authentication
  auth: ZerodhaAuth,
  authManager: AuthManagerService
};

// Middleware aliases
export const middleware = {
  error: errorMiddleware,
  circuitBreaker: circuitBreakerMiddleware,
  security: securityMiddleware,
  rateLimit: rateLimiter,
  cache: MultiLevelCacheMiddleware,
  databaseOptimization: DatabaseOptimizationMiddleware
};

// Strategy implementations
export const strategies = {
  movingAverage: MovingAverageStrategy,
  rsi: RSIStrategy,
  breakout: BreakoutStrategy,
  momentum: EnhancedMomentumStrategy,
  options: OptionsStrategy
};

// Examples
export const examples = {
  auth: authExample,
  simpleTrading: simpleTradingExample,
  automatedTrading: automatedTradingExample,
  completeTrading: completeTradingIntegration,
  enhancedTrading: enhancedTradingExample,
  ultimateTrading: ultimateTradingExample,
  liveData: liveDataIntegrationExample,
  instruments: improvedInstrumentsExample,
  tokens: simpleTokensManager,
  errorHandler: runErrorHandlerIntegration,
  circuitBreaker: runCircuitBreakerIntegration,
  security: runSecurityValidationIntegration,
  cache: runMultiLevelCacheExample,
  databaseOptimization: runDatabaseOptimizationExample
};

// ============================================================================
// SYSTEM INITIALIZATION HELPERS
// ============================================================================

/**
 * Initialize the complete Paradigm Trading System
 * This function sets up all core services and returns a configured system instance
 */
export async function initializeParadigmSystem(config?: any) {
  const system = {
    services,
    middleware,
    strategies,
    examples,
    
    // Initialize core services
    async init() {
      // Initialize database
      await DatabaseService.getInstance().connect();
      
      // Initialize cache
      await MultiLevelCacheService.getInstance().initialize();
      
      // Initialize circuit breakers
      circuitBreakerManager.initialize();
      
      // Initialize performance monitor
      performanceMonitor.start();
      
      logger.info('Paradigm Trading System initialized successfully');
      return this;
    },
    
    // Graceful shutdown
    async shutdown() {
      logger.info('Shutting down Paradigm Trading System...');
      
      // Stop performance monitor
      performanceMonitor.stop();
      
      // Close database connections
      await DatabaseService.getInstance().disconnect();
      
      // Close cache connections
      await MultiLevelCacheService.getInstance().shutdown();
      
      logger.info('Paradigm Trading System shutdown complete');
    }
  };
  
  return system;
}

/**
 * Quick start function for common trading scenarios
 */
export async function quickStart() {
  const system = await initializeParadigmSystem();
  await system.init();
  
  logger.info('Paradigm Trading System ready for trading operations');
  return system;
}

// ============================================================================
// VERSION & METADATA
// ============================================================================

export const VERSION = '2.0.0';
export const SYSTEM_NAME = 'Paradigm Trading System';
export const DESCRIPTION = 'Advanced algorithmic trading platform with comprehensive features';

// Export metadata
export const metadata = {
  version: VERSION,
  name: SYSTEM_NAME,
  description: DESCRIPTION,
  features: [
    'Multi-level caching system',
    'Circuit breaker pattern',
    'Advanced error handling',
    'Security validation',
    'Machine learning integration',
    'Real-time market data',
    'Automated trading strategies',
    'Risk management',
    'Performance monitoring',
    'Database optimization',
    'WebSocket integration',
    'Technical analysis',
    'Options trading support',
    'Backtesting engine',
    'Portfolio management'
  ],
  architecture: {
    layers: [
      'Core Infrastructure',
      'Security & Error Handling', 
      'Trading Services',
      'Strategy Engine',
      'Data Management',
      'Monitoring & UI'
    ],
    patterns: [
      'Circuit Breaker',
      'Multi-Level Caching',
      'Strategy Pattern',
      'Observer Pattern',
      'Factory Pattern',
      'Middleware Pattern'
    ]
  }
};

// Default export for convenience
export default {
  VERSION,
  SYSTEM_NAME,
  DESCRIPTION,
  services,
  middleware,
  strategies,
  examples,
  initializeParadigmSystem,
  quickStart,
  metadata
}; 