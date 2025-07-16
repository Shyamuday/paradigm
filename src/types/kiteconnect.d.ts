declare module 'kiteconnect' {
    export interface KiteConnectOptions {
        api_key: string;
        access_token?: string;
        debug?: boolean;
        root?: string;
        timeout?: number;
    }

    export interface OrderParams {
        exchange: string;
        tradingsymbol: string;
        transaction_type: string;
        quantity: number;
        price?: number;
        product: string;
        order_type: string;
        validity?: string;
        disclosed_quantity?: number;
        trigger_price?: number;
        squareoff?: number;
        stoploss?: number;
        trailing_stoploss?: number;
        tag?: string;
    }

    export interface Order {
        order_id: string;
        exchange_order_id?: string;
        parent_order_id?: string;
        status: string;
        status_message?: string;
        order_timestamp: string;
        exchange_timestamp: string;
        exchange: string;
        tradingsymbol: string;
        instrument_token: number;
        variety: string;
        transaction_type: string;
        quantity: number;
        price: number;
        trigger_price: number;
        average_price: number;
        filled_quantity: number;
        pending_quantity: number;
        cancelled_quantity: number;
        disclosed_quantity: number;
        validity: string;
        product: string;
        order_type: string;
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

    export interface Positions {
        day: Position[];
        net: Position[];
    }

    export interface Holding {
        tradingsymbol: string;
        exchange: string;
        instrument_token: number;
        isin: string;
        product: string;
        price: number;
        quantity: number;
        used_quantity: number;
        t1_quantity: number;
        realised_quantity: number;
        authorised_quantity: number;
        authorised_date: string;
        opening_quantity: number;
        collateral_quantity: number;
        collateral_type: string;
        discrepancy: boolean;
        average_price: number;
        last_price: number;
        close_price: number;
        pnl: number;
        day_change: number;
        day_change_percentage: number;
    }

    export class KiteConnect {
        constructor(options: KiteConnectOptions);

        setAccessToken(access_token: string): void;
        getLoginURL(): string;
        generateSession(request_token: string, api_secret: string): Promise<any>;
        invalidateAccessToken(): Promise<void>;

        getProfile(): Promise<any>;
        getMargins(): Promise<any>;
        getQuote(instruments: string[]): Promise<any>;
        getOHLC(instruments: string[]): Promise<any>;
        getLTP(instruments: string[]): Promise<any>;
        getHistoricalData(instrument_token: number, interval: string, from_date: string, to_date: string, continuous?: boolean): Promise<any>;

        placeOrder(variety: string, params: OrderParams): Promise<string>;
        modifyOrder(variety: string, order_id: string, params: Partial<OrderParams>): Promise<string>;
        cancelOrder(variety: string, order_id: string): Promise<string>;
        getOrders(): Promise<Order[]>;
        getOrderHistory(order_id: string): Promise<Order[]>;

        getPositions(): Promise<Positions>;
        getHoldings(): Promise<Holding[]>;
        convertPosition(params: any): Promise<any>;

        getInstruments(exchange?: string): Promise<any[]>;
        getQuote(instruments: string[]): Promise<any>;
        getOHLC(instruments: string[]): Promise<any>;
        getLTP(instruments: string[]): Promise<any>;
        getHistoricalData(instrument_token: number, interval: string, from_date: string, to_date: string, continuous?: boolean): Promise<any>;
    }

    export class KiteTicker {
        constructor(options: { api_key: string; access_token: string });
        connect(): void;
        disconnect(): void;
        subscribe(tokens: number[]): void;
        unsubscribe(tokens: number[]): void;
        setMode(mode: string, tokens: number[]): void;
        on(event: string, handler: Function): void;
        enableReconnect(): void;
    }
} 