# Trading Strategy Implementation Guide

## Overview

The strategy system implements trading algorithms with risk management, position sizing, and signal generation.

## Implementation Details

### 1. Strategy Base Class

```typescript
// src/services/strategy.service.ts
export abstract class BaseStrategy {
  protected config: StrategyConfig;
  protected marketData: MarketDataService;
  protected orderService: OrderService;
  protected riskService: RiskService;

  constructor(
    config: StrategyConfig,
    services: {
      marketData: MarketDataService;
      order: OrderService;
      risk: RiskService;
    }
  ) {
    this.config = config;
    this.marketData = services.marketData;
    this.orderService = services.order;
    this.riskService = services.risk;
  }

  abstract initialize(): Promise<void>;
  abstract onTick(data: TickData): Promise<void>;
  abstract onCandle(data: CandleData): Promise<void>;
  abstract calculateSignals(data: MarketData[]): Promise<TradeSignal[]>;
}
```

### 2. Moving Average Crossover Strategy

```typescript
// src/strategies/ma-crossover.strategy.ts
export class MovingAverageCrossoverStrategy extends BaseStrategy {
  private shortPeriod: number;
  private longPeriod: number;
  private volumeThreshold: number;

  async initialize(): Promise<void> {
    this.shortPeriod = this.config.parameters.shortPeriod;
    this.longPeriod = this.config.parameters.longPeriod;
    this.volumeThreshold = this.config.parameters.volumeThreshold;
  }

  async calculateSignals(data: MarketData[]): Promise<TradeSignal[]> {
    const closePrices = data.map((d) => d.close);
    const volumes = data.map((d) => d.volume);

    const shortMA = this.calculateSMA(closePrices, this.shortPeriod);
    const longMA = this.calculateSMA(closePrices, this.longPeriod);
    const signals: TradeSignal[] = [];

    for (let i = 1; i < shortMA.length; i++) {
      if (volumes[i] < this.volumeThreshold) continue;

      if (shortMA[i] > longMA[i] && shortMA[i - 1] <= longMA[i - 1]) {
        signals.push({
          type: "LONG",
          price: data[i].close,
          timestamp: data[i].timestamp,
          confidence: this.calculateConfidence(shortMA[i], longMA[i]),
        });
      } else if (shortMA[i] < longMA[i] && shortMA[i - 1] >= longMA[i - 1]) {
        signals.push({
          type: "SHORT",
          price: data[i].close,
          timestamp: data[i].timestamp,
          confidence: this.calculateConfidence(shortMA[i], longMA[i]),
        });
      }
    }

    return signals;
  }

  private calculateConfidence(shortMA: number, longMA: number): number {
    const diff = Math.abs(shortMA - longMA);
    const percentage = (diff / longMA) * 100;
    return Math.min(percentage * 2, 100); // Scale confidence
  }
}
```

### 3. Risk Management Integration

```typescript
// src/services/risk.service.ts
export class RiskService {
  async calculatePositionSize(
    signal: TradeSignal,
    capital: number
  ): Promise<number> {
    const riskProfile = await this.getRiskProfile();
    const riskPerTrade = capital * riskProfile.riskPerTrade;
    const stopLoss = await this.calculateStopLoss(signal);

    const positionSize = Math.floor(riskPerTrade / (signal.price - stopLoss));

    return Math.min(positionSize, this.calculateMaxPositionSize(capital));
  }

  async calculateStopLoss(signal: TradeSignal): Promise<number> {
    const atr = await this.calculateATR(signal.symbol);
    const multiplier = this.getATRMultiplier(signal.confidence);

    return signal.type === "LONG"
      ? signal.price - atr * multiplier
      : signal.price + atr * multiplier;
  }

  private calculateMaxPositionSize(capital: number): number {
    const riskProfile = await this.getRiskProfile();
    return Math.floor(capital * riskProfile.maxPositionSize);
  }
}
```

### 4. Signal Processing

```typescript
// src/services/strategy.service.ts
export class SignalProcessor {
  async processSignal(signal: TradeSignal): Promise<void> {
    const positionSize = await this.riskService.calculatePositionSize(
      signal,
      this.capital
    );

    if (positionSize <= 0) return;

    const stopLoss = await this.riskService.calculateStopLoss(signal);
    const target = this.calculateTarget(signal.price, stopLoss);

    await this.orderService.createTrade({
      type: signal.type,
      quantity: positionSize,
      price: signal.price,
      stopLoss,
      target,
      trailingStop: true,
    });
  }

  private calculateTarget(entryPrice: number, stopLoss: number): number {
    const risk = Math.abs(entryPrice - stopLoss);
    return entryPrice + risk * this.config.riskRewardRatio;
  }
}
```

### 5. Position Management

```typescript
// src/services/position.service.ts
export class PositionManager {
  async updatePositions(tick: TickData): Promise<void> {
    const positions = await this.getOpenPositions();

    for (const position of positions) {
      await this.updateStopLoss(position, tick);
      await this.checkStopLoss(position, tick);
      await this.checkTarget(position, tick);
      await this.updatePnL(position, tick);
    }
  }

  private async updateStopLoss(
    position: Position,
    tick: TickData
  ): Promise<void> {
    if (!position.trailingStop) return;

    const newStopLoss = this.calculateTrailingStop(position, tick.lastPrice);

    if (this.shouldUpdateStopLoss(position.stopLoss, newStopLoss)) {
      await this.updatePositionStopLoss(position.id, newStopLoss);
    }
  }
}
```

## Strategy Configuration

### 1. Strategy Parameters

```yaml
# config/trading-config.yaml
strategies:
  ma_crossover:
    enabled: true
    parameters:
      shortPeriod: 10
      longPeriod: 20
      volumeThreshold: 100000
      riskRewardRatio: 2
    capital_allocation: 0.3
    instruments:
      - NIFTY50
      - BANKNIFTY
```

### 2. Risk Parameters

```yaml
risk:
  maxDailyLoss: 5000
  maxDrawdown: 10000
  riskPerTrade: 0.02
  maxPositionSize: 0.1
  atrPeriod: 14
  atrMultiplier: 2
```

## Usage Examples

### 1. Initialize Strategy

```typescript
const strategy = new MovingAverageCrossoverStrategy(config, services);
await strategy.initialize();

strategy.on("signal", async (signal: TradeSignal) => {
  await signalProcessor.processSignal(signal);
});
```

### 2. Process Market Data

```typescript
marketData.on("tick", async (tick: TickData) => {
  await strategy.onTick(tick);
  await positionManager.updatePositions(tick);
});

marketData.on("candle", async (candle: CandleData) => {
  await strategy.onCandle(candle);
  const signals = await strategy.calculateSignals([candle]);
  await processSignals(signals);
});
```

### 3. Risk Management

```typescript
const riskService = new RiskService(config);

// Before trade
const positionSize = await riskService.calculatePositionSize(signal, capital);
const stopLoss = await riskService.calculateStopLoss(signal);

// During trade
await positionManager.updateStopLoss(position, tick);
```

## Performance Monitoring

### 1. Strategy Metrics

```typescript
export class StrategyMetrics {
  async calculateMetrics(strategyId: string, period: string): Promise<Metrics> {
    const trades = await this.getTrades(strategyId, period);

    return {
      totalTrades: trades.length,
      winRate: this.calculateWinRate(trades),
      profitFactor: this.calculateProfitFactor(trades),
      sharpeRatio: this.calculateSharpeRatio(trades),
      maxDrawdown: this.calculateMaxDrawdown(trades),
    };
  }
}
```

### 2. Risk Metrics

```typescript
export class RiskMetrics {
  async calculateExposure(): Promise<number> {
    const positions = await this.getOpenPositions();
    return positions.reduce(
      (total, pos) => total + Math.abs(pos.marketValue),
      0
    );
  }

  async checkRiskLimits(): Promise<RiskStatus> {
    const dailyPnL = await this.calculateDailyPnL();
    const exposure = await this.calculateExposure();

    return {
      dailyLossLimitBreached: dailyPnL < -this.config.maxDailyLoss,
      exposureLimitBreached: exposure > this.config.maxExposure,
    };
  }
}
```

## Error Handling

1. **Signal Generation**

   - Invalid data handling
   - Missing price points
   - Calculation errors

2. **Order Execution**

   - Rejection handling
   - Partial fills
   - Timeout management

3. **Position Management**
   - Update failures
   - Stop-loss triggers
   - Target hits

## Monitoring

1. **Strategy Performance**

   - Win rate
   - Profit factor
   - Drawdown

2. **Risk Metrics**

   - Exposure levels
   - Loss limits
   - Position sizes

3. **System Health**
   - Signal latency
   - Execution speed
   - Error rates
