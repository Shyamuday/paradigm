"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderManager = void 0;
const logger_1 = require("../logger/logger");
class OrderManager {
    constructor(auth, instrumentsManager) {
        this.orders = new Map();
        this.positions = new Map();
        this.auth = auth;
        this.instrumentsManager = instrumentsManager;
    }
    async placeOrder(orderRequest) {
        try {
            logger_1.logger.info(`📋 Placing order: ${orderRequest.transaction_type} ${orderRequest.quantity} ${orderRequest.tradingsymbol}`);
            const instruments = await this.instrumentsManager.searchInstruments(orderRequest.tradingsymbol);
            const instrument = instruments.find(inst => inst.exchange === orderRequest.exchange &&
                inst.tradingsymbol === orderRequest.tradingsymbol);
            if (!instrument) {
                throw new Error(`Instrument ${orderRequest.tradingsymbol} not found on ${orderRequest.exchange}`);
            }
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
            const response = await this.auth.apiCall('/orders/regular', 'POST', orderData);
            if (response.status === 'success') {
                const orderId = response.data.order_id;
                logger_1.logger.info(`✅ Order placed successfully: ${orderId}`);
                await this.refreshOrders();
                return { order_id: orderId };
            }
            else {
                throw new Error(`Order placement failed: ${response.message}`);
            }
        }
        catch (error) {
            logger_1.logger.error('❌ Order placement failed:', error);
            throw error;
        }
    }
    async modifyOrder(orderId, modifications) {
        try {
            logger_1.logger.info(`📝 Modifying order: ${orderId}`);
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
                logger_1.logger.info(`✅ Order modified successfully: ${orderId}`);
                await this.refreshOrders();
                return { order_id: orderId };
            }
            else {
                throw new Error(`Order modification failed: ${response.message}`);
            }
        }
        catch (error) {
            logger_1.logger.error('❌ Order modification failed:', error);
            throw error;
        }
    }
    async cancelOrder(orderId) {
        try {
            logger_1.logger.info(`❌ Cancelling order: ${orderId}`);
            const response = await this.auth.apiCall(`/orders/regular/${orderId}`, 'DELETE');
            if (response.status === 'success') {
                logger_1.logger.info(`✅ Order cancelled successfully: ${orderId}`);
                await this.refreshOrders();
                return { order_id: orderId };
            }
            else {
                throw new Error(`Order cancellation failed: ${response.message}`);
            }
        }
        catch (error) {
            logger_1.logger.error('❌ Order cancellation failed:', error);
            throw error;
        }
    }
    async getAllOrders() {
        try {
            const response = await this.auth.apiCall('/orders');
            const orders = response.data;
            this.orders.clear();
            orders.forEach(order => {
                this.orders.set(order.order_id, order);
            });
            return orders;
        }
        catch (error) {
            logger_1.logger.error('❌ Failed to fetch orders:', error);
            throw error;
        }
    }
    async getOrder(orderId) {
        try {
            const response = await this.auth.apiCall(`/orders/${orderId}`);
            const order = response.data[0];
            if (order) {
                this.orders.set(order.order_id, order);
            }
            return order || null;
        }
        catch (error) {
            logger_1.logger.error(`❌ Failed to fetch order ${orderId}:`, error);
            throw error;
        }
    }
    async getAllPositions() {
        try {
            const response = await this.auth.apiCall('/portfolio/positions');
            const positions = response.data;
            this.positions.clear();
            positions.net.forEach((position) => {
                const key = `${position.tradingsymbol}_${position.exchange}`;
                this.positions.set(key, position);
            });
            return positions;
        }
        catch (error) {
            logger_1.logger.error('❌ Failed to fetch positions:', error);
            throw error;
        }
    }
    async getHoldings() {
        try {
            const response = await this.auth.apiCall('/portfolio/holdings');
            return response.data;
        }
        catch (error) {
            logger_1.logger.error('❌ Failed to fetch holdings:', error);
            throw error;
        }
    }
    async refreshOrders() {
        await this.getAllOrders();
        logger_1.logger.info('🔄 Orders refreshed');
    }
    async refreshPositions() {
        await this.getAllPositions();
        logger_1.logger.info('🔄 Positions refreshed');
    }
    getCachedOrder(orderId) {
        return this.orders.get(orderId);
    }
    getCachedPosition(tradingsymbol, exchange) {
        const key = `${tradingsymbol}_${exchange}`;
        return this.positions.get(key);
    }
    async getOrderStatus(orderId) {
        const order = await this.getOrder(orderId);
        return order?.status || 'UNKNOWN';
    }
    async waitForOrderCompletion(orderId, maxWaitTime = 60000) {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitTime) {
            const order = await this.getOrder(orderId);
            if (order && ['COMPLETE', 'CANCELLED', 'REJECTED'].includes(order.status)) {
                return order;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        throw new Error(`Order ${orderId} did not complete within ${maxWaitTime}ms`);
    }
    async getPortfolioSummary() {
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
    getOpenOrders() {
        return Array.from(this.orders.values()).filter(order => ['OPEN', 'TRIGGER PENDING'].includes(order.status));
    }
    getCompletedOrders() {
        return Array.from(this.orders.values()).filter(order => order.status === 'COMPLETE');
    }
    async marketOrder(tradingsymbol, exchange, transactionType, quantity, product = 'MIS') {
        return this.placeOrder({
            tradingsymbol,
            exchange,
            transaction_type: transactionType,
            quantity,
            order_type: 'MARKET',
            product
        });
    }
    async limitOrder(tradingsymbol, exchange, transactionType, quantity, price, product = 'MIS') {
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
exports.OrderManager = OrderManager;
//# sourceMappingURL=order-manager.service.js.map