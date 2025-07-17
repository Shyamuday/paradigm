// Core services
export * from './services/auth-manager.service';
export * from './services/market-data.service';
export * from './services/order-manager.service';
export * from './services/portfolio.service';
export * from './services/risk.service';
export * from './services/strategy.service';
export * from './services/strategy-engine.service';
export * from './services/strategy-factory.service';
export * from './services/instruments-manager.service';
export * from './services/automated-trading.service';
export * from './services/enhanced-backtest.service';
export * from './services/live-data-integration.service';
export * from './services/options-technical-analysis.ts';
export * from './services/options-technical-indicators.service';
export * from './services/timeframe-manager.service';
export * from './services/transaction-cost.service';
export * from './services/user.service';
export * from './services/websocket-manager.service';
export * from './services/advanced-order.service';

// New services with enhanced packages
export * from './services/math-utils.service';
export * from './services/scheduler.service';
export * from './services/performance-monitor.service';

// Configuration and utilities
export * from './config/config-manager';
export * from './config/config.schema';
export * from './logger/logger';
export * from './database/database';
export * from './database/setup';

// Types and interfaces
export * from './types';
export * from './types/portfolio.types';

// Strategy implementations
export * from './services/strategies/strategy.interface';
export * from './services/strategies/moving-average-strategy';
export * from './services/strategies/rsi-strategy';
export * from './services/strategies/breakout-strategy';
export * from './services/strategies/enhanced-momentum-strategy';
export * from './services/strategies/options-strategy';

// Authentication
export * from './auth/zerodha-auth';

// Webhooks
export * from './webhooks/order-updates';
export * from './webhooks/start-webhook';

// UI components
export * from './ui/terminal-dashboard';
export * from './ui/run-dashboard';

// Schemas
export * from './schemas/strategy.schema';

// Middleware
export * from './middleware/rate-limiter';

// Cache service (commented out due to Redis dependency issues)
// export * from './services/cache.service';

// Main application class
export class TradingBot {
  private isInitialized = false;

  constructor() {
    // Initialize core services
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize database
      await import('./database/setup').then(module => module.initializeDatabase());
      
      // Initialize logger
      await import('./logger/logger').then(module => {
        // Logger is auto-initialized
      });

      // Start performance monitoring
      await import('./services/performance-monitor.service').then(module => {
        module.performanceMonitor.start();
      });

      // Start scheduler
      await import('./services/scheduler.service').then(module => {
        module.scheduler.start();
      });

      this.isInitialized = true;
      console.log('Trading Bot initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Trading Bot:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    try {
      // Stop performance monitoring
      await import('./services/performance-monitor.service').then(module => {
        module.performanceMonitor.stop();
      });

      // Stop scheduler
      await import('./services/scheduler.service').then(module => {
        module.scheduler.stop();
      });

      // Close database connections
      await import('./database/database').then(module => {
        // Close database connections if needed
      });

      this.isInitialized = false;
      console.log('Trading Bot shutdown successfully');
    } catch (error) {
      console.error('Error during shutdown:', error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

// Export default instance
export const tradingBot = new TradingBot();

// Export version
export const VERSION = '2.0.0';

// Export main function for CLI usage
export async function main(): Promise<void> {
  try {
    await tradingBot.initialize();
    console.log(`Trading Bot v${VERSION} started successfully`);
  } catch (error) {
    console.error('Failed to start Trading Bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  await tradingBot.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  await tradingBot.shutdown();
  process.exit(0);
});

// Auto-start if this file is run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
} 