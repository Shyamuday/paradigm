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

// Modularized Exports
export * from './core.exports';
export * from './security.exports';
export * from './services.exports';
export * from './data.exports';
export * from './utilities.exports';
export * from './monitoring.exports';
export * from './websocket.exports';
export * from './middleware.exports';
export * from './ui.exports';
export * from './webhooks.exports';
export * from './examples.exports';
export * from './schemas.exports';
export * from './types.exports';

// Import all referenced variables for system initialization
import * as services from './services.exports';
import * as middleware from './middleware.exports';
import * as strategies from './services/strategies/strategy.interface';
import * as examples from './examples.exports';
import { DatabaseManager as DatabaseService } from './database/database';
import { MultiLevelCacheService } from './services/multi-level-cache.service';
import { circuitBreakerManager } from './middleware/circuit-breaker';
import { performanceMonitor } from './services/performance-monitor.service';
import { logger } from './logger/logger';

// Import Personal Trading System
import { PersonalTradingSystem, startPersonalTradingWithTelegram } from './examples/personal-trading-setup';
import { TelegramNotificationService } from './services/telegram-notification.service';

// ============================================================================
// SYSTEM INITIALIZATION HELPERS
// ============================================================================

/**
 * Initialize the complete Paradigm Trading System
 * Sets up all core services and returns a configured system instance.
 * @param {any} [config] - Optional configuration object.
 * @returns {Promise<object>} The initialized system instance.
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
      const cacheService = new MultiLevelCacheService({
        l1: { enabled: true, level: 'L1', ttl: 300, maxSize: 1000, strategy: 'LRU' },
        l2: { enabled: true, level: 'L2', ttl: 3600, strategy: 'LRU' },
        l3: { enabled: true, level: 'L3', ttl: 86400, strategy: 'LRU' },
      });
      // No need to call initializeCache (done in constructor)

      // Initialize circuit breakers (no explicit initialize method)
      // circuitBreakerManager.initialize();

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
      // If you want to shutdown the cache, call dispose on the instance
      // await cacheService.dispose();

      logger.info('Paradigm Trading System shutdown complete');
    }
  };

  return system;
}

/**
 * Quick start function for common trading scenarios.
 * Initializes and starts the Paradigm Trading System.
 * @returns {Promise<object>} The ready system instance.
 */
export async function quickStart() {
  const system = await initializeParadigmSystem();
  await system.init();

  logger.info('Paradigm Trading System ready for trading operations');
  return system;
}

// ============================================================================
// PERSONAL TRADING SYSTEM - ONE COMMAND AUTO-START
// ============================================================================

/**
 * Start Personal Trading System with Telegram Notifications
 * This is the main entry point for automated personal trading.
 * Runs everything automatically with one command.
 * 
 * Features:
 * - Automated trading with 3 strategies
 * - Real-time Telegram notifications
 * - Risk management with stop losses
 * - Performance tracking
 * - 24/7 monitoring
 * 
 * @returns {Promise<void>}
 */
export async function startPersonalTrading() {
  try {
    logger.info('🚀 Starting Personal Trading System with Telegram Notifications...');

    // Start the complete personal trading system
    await startPersonalTradingWithTelegram();

    logger.info('✅ Personal Trading System started successfully');
    logger.info('📱 Check your Telegram for notifications');
    logger.info('🔄 System will run automatically until stopped');

  } catch (error) {
    logger.error('❌ Failed to start Personal Trading System:', error);
    throw error;
  }
}

/**
 * Create and configure Personal Trading System instance
 * Allows custom configuration before starting
 * 
 * @param {object} config - Custom configuration
 * @returns {Promise<PersonalTradingSystem>} Configured trading system
 */
export async function createPersonalTradingSystem(config?: any) {
  const defaultConfig = {
    apiKey: process.env.KITE_API_KEY || '',
    apiSecret: process.env.KITE_API_SECRET || '',
    accessToken: process.env.KITE_ACCESS_TOKEN || '',
    instruments: ['NIFTY', 'BANKNIFTY'],
    capital: parseInt(process.env.TRADING_CAPITAL || '100000'),
    maxRiskPerTrade: parseFloat(process.env.MAX_RISK_PER_TRADE || '0.02'),
    maxDailyLoss: parseInt(process.env.MAX_DAILY_LOSS || '5000'),
    tradingHours: {
      start: '09:15',
      end: '15:30'
    },
    strategies: {
      moving_average: {
        enabled: true,
        allocation: 0.3,
        parameters: {
          shortPeriod: 10,
          longPeriod: 20,
          volumeThreshold: 1000
        }
      },
      rsi: {
        enabled: true,
        allocation: 0.2,
        parameters: {
          period: 14,
          overbought: 70,
          oversold: 30
        }
      }
    },
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
      enabled: true,
      notifications: {
        tradeSignals: true,
        tradeExecutions: true,
        positionUpdates: true,
        performanceUpdates: true,
        systemAlerts: true,
        dailyReports: true,
        errorAlerts: true
      },
      updateInterval: 30
    }
  };

  const finalConfig = { ...defaultConfig, ...config };
  const tradingSystem = new PersonalTradingSystem(finalConfig);

  return tradingSystem;
}

/**
 * Test Telegram Notifications
 * Sends test messages to verify Telegram setup
 * 
 * @returns {Promise<void>}
 */
export async function testTelegramNotifications() {
  try {
    logger.info('🧪 Testing Telegram Notifications...');

    const telegramConfig = {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
      enabled: true,
      notifications: {
        tradeSignals: true,
        tradeExecutions: true,
        positionUpdates: true,
        performanceUpdates: true,
        systemAlerts: true,
        dailyReports: true,
        errorAlerts: true
      },
      updateInterval: 30
    };

    const telegramService = new TelegramNotificationService(telegramConfig);

    // Test connection
    const isConnected = await telegramService.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to Telegram bot');
    }

    // Send test messages
    await telegramService.sendCustomMessage(`
🧪 **TELEGRAM TEST** 🧪

✅ Connection successful!
🤖 Bot is working properly
📱 Ready for trading notifications

⏰ Test completed at ${new Date().toLocaleString()}
    `.trim());

    logger.info('✅ Telegram notifications test completed successfully');

  } catch (error) {
    logger.error('❌ Telegram test failed:', error);
    throw error;
  }
}

/**
 * Get System Status
 * Returns current status of all system components
 * 
 * @returns {Promise<object>} System status
 */
export async function getSystemStatus() {
  try {
    const status = {
      system: {
        version: VERSION,
        name: SYSTEM_NAME,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      },
      database: {
        connected: DatabaseService.getInstance().isConnectionActive(),
        status: 'ok'
      },
      cache: {
        status: 'initialized'
      },
      performance: {
        active: performanceMonitor.getStatus().isMonitoring,
        metrics: performanceMonitor.getAllMetrics()
      },
      telegram: {
        enabled: !!process.env.TELEGRAM_BOT_TOKEN,
        configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
      },
      trading: {
        apiConfigured: !!(process.env.KITE_API_KEY && process.env.KITE_API_SECRET),
        accessToken: !!process.env.KITE_ACCESS_TOKEN
      }
    };

    return status;
  } catch (error) {
    logger.error('Failed to get system status:', error);
    throw error;
  }
}

// ============================================================================
// VERSION & METADATA
// ============================================================================

/**
 * Current version of the Paradigm Trading System.
 * @type {string}
 */
export const VERSION = '2.0.0';

/**
 * System name.
 * @type {string}
 */
export const SYSTEM_NAME = 'Paradigm Trading System';

/**
 * System description.
 * @type {string}
 */
export const DESCRIPTION = 'Advanced algorithmic trading platform with comprehensive features';

/**
 * System metadata including version, name, description, features, and architecture.
 * @type {object}
 */
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
    'Portfolio management',
    'Telegram notifications',
    'Personal trading system'
  ],
  architecture: {
    layers: [
      'Core Infrastructure',
      'Security & Error Handling',
      'Trading Services',
      'Strategy Engine',
      'Data Management',
      'Monitoring & UI',
      'Personal Trading'
    ],
    patterns: [
      'Circuit Breaker',
      'Multi-Level Caching',
      'Strategy Pattern',
      'Observer Pattern',
      'Factory Pattern',
      'Middleware Pattern',
      'Telegram Integration'
    ]
  }
};

/**
 * Default export for convenience, includes version, name, description, services, middleware, strategies, examples, initialization helpers, and metadata.
 */
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
  startPersonalTrading,
  createPersonalTradingSystem,
  testTelegramNotifications,
  getSystemStatus,
  metadata
};

// ============================================================================
// AUTO-START WHEN EXECUTED DIRECTLY
// ============================================================================

// If this file is executed directly, start the personal trading system
if (require.main === module) {
  logger.info('🚀 Paradigm Trading System - Auto-Starting Personal Trading...');

  // Check if Telegram test is requested
  if (process.argv.includes('--test-telegram')) {
    testTelegramNotifications()
      .then(() => {
        logger.info('✅ Telegram test completed');
        process.exit(0);
      })
      .catch((error) => {
        logger.error('❌ Telegram test failed:', error);
        process.exit(1);
      });
  } else {
    // Start personal trading system
    startPersonalTrading()
      .then(() => {
        logger.info('✅ Personal trading system started successfully');
        // Keep the process running
        process.on('SIGINT', () => {
          logger.info('🛑 Received shutdown signal. Stopping...');
          process.exit(0);
        });
      })
      .catch((error) => {
        logger.error('❌ Failed to start personal trading system:', error);
        process.exit(1);
      });
  }
} 