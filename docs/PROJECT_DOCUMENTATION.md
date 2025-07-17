# Paradigm Trading System - Complete Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Trading Components](#trading-components)
5. [Authentication System](#authentication-system)
6. [Risk Management](#risk-management)
7. [API Integration](#api-integration)
8. [User Interface](#user-interface)
9. [Configuration](#configuration)
10. [Deployment](#deployment)
11. [Development Guide](#development-guide)
12. [Troubleshooting](#troubleshooting)

## System Overview

### Purpose

A comprehensive trading system that provides:

- Automated trading strategy execution
- Real-time market data processing
- Position and risk management
- Terminal-based monitoring interface

### Key Features

- Moving Average Crossover strategy with volume filtering
- Real-time P&L tracking and position management
- Terminal-based UI with multiple data panels
- PostgreSQL database with Prisma ORM
- Authentication with TOTP support
- Comprehensive logging and monitoring

## Architecture

### Service Layer

1. **StrategyService** (`src/services/strategy.service.ts`)

   - Strategy execution and signal generation
   - Technical indicator calculations
   - Trading signal management

   ```typescript
   interface MovingAverageConfig {
     shortPeriod: number;
     longPeriod: number;
     volumeThreshold?: number;
   }
   ```

2. **OrderService** (`src/services/order.service.ts`)

   - Order creation and management
   - Position tracking
   - P&L calculations

   ```typescript
   async createTrade(sessionId: string, signal: TradeSignal, strategyId?: string)
   async updateTradeStatus(tradeId: string, status: string, orderId?: string)
   async calculatePositionPnL(position: any, closePrice: number): Promise<number>
   ```

3. **MarketDataService** (`src/services/market-data.service.ts`)

   - Real-time market data handling
   - Historical data management
   - Instrument configuration

   ```typescript
   async saveTickData(tickData: TickData)
   async saveCandleData(candleData: CandleData)
   async getHistoricalData(symbol: string, from: Date, to: Date)
   ```

4. **AuthManagerService** (`src/services/auth-manager.service.ts`)
   - API authentication
   - Session management
   - TOTP verification

### Database Layer

- PostgreSQL with Prisma ORM
- Comprehensive schema for all trading components
- Efficient querying and relationship management

### UI Layer

- Terminal-based dashboard using blessed and blessed-contrib
- Real-time data updates
- Interactive controls
- Multi-panel layout

## Database Schema

### Core Tables

1. **User**

   - Authentication and session management
   - Risk profile association
   - API usage tracking

2. **TradingSession**

   - Trading activity grouping
   - Capital and mode management
   - Performance tracking

3. **Instrument**

   - Market instrument details
   - Trading parameters
   - Historical data association

4. **Trade**

   - Order execution records
   - Position management
   - P&L tracking

5. **Position**
   - Current holdings
   - Risk parameters
   - Performance metrics

### Risk Management Tables

1. **RiskProfile**

   - User-specific risk parameters
   - Position size limits
   - Loss thresholds

2. **RiskMetrics**
   - Performance tracking
   - Risk exposure monitoring
   - Historical analysis

### Market Data Tables

1. **MarketData**
   - Price and volume data
   - Technical indicators
   - Historical records

### System Tables

1. **SystemLog**
   - Application events
   - Error tracking
   - Performance monitoring

## Trading Components

### Strategy Implementation

1. **Moving Average Crossover**

   - Short and long period calculations
   - Volume threshold filtering
   - Signal generation logic

   ```typescript
   private calculateSMA(data: MarketDataPoint[], period: number): number[]
   private calculateATR(data: MarketDataPoint, period: number = 14): number
   ```

2. **Risk Management**

   - Dynamic stop-loss using ATR
   - Position sizing rules
   - Portfolio exposure limits

3. **Order Management**
   - Trade execution
   - Position tracking
   - P&L calculation
   ```typescript
   async createPosition(sessionId: string, tradeId: string, positionData: {...})
   async closePosition(positionId: string, closePrice: number)
   ```

### Market Data Processing

1. **Real-time Data**

   - Tick data processing
   - Price updates
   - Volume tracking

2. **Historical Data**
   - Candle data storage
   - Technical analysis
   - Backtesting support

## Authentication System

### Components

1. **API Authentication**

   - Token management
   - Session tracking
   - Error handling

2. **TOTP Implementation**
   - Time-based verification
   - Secure token generation
   - Session validation

### Security Features

- Encrypted credentials
- Rate limiting
- Session monitoring

## Risk Management

### Position Risk

1. **Stop Loss**

   - ATR-based dynamic levels
   - Trailing stop implementation
   - Multiple timeframe analysis

2. **Position Sizing**
   - Capital-based limits
   - Risk-adjusted sizing
   - Portfolio balance rules

### Portfolio Risk

1. **Exposure Limits**

   - Maximum position size
   - Sector exposure
   - Overall portfolio risk

2. **Loss Management**
   - Daily loss limits
   - Drawdown controls
   - Risk factor adjustments

## API Integration

### Market Data API

1. **Real-time Data**

   - WebSocket connections
   - Data transformation
   - Error handling

2. **Historical Data**
   - REST API integration
   - Data storage
   - Cache management

### Order API

1. **Order Execution**

   - Order placement
   - Status updates
   - Position reconciliation

2. **Account Management**
   - Balance tracking
   - Position verification
   - Order history

## User Interface

### Terminal Dashboard

1. **Market Data Panel**

   ```
   Symbol: NIFTY
   LTP: 21550.00 (+1.2%)
   Volume: 1.5M
   ```

2. **Position Panel**

   ```
   NIFTY (LONG)
   Qty: 50 | Avg: 21500.00
   P&L: +2,500.00 (+1.16%)
   ```

3. **Strategy Panel**
   ```
   MA(10,20)
   Short: 21545.50
   Long: 21532.25
   Signal: BUY
   ```

### Real-time Updates

- Market data: 1 second
- Positions: 2 seconds
- Orders: 2 seconds
- P&L: 5 seconds

## Configuration

### Trading Configuration

```yaml
trading:
  mode: "paper"
  capital: 100000
  max_daily_loss: 5000
  max_position_size: 0.1

strategies:
  simple_ma:
    enabled: true
    parameters:
      short_period: 10
      long_period: 20
      capital_allocation: 0.3
```

### Risk Configuration

```yaml
risk:
  default_stop_loss_percentage: 2.0
  trailing_stop_loss: true
  max_risk_per_trade: 0.02
  max_portfolio_risk: 0.1
```

## Deployment

### Requirements

- Node.js v18+
- PostgreSQL v13+
- Redis (optional)
- Linux/macOS recommended

### Installation

```bash
git clone <repository>
npm install
cp env.example .env
npx prisma migrate dev
```

### Environment Setup

```env
DATABASE_URL="postgresql://username:password@localhost:5432/paradigm_trading"
TRADING_MODE=paper
LOG_LEVEL=info
```

## Development Guide

### Adding Strategies

1. Create strategy class
2. Implement signal generation
3. Add configuration
4. Register in StrategyService

### Testing

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

### Logging

- Application: logs/trading-bot.log
- Errors: logs/error.log
- Debug: logs/debug.log

## Troubleshooting

### Common Issues

1. **Data Issues**

   - Check API connectivity
   - Verify database connection
   - Validate data formats

2. **Trading Issues**

   - Verify order parameters
   - Check position calculations
   - Validate risk limits

3. **System Issues**
   - Monitor resource usage
   - Check log files
   - Verify configurations

### Support

- Check logs for detailed errors
- Review configuration files
- Contact system administrator
