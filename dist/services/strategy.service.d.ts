import { StrategyConfig, StrategyResult } from '../types';
export declare class StrategyService {
    createStrategy(config: StrategyConfig): Promise<{
        config: import("@prisma/client/runtime/library").JsonValue;
        name: string;
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
    }>;
    getStrategy(strategyId: string): Promise<({
        trades: ({
            instrument: {
                symbol: string;
                name: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                exchange: string;
                instrumentType: string;
                lotSize: number | null;
                tickSize: number | null;
                isActive: boolean;
            };
            session: {
                userId: string;
                id: string;
                startTime: Date;
                endTime: Date | null;
                mode: string;
                capital: number;
                status: string;
            };
        } & {
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
        })[];
    } & {
        config: import("@prisma/client/runtime/library").JsonValue;
        name: string;
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
    }) | null>;
    getStrategyByName(name: string): Promise<({
        trades: ({
            instrument: {
                symbol: string;
                name: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                exchange: string;
                instrumentType: string;
                lotSize: number | null;
                tickSize: number | null;
                isActive: boolean;
            };
            session: {
                userId: string;
                id: string;
                startTime: Date;
                endTime: Date | null;
                mode: string;
                capital: number;
                status: string;
            };
        } & {
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
        })[];
    } & {
        config: import("@prisma/client/runtime/library").JsonValue;
        name: string;
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
    }) | null>;
    getAllStrategies(): Promise<{
        config: import("@prisma/client/runtime/library").JsonValue;
        name: string;
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
    }[]>;
    getActiveStrategies(): Promise<{
        config: import("@prisma/client/runtime/library").JsonValue;
        name: string;
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
    }[]>;
    updateStrategy(strategyId: string, updates: Partial<StrategyConfig>): Promise<{
        config: import("@prisma/client/runtime/library").JsonValue;
        name: string;
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
    }>;
    toggleStrategy(strategyId: string, enabled: boolean): Promise<{
        config: import("@prisma/client/runtime/library").JsonValue;
        name: string;
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
    }>;
    deleteStrategy(strategyId: string): Promise<{
        config: import("@prisma/client/runtime/library").JsonValue;
        name: string;
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
    }>;
    executeStrategy(strategyName: string, marketData: any[]): Promise<StrategyResult>;
    private generateSignals;
    private calculateSMA;
    private createSignal;
    private calculateATR;
    getStrategyPerformance(strategyId: string): Promise<{
        totalTrades: number;
        completedTrades: number;
        winningTrades: number;
        losingTrades: number;
        winRate: number;
        totalPnL: number;
        averagePnL: number;
    }>;
}
//# sourceMappingURL=strategy.service.d.ts.map