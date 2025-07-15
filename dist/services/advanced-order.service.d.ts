interface BracketOrderConfig {
    symbol: string;
    quantity: number;
    entryType: 'MARKET' | 'LIMIT';
    entryPrice?: number;
    stopLoss: number;
    target: number;
    trailingStop?: boolean;
    trailingStopDistance?: number;
}
interface IcebergOrderConfig {
    symbol: string;
    side: 'BUY' | 'SELL';
    totalQuantity: number;
    displayQuantity: number;
    limitPrice?: number;
    priceVariance?: number;
}
interface TrailingStopConfig {
    symbol: string;
    quantity: number;
    activationPrice: number;
    trailDistance: number;
    trailType: 'ABSOLUTE' | 'PERCENTAGE';
}
export declare class AdvancedOrderService {
    private orderService;
    private marketDataService;
    private monitoredOrders;
    private monitorInterval;
    constructor();
    createBracketOrder(sessionId: string, config: BracketOrderConfig): Promise<{
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
    }>;
    createIcebergOrder(sessionId: string, config: IcebergOrderConfig): Promise<{
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
    }[]>;
    createTrailingStopOrder(sessionId: string, config: TrailingStopConfig): Promise<{
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
    }>;
    private startMonitoring;
    private triggerStopLoss;
    private triggerTarget;
    private updateStopLoss;
    private calculateIcebergLotPrice;
    cancelOrder(orderId: string): Promise<void>;
    getMonitoredOrders(): Promise<{
        orderId: string;
        symbol: string;
        stopPrice: number;
        targetPrice: number | undefined;
        trailingStop: boolean | undefined;
        trailDistance: number | undefined;
    }[]>;
}
export {};
//# sourceMappingURL=advanced-order.service.d.ts.map