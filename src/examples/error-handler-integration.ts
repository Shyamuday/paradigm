#!/usr/bin/env node

import { errorHandler, ErrorCategory, ErrorSeverity, createAuthenticationError, createNetworkError, createValidationError } from '../utils/error-handler';
import { logger } from '../logger/logger';

/**
 * Example demonstrating centralized error handling integration
 */
class ErrorHandlerIntegrationExample {

  /**
   * Example 1: Basic error handling with retry logic
   */
  async demonstrateRetryLogic(): Promise<void> {
    logger.info('🚀 Demonstrating retry logic...');

    try {
      // Simulate an operation that might fail
      const result = await errorHandler.withRetry(
        async () => {
          // Simulate network failure
          if (Math.random() > 0.7) {
            throw new Error('Network timeout');
          }
          return 'Operation successful';
        },
        {
          operation: 'demo_network_operation',
          requestId: 'demo_123'
        }
      );

      logger.info('✅ Retry operation succeeded:', result);
    } catch (error: unknown) {
      logger.error('❌ Retry operation failed:', error);
    }
  }

  /**
   * Example 2: Error categorization and handling
   */
  async demonstrateErrorCategorization(): Promise<void> {
    logger.info('🚀 Demonstrating error categorization...');

    const errors = [
      new Error('Authentication token expired'),
      new Error('Rate limit exceeded'),
      new Error('Database connection failed'),
      new Error('Invalid order parameters'),
      new Error('Network timeout'),
      new Error('Unknown system error')
    ];

    for (const error of errors) {
      try {
        // Handle each error through centralized handler
        errorHandler.handleError(error, {
          operation: 'demo_error_categorization',
          requestId: 'demo_456'
        });
      } catch (handledError: unknown) {
        logger.info('Error handled:', {
          original: error.message,
          categorized: (handledError as any)?.message,
          category: (handledError as any)?.category,
          severity: (handledError as any)?.severity,
          retryable: (handledError as any)?.retryable
        });
      }
    }
  }

  /**
   * Example 3: Custom error creation
   */
  async demonstrateCustomErrors(): Promise<void> {
    logger.info('🚀 Demonstrating custom error creation...');

    try {
      // Create specific error types
      throw createAuthenticationError('Invalid API credentials', {
        userId: 'user123',
        endpoint: '/api/trading/orders'
      });
    } catch (error) {
      errorHandler.handleError(error as Error, {
        operation: 'demo_custom_errors',
        requestId: 'demo_789'
      });
    }

    try {
      throw createNetworkError('Connection to Zerodha API failed', {
        endpoint: 'https://api.kite.trade',
        retryCount: 3
      });
    } catch (error) {
      errorHandler.handleError(error as Error, {
        operation: 'demo_custom_errors',
        requestId: 'demo_789'
      });
    }

    try {
      throw createValidationError('Invalid order quantity', {
        field: 'quantity',
        value: -100,
        minValue: 1
      });
    } catch (error) {
      errorHandler.handleError(error as Error, {
        operation: 'demo_custom_errors',
        requestId: 'demo_789'
      });
    }
  }

  /**
   * Example 4: Wrapping async functions
   */
  async demonstrateAsyncWrapping(): Promise<void> {
    logger.info('🚀 Demonstrating async function wrapping...');

    // Original function that might throw errors
    const riskyOperation = async (input: number): Promise<string> => {
      if (input < 0) {
        throw new Error('Invalid input: negative number');
      }
      if (input > 100) {
        throw new Error('Input too large');
      }
      return `Processed: ${input}`;
    };

    // Wrap with error handling
    const safeOperation = errorHandler.wrapAsync(riskyOperation, {
      operation: 'demo_async_wrapping',
      requestId: 'demo_101'
    });

    // Test the wrapped function
    const testInputs = [50, -10, 150];

    for (const input of testInputs) {
      try {
        const result = await safeOperation(input);
        logger.info(`✅ Safe operation result for ${input}:`, result);
      } catch (error) {
        logger.info(`❌ Safe operation failed for ${input}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  /**
   * Example 5: Error statistics and monitoring
   */
  async demonstrateErrorStatistics(): Promise<void> {
    logger.info('🚀 Demonstrating error statistics...');

    // Generate some errors first
    for (let i = 0; i < 5; i++) {
      try {
        throw new Error(`Test error ${i + 1}`);
      } catch (error) {
        errorHandler.handleError(error as Error, {
          operation: 'demo_statistics',
          requestId: `demo_stats_${i}`
        });
      }
    }

    // Get error statistics
    const stats = errorHandler.getErrorStats();
    logger.info('📊 Error Statistics:', JSON.stringify(stats, null, 2));

    // Clear statistics
    errorHandler.clearErrorStats();
    logger.info('🧹 Error statistics cleared');
  }

  /**
   * Example 6: Event handling
   */
  async demonstrateEventHandling(): Promise<void> {
    logger.info('🚀 Demonstrating event handling...');

    // Listen for error events
    errorHandler.on('error', (error: any) => {
      logger.info('📡 Error event received:', {
        message: error.message,
        category: error.category,
        severity: error.severity
      });
    });

    // Listen for critical error events
    errorHandler.on('criticalError', (error: any) => {
      logger.error('🚨 CRITICAL ERROR EVENT:', {
        message: error.message,
        category: error.category,
        context: error.context
      });
    });

    // Trigger some errors
    try {
      throw new Error('This is a critical system failure');
    } catch (error) {
      errorHandler.handleError(error as Error, {
        operation: 'demo_events',
        requestId: 'demo_events_123'
      });
    }
  }

  /**
   * Example 7: Integration with trading operations
   */
  async demonstrateTradingIntegration(): Promise<void> {
    logger.info('🚀 Demonstrating trading operation integration...');

    // Simulate trading operations with error handling
    const tradingOperations = [
      {
        name: 'Place Order',
        operation: async () => {
          // Simulate order placement
          if (Math.random() > 0.8) {
            throw new Error('Insufficient funds for order');
          }
          return { orderId: 'ORD123', status: 'placed' };
        }
      },
      {
        name: 'Get Market Data',
        operation: async () => {
          // Simulate market data fetch
          if (Math.random() > 0.9) {
            throw new Error('Market data service unavailable');
          }
          return { price: 150.50, volume: 1000000 };
        }
      },
      {
        name: 'Update Position',
        operation: async () => {
          // Simulate position update
          if (Math.random() > 0.7) {
            throw new Error('Position not found');
          }
          return { positionId: 'POS456', pnl: 1250.75 };
        }
      }
    ];

    for (const op of tradingOperations) {
      try {
        const result = await errorHandler.withRetry(
          op.operation as () => Promise<any>,
          {
            operation: op.name,
            requestId: `trading_${Date.now()}`
          },
          {
            maxRetries: 2,
            baseDelay: 500
          }
        );

        logger.info(`✅ ${op.name} succeeded:`, result);
      } catch (error: unknown) {
        logger.error(`❌ ${op.name} failed:`, error);
      }
    }
  }

  /**
   * Run all demonstrations
   */
  async runAllDemonstrations(): Promise<void> {
    logger.info('🎯 Starting Error Handler Integration Demonstrations\n');

    try {
      await this.demonstrateRetryLogic();
      await this.demonstrateErrorCategorization();
      await this.demonstrateCustomErrors();
      await this.demonstrateAsyncWrapping();
      await this.demonstrateErrorStatistics();
      await this.demonstrateEventHandling();
      await this.demonstrateTradingIntegration();

      logger.info('\n🎉 All demonstrations completed successfully!');
    } catch (error) {
      logger.error('❌ Demonstration failed:', error);
    }
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  const example = new ErrorHandlerIntegrationExample();
  example.runAllDemonstrations().catch(error => {
    logger.error('❌ Example runner failed:', error);
    process.exit(1);
  });
}

export { ErrorHandlerIntegrationExample }; 