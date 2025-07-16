import { AutoTOTPZerodhaAuth } from '../auth/easy-auth';
import { InstrumentsManager } from './instruments-manager.service';
import { logger } from '../logger/logger';

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

export class OrderManager {
    private auth: AutoTOTPZerodhaAuth;
    private instrumentsManager: InstrumentsManager;
    private orders: Map<string, Order> = new Map();
    private positions: Map<string, Position> = new Map();

    constructor(auth: AutoTOTPZerodhaAuth, instrumentsManager: InstrumentsManager) {
        this.auth = auth;
        this.instrumentsManager = instrumentsManager;
    }

    /**
     * Place a new order
     */
    async placeOrder(orderRequest: OrderRequest): Promise<{ order_id: string }> {
        try {
            logger.info(`📋 Placing order: ${orderRequest.transaction_type} ${orderRequest.quantity} ${orderRequest.tradingsymbol}`);

            // Validate instrument exists
            const instruments = await this.instrumentsManager.searchInstruments(orderRequest.tradingsymbol);
            const instrument = instruments.find(inst =>
                inst.exchange === orderRequest.exchange &&
                inst.tradingsymbol === orderRequest.tradingsymbol
            );

            if (!instrument) {
                throw new Error(`Instrument ${orderRequest.tradingsymbol} not found on ${orderRequest.exchange}`);
            }

            // Prepare order data
            const orderData = {
                exchange: orderRequest.exchange,
                tradingsymbol: orderRequest.tradingsymbol,
                transaction_type: orderRequest.transaction_type,
                order_type: orderRequest.order_type,
                quantity: orderRequest.quantity,
                product: orderRequest.product,
                validity: orderRequest.validity || 'DAY',
                ...(orderRequest.price && { price: orderRequest.price }),
                ...(orderRequest.trigger_price && { trigger_price: orderRequest.trigger_price }),
                ...(orderRequest.disclosed_quantity && { disclosed_quantity: orderRequest.disclosed_quantity }),
                ...(orderRequest.tag && { tag: orderRequest.tag })
            };

            // Place order via API
            const response = await this.auth.apiCall('/orders/regular', 'POST', orderData);

            if (response.status === 'success') {
                const orderId = response.data.order_id;
                logger.info(`✅ Order placed successfully: ${orderId}`);

                // Refresh orders to get the latest status
                await this.refreshOrders();

                return { order_id: orderId };
            } else {
                throw new Error(`Order placement failed: ${response.message}`);
            }

        } catch (error) {
            logger.error('❌ Order placement failed:', error);
            throw error;
        }
    }

    /**
     * Modify an existing order
     */
    async modifyOrder(orderId: string, modifications: Partial<OrderRequest>): Promise<{ order_id: string }> {
        try {
            logger.info(`📝 Modifying order: ${orderId}`);

            const modifyData = {
                order_id: orderId,
                ...(modifications.quantity && { quantity: modifications.quantity }),
                ...(modifications.price && { price: modifications.price }),
                ...(modifications.order_type && { order_type: modifications.order_type }),
                ...(modifications.trigger_price && { trigger_price: modifications.trigger_price }),
                ...(modifications.validity && { validity: modifications.validity })
            };

            const response = await this.auth.apiCall('/orders/regular', 'PUT', modifyData);

            if (response.status === 'success') {
                logger.info(`✅ Order modified successfully: ${orderId}`);
                await this.refreshOrders();
                return { order_id: orderId };
            } else {
                throw new Error(`Order modification failed: ${response.message}`);
            }

        } catch (error) {
            logger.error('❌ Order modification failed:', error);
            throw error;
        }
    }

    /**
     * Cancel an order
     */
    async cancelOrder(orderId: string): Promise<{ order_id: string }> {
        try {
            logger.info(`❌ Cancelling order: ${orderId}`);

            const response = await this.auth.apiCall(`/orders/regular/${orderId}`, 'DELETE');

            if (response.status === 'success') {
                logger.info(`✅ Order cancelled successfully: ${orderId}`);
                await this.refreshOrders();
                return { order_id: orderId };
            } else {
                throw new Error(`Order cancellation failed: ${response.message}`);
            }

        } catch (error) {
            logger.error('❌ Order cancellation failed:', error);
            throw error;
        }
    }

    /**
     * Get all orders
     */
    async getAllOrders(): Promise<Order[]> {
        try {
            const response = await this.auth.apiCall('/orders');
            const orders: Order[] = response.data;

            // Update local cache
            this.orders.clear();
            orders.forEach(order => {
                this.orders.set(order.order_id, order);
            });

            return orders;
        } catch (error) {
            logger.error('❌ Failed to fetch orders:', error);
            throw error;
        }
    }

    /**
     * Get order by ID
     */
    async getOrder(orderId: string): Promise<Order | null> {
        try {
            const response = await this.auth.apiCall(`/orders/${orderId}`);
            const order: Order = response.data[0];

            if (order) {
                this.orders.set(order.order_id, order);
            }

            return order || null;
        } catch (error) {
            logger.error(`❌ Failed to fetch order ${orderId}:`, error);
            throw error;
        }
    }

    /**
     * Get all positions
     */
    async getAllPositions(): Promise<{ net: Position[], day: Position[] }> {
        try {
            const response = await this.auth.apiCall('/portfolio/positions');
            const positions = response.data;

            // Update local cache
            this.positions.clear();
            positions.net.forEach((position: Position) => {
                const key = `${position.tradingsymbol}_${position.exchange}`;
                this.positions.set(key, position);
            });

            return positions;
        } catch (error) {
            logger.error('❌ Failed to fetch positions:', error);
            throw error;
        }
    }

    /**
     * Get holdings (long-term investments)
     */
    async getHoldings(): Promise<any[]> {
        try {
            return await this.kite.getHoldings();
        } catch (error) {
            logger.error('❌ Failed to fetch holdings:', error);
            throw error;
        }
    }

    /**
     * Refresh orders from server
     */
    async refreshOrders(): Promise<void> {
        await this.getAllOrders();
        logger.info('🔄 Orders refreshed');
    }

    /**
     * Refresh positions from server
     */
    async refreshPositions(): Promise<void> {
        await this.getAllPositions();
        logger.info('🔄 Positions refreshed');
    }

    /**
     * Get cached order
     */
    getCachedOrder(orderId: string): Order | undefined {
        return this.orders.get(orderId);
    }

    /**
     * Get cached position
     */
    getCachedPosition(tradingsymbol: string, exchange: string): Position | undefined {
        const key = `${tradingsymbol}_${exchange}`;
        return this.positions.get(key);
    }

    /**
     * Get order status
     */
    async getOrderStatus(orderId: string): Promise<string> {
        const order = await this.getOrder(orderId);
        return order?.status || 'UNKNOWN';
    }

    /**
     * Wait for order completion
     */
    async waitForOrderCompletion(orderId: string, maxWaitTime: number = 60000): Promise<Order> {
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            const order = await this.getOrder(orderId);

            if (order && ['COMPLETE', 'CANCELLED', 'REJECTED'].includes(order.status)) {
                return order;
            }

            // Wait 2 seconds before checking again
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        throw new Error(`Order ${orderId} did not complete within ${maxWaitTime}ms`);
    }

    /**
     * Calculate portfolio summary
     */
    async getPortfolioSummary(): Promise<{
        totalValue: number;
        totalPnL: number;
        totalM2M: number;
        dayPnL: number;
        positionsCount: number;
    }> {
        const positions = await this.getAllPositions();

        let totalValue = 0;
        let totalPnL = 0;
        let totalM2M = 0;
        let dayPnL = 0;

        positions.net.forEach(position => {
            totalValue += position.value;
            totalPnL += position.pnl;
            totalM2M += position.m2m;
            dayPnL += position.unrealised;
        });

        return {
            totalValue,
            totalPnL,
            totalM2M,
            dayPnL,
            positionsCount: positions.net.length
        };
    }

    /**
     * Get open orders (pending orders)
     */
    getOpenOrders(): Order[] {
        return Array.from(this.orders.values()).filter(order =>
            ['OPEN', 'TRIGGER PENDING'].includes(order.status)
        );
    }

    /**
     * Get completed orders
     */
    getCompletedOrders(): Order[] {
        return Array.from(this.orders.values()).filter(order =>
            order.status === 'COMPLETE'
        );
    }

    /**
     * Quick market order helper
     */
    async marketOrder(
        tradingsymbol: string,
        exchange: 'NSE' | 'BSE' | 'NFO',
        transactionType: 'BUY' | 'SELL',
        quantity: number,
        product: 'CNC' | 'MIS' | 'NRML' = 'MIS'
    ): Promise<{ order_id: string }> {
        return this.placeOrder({
            tradingsymbol,
            exchange,
            transaction_type: transactionType,
            quantity,
            order_type: 'MARKET',
            product
        });
    }

    /**
     * Quick limit order helper
     */
    async limitOrder(
        tradingsymbol: string,
        exchange: 'NSE' | 'BSE' | 'NFO',
        transactionType: 'BUY' | 'SELL',
        quantity: number,
        price: number,
        product: 'CNC' | 'MIS' | 'NRML' = 'MIS'
    ): Promise<{ order_id: string }> {
        return this.placeOrder({
            tradingsymbol,
            exchange,
            transaction_type: transactionType,
            quantity,
            order_type: 'LIMIT',
            price,
            product
        });
    }
} 