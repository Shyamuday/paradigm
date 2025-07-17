# Market Data Implementation Guide

## Overview

The market data system handles real-time data streaming, historical data management, and technical analysis calculations.

## Implementation Details

### 1. Market Data Service

```typescript
// src/services/market-data.service.ts
export class MarketDataService {
  private websocket: WebSocket;
  private subscriptions: Map<string, Set<string>> = new Map();

  async initialize(): Promise<void> {
    this.websocket = new WebSocket(process.env.ZERODHA_WS_URL);
    this.setupWebSocketHandlers();
    await this.connectWebSocket();
  }

  async subscribeInstrument(symbol: string, modes: string[]): Promise<void> {
    const instrument = await this.getInstrumentDetails(symbol);
    this.subscriptions.set(instrument.id, new Set(modes));
    await this.sendSubscriptionMessage(instrument.id, modes);
  }

  private async processTickData(data: TickData): Promise<void> {
    await prisma.marketData.create({
      data: {
        instrumentId: data.instrumentId,
        timestamp: new Date(data.timestamp),
        ltp: data.lastPrice,
        volume: data.volume,
        change: data.change,
        changePercent: data.changePercent,
      },
    });
    this.emitTickData(data);
  }
}
```

### 2. Historical Data Management

```typescript
// src/services/market-data.service.ts
export class HistoricalDataManager {
  async fetchHistoricalData(
    symbol: string,
    from: Date,
    to: Date,
    interval: string
  ): Promise<CandleData[]> {
    const response = await axios.get(
      `${process.env.ZERODHA_API_URL}/instruments/historical/${symbol}/${interval}`,
      {
        params: { from, to },
        headers: this.getAuthHeaders(),
      }
    );
    return this.processCandleData(response.data);
  }

  async saveCandleData(candles: CandleData[]): Promise<void> {
    await prisma.marketData.createMany({
      data: candles.map((candle) => ({
        instrumentId: candle.instrumentId,
        timestamp: new Date(candle.timestamp),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      })),
    });
  }
}
```

### 3. Technical Analysis Engine

```typescript
// src/services/technical-analysis.service.ts
export class TechnicalAnalysisEngine {
  calculateSMA(data: number[], period: number): number[] {
    const sma: number[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  calculateEMA(data: number[], period: number): number[] {
    const multiplier = 2 / (period + 1);
    const ema: number[] = [data[0]];

    for (let i = 1; i < data.length; i++) {
      ema.push((data[i] - ema[i - 1]) * multiplier + ema[i - 1]);
    }
    return ema;
  }

  calculateRSI(data: number[], period: number = 14): number[] {
    const gains: number[] = [];
    const losses: number[] = [];
    const rsi: number[] = [];

    // Implementation details...

    return rsi;
  }
}
```

### 4. Data Transformation

```typescript
// src/services/market-data.service.ts
export class DataTransformer {
  transformTickToCandle(ticks: TickData[], interval: number): CandleData[] {
    const candles: CandleData[] = [];
    let currentCandle: Partial<CandleData> = {};

    for (const tick of ticks) {
      if (this.shouldStartNewCandle(tick.timestamp, interval)) {
        if (currentCandle.open) {
          candles.push(this.finalizeCandle(currentCandle));
        }
        currentCandle = this.initializeCandle(tick);
      }
      this.updateCandle(currentCandle, tick);
    }

    return candles;
  }

  private shouldStartNewCandle(timestamp: number, interval: number): boolean {
    return timestamp % (interval * 60 * 1000) === 0;
  }
}
```

### 5. Market Data Storage

```typescript
// prisma/schema.prisma
model MarketData {
  id           String   @id @default(cuid())
  instrumentId String
  instrument   Instrument @relation(fields: [instrumentId], references: [id])
  timestamp    DateTime
  open         Float?
  high         Float?
  low          Float?
  close        Float?
  volume       Int?
  ltp          Float?
  change       Float?
  changePercent Float?

  @@unique([instrumentId, timestamp])
}
```

## WebSocket Implementation

### 1. Connection Management

```typescript
export class WebSocketManager {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  private async connectWebSocket(): Promise<void> {
    try {
      await this.websocket.connect();
      this.reconnectAttempts = 0;
      this.setupHeartbeat();
    } catch (error) {
      await this.handleConnectionError(error);
    }
  }

  private async handleConnectionError(error: any): Promise<void> {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      await this.reconnectWithBackoff();
    } else {
      throw new Error("Failed to establish WebSocket connection");
    }
  }
}
```

### 2. Message Handling

```typescript
export class MessageHandler {
  handleMessage(data: WebSocket.Data): void {
    try {
      const message = this.parseMessage(data);
      switch (message.type) {
        case "tick":
          this.handleTickData(message.data);
          break;
        case "order":
          this.handleOrderUpdate(message.data);
          break;
        case "error":
          this.handleError(message.data);
          break;
      }
    } catch (error) {
      this.handleMessageError(error);
    }
  }
}
```

## Usage Examples

### 1. Subscribe to Market Data

```typescript
const marketData = new MarketDataService();
await marketData.subscribeInstrument("NIFTY50", ["tick", "quote"]);

marketData.on("tick", (data: TickData) => {
  console.log(`${data.symbol}: ${data.lastPrice}`);
});
```

### 2. Fetch Historical Data

```typescript
const historical = new HistoricalDataManager();
const data = await historical.fetchHistoricalData(
  "NIFTY50",
  new Date("2024-01-01"),
  new Date("2024-01-31"),
  "1D"
);
```

### 3. Calculate Technical Indicators

```typescript
const ta = new TechnicalAnalysisEngine();
const closePrices = data.map((d) => d.close);

const sma20 = ta.calculateSMA(closePrices, 20);
const ema50 = ta.calculateEMA(closePrices, 50);
const rsi = ta.calculateRSI(closePrices);
```

## Error Handling

1. **Connection Errors**

   - Network issues
   - Authentication failures
   - Reconnection logic

2. **Data Errors**

   - Invalid tick data
   - Missing fields
   - Data type mismatches

3. **Processing Errors**
   - Calculation errors
   - Storage failures
   - Transformation issues

## Performance Optimization

1. **Data Storage**

   - Batch inserts
   - Index optimization
   - Data archival

2. **Memory Management**

   - Streaming processing
   - Buffer management
   - Garbage collection

3. **Network Optimization**
   - Connection pooling
   - Data compression
   - Request batching

## Monitoring

1. **Data Quality**

   - Missing ticks
   - Price gaps
   - Volume anomalies

2. **System Health**

   - WebSocket status
   - Processing latency
   - Storage metrics

3. **Resource Usage**
   - Memory consumption
   - CPU utilization
   - Network bandwidth
