"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedOrderService = void 0;
const logger_1 = require("../logger/logger");
const order_service_1 = require("./order.service");
const market_data_service_1 = require("./market-data.service");
class AdvancedOrderService {
    constructor() {
        this.orderService = new order_service_1.OrderService();
        this.marketDataService = new market_data_service_1.MarketDataService();
        this.monitoredOrders = new Map();
        this.monitorInterval = null;
        this.startMonitoring();
    }
    async createBracketOrder(sessionId, config) {
        try {
            const entryOrder = await this.orderService.createTrade(sessionId, {
                symbol: config.symbol,
                action: 'BUY',
                quantity: config.quantity,
                price: config.entryPrice || 0,
                orderType: config.entryType,
                stopLoss: config.stopLoss,
                target: config.target
            });
            if (config.trailingStop && config.trailingStopDistance) {
                this.monitoredOrders.set(entryOrder.id, {
                    orderId: entryOrder.id,
                    symbol: config.symbol,
                    stopPrice: config.stopLoss,
                    targetPrice: config.target,
                    trailingStop: true,
                    trailDistance: config.trailingStopDistance
                });
            }
            logger_1.logger.info('Bracket order created:', entryOrder.id);
            return entryOrder;
        }
        catch (error) {
            logger_1.logger.error('Failed to create bracket order:', error);
            throw error;
        }
    }
    async createIcebergOrder(sessionId, config) {
        try {
            const totalLots = Math.ceil(config.totalQuantity / config.displayQuantity);
            const orders = [];
            let remainingQuantity = config.totalQuantity;
            for (let i = 0; i < totalLots; i++) {
                const lotQuantity = Math.min(config.displayQuantity, remainingQuantity);
                const lotPrice = this.calculateIcebergLotPrice(config.limitPrice, config.priceVariance);
                const order = await this.orderService.createTrade(sessionId, {
                    symbol: config.symbol,
                    action: config.side,
                    quantity: lotQuantity,
                    price: lotPrice || 0,
                    orderType: config.limitPrice ? 'LIMIT' : 'MARKET'
                });
                orders.push(order);
                remainingQuantity -= lotQuantity;
            }
            logger_1.logger.info('Iceberg order created with', orders.length, 'lots');
            return orders;
        }
        catch (error) {
            logger_1.logger.error('Failed to create iceberg order:', error);
            throw error;
        }
    }
    async createTrailingStopOrder(sessionId, config) {
        try {
            const order = await this.orderService.createTrade(sessionId, {
                symbol: config.symbol,
                action: 'SELL',
                quantity: config.quantity,
                orderType: 'STOP',
                stopLoss: config.activationPrice
            });
            this.monitoredOrders.set(order.id, {
                orderId: order.id,
                symbol: config.symbol,
                stopPrice: config.activationPrice,
                trailingStop: true,
                trailDistance: config.trailDistance
            });
            logger_1.logger.info('Trailing stop order created:', order.id);
            return order;
        }
        catch (error) {
            logger_1.logger.error('Failed to create trailing stop order:', error);
            throw error;
        }
    }
    startMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }
        this.monitorInterval = setInterval(async () => {
            try {
                for (const [orderId, config] of this.monitoredOrders) {
                    const marketData = await this.marketDataService.getLatestMarketData(config.symbol);
                    if (!marketData.length)
                        continue;
                    const currentPrice = marketData[0]?.close;
                    if (currentPrice === undefined || currentPrice === null)
                        continue;
                    if (currentPrice <= config.stopPrice) {
                        await this.triggerStopLoss(orderId);
                        continue;
                    }
                    if (config.targetPrice && currentPrice >= config.targetPrice) {
                        await this.triggerTarget(orderId);
                        continue;
                    }
                    if (config.trailingStop && config.trailDistance) {
                        const newStopPrice = currentPrice - config.trailDistance;
                        if (newStopPrice > config.stopPrice) {
                            config.stopPrice = newStopPrice;
                            await this.updateStopLoss(orderId, newStopPrice);
                        }
                    }
                }
            }
            catch (error) {
                logger_1.logger.error('Error in order monitoring:', error);
            }
        }, 1000);
    }
    async triggerStopLoss(orderId) {
        try {
            await this.orderService.updateTradeStatus(orderId, 'STOPPED');
            this.monitoredOrders.delete(orderId);
            logger_1.logger.info('Stop loss triggered for order:', orderId);
        }
        catch (error) {
            logger_1.logger.error('Failed to trigger stop loss:', error);
        }
    }
    async triggerTarget(orderId) {
        try {
            await this.orderService.updateTradeStatus(orderId, 'COMPLETED');
            this.monitoredOrders.delete(orderId);
            logger_1.logger.info('Target achieved for order:', orderId);
        }
        catch (error) {
            logger_1.logger.error('Failed to trigger target:', error);
        }
    }
    async updateStopLoss(orderId, newStopPrice) {
        try {
            const trade = await this.orderService.getTrade(orderId);
            if (!trade)
                return;
            await this.orderService.updateTradeStatus(orderId, 'UPDATED', undefined, undefined);
            logger_1.logger.info('Updated trailing stop for order:', orderId, 'New stop:', newStopPrice);
        }
        catch (error) {
            logger_1.logger.error('Failed to update stop loss:', error);
        }
    }
    calculateIcebergLotPrice(basePrice, variance) {
        if (!basePrice || !variance)
            return undefined;
        const varianceAmount = basePrice * (variance / 100);
        const minPrice = basePrice - varianceAmount;
        const maxPrice = basePrice + varianceAmount;
        return minPrice + Math.random() * (maxPrice - minPrice);
    }
    async cancelOrder(orderId) {
        try {
            await this.orderService.updateTradeStatus(orderId, 'CANCELLED');
            this.monitoredOrders.delete(orderId);
            logger_1.logger.info('Order cancelled:', orderId);
        }
        catch (error) {
            logger_1.logger.error('Failed to cancel order:', error);
            throw error;
        }
    }
    async getMonitoredOrders() {
        return Array.from(this.monitoredOrders.entries()).map(([id, config]) => ({
            orderId: id,
            symbol: config.symbol,
            stopPrice: config.stopPrice,
            targetPrice: config.targetPrice,
            trailingStop: config.trailingStop,
            trailDistance: config.trailDistance
        }));
    }
}
exports.AdvancedOrderService = AdvancedOrderService;
//# sourceMappingURL=advanced-order.service.js.map