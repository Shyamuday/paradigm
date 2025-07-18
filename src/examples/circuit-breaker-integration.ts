#!/usr/bin/env node

import { 
  circuitBreakerManager, 
  CircuitBreaker, 
  CircuitState,
  createApiCircuitBreaker,
  createDatabaseCircuitBreaker,
  createExternalServiceCircuitBreaker
} from '../utils/circuit-breaker';
import { 
  createZerodhaApiCircuitBreaker,
  createMarketDataApiCircuitBreaker,
  createPostgresCircuitBreaker,
  createRedisCircuitBreaker,
  createNotificationServiceCircuitBreaker
} from '../middleware/circuit-breaker';
import { logger } from '../logger/logger';

/**
 * Example demonstrating circuit breaker integration with external APIs
 */
class CircuitBreakerIntegrationExample {
  
  /**
   * Example 1: Basic circuit breaker usage
   */
  async demonstrateBasicUsage(): Promise<void> {
    logger.info('🚀 Demonstrating basic circuit breaker usage...');
    
    // Create a circuit breaker for a risky operation
    const circuit = circuitBreakerManager.getCircuit('demo_api', {
      failureThreshold: 3,
      recoveryTimeout: 10000, // 10 seconds for demo
      timeout: 2000
    });

    // Simulate API calls with failures
    for (let i = 0; i < 5; i++) {
      try {
        const result = await circuit.execute(
          async () => {
            // Simulate API call that fails
            if (Math.random() > 0.3) {
              throw new Error('API timeout');
            }
            return { data: `Success ${i + 1}` };
          },
          { requestId: `demo_${i + 1}` }
        );
        
        logger.info(`✅ API call succeeded:`, result);
      } catch (error) {
        logger.warn(`❌ API call failed:`, (error as Error).message);
      }

      // Wait a bit between calls
      await this.sleep(500);
    }

    // Show circuit state
    logger.info('Circuit state:', circuit.getState());
    logger.info('Circuit metrics:', circuit.getMetrics());
  }

  /**
   * Example 2: Zerodha API integration
   */
  async demonstrateZerodhaIntegration(): Promise<void> {
    logger.info('🚀 Demonstrating Zerodha API circuit breaker...');
    
    const zerodhaCircuit = createZerodhaApiCircuitBreaker();

    // Simulate Zerodha API calls
    const operations = [
      { name: 'Get Quotes', operation: () => this.simulateZerodhaQuoteCall() },
      { name: 'Place Order', operation: () => this.simulateZerodhaOrderCall() },
      { name: 'Get Portfolio', operation: () => this.simulateZerodhaPortfolioCall() }
    ];

    for (const op of operations) {
      try {
        const result = await zerodhaCircuit.execute(
          op.operation,
          { operation: op.name, userId: 'demo_user' }
        );
        
        logger.info(`✅ ${op.name} succeeded:`, result);
      } catch (error) {
        logger.warn(`❌ ${op.name} failed:`, (error as Error).message);
      }
    }
  }

  /**
   * Example 3: Database operations with circuit breaker
   */
  async demonstrateDatabaseIntegration(): Promise<void> {
    logger.info('🚀 Demonstrating database circuit breaker...');
    
    const dbCircuit = createPostgresCircuitBreaker();

    // Simulate database operations
    const dbOperations = [
      { name: 'Save Trade', operation: () => this.simulateDbSaveTrade() },
      { name: 'Get User', operation: () => this.simulateDbGetUser() },
      { name: 'Update Position', operation: () => this.simulateDbUpdatePosition() }
    ];

    for (const op of dbOperations) {
      try {
        const result = await dbCircuit.execute(
          op.operation,
          { operation: op.name, table: 'trades' }
        );
        
        logger.info(`✅ ${op.name} succeeded:`, result);
      } catch (error) {
        logger.warn(`❌ ${op.name} failed:`, (error as Error).message);
      }
    }
  }

  /**
   * Example 4: Market data service integration
   */
  async demonstrateMarketDataIntegration(): Promise<void> {
    logger.info('🚀 Demonstrating market data circuit breaker...');
    
    const marketDataCircuit = createMarketDataApiCircuitBreaker();

    // Simulate market data operations
    const symbols = ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS'];
    
    for (const symbol of symbols) {
      try {
        const result = await marketDataCircuit.execute(
          async () => this.simulateMarketDataCall(symbol),
          { symbol, operation: 'get_quote' }
        );
        
        logger.info(`✅ Market data for ${symbol}:`, result);
      } catch (error) {
        logger.warn(`❌ Market data for ${symbol} failed:`, (error as Error).message);
      }
    }
  }

  /**
   * Example 5: Notification service integration
   */
  async demonstrateNotificationIntegration(): Promise<void> {
    logger.info('🚀 Demonstrating notification service circuit breaker...');
    
    const notificationCircuit = createNotificationServiceCircuitBreaker();

    // Simulate notification operations
    const notifications = [
      { type: 'trade_executed', message: 'Order placed successfully' },
      { type: 'stop_loss_triggered', message: 'Stop loss triggered for RELIANCE' },
      { type: 'daily_summary', message: 'Daily P&L summary' }
    ];

    for (const notification of notifications) {
      try {
        const result = await notificationCircuit.execute(
          async () => this.simulateNotificationCall(notification),
          { type: notification.type, userId: 'demo_user' }
        );
        
        logger.info(`✅ Notification sent:`, result);
      } catch (error) {
        logger.warn(`❌ Notification failed:`, (error as Error).message);
      }
    }
  }

  /**
   * Example 6: Circuit breaker state transitions
   */
  async demonstrateStateTransitions(): Promise<void> {
    logger.info('🚀 Demonstrating circuit breaker state transitions...');
    
    const circuit = circuitBreakerManager.getCircuit('state_demo', {
      failureThreshold: 2,
      recoveryTimeout: 5000, // 5 seconds for demo
      timeout: 1000
    });

    // Listen for state changes
    circuit.on('stateChange', (from, to, reason) => {
      logger.info(`🔄 Circuit state changed: ${from} → ${to} (${reason})`);
    });

    circuit.on('open', (metrics) => {
      logger.warn(`🚨 Circuit opened! Metrics:`, metrics);
    });

    circuit.on('close', (metrics) => {
      logger.info(`✅ Circuit closed! Metrics:`, metrics);
    });

    // Force failures to open circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuit.execute(
          async () => {
            throw new Error('Simulated failure');
          },
          { attempt: i + 1 }
        );
      } catch (error) {
        logger.warn(`Failure ${i + 1}:`, (error as Error).message);
      }
    }

    // Wait for recovery timeout
    logger.info('Waiting for recovery timeout...');
    await this.sleep(6000);

    // Try again to test half-open state
    try {
      const result = await circuit.execute(
        async () => ({ success: true }),
        { test: 'recovery' }
      );
      logger.info('Recovery test succeeded:', result);
    } catch (error) {
      logger.warn('Recovery test failed:', (error as Error).message);
    }
  }

  /**
   * Example 7: Circuit breaker with fallback strategies
   */
  async demonstrateFallbackStrategies(): Promise<void> {
    logger.info('🚀 Demonstrating circuit breaker with fallback strategies...');
    
    const circuit = circuitBreakerManager.getCircuit('fallback_demo', {
      failureThreshold: 2,
      recoveryTimeout: 3000,
      timeout: 1000
    });

    // Primary operation
    const primaryOperation = async () => {
      if (Math.random() > 0.5) {
        throw new Error('Primary service unavailable');
      }
      return { source: 'primary', data: 'fresh data' };
    };

    // Fallback operation
    const fallbackOperation = async () => {
      return { source: 'fallback', data: 'cached data' };
    };

    // Execute with fallback
    for (let i = 0; i < 3; i++) {
      try {
        const result = await circuit.execute(primaryOperation, { attempt: i + 1 });
        logger.info(`✅ Primary operation succeeded:`, result);
      } catch (error) {
        logger.warn(`❌ Primary operation failed, using fallback:`, (error as Error).message);
        
        try {
          const fallbackResult = await fallbackOperation();
          logger.info(`✅ Fallback operation succeeded:`, fallbackResult);
        } catch (fallbackError) {
          logger.error(`❌ Fallback also failed:`, (fallbackError as Error).message);
        }
      }
    }
  }

  /**
   * Example 8: Circuit breaker monitoring and statistics
   */
  async demonstrateMonitoring(): Promise<void> {
    logger.info('🚀 Demonstrating circuit breaker monitoring...');
    
    // Create multiple circuits
    const circuits = [
      createZerodhaApiCircuitBreaker(),
      createMarketDataApiCircuitBreaker(),
      createPostgresCircuitBreaker(),
      createRedisCircuitBreaker(),
      createNotificationServiceCircuitBreaker()
    ];

    // Generate some activity
    for (const circuit of circuits) {
      for (let i = 0; i < 3; i++) {
        try {
          await circuit.execute(
            async () => {
              if (Math.random() > 0.7) {
                throw new Error('Simulated failure');
              }
              return { success: true };
            },
            { circuit: circuit.getConfig().name, attempt: i + 1 }
          );
        } catch (error) {
          // Expected failures
        }
      }
    }

    // Get monitoring data
    const healthStatus = circuitBreakerManager.getHealthStatus();
    const statistics = circuitBreakerManager.getStatistics();

    logger.info('📊 Circuit Breaker Health Status:', healthStatus);
    logger.info('📈 Circuit Breaker Statistics:', statistics);

    // Show individual circuit details
    for (const [name, stats] of Object.entries(statistics)) {
      const health = healthStatus[name];
      logger.info(`Circuit ${name}:`, {
        state: health.state,
        healthy: health.healthy,
        failureRate: health.failureRate,
        totalRequests: stats.totalRequests,
        successfulRequests: stats.successfulRequests,
        failedRequests: stats.failedRequests
      });
    }
  }

  /**
   * Simulate Zerodha API calls
   */
  private async simulateZerodhaQuoteCall(): Promise<any> {
    await this.sleep(100);
    if (Math.random() > 0.8) {
      throw new Error('Zerodha API timeout');
    }
    return { symbol: 'NIFTY', ltp: 19500, change: 150 };
  }

  private async simulateZerodhaOrderCall(): Promise<any> {
    await this.sleep(200);
    if (Math.random() > 0.9) {
      throw new Error('Order placement failed');
    }
    return { orderId: 'ORD123', status: 'placed' };
  }

  private async simulateZerodhaPortfolioCall(): Promise<any> {
    await this.sleep(150);
    if (Math.random() > 0.85) {
      throw new Error('Portfolio fetch failed');
    }
    return { totalValue: 100000, pnl: 5000 };
  }

  /**
   * Simulate database operations
   */
  private async simulateDbSaveTrade(): Promise<any> {
    await this.sleep(50);
    if (Math.random() > 0.95) {
      throw new Error('Database connection failed');
    }
    return { tradeId: 'TRD456', saved: true };
  }

  private async simulateDbGetUser(): Promise<any> {
    await this.sleep(30);
    if (Math.random() > 0.98) {
      throw new Error('Database query timeout');
    }
    return { userId: 'user123', name: 'Demo User' };
  }

  private async simulateDbUpdatePosition(): Promise<any> {
    await this.sleep(40);
    if (Math.random() > 0.97) {
      throw new Error('Database update failed');
    }
    return { positionId: 'POS789', updated: true };
  }

  /**
   * Simulate market data calls
   */
  private async simulateMarketDataCall(symbol: string): Promise<any> {
    await this.sleep(80);
    if (Math.random() > 0.75) {
      throw new Error('Market data service unavailable');
    }
    return { symbol, price: 100 + Math.random() * 1000, volume: 1000000 };
  }

  /**
   * Simulate notification calls
   */
  private async simulateNotificationCall(notification: any): Promise<any> {
    await this.sleep(60);
    if (Math.random() > 0.9) {
      throw new Error('Notification service down');
    }
    return { notificationId: 'NOT123', sent: true, type: notification.type };
  }

  /**
   * Utility function for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run all demonstrations
   */
  async runAllDemonstrations(): Promise<void> {
    logger.info('🎯 Starting Circuit Breaker Integration Demonstrations\n');
    
    try {
      await this.demonstrateBasicUsage();
      await this.demonstrateZerodhaIntegration();
      await this.demonstrateDatabaseIntegration();
      await this.demonstrateMarketDataIntegration();
      await this.demonstrateNotificationIntegration();
      await this.demonstrateStateTransitions();
      await this.demonstrateFallbackStrategies();
      await this.demonstrateMonitoring();
      
      logger.info('\n🎉 All circuit breaker demonstrations completed successfully!');
    } catch (error) {
      logger.error('❌ Demonstration failed:', error);
    }
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  const example = new CircuitBreakerIntegrationExample();
  example.runAllDemonstrations().catch(error => {
    logger.error('❌ Example runner failed:', error);
    process.exit(1);
  });
}

export { CircuitBreakerIntegrationExample }; 