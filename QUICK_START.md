# Quick Start Guide - Personal Trading System

Get your personal trading system with Telegram notifications running in 15 minutes!

## ⚡ 15-Minute Setup

### Step 1: Prerequisites (2 minutes)

- ✅ Node.js installed (`node --version`)
- ✅ Zerodha account with API access
- ✅ Telegram account

### Step 2: Clone & Install (3 minutes)

```bash
git clone https://github.com/yourusername/paradigm-algo-trading-bot.git
cd paradigm-algo-trading-bot
npm install
npm install kiteconnect axios dotenv
```

### Step 3: Get API Keys (5 minutes)

#### Zerodha API

1. Login to [zerodha.com](https://zerodha.com)
2. Go to Profile → API → Enable API
3. Note your API Key and Secret
4. Generate access token at [kite.trade](https://kite.trade)

#### Telegram Bot

1. Message `@BotFather` on Telegram
2. Send `/newbot`
3. Name: "My Trading Bot"
4. Username: "mytradingbot123"
5. Save the bot token
6. Start chat with your bot and send "Hello"
7. Visit: `https://api.telegram.org/bot<TOKEN>/getUpdates`
8. Find your chat ID (number like `123456789`)

### Step 4: Configure (3 minutes)

Create `.env` file:

```bash
# Zerodha
KITE_API_KEY=your_api_key
KITE_API_SECRET=your_api_secret
KITE_ACCESS_TOKEN=your_access_token

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Trading
TRADING_CAPITAL=100000
MAX_DAILY_LOSS=5000
MAX_RISK_PER_TRADE=0.02
```

### Step 5: Test & Start (2 minutes)

```bash
# Test everything
npm run test-telegram
npm run trading:test

# Start trading
npm run trading:personal
```

## 🎯 What You Get

- 🤖 **Automated Trading** with 3 strategies
- 📱 **Real-time Telegram notifications**
- 🛡️ **Risk management** with stop losses
- 📊 **Performance tracking**
- 🔄 **24/7 monitoring**

## 📱 Telegram Notifications

You'll receive:

- 🟢🔴 **Trade signals** (buy/sell recommendations)
- ✅❌ **Trade executions** (order confirmations)
- 📊 **Position updates** (real-time P&L)
- 📈📉 **Performance summaries** (every 30 minutes)
- 🚨 **System alerts** (warnings/errors)
- 📅 **Daily reports** (3:30 PM)

## ⚙️ Default Configuration

### Strategies

- **Moving Average Crossover** (30% allocation)
- **RSI Mean Reversion** (20% allocation)
- **Breakout Strategy** (disabled by default)

### Risk Management

- **2% risk per trade**
- **₹5,000 daily loss limit**
- **Automatic stop losses**
- **Position size limits**

### Instruments

- NIFTY
- BANKNIFTY
- RELIANCE
- TCS

## 🚀 Ready to Trade?

### Paper Trading First (Recommended)

```bash
npm run trading:test
```

### Live Trading

```bash
npm run trading:personal
```

### Monitor

```bash
# Check status
npm run trading:status

# View logs
tail -f logs/trading.log
```

## 🛑 Emergency Stop

```bash
# Stop trading immediately
npm run trading:stop

# Close all positions
npm run close-positions
```

## 📞 Need Help?

1. **Check logs**: `tail -f logs/trading.log`
2. **Test components**: `npm run test-telegram`
3. **Full setup guide**: See `SETUP_GUIDE.md`
4. **Telegram setup**: See `TELEGRAM_SETUP.md`

## ⚠️ Important

- **Start small** (10K-50K capital)
- **Test thoroughly** before live trading
- **Monitor daily** for first week
- **Only trade** what you can afford to lose

---

**You're all set! Your trading system is now running with Telegram notifications.** 📱✨

_For detailed setup instructions, see `SETUP_GUIDE.md`_
