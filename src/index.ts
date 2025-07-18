// Core services
export { ConfigManager } from './config/config-manager';
export { DatabaseService } from './database/database';
export { logger } from './logger/logger';

// Error handling
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
export { errorMiddleware } from './middleware/error-handler';

// Circuit breakers
export {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitState,
  circuitBreakerManager,
  createApiCircuitBreaker,
  createDatabaseCircuitBreaker,
  createExternalServiceCircuitBreaker
} from './utils/circuit-breaker';
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

// Authentication
export { ZerodhaAuth } from './auth/zerodha-auth';

// Trading services
export { OrderService } from './services/order.service';
export { OrderManagerService } from './services/order-manager.service';
export { AdvancedOrderService } from './services/advanced-order.service';
export { PortfolioService } from './services/portfolio.service';
export { RiskService } from './services/risk.service';
export { MarketDataService } from './services/market-data.service';
export { StrategyService } from './services/strategy.service';
export { StrategyEngineService } from './services/strategy-engine.service';
export { StrategyFactoryService } from './services/strategy-factory.service';
export { AutomatedTradingService } from './services/automated-trading.service';
export { EnhancedBacktestService } from './services/enhanced-backtest.service';
export { InstrumentsManagerService } from './services/instruments-manager.service';
export { LiveDataIntegrationService } from './services/live-data-integration.service';
export { OptionsTechnicalAnalysisService } from './services/options-technical-analysis.service';
export { OptionsTechnicalIndicatorsService } from './services/options-technical-indicators.service';
export { TransactionCostService } from './services/transaction-cost.service';
export { UserService } from './services/user.service';
export { WebsocketManagerService } from './services/websocket-manager.service';
export { TimeframeManagerService } from './services/timeframe-manager.service';

// Enhanced services
export { mathUtils } from './services/math-utils.service';
export { CacheService } from './services/cache.service';
export { performanceMonitor } from './services/performance-monitor.service';
export { notificationService } from './services/notification.service';
export { jobScheduler } from './services/job-scheduler.service';
export { mlService } from './services/machine-learning.service';
export { chartingService } from './services/advanced-charting.service';
export { websocketAPIService } from './services/websocket-api.service';
export { advancedTradingEngine, defaultEngineConfig } from './services/advanced-trading-engine.service';

// Strategy implementations
export { MovingAverageStrategy } from './services/strategies/moving-average-strategy';
export { RSIStrategy } from './services/strategies/rsi-strategy';
export { BreakoutStrategy } from './services/strategies/breakout-strategy';
export { EnhancedMomentumStrategy } from './services/strategies/enhanced-momentum-strategy';
export { OptionsStrategy } from './services/strategies/options-strategy';

// Types
export * from './types';
export * from './types/portfolio.types';

// UI
export { runDashboard } from './ui/run-dashboard';
export { TerminalDashboard } from './ui/terminal-dashboard';

// Webhooks
export { startWebhook } from './webhooks/start-webhook';
export { handleOrderUpdate } from './webhooks/order-updates';

// Examples
export { authExample } from './examples/auth-example';
export { simpleTradingExample } from './examples/simple-trading-example';
export { automatedTradingExample } from './examples/automated-trading-example';
export { completeTradingIntegration } from './examples/complete-trading-integration';
export { liveDataIntegrationExample } from './examples/live-data-integration-example';
export { improvedInstrumentsExample } from './examples/improved-instruments-example';
export { simpleTokensManager } from './examples/simple-tokens-manager';
export { enhancedTradingExample } from './examples/enhanced-trading-example';

// Database setup
export { setupDatabase } from './database/setup';
export { mockData } from './database/mock-data'; 