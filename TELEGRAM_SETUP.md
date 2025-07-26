# Telegram Notification Setup Guide

This guide will help you set up Telegram notifications for your personal trading system.

## 🚀 Quick Setup

### Step 1: Create a Telegram Bot

1. **Open Telegram** and search for `@BotFather`
2. **Start a chat** with BotFather
3. **Send the command**: `/newbot`
4. **Follow the prompts**:
   - Enter a name for your bot (e.g., "My Trading Bot")
   - Enter a username (must end with 'bot', e.g., "mytradingbot123")
5. **Save the bot token** that BotFather gives you

### Step 2: Get Your Chat ID

1. **Start a chat** with your new bot
2. **Send any message** to the bot (e.g., "Hello")
3. **Visit this URL** in your browser (replace with your bot token):
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
4. **Find your chat ID** in the response (it's a number like `123456789`)

### Step 3: Configure Environment Variables

Add these to your `.env` file:

```bash
# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

### Step 4: Test the Connection

```bash
# Test Telegram connection
npm run test-telegram
```

## 📱 Notification Types

### 1. Trade Signals 🟢🔴

- **When**: Strategy generates buy/sell signals
- **Info**: Symbol, action, price, confidence, reasoning
- **Example**:

  ```
  🟢 TRADE SIGNAL 🟢

  📊 Symbol: NIFTY
  🎯 Action: BUY
  💰 Price: ₹19,250.00
  📈 Confidence: ████████░░ (80%)
  🤖 Strategy: Moving Average Crossover
  💭 Reasoning: Short MA crossed above Long MA
  ```

### 2. Trade Executions ✅❌

- **When**: Orders are executed or fail
- **Info**: Symbol, action, quantity, price, order ID, status
- **Example**:

  ```
  ✅ TRADE EXECUTED ✅

  📊 Symbol: NIFTY
  🎯 Action: BUY
  📦 Quantity: 50
  💰 Price: ₹19,250.00
  🆔 Order ID: 12345678
  📊 Status: SUCCESS
  ```

### 3. Position Updates 📊

- **When**: Position P&L changes
- **Info**: Current price, unrealized P&L, percentage change
- **Example**:

  ```
  📊 POSITION UPDATE 📊

  🟢 NIFTY (LONG)
  📦 Quantity: 50
  💰 Entry: ₹19,250.00
  📊 Current: ₹19,300.00
  📈 P&L: ₹2,500.00 (2.60%)
  ```

### 4. Performance Updates 📈📉

- **When**: Regular intervals (configurable)
- **Info**: Total P&L, daily P&L, win rate, trades count
- **Example**:

  ```
  📊 PERFORMANCE UPDATE 📊

  📈 Total P&L: ₹15,250.00
  📈 Daily P&L: ₹2,500.00
  📈 Win Rate: 65.5%
  📊 Total Trades: 45
  🔓 Open Positions: 2
  💰 Capital: ₹100,000.00
  ```

### 5. System Alerts ⚠️🚨

- **When**: System events, warnings, errors
- **Types**: INFO, WARNING, ERROR, CRITICAL
- **Example**:

  ```
  🚨 CRITICAL ALERT 🚨

  ⚠️ Message: Daily loss limit reached (₹5,000)
  ⏰ Time: 2024-01-15 14:30:00

  🚨 Action Required: Immediate action required - stop trading if necessary
  ```

### 6. Daily Reports 📅

- **When**: End of trading day (3:30 PM)
- **Info**: Complete daily summary with statistics
- **Example**:

  ```
  📅 DAILY TRADING REPORT 📅

  📊 Date: 2024-01-15
  💰 Total P&L: ₹15,250.00
  📈 Win Rate: 65.5%
  📊 Total Trades: 45
  📈 Winning Trades: 30
  📉 Losing Trades: 15
  📊 Average Win: ₹850.00
  📊 Average Loss: ₹350.00
  ```

### 7. Error Alerts ❌

- **When**: System errors occur
- **Info**: Error message, context, stack trace
- **Example**:

  ```
  🚨 ERROR ALERT 🚨

  ❌ Error: API connection failed
  📝 Context: Market Data Fetch
  ⏰ Time: 2024-01-15 14:30:00
  📊 Stack: at getMarketData (trading.ts:123)

  🔧 Action: Please check system logs and take necessary action.
  ```

## ⚙️ Configuration Options

### Enable/Disable Notifications

Edit `config/personal-trading-config.yaml`:

```yaml
telegram:
  enabled: true
  botToken: "${TELEGRAM_BOT_TOKEN}"
  chatId: "${TELEGRAM_CHAT_ID}"
  notifications:
    tradeSignals: true # Buy/sell signals
    tradeExecutions: true # Order executions
    positionUpdates: true # Position P&L updates
    performanceUpdates: true # Regular performance updates
    systemAlerts: true # System warnings/errors
    dailyReports: true # End-of-day reports
    errorAlerts: true # Error notifications
  updateInterval: 30 # Performance update frequency (minutes)
```

### Customize Update Frequency

```yaml
telegram:
  updateInterval: 15 # Send performance updates every 15 minutes
```

## 🔧 Advanced Features

### 1. Message Queue

- Prevents rate limiting
- Queues messages if bot is slow
- Automatic retry on failures

### 2. Rate Limiting

- Respects Telegram's rate limits
- 1-second delay between messages
- Prevents bot blocking

### 3. Error Handling

- Graceful failure handling
- Continues trading if Telegram fails
- Logs all notification attempts

### 4. Custom Messages

- Send custom alerts anytime
- Market updates
- Strategy status
- Manual notifications

## 📱 Mobile Setup

### Telegram App

1. **Download Telegram** from App Store/Play Store
2. **Search for your bot** using the username
3. **Start a chat** with the bot
4. **Enable notifications** in Telegram settings

### Desktop Setup

1. **Download Telegram Desktop** from telegram.org
2. **Login** with your phone number
3. **Find your bot** and start chatting
4. **Pin the chat** for easy access

## 🚨 Emergency Commands

### Stop All Notifications

```bash
# Temporarily disable Telegram
export TELEGRAM_ENABLED=false
```

### Test Notifications

```bash
# Send test message
npm run test-telegram
```

### Check Bot Status

```bash
# Verify bot connection
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe
```

## 🔒 Security Best Practices

### 1. Bot Token Security

- **Never share** your bot token
- **Don't commit** to public repositories
- **Use environment variables**
- **Rotate tokens** periodically

### 2. Chat ID Privacy

- **Keep chat ID private**
- **Don't share** in public forums
- **Use private chats** only

### 3. Message Content

- **Avoid sensitive data** in messages
- **Don't include** account numbers
- **Use generic symbols** for positions

## 🎯 Pro Tips

### 1. Customize Notifications

```typescript
// Send custom market update
await telegramService.sendMarketUpdate(marketData);

// Send strategy status
await telegramService.sendStrategyStatus(strategies);

// Send custom message
await telegramService.sendCustomMessage("Custom alert message");
```

### 2. Filter Notifications

- **Enable only important** notifications initially
- **Add more** as you get comfortable
- **Disable noisy** notifications

### 3. Multiple Chat IDs

- **Add multiple users** to the bot
- **Share with trusted** family/friends
- **Create group chats** for team monitoring

### 4. Backup Notifications

- **Keep email alerts** as backup
- **Use webhooks** for critical alerts
- **Monitor system logs** regularly

## 🆘 Troubleshooting

### Common Issues

1. **Bot not responding**

   - Check bot token
   - Verify bot is not blocked
   - Restart the bot

2. **Messages not received**

   - Check chat ID
   - Verify bot is added to chat
   - Check notification settings

3. **Rate limiting**

   - Reduce update frequency
   - Check message queue
   - Wait for rate limit reset

4. **Connection errors**
   - Check internet connection
   - Verify API endpoints
   - Check firewall settings

### Debug Commands

```bash
# Test bot connection
npm run test-telegram

# Check message queue
tail -f logs/telegram.log

# Verify environment
echo $TELEGRAM_BOT_TOKEN
echo $TELEGRAM_CHAT_ID
```

## 📞 Support

### Getting Help

1. **Check logs** in `logs/telegram.log`
2. **Test connection** with curl
3. **Verify configuration** in `.env`
4. **Contact support** if needed

### Useful Links

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [BotFather Commands](https://core.telegram.org/bots#botfather)
- [Telegram Web](https://web.telegram.org)

---

**Remember**: Keep your bot token and chat ID secure. Never share them publicly!
