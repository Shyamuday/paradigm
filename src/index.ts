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
  metadata
}; 