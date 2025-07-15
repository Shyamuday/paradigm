# 📊 Tokens and Market Data Management Guide

This guide shows you how to get all available tokens (instruments) from Zerodha and manage market data manually with time intervals.

## 🚀 Quick Start

### Run the Examples

```bash
# Simple tokens manager (recommended for beginners)
npm run tokens:all

# Advanced instruments data manager
npm run tokens:advanced
```

## 📋 Available Methods

### 1. Get All Instruments/Tokens

```typescript
import { createAutoTOTPAuth } from "./src/auth/easy-auth";
import { InstrumentsManager } from "./src/services/instruments-manager.service";

// Initialize
const auth = await createAutoTOTPAuth();
const manager = new InstrumentsManager(auth);

// Get ALL instruments from all exchanges
const allInstruments = await manager.getAllInstruments();
console.log(`Total instruments: ${allInstruments.length}`);

// Get instruments from specific exchange
const nseInstruments = await manager.getInstrumentsByExchange("NSE");
const bseInstruments = await manager.getInstrumentsByExchange("BSE");
const nfoInstruments = await manager.getInstrumentsByExchange("NFO"); // Options & Futures
```

### 2. Search and Filter Instruments

```typescript
// Search by symbol or name
const searchResults = manager.searchInstruments("RELIANCE");
const tcsResults = manager.searchInstruments("TCS");

// Filter by instrument type
const equityStocks = allInstruments.filter(
  (inst) => inst.instrument_type === "EQ"
);
const futureContracts = allInstruments.filter(
  (inst) => inst.instrument_type === "FUT"
);
const optionContracts = allInstruments.filter(
  (inst) => inst.instrument_type === "CE" || inst.instrument_type === "PE"
);

// Filter by exchange
const nseEquity = allInstruments.filter(
  (inst) => inst.exchange === "NSE" && inst.instrument_type === "EQ"
);
```

### 3. Get Market Data

```typescript
// Get instrument tokens
const selectedTokens = [738561, 2885633, 408065]; // RELIANCE, TCS, INFY tokens

// Get Last Traded Price (LTP) - Fastest method
const ltps = await manager.getLTP(selectedTokens);
ltps.forEach((price, token) => {
  console.log(`Token ${token}: ₹${price}`);
});

// Get full market quotes with OHLC, volume, etc.
const quotes = await manager.getMarketQuotes(selectedTokens);
quotes.forEach((quote, token) => {
  console.log(`Token ${token}:`);
  console.log(`  LTP: ₹${quote.last_price}`);
  console.log(
    `  OHLC: ${quote.ohlc.open}/${quote.ohlc.high}/${quote.ohlc.low}/${quote.ohlc.close}`
  );
  console.log(`  Volume: ${quote.volume}`);
  console.log(`  Change: ${quote.net_change}%`);
});

// Get OHLC data only
const ohlcData = await manager.getOHLC(selectedTokens);
```

### 4. Manual Time-Based Monitoring

```typescript
// Setup manual monitoring with custom intervals
const selectedTokens = [738561, 2885633]; // RELIANCE, TCS

// Add to watchlist
manager.addToWatchlist(selectedTokens);

// Method 1: Manual polling with custom interval
const updateInterval = setInterval(async () => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n⏰ Update at ${timestamp}`);

  // Get fresh data
  const ltps = await manager.getLTP(selectedTokens);
  ltps.forEach((price, token) => {
    console.log(`Token ${token}: ₹${price}`);
  });
}, 10000); // 10 seconds

// Stop after 2 minutes
setTimeout(() => {
  clearInterval(updateInterval);
  console.log("Monitoring stopped");
}, 120000);

// Method 2: Using built-in auto-updates
manager.startAutoUpdates(30000); // 30 seconds

// Get cached data anytime
const cachedData = manager.getAllMarketData();
cachedData.forEach((quote, token) => {
  console.log(`Cached: Token ${token} = ₹${quote.last_price}`);
});

// Stop auto-updates
manager.stopAutoUpdates();
```

### 5. Historical Data

```typescript
// Get historical data for analysis
const relianceToken = 738561;
const fromDate = "2024-01-01";
const toDate = "2024-01-31";

const historicalData = await manager.getHistoricalData(
  relianceToken,
  "day", // interval: 'minute', '5minute', '15minute', 'hour', 'day'
  fromDate,
  toDate
);

// Analyze historical data
historicalData.forEach((data) => {
  console.log(
    `${data.date}: O:${data.open} H:${data.high} L:${data.low} C:${data.close} V:${data.volume}`
  );
});

// Calculate moving averages, trends, etc.
const closePrices = historicalData.map((d) => d.close);
const average = closePrices.reduce((a, b) => a + b, 0) / closePrices.length;
```

## 📊 Data Structure Reference

### Instrument Object

```typescript
interface ZerodhaInstrument {
  instrument_token: number; // Unique token for API calls
  exchange_token: number; // Exchange-specific token
  tradingsymbol: string; // Trading symbol (e.g., "RELIANCE")
  name: string; // Company name
  last_price: number; // Last traded price
  expiry: string; // Expiry date (for F&O)
  strike: number; // Strike price (for options)
  tick_size: number; // Minimum price movement
  lot_size: number; // Minimum quantity
  instrument_type: string; // EQ, FUT, CE, PE, etc.
  segment: string; // Market segment
  exchange: string; // NSE, BSE, NFO, etc.
}
```

### Market Quote Object

```typescript
interface MarketQuote {
  instrument_token: number;
  last_price: number;
  last_quantity: number;
  average_price: number;
  volume: number;
  buy_quantity: number;
  sell_quantity: number;
  ohlc: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  net_change: number; // Percentage change
  oi: number; // Open interest (F&O)
  timestamp: string;
  last_trade_time: string;
}
```

## 🔧 Practical Examples

### Example 1: Monitor Top 10 NSE Stocks

```typescript
async function monitorTopStocks() {
  const auth = await createAutoTOTPAuth();
  const manager = new InstrumentsManager(auth);

  // Get NSE equity instruments
  const nseEquity = await manager.getInstrumentsByExchange("NSE");
  const topStocks = nseEquity
    .filter((inst) => inst.instrument_type === "EQ")
    .slice(0, 10);

  const tokens = topStocks.map((stock) => stock.instrument_token);

  // Monitor every 30 seconds
  setInterval(async () => {
    const quotes = await manager.getMarketQuotes(tokens);
    console.log("\n📊 Top 10 NSE Stocks:");
    quotes.forEach((quote, token) => {
      const stock = topStocks.find((s) => s.instrument_token === token);
      console.log(
        `${stock?.tradingsymbol}: ₹${
          quote.last_price
        } (${quote.net_change.toFixed(2)}%)`
      );
    });
  }, 30000);
}
```

### Example 2: Track Nifty 50 Stocks

```typescript
async function trackNifty50() {
  const auth = await createAutoTOTPAuth();
  const manager = new InstrumentsManager(auth);

  // Nifty 50 stock symbols
  const nifty50Symbols = [
    "RELIANCE",
    "TCS",
    "HDFCBANK",
    "INFY",
    "HINDUNILVR",
    "ICICIBANK",
    "KOTAKBANK",
    "SBIN",
    "BHARTIARTL",
    "ITC",
    // Add more symbols as needed
  ];

  const allInstruments = await manager.getAllInstruments();
  const nifty50Tokens = nifty50Symbols
    .map((symbol) =>
      allInstruments.find((inst) => inst.tradingsymbol === symbol)
    )
    .filter((inst) => inst !== undefined)
    .map((inst) => inst!.instrument_token);

  // Real-time monitoring
  manager.addToWatchlist(nifty50Tokens);
  manager.startAutoUpdates(5000); // 5 seconds

  // Check every minute
  setInterval(() => {
    const marketData = manager.getAllMarketData();
    let gainers = 0;
    let losers = 0;

    marketData.forEach((quote) => {
      if (quote.net_change > 0) gainers++;
      else if (quote.net_change < 0) losers++;
    });

    console.log(`📊 Nifty 50 Status: ${gainers} gainers, ${losers} losers`);
  }, 60000);
}
```

### Example 3: Options Chain Monitoring

```typescript
async function monitorOptionsChain() {
  const auth = await createAutoTOTPAuth();
  const manager = new InstrumentsManager(auth);

  // Get NFO instruments (Options & Futures)
  const nfoInstruments = await manager.getInstrumentsByExchange("NFO");

  // Filter NIFTY options for current month
  const niftyOptions = nfoInstruments.filter(
    (inst) =>
      (inst.name === "NIFTY" && inst.instrument_type === "CE") ||
      inst.instrument_type === "PE"
  );

  // Group by strike price
  const optionsByStrike = niftyOptions.reduce((acc, option) => {
    const strike = option.strike;
    if (!acc[strike]) acc[strike] = { CE: null, PE: null };
    if (option.instrument_type === "CE") acc[strike].CE = option;
    if (option.instrument_type === "PE") acc[strike].PE = option;
    return acc;
  }, {} as Record<number, { CE: any; PE: any }>);

  // Monitor specific strikes
  const strikesToMonitor = [17000, 17100, 17200, 17300, 17400];
  const tokensToMonitor: number[] = [];

  strikesToMonitor.forEach((strike) => {
    const options = optionsByStrike[strike];
    if (options?.CE) tokensToMonitor.push(options.CE.instrument_token);
    if (options?.PE) tokensToMonitor.push(options.PE.instrument_token);
  });

  // Monitor options prices
  setInterval(async () => {
    const quotes = await manager.getMarketQuotes(tokensToMonitor);
    console.log("\n📊 NIFTY Options Chain:");
    quotes.forEach((quote, token) => {
      const option = niftyOptions.find((opt) => opt.instrument_token === token);
      console.log(
        `${option?.tradingsymbol}: ₹${quote.last_price} (OI: ${quote.oi})`
      );
    });
  }, 30000);
}
```

### Example 4: Export and Save Data

```typescript
async function exportMarketData() {
  const auth = await createAutoTOTPAuth();
  const manager = new InstrumentsManager(auth);

  // Monitor some stocks
  const tokens = [738561, 2885633, 408065]; // RELIANCE, TCS, INFY
  manager.addToWatchlist(tokens);

  // Update data every 10 seconds
  manager.startAutoUpdates(10000);

  // Export data every 5 minutes
  setInterval(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    manager.exportMarketData(`market_data_${timestamp}.json`);
    console.log(`📁 Data exported at ${new Date().toLocaleTimeString()}`);
  }, 300000); // 5 minutes
}
```

## 🎯 Best Practices

### 1. Rate Limiting

- Don't make too many API calls per second
- Use the built-in caching system
- Batch multiple instrument requests

### 2. Error Handling

```typescript
try {
  const quotes = await manager.getMarketQuotes(tokens);
} catch (error) {
  console.log("Failed to get quotes:", error);
  // Implement retry logic
}
```

### 3. Memory Management

```typescript
// Clear old data periodically
setInterval(() => {
  manager.clearOldData(); // If implemented
}, 3600000); // 1 hour
```

### 4. Data Persistence

```typescript
// Save important data to files
manager.exportMarketData("daily_data.json");

// Load data from files
const savedData = JSON.parse(fs.readFileSync("daily_data.json", "utf8"));
```

## 🚀 Available Scripts

```bash
# Run simple tokens manager
npm run tokens:all

# Run advanced instruments data manager
npm run tokens:advanced

# Test authentication
npm run auth:test

# Start trading bot
npm run dev
```

## 📁 Output Files

The system automatically creates these files in the `data/` directory:

- `instruments.json` - All available instruments
- `market_data_export.json` - Current market data
- `zerodha-auto-session.json` - Authentication session
- Custom export files with timestamps

## 🔧 Customization

You can extend the `InstrumentsManager` class to add:

- Custom filters and sorting
- Technical indicators
- Alert systems
- Database integration
- WebSocket connections for real-time data

---

**🎉 You now have complete control over all Zerodha tokens and market data with manual time management!**
