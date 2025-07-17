# Backtesting Implementation Guide

## Overview

The backtesting system allows testing trading strategies against historical data with accurate simulation of execution, costs, and risk management.

## Implementation Details

### 1. Backtest Service

```typescript
// src/services/backtest.service.ts
export class BacktestService {
  private marketData: MarketDataService;
  private strategy: StrategyService;
  private riskService: RiskService;
  private transactionCostService: TransactionCostService;

  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    const { strategyId, startDate, endDate, initialCapital, instruments } =
      config;

    const historicalData = await this.fetchHistoricalData(
      instruments,
      startDate,
      endDate
    );

    const results = await this.simulateTrading(
      strategyId,
      historicalData,
      initialCapital
    );

    const metrics = this.calculateMetrics(results);
    return this.saveResults(metrics);
  }

  private async simulateTrading(
    strategyId: string,
    data: MarketData[],
    capital: number
  ): Promise<SimulationResult> {
    let currentCapital = capital;
    const trades: BacktestTrade[] = [];
    const positions = new Map<string, Position>();

    for (const candle of data) {
      // Generate signals
      const signals = await this.strategy.calculateSignals([candle]);

      // Process signals
      for (const signal of signals) {
        const positionSize = await this.calculatePositionSize(
          signal,
          currentCapital
        );

        if (positionSize > 0) {
          const trade = await this.executeTrade(signal, positionSize, candle);

          trades.push(trade);
          currentCapital += trade.pnl || 0;
        }
      }

      // Update positions
      await this.updatePositions(positions, candle);
    }

    return {
      trades,
      finalCapital: currentCapital,
    };
  }
}
```

### 2. Position Sizing and Risk Management

```typescript
// src/services/backtest.service.ts
export class BacktestRiskManager {
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

  async updatePositions(
    positions: Map<string, Position>,
    candle: MarketData
  ): Promise<void> {
    for (const [symbol, position] of positions) {
      // Update P&L
      position.unrealizedPnL = this.calculatePnL(position, candle.close);

      // Check stop-loss
      if (this.isStopLossHit(position, candle)) {
        await this.closePosition(position, candle);
        positions.delete(symbol);
      }

      // Update trailing stop
      if (position.trailingStop) {
        position.stopLoss = this.calculateTrailingStop(position, candle);
      }
    }
  }
}
```

### 3. Transaction Cost Calculation

```typescript
// src/services/backtest.service.ts
export class BacktestTransactionCost {
  calculateTradeCosts(trade: BacktestTrade): TransactionCost {
    const value = trade.quantity * trade.price;

    return {
      brokerage: this.calculateBrokerage(value, trade.type),
      stt: this.calculateSTT(value, trade.type),
      exchangeFee: this.calculateExchangeFee(value),
      gst: this.calculateGST(value),
      stampDuty: this.calculateStampDuty(value),
      totalCost: 0, // Sum of all costs
    };
  }

  private calculateBrokerage(value: number, type: string): number {
    switch (type) {
      case "EQUITY":
        return Math.min(value * 0.0003, 20);
      case "F&O":
        return Math.min(value * 0.0002, 20);
      default:
        return 0;
    }
  }
}
```

### 4. Performance Analytics

```typescript
// src/services/backtest.service.ts
export class BacktestAnalytics {
  calculateMetrics(
    trades: BacktestTrade[],
    initialCapital: number,
    finalCapital: number
  ): BacktestMetrics {
    return {
      totalReturn: this.calculateTotalReturn(initialCapital, finalCapital),
      annualReturn: this.calculateAnnualReturn(
        trades,
        initialCapital,
        finalCapital
      ),
      maxDrawdown: this.calculateMaxDrawdown(trades),
      sharpeRatio: this.calculateSharpeRatio(trades),
      sortinoRatio: this.calculateSortinoRatio(trades),
      calmarRatio: this.calculateCalmarRatio(trades),
      winRate: this.calculateWinRate(trades),
      profitFactor: this.calculateProfitFactor(trades),
      averageWin: this.calculateAverageWin(trades),
      averageLoss: this.calculateAverageLoss(trades),
      maxConsecutiveWins: this.calculateMaxConsecutiveWins(trades),
      maxConsecutiveLosses: this.calculateMaxConsecutiveLosses(trades),
    };
  }

  private calculateSharpeRatio(trades: BacktestTrade[]): number {
    const returns = this.calculateDailyReturns(trades);
    const riskFreeRate = 0.05; // 5% annual

    const meanReturn = this.calculateMean(returns);
    const stdDev = this.calculateStdDev(returns);

    return (meanReturn - riskFreeRate) / stdDev;
  }
}
```

### 5. Results Storage

```typescript
// src/services/backtest.service.ts
export class BacktestStorage {
  async saveResults(
    metrics: BacktestMetrics,
    trades: BacktestTrade[]
  ): Promise<BacktestResult> {
    const result = await prisma.backtestResult.create({
      data: {
        strategyId: metrics.strategyId,
        name: metrics.name,
        startDate: metrics.startDate,
        endDate: metrics.endDate,
        initialCapital: metrics.initialCapital,
        finalCapital: metrics.finalCapital,
        totalReturn: metrics.totalReturn,
        annualReturn: metrics.annualReturn,
        maxDrawdown: metrics.maxDrawdown,
        sharpeRatio: metrics.sharpeRatio,
        sortinoRatio: metrics.sortinoRatio,
        calmarRatio: metrics.calmarRatio,
        totalTrades: trades.length,
        winningTrades: metrics.winningTrades,
        losingTrades: metrics.losingTrades,
        winRate: metrics.winRate,
        profitFactor: metrics.profitFactor,
        averageWin: metrics.averageWin,
        averageLoss: metrics.averageLoss,
        largestWin: metrics.largestWin,
        largestLoss: metrics.largestLoss,
        consecutiveWins: metrics.maxConsecutiveWins,
        consecutiveLosses: metrics.maxConsecutiveLosses,
      },
    });

    await this.saveTrades(result.id, trades);
    return result;
  }
}
```

## Database Schema

```prisma
model BacktestResult {
  id              String   @id @default(cuid())
  strategyId      String
  strategy        Strategy @relation(fields: [strategyId], references: [id])
  name            String
  startDate       DateTime
  endDate         DateTime
  initialCapital  Float
  finalCapital    Float
  totalReturn     Float
  annualReturn    Float
  maxDrawdown     Float
  sharpeRatio     Float?
  sortinoRatio    Float?
  calmarRatio     Float?
  totalTrades     Int
  winningTrades   Int
  losingTrades    Int
  winRate         Float
  profitFactor    Float
  averageWin      Float
  averageLoss     Float
  largestWin      Float
  largestLoss     Float
  consecutiveWins Int
  consecutiveLosses Int

  trades          BacktestTrade[]
}

model BacktestTrade {
  id              String   @id @default(cuid())
  backtestId      String
  backtest        BacktestResult @relation(fields: [backtestId], references: [id])
  instrumentId    String
  instrument      Instrument @relation(fields: [instrumentId], references: [id])
  action          String   // BUY, SELL
  quantity        Int
  entryPrice      Float
  exitPrice       Float?
  pnl             Float?
  entryTime       DateTime
  exitTime        DateTime?
  holdingPeriod   Int?     // In minutes
}
```

## Usage Examples

### 1. Run Backtest

```typescript
const backtestService = new BacktestService();

const results = await backtestService.runBacktest({
  strategyId: "strategy123",
  startDate: new Date("2023-01-01"),
  endDate: new Date("2023-12-31"),
  initialCapital: 100000,
  instruments: ["NIFTY50", "BANKNIFTY"],
});
```

### 2. Analyze Results

```typescript
const analytics = new BacktestAnalytics();

const metrics = analytics.calculateMetrics(
  results.trades,
  results.initialCapital,
  results.finalCapital
);

console.log(`
Total Return: ${metrics.totalReturn}%
Sharpe Ratio: ${metrics.sharpeRatio}
Win Rate: ${metrics.winRate}%
Max Drawdown: ${metrics.maxDrawdown}%
`);
```

### 3. Compare Strategies

```typescript
const comparison = await backtestService.compareStrategies([
  {
    strategyId: "ma-crossover",
    parameters: { shortPeriod: 10, longPeriod: 20 },
  },
  {
    strategyId: "ma-crossover",
    parameters: { shortPeriod: 20, longPeriod: 50 },
  },
]);
```

## Error Handling

1. **Data Validation**

   - Missing data points
   - Invalid parameters
   - Date range errors

2. **Execution Errors**

   - Position sizing
   - Order simulation
   - Cost calculation

3. **Analysis Errors**
   - Metric calculation
   - Result storage
   - Data consistency

## Performance Optimization

1. **Data Processing**

   - Batch processing
   - Parallel execution
   - Memory management

2. **Calculation Efficiency**

   - Cached results
   - Optimized algorithms
   - Resource allocation

3. **Storage Optimization**
   - Indexed queries
   - Data compression
   - Result caching

## Monitoring

1. **Execution Metrics**

   - Processing time
   - Memory usage
   - CPU utilization

2. **Result Quality**

   - Data coverage
   - Metric accuracy
   - Error rates

3. **System Performance**
   - Database load
   - Cache efficiency
   - Resource usage
