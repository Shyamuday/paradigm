# 🚀 Live Trading Setup Guide

## 📋 Prerequisites

### 1. **Zerodha Account Setup**

- ✅ Active Zerodha trading account
- ✅ API access enabled
- ✅ 2FA (Two-Factor Authentication) configured
- ✅ Sufficient funds for trading

### 2. **System Requirements**

- ✅ Node.js v18+ installed
- ✅ PostgreSQL database running
- ✅ Redis (optional, for caching)
- ✅ Stable internet connection
- ✅ 24/7 server access (recommended)

## 🔧 Step-by-Step Setup

### **Step 1: Environment Configuration**

```bash
# Copy environment template
cp env.example .env

# Edit .env with your credentials
nano .env
```

**Essential Environment Variables:**

```env
# Zerodha API (REQUIRED)
ZERODHA_API_KEY=your_api_key_here
ZERODHA_API_SECRET=your_api_secret_here
ZERODHA_REDIRECT_URI=http://localhost:3000/auth/callback

# Trading Mode (START WITH PAPER)
TRADING_MODE=PAPER  # Change to LIVE when ready

# Risk Management
TRADING_CAPITAL=100000
MAX_DAILY_LOSS=5000
MAX_RISK_PER_TRADE=0.02

# ML Configuration
ML_CONFIDENCE_THRESHOLD=0.7
ML_LOOKBACK_PERIOD=50

# Notifications (RECOMMENDED)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

### **Step 2: Database Setup**

```bash
# Setup database
npm run db:setup

# Verify database connection
npm run db:check

# Generate Prisma client
npm run prisma:generate
```

### **Step 3: Authentication Setup**

```bash
# First time authentication
npm run auth:example

# This will open browser for Zerodha login
# Complete the authentication process
```

### **Step 4: Test Configuration**

```bash
# Validate configuration
npm run config:validate

# Test with paper trading first
npm run trading:ml-auto
```

## 🎯 Starting Live Trading

### **Option 1: Combined ML + Auto Trading (Recommended)**

```bash
# 1. Setup everything
npm run trading:setup

# 2. Test with paper trading
npm run trading:ml-auto

# 3. Monitor with dashboard
npm run dashboard

# 4. When ready, switch to live trading
# Edit .env: TRADING_MODE=LIVE
npm run trading:ml-auto
```

### **Option 2: Separate Systems**

```bash
# Run both ML and auto trading separately
npm run trading:combined
```

### **Option 3: Intelligent ML Trading**

```bash
# Advanced ML trading with enhanced features
npm run trading:ml-intelligent
```

## 📊 Monitoring & Control

### **Real-time Monitoring**

```bash
# View live dashboard
npm run dashboard

# Check trading status
npm run trading:status

# View logs
npm run logs:view

# View error logs
npm run logs:error
```

### **Control Commands**

```bash
# Stop trading
npm run trading:stop

# Restart trading
npm run trading:restart

# Check system health
npm run system:health
```

## 🔒 Risk Management

### **Pre-Live Trading Checklist**

- [ ] **Paper Trading Tested**: Run for at least 1 week
- [ ] **Risk Limits Set**: Max daily loss, position size
- [ ] **Stop Losses Configured**: 2% default stop loss
- [ ] **Notifications Enabled**: Telegram/Email alerts
- [ ] **Backup Plan**: Manual intervention capability
- [ ] **Capital Allocation**: Only risk what you can afford to lose

### **Risk Parameters**

```env
# Conservative Settings (Recommended)
MAX_DAILY_LOSS=5000
MAX_RISK_PER_TRADE=0.02
STOP_LOSS_PERCENTAGE=2.0
TAKE_PROFIT_PERCENTAGE=4.0
MAX_POSITION_SIZE=0.1

# Aggressive Settings (Use with caution)
MAX_DAILY_LOSS=10000
MAX_RISK_PER_TRADE=0.05
STOP_LOSS_PERCENTAGE=3.0
TAKE_PROFIT_PERCENTAGE=6.0
MAX_POSITION_SIZE=0.2
```

## 📱 Notifications Setup

### **Telegram Notifications (Recommended)**

1. **Create Telegram Bot:**

   - Message @BotFather on Telegram
   - Create new bot: `/newbot`
   - Get bot token

2. **Get Chat ID:**

   - Message your bot
   - Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find your chat_id

3. **Configure in .env:**

```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

### **Email Notifications**

```env
EMAIL_NOTIFICATIONS=true
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_USERNAME=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
```

## 🚨 Emergency Procedures

### **Immediate Stop**

```bash
# Emergency stop
npm run trading:stop

# Kill all processes
pkill -f "ts-node.*trading"
```

### **Manual Position Management**

```bash
# Check positions
npm run trading:status

# Close all positions manually via Zerodha console
```

### **System Recovery**

```bash
# Restart system
npm run trading:restart

# Check logs for errors
npm run logs:error

# Verify database
npm run db:health
```

## 📈 Performance Monitoring

### **Key Metrics to Monitor**

- **Win Rate**: Should be >50%
- **Profit Factor**: Should be >1.5
- **Max Drawdown**: Should be <10%
- **Sharpe Ratio**: Should be >1.0
- **Daily P&L**: Monitor for consistency

### **Performance Commands**

```bash
# Get performance metrics
npm run system:status

# Generate risk report
npm run risk:report

# View performance dashboard
npm run dashboard
```

## 🔧 Troubleshooting

### **Common Issues**

1. **Authentication Failed**

   ```bash
   # Re-authenticate
   npm run auth:example
   ```

2. **Database Connection Error**

   ```bash
   # Check database
   npm run db:check
   npm run db:health
   ```

3. **No Market Data**

   ```bash
   # Check WebSocket connection
   npm run trading:status
   ```

4. **High Error Rate**
   ```bash
   # Check logs
   npm run logs:error
   npm run logs:view
   ```

### **Performance Issues**

```bash
# CPU optimization
npm run cpu:optimize

# Performance test
npm run performance:test

# Database optimization
npm run db:optimize
```

## 📋 Daily Checklist

### **Before Market Opens**

- [ ] Check system status: `npm run trading:status`
- [ ] Verify database connection: `npm run db:health`
- [ ] Check notifications: `npm run test-telegram`
- [ ] Review previous day's performance
- [ ] Adjust risk parameters if needed

### **During Trading Hours**

- [ ] Monitor dashboard: `npm run dashboard`
- [ ] Check for error notifications
- [ ] Monitor position sizes
- [ ] Verify stop losses are active

### **After Market Closes**

- [ ] Review daily performance
- [ ] Check for any failed orders
- [ ] Update ML model if needed
- [ ] Backup trading data

## 🎯 Best Practices

### **Risk Management**

1. **Start Small**: Begin with small position sizes
2. **Set Limits**: Always use stop losses and take profits
3. **Monitor Daily**: Check performance daily
4. **Diversify**: Don't put all capital in one strategy
5. **Keep Records**: Maintain detailed trading logs

### **System Management**

1. **Regular Backups**: Backup database regularly
2. **Monitor Resources**: Check CPU, memory usage
3. **Update Regularly**: Keep system updated
4. **Test Changes**: Always test in paper mode first
5. **Have Backup Plan**: Manual trading capability

### **Performance Optimization**

1. **Optimize Database**: Regular maintenance
2. **Monitor Latency**: Check execution speed
3. **Update ML Models**: Retrain periodically
4. **Review Strategy**: Adjust parameters based on performance

## 🚀 Quick Start Commands

```bash
# Complete setup and start
npm run trading:fullstart

# Quick start with paper trading
npm run trading:quickstart

# Start ML + Auto trading
npm run trading:ml-auto

# Monitor everything
npm run dashboard
```

## 📞 Support

If you encounter issues:

1. **Check Logs**: `npm run logs:error`
2. **Verify Configuration**: `npm run config:validate`
3. **Test Components**: `npm run system:health`
4. **Review Documentation**: Check project docs

---

**⚠️ Important Disclaimer:**

- This is automated trading software
- Past performance doesn't guarantee future results
- Only trade with capital you can afford to lose
- Always test thoroughly in paper mode first
- Monitor the system continuously
- Have manual intervention capability ready
