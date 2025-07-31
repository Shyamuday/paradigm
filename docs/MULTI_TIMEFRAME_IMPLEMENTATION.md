# Multi-Timeframe Data Storage Implementation

## Overview

The Paradigm Trading System now supports comprehensive multi-timeframe data storage for efficient token data management across different intervals (1min, 3min, 5min, 15min, 30min, 1hour, 1day).

## Architecture

### Database Schema

The system uses a sophisticated database schema with the following key components:

1. **TimeframeConfig**: Defines available timeframes and their properties
2. **CandleData**: Stores OHLCV data for each timeframe
3. **TickData**: Stores real-time tick data for immediate processing
4. **VolumeProfile**: Stores volume analysis data

### Key Features

- **Automatic Aggregation**: Tick data is automatically aggregated to all configured timeframes
- **Real-time Updates**: Existing candles are updated with new tick data
- **Data Retention**: Configurable retention policies for different timeframes
- **Performance Optimization**: Indexed queries and efficient data storage
- **Data Quality**: Validation and monitoring for data integrity

## Usage Examples

### 1. Basic Usage

```typescript
import { EnhancedMarketDataService } from "../services/enhanced-market-data.service";

const marketDataService = new EnhancedMarketDataService();

// Save tick data (automatically aggregates to all timeframes)
await marketDataService.saveTickDataAndAggregate({
  instrumentToken: 256265,
  symbol: "NIFTY",
  ltp: 19500.5,
  open: 19450.0,
  high: 19520.0,
  low: 19430.0,
  close: 19500.5,
  volume: 1000,
  change: 50.5,
  changePercent: 0.26,
  timestamp: new Date(),
});
```

### 2. Get Multi-Timeframe Data

```typescript
// Get data for multiple timeframes
const multiTimeframeData = await marketDataService.getMultiTimeframeData(
  "NIFTY",
  ["1min", "5min", "15min", "1hour"],
  new Date("2024-01-01"),
  new Date("2024-01-02"),
  100
);

console.log("1min candles:", multiTimeframeData["1min"].length);
console.log("5min candles:", multiTimeframeData["5min"].length);
console.log("15min candles:", multiTimeframeData["15min"].length);
console.log("1hour candles:", multiTimeframeData["1hour"].length);
```

### 3. Get Latest Data

```typescript
// Get latest candles for all timeframes
const latestData = await marketDataService.getLatestMultiTimeframeData("NIFTY");

for (const [timeframe, candle] of Object.entries(latestData)) {
  if (candle) {
    console.log(`${timeframe}: ${candle.close} (${candle.volume} volume)`);
  }
}
```

### 4. Historical Data Analysis

```typescript
// Get historical data for analysis
const historicalData = await marketDataService.getHistoricalData(
  "NIFTY",
  "1hour",
  new Date("2024-01-01"),
  new Date("2024-01-31"),
  1000
);

console.log(`Total candles: ${historicalData.totalCount}`);
console.log(`Has more data: ${historicalData.hasMore}`);
```

### 5. Price Change Analysis

```typescript
// Get price change information
const priceChange = await marketDataService.getPriceChange("NIFTY", "1day");

if (priceChange) {
  console.log(`Change: ${priceChange.change} (${priceChange.changePercent}%)`);
  console.log(`Open: ${priceChange.open}, Close: ${priceChange.close}`);
}
```

### 6. Volume Profile Analysis

```typescript
// Get volume profile for a specific date
const volumeProfile = await marketDataService.getVolumeProfile(
  "NIFTY",
  "1day",
  new Date("2024-01-15")
);

// Find Point of Control (highest volume level)
const poc = volumeProfile.find((vp) => vp.poc);
if (poc) {
  console.log(`Point of Control: ${poc.priceLevel} (${poc.volume} volume)`);
}
```

## Configuration

### Timeframe Configuration

Configure timeframes in `config/timeframe-config.yaml`:

```yaml
timeframes:
  - name: "1min"
    description: "1 Minute Candles"
    intervalMinutes: 1
    isActive: true
    retentionDays: 7
    aggregationEnabled: true
```

### Instrument-Specific Settings

```yaml
instruments:
  overrides:
    "NIFTY":
      enabledTimeframes:
        ["1min", "3min", "5min", "15min", "30min", "1hour", "1day"]
      priority: "high"
```

## Data Management

### Automatic Cleanup

The system automatically cleans up old data based on retention policies:

```typescript
// Manual cleanup
await marketDataService.cleanupOldData();
```

### Data Statistics

Get statistics for any instrument:

```typescript
const stats = await marketDataService.getInstrumentStats("NIFTY");

console.log(`Total ticks: ${stats.totalTicks}`);
console.log("Candles by timeframe:", stats.totalCandles);
console.log(`Last update: ${stats.lastUpdate}`);
```

## Performance Considerations

### 1. Database Indexing

The system uses optimized indexes for fast queries:

- `(instrumentId, timeframeId, timestamp)` for candle data
- `(instrumentId, timestamp)` for tick data
- `(instrumentId, timeframeId, date)` for volume profiles

### 2. Data Retention

- **Tick Data**: 7 days (for real-time processing)
- **1min Candles**: 7 days
- **5min Candles**: 30 days
- **15min Candles**: 60 days
- **1hour Candles**: 180 days
- **1day Candles**: 365 days

### 3. Batch Processing

For large datasets, use batch processing:

```typescript
// Process data in batches
const batchSize = 1000;
for (let i = 0; i < totalRecords; i += batchSize) {
  const batch = records.slice(i, i + batchSize);
  await processBatch(batch);
}
```

## Integration with Trading Strategies

### Strategy Implementation

```typescript
class MultiTimeframeStrategy {
  async generateSignals(symbol: string): Promise<TradeSignal[]> {
    // Get data from multiple timeframes
    const data = await marketDataService.getLatestMultiTimeframeData(symbol);

    // Analyze 1min for entry timing
    const oneMinData = data["1min"];

    // Analyze 15min for trend direction
    const fifteenMinData = data["15min"];

    // Analyze 1hour for overall trend
    const oneHourData = data["1hour"];

    // Generate signals based on multi-timeframe analysis
    return this.analyzeMultiTimeframe(oneMinData, fifteenMinData, oneHourData);
  }
}
```

### Real-time Signal Generation

```typescript
// Subscribe to real-time updates
marketDataService.on("tickData", async (tickData) => {
  // Process new tick data
  await marketDataService.saveTickDataAndAggregate(tickData);

  // Check for signals on updated data
  const signals = await strategy.generateSignals(tickData.symbol);

  // Execute signals
  for (const signal of signals) {
    await orderService.executeSignal(signal);
  }
});
```

## Monitoring and Alerts

### Data Quality Monitoring

```typescript
// Monitor data gaps
const checkDataGaps = async (symbol: string, timeframe: string) => {
  const candles = await marketDataService.getHistoricalData(
    symbol,
    timeframe,
    from,
    to
  );

  // Check for missing candles
  const gaps = findDataGaps(candles.candles, timeframe);

  if (gaps.length > 0) {
    logger.warn(`Data gaps found for ${symbol} ${timeframe}:`, gaps);
  }
};
```

### Performance Monitoring

```typescript
// Monitor aggregation performance
const startTime = Date.now();
await marketDataService.saveTickDataAndAggregate(tickData);
const duration = Date.now() - startTime;

if (duration > 1000) {
  // More than 1 second
  logger.warn(`Slow aggregation: ${duration}ms for ${tickData.symbol}`);
}
```

## Best Practices

### 1. Data Validation

Always validate incoming data:

```typescript
const validateTickData = (tickData: TickData): boolean => {
  return (
    tickData.ltp > 0 &&
    tickData.volume >= 0 &&
    tickData.high >= tickData.low &&
    tickData.open >= 0 &&
    tickData.close >= 0
  );
};
```

### 2. Error Handling

Implement proper error handling:

```typescript
try {
  await marketDataService.saveTickDataAndAggregate(tickData);
} catch (error) {
  logger.error("Failed to process tick data:", error);
  // Implement retry logic or alerting
}
```

### 3. Resource Management

Monitor database connections and memory usage:

```typescript
// Monitor database health
const isHealthy = await db.healthCheck();
if (!isHealthy) {
  logger.error("Database health check failed");
  // Implement fallback or alerting
}
```

## Migration from Old System

### 1. Database Migration

Run the new Prisma migration:

```bash
npx prisma migrate dev --name add-multi-timeframe-support
```

### 2. Data Migration

Migrate existing market data:

```typescript
// Migrate existing data to new schema
const migrateExistingData = async () => {
  const oldMarketData = await db.marketData.findMany();

  for (const data of oldMarketData) {
    // Convert to new format
    await marketDataService.saveTickDataAndAggregate({
      instrumentToken: 0, // Will be determined by instrument
      symbol: data.instrument.symbol,
      ltp: data.ltp || data.close || 0,
      open: data.open || 0,
      high: data.high || 0,
      low: data.low || 0,
      close: data.close || 0,
      volume: data.volume || 0,
      change: data.change || 0,
      changePercent: data.changePercent || 0,
      timestamp: data.timestamp,
    });
  }
};
```

## Conclusion

The multi-timeframe data storage system provides a robust foundation for advanced trading strategies. It efficiently manages data across multiple timeframes while maintaining performance and data integrity. The system is designed to scale with your trading needs and provides comprehensive monitoring and management capabilities.
