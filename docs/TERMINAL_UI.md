# Terminal UI Guide

The terminal-based dashboard provides a comprehensive view of your trading activities with real-time updates and interactive controls.

## Layout

The dashboard is divided into several panels:

### 1. Market Data Panel (Top Left)

- Real-time price updates
  - Last traded price (LTP)
  - Open, High, Low, Close
  - Volume
  - Price change and percentage
- Instrument details
  - Symbol and exchange
  - Instrument type
  - Lot size and tick size

### 2. Positions Panel (Top Right)

- Current open positions
  - Symbol and side (LONG/SHORT)
  - Quantity and average price
  - Current market price
  - Unrealized P&L
  - Stop-loss and target levels
  - Position status

### 3. Orders Panel (Middle Left)

- Order details
  - Symbol and action (BUY/SELL)
  - Order type (MARKET, LIMIT)
  - Quantity and price
  - Status (PENDING, COMPLETE, CANCELLED)
  - Execution time
  - Strategy name (if applicable)

### 4. P&L Graph (Middle Right)

- Real-time P&L visualization
  - Session P&L curve
  - Realized vs Unrealized P&L
  - Drawdown tracking
  - Performance metrics

### 5. Strategy Status (Bottom Left)

- Moving Average Strategy
  - Short MA (10 period) value
  - Long MA (20 period) value
  - Volume threshold status
  - Latest signals
  - ATR and risk levels

### 6. Authentication Status (Bottom Right)

- Connection status
- Session information
- API quota usage
- Last data update time

## Controls

### General Navigation

- `Arrow Keys`: Navigate between panels
- `Tab`: Cycle through panels
- `Esc`: Exit focused mode
- `q`: Quit application

### Data Controls

- `r`: Manual refresh
- `t`: Enter TOTP when prompted

## Real-time Updates

The dashboard automatically updates with:

- Market data: Every 1 second
- Positions: Every 2 seconds
- Orders: Every 2 seconds
- P&L calculations: Every 5 seconds
- Strategy signals: As generated

## Data Display

### Position Information

```
NIFTY (LONG)
Qty: 50 | Avg: 21500.00
Current: 21550.00
P&L: +2,500.00 (+1.16%)
SL: 21400.00 | Target: 21700.00
```

### Strategy Information

```
Moving Average (10,20)
Short MA: 21545.50
Long MA: 21532.25
Volume: 1.5M
ATR: 25.50
Last Signal: BUY
```

### Session Status

```
Status: Connected
Session: Active (Paper)
API Calls: 120/200
Last Update: 10:30:15
```

## Error Handling

The UI displays:

- Connection issues (red status)
- Authentication failures (yellow warning)
- Order rejections (pop-up notifications)
- Strategy errors (status panel alerts)

## Best Practices

1. Regular Monitoring

   - Check P&L updates frequently
   - Monitor position sizes
   - Watch for strategy signals

2. Risk Management

   - Keep track of total exposure
   - Monitor stop-loss levels
   - Check unrealized P&L

3. System Health
   - Monitor API quota usage
   - Check connection status
   - Verify data freshness

## Troubleshooting

Common issues and solutions:

1. Data Not Updating

   - Check connection status
   - Verify API quota
   - Try manual refresh (r)

2. Authentication Issues

   - Check session status
   - Re-enter TOTP if prompted
   - Verify API credentials

3. Position Discrepancies
   - Refresh data manually
   - Cross-check with broker platform
   - Check error logs

## Support

For technical issues:

- Check `logs/trading-bot.log` for general logs
- Check `logs/error.log` for error details
- Contact system administrator for persistent issues
