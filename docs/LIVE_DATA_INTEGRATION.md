# Live Data Integration Guide

## Overview

This guide explains how the multi-timeframe data storage system integrates with live market data from Zerodha and other sources.

## 🔄 Live Data Flow

```
Zerodha Websocket → LiveDataIntegrationService → EnhancedMarketDataService → All Timeframes
```

## 🚀 Quick Start

### 1. Basic Integration

```typescript
import { LiveDataIntegrationService } from "../services/live-data-integration.service";

const liveDataService = new LiveDataIntegrationService();

// Process live tick data
await liveDataService.processLiveTickData(zerodhaTickData);

// Get real-time multi-timeframe data
const realTimeData = await liveDataService.getRealTimeMultiTimeframeData(
  "NIFTY"
);
```

### 2. Start Live Monitoring

```typescript
// Start monitoring for specific symbols
await liveDataService.startLiveMonitoring(["NIFTY", "BANKNIFTY", "RELIANCE"]);

// Monitor data quality
const quality = await liveDataService.monitorDataQuality("NIFTY");
```

## 🔌 Zerodha Integration

### 1. Websocket Setup

```typescript
import { KiteConnect } from "kiteconnect";
import { LiveDataIntegrationService } from "../services/live-data-integration.service";

const kite = new KiteConnect({
  api_key: process.env.ZERODHA_API_KEY,
  access_token: process.env.ZERODHA_ACCESS_TOKEN,
});

const liveDataService = new LiveDataIntegrationService();

// Set up websocket handlers
kite.on("ticks", async (ticks) => {
  for (const tick of ticks) {
    await liveDataService.processLiveTickData(tick);
  }
});

kite.on("connect", () => {
  console.log("Connected to Zerodha websocket");
  liveDataService.startLiveMonitoring(["NIFTY", "BANKNIFTY"]);
});

kite.on("disconnect", () => {
  console.log("Disconnected from Zerodha websocket");
  liveDataService.stopLiveMonitoring();
});
```

### 2. Subscribe to Instruments

```typescript
// Subscribe to specific instruments
const instruments = [
  { instrument_token: 256265, tradingsymbol: "NIFTY" },
  { instrument_token: 260105, tradingsymbol: "BANKNIFTY" },
];

await kite.subscribe(instruments);
await kite.setMode("full", instruments);
```

### 3. Handle Different Data Types

#### Tick Data

```typescript
// Zerodha tick data format
const zerodhaTick = {
  instrument_token: 256265,
  tradingsymbol: "NIFTY",
  last_price: 19500.5,
  ohlc: {
    open: 19450.0,
    high: 19520.0,
    low: 19430.0,
  },
  volume: 1000,
  change: 50.5,
  change_percent: 0.26,
  timestamp: Date.now(),
};

await liveDataService.processLiveTickData(zerodhaTick);
```

#### Candle Data

```typescript
// Zerodha candle data format
const zerodhaCandle = {
  instrument_token: 256265,
  tradingsymbol: "NIFTY",
  open: 19450.0,
  high: 19520.0,
  low: 19430.0,
  close: 19500.5,
  volume: 1000,
  timestamp: Date.now(),
};

await liveDataService.processLiveCandleData(zerodhaCandle);
```

## 📊 Real-Time Data Access

### 1. Get Latest Multi-Timeframe Data

```typescript
// Get latest data for all timeframes
const latestData = await liveDataService.getRealTimeMultiTimeframeData("NIFTY");

console.log("Latest data:");
for (const [timeframe, candle] of Object.entries(latestData)) {
  if (candle) {
    console.log(`${timeframe}: Close=${candle.close}, Volume=${candle.volume}`);
  }
}
```

### 2. Monitor Data Quality

```typescript
// Check data quality for a symbol
const quality = await liveDataService.monitorDataQuality("NIFTY");

console.log("Data quality:", {
  lastUpdate: quality.lastUpdate,
  latency: quality.latency,
  dataGaps: quality.dataGaps,
});

// Alert if there are issues
if (quality.dataGaps.length > 0) {
  console.warn("Data gaps detected:", quality.dataGaps);
}

if (quality.latency > 30000) {
  // 30 seconds
  console.warn("High latency detected:", quality.latency);
}
```

### 3. Get Connection Status

```typescript
const status = liveDataService.getConnectionStatus();
console.log("Connection status:", status);
```

## 🎯 Real-Time Strategy Integration

### 1. Multi-Timeframe Strategy

```typescript
class RealTimeMultiTimeframeStrategy {
  constructor(private liveDataService: LiveDataIntegrationService) {}

  async generateSignals(symbol: string): Promise<any[]> {
    // Get real-time multi-timeframe data
    const data = await this.liveDataService.getRealTimeMultiTimeframeData(
      symbol
    );

    const signals = [];

    // Example: Moving average crossover on 5min and 15min
    if (data["5min"] && data["15min"]) {
      const fiveMinClose = data["5min"].close;
      const fifteenMinClose = data["15min"].close;

      if (fiveMinClose > fifteenMinClose) {
        signals.push({
          symbol,
          action: "BUY",
          timeframe: "5min",
          price: fiveMinClose,
          timestamp: new Date(),
        });
      }
    }

    return signals;
  }
}
```

### 2. Real-Time Signal Processing

```typescript
const strategy = new RealTimeMultiTimeframeStrategy(liveDataService);

// Process signals on every tick
const processSignals = async (symbol: string) => {
  const signals = await strategy.generateSignals(symbol);

  if (signals.length > 0) {
    console.log("Generated signals:", signals);

    // Execute signals
    for (const signal of signals) {
      await orderService.executeSignal(signal);
    }
  }
};

// Set up real-time processing
setInterval(async () => {
  await processSignals("NIFTY");
}, 1000); // Check every second
```

## 🔧 Configuration

### 1. Live Data Settings

```yaml
# config/timeframe-config.yaml
live_data:
  # Connection settings
  reconnect_attempts: 5
  reconnect_delay: 5000

  # Quality monitoring
  max_latency_ms: 30000
  data_gap_threshold_ms: 300000 # 5 minutes

  # Performance settings
  batch_size: 100
  processing_delay_ms: 100
```

### 2. Instrument-Specific Settings

```yaml
instruments:
  overrides:
    "NIFTY":
      enabledTimeframes:
        ["1min", "3min", "5min", "15min", "30min", "1hour", "1day"]
      priority: "high"
      max_latency_ms: 15000 # Stricter latency for high-priority instruments

    "BANKNIFTY":
      enabledTimeframes: ["1min", "5min", "15min", "1hour", "1day"]
      priority: "high"
```

## 📈 Performance Optimization

### 1. Batch Processing

```typescript
// Process multiple ticks in batch
const processBatchTicks = async (ticks: any[]) => {
  const batchSize = 100;

  for (let i = 0; i < ticks.length; i += batchSize) {
    const batch = ticks.slice(i, i + batchSize);

    await Promise.all(
      batch.map((tick) => liveDataService.processLiveTickData(tick))
    );
  }
};
```

### 2. Caching

```typescript
// Cache frequently accessed data
class CachedLiveDataService extends LiveDataIntegrationService {
  private cache = new Map();
  private cacheTTL = 30000; // 30 seconds

  async getRealTimeMultiTimeframeData(symbol: string) {
    const cacheKey = `latest_${symbol}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    const data = await super.getRealTimeMultiTimeframeData(symbol);
    this.cache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  }
}
```

### 3. Error Handling

```typescript
// Robust error handling for live data
const processLiveDataWithRetry = async (data: any, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await liveDataService.processLiveTickData(data);
      break; // Success, exit retry loop
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) {
        throw error; // Give up after max retries
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
};
```

## 🚨 Monitoring and Alerts

### 1. Data Quality Monitoring

```typescript
// Set up periodic quality checks
setInterval(async () => {
  const symbols = ["NIFTY", "BANKNIFTY", "RELIANCE"];

  for (const symbol of symbols) {
    try {
      const quality = await liveDataService.monitorDataQuality(symbol);

      if (quality.dataGaps.length > 0) {
        // Send alert
        await sendAlert(`Data gaps for ${symbol}: ${quality.dataGaps}`);
      }

      if (quality.latency > 30000) {
        // Send alert
        await sendAlert(`High latency for ${symbol}: ${quality.latency}ms`);
      }
    } catch (error) {
      console.error(`Failed to monitor ${symbol}:`, error);
    }
  }
}, 60000); // Check every minute
```

### 2. Performance Monitoring

```typescript
// Monitor processing performance
const monitorPerformance = async () => {
  const startTime = Date.now();

  try {
    await liveDataService.processLiveTickData(tickData);
    const duration = Date.now() - startTime;

    if (duration > 1000) {
      // More than 1 second
      console.warn(`Slow processing: ${duration}ms`);
    }
  } catch (error) {
    console.error("Processing failed:", error);
  }
};
```

## 🔄 Integration with Existing System

### 1. Replace Old Market Data Service

```typescript
// Old way
import { MarketDataService } from "../services/market-data.service";
const marketDataService = new MarketDataService();

// New way
import { EnhancedMarketDataService } from "../services/enhanced-market-data.service";
const marketDataService = new EnhancedMarketDataService();
```

### 2. Update Trading Strategies

```typescript
// Old strategy
class OldStrategy {
  async generateSignals(symbol: string) {
    const data = await marketDataService.getLatestMarketData(symbol);
    // Process single timeframe data
  }
}

// New multi-timeframe strategy
class NewStrategy {
  async generateSignals(symbol: string) {
    const data = await marketDataService.getLatestMultiTimeframeData(symbol);
    // Process multiple timeframes
    const oneMinData = data["1min"];
    const fiveMinData = data["5min"];
    const fifteenMinData = data["15min"];

    // Generate signals based on multi-timeframe analysis
  }
}
```

## 🧪 Testing Live Integration

### 1. Test Script

```typescript
// src/test-live-integration.ts
import { LiveDataIntegrationService } from "../services/live-data-integration.service";

async function testLiveIntegration() {
  const liveDataService = new LiveDataIntegrationService();

  // Test with simulated data
  const testTick = {
    instrument_token: 256265,
    tradingsymbol: "NIFTY",
    last_price: 19500.5,
    volume: 1000,
    timestamp: Date.now(),
  };

  await liveDataService.processLiveTickData(testTick);

  // Verify data was processed
  const data = await liveDataService.getRealTimeMultiTimeframeData("NIFTY");
  console.log("Processed data:", data);
}

testLiveIntegration().catch(console.error);
```

### 2. Run Tests

```bash
# Run live integration tests
npm run test:live-integration

# Run with real Zerodha connection
npm run test:live-zerodha
```

## 📋 Best Practices

### 1. **Data Validation**

Always validate incoming live data before processing.

### 2. **Error Handling**

Implement robust error handling and retry logic.

### 3. **Performance Monitoring**

Monitor processing times and database performance.

### 4. **Data Quality**

Regularly check for data gaps and quality issues.

### 5. **Backup Strategy**

Have fallback data sources for critical instruments.

## 🎉 Conclusion

The live data integration system provides seamless real-time processing of market data across all timeframes. It automatically handles data aggregation, quality monitoring, and provides comprehensive APIs for real-time trading strategies.

The system is designed to be robust, scalable, and easy to integrate with existing trading systems.
