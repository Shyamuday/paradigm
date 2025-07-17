# Robust Strategy Module Implementation

## Overview

The Paradigm Trading System now includes a comprehensive and robust strategy module that can handle any type of trading strategy. This module provides a modular, extensible architecture that supports various strategy types, indicators, and execution modes.

## Architecture

### Core Components

1. **Strategy Engine** (`strategy-engine.service.ts`)

   - Central orchestrator for strategy execution
   - Manages strategy registration and lifecycle
   - Provides common functionality for all strategies

2. **Strategy Factory** (`strategy-factory.service.ts`)

   - Creates strategies from templates and configurations
   - Manages strategy templates and default configurations
   - Supports custom strategy creation

3. **Base Strategy Class** (`strategy-engine.service.ts`)

   - Abstract base class for all strategies
   - Provides common functionality (position sizing, risk management, etc.)
   - Defines the interface that all strategies must implement

4. **Strategy Implementations** (`strategies/`)

   - Concrete strategy implementations
   - Extend the base strategy class
   - Implement specific trading logic

5. **Enhanced Strategy Service** (`enhanced-strategy.service.ts`)
   - High-level service for strategy management
   - Integrates with database and other services
   - Provides performance analysis and monitoring

## Strategy Types Supported

### 1. Trend Following Strategies

- **Moving Average Crossover**: Golden/Death cross detection
- **MACD Strategy**: MACD line and signal line crossovers
- **ADX Strategy**: Trend strength and direction
- **Parabolic SAR**: Trend reversal detection

### 2. Mean Reversion Strategies

- **RSI Strategy**: Oversold/Overbought conditions
- **Bollinger Bands**: Price channel breakouts
- **Stochastic Oscillator**: Momentum reversals
- **Williams %R**: Extreme levels detection

### 3. Breakout Strategies

- **Support/Resistance Breakout**: Price level breakouts
- **Volume Breakout**: High volume price movements
- **Pattern Breakout**: Chart pattern completions
- **Volatility Breakout**: ATR-based breakouts

### 4. Scalping Strategies

- **High-Frequency Trading**: Micro-timeframe analysis
- **Arbitrage**: Price discrepancies
- **Market Making**: Bid-ask spread capture

### 5. Options Strategies

- **Covered Call**: Income generation
- **Protective Put**: Downside protection
- **Iron Condor**: Range-bound markets
- **Butterfly Spread**: Directional bets

### 6. Quantitative Strategies

- **Statistical Arbitrage**: Mean reversion
- **Momentum**: Price momentum capture
- **Factor Models**: Multi-factor analysis
- **Machine Learning**: AI/ML-based predictions

## Creating a New Strategy

### Step 1: Extend BaseStrategy

```typescript
import { BaseStrategy } from "../strategy-engine.service";
import {
  StrategyConfig,
  TradeSignal,
  MarketData,
  Position,
  StrategyType,
} from "../../types";

export class MyCustomStrategy extends BaseStrategy {
  constructor() {
    super(
      "My Custom Strategy",
      "CUSTOM",
      "1.0.0",
      "Description of my custom strategy"
    );
  }

  async generateSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
    const signals: TradeSignal[] = [];

    // Your signal generation logic here
    // Example: Simple moving average crossover

    const shortPeriod = this.config.parameters.shortPeriod || 10;
    const longPeriod = this.config.parameters.longPeriod || 20;

    const shortMA = this.calculateSMA(marketData, shortPeriod);
    const longMA = this.calculateSMA(marketData, longPeriod);

    // Look for crossovers
    for (let i = 1; i < marketData.length; i++) {
      const currentData = marketData[i];
      const prevData = marketData[i - 1];

      if (!currentData || !prevData) continue;

      const currentShortMA = shortMA[i];
      const currentLongMA = longMA[i];
      const prevShortMA = shortMA[i - 1];
      const prevLongMA = longMA[i - 1];

      if (!currentShortMA || !currentLongMA || !prevShortMA || !prevLongMA) {
        continue;
      }

      // Detect crossovers
      const currentCrossover = currentShortMA - currentLongMA;
      const previousCrossover = prevShortMA - prevLongMA;

      let action: "BUY" | "SELL" | "HOLD" = "HOLD";

      // Golden Cross
      if (previousCrossover <= 0 && currentCrossover > 0) {
        action = "BUY";
      }
      // Death Cross
      else if (previousCrossover >= 0 && currentCrossover < 0) {
        action = "SELL";
      }

      if (action !== "HOLD") {
        const signal = this.createSignal(currentData, action, {
          shortMA: currentShortMA,
          longMA: currentLongMA,
          shortPeriod,
          longPeriod,
        });

        if (signal) {
          signals.push(signal);
        }
      }
    }

    return signals;
  }

  async shouldExit(
    position: Position,
    marketData: MarketData[]
  ): Promise<boolean> {
    // Your exit logic here
    // Example: Exit if trend reverses

    const shortPeriod = this.config.parameters.shortPeriod || 10;
    const longPeriod = this.config.parameters.longPeriod || 20;

    const shortMA = this.calculateSMA(marketData, shortPeriod);
    const longMA = this.calculateSMA(marketData, longPeriod);

    const currentShortMA = shortMA[shortMA.length - 1];
    const currentLongMA = longMA[longMA.length - 1];

    if (!currentShortMA || !currentLongMA) return false;

    // Exit if trend reverses
    if (position.side === "LONG" && currentShortMA < currentLongMA) {
      return true;
    }

    if (position.side === "SHORT" && currentShortMA > currentLongMA) {
      return true;
    }

    return false;
  }

  validateConfig(config: StrategyConfig): boolean {
    const baseValid = super.validateConfig(config);
    if (!baseValid) return false;

    // Validate strategy-specific parameters
    const { shortPeriod, longPeriod } = config.parameters;

    if (!shortPeriod || !longPeriod) {
      return false;
    }

    if (shortPeriod >= longPeriod) {
      return false;
    }

    if (shortPeriod < 1 || longPeriod < 1) {
      return false;
    }

    return true;
  }

  private calculateSMA(data: MarketData[], period: number): (number | null)[] {
    const sma: (number | null)[] = new Array(data.length).fill(null);

    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      let count = 0;

      for (let j = i - period + 1; j <= i; j++) {
        const price = data[j]?.close || data[j]?.ltp;
        if (typeof price === "number") {
          sum += price;
          count++;
        }
      }

      if (count === period) {
        sma[i] = sum / period;
      }
    }

    return sma;
  }

  private createSignal(
    data: MarketData,
    action: "BUY" | "SELL",
    metadata: any
  ): TradeSignal | null {
    const price = data.close || data.ltp;
    if (!price || !data.symbol) return null;

    return {
      id: `signal_${Date.now()}_${Math.random()}`,
      strategy: this.name,
      symbol: data.symbol,
      action,
      quantity: 1, // Will be calculated by position sizing
      price,
      timestamp: new Date(data.timestamp),
      metadata: {
        ...metadata,
        strategyType: this.type,
        version: this.version,
      },
    };
  }
}
```

### Step 2: Register Strategy Class

```typescript
// In strategy-factory.service.ts
private registerStrategyClasses(): void {
  this.strategyClasses.set('TREND_FOLLOWING', MovingAverageStrategy);
  this.strategyClasses.set('MEAN_REVERSION', RSIStrategy);
  this.strategyClasses.set('BREAKOUT', BreakoutStrategy);
  this.strategyClasses.set('CUSTOM', MyCustomStrategy); // Add your strategy
}
```

### Step 3: Create Strategy Template

```typescript
// In strategy-factory.service.ts
private registerDefaultTemplates(): void {
  const myStrategyTemplate: StrategyTemplate = {
    id: 'my_custom_strategy',
    name: 'My Custom Strategy',
    description: 'Description of my custom strategy',
    type: 'CUSTOM',
    category: 'TECHNICAL_ANALYSIS',
    riskLevel: 'MEDIUM',
    defaultParameters: {
      shortPeriod: 10,
      longPeriod: 20,
      volumeThreshold: 1000
    },
    requiredParameters: ['shortPeriod', 'longPeriod'],
    optionalParameters: ['volumeThreshold'],
    defaultTimeframes: ['5min', '15min', '1hour'],
    defaultInstruments: ['NIFTY', 'BANKNIFTY'],
    exampleConfig: this.createDefaultMyStrategyConfig(),
    documentation: `
# My Custom Strategy

This strategy generates signals based on moving average crossovers.

## Parameters:
- shortPeriod: Short-term moving average period (default: 10)
- longPeriod: Long-term moving average period (default: 20)
- volumeThreshold: Minimum volume required for signal (optional)

## Signals:
- BUY: When short MA crosses above long MA (Golden Cross)
- SELL: When short MA crosses below long MA (Death Cross)
    `,
    tags: ['custom', 'moving-average', 'crossover'],
    isPublic: true,
    author: 'Your Name',
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  this.templates.set(myStrategyTemplate.id, myStrategyTemplate);
}
```

## Strategy Configuration

### Basic Configuration

```typescript
const strategyConfig: StrategyConfig = {
  name: "My Strategy",
  enabled: true,
  description: "My custom trading strategy",
  type: "CUSTOM",
  version: "1.0.0",
  author: "Your Name",
  category: "TECHNICAL_ANALYSIS",
  riskLevel: "MEDIUM",
  timeframes: ["5min", "15min", "1hour"],
  entryRules: [
    {
      id: "entry_rule_1",
      name: "Entry Rule 1",
      type: "ENTRY",
      condition: "AND",
      parameters: {
        // Your parameters here
      },
      priority: 1,
      isActive: true,
      description: "Description of entry rule",
    },
  ],
  exitRules: [
    {
      id: "exit_rule_1",
      name: "Exit Rule 1",
      type: "EXIT",
      condition: "OR",
      parameters: {
        // Your parameters here
      },
      priority: 1,
      isActive: true,
      description: "Description of exit rule",
    },
  ],
  positionSizing: {
    method: "RISK_PER_TRADE",
    riskPerTrade: 2, // 2% risk per trade
    maxPositionSize: 50000,
    minPositionSize: 1000,
  },
  riskManagement: {
    stopLoss: {
      type: "ATR_BASED",
      value: 2,
      atrMultiplier: 2,
    },
    takeProfit: {
      type: "RISK_REWARD_RATIO",
      value: 2,
    },
    maxDrawdown: 10,
    maxDailyLoss: 5,
    maxOpenPositions: 3,
  },
  filters: [],
  notifications: [],
  parameters: {
    // Your strategy parameters here
  },
  capitalAllocation: 100000,
  instruments: ["NIFTY", "BANKNIFTY"],
};
```

### Advanced Configuration

```typescript
const advancedConfig: StrategyConfig = {
  // ... basic configuration ...

  // Advanced position sizing
  positionSizing: {
    method: "CUSTOM_FORMULA",
    customFormula: "${capital} * 0.02 * (1 + ${volatility} * 10)",
    maxPositionSize: 50000,
    minPositionSize: 1000,
  },

  // Advanced risk management
  riskManagement: {
    stopLoss: {
      type: "TIME_BASED",
      value: 30, // 30 minutes
      timeBased: true,
      timeLimit: 30,
    },
    takeProfit: {
      type: "PERCENTAGE",
      value: 3,
      percentage: 3,
      partialExit: [
        {
          percentage: 50,
          target: 2,
          stopLoss: 1,
        },
        {
          percentage: 50,
          target: 4,
          stopLoss: 2,
        },
      ],
    },
    trailingStop: {
      enabled: true,
      type: "ATR_BASED",
      value: 1.5,
      activationLevel: 1,
      lockInProfit: true,
    },
    maxDrawdown: 8,
    maxDailyLoss: 2,
    maxOpenPositions: 2,
    correlationLimit: 0.7,
    sectorExposure: 20,
  },

  // Advanced filters
  filters: [
    {
      id: "time_filter",
      name: "Trading Hours Filter",
      type: "TIME_FILTER",
      parameters: {
        startTime: "09:15",
        endTime: "15:30",
        timezone: "Asia/Kolkata",
      },
      isActive: true,
      description: "Only trade during market hours",
    },
    {
      id: "volatility_filter",
      name: "Volatility Filter",
      type: "VOLATILITY_FILTER",
      parameters: {
        minVolatility: 0.01,
        maxVolatility: 0.05,
      },
      isActive: true,
      description: "Only trade in moderate volatility",
    },
  ],

  // Advanced notifications
  notifications: [
    {
      id: "risk_alert",
      type: "RISK_ALERT",
      conditions: [
        {
          metric: "drawdown",
          operator: "GT",
          value: 5,
        },
      ],
      channels: [
        {
          type: "EMAIL",
          config: { email: "trader@example.com" },
        },
        {
          type: "SMS",
          config: { phone: "+1234567890" },
        },
        {
          type: "WEBHOOK",
          config: { url: "https://api.example.com/risk-alert" },
        },
      ],
      isActive: true,
    },
  ],
};
```

## Position Sizing Methods

### 1. Fixed Amount

```typescript
positionSizing: {
  method: 'FIXED_AMOUNT',
  fixedAmount: 10000
}
```

### 2. Percentage of Capital

```typescript
positionSizing: {
  method: 'PERCENTAGE_OF_CAPITAL',
  percentageOfCapital: 5 // 5% of capital
}
```

### 3. Risk Per Trade

```typescript
positionSizing: {
  method: 'RISK_PER_TRADE',
  riskPerTrade: 2 // 2% risk per trade
}
```

### 4. Kelly Criterion

```typescript
positionSizing: {
  method: 'KELLY_CRITERION',
  kellyCriterion: true
}
```

### 5. Volatility Based

```typescript
positionSizing: {
  method: 'VOLATILITY_BASED',
  volatilityBased: true
}
```

### 6. Custom Formula

```typescript
positionSizing: {
  method: 'CUSTOM_FORMULA',
  customFormula: '${capital} * 0.02 * (1 + ${volatility} * 10)'
}
```

## Risk Management

### Stop Loss Types

1. **Fixed Points**

```typescript
stopLoss: {
  type: 'FIXED_POINTS',
  value: 50 // 50 points
}
```

2. **Percentage**

```typescript
stopLoss: {
  type: 'PERCENTAGE',
  value: 2,
  percentage: 2 // 2%
}
```

3. **ATR Based**

```typescript
stopLoss: {
  type: 'ATR_BASED',
  value: 2,
  atrMultiplier: 2
}
```

4. **Time Based**

```typescript
stopLoss: {
  type: 'TIME_BASED',
  value: 30, // 30 minutes
  timeBased: true,
  timeLimit: 30
}
```

### Take Profit Types

1. **Fixed Points**

```typescript
takeProfit: {
  type: 'FIXED_POINTS',
  value: 100 // 100 points
}
```

2. **Percentage**

```typescript
takeProfit: {
  type: 'PERCENTAGE',
  value: 4,
  percentage: 4 // 4%
}
```

3. **Risk Reward Ratio**

```typescript
takeProfit: {
  type: 'RISK_REWARD_RATIO',
  value: 2 // 2:1 risk-reward ratio
}
```

4. **Partial Exits**

```typescript
takeProfit: {
  type: 'PERCENTAGE',
  value: 4,
  percentage: 4,
  partialExit: [
    {
      percentage: 50,
      target: 2,
      stopLoss: 1
    },
    {
      percentage: 50,
      target: 4,
      stopLoss: 2
    }
  ]
}
```

## Using the Strategy Module

### 1. Create Strategy from Template

```typescript
import { enhancedStrategyService } from "./services/enhanced-strategy.service";

const strategy = await enhancedStrategyService.createStrategyFromTemplate(
  "moving_average_crossover",
  {
    name: "My MA Strategy",
    enabled: true,
    parameters: {
      shortPeriod: 5,
      longPeriod: 15,
      volumeThreshold: 2000,
    },
    capitalAllocation: 50000,
    instruments: ["NIFTY", "BANKNIFTY"],
  }
);
```

### 2. Create Custom Strategy

```typescript
import { strategyFactory } from "./services/strategy-factory.service";

const strategy = await strategyFactory.createCustomStrategy(
  "My Custom Strategy",
  "CUSTOM",
  {
    shortPeriod: 10,
    longPeriod: 20,
    volumeThreshold: 1000,
  },
  {
    capitalAllocation: 100000,
    instruments: ["NIFTY"],
    riskLevel: "MEDIUM",
  }
);
```

### 3. Execute Strategy

```typescript
// Execute with market data
const result = await enhancedStrategyService.executeStrategy(
  "My Strategy",
  marketData
);

// Execute with live data
const result = await enhancedStrategyService.executeStrategyWithLiveData(
  "My Strategy",
  "NIFTY",
  "15min"
);
```

### 4. Analyze Performance

```typescript
const performance = await enhancedStrategyService.getStrategyPerformance(
  strategyId
);

console.log(`Total Return: ${performance.totalReturn.toFixed(2)}%`);
console.log(`Sharpe Ratio: ${performance.sharpeRatio.toFixed(2)}`);
console.log(`Max Drawdown: ${performance.maxDrawdown.toFixed(2)}%`);
console.log(`Win Rate: ${performance.winRate.toFixed(2)}%`);
```

## Strategy Templates

### Available Templates

1. **Moving Average Crossover** (`moving_average_crossover`)

   - Type: Trend Following
   - Parameters: shortPeriod, longPeriod, volumeThreshold
   - Signals: Golden Cross (BUY), Death Cross (SELL)

2. **RSI Mean Reversion** (`rsi_mean_reversion`)

   - Type: Mean Reversion
   - Parameters: period, oversoldThreshold, overboughtThreshold, volumeThreshold
   - Signals: Oversold (BUY), Overbought (SELL)

3. **Breakout Strategy** (`breakout_strategy`)
   - Type: Breakout
   - Parameters: lookbackPeriod, breakoutThreshold, volumeMultiplier, confirmationPeriod
   - Signals: Resistance Breakout (BUY), Support Breakdown (SELL)

### Creating Custom Templates

```typescript
import { StrategyTemplate } from "../types";

const customTemplate: StrategyTemplate = {
  id: "my_custom_template",
  name: "My Custom Template",
  description: "Description of my custom template",
  type: "CUSTOM",
  category: "TECHNICAL_ANALYSIS",
  riskLevel: "MEDIUM",
  defaultParameters: {
    // Default parameters
  },
  requiredParameters: ["param1", "param2"],
  optionalParameters: ["param3"],
  defaultTimeframes: ["5min", "15min", "1hour"],
  defaultInstruments: ["NIFTY", "BANKNIFTY"],
  exampleConfig: {
    // Example configuration
  },
  documentation: `
# My Custom Template

Documentation for my custom template.
  `,
  tags: ["custom", "template"],
  isPublic: true,
  author: "Your Name",
  version: "1.0.0",
  createdAt: new Date(),
  updatedAt: new Date(),
};

await enhancedStrategyService.registerTemplate(customTemplate);
```

## Best Practices

### 1. Strategy Design

- Keep strategies simple and focused
- Use clear entry and exit rules
- Implement proper risk management
- Test thoroughly before live trading

### 2. Risk Management

- Always use stop losses
- Limit position sizes
- Monitor drawdown
- Set daily loss limits

### 3. Performance Monitoring

- Track key metrics (Sharpe ratio, drawdown, win rate)
- Monitor strategy health
- Set up alerts for unusual behavior
- Regular performance reviews

### 4. Code Quality

- Follow TypeScript best practices
- Add proper error handling
- Include comprehensive logging
- Write unit tests for strategies

### 5. Documentation

- Document strategy logic clearly
- Include parameter descriptions
- Provide usage examples
- Maintain change logs

## Example Usage

See `src/examples/robust-strategy-example.ts` for a comprehensive example of how to use the robust strategy module.

## Conclusion

The robust strategy module provides a powerful and flexible framework for creating any type of trading strategy. With its modular architecture, comprehensive risk management, and extensive configuration options, it can handle everything from simple moving average crossovers to complex quantitative strategies.

The module is designed to be:

- **Extensible**: Easy to add new strategy types
- **Configurable**: Highly customizable parameters
- **Robust**: Built-in risk management and validation
- **Scalable**: Can handle multiple strategies simultaneously
- **Maintainable**: Clean, well-documented code

Whether you're a beginner trader or an experienced quantitative analyst, this module provides the tools you need to implement and test your trading strategies effectively.
