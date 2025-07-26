# Complete Setup Guide - Personal Trading System with Telegram

This comprehensive guide will walk you through setting up your personal trading system with Telegram notifications from scratch.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [System Requirements](#system-requirements)
3. [Installation Steps](#installation-steps)
4. [Zerodha API Setup](#zerodha-api-setup)
5. [Telegram Bot Setup](#telegram-bot-setup)
6. [Configuration](#configuration)
7. [Testing](#testing)
8. [Starting Trading](#starting-trading)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Prerequisites

### Required Accounts

- **Zerodha Kite Account** with API access
- **Telegram Account** (mobile or desktop)
- **GitHub Account** (for code access)

### Required Knowledge

- Basic understanding of trading concepts
- Familiarity with command line/terminal
- Understanding of risk management

---

## 💻 System Requirements

### Operating System

- **Windows 10/11** (64-bit)
- **macOS 10.15+** (Intel/Apple Silicon)
- **Ubuntu 18.04+** / **CentOS 7+**

### Hardware Requirements

- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 10GB free space
- **Network**: Stable internet connection
- **CPU**: Dual-core minimum

### Software Requirements

- **Node.js 16.x or higher**
- **npm 8.x or higher**
- **Git** (for cloning repository)

---

## 🚀 Installation Steps

### Step 1: Install Node.js

#### Windows

1. Download Node.js from [nodejs.org](https://nodejs.org/)
2. Run the installer and follow the prompts
3. Verify installation:
   ```bash
   node --version
   npm --version
   ```

#### macOS

```bash
# Using Homebrew
brew install node

# Or download from nodejs.org
```

#### Linux (Ubuntu/Debian)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 2: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/paradigm-algo-trading-bot.git

# Navigate to project directory
cd paradigm-algo-trading-bot

# Install dependencies
npm install
```

### Step 3: Install Additional Dependencies

```bash
# Install required packages
npm install kiteconnect axios dotenv

# Install development dependencies
npm install -D @types/node typescript ts-node
```

---

## 🔑 Zerodha API Setup

### Step 1: Create Zerodha Account

1. **Visit** [zerodha.com](https://zerodha.com)
2. **Sign up** for a new account
3. **Complete KYC** verification
4. **Fund your account** (minimum ₹500 for testing)

### Step 2: Enable API Access

1. **Login** to your Zerodha account
2. **Go to** Profile → API
3. **Click** "Enable API"
4. **Accept** terms and conditions
5. **Note down** your API Key and Secret

### Step 3: Generate Access Token

#### Method 1: Using the provided script

```bash
# Run the auth example
npm run auth:example
```

#### Method 2: Manual process

1. **Visit** [kite.trade](https://kite.trade)
2. **Login** with your Zerodha credentials
3. **Go to** Console → API
4. **Generate** access token
5. **Copy** the access token

### Step 4: Verify API Access

```bash
# Test API connection
npm run test-api
```

---

## 🤖 Telegram Bot Setup

### Step 1: Create Telegram Bot

1. **Open Telegram** and search for `@BotFather`
2. **Start a chat** with BotFather
3. **Send command**: `/newbot`
4. **Enter bot name**: "My Trading Bot"
5. **Enter username**: "mytradingbot123" (must end with 'bot')
6. **Save the bot token** provided by BotFather

### Step 2: Get Your Chat ID

#### Method 1: Using the test script

```bash
# Run the test script (it will guide you)
npm run test-telegram
```

#### Method 2: Manual process

1. **Start a chat** with your new bot
2. **Send any message** (e.g., "Hello")
3. **Visit this URL** in browser:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
4. **Find your chat ID** in the response (number like `123456789`)

### Step 3: Test Bot Connection

```bash
# Test Telegram notifications
npm run test-telegram
```

---

## ⚙️ Configuration

### Step 1: Create Environment File

Create a `.env` file in the project root:

```bash
# Zerodha API Configuration
KITE_API_KEY=your_api_key_here
KITE_API_SECRET=your_api_secret_here
KITE_ACCESS_TOKEN=your_access_token_here

# Trading Configuration
TRADING_CAPITAL=100000
MAX_DAILY_LOSS=5000
MAX_RISK_PER_TRADE=0.02

# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Database Configuration
DATABASE_URL=sqlite:./data/trading.db

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=logs/trading.log
```

### Step 2: Configure Trading Parameters

Edit `config/personal-trading-config.yaml`:

```yaml
# Trading Parameters
trading:
  capital: 100000 # Your trading capital
  maxRiskPerTrade: 0.02 # 2% risk per trade
  maxDailyLoss: 5000 # Daily loss limit
  maxPositions: 5 # Maximum concurrent positions

  # Instruments to trade
  instruments:
    - "NIFTY"
    - "BANKNIFTY"
    - "RELIANCE"
    - "TCS"

# Strategy Configuration
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

  rsi:
    enabled: true
    allocation: 0.2 # 20% of capital
    parameters:
      period: 14
      overbought: 70
      oversold: 30
    riskManagement:
      stopLoss: 0.015 # 1.5% stop loss
      takeProfit: 0.03 # 3% take profit

# Telegram Configuration
telegram:
  enabled: true
  botToken: "${TELEGRAM_BOT_TOKEN}"
  chatId: "${TELEGRAM_CHAT_ID}"
  notifications:
    tradeSignals: true
    tradeExecutions: true
    positionUpdates: true
    performanceUpdates: true
    systemAlerts: true
    dailyReports: true
    errorAlerts: true
  updateInterval: 30 # minutes
```

### Step 3: Create Required Directories

```bash
# Create data and logs directories
mkdir -p data logs

# Set proper permissions
chmod 755 data logs
```

---

## 🧪 Testing

### Step 1: Test System Components

```bash
# Test all components
npm run test:all

# Test enhanced features
npm run test:enhanced
```

### Step 2: Test API Connections

```bash
# Test Zerodha API
npm run test-api

# Test Telegram bot
npm run test-telegram
```

### Step 3: Test Strategy Engine

```bash
# Test strategy execution
npm run trading:test

# Test enhanced strategy integration
npm run enhanced-strategy-integration
```

### Step 4: Test Database

```bash
# Setup database
npm run db:setup

# Test database connection
npm run db:check
```

---

## 🚀 Starting Trading

### Step 1: Paper Trading (Recommended First)

```bash
# Start with paper trading
npm run trading:test
```

### Step 2: Live Trading

```bash
# Start live trading with Telegram notifications
npm run trading:personal
```

### Step 3: Monitor System

```bash
# Check trading status
npm run trading:status

# View logs
tail -f logs/trading.log
```

---

## 📊 Monitoring & Maintenance

### Daily Monitoring

1. **Check Telegram notifications** for:

   - Trade signals and executions
   - Position updates
   - Performance summaries
   - System alerts

2. **Review logs** for any errors:

   ```bash
   tail -f logs/trading.log
   ```

3. **Monitor system status**:
   ```bash
   npm run trading:status
   ```

### Weekly Maintenance

1. **Review performance**:

   - Check win rate and P&L
   - Analyze strategy performance
   - Review risk metrics

2. **Update configurations** if needed:

   - Adjust strategy parameters
   - Modify risk limits
   - Update notification settings

3. **Backup data**:
   ```bash
   cp data/trading.db data/trading_backup_$(date +%Y%m%d).db
   ```

### Monthly Tasks

1. **Performance analysis**:

   - Generate monthly reports
   - Compare strategy performance
   - Identify optimization opportunities

2. **System updates**:

   ```bash
   git pull origin main
   npm install
   npm run build
   ```

3. **Security review**:
   - Rotate API tokens if needed
   - Review access logs
   - Update passwords

---

## 🛠️ Troubleshooting

### Common Issues

#### 1. API Connection Issues

**Problem**: Cannot connect to Zerodha API
**Solution**:

```bash
# Check API credentials
echo $KITE_API_KEY
echo $KITE_API_SECRET
echo $KITE_ACCESS_TOKEN

# Test API connection
npm run test-api

# Regenerate access token if expired
npm run auth:example
```

#### 2. Telegram Bot Issues

**Problem**: Telegram notifications not working
**Solution**:

```bash
# Test bot connection
npm run test-telegram

# Check bot token and chat ID
echo $TELEGRAM_BOT_TOKEN
echo $TELEGRAM_CHAT_ID

# Verify bot is not blocked
curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe
```

#### 3. Strategy Not Generating Signals

**Problem**: No trade signals being generated
**Solution**:

```bash
# Check market data availability
npm run market-data:test

# Verify strategy configuration
cat config/personal-trading-config.yaml

# Test individual strategies
npm run strategy:test
```

#### 4. Database Issues

**Problem**: Database connection errors
**Solution**:

```bash
# Check database setup
npm run db:check

# Reset database if needed
npm run db:reset

# Verify database file permissions
ls -la data/
```

#### 5. Performance Issues

**Problem**: System running slowly
**Solution**:

```bash
# Check system resources
top
df -h

# Check logs for errors
tail -f logs/trading.log

# Restart system if needed
npm run trading:stop
npm run trading:personal
```

### Debug Commands

```bash
# Enable debug mode
DEBUG=* npm run trading:personal

# Check all environment variables
env | grep -E "(KITE|TELEGRAM|TRADING)"

# Test all components
npm run test:all

# Check system health
npm run health:check
```

### Emergency Procedures

#### Stop Trading Immediately

```bash
# Emergency stop
npm run trading:stop

# Close all positions
npm run close-positions

# Emergency shutdown
npm run emergency-stop
```

#### Reset System

```bash
# Stop all processes
npm run trading:stop

# Clear logs
rm -rf logs/*

# Reset database
npm run db:reset

# Restart system
npm run trading:personal
```

---

## 📞 Support

### Getting Help

1. **Check documentation**:

   - `PERSONAL_TRADING_SETUP.md`
   - `TELEGRAM_SETUP.md`
   - `README.md`

2. **Review logs**:

   ```bash
   tail -f logs/trading.log
   ```

3. **Test components**:

   ```bash
   npm run test:all
   ```

4. **Contact support** if needed

### Useful Commands Reference

```bash
# System Management
npm run trading:personal    # Start trading
npm run trading:stop        # Stop trading
npm run trading:status      # Check status

# Testing
npm run test-telegram       # Test Telegram
npm run test-api           # Test Zerodha API
npm run trading:test       # Test strategies

# Database
npm run db:setup           # Setup database
npm run db:check           # Check database
npm run db:reset           # Reset database

# Logs
tail -f logs/trading.log   # View live logs
grep ERROR logs/trading.log # Find errors
```

---

## 🎯 Next Steps

### After Setup

1. **Start with paper trading** to test the system
2. **Monitor performance** closely for the first week
3. **Adjust parameters** based on results
4. **Scale up gradually** as you gain confidence

### Advanced Features

1. **Add custom strategies**:

   - Create new strategy files
   - Extend BaseStrategy class
   - Register in StrategyFactory

2. **Customize notifications**:

   - Modify Telegram message formats
   - Add new notification types
   - Adjust update frequencies

3. **Enhance monitoring**:
   - Add custom metrics
   - Create performance dashboards
   - Set up additional alerts

---

## ⚠️ Important Notes

### Security

- **Never share** your API keys or bot tokens
- **Keep your .env file** secure and private
- **Regularly rotate** access tokens
- **Monitor** for unauthorized access

### Risk Management

- **Start small** with limited capital
- **Set strict** loss limits
- **Monitor** positions regularly
- **Have emergency** stop procedures

### Legal Compliance

- **Check local regulations** for algo trading
- **Ensure compliance** with broker terms
- **Keep records** of all trades
- **Consult professionals** if needed

---

**Remember**: Trading involves risk. Only trade with money you can afford to lose. This system is for educational and personal use only.

---

_Last updated: January 2024_
_Version: 1.0.0_
