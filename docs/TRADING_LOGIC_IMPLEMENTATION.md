# Trading Logic Implementation Guide

## Overview

The trading logic implementation provides a complete automated trading system with sophisticated strategies, risk management, and real-time execution capabilities. This system integrates all the components we've built to provide a comprehensive trading solution.

## Architecture Components

### 1. Automated Trading Service (`AutomatedTradingService`)

- **Purpose**: Core service that orchestrates all trading activities
- **Features**:
  - Real-time market data processing
  - Strategy execution and signal generation
  - Order management and execution
  - Risk management and position monitoring
  - Portfolio management and P&L tracking
  - Event-driven architecture for real-time updates

### 2. Enhanced Strategies

- **Moving Average Strategy**: EMA crossover with volume confirmation
- **RSI Strategy**: Mean reversion with overbought/oversold signals
- **Breakout Strategy**: Support/resistance breakouts with volume confirmation
- **Enhanced Momentum Strategy**: Multi-indicator confluence strategy

### 3. Risk Management System

- **Stop Loss**: Dynamic, percentage-based, ATR-based
- **Take Profit**: Risk-reward ratios, partial exits
- **Position Sizing**: Risk-based, volatility-based, Kelly criterion
- **Portfolio Limits**: Max positions, daily loss limits, drawdown limits

### 4. Real-time Components

- **WebSocket Integration**: Live price streams
- **Order Management**: Real-time order execution and monitoring
- **Position Monitoring**: Continuous P&L tracking and exit conditions

## Quick Start Guide

### 1. Basic Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp env.example .env
# Edit .env with your Zerodha credentials and TOTP secret

# Run simple trading example
npm run trading:simple
```

### 2. Configuration

```typescript
const config: TradingConfig = {
  maxPositions: 3, // Maximum simultaneous positions
  maxRiskPerTrade: 1.5, // Maximum 1.5% risk per trade
  maxDailyLoss: 500, // Maximum daily loss in INR
  maxDrawdown: 5, // Maximum drawdown percentage
  autoExecute: false, // Start with simulation mode
  simulationMode: true, // Paper trading first
  allowedSymbols: ["RELIANCE", "TCS", "INFY"],
  tradingHours: {
    start: "09:15",
    end: "15:30",
  },
  riskManagement: {
    stopLoss: {
      type: "PERCENTAGE",
      value: 2,
      percentage: 2,
    },
    takeProfit: {
      type: "PERCENTAGE",
      value: 4,
      percentage: 4,
    },
    maxDrawdown: 5,
    maxDailyLoss: 500,
    maxOpenPositions: 3,
  },
};
```

## Available Scripts

### Trading Scripts

- `npm run trading:simple` - Run simple trading example (paper trading)
- `npm run trading:automated` - Run full automated trading system
- `npm run trading:demo` - Run complete trading integration demo

### Data Management

- `npm run tokens:all` - Get all available instruments
- `npm run tokens:advanced` - Advanced instrument data management

### Order Management

- `npm run orders:test` - Test order management system

### Authentication

- `npm run auth:auto` - Test automatic TOTP authentication

## Strategy Configuration

### 1. Moving Average Strategy

```typescript
const maStrategy = {
  name: "MA_Crossover_Strategy",
  type: "TREND_FOLLOWING",
  enabled: true,
  category: "TECHNICAL_ANALYSIS",
  riskLevel: "MEDIUM",
  instruments: ["RELIANCE", "TCS"],
  timeframes: ["5m"],
  parameters: {
    shortPeriod: 10,
    longPeriod: 20,
    volumeThreshold: 100000,
  },
  riskManagement: {
    stopLoss: {
      type: "PERCENTAGE",
      value: 1.5,
      percentage: 1.5,
    },
    takeProfit: {
      type: "PERCENTAGE",
      value: 3,
      percentage: 3,
    },
  },
};
```

### 2. RSI Mean Reversion Strategy

```typescript
const rsiStrategy = {
  name: "RSI_Mean_Reversion",
  type: "MEAN_REVERSION",
  enabled: true,
  category: "TECHNICAL_ANALYSIS",
  riskLevel: "MEDIUM",
  instruments: ["INFY", "HINDUNILVR"],
  timeframes: ["15m"],
  parameters: {
    period: 14,
    oversoldThreshold: 30,
    overboughtThreshold: 70,
  },
  positionSizing: {
    method: "RISK_PER_TRADE",
    riskPerTrade: 2,
  },
};
```

### 3. Enhanced Momentum Strategy

```typescript
const momentumStrategy = {
  name: "Enhanced_Momentum_Strategy",
  type: "MOMENTUM",
  enabled: true,
  category: "TECHNICAL_ANALYSIS",
  riskLevel: "HIGH",
  instruments: ["SBIN", "BAJFINANCE"],
  timeframes: ["30m"],
  parameters: {
    rsiPeriod: 14,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    adxPeriod: 14,
    bbPeriod: 20,
    bbStdDev: 2,
    volumeMultiplier: 1.5,
    momentumPeriod: 10,
  },
};
```

## Risk Management Features

### 1. Position Sizing Methods

```typescript
// Fixed amount
positionSizing: {
    method: 'FIXED_AMOUNT',
    fixedAmount: 1000
}

// Percentage of capital
positionSizing: {
    method: 'PERCENTAGE_OF_CAPITAL',
    percentageOfCapital: 5
}

// Risk per trade
positionSizing: {
    method: 'RISK_PER_TRADE',
    riskPerTrade: 2
}

// Kelly criterion
positionSizing: {
    method: 'KELLY_CRITERION'
}

// Volatility based
positionSizing: {
    method: 'VOLATILITY_BASED',
    volatilityPeriod: 20
}
```

### 2. Stop Loss Types

```typescript
// Percentage-based stop loss
stopLoss: {
    type: 'PERCENTAGE',
    value: 2,
    percentage: 2
}

// ATR-based stop loss
stopLoss: {
    type: 'ATR_BASED',
    value: 2,
    atrMultiplier: 2
}

// Fixed points stop loss
stopLoss: {
    type: 'FIXED_POINTS',
    value: 10
}
```

### 3. Take Profit Configuration

```typescript
// Risk-reward ratio
takeProfit: {
    type: 'RISK_REWARD_RATIO',
    value: 2  // 1:2 risk-reward ratio
}

// Percentage-based
takeProfit: {
    type: 'PERCENTAGE',
    value: 4,
    percentage: 4
}

// Partial exits
takeProfit: {
    type: 'PERCENTAGE',
    value: 6,
    percentage: 6,
    partialExit: [
        { percentage: 50, atProfitLevel: 2 },
        { percentage: 30, atProfitLevel: 4 },
        { percentage: 20, atProfitLevel: 6 }
    ]
}
```

## Event Handling

### 1. Signal Events

```typescript
tradingService.on("signal_generated", (signal) => {
  console.log(
    `📊 SIGNAL: ${signal.action} ${signal.symbol} at ₹${signal.price}`
  );
  console.log(`   Strategy: ${signal.strategy}`);
  console.log(`   Confidence: ${signal.metadata.confidence}`);
});
```

### 2. Order Events

```typescript
tradingService.on("order_placed", ({ signal, order }) => {
  console.log(`✅ ORDER: ${order.orderId} placed for ${signal.symbol}`);
});

tradingService.on("order_filled", (order) => {
  console.log(`✅ ORDER FILLED: ${order.orderId} for ${order.symbol}`);
});

tradingService.on("order_rejected", (order) => {
  console.log(`❌ ORDER REJECTED: ${order.orderId} - ${order.reason}`);
});
```

### 3. Position Events

```typescript
tradingService.on("position_updated", (position) => {
  console.log(
    `💰 POSITION: ${position.symbol} PnL: ₹${position.unrealizedPnL}`
  );
});

tradingService.on("position_exiting", ({ position, reason }) => {
  console.log(`📤 EXITING: ${position.symbol} - Reason: ${reason}`);
});
```

### 4. Risk Events

```typescript
tradingService.on("risk_limit_exceeded", ({ type, value }) => {
  console.log(`⚠️ RISK LIMIT EXCEEDED: ${type} - Value: ${value}`);
});

tradingService.on("risk_breach", (riskEvent) => {
  console.log(`⚠️ RISK BREACH: ${riskEvent.type} - ${riskEvent.message}`);
});
```

## Advanced Features

### 1. Multi-Strategy Portfolio

```typescript
// Add multiple strategies
await tradingService.addStrategy(movingAverageStrategy);
await tradingService.addStrategy(rsiStrategy);
await tradingService.addStrategy(breakoutStrategy);
await tradingService.addStrategy(momentumStrategy);

// Each strategy trades different instruments
// Risk is managed at portfolio level
```

### 2. Real-time Monitoring

```typescript
// Get real-time statistics
const stats = await tradingService.getTradingStats();
console.log(`Win Rate: ${stats.winRate}%`);
console.log(`Total PnL: ₹${stats.totalPnL}`);
console.log(`Active Positions: ${stats.currentPositions}`);

// Get active positions
const positions = tradingService.getActivePositions();
positions.forEach((position) => {
  console.log(`${position.symbol}: ₹${position.unrealizedPnL}`);
});
```

### 3. Dynamic Strategy Management

```typescript
// Add strategy during runtime
await tradingService.addStrategy(newStrategy);

// Remove strategy
await tradingService.removeStrategy("strategy_name");

// Get active strategies
const activeStrategies = tradingService.getActiveStrategies();
```

## Safety Features

### 1. Paper Trading Mode

```typescript
const config: TradingConfig = {
  autoExecute: false, // Don't execute real orders
  simulationMode: true, // Paper trading only
  // ... other config
};
```

### 2. Pre-trading Checks

- Market hours validation
- Account balance check
- Risk limits validation
- Strategy validation

### 3. Circuit Breakers

- Daily loss limits
- Maximum drawdown limits
- Position limits per symbol
- Maximum open positions

### 4. Graceful Shutdown

```typescript
// Stop trading gracefully
await tradingService.stopTrading();

// Closes all positions if configured
// Updates trading session
// Stops all monitoring loops
```

## Testing and Validation

### 1. Strategy Backtesting

```typescript
// Each strategy includes backtesting capabilities
const backtest = await strategy.backtest({
  symbol: "RELIANCE",
  from: "2023-01-01",
  to: "2023-12-31",
  capital: 100000,
});

console.log(`Total Return: ${backtest.totalReturn}%`);
console.log(`Sharpe Ratio: ${backtest.sharpeRatio}`);
console.log(`Max Drawdown: ${backtest.maxDrawdown}%`);
```

### 2. Paper Trading Validation

```typescript
// Run in simulation mode first
const config = {
  simulationMode: true,
  autoExecute: false,
  // ... other config
};

// Test all strategies and risk management
// Validate signal generation
// Check position management
```

### 3. Live Trading Preparation

```typescript
// Gradually enable live trading
const config = {
  simulationMode: false,
  autoExecute: true,
  maxPositions: 1, // Start with 1 position
  maxRiskPerTrade: 0.5, // Start with 0.5% risk
  // ... other config
};
```

## Performance Optimization

### 1. Efficient Data Management

- Market data caching
- Indicator result caching
- Database connection pooling
- WebSocket connection management

### 2. Parallel Processing

- Multiple strategy execution
- Concurrent market data processing
- Parallel order management
- Asynchronous event handling

### 3. Memory Management

- Limited data history (1000 points)
- Efficient data structures
- Proper cleanup on shutdown
- Memory leak prevention

## Monitoring and Logging

### 1. Comprehensive Logging

```typescript
// All trading activities are logged
// Signal generation
// Order placement and execution
// Position updates
// Risk management actions
// Error handling
```

### 2. Real-time Dashboard

```typescript
// Run the dashboard
npm run dashboard

// View real-time statistics
// Monitor active positions
// Track strategy performance
// View risk metrics
```

### 3. Database Persistence

- All trades stored in database
- Trading sessions tracked
- Performance metrics calculated
- Historical analysis available

## Next Steps

1. **Start with Paper Trading**: Always begin with `simulationMode: true`
2. **Test Single Strategy**: Start with one strategy and validate
3. **Gradually Increase Risk**: Slowly increase position sizes and number of strategies
4. **Monitor Performance**: Track all metrics and adjust parameters
5. **Implement Custom Strategies**: Build strategies specific to your trading style

## Support and Troubleshooting

### Common Issues

1. **Authentication Errors**: Check TOTP secret and credentials
2. **Market Data Issues**: Verify instrument tokens and subscriptions
3. **Order Placement Failures**: Check account balance and instrument validity
4. **Strategy Errors**: Validate strategy configuration and parameters

### Getting Help

- Check logs in `logs/` directory
- Review error messages in console
- Validate configuration parameters
- Test components individually before full integration

## Conclusion

The trading logic implementation provides a robust, scalable, and feature-rich automated trading system. It includes sophisticated strategies, comprehensive risk management, real-time monitoring, and safety features to ensure successful trading operations.

Start with paper trading, validate your strategies, and gradually move to live trading with proper risk management. The system is designed to be both powerful for experienced traders and safe for beginners.
