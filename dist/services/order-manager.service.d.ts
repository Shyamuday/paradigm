import { AutoTOTPZerodhaAuth } from '../auth/easy-auth';
import { InstrumentsManager } from './instruments-manager.service';
export interface OrderRequest {
    tradingsymbol: string;
    exchange: 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'CDS' | 'MCX';
    transaction_type: 'BUY' | 'SELL';
    quantity: number;
    order_type: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
    product: 'CNC' | 'MIS' | 'NRML';
    price?: number;
    trigger_price?: number;
    disclosed_quantity?: number;
    validity?: 'DAY' | 'IOC';
    tag?: string;
}
export interface Order {
    order_id: string;
    parent_order_id?: string;
    exchange_order_id?: string;
    placed_by: string;
    variety: string;
    status: string;
    tradingsymbol: string;
    exchange: string;
    instrument_token: number;
    transaction_type: string;
    order_type: string;
    product: string;
    quantity: number;
    disclosed_quantity: number;
    price: number;
    trigger_price: number;
    average_price: number;
    filled_quantity: number;
    pending_quantity: number;
    cancelled_quantity: number;
    order_timestamp: string;
    exchange_timestamp: string;
    status_message: string;
    tag?: string;
}
export interface Position {
    tradingsymbol: string;
    exchange: string;
    instrument_token: number;
    product: string;
    quantity: number;
    overnight_quantity: number;
    multiplier: number;
    average_price: number;
    close_price: number;
    last_price: number;
    value: number;
    pnl: number;
    m2m: number;
    unrealised: number;
    realised: number;
    buy_quantity: number;
    buy_price: number;
    buy_value: number;
    buy_m2m: number;
    sell_quantity: number;
    sell_price: number;
    sell_value: number;
    sell_m2m: number;
    day_buy_quantity: number;
    day_buy_price: number;
    day_buy_value: number;
    day_sell_quantity: number;
    day_sell_price: number;
    day_sell_value: number;
}
export declare class OrderManager {
    private auth;
    private instrumentsManager;
    private orders;
    private positions;
    constructor(auth: AutoTOTPZerodhaAuth, instrumentsManager: InstrumentsManager);
    placeOrder(orderRequest: OrderRequest): Promise<{
        order_id: string;
    }>;
    modifyOrder(orderId: string, modifications: Partial<OrderRequest>): Promise<{
        order_id: string;
    }>;
    cancelOrder(orderId: string): Promise<{
        order_id: string;
    }>;
    getAllOrders(): Promise<Order[]>;
    getOrder(orderId: string): Promise<Order | null>;
    getAllPositions(): Promise<{
        net: Position[];
        day: Position[];
    }>;
    getHoldings(): Promise<any[]>;
    refreshOrders(): Promise<void>;
    refreshPositions(): Promise<void>;
    getCachedOrder(orderId: string): Order | undefined;
    getCachedPosition(tradingsymbol: string, exchange: string): Position | undefined;
    getOrderStatus(orderId: string): Promise<string>;
    waitForOrderCompletion(orderId: string, maxWaitTime?: number): Promise<Order>;
    getPortfolioSummary(): Promise<{
        totalValue: number;
        totalPnL: number;
        totalM2M: number;
        dayPnL: number;
        positionsCount: number;
    }>;
    getOpenOrders(): Order[];
    getCompletedOrders(): Order[];
    marketOrder(tradingsymbol: string, exchange: 'NSE' | 'BSE' | 'NFO', transactionType: 'BUY' | 'SELL', quantity: number, product?: 'CNC' | 'MIS' | 'NRML'): Promise<{
        order_id: string;
    }>;
    limitOrder(tradingsymbol: string, exchange: 'NSE' | 'BSE' | 'NFO', transactionType: 'BUY' | 'SELL', quantity: number, price: number, product?: 'CNC' | 'MIS' | 'NRML'): Promise<{
        order_id: string;
    }>;
}
//# sourceMappingURL=order-manager.service.d.ts.map