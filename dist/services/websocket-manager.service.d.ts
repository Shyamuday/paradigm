import { AutoTOTPZerodhaAuth } from '../auth/easy-auth';
import { EventEmitter } from 'events';
export interface TickData {
    instrument_token: number;
    mode: string;
    tradable: boolean;
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
    change: number;
    last_trade_time: Date;
    oi?: number;
    oi_day_high?: number;
    oi_day_low?: number;
}
export declare class WebSocketManager extends EventEmitter {
    private auth;
    private ws;
    private subscribedTokens;
    private isConnected;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectInterval;
    constructor(auth: AutoTOTPZerodhaAuth);
    connect(): Promise<void>;
    private setupEventHandlers;
    subscribe(tokens: number[], mode?: 'ltp' | 'quote' | 'full'): void;
    unsubscribe(tokens: number[]): void;
    private resubscribe;
    private handleReconnection;
    disconnect(): void;
    getConnectionStatus(): {
        connected: boolean;
        subscribedTokens: number[];
        reconnectAttempts: number;
    };
    clearSubscriptions(): void;
}
//# sourceMappingURL=websocket-manager.service.d.ts.map