# Centralized Error Handling System

## Overview

The centralized error handling system provides a comprehensive solution for managing errors across the trading platform. It includes error categorization, retry logic, monitoring, and proper error responses.

## Features

- **Error Categorization**: Automatically categorizes errors by type and severity
- **Retry Logic**: Built-in retry mechanism with exponential backoff
- **Error Monitoring**: Track error statistics and patterns
- **Event System**: Emit events for error handling and monitoring
- **Express Integration**: Middleware for web applications
- **Custom Error Types**: Specific error types for different scenarios

## Quick Start

### Basic Usage

```typescript
import { errorHandler, createAuthenticationError } from '../utils/error-handler';

// Handle errors automatically
try {
  // Your risky operation
  await someRiskyOperation();
} catch (error) {
  errorHandler.handleError(error, {
    operation: 'user_login',
    userId: 'user123',
    requestId: 'req_456'
  });
}

// Use retry logic
const result = await errorHandler.withRetry(
  async () => {
    return await fetchDataFromAPI();
  },
  {
    operation: 'fetch_market_data',
    requestId: 'req_789'
  }
);

// Create specific error types
throw createAuthenticationError('Invalid credentials', {
  userId: 'user123',
  endpoint: '/api/login'
});
```

### Express Integration

```typescript
import express from 'express';
import { errorMiddleware } from '../middleware/error-handler';

const app = express();

// Add middleware
app.use(errorMiddleware.requestContextMiddleware);
app.use(errorMiddleware.errorMonitoringMiddleware);

// Use async error handler for routes
app.get('/api/data', errorMiddleware.asyncErrorHandler(async (req, res) => {
  const data = await fetchData();
  res.json(data);
}));

// Add error handler last
app.use(errorMiddleware.expressErrorHandler);

// Health check endpoints
app.get('/health', errorMiddleware.healthCheckHandler);
app.get('/error-stats', errorMiddleware.errorStatsHandler);
```

## Error Categories

The system automatically categorizes errors based on their type and message:

| Category | Description | Severity | Retryable |
|----------|-------------|----------|-----------|
| `AUTHENTICATION` | Auth failures, token issues | HIGH | Yes |
| `API_RATE_LIMIT` | Rate limit exceeded | MEDIUM | Yes |
| `NETWORK` | Network timeouts, connection issues | MEDIUM | Yes |
| `DATABASE` | Database connection, query errors | HIGH | Yes |
| `VALIDATION` | Input validation errors | LOW | No |
| `TRADING` | Trading operation errors | HIGH | No |
| `MARKET_DATA` | Market data service errors | MEDIUM | Yes |
| `BUSINESS_LOGIC` | Business rule violations | MEDIUM | No |
| `SYSTEM` | System-level errors | CRITICAL | No |
| `UNKNOWN` | Uncategorized errors | MEDIUM | No |

## Error Severity Levels

- **LOW**: Non-critical errors, validation issues
- **MEDIUM**: Recoverable errors, temporary issues
- **HIGH**: Important errors, authentication issues
- **CRITICAL**: System failures, requires immediate attention

## Custom Error Types

### Creating Custom Errors

```typescript
import { 
  createAuthenticationError,
  createNetworkError,
  createValidationError,
  createTradingError,
  createDatabaseError,
  createRateLimitError
} from '../utils/error-handler';

// Authentication errors
throw createAuthenticationError('Token expired', {
  userId: 'user123',
  tokenType: 'access'
});

// Network errors
throw createNetworkError('API timeout', {
  endpoint: 'https://api.kite.trade',
  timeout: 5000
});

// Validation errors
throw createValidationError('Invalid order quantity', {
  field: 'quantity',
  value: -100,
  minValue: 1
});

// Trading errors
throw createTradingError('Insufficient funds', {
  orderId: 'ORD123',
  required: 10000,
  available: 5000
});
```

### Custom Error Class

```typescript
import { TradingError, ErrorCategory, ErrorSeverity } from '../utils/error-handler';

export class CustomTradingError extends TradingError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(
      message,
      ErrorCategory.TRADING,
      ErrorSeverity.HIGH,
      'CUSTOM_TRADING_ERROR',
      false,
      context
    );
    this.name = 'CustomTradingError';
  }
}
```

## Retry Logic

### Basic Retry

```typescript
const result = await errorHandler.withRetry(
  async () => {
    return await apiCall();
  },
  {
    operation: 'api_call',
    requestId: 'req_123'
  }
);
```

### Custom Retry Configuration

```typescript
const result = await errorHandler.withRetry(
  async () => {
    return await apiCall();
  },
  {
    operation: 'api_call',
    requestId: 'req_123'
  },
  {
    maxRetries: 5,
    baseDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 2
  }
);
```

### Retry Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `maxRetries` | 3 | Maximum number of retry attempts |
| `baseDelay` | 1000 | Base delay in milliseconds |
| `maxDelay` | 30000 | Maximum delay in milliseconds |
| `backoffMultiplier` | 2 | Exponential backoff multiplier |

## Error Monitoring

### Error Statistics

```typescript
// Get error statistics
const stats = errorHandler.getErrorStats();
console.log('Error stats:', stats);

// Clear statistics
errorHandler.clearErrorStats();
```

### Event Handling

```typescript
// Listen for all errors
errorHandler.on('error', (error) => {
  console.log('Error occurred:', error.message);
  // Send to monitoring service
  monitoringService.trackError(error);
});

// Listen for critical errors
errorHandler.on('criticalError', (error) => {
  console.log('Critical error:', error.message);
  // Send alert
  alertService.sendAlert(error);
});
```

### Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600,
  "memory": {
    "rss": 52428800,
    "heapTotal": 20971520,
    "heapUsed": 10485760
  },
  "errorStats": {
    "total": 15,
    "byCategory": {
      "NETWORK": {
        "NETWORK_123456": 5
      },
      "AUTHENTICATION": {
        "AUTH_789012": 3
      }
    }
  }
}
```

## Express Middleware

### Request Context Middleware

Adds request context and generates unique request IDs:

```typescript
app.use(errorMiddleware.requestContextMiddleware);
```

### Error Monitoring Middleware

Monitors request performance and logs slow requests:

```typescript
app.use(errorMiddleware.errorMonitoringMiddleware);
```

### Async Error Handler

Wraps async route handlers with error handling:

```typescript
app.get('/api/data', errorMiddleware.asyncErrorHandler(async (req, res) => {
  const data = await fetchData();
  res.json(data);
}));
```

### Error Response Format

```json
{
  "error": {
    "message": "Invalid input parameters",
    "code": "VALIDATION_123456",
    "category": "VALIDATION",
    "severity": "LOW",
    "requestId": "req_123456",
    "timestamp": "2024-01-15T10:30:00Z",
    "retryable": false
  },
  "details": {
    "stack": "Error stack trace...",
    "context": {
      "field": "email",
      "value": "invalid-email"
    }
  }
}
```

## Integration Examples

### With Trading Services

```typescript
import { errorHandler, createTradingError } from '../utils/error-handler';

export class OrderService {
  async placeOrder(orderData: any) {
    return await errorHandler.withRetry(
      async () => {
        // Validate order
        if (orderData.quantity <= 0) {
          throw createTradingError('Invalid order quantity', {
            orderId: orderData.orderId,
            quantity: orderData.quantity
          });
        }

        // Place order
        const result = await this.brokerAPI.placeOrder(orderData);
        return result;
      },
      {
        operation: 'place_order',
        userId: orderData.userId,
        requestId: orderData.requestId
      }
    );
  }
}
```

### With Database Operations

```typescript
import { errorHandler, createDatabaseError } from '../utils/error-handler';

export class UserService {
  async getUserById(userId: string) {
    return await errorHandler.withRetry(
      async () => {
        const user = await prisma.user.findUnique({
          where: { id: userId }
        });
        
        if (!user) {
          throw createDatabaseError('User not found', {
            userId,
            table: 'users'
          });
        }
        
        return user;
      },
      {
        operation: 'get_user',
        userId,
        requestId: `user_${userId}`
      }
    );
  }
}
```

### With External APIs

```typescript
import { errorHandler, createNetworkError } from '../utils/error-handler';

export class MarketDataService {
  async getQuote(symbol: string) {
    return await errorHandler.withRetry(
      async () => {
        const response = await axios.get(`/api/quotes/${symbol}`);
        return response.data;
      },
      {
        operation: 'get_quote',
        symbol,
        requestId: `quote_${symbol}`
      },
      {
        maxRetries: 3,
        baseDelay: 1000
      }
    );
  }
}
```

## Testing

### Run Tests

```bash
# Run error handler tests
npm run error:test

# Run demo
npm run error:demo
```

### Test Examples

```typescript
import { errorHandler, TradingError } from '../utils/error-handler';

describe('Error Handler', () => {
  it('should handle errors correctly', () => {
    const error = new Error('Test error');
    errorHandler.handleError(error, { operation: 'test' });
    
    const stats = errorHandler.getErrorStats();
    expect(Object.keys(stats).length).toBeGreaterThan(0);
  });

  it('should retry failed operations', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      if (attempts < 3) throw new Error('Network error');
      return 'success';
    };

    const result = await errorHandler.withRetry(operation);
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });
});
```

## Best Practices

### 1. Always Provide Context

```typescript
// Good
errorHandler.handleError(error, {
  operation: 'place_order',
  userId: 'user123',
  orderId: 'ORD456',
  requestId: 'req_789'
});

// Bad
errorHandler.handleError(error);
```

### 2. Use Specific Error Types

```typescript
// Good
throw createValidationError('Invalid email', { field: 'email' });

// Bad
throw new Error('Invalid email');
```

### 3. Configure Retry Appropriately

```typescript
// For network operations
await errorHandler.withRetry(apiCall, context, {
  maxRetries: 3,
  baseDelay: 1000
});

// For database operations
await errorHandler.withRetry(dbQuery, context, {
  maxRetries: 2,
  baseDelay: 500
});
```

### 4. Monitor Error Patterns

```typescript
// Set up monitoring
errorHandler.on('error', (error) => {
  if (error.category === 'AUTHENTICATION') {
    // Alert on auth failures
    alertService.sendAuthAlert(error);
  }
  
  if (error.severity === 'CRITICAL') {
    // Immediate action for critical errors
    emergencyService.handleCriticalError(error);
  }
});
```

### 5. Use Express Middleware

```typescript
// Always add these middleware in order
app.use(errorMiddleware.requestContextMiddleware);
app.use(errorMiddleware.errorMonitoringMiddleware);

// Your routes here...

app.use(errorMiddleware.expressErrorHandler);
```

## Configuration

### Environment Variables

```env
# Error handling configuration
ERROR_LOG_LEVEL=info
ERROR_MAX_RETRIES=3
ERROR_BASE_DELAY=1000
ERROR_MAX_DELAY=30000
```

### Custom Configuration

```typescript
import { ErrorHandler, RetryConfig } from '../utils/error-handler';

const customConfig: RetryConfig = {
  maxRetries: 5,
  baseDelay: 2000,
  maxDelay: 60000,
  backoffMultiplier: 3,
  retryableErrors: ['NETWORK_ERROR', 'RATE_LIMIT_ERROR']
};

const customHandler = ErrorHandler.getInstance(customConfig);
```

## Troubleshooting

### Common Issues

1. **Errors not being categorized correctly**
   - Check error message patterns in `categorizeError` method
   - Add custom categorization logic if needed

2. **Retry not working**
   - Verify error is retryable
   - Check retry configuration
   - Ensure error message matches retryable patterns

3. **Memory leaks**
   - Clear error statistics periodically
   - Remove event listeners when not needed

4. **Performance issues**
   - Monitor error statistics
   - Check for excessive retries
   - Optimize error context data

### Debug Mode

```typescript
// Enable debug logging
process.env.DEBUG = 'error-handler:*';

// Or set log level
process.env.ERROR_LOG_LEVEL = 'debug';
```

## Migration Guide

### From Basic Try-Catch

```typescript
// Before
try {
  await riskyOperation();
} catch (error) {
  console.error('Operation failed:', error);
  throw error;
}

// After
try {
  await errorHandler.withRetry(
    () => riskyOperation(),
    { operation: 'risky_operation' }
  );
} catch (error) {
  errorHandler.handleError(error, { operation: 'risky_operation' });
  throw error;
}
```

### From Custom Error Handling

```typescript
// Before
class CustomErrorHandler {
  async handleError(error: Error) {
    // Custom logic
  }
}

// After
import { errorHandler } from '../utils/error-handler';

// Use centralized handler
errorHandler.handleError(error, context);
```

This centralized error handling system provides a robust foundation for managing errors across your trading platform, ensuring consistent error handling, proper monitoring, and improved reliability. 