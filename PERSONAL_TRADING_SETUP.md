# Personal Trading Setup Guide

This guide will help you set up and use the strategy engine for personal trading with Zerodha Kite.

## 🚀 Quick Start

### 1. Prerequisites

- Zerodha Kite account with API access
- Node.js (v16 or higher)
- Basic understanding of trading and risk management

### 2. Environment Setup

Create a `.env` file in your project root:

```bash
# Zerodha API Credentials
KITE_API_KEY=your_api_key_here
KITE_API_SECRET=your_api_secret_here
KITE_ACCESS_TOKEN=your_access_token_here

# Trading Configuration
TRADING_CAPITAL=100000
MAX_DAILY_LOSS=5000
MAX_RISK_PER_TRADE=0.02

# Telegram Notifications
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Database
DATABASE_URL=sqlite:./data/trading.db
```

### 3. Install Dependencies

```bash
npm install
npm install kiteconnect
```

### 4. Setup Telegram Notifications (Optional but Recommended)

```bash
# Follow the Telegram setup guide
# See TELEGRAM_SETUP.md for detailed instructions

# Test Telegram notifications
npm run test-telegram
```

### 5. Configure Trading Parameters

Edit `config/personal-trading-config.yaml`:

```yaml
trading:
  capital: 100000 # Your trading capital
  maxRiskPerTrade: 0.02 # 2% risk per trade
  maxDailyLoss: 5000 # Daily loss limit

  instruments:
    - "NIFTY"
    - "BANKNIFTY"
    # Add more instruments as needed
```

## 📊 Strategy Configuration

### Available Strategies

1. **Moving Average Crossover**

   - Type: Trend Following
   - Best for: Trending markets
   - Risk: Medium

2. **RSI Mean Reversion**

   - Type: Mean Reversion
   - Best for: Range-bound markets
   - Risk: Medium

3. **Breakout Strategy**
   - Type: Breakout
   - Best for: Volatile markets
   - Risk: High

### Strategy Settings

```yaml
strategies:
  moving_average:
    enabled: true
    allocation: 0.3 # 30% of capital
    parameters:
      shortPeriod: 10
      longPeriod: 20
      volumeThreshold: 1000
    riskManagement:
      stopLoss: 0.02 # 2% stop loss
      takeProfit: 0.04 # 4% take profit
```

## 🛡️ Risk Management

### Key Risk Parameters

1. **Position Sizing**: Maximum 2% risk per trade
2. **Daily Loss Limit**: 5K per day
3. **Maximum Positions**: 5 concurrent positions
4. **Stop Loss**: Automatic stop loss on all trades
5. **Take Profit**: Automatic profit booking

### Risk Controls

- **Correlation Limit**: Avoid highly correlated positions
- **Sector Limit**: Maximum 30% allocation to single sector
- **Volatility Filter**: Avoid trading during high volatility
- **News Filter**: Avoid trading during major news events

## 🚀 Starting Personal Trading

### 1. Test Mode (Recommended First)

```bash
# Run in test mode with paper trading
npm run test-trading
```

### 2. Live Trading

```bash
# Start live trading
npm run start-trading
```

### 3. Monitor Performance

```bash
# Check trading status
npm run status

# View performance metrics
npm run performance
```

## 📈 Performance Monitoring

### Real-time Monitoring

The system provides real-time monitoring of:

- Current positions
- Daily P&L
- Win rate
- Risk metrics
- Strategy performance

### Performance Metrics

- **Total P&L**: Overall profit/loss
- **Win Rate**: Percentage of winning trades
- **Sharpe Ratio**: Risk-adjusted returns
- **Max Drawdown**: Maximum loss from peak
- **Profit Factor**: Ratio of gross profit to gross loss

## 🔧 Customization

### Adding Custom Strategies

1. Create a new strategy file in `src/services/strategies/`
2. Extend the `BaseStrategy` class
3. Implement required methods
4. Register in `StrategyFactory`

Example:

```typescript
export class CustomStrategy extends BaseStrategy {
  constructor() {
    super("Custom Strategy", "CUSTOM", "1.0.0", "My custom strategy");
  }

  async generateSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
    // Your strategy logic here
  }
}
```

### Custom Risk Management

Modify risk parameters in the config:

```yaml
riskManagement:
  maxDrawdown: 0.15 # 15% maximum drawdown
  correlationLimit: 0.7 # Maximum correlation
  sectorLimit: 0.3 # Maximum sector allocation
```

## ⚠️ Important Safety Guidelines

### 1. Start Small

- Begin with small capital (10K-50K)
- Test strategies thoroughly before scaling
- Use paper trading initially

### 2. Risk Management

- Never risk more than 2% per trade
- Set strict daily loss limits
- Always use stop losses
- Diversify across strategies

### 3. Monitoring

- Monitor positions regularly
- Check system health daily
- Review performance weekly
- Keep detailed logs

### 4. Market Conditions

- Avoid trading during major news
- Be cautious during high volatility
- Consider market hours and liquidity
- Monitor correlation between positions

## 🚨 Emergency Procedures

### Stop Trading Immediately If:

1. Daily loss limit reached
2. System errors detected
3. Market conditions unfavorable
4. Technical issues with API

### Emergency Commands

```bash
# Stop all trading
npm run stop-trading

# Close all positions
npm run close-positions

# Emergency shutdown
npm run emergency-stop
```

## 📊 Performance Tracking

### Daily Reports

The system generates daily reports including:

- Trades executed
- P&L summary
- Risk metrics
- Strategy performance
- System health

### Monthly Analysis

Monthly performance analysis includes:

- Overall P&L
- Strategy comparison
- Risk-adjusted returns
- Drawdown analysis
- Recommendations

## 🔍 Troubleshooting

### Common Issues

1. **API Connection Issues**

   - Check API credentials
   - Verify network connection
   - Check Zerodha server status

2. **Strategy Not Generating Signals**

   - Check market data availability
   - Verify strategy parameters
   - Check trading hours

3. **Orders Not Executing**
   - Check account balance
   - Verify instrument availability
   - Check order parameters

### Debug Mode

Enable debug mode for detailed logging:

```bash
DEBUG=* npm run start-trading
```

## 📞 Support

### Getting Help

1. Check the logs in `logs/` directory
2. Review error messages
3. Check system status
4. Contact support if needed

### Useful Commands

```bash
# View logs
tail -f logs/trading.log

# Check system status
npm run status

# View configuration
npm run show-config

# Test API connection
npm run test-api
```

## 🎯 Best Practices

### 1. Strategy Selection

- Start with proven strategies (MA, RSI)
- Test thoroughly before live trading
- Monitor strategy performance regularly
- Adjust parameters based on market conditions

### 2. Risk Management

- Always use stop losses
- Diversify across strategies
- Monitor correlation between positions
- Set realistic profit targets

### 3. System Management

- Keep system updated
- Monitor system health
- Backup configuration regularly
- Test emergency procedures

### 4. Performance Optimization

- Review performance monthly
- Adjust strategy parameters
- Consider market conditions
- Learn from losing trades

## 🚀 Next Steps

1. **Paper Trading**: Start with paper trading
2. **Small Capital**: Begin with small amounts
3. **Monitor Closely**: Watch performance daily
4. **Learn & Adapt**: Adjust based on results
5. **Scale Gradually**: Increase capital slowly

Remember: **Trading involves risk. Only trade with money you can afford to lose.**
