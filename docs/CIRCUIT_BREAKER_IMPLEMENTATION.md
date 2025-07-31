# Circuit Breaker Implementation

## Overview

The circuit breaker pattern is a crucial resilience mechanism that prevents cascading failures in distributed systems. This implementation provides a comprehensive circuit breaker solution for the Paradigm Trading System, protecting external API calls, database operations, and service integrations.

## Features

### 🔧 **Core Features**
- **Three-State Circuit Breaker**: CLOSED, OPEN, HALF_OPEN states
- **Automatic State Transitions**: Based on failure thresholds and recovery timeouts
- **Configurable Parameters**: Failure thresholds, timeouts, recovery periods
- **Timeout Protection**: Built-in request timeout handling
- **Event System**: Real-time monitoring and alerting
- **Metrics Tracking**: Comprehensive statistics and health monitoring

### 📊 **Monitoring & Observability**
- **Real-time Metrics**: Success/failure rates, request counts, timeouts
- **Health Status**: Circuit health monitoring and reporting
- **Event Emission**: State changes, failures, and recoveries
- **Statistics API**: Detailed performance analytics
- **Express Middleware**: Web-based monitoring endpoints

### 🛠 **Integration Features**
- **Express Middleware**: Seamless web application integration
- **Fallback Strategies**: Graceful degradation support
- **Multiple Circuit Types**: API, database, and service-specific configurations
- **Global Manager**: Centralized circuit breaker management
- **Utility Functions**: Pre-configured circuit breakers for common services

## Architecture

### Circuit States

```
CLOSED (Normal) → OPEN (Failure) → HALF_OPEN (Testing) → CLOSED (Recovered)
     ↑                                                           ↓
     └─────────────── Recovery Timeout ──────────────────────────┘
```

1. **CLOSED**: Normal operation, requests pass through
2. **OPEN**: Circuit is open, requests fail fast
3. **HALF_OPEN**: Testing if service has recovered

### State Transition Logic

- **CLOSED → OPEN**: When failure threshold is exceeded
- **OPEN → HALF_OPEN**: After recovery timeout period
- **HALF_OPEN → CLOSED**: After success threshold is reached
- **HALF_OPEN → OPEN**: If failure occurs during testing

## Quick Start

### Basic Usage

```typescript
import { CircuitBreaker } from '../utils/circuit-breaker';

// Create a circuit breaker
const circuit = new CircuitBreaker({
  name: 'my_api',
  failureThreshold: 3,
  recoveryTimeout: 60000,
  timeout: 5000
});

// Execute operations with protection
try {
  const result = await circuit.execute(async () => {
    // Your risky operation here
    return await externalApiCall();
  });
  
  console.log('Success:', result);
} catch (error) {
  console.log('Circuit breaker protected us from:', error.message);
}
```

### Using the Global Manager

```typescript
import { circuitBreakerManager } from '../utils/circuit-breaker';

// Execute with automatic circuit creation
const result = await circuitBreakerManager.execute(
  'my_service',
  async () => await riskyOperation(),
  { failureThreshold: 2, timeout: 3000 }
);
```

### Express Integration

```typescript
import { circuitBreakerMiddleware } from '../middleware/circuit-breaker';

// Apply circuit breaker to route
app.get('/api/data', circuitBreakerMiddleware({
  circuitName: 'data_api',
  operation: async (req, res, next) => {
    const data = await fetchDataFromExternalAPI();
    res.json(data);
  },
  fallback: (req, res, error) => {
    res.json({ error: 'Service temporarily unavailable', cached: true });
  }
}));
```

## Configuration

### Circuit Breaker Configuration

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;     // Failures before opening circuit
  recoveryTimeout: number;      // Time to wait before testing recovery
  expectedErrors: string[];     // Error patterns that count as failures
  successThreshold: number;     // Successes needed to close circuit
  timeout: number;              // Request timeout in milliseconds
  volumeThreshold: number;      // Minimum requests before considering failure rate
  name: string;                 // Circuit breaker name for logging
}
```

### Default Configuration

```typescript
const DEFAULT_CIRCUIT_CONFIG = {
  failureThreshold: 5,
  recoveryTimeout: 60000, // 1 minute
  expectedErrors: ['timeout', 'network', 'connection', 'ECONNREFUSED'],
  successThreshold: 2,
  timeout: 10000, // 10 seconds
  volumeThreshold: 10,
  name: 'default'
};
```

### Pre-configured Circuit Types

#### API Circuit Breakers
```typescript
import { createApiCircuitBreaker } from '../utils/circuit-breaker';

const apiCircuit = createApiCircuitBreaker('zerodha', {
  failureThreshold: 3,
  recoveryTimeout: 30000,
  timeout: 5000
});
```

#### Database Circuit Breakers
```typescript
import { createDatabaseCircuitBreaker } from '../utils/circuit-breaker';

const dbCircuit = createDatabaseCircuitBreaker('postgres', {
  failureThreshold: 5,
  recoveryTimeout: 60000,
  timeout: 10000
});
```

#### External Service Circuit Breakers
```typescript
import { createExternalServiceCircuitBreaker } from '../utils/circuit-breaker';

const serviceCircuit = createExternalServiceCircuitBreaker('notification', {
  failureThreshold: 3,
  recoveryTimeout: 45000,
  timeout: 8000
});
```

## Integration Patterns

### 1. Zerodha API Integration

```typescript
import { createZerodhaApiCircuitBreaker } from '../middleware/circuit-breaker';

class ZerodhaService {
  private circuit = createZerodhaApiCircuitBreaker();

  async getQuotes(symbols: string[]): Promise<any> {
    return await this.circuit.execute(
      async () => {
        return await this.kiteConnect.getQuote(symbols);
      },
      { operation: 'get_quotes', symbols }
    );
  }

  async placeOrder(orderParams: any): Promise<any> {
    return await this.circuit.execute(
      async () => {
        return await this.kiteConnect.placeOrder(orderParams);
      },
      { operation: 'place_order', orderType: orderParams.order_type }
    );
  }
}
```

### 2. Database Operations

```typescript
import { createPostgresCircuitBreaker } from '../middleware/circuit-breaker';

class TradeRepository {
  private circuit = createPostgresCircuitBreaker();

  async saveTrade(trade: Trade): Promise<Trade> {
    return await this.circuit.execute(
      async () => {
        return await this.prisma.trade.create({ data: trade });
      },
      { operation: 'save_trade', table: 'trades' }
    );
  }

  async getTrades(userId: string): Promise<Trade[]> {
    return await this.circuit.execute(
      async () => {
        return await this.prisma.trade.findMany({ where: { userId } });
      },
      { operation: 'get_trades', table: 'trades' }
    );
  }
}
```

### 3. Market Data Service

```typescript
import { createMarketDataApiCircuitBreaker } from '../middleware/circuit-breaker';

class MarketDataService {
  private circuit = createMarketDataApiCircuitBreaker();

  async getRealTimeData(symbols: string[]): Promise<any> {
    return await this.circuit.execute(
      async () => {
        return await this.marketDataProvider.getRealTimeQuotes(symbols);
      },
      { operation: 'get_realtime_data', symbols }
    );
  }

  async getHistoricalData(symbol: string, period: string): Promise<any> {
    return await this.circuit.execute(
      async () => {
        return await this.marketDataProvider.getHistoricalData(symbol, period);
      },
      { operation: 'get_historical_data', symbol, period }
    );
  }
}
```

### 4. Notification Service

```typescript
import { createNotificationServiceCircuitBreaker } from '../middleware/circuit-breaker';

class NotificationService {
  private circuit = createNotificationServiceCircuitBreaker();

  async sendTradeNotification(trade: Trade): Promise<void> {
    return await this.circuit.execute(
      async () => {
        return await this.notificationProvider.send({
          type: 'trade_executed',
          userId: trade.userId,
          message: `Trade executed: ${trade.symbol}`
        });
      },
      { operation: 'send_notification', type: 'trade_executed' }
    );
  }
}
```

## Monitoring & Observability

### Health Check Endpoint

```typescript
import { circuitBreakerHealthMiddleware } from '../middleware/circuit-breaker';

app.get('/health/circuit-breakers', circuitBreakerHealthMiddleware);
```

Response:
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "overallHealth": true,
  "circuits": {
    "api_zerodha": {
      "healthy": true,
      "state": "CLOSED",
      "failureRate": 0.05,
      "lastFailure": null,
      "nextAttempt": null
    }
  },
  "statistics": {
    "totalCircuits": 5,
    "healthyCircuits": 4,
    "openCircuits": 1,
    "halfOpenCircuits": 0
  }
}
```

### Statistics Endpoint

```typescript
import { circuitBreakerStatsMiddleware } from '../middleware/circuit-breaker';

app.get('/stats/circuit-breakers', circuitBreakerStatsMiddleware);
```

### Manual Control

```typescript
import { circuitBreakerControlMiddleware } from '../middleware/circuit-breaker';

app.post('/admin/circuit-breakers', circuitBreakerControlMiddleware);
```

Request:
```json
{
  "action": "open",
  "circuitName": "api_zerodha",
  "reason": "Scheduled maintenance"
}
```

### Event Monitoring

```typescript
import { circuitBreakerManager } from '../utils/circuit-breaker';

// Listen for circuit state changes
circuitBreakerManager.on('circuitOpen', (circuitName, metrics) => {
  console.log(`Circuit ${circuitName} opened!`, metrics);
  // Send alert to monitoring system
});

circuitBreakerManager.on('circuitClose', (circuitName, metrics) => {
  console.log(`Circuit ${circuitName} closed!`, metrics);
  // Update monitoring dashboard
});

circuitBreakerManager.on('circuitStateChange', (circuitName, from, to, reason) => {
  console.log(`Circuit ${circuitName}: ${from} → ${to} (${reason})`);
  // Log state transition
});
```

## Fallback Strategies

### 1. Cached Data Fallback

```typescript
async function getMarketData(symbol: string): Promise<any> {
  try {
    return await circuit.execute(async () => {
      return await externalApi.getQuote(symbol);
    });
  } catch (error) {
    // Fallback to cached data
    return await cacheService.get(symbol);
  }
}
```

### 2. Alternative Service Fallback

```typescript
async function getQuotes(symbols: string[]): Promise<any> {
  try {
    return await primaryCircuit.execute(async () => {
      return await primaryProvider.getQuotes(symbols);
    });
  } catch (error) {
    // Fallback to secondary provider
    return await secondaryCircuit.execute(async () => {
      return await secondaryProvider.getQuotes(symbols);
    });
  }
}
```

### 3. Default Response Fallback

```typescript
const circuit = circuitBreakerManager.getCircuit('api_service');

async function processRequest(): Promise<any> {
  try {
    return await circuit.execute(async () => {
      return await externalService.process();
    });
  } catch (error) {
    // Return default response
    return {
      status: 'degraded',
      message: 'Service temporarily unavailable',
      timestamp: new Date().toISOString()
    };
  }
}
```

## Best Practices

### 1. Circuit Breaker Configuration

- **Failure Threshold**: Start with 3-5 failures for APIs, 5-10 for databases
- **Recovery Timeout**: 30-60 seconds for APIs, 60-120 seconds for databases
- **Timeout**: Set to 2-3x expected response time
- **Volume Threshold**: Minimum 10 requests before considering failure rate

### 2. Error Handling

```typescript
// Categorize errors appropriately
const circuit = new CircuitBreaker({
  expectedErrors: [
    'timeout',
    'network',
    'connection',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT'
  ]
});
```

### 3. Monitoring Setup

```typescript
// Set up comprehensive monitoring
circuit.on('open', (metrics) => {
  // Send alert to ops team
  alertService.send({
    level: 'warning',
    message: `Circuit ${circuit.getConfig().name} opened`,
    metrics
  });
});

circuit.on('close', (metrics) => {
  // Update dashboard
  dashboardService.updateCircuitStatus(circuit.getConfig().name, 'healthy');
});
```

### 4. Testing Circuit Breakers

```typescript
// Test circuit breaker behavior
describe('Circuit Breaker Tests', () => {
  it('should open circuit after failures', async () => {
    const circuit = new CircuitBreaker({ failureThreshold: 2 });
    
    // Force failures
    for (let i = 0; i < 3; i++) {
      try {
        await circuit.execute(async () => {
          throw new Error('Test failure');
        });
      } catch (error) {
        // Expected
      }
    }
    
    expect(circuit.getState()).toBe(CircuitState.OPEN);
  });
});
```

## Performance Considerations

### 1. Memory Usage
- Circuit breakers are lightweight (few KB per instance)
- Metrics are kept in memory for fast access
- Consider cleanup for long-running applications

### 2. CPU Overhead
- Minimal overhead for state checking
- Event emission is asynchronous
- Timeout handling uses native timers

### 3. Network Impact
- Fail-fast behavior reduces network load
- Prevents cascading failures
- Improves overall system responsiveness

## Troubleshooting

### Common Issues

1. **Circuit Never Opens**
   - Check failure threshold configuration
   - Verify error categorization
   - Ensure sufficient request volume

2. **Circuit Never Closes**
   - Check recovery timeout configuration
   - Verify success threshold
   - Monitor for continuous failures

3. **High Memory Usage**
   - Limit number of circuit breakers
   - Implement cleanup for unused circuits
   - Monitor metrics storage

### Debug Mode

```typescript
// Enable debug logging
const circuit = new CircuitBreaker({
  name: 'debug_circuit',
  debug: true // Enable detailed logging
});

// Monitor all events
circuit.on('*', (event, ...args) => {
  console.log(`Circuit event: ${event}`, args);
});
```

## Migration Guide

### From Basic Error Handling

```typescript
// Before: Basic try-catch
try {
  const result = await externalApi.call();
  return result;
} catch (error) {
  console.error('API call failed:', error);
  throw error;
}

// After: Circuit breaker protection
const circuit = new CircuitBreaker({ name: 'external_api' });
try {
  const result = await circuit.execute(async () => {
    return await externalApi.call();
  });
  return result;
} catch (error) {
  console.error('Circuit breaker protected us:', error);
  // Handle gracefully or use fallback
}
```

### From Retry Logic

```typescript
// Before: Manual retry logic
async function callWithRetry(operation: () => Promise<any>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// After: Circuit breaker with automatic recovery
const circuit = new CircuitBreaker({
  failureThreshold: 3,
  recoveryTimeout: 60000
});

const result = await circuit.execute(operation);
```

## Conclusion

The circuit breaker implementation provides a robust foundation for building resilient trading systems. By protecting external dependencies and providing graceful degradation, it ensures that the trading platform remains operational even when external services are experiencing issues.

Key benefits:
- **Improved Reliability**: Prevents cascading failures
- **Better User Experience**: Graceful degradation instead of complete failure
- **Operational Visibility**: Comprehensive monitoring and alerting
- **Easy Integration**: Simple API with Express middleware support
- **Flexible Configuration**: Adaptable to different service characteristics

For production deployment, ensure proper monitoring is in place and circuit breaker configurations are tuned based on actual service behavior and requirements. 