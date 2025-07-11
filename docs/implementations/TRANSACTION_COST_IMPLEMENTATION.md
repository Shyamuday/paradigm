# Transaction Cost Implementation Guide

## Overview

The transaction cost service calculates and tracks various trading costs including brokerage, taxes, and exchange fees.

## Implementation Details

### 1. Transaction Cost Service

```typescript
// src/services/transaction-cost.service.ts
export class TransactionCostService {
  async calculateTradeCosts(
    trade: Trade,
    config: TradingConfig
  ): Promise<TransactionCost> {
    const value = trade.quantity * trade.price;

    const costs = {
      brokerage: this.calculateBrokerage(value, trade.type),
      stt: this.calculateSTT(value, trade.type),
      exchangeCharge: this.calculateExchangeCharge(value),
      gst: this.calculateGST(value),
      sebiCharges: this.calculateSEBICharges(value),
      stampDuty: this.calculateStampDuty(value, trade.type),
      dpCharges: this.calculateDPCharges(trade.type),
      totalCost: 0,
    };

    costs.totalCost = Object.values(costs).reduce(
      (sum, cost) => sum + (cost || 0),
      0
    );

    return costs;
  }

  private calculateBrokerage(value: number, type: string): number {
    switch (type) {
      case "EQUITY_INTRADAY":
        return Math.min(value * 0.0003, 20);
      case "EQUITY_DELIVERY":
        return Math.min(value * 0.0003, 20);
      case "FNO_FUTURES":
        return Math.min(value * 0.0002, 20);
      case "FNO_OPTIONS":
        return Math.min(40, 20);
      default:
        return 0;
    }
  }

  private calculateSTT(value: number, type: string): number {
    switch (type) {
      case "EQUITY_INTRADAY":
        return value * 0.00025;
      case "EQUITY_DELIVERY":
        return value * 0.001;
      case "FNO_FUTURES":
        return value * 0.0001;
      case "FNO_OPTIONS":
        return value * 0.0005;
      default:
        return 0;
    }
  }

  private calculateExchangeCharge(value: number): number {
    return value * 0.0000345;
  }

  private calculateGST(value: number): number {
    return value * 0.18;
  }

  private calculateSEBICharges(value: number): number {
    return value * 0.000001;
  }

  private calculateStampDuty(value: number, type: string): number {
    switch (type) {
      case "EQUITY_DELIVERY":
        return value * 0.00015;
      case "EQUITY_INTRADAY":
      case "FNO_FUTURES":
      case "FNO_OPTIONS":
        return value * 0.00002;
      default:
        return 0;
    }
  }

  private calculateDPCharges(type: string): number {
    return type === "EQUITY_DELIVERY" ? 13.5 : 0;
  }
}
```

### 2. Cost Tracking

```typescript
// src/services/transaction-cost.service.ts
export class CostTracker {
  async trackTradeCosts(
    tradeId: string,
    costs: TransactionCost
  ): Promise<void> {
    try {
      await db.tradeCost.create({
        data: {
          tradeId,
          brokerage: costs.brokerage,
          stt: costs.stt,
          exchangeCharge: costs.exchangeCharge,
          gst: costs.gst,
          sebiCharges: costs.sebiCharges,
          stampDuty: costs.stampDuty,
          dpCharges: costs.dpCharges,
          totalCost: costs.totalCost,
        },
      });

      logger.info("Trade costs tracked:", tradeId);
    } catch (error) {
      logger.error("Failed to track costs:", error);
      throw error;
    }
  }

  async getTradeCosts(tradeId: string): Promise<TransactionCost | null> {
    try {
      const costs = await db.tradeCost.findUnique({
        where: { tradeId },
      });

      return costs;
    } catch (error) {
      logger.error("Failed to get costs:", error);
      throw error;
    }
  }

  async getSessionCosts(sessionId: string): Promise<SessionCosts> {
    try {
      const costs = await db.tradeCost.aggregate({
        where: {
          trade: {
            sessionId,
          },
        },
        _sum: {
          brokerage: true,
          stt: true,
          exchangeCharge: true,
          gst: true,
          sebiCharges: true,
          stampDuty: true,
          dpCharges: true,
          totalCost: true,
        },
      });

      return costs._sum;
    } catch (error) {
      logger.error("Failed to get session costs:", error);
      throw error;
    }
  }
}
```

### 3. Cost Analysis

```typescript
// src/services/transaction-cost.service.ts
export class CostAnalyzer {
  async analyzeCosts(sessionId: string): Promise<CostAnalysis> {
    try {
      const trades = await db.trade.findMany({
        where: { sessionId },
        include: {
          costs: true,
        },
      });

      return {
        totalCosts: this.calculateTotalCosts(trades),
        costBreakdown: this.getCostBreakdown(trades),
        costMetrics: this.calculateCostMetrics(trades),
        recommendations: this.generateRecommendations(trades),
      };
    } catch (error) {
      logger.error("Failed to analyze costs:", error);
      throw error;
    }
  }

  private calculateCostMetrics(trades: Trade[]): CostMetrics {
    const totalValue = trades.reduce((sum, t) => sum + t.quantity * t.price, 0);

    const totalCosts = trades.reduce(
      (sum, t) => sum + (t.costs?.totalCost || 0),
      0
    );

    return {
      costToValueRatio: totalCosts / totalValue,
      averageCostPerTrade: totalCosts / trades.length,
      highestCostTrade: this.findHighestCostTrade(trades),
      lowestCostTrade: this.findLowestCostTrade(trades),
    };
  }

  private generateRecommendations(trades: Trade[]): CostRecommendation[] {
    const recommendations: CostRecommendation[] = [];
    const metrics = this.calculateCostMetrics(trades);

    if (metrics.costToValueRatio > 0.005) {
      recommendations.push({
        type: "HIGH_COST_RATIO",
        message: "Consider larger trade sizes to optimize cost ratio",
        impact: "HIGH",
      });
    }

    // Additional recommendations...
    return recommendations;
  }
}
```

## Database Schema

```prisma
model TradeCost {
  id            String   @id @default(cuid())
  tradeId       String   @unique
  trade         Trade    @relation(fields: [tradeId], references: [id])
  brokerage     Float
  stt           Float
  exchangeCharge Float
  gst           Float
  sebiCharges   Float
  stampDuty     Float
  dpCharges     Float
  totalCost     Float
  createdAt     DateTime @default(now())
}

model CostConfig {
  id            String   @id @default(cuid())
  brokerName    String   @unique
  equityIntraday Float
  equityDelivery Float
  fnoFutures    Float
  fnoOptions    Float
  sttRates      Json    // Stored as JSON object
  exchangeRates Json    // Stored as JSON object
  gstRate       Float
  sebiRate      Float
  stampDutyRates Json   // Stored as JSON object
  dpCharges     Float
  isActive      Boolean @default(true)
  updatedAt     DateTime @updatedAt
}
```

## Usage Examples

### 1. Calculate Trade Costs

```typescript
const costService = new TransactionCostService();

const costs = await costService.calculateTradeCosts({
  type: "EQUITY_DELIVERY",
  quantity: 100,
  price: 500,
  // ... other trade details
});

console.log(`
Brokerage: ${costs.brokerage}
STT: ${costs.stt}
Exchange: ${costs.exchangeCharge}
GST: ${costs.gst}
Total: ${costs.totalCost}
`);
```

### 2. Track Costs

```typescript
const costTracker = new CostTracker();

// Track trade costs
await costTracker.trackTradeCosts(tradeId, costs);

// Get session costs
const sessionCosts = await costTracker.getSessionCosts(sessionId);
```

### 3. Analyze Costs

```typescript
const analyzer = new CostAnalyzer();

const analysis = await analyzer.analyzeCosts(sessionId);

console.log(`
Cost/Value: ${analysis.costMetrics.costToValueRatio}
Avg Cost/Trade: ${analysis.costMetrics.averageCostPerTrade}
Recommendations: ${analysis.recommendations.length}
`);
```

## Error Handling

1. **Calculation Errors**

   - Invalid trade type
   - Zero/negative values
   - Missing parameters

2. **Tracking Errors**

   - Database failures
   - Duplicate entries
   - Data consistency

3. **Analysis Errors**
   - Insufficient data
   - Calculation errors
   - Invalid metrics

## Performance Optimization

1. **Cost Calculation**

   - Cached config
   - Batch processing
   - Optimized formulas

2. **Data Storage**

   - Indexed queries
   - Aggregation
   - Data pruning

3. **Analysis**
   - Parallel processing
   - Incremental updates
   - Result caching

## Monitoring

1. **Cost Metrics**

   - Cost ratios
   - Trade volumes
   - Cost trends

2. **System Health**

   - Calculation time
   - Storage usage
   - Error rates

3. **Data Quality**
   - Missing data
   - Anomalies
   - Consistency
