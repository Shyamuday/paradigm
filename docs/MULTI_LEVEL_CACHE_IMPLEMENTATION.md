# Multi-Level Cache Implementation

## Overview

The Multi-Level Cache system provides a comprehensive caching solution with three levels of caching (L1: In-Memory, L2: Redis, L3: Database) for the Paradigm Trading System. This implementation ensures optimal performance, data consistency, and intelligent cache management for high-frequency trading operations.

## Features

### 🚀 Core Features

- **Three-Level Caching**: L1 (In-Memory), L2 (Redis), L3 (Database) with automatic fallback
- **Intelligent Cache Invalidation**: Tag-based invalidation for precise cache management
- **Trading-Specific Methods**: Specialized caching for market data, portfolios, and orders
- **Express Middleware Integration**: Seamless integration with Express.js applications
- **Performance Monitoring**: Real-time cache statistics and operation tracking
- **Event-Driven Architecture**: Real-time notifications for cache events
- **Compression & Encryption**: Optional data compression and encryption support

### 📊 Cache Levels

- **L1 Cache (In-Memory)**: Fastest access, limited size, automatic eviction
- **L2 Cache (Redis)**: Distributed caching, persistence, high availability
- **L3 Cache (Database)**: Long-term storage, backup cache, data consistency

### 🔧 Advanced Features

- **Multiple Eviction Strategies**: LRU, LFU, FIFO for optimal memory management
- **Tag-Based Invalidation**: Precise cache invalidation using tags
- **TTL Management**: Configurable time-to-live for each cache level
- **Cache Warming**: Pre-loading frequently accessed data
- **Health Monitoring**: Cache health checks and performance metrics
- **API Response Caching**: Automatic caching of API responses

## Architecture

### MultiLevelCacheService

The core service that manages all cache levels:

```typescript
import { MultiLevelCacheService } from '../services/multi-level-cache.service';

const cacheService = new MultiLevelCacheService({
  l1: { ttl: 300, maxSize: 1000, strategy: 'LRU', enabled: true },
  l2: { ttl: 3600, strategy: 'LRU', enabled: true },
  l3: { ttl: 86400, strategy: 'LRU', enabled: true },
  redis: { host: 'localhost', port: 6379 },
  prisma: prismaClient,
  enableMetrics: true
});
```

#### Key Methods

- `get(key, tags)`: Get value with multi-level fallback
- `set(key, value, tags, ttl)`: Set value across all levels
- `delete(key)`: Delete value from all levels
- `invalidateByTags(tags)`: Invalidate cache by tags
- `getStats()`: Get cache performance statistics
- `getOperations(limit)`: Get recent cache operations

### MultiLevelCacheMiddleware

Express middleware for integrating caching into web applications:

```typescript
import { MultiLevelCacheMiddleware } from '../middleware/multi-level-cache';

const middleware = new MultiLevelCacheMiddleware({
  cacheService,
  enableResponseCaching: true,
  ttl: 300,
  tags: ['api', 'trading'],
  excludePaths: ['/api/health']
});
```

#### Middleware Functions

- `responseCache`: Cache API responses automatically
- `requestCache`: Cache expensive request operations
- `cacheInvalidation`: Add cache invalidation methods to requests
- `cacheStats`: Add cache statistics to requests

## Usage Examples

### Basic Setup

```typescript
import { MultiLevelCacheService } from './services/multi-level-cache.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const cacheService = new MultiLevelCacheService({
  l1: {
    ttl: 300, // 5 minutes
    maxSize: 1000,
    strategy: 'LRU',
    enabled: true
  },
  l2: {
    ttl: 3600, // 1 hour
    strategy: 'LRU',
    enabled: true
  },
  l3: {
    ttl: 86400, // 24 hours
    strategy: 'LRU',
    enabled: true
  },
  redis: {
    host: 'localhost',
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    db: 0
  },
  prisma,
  enableMetrics: true
});
```

### Basic Cache Operations

```typescript
// Set data with tags
const userData = {
  id: 'user123',
  name: 'John Doe',
  portfolio: { totalValue: 100000 }
};

await cacheService.set('user:123', userData, ['user', 'portfolio'], 600);

// Get data (automatically checks L1 -> L2 -> L3)
const cachedData = await cacheService.get('user:123');

// Delete data
await cacheService.delete('user:123');

// Invalidate by tags
await cacheService.invalidateByTags(['user', 'portfolio']);
```

### Trading-Specific Caching

```typescript
// Cache market data
const marketData = {
  symbol: 'RELIANCE',
  price: 2500.50,
  volume: 1000000,
  timestamp: new Date()
};

await cacheService.setMarketData('RELIANCE', '1m', marketData, 60);
const cachedMarketData = await cacheService.getMarketData('RELIANCE', '1m');

// Cache portfolio data
const portfolioData = {
  userId: 'user123',
  totalValue: 100000,
  positions: [
    { symbol: 'RELIANCE', quantity: 100, currentValue: 250000 }
  ]
};

await cacheService.setPortfolio('user123', portfolioData);
const cachedPortfolio = await cacheService.getPortfolio('user123');

// Cache orders
const ordersData = [
  { id: 'order1', symbol: 'RELIANCE', status: 'PENDING' }
];

await cacheService.setOrders('user123', 'PENDING', ordersData);
const cachedOrders = await cacheService.getOrders('user123', 'PENDING');
```

### Express Integration

```typescript
import express from 'express';
import { MultiLevelCacheMiddleware } from './middleware/multi-level-cache';

const app = express();
const middleware = new MultiLevelCacheMiddleware({
  cacheService,
  enableResponseCaching: true,
  ttl: 300,
  tags: ['api', 'trading'],
  excludePaths: ['/api/health', '/api/metrics']
});

// Add middleware
app.use(middleware.cacheInvalidation);
app.use(middleware.cacheStats);
app.use(middleware.responseCache);

// Add cache management routes
const routes = middleware.getRoutes();
Object.entries(routes).forEach(([route, handler]) => {
  const [method, path] = route.split(' ');
  app[method.toLowerCase()](path, handler);
});
```

## API Endpoints

### Cache Statistics

```http
GET /api/cache/stats
```

Returns comprehensive cache performance statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "L1": {
        "hits": 150,
        "misses": 25,
        "hitRate": 85.71,
        "size": 850,
        "maxSize": 1000,
        "evictions": 5
      },
      "L2": {
        "hits": 75,
        "misses": 15,
        "hitRate": 83.33,
        "size": 0,
        "maxSize": 0,
        "evictions": 0
      }
    },
    "summary": {
      "totalHits": 225,
      "totalMisses": 40,
      "overallHitRate": 84.91,
      "totalSize": 850,
      "totalEvictions": 5
    }
  }
}
```

### Cache Operations

```http
GET /api/cache/operations?limit=50
```

Returns recent cache operations for analysis.

### Clear Cache

```http
POST /api/cache/clear
```

Clears all cache levels.

### Invalidate Cache

```http
POST /api/cache/invalidate
Content-Type: application/json

{
  "tags": ["user", "portfolio"]
}
```

Invalidates cache entries by tags.

### Cache Health

```http
GET /api/cache/health
```

Returns cache health status and recommendations.

## Configuration

### MultiLevelCacheConfig

```typescript
interface MultiLevelCacheConfig {
  l1: Partial<CacheConfig>;
  l2: Partial<CacheConfig>;
  l3: Partial<CacheConfig>;
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  prisma?: PrismaClient;
  enableMetrics?: boolean;
  enableCompression?: boolean;
  enableEncryption?: boolean;
  encryptionKey?: string;
}
```

### CacheConfig

```typescript
interface CacheConfig {
  level: 'L1' | 'L2' | 'L3';
  ttl: number; // Time to live in seconds
  maxSize?: number; // Maximum number of items (L1 only)
  strategy: 'LRU' | 'LFU' | 'FIFO';
  enabled: boolean;
}
```

### CacheMiddlewareConfig

```typescript
interface CacheMiddlewareConfig {
  cacheService: MultiLevelCacheService;
  enableResponseCaching?: boolean;
  enableRequestCaching?: boolean;
  cacheKeyGenerator?: (req: Request) => string;
  ttl?: number;
  tags?: string[];
  excludePaths?: string[];
  includePaths?: string[];
  enableCompression?: boolean;
  enableMetrics?: boolean;
}
```

## Trading-Specific Optimizations

### Recommended Cache Configuration

```typescript
const tradingCacheConfig: MultiLevelCacheConfig = {
  l1: {
    ttl: 60, // 1 minute for real-time data
    maxSize: 2000,
    strategy: 'LRU',
    enabled: true
  },
  l2: {
    ttl: 300, // 5 minutes for frequently accessed data
    strategy: 'LRU',
    enabled: true
  },
  l3: {
    ttl: 3600, // 1 hour for historical data
    strategy: 'LRU',
    enabled: true
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: 0
  },
  prisma,
  enableMetrics: true,
  enableCompression: true,
  enableEncryption: false
};
```

### Trading Data Caching Patterns

```typescript
// Market data caching with different timeframes
const timeframes = ['1s', '1m', '5m', '15m', '1h', '1d'];

for (const timeframe of timeframes) {
  const ttl = timeframe === '1s' ? 5 : 
              timeframe === '1m' ? 60 : 
              timeframe === '5m' ? 300 : 
              timeframe === '15m' ? 900 : 
              timeframe === '1h' ? 3600 : 86400;
  
  await cacheService.setMarketData(symbol, timeframe, data, ttl);
}

// Portfolio caching with user-specific tags
await cacheService.setPortfolio(userId, portfolioData);
// Automatically tagged with ['portfolio', userId]

// Orders caching with status-based invalidation
await cacheService.setOrders(userId, 'PENDING', ordersData);
// Automatically tagged with ['orders', userId, 'PENDING']
```

### Cache Invalidation Strategies

```typescript
// Invalidate user-specific data
await cacheService.invalidateUserData(userId);

// Invalidate market data for specific symbol
await cacheService.invalidateMarketData('RELIANCE');

// Invalidate all market data
await cacheService.invalidateMarketData();

// Invalidate by custom tags
await cacheService.invalidateByTags(['trading', 'high-frequency']);

// Invalidate API responses
await cacheService.invalidateByTags(['api', 'portfolio']);
```

## Performance Best Practices

### 1. Cache Level Strategy

- **L1 Cache**: Use for frequently accessed, small data
- **L2 Cache**: Use for medium-term data and distributed access
- **L3 Cache**: Use for long-term data and backup storage

### 2. TTL Configuration

- **Real-time data**: 5-60 seconds
- **Frequently accessed**: 5-15 minutes
- **Historical data**: 1-24 hours
- **Static data**: 24 hours or more

### 3. Tag Strategy

- **Use descriptive tags**: `['user', 'portfolio', 'realtime']`
- **Hierarchical tags**: `['trading', 'market-data', 'RELIANCE']`
- **Status-based tags**: `['orders', 'PENDING', 'user123']`
- **Time-based tags**: `['market-data', '1m', '2024-01-15']`

### 4. Memory Management

- **Monitor cache sizes**: Keep L1 cache under 80% capacity
- **Use appropriate eviction strategies**: LRU for most cases, LFU for access patterns
- **Clean up expired data**: Regular cleanup intervals
- **Monitor eviction rates**: High eviction rates indicate cache pressure

### 5. Performance Monitoring

- **Track hit rates**: Aim for >80% overall hit rate
- **Monitor access patterns**: Identify frequently accessed data
- **Cache warming**: Pre-load frequently accessed data
- **Performance alerts**: Set up alerts for cache performance degradation

## Testing

### Run Tests

```bash
# Run multi-level cache tests
npm run cache:test

# Run all tests
npm run test:all

# Run with coverage
npm run test:coverage
```

### Test Coverage

The test suite covers:

- Cache level initialization and configuration
- L1, L2, and L3 cache operations
- Cache invalidation and tag management
- Express middleware functionality
- Error handling and edge cases
- Performance monitoring and statistics
- Trading-specific cache methods

## Monitoring Dashboard

### Real-time Metrics

The system provides real-time metrics for:

- **Cache Performance**: Hit rates, miss rates, access times
- **Memory Usage**: Cache sizes, eviction rates
- **Operation Tracking**: Cache operations, errors, performance
- **Health Status**: Cache health, recommendations

### Alerts and Notifications

- **Low Hit Rate Alerts**: Automatic detection of performance issues
- **High Eviction Rate Alerts**: Memory pressure warnings
- **Cache Miss Alerts**: Frequent cache misses
- **Health Check Alerts**: Cache health status monitoring

## Integration with Trading System

### Automated Cache Management

```typescript
// Automated cache warming
async function warmCache() {
  const popularSymbols = ['RELIANCE', 'TCS', 'INFY', 'HDFC'];
  
  for (const symbol of popularSymbols) {
    const marketData = await fetchMarketData(symbol);
    await cacheService.setMarketData(symbol, '1m', marketData, 60);
  }
}

// Automated cache invalidation
async function invalidateStaleData() {
  // Invalidate old market data
  await cacheService.invalidateByTags(['market-data', 'stale']);
  
  // Invalidate completed orders
  await cacheService.invalidateByTags(['orders', 'COMPLETED']);
}
```

### Trading-Specific Monitoring

```typescript
// Monitor trading-specific metrics
cacheService.on('cacheHit', (level: string, key: string) => {
  if (key.includes('market-data')) {
    logger.info(`Market data cache hit on ${level}: ${key}`);
  }
});

cacheService.on('cacheMiss', (level: string, key: string) => {
  if (key.includes('market-data')) {
    logger.warn(`Market data cache miss on ${level}: ${key}`);
  }
});
```

## Troubleshooting

### Common Issues

1. **Low Hit Rates**
   - Check TTL configuration
   - Review cache key strategy
   - Analyze access patterns
   - Consider cache warming

2. **High Memory Usage**
   - Monitor cache sizes
   - Review eviction strategies
   - Check for memory leaks
   - Optimize data structures

3. **Redis Connection Issues**
   - Check Redis server status
   - Verify connection configuration
   - Monitor network connectivity
   - Review Redis logs

4. **Cache Inconsistency**
   - Check invalidation logic
   - Review tag strategy
   - Monitor concurrent access
   - Verify cache synchronization

### Debug Mode

```typescript
// Enable debug logging
const cacheService = new MultiLevelCacheService(config);

// Monitor all events
cacheService.on('*', (event, ...args) => {
  console.log(`Cache Event: ${event}`, args);
});

// Monitor specific events
cacheService.on('cacheHit', (level, key) => {
  console.log(`Cache hit on ${level}: ${key}`);
});

cacheService.on('cacheMiss', (level, key) => {
  console.log(`Cache miss on ${level}: ${key}`);
});
```

## Future Enhancements

### Planned Features

1. **Machine Learning Integration**
   - Predictive cache warming
   - Automatic TTL optimization
   - Access pattern recognition

2. **Advanced Analytics**
   - Cache performance forecasting
   - Capacity planning
   - Cost optimization

3. **Multi-Region Support**
   - Geographic distribution
   - Cross-region synchronization
   - Latency optimization

4. **Real-time Optimization**
   - Dynamic cache sizing
   - Adaptive TTL adjustment
   - Intelligent eviction

## Conclusion

The Multi-Level Cache system provides a comprehensive solution for optimizing performance in the Paradigm Trading System. With intelligent caching strategies, trading-specific optimizations, and seamless integration, it ensures that the trading platform can handle high-frequency operations efficiently and reliably.

The system is designed to be:

- **Fast**: Multi-level caching with optimal access patterns
- **Intelligent**: Automatic fallback and intelligent invalidation
- **Scalable**: Distributed caching with Redis
- **Reliable**: Robust error handling and monitoring
- **Integrated**: Seamless integration with existing trading infrastructure

This implementation ensures that data access remains performant and consistent, supporting the high-frequency trading requirements of the Paradigm system while providing comprehensive monitoring and management capabilities. 