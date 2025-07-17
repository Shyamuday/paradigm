# Order Management Implementation Guide

## Overview

The order management system handles trade execution, position tracking, and P&L calculations.

## Implementation Details

### 1. Order Service

```typescript
// src/services/order.service.ts
export class OrderService {
  private broker: ZerodhaBroker;
  private riskService: RiskService;
  private positionManager: PositionManager;

  async createTrade(
    sessionId: string,
    signal: TradeSignal,
    strategyId?: string
  ): Promise<Trade> {
    const riskChecks = await this.riskService.validateTrade(signal);
    if (!riskChecks.isValid) {
      throw new Error(riskChecks.reason);
    }

    const order = await this.broker.placeOrder({
      symbol: signal.symbol,
      quantity: signal.quantity,
      type: signal.type,
      price: signal.price,
      stopLoss: signal.stopLoss,
      target: signal.target,
    });

    return await this.saveTrade({
      sessionId,
      strategyId,
      orderId: order.id,
      ...signal,
    });
  }

  async updateTradeStatus(
    tradeId: string,
    status: string,
    orderId?: string
  ): Promise<void> {
    const trade = await this.getTrade(tradeId);

    if (status === "COMPLETE") {
      await this.positionManager.createPosition(trade);
    }

    await prisma.trade.update({
      where: { id: tradeId },
      data: {
        status,
        orderId,
        executionTime: status === "COMPLETE" ? new Date() : null,
      },
    });
  }
}
```

### 2. Position Management

```typescript
// src/services/position.service.ts
export class PositionManager {
  async createPosition(trade: Trade): Promise<Position> {
    return await prisma.position.create({
      data: {
        sessionId: trade.sessionId,
        instrumentId: trade.instrumentId,
        tradeId: trade.id,
        quantity: trade.quantity,
        averagePrice: trade.price,
        side: trade.action === "BUY" ? "LONG" : "SHORT",
        stopLoss: trade.stopLoss,
        target: trade.target,
        trailingStop: trade.trailingStop,
      },
    });
  }

  async updatePosition(
    positionId: string,
    data: Partial<Position>
  ): Promise<void> {
    await prisma.position.update({
      where: { id: positionId },
      data,
    });
  }

  async closePosition(positionId: string, closePrice: number): Promise<void> {
    const position = await this.getPosition(positionId);
    const pnl = this.calculatePositionPnL(position, closePrice);

    await prisma.position.update({
      where: { id: positionId },
      data: {
        closeTime: new Date(),
        realizedPnL: pnl,
      },
    });
  }
}
```

### 3. P&L Calculation

```typescript
// src/services/pnl.service.ts
export class PnLService {
  calculatePositionPnL(position: Position, currentPrice: number): number {
    const multiplier = position.side === "LONG" ? 1 : -1;
    const priceDiff = (currentPrice - position.averagePrice) * multiplier;
    return priceDiff * position.quantity;
  }

  async calculateSessionPnL(sessionId: string): Promise<PnLMetrics> {
    const positions = await this.getSessionPositions(sessionId);

    let realizedPnL = 0;
    let unrealizedPnL = 0;

    for (const position of positions) {
      if (position.closeTime) {
        realizedPnL += position.realizedPnL;
      } else {
        unrealizedPnL += position.unrealizedPnL;
      }
    }

    return {
      realizedPnL,
      unrealizedPnL,
      totalPnL: realizedPnL + unrealizedPnL,
    };
  }
}
```

### 4. Transaction Cost Calculation

```typescript
// src/services/transaction-cost.service.ts
export class TransactionCostService {
  async calculateTradeCosts(trade: Trade): Promise<TransactionCost> {
    const brokeragePlan = await this.getBrokeragePlan();
    const tradeValue = trade.quantity * trade.price;

    const brokerage = this.calculateBrokerage(
      tradeValue,
      trade.instrumentType,
      brokeragePlan
    );

    const stt = this.calculateSTT(tradeValue, trade.instrumentType);
    const exchangeFee = this.calculateExchangeFee(tradeValue);
    const gst = this.calculateGST(brokerage + exchangeFee);
    const stampDuty = this.calculateStampDuty(tradeValue);

    const totalCost = brokerage + stt + exchangeFee + gst + stampDuty;

    return {
      tradeId: trade.id,
      brokerage,
      stt,
      exchangeFee,
      gst,
      stampDuty,
      totalCost,
      costPercentage: (totalCost / tradeValue) * 100,
    };
  }

  private calculateBrokerage(
    value: number,
    type: string,
    plan: BrokeragePlan
  ): number {
    switch (type) {
      case "EQ":
        return Math.min(value * plan.equityDelivery, plan.maxBrokerage);
      case "FUT":
        return Math.min(value * plan.equityFutures, plan.maxBrokerage);
      // Handle other instrument types
    }
  }
}
```

### 5. Order Monitoring

```typescript
// src/services/order-monitor.service.ts
export class OrderMonitorService {
  private pendingOrders: Map<string, OrderStatus> = new Map();

  async startMonitoring(orderId: string): Promise<void> {
    this.pendingOrders.set(orderId, {
      status: "PENDING",
      attempts: 0,
      lastCheck: Date.now(),
    });

    await this.monitorOrder(orderId);
  }

  private async monitorOrder(orderId: string): Promise<void> {
    const maxAttempts = 10;
    const checkInterval = 2000; // 2 seconds

    while (this.shouldContinueMonitoring(orderId, maxAttempts)) {
      const status = await this.broker.getOrderStatus(orderId);
      await this.updateOrderStatus(orderId, status);

      if (this.isOrderComplete(status)) {
        this.pendingOrders.delete(orderId);
        break;
      }

      await this.sleep(checkInterval);
    }
  }

  private async handleOrderTimeout(orderId: string): Promise<void> {
    await this.broker.cancelOrder(orderId);
    await this.orderService.updateTradeStatus(orderId, "TIMEOUT");
  }
}
```

## Database Schema

```prisma
model Trade {
  id           String   @id @default(cuid())
  sessionId    String
  session      TradingSession @relation(fields: [sessionId], references: [id])
  instrumentId String
  instrument   Instrument @relation(fields: [instrumentId], references: [id])
  strategyId   String?
  strategy     Strategy? @relation(fields: [strategyId], references: [id])

  action       String   // BUY, SELL
  quantity     Int
  price        Float
  orderType    String   // MARKET, LIMIT, SL, SL-M
  orderId      String?  // Broker order ID
  status       String   // PENDING, COMPLETE, CANCELLED, REJECTED

  stopLoss     Float?
  target       Float?
  trailingStop Boolean  @default(false)

  orderTime    DateTime @default(now())
  executionTime DateTime?

  realizedPnL  Float?
  unrealizedPnL Float?

  positions    Position[]
  transactionCost TransactionCost?
}
```

## Usage Examples

### 1. Create Trade

```typescript
const orderService = new OrderService(broker, riskService);

const trade = await orderService.createTrade({
  sessionId: "session123",
  symbol: "NIFTY50",
  quantity: 50,
  price: 21500,
  type: "MARKET",
  stopLoss: 21400,
  target: 21700,
  trailingStop: true,
});
```

### 2. Position Management

```typescript
const positionManager = new PositionManager();

// Create position
await positionManager.createPosition(trade);

// Update stop-loss
await positionManager.updatePosition(positionId, {
  stopLoss: newStopLoss,
});

// Close position
await positionManager.closePosition(positionId, closePrice);
```

### 3. Calculate P&L

```typescript
const pnlService = new PnLService();

// Position P&L
const pnl = pnlService.calculatePositionPnL(position, currentPrice);

// Session P&L
const sessionPnL = await pnlService.calculateSessionPnL(sessionId);
```

## Error Handling

1. **Order Placement**

   - Network failures
   - Insufficient funds
   - Invalid parameters

2. **Order Status**

   - Timeout handling
   - Partial fills
   - Rejection handling

3. **Position Updates**
   - Data consistency
   - Concurrent updates
   - Market data delays

## Performance Optimization

1. **Order Processing**

   - Queue management
   - Batch updates
   - Status caching

2. **Position Tracking**

   - Real-time updates
   - Memory optimization
   - Database indexing

3. **Cost Calculation**
   - Cached brokerage plans
   - Batch processing
   - Asynchronous updates

## Monitoring

1. **Order Metrics**

   - Fill rates
   - Execution time
   - Rejection rates

2. **Position Metrics**

   - Open interest
   - Duration
   - P&L distribution

3. **Cost Analysis**
   - Transaction cost impact
   - Cost optimization
   - Broker comparison
