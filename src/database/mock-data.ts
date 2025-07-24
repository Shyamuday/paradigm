import {
    Instrument,
    MarketData,
    Position,
    Trade,
    TradingSession,
    User
} from '../types';

export class MockDataGenerator {
    static createMockInstrument(symbol: string): Instrument {
        return {
            id: `inst_${Date.now()}`,
            symbol,
            name: symbol,
            exchange: 'NSE',
            instrumentType: 'EQ',
            lotSize: 1,
            tickSize: 0.05,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    static createMockMarketData(instrumentId: string, symbol: string): MarketData {
        const basePrice = 1000 + Math.random() * 1000;
        return {
            id: `md_${Date.now()}`,
            instrumentId,
            instrument: this.createMockInstrument(symbol),
            symbol,
            timestamp: new Date(),
            open: basePrice,
            high: basePrice * 1.02,
            low: basePrice * 0.98,
            close: basePrice * 1.01,
            volume: Math.floor(Math.random() * 100000),
            ltp: basePrice * 1.01,
            change: basePrice * 0.01,
            changePercent: 1.0
        };
    }

    static createMockPosition(sessionId: string, instrumentId: string): Position {
        const entryPrice = 1000 + Math.random() * 1000;
        const currentPrice = entryPrice * (1 + (Math.random() - 0.5) * 0.1);

        return {
            id: `pos_${Date.now()}`,
            sessionId,
            instrumentId,
            instrument: this.createMockInstrument('MOCK'),
            symbol: 'MOCK',
            quantity: 100,
            averagePrice: entryPrice,
            entryPrice,
            currentPrice,
            side: Math.random() > 0.5 ? 'LONG' : 'SHORT',
            stopLoss: entryPrice * 0.95,
            target: entryPrice * 1.05,
            trailingStop: false,
            unrealizedPnL: (currentPrice - entryPrice) * 100,
            realizedPnL: 0,
            openTime: new Date(),
            closeTime: null,
            entryTime: new Date(),
            status: 'OPEN',
            strategyName: 'MOCK_STRATEGY',
            highestPrice: Math.max(entryPrice, currentPrice),
            lowestPrice: Math.min(entryPrice, currentPrice)
        };
    }

    static createMockTrade(sessionId: string, instrumentId: string): Trade {
        const price = 1000 + Math.random() * 1000;

        return {
            id: `trade_${Date.now()}`,
            sessionId,
            instrumentId,
            instrument: this.createMockInstrument('MOCK'),
            strategyId: null,
            action: Math.random() > 0.5 ? 'BUY' : 'SELL',
            quantity: 100,
            price,
            orderType: 'MARKET',
            orderId: null,
            status: 'PENDING',
            stopLoss: price * 0.95,
            target: price * 1.05,
            trailingStop: false,
            orderTime: new Date(),
            executionTime: null,
            realizedPnL: null,
            unrealizedPnL: null
        };
    }

    static createMockTradingSession(userId: string): TradingSession {
        return {
            id: `session_${Date.now()}`,
            userId,
            startTime: new Date(),
            endTime: null,
            mode: 'paper',
            capital: 100000,
            status: 'ACTIVE',
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalPnL: 0,
            maxDrawdown: 0,
            config: {
                maxPositionSize: 10000,
                maxOpenPositions: 5,
                maxDailyLoss: 5000
            }
        };
    }

    static createMockUser(email: string): User {
        return {
            id: `user_${Date.now()}`,
            email,
            name: email.split('@')[0] || null,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }
} 