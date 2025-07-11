# Risk Management Implementation Guide

## Overview

The risk management system handles position sizing, stop-loss calculation, exposure limits, and portfolio risk metrics.

## Implementation Details

### 1. Risk Service

```typescript
// src/services/risk.service.ts
export class RiskService {
  private config: RiskConfig;
  private marketData: MarketDataService;

  async validateTrade(signal: TradeSignal): Promise<RiskValidation> {
    const checks = await Promise.all([
      this.checkDailyLossLimit(),
      this.checkExposureLimit(),
      this.checkPositionLimit(),
      this.checkMarginRequirement(signal),
    ]);

    const failedChecks = checks.filter((check) => !check.isValid);
    return {
      isValid: failedChecks.length === 0,
      reason: failedChecks.map((check) => check.reason).join(", "),
    };
  }

  async calculatePositionSize(
    signal: TradeSignal,
    capital: number
  ): Promise<number> {
    const riskProfile = await this.getRiskProfile();
    const stopLoss = await this.calculateStopLoss(signal);
    const riskAmount = capital * riskProfile.riskPerTrade;

    const positionSize = Math.floor(
      riskAmount / Math.abs(signal.price - stopLoss)
    );

    return Math.min(positionSize, this.getMaxPositionSize(capital));
  }

  private async checkDailyLossLimit(): Promise<RiskCheck> {
    const dailyPnL = await this.calculateDailyPnL();
    const maxLoss = this.config.maxDailyLoss;

    return {
      isValid: dailyPnL > -maxLoss,
      reason: `Daily loss limit of ${maxLoss} breached`,
    };
  }
}
```

### 2. Stop Loss Management

```typescript
// src/services/risk.service.ts
export class StopLossManager {
  async calculateStopLoss(signal: TradeSignal): Promise<number> {
    const atr = await this.calculateATR(signal.symbol);
    const volatilityMultiplier = this.getVolatilityMultiplier(
      signal.confidence
    );

    return signal.type === "LONG"
      ? signal.price - atr * volatilityMultiplier
      : signal.price + atr * volatilityMultiplier;
  }

  async updateTrailingStop(
    position: Position,
    currentPrice: number
  ): Promise<number> {
    const atr = await this.calculateATR(position.symbol);
    const trailDistance = atr * this.config.trailMultiplier;

    if (position.side === "LONG") {
      const newStop = currentPrice - trailDistance;
      return Math.max(position.stopLoss, newStop);
    } else {
      const newStop = currentPrice + trailDistance;
      return Math.min(position.stopLoss, newStop);
    }
  }

  private async calculateATR(
    symbol: string,
    period: number = 14
  ): Promise<number> {
    const data = await this.marketData.getHistoricalData(symbol, period + 1);

    const trueRanges = data.map((candle, i) => {
      if (i === 0) return candle.high - candle.low;

      return Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - data[i - 1].close),
        Math.abs(candle.low - data[i - 1].close)
      );
    });

    return this.calculateEMA(trueRanges, period);
  }
}
```

### 3. Portfolio Risk Management

```typescript
// src/services/portfolio-risk.service.ts
export class PortfolioRiskManager {
  async calculatePortfolioRisk(): Promise<PortfolioRisk> {
    const positions = await this.getOpenPositions();
    const exposures = await this.calculateExposures(positions);

    return {
      totalExposure: this.sumExposures(exposures),
      sectorExposures: this.groupBySector(exposures),
      instrumentExposures: this.groupByInstrument(exposures),
      var: this.calculateVaR(positions),
      sharpeRatio: await this.calculateSharpeRatio(positions),
    };
  }

  async calculateVaR(
    positions: Position[],
    confidence: number = 0.95
  ): Promise<number> {
    const returns = await this.getHistoricalReturns(positions);
    const sortedReturns = returns.sort((a, b) => a - b);
    const varIndex = Math.floor(returns.length * (1 - confidence));
    return sortedReturns[varIndex];
  }

  async calculateSharpeRatio(positions: Position[]): Promise<number> {
    const returns = await this.getHistoricalReturns(positions);
    const riskFreeRate = this.config.riskFreeRate;

    const meanReturn = this.calculateMean(returns);
    const stdDev = this.calculateStdDev(returns);

    return (meanReturn - riskFreeRate) / stdDev;
  }
}
```

### 4. Risk Metrics Calculation

```typescript
// src/services/risk-metrics.service.ts
export class RiskMetricsService {
  async calculateMetrics(sessionId: string): Promise<RiskMetrics> {
    const trades = await this.getSessionTrades(sessionId);
    const positions = await this.getSessionPositions(sessionId);

    return {
      dailyPnL: this.calculateDailyPnL(trades, positions),
      drawdown: this.calculateDrawdown(trades),
      currentRisk: await this.calculateCurrentRisk(positions),
      var: await this.calculateVaR(positions),
      sharpeRatio: this.calculateSharpeRatio(trades),
      maxDrawdown: this.calculateMaxDrawdown(trades),
      winRate: this.calculateWinRate(trades),
      profitFactor: this.calculateProfitFactor(trades),
    };
  }

  private calculateDrawdown(trades: Trade[]): number {
    let peak = 0;
    let currentDrawdown = 0;
    let balance = 0;

    for (const trade of trades) {
      balance += trade.realizedPnL;
      peak = Math.max(peak, balance);
      currentDrawdown = Math.min(currentDrawdown, balance - peak);
    }

    return currentDrawdown;
  }

  private calculateWinRate(trades: Trade[]): number {
    const winningTrades = trades.filter((t) => t.realizedPnL > 0);
    return (winningTrades.length / trades.length) * 100;
  }
}
```

### 5. Risk Profile Management

```typescript
// src/services/risk-profile.service.ts
export class RiskProfileService {
  async updateRiskProfile(userId: string, profile: RiskProfile): Promise<void> {
    await this.validateRiskProfile(profile);

    await prisma.riskProfile.upsert({
      where: { userId },
      update: profile,
      create: {
        userId,
        ...profile,
      },
    });
  }

  async validateRiskProfile(profile: RiskProfile): Promise<void> {
    if (profile.maxDailyLoss > profile.maxDrawdown) {
      throw new Error("Daily loss limit cannot exceed max drawdown");
    }

    if (profile.riskPerTrade > profile.maxPositionSize) {
      throw new Error("Risk per trade cannot exceed max position size");
    }

    // Additional validations...
  }
}
```

## Database Schema

```prisma
model RiskProfile {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])
  maxDailyLoss    Float    // Maximum daily loss allowed
  maxDrawdown     Float    // Maximum portfolio drawdown
  maxPositionSize Float    // Maximum position size as percentage
  riskPerTrade    Float    // Risk per trade as percentage
  maxOpenTrades   Int      @default(10)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model RiskMetrics {
  id              String   @id @default(cuid())
  sessionId       String
  session         TradingSession @relation(fields: [sessionId], references: [id])
  date            DateTime @db.Date
  dailyPnL        Float
  drawdown        Float
  currentRisk     Float
  var             Float?
  sharpeRatio     Float?
  maxDrawdown     Float
  winRate         Float
  profitFactor    Float
}
```

## Usage Examples

### 1. Risk Validation

```typescript
const riskService = new RiskService(config);

// Before trade
const validation = await riskService.validateTrade(signal);
if (!validation.isValid) {
  console.error(`Trade rejected: ${validation.reason}`);
  return;
}
```

### 2. Position Sizing

```typescript
// Calculate position size
const size = await riskService.calculatePositionSize(signal, capital);

// Calculate stop-loss
const stopLoss = await riskService.calculateStopLoss(signal);

// Update trailing stop
await riskService.updateTrailingStop(position, currentPrice);
```

### 3. Risk Metrics

```typescript
const metrics = await riskMetricsService.calculateMetrics(sessionId);

console.log(`
Daily P&L: ${metrics.dailyPnL}
Current Drawdown: ${metrics.drawdown}
VaR (95%): ${metrics.var}
Sharpe Ratio: ${metrics.sharpeRatio}
`);
```

## Error Handling

1. **Validation Errors**

   - Invalid parameters
   - Limit breaches
   - Profile conflicts

2. **Calculation Errors**

   - Insufficient data
   - Market data gaps
   - Numerical errors

3. **Update Errors**
   - Profile updates
   - Metric calculations
   - Stop-loss adjustments

## Performance Optimization

1. **Calculation Optimization**

   - Cached metrics
   - Incremental updates
   - Parallel processing

2. **Data Management**

   - Efficient storage
   - Query optimization
   - Memory usage

3. **Real-time Processing**
   - Stream processing
   - Event handling
   - Update batching

## Monitoring

1. **Risk Limits**

   - Exposure tracking
   - Loss monitoring
   - Limit breaches

2. **Performance Metrics**

   - Risk-adjusted returns
   - Portfolio metrics
   - Trading efficiency

3. **System Health**
   - Calculation speed
   - Data accuracy
   - Update frequency
