# Troubleshooting Guide

Quick solutions to common issues with your personal trading system.

## 🚨 Emergency Issues

### System Won't Start

```bash
# Check if Node.js is installed
node --version

# Check if dependencies are installed
npm list

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Trading System Crashed

```bash
# Stop all processes
npm run trading:stop

# Check logs for errors
tail -f logs/trading.log

# Restart system
npm run trading:personal
```

### Emergency Stop Trading

```bash
# Immediate stop
npm run trading:stop

# Close all positions
npm run close-positions

# Emergency shutdown
npm run emergency-stop
```

---

## 🔑 API Issues

### Zerodha API Connection Failed

**Error**: `API connection failed` or `Invalid API key`

**Solutions**:

```bash
# 1. Check API credentials
echo $KITE_API_KEY
echo $KITE_API_SECRET
echo $KITE_ACCESS_TOKEN

# 2. Test API connection
npm run test-api

# 3. Regenerate access token
npm run auth:example

# 4. Check if token is expired
# Access tokens expire daily, regenerate at kite.trade
```

**Common Causes**:

- ❌ Expired access token (regenerate daily)
- ❌ Wrong API key/secret
- ❌ API not enabled in Zerodha account
- ❌ Network connectivity issues

### API Rate Limiting

**Error**: `Rate limit exceeded`

**Solutions**:

```bash
# 1. Reduce API calls frequency
# Edit config to increase intervals

# 2. Check current usage
npm run api:status

# 3. Wait for rate limit reset
# Zerodha resets limits at midnight
```

---

## 🤖 Telegram Issues

### Bot Not Responding

**Error**: `Telegram bot connection failed`

**Solutions**:

```bash
# 1. Test bot connection
npm run test-telegram

# 2. Check bot token
echo $TELEGRAM_BOT_TOKEN

# 3. Verify bot is not blocked
curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe

# 4. Check if bot is deleted
# Create new bot with @BotFather if needed
```

**Common Causes**:

- ❌ Wrong bot token
- ❌ Bot was deleted
- ❌ Bot is blocked
- ❌ Network issues

### Messages Not Received

**Error**: No Telegram notifications

**Solutions**:

```bash
# 1. Check chat ID
echo $TELEGRAM_CHAT_ID

# 2. Verify bot is added to chat
# Start chat with bot and send "Hello"

# 3. Check notification settings
# Enable notifications in Telegram app

# 4. Test with manual message
npm run test-telegram
```

**Common Causes**:

- ❌ Wrong chat ID
- ❌ Bot not added to chat
- ❌ Notifications disabled
- ❌ Bot blocked by user

### Rate Limiting

**Error**: `Too many requests`

**Solutions**:

```bash
# 1. Reduce notification frequency
# Edit config/personal-trading-config.yaml
# Increase updateInterval

# 2. Disable some notifications
# Set notifications to false for less important ones

# 3. Wait for rate limit reset
# Telegram resets every hour
```

---

## 📊 Trading Issues

### No Trade Signals Generated

**Problem**: Strategies not generating signals

**Solutions**:

```bash
# 1. Check market data
npm run market-data:test

# 2. Verify strategy configuration
cat config/personal-trading-config.yaml

# 3. Test individual strategies
npm run strategy:test

# 4. Check if within trading hours
# System only trades 9:15 AM - 3:30 PM IST
```

**Common Causes**:

- ❌ Outside trading hours
- ❌ No market data available
- ❌ Strategy parameters too strict
- ❌ Market conditions not suitable

### Orders Not Executing

**Problem**: Signals generated but orders not placed

**Solutions**:

```bash
# 1. Check account balance
npm run account:status

# 2. Verify instrument availability
npm run instruments:check

# 3. Check order parameters
# Review order type and quantity

# 4. Test order placement
npm run order:test
```

**Common Causes**:

- ❌ Insufficient balance
- ❌ Instrument not available
- ❌ Market closed
- ❌ Invalid order parameters

### Position Not Closing

**Problem**: Stop loss/take profit not working

**Solutions**:

```bash
# 1. Check position monitoring
npm run positions:status

# 2. Verify stop loss levels
# Check if stop loss is set correctly

# 3. Test position exit
npm run position:exit

# 4. Check market data accuracy
npm run market-data:test
```

**Common Causes**:

- ❌ Stop loss not set
- ❌ Market gap (price jumped over stop loss)
- ❌ Position monitoring disabled
- ❌ Network issues

---

## 💾 Database Issues

### Database Connection Failed

**Error**: `Database connection error`

**Solutions**:

```bash
# 1. Check database setup
npm run db:check

# 2. Reset database
npm run db:reset

# 3. Check file permissions
ls -la data/

# 4. Create database directory
mkdir -p data
chmod 755 data
```

### Database Corruption

**Error**: `Database is corrupted`

**Solutions**:

```bash
# 1. Backup current data
cp data/trading.db data/trading_backup_$(date +%Y%m%d).db

# 2. Reset database
npm run db:reset

# 3. Restore from backup if needed
cp data/trading_backup_*.db data/trading.db
```

---

## 🔧 Performance Issues

### System Running Slowly

**Problem**: High CPU/memory usage

**Solutions**:

```bash
# 1. Check system resources
top
df -h

# 2. Check for memory leaks
npm run memory:check

# 3. Reduce update frequency
# Edit config to increase intervals

# 4. Restart system
npm run trading:stop
npm run trading:personal
```

### High Memory Usage

**Solutions**:

```bash
# 1. Clear logs
rm -rf logs/*

# 2. Restart system
npm run trading:stop
npm run trading:personal

# 3. Check for memory leaks
npm run memory:check

# 4. Reduce data retention
# Edit config to reduce history
```

---

## 📱 Notification Issues

### Too Many Notifications

**Problem**: Getting spammed with notifications

**Solutions**:

```bash
# 1. Reduce notification frequency
# Edit config/personal-trading-config.yaml
telegram:
  updateInterval: 60  # Increase to 60 minutes

# 2. Disable less important notifications
notifications:
  positionUpdates: false
  performanceUpdates: false

# 3. Set notification thresholds
# Only notify for significant events
```

### Missing Notifications

**Problem**: Not receiving important alerts

**Solutions**:

```bash
# 1. Check notification settings
cat config/personal-trading-config.yaml

# 2. Enable all notifications
notifications:
  tradeSignals: true
  tradeExecutions: true
  systemAlerts: true
  errorAlerts: true

# 3. Test notifications
npm run test-telegram
```

---

## 🔍 Debug Commands

### System Diagnostics

```bash
# Check system health
npm run health:check

# Check all environment variables
env | grep -E "(KITE|TELEGRAM|TRADING)"

# Check system resources
top
df -h
free -h

# Check network connectivity
ping api.kite.trade
ping api.telegram.org
```

### Component Testing

```bash
# Test all components
npm run test:all

# Test individual components
npm run test-telegram
npm run test-api
npm run trading:test

# Test database
npm run db:check

# Test strategies
npm run strategy:test
```

### Log Analysis

```bash
# View live logs
tail -f logs/trading.log

# Search for errors
grep ERROR logs/trading.log

# Search for specific issues
grep "API" logs/trading.log
grep "Telegram" logs/trading.log
grep "Strategy" logs/trading.log

# View recent logs
tail -100 logs/trading.log
```

---

## 🛠️ Advanced Troubleshooting

### Enable Debug Mode

```bash
# Enable all debug logs
DEBUG=* npm run trading:personal

# Enable specific debug logs
DEBUG=telegram,api npm run trading:personal
```

### Reset Everything

```bash
# Complete system reset
npm run trading:stop
rm -rf logs/*
npm run db:reset
npm run trading:personal
```

### Check Configuration

```bash
# Validate configuration
npm run config:validate

# Show current configuration
npm run config:show

# Test configuration
npm run config:test
```

---

## 📞 Getting Help

### Before Contacting Support

1. **Check this guide** for your specific issue
2. **Run diagnostic commands**:
   ```bash
   npm run health:check
   npm run test:all
   ```
3. **Check logs** for error details:
   ```bash
   tail -f logs/trading.log
   ```
4. **Try restarting** the system:
   ```bash
   npm run trading:stop
   npm run trading:personal
   ```

### Information to Provide

When seeking help, provide:

- **Error message** (exact text)
- **System logs** (last 50 lines)
- **Configuration** (relevant parts)
- **Steps to reproduce** the issue
- **System information** (OS, Node.js version)

### Support Resources

- **Documentation**: `SETUP_GUIDE.md`
- **Telegram Setup**: `TELEGRAM_SETUP.md`
- **Configuration**: `config/personal-trading-config.yaml`
- **Logs**: `logs/trading.log`

---

## ⚠️ Common Mistakes

### Configuration Errors

- ❌ **Wrong API keys** - Double-check all credentials
- ❌ **Missing environment variables** - Ensure all required vars are set
- ❌ **Invalid chat ID** - Must be a number, not a string
- ❌ **Wrong file permissions** - Ensure data/logs directories are writable

### Operational Errors

- ❌ **Trading outside hours** - System only trades 9:15 AM - 3:30 PM IST
- ❌ **Insufficient balance** - Ensure enough funds for trading
- ❌ **Network issues** - Check internet connectivity
- ❌ **Expired tokens** - Regenerate Zerodha access token daily

### Security Issues

- ❌ **Sharing API keys** - Never share credentials
- ❌ **Public repository** - Don't commit .env file
- ❌ **Weak passwords** - Use strong, unique passwords
- ❌ **No backups** - Regularly backup configuration and data

---

**Remember**: Most issues can be resolved by checking logs and restarting the system. When in doubt, start with paper trading to test everything works correctly.
