# Paradigm Trading System

A comprehensive trading system with **automatic TOTP-based authentication** for Zerodha, real-time market data processing, strategy execution, and terminal-based UI.

## 🔐 Authentication System

This project uses a **fully automatic TOTP-based authentication** system for Zerodha. No manual input required!

### Key Features

- **🚀 Fully Automatic**: Zero manual intervention required
- **🔒 TOTP-Only**: Uses Time-based One-Time Passwords for secure authentication
- **💾 Session Management**: Automatically saves and reuses sessions
- **🔄 Auto-Retry**: Automatically re-authenticates when sessions expire
- **⚡ Fast**: Direct API calls without browser automation

### Quick Setup

1. **Configure your credentials** in `.env`:

   ```env
   ZERODHA_API_KEY=your_api_key_here
   ZERODHA_API_SECRET=your_api_secret_here
   ZERODHA_USER_ID=your_zerodha_user_id
   ZERODHA_PASSWORD=your_zerodha_password
   ZERODHA_TOTP_SECRET=your_base32_totp_secret
   ```

2. **Test authentication**:

   ```bash
   npm run auth:test
   ```

3. **Start the bot**:
   ```bash
   npm run dev
   ```

### 📚 Documentation

- **[AUTO_TOTP_SETUP.md](docs/AUTO_TOTP_SETUP.md)** - Complete setup guide
- **[TOKENS_AND_DATA_MANAGEMENT.md](docs/TOKENS_AND_DATA_MANAGEMENT.md)** - Get all tokens and manage data manually
- **[Project Documentation](docs/PROJECT_DOCUMENTATION.md)** - Full project overview

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
- Multi-panel layout

### Data Processing

- Real-time market data handling
- Tick and candle data storage
- Historical data access
- Database integration

## Getting Started

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd paradigm
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Setup environment variables**

   ```bash
   cp env.example .env
   # Edit .env with your credentials
   ```

4. **Test authentication**

   ```bash
   npm run auth:test
   ```

5. **Start the trading bot**
   ```bash
   npm run dev
   ```

## Available Scripts

### Authentication

- `npm run auth:test` - Test automatic TOTP authentication
- `npm run auth:auto` - Run authentication example

### Tokens & Market Data

- `npm run tokens:all` - Get all available tokens and manage data manually
- `npm run tokens:advanced` - Advanced instruments data management

### Trading Bot

- `npm run dev` - Start the trading bot
- `npm run dashboard` - Launch terminal dashboard
- `npm run bot:test` - Test complete system

## 🔧 Authentication Methods

### Method 1: Simple Helper Function

```typescript
import { createAutoTOTPAuth } from "./src/auth/easy-auth";

const auth = await createAutoTOTPAuth(); // Automatic!
const profile = await auth.apiCall("/user/profile");
```

### Method 2: Direct Configuration

```typescript
import { AutoTOTPZerodhaAuth } from "./src/auth/easy-auth";

const auth = new AutoTOTPZerodhaAuth({
  apiKey: "your_api_key",
  apiSecret: "your_api_secret",
  userId: "your_user_id",
  password: "your_password",
  totpSecret: "your_base32_totp_secret",
});

await auth.authenticate();
```

## 📁 Project Structure

```
paradigm/
├── src/
│   ├── auth/                 # TOTP-based authentication
│   │   ├── easy-auth.ts      # Main authentication class
│   │   └── auto-totp-example.ts # Example usage
│   ├── services/             # Core trading services
│   ├── ui/                   # Terminal dashboard
│   └── types/                # TypeScript definitions
├── docs/                     # Documentation
├── config/                   # Configuration files
└── logs/                     # Application logs
```

## 🔒 Security Features

- All credentials stored in environment variables
- Session tokens automatically managed
- TOTP secrets never logged or exposed
- Automatic session validation and renewal

## 🐛 Troubleshooting

1. **Authentication Issues**: Check that all environment variables are set correctly
2. **TOTP Problems**: Ensure your system time is accurate
3. **Session Errors**: Delete `data/zerodha-auto-session.json` to force re-authentication

For detailed troubleshooting, see the [AUTO_TOTP_SETUP.md](docs/AUTO_TOTP_SETUP.md) guide.

## 📊 API Usage

Once authenticated, you can use any Zerodha API endpoint:

```typescript
const auth = await createAutoTOTPAuth();

// Get user profile
const profile = await auth.apiCall("/user/profile");

// Get portfolio
const holdings = await auth.apiCall("/portfolio/holdings");

// Place order
const order = await auth.apiCall("/orders/regular", "POST", {
  exchange: "NSE",
  tradingsymbol: "RELIANCE",
  transaction_type: "BUY",
  quantity: 1,
  order_type: "MARKET",
  product: "CNC",
});
```

---

**🎉 Ready to trade with automatic TOTP authentication!**
