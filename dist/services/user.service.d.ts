import { TradingSession } from '../types';
export declare class UserService {
    createUser(email: string, name?: string): Promise<{
        name: string | null;
        id: string;
        email: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getUserById(id: string): Promise<({
        sessions: {
            userId: string;
            id: string;
            startTime: Date;
            endTime: Date | null;
            mode: string;
            capital: number;
            status: string;
        }[];
    } & {
        name: string | null;
        id: string;
        email: string;
        createdAt: Date;
        updatedAt: Date;
    }) | null>;
    getUserByEmail(email: string): Promise<({
        sessions: {
            userId: string;
            id: string;
            startTime: Date;
            endTime: Date | null;
            mode: string;
            capital: number;
            status: string;
        }[];
    } & {
        name: string | null;
        id: string;
        email: string;
        createdAt: Date;
        updatedAt: Date;
    }) | null>;
    createTradingSession(userId: string, sessionData: Partial<TradingSession>): Promise<{
        userId: string;
        id: string;
        startTime: Date;
        endTime: Date | null;
        mode: string;
        capital: number;
        status: string;
    }>;
    getTradingSession(sessionId: string): Promise<({
        user: {
            name: string | null;
            id: string;
            email: string;
            createdAt: Date;
            updatedAt: Date;
        };
        trades: {
            id: string;
            status: string;
            instrumentId: string;
            sessionId: string;
            strategyId: string | null;
            action: string;
            quantity: number;
            price: number;
            orderType: string;
            orderId: string | null;
            stopLoss: number | null;
            target: number | null;
            trailingStop: boolean;
            orderTime: Date;
            executionTime: Date | null;
            realizedPnL: number | null;
            unrealizedPnL: number | null;
        }[];
        positions: {
            id: string;
            instrumentId: string;
            sessionId: string;
            quantity: number;
            stopLoss: number | null;
            target: number | null;
            trailingStop: boolean;
            realizedPnL: number | null;
            unrealizedPnL: number | null;
            tradeId: string | null;
            averagePrice: number;
            currentPrice: number | null;
            side: string;
            openTime: Date;
            closeTime: Date | null;
        }[];
    } & {
        userId: string;
        id: string;
        startTime: Date;
        endTime: Date | null;
        mode: string;
        capital: number;
        status: string;
    }) | null>;
    getActiveTradingSessions(userId: string): Promise<({
        trades: {
            id: string;
            status: string;
            instrumentId: string;
            sessionId: string;
            strategyId: string | null;
            action: string;
            quantity: number;
            price: number;
            orderType: string;
            orderId: string | null;
            stopLoss: number | null;
            target: number | null;
            trailingStop: boolean;
            orderTime: Date;
            executionTime: Date | null;
            realizedPnL: number | null;
            unrealizedPnL: number | null;
        }[];
        positions: {
            id: string;
            instrumentId: string;
            sessionId: string;
            quantity: number;
            stopLoss: number | null;
            target: number | null;
            trailingStop: boolean;
            realizedPnL: number | null;
            unrealizedPnL: number | null;
            tradeId: string | null;
            averagePrice: number;
            currentPrice: number | null;
            side: string;
            openTime: Date;
            closeTime: Date | null;
        }[];
    } & {
        userId: string;
        id: string;
        startTime: Date;
        endTime: Date | null;
        mode: string;
        capital: number;
        status: string;
    })[]>;
    updateTradingSession(sessionId: string, updates: Partial<TradingSession>): Promise<{
        userId: string;
        id: string;
        startTime: Date;
        endTime: Date | null;
        mode: string;
        capital: number;
        status: string;
    }>;
    stopTradingSession(sessionId: string): Promise<{
        userId: string;
        id: string;
        startTime: Date;
        endTime: Date | null;
        mode: string;
        capital: number;
        status: string;
    }>;
}
//# sourceMappingURL=user.service.d.ts.map