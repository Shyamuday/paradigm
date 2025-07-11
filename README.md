# Paradigm Trading System

A comprehensive trading system with real-time market data processing, strategy execution, and terminal-based UI.

## Features

### Trading Logic

- Moving Average Crossover Strategy
  - Configurable short and long periods (default: 10, 20)
  - Volume threshold filtering
  - Dynamic stop-loss and target using ATR (Average True Range)
  - Type-safe implementation with proper error handling

### P&L and Position Management

- Real-time P&L tracking
  - Realized P&L for closed trades
  - Unrealized P&L for open positions
  - Support for both LONG and SHORT positions
- Position metrics
  - Total position value
  - Net P&L calculation
  - Open position tracking
  - Portfolio performance metrics

### Terminal UI

- Real-time market data display
- Position and order monitoring
- P&L visualization
- Authentication status
- TOTP handling
- Multi-panel layout

### Data Processing

- Real-time market data handling
- Tick and candle data storage
- Historical data access
- Database integration

### Authentication & Security

- Session management
- TOTP verification
- API quota monitoring
- Error tracking

## Getting Started

1. Clone the repository
2. Copy `env.example` to `.env` and configure your environment variables
3. Install dependencies:
   ```bash
   npm install
   ```
4. Initialize the database:
   ```bash
   npx prisma migrate dev
   ```
5. Start the terminal dashboard:
   ```bash
   npm run dashboard
   ```

## Configuration

### Trading Strategy

Configure strategy parameters in `config/trading-config.yaml`:

```yaml
strategies:
  simple_ma:
    enabled: true
    description: "Simple Moving Average Crossover"
    parameters:
      short_period: 10
      long_period: 20
      capital_allocation: 0.3 # 30% of capital
    instruments:
      - "NIFTY"
      - "BANKNIFTY"
```

### Risk Management

Set risk parameters in `config/trading-config.yaml`:

```yaml
risk:
  default_stop_loss_percentage: 2.0
  trailing_stop_loss: true
  max_risk_per_trade: 0.02 # 2% of capital per trade
  max_portfolio_risk: 0.1 # 10% of capital total risk
```

## Architecture

### Services

- `StrategyService`: Implements trading strategies and signal generation
  - Moving average crossover with volume filtering
  - Technical analysis calculations (SMA, ATR)
  - Signal generation with dynamic risk parameters
- `OrderService`: Handles trade execution and position management
  - P&L calculations for trades and positions
  - Position tracking and updates
  - Order status management
- `MarketDataService`: Processes and stores market data
  - Real-time tick data processing
  - Historical data management
  - Instrument configuration
- `AuthManagerService`: Handles authentication and session management
  - API authentication
  - Session tracking
  - TOTP verification

### Database

PostgreSQL database with Prisma ORM:

- Market data storage
- Trade and position tracking
- User authentication
- System configuration

### UI

Terminal-based dashboard using blessed and blessed-contrib:

- Multiple data panels
- Real-time updates
- Interactive commands
- Status monitoring

## Development

### Adding New Strategies

1. Create a new strategy class in `src/services/strategies/`
2. Implement the strategy interface
3. Add configuration in `config/trading-config.yaml`
4. Register the strategy in `StrategyService`

Example strategy implementation:

```typescript
async generateSignals(marketData: MarketDataPoint[]): Promise<TradeSignal[]> {
    // Calculate technical indicators
    const shortMA = calculateSMA(marketData, shortPeriod);
    const longMA = calculateSMA(marketData, longPeriod);

    // Generate signals on crossovers
    const signals = [];
    for (let i = 1; i < marketData.length; i++) {
        const currentCrossover = shortMA[i] - longMA[i];
        const previousCrossover = shortMA[i-1] - longMA[i-1];

        if (previousCrossover <= 0 && currentCrossover > 0) {
            signals.push(createBuySignal(marketData[i]));
        } else if (previousCrossover >= 0 && currentCrossover < 0) {
            signals.push(createSellSignal(marketData[i]));
        }
    }
    return signals;
}
```

### Testing

```bash
npm test
```

### Logging

Logs are stored in:

- `logs/trading-bot.log`: General application logs
- `logs/error.log`: Error tracking

## API Documentation

See `docs/API_AUTHENTICATION.md` for API authentication details.

## Terminal UI Guide

See `docs/TERMINAL_UI.md` for detailed UI usage instructions.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT License
