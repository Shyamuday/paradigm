# Portfolio Management Implementation Guide

## Overview

The portfolio management system handles portfolio allocation, rebalancing, diversification, and performance tracking.

## Implementation Details

### 1. Portfolio Manager

```typescript
// src/services/portfolio.service.ts
export class PortfolioManager {
  async getPortfolioSnapshot(sessionId: string): Promise<PortfolioSnapshot> {
    const positions = await this.getOpenPositions(sessionId);
    const capital = await this.getAvailableCapital(sessionId);

    return {
      totalValue: this.calculateTotalValue(positions),
      allocations: this.calculateAllocations(positions),
      exposure: this.calculateExposure(positions, capital),
      metrics: await this.calculateMetrics(sessionId),
      risk: await this.calculateRiskMetrics(positions),
    };
  }

  private calculateAllocations(positions: Position[]): Allocation[] {
    const totalValue = this.calculateTotalValue(positions);

    return positions.map((position) => ({
      symbol: position.symbol,
      value: position.value,
      percentage: (position.value / totalValue) * 100,
      sector: position.instrument.sector,
      type: position.instrument.type,
    }));
  }

  private async calculateRiskMetrics(
    positions: Position[]
  ): Promise<RiskMetrics> {
    return {
      beta: await this.calculatePortfolioBeta(positions),
      correlation: await this.calculateCorrelations(positions),
      var: this.calculateValueAtRisk(positions),
      sectorExposure: this.calculateSectorExposure(positions),
      concentration: this.calculateConcentration(positions),
    };
  }
}
```

### 2. Portfolio Rebalancing

```typescript
// src/services/portfolio.service.ts
export class PortfolioRebalancer {
  async checkRebalanceNeeded(sessionId: string): Promise<RebalanceCheck> {
    const portfolio = await this.getPortfolioSnapshot(sessionId);
    const thresholds = await this.getRebalanceThresholds(sessionId);

    const deviations = this.calculateDeviations(
      portfolio.allocations,
      thresholds.targetAllocations
    );

    return {
      needsRebalance: this.checkThresholds(deviations, thresholds),
      deviations,
      recommendations: this.generateRebalanceOrders(deviations, portfolio),
    };
  }

  async rebalancePortfolio(
    sessionId: string,
    mode: "automatic" | "manual"
  ): Promise<RebalanceResult> {
    const check = await this.checkRebalanceNeeded(sessionId);

    if (!check.needsRebalance) {
      return { status: "NO_ACTION_NEEDED" };
    }

    if (mode === "automatic") {
      return this.executeRebalance(sessionId, check.recommendations);
    }

    return {
      status: "PENDING_APPROVAL",
      recommendations: check.recommendations,
    };
  }

  private generateRebalanceOrders(
    deviations: Deviation[],
    portfolio: PortfolioSnapshot
  ): RebalanceOrder[] {
    return deviations
      .filter((d) => Math.abs(d.deviation) > 1.0)
      .map((d) => ({
        symbol: d.symbol,
        action: d.deviation > 0 ? "SELL" : "BUY",
        quantity: this.calculateAdjustmentQuantity(d, portfolio),
        expectedValue: this.calculateExpectedValue(d),
      }));
  }
}
```

### 3. Performance Tracking

```typescript
// src/services/portfolio.service.ts
export class PerformanceTracker {
  async trackPerformance(
    sessionId: string,
    timeframe: Timeframe
  ): Promise<PerformanceMetrics> {
    const trades = await this.getTradesInTimeframe(sessionId, timeframe);

    const positions = await this.getPositionsHistory(sessionId, timeframe);

    return {
      returns: this.calculateReturns(trades, positions),
      metrics: this.calculatePerformanceMetrics(trades),
      attribution: await this.calculateAttribution(trades),
      drawdown: this.calculateDrawdown(positions),
    };
  }

  private calculateReturns(trades: Trade[], positions: Position[]): Returns {
    return {
      totalReturn: this.calculateTotalReturn(trades),
      dailyReturns: this.calculateDailyReturns(positions),
      annualizedReturn: this.calculateAnnualizedReturn(trades),
      riskAdjustedReturn: this.calculateSharpeRatio(trades),
    };
  }

  private async calculateAttribution(trades: Trade[]): Promise<Attribution> {
    return {
      byStrategy: this.attributeByStrategy(trades),
      bySector: this.attributeBySector(trades),
      byInstrumentType: this.attributeByType(trades),
      byTimeOfDay: this.attributeByTime(trades),
    };
  }
}
```

## Database Schema

```prisma
model Portfolio {
  id            String   @id @default(cuid())
  sessionId     String   @unique
  session       TradingSession @relation(fields: [sessionId], references: [id])
  name          String
  description   String?
  type          String   // 'AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'
  targetRisk    Float
  rebalanceFreq String   // 'DAILY', 'WEEKLY', 'MONTHLY'
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  allocations   PortfolioAllocation[]
  rebalances    PortfolioRebalance[]
  performance   PerformanceSnapshot[]
}

model PortfolioAllocation {
  id            String   @id @default(cuid())
  portfolioId   String
  portfolio     Portfolio @relation(fields: [portfolioId], references: [id])
  instrumentId  String
  instrument    Instrument @relation(fields: [instrumentId], references: [id])
  targetWeight  Float
  minWeight     Float
  maxWeight     Float
  currentWeight Float
  lastRebalance DateTime?
}

model PortfolioRebalance {
  id            String   @id @default(cuid())
  portfolioId   String
  portfolio     Portfolio @relation(fields: [portfolioId], references: [id])
  timestamp     DateTime @default(now())
  type          String   // 'SCHEDULED', 'THRESHOLD', 'MANUAL'
  oldAllocations Json
  newAllocations Json
  trades        Trade[]
  status        String   // 'PENDING', 'COMPLETED', 'FAILED'
  metrics       Json?    // Performance impact metrics
}

model PerformanceSnapshot {
  id            String   @id @default(cuid())
  portfolioId   String
  portfolio     Portfolio @relation(fields: [portfolioId], references: [id])
  timestamp     DateTime @default(now())
  totalValue    Float
  cashValue     Float
  returns       Json     // Daily, MTD, YTD returns
  metrics       Json     // Sharpe, Sortino, etc.
  allocations   Json     // Current allocations
  risk          Json     // Risk metrics
}
```

## Usage Examples

### 1. Portfolio Management

```typescript
const portfolioManager = new PortfolioManager();

// Get portfolio snapshot
const snapshot = await portfolioManager.getPortfolioSnapshot(sessionId);

console.log(`
Total Value: ${snapshot.totalValue}
Exposure: ${snapshot.exposure}%
Top Allocation: ${snapshot.allocations[0].symbol} (${snapshot.allocations[0].percentage}%)
`);
```

### 2. Portfolio Rebalancing

```typescript
const rebalancer = new PortfolioRebalancer();

// Check if rebalancing needed
const check = await rebalancer.checkRebalanceNeeded(sessionId);

if (check.needsRebalance) {
  // Execute rebalance
  const result = await rebalancer.rebalancePortfolio(sessionId, "automatic");

  console.log("Rebalance executed:", result.status);
}
```

### 3. Performance Analysis

```typescript
const tracker = new PerformanceTracker();

// Track performance
const performance = await tracker.trackPerformance(sessionId, {
  start: lastMonth,
  end: today,
});

console.log(`
Total Return: ${performance.returns.totalReturn}%
Sharpe Ratio: ${performance.metrics.sharpeRatio}
Max Drawdown: ${performance.drawdown.maximum}%
Best Strategy: ${performance.attribution.byStrategy[0].name}
`);
```

## Error Handling

1. **Portfolio Operations**

   - Invalid allocations
   - Insufficient funds
   - Position limits

2. **Rebalancing**

   - Market closure
   - Liquidity issues
   - Order failures

3. **Performance**
   - Data gaps
   - Calculation errors
   - Metric anomalies

## Performance Optimization

1. **Calculations**

   - Cached metrics
   - Incremental updates
   - Parallel processing

2. **Data Management**

   - Efficient storage
   - Query optimization
   - Data aggregation

3. **Rebalancing**
   - Smart order routing
   - Batch processing
   - Cost optimization

## Monitoring

1. **Portfolio Health**

   - Allocation drift
   - Risk exposure
   - Performance metrics

2. **Rebalancing**

   - Execution quality
   - Cost impact
   - Success rate

3. **System Performance**
   - Calculation time
   - Data accuracy
   - Resource usage
