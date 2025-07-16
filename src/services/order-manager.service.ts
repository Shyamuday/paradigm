import { KiteConnect, Order as KiteOrder, Position as KitePosition, OrderParams } from 'kiteconnect';
import { db } from '../database/database';
import { logger } from '../logger/logger';
import { TradeOrder, TradeSignal } from '../types';

export class OrderManagerService {
    constructor(
        private kite: KiteConnect,
        private sessionId: string
    ) { }

    /**
     * Place order using KiteConnect SDK
     */
    async placeOrder(signal: TradeSignal): Promise<string> {
        try {
            // Get instrument details
            const instrument = await db.findUnique('Instrument', { symbol: signal.symbol });
            if (!instrument) {
                throw new Error(`Instrument not found: ${signal.symbol}`);
            }

            // Prepare order parameters
            const orderParams: OrderParams = {
                exchange: 'NSE',
                tradingsymbol: signal.symbol,
                transaction_type: signal.action === 'BUY' ? 'BUY' : 'SELL',
                quantity: signal.quantity,
                order_type: 'MARKET',
                product: 'MIS', // Intraday
                validity: 'DAY'
            };

            // Add price for limit orders
            if (signal.price) {
                orderParams.order_type = 'LIMIT';
                orderParams.price = signal.price;
            }

            // Add stop loss
            if (signal.stopLoss) {
                orderParams.trigger_price = signal.stopLoss;
                orderParams.order_type = 'SL-M';
            }

            // Place order via KiteConnect
            const orderId = await this.kite.placeOrder('regular', orderParams);

            // Save order to database
            const order = await db.create('Order', {
                id: `order_${Date.now()}`,
                sessionId: this.sessionId,
                instrumentId: instrument.id,
                orderId: orderId,
                symbol: signal.symbol,
                action: signal.action,
                quantity: signal.quantity,
                price: signal.price || 0,
                orderType: orderParams.order_type,
                status: 'PENDING',
                orderTime: new Date(),
                executionTime: null,
                executionPrice: null,
                stopLoss: signal.stopLoss,
                target: signal.target
            });

            logger.info('Order placed successfully:', orderId);
            return orderId;
        } catch (error) {
            logger.error('Failed to place order:', error);
            throw error;
        }
    }

    /**
     * Modify order using KiteConnect SDK
     */
    async modifyOrder(orderId: string, updates: Partial<OrderParams>): Promise<string> {
        try {
            const modifiedOrderId = await this.kite.modifyOrder('regular', orderId, updates);

            // Update order in database
            await db.update('Order', { orderId }, {
                ...updates,
                updatedAt: new Date()
            });

            logger.info('Order modified successfully:', orderId);
            return modifiedOrderId;
        } catch (error) {
            logger.error('Failed to modify order:', error);
            throw error;
        }
    }

    /**
     * Cancel order using KiteConnect SDK
     */
    async cancelOrder(orderId: string): Promise<string> {
        try {
            const cancelledOrderId = await this.kite.cancelOrder('regular', orderId);

            // Update order status in database
            await db.update('Order', { orderId }, {
                status: 'CANCELLED',
                updatedAt: new Date()
            });

            logger.info('Order cancelled successfully:', orderId);
            return cancelledOrderId;
        } catch (error) {
            logger.error('Failed to cancel order:', error);
            throw error;
        }
    }

    /**
     * Get orders from KiteConnect and sync with database
     */
    async syncOrders(): Promise<KiteOrder[]> {
        try {
            const orders = await this.kite.getOrders();

            // Update database with latest order status
            for (const order of orders) {
                const existingOrder = await db.findUnique('Order', { orderId: order.order_id });

                if (existingOrder) {
                    await db.update('Order', { orderId: order.order_id }, {
                        status: order.status,
                        executionPrice: order.average_price || null,
                        executionTime: order.order_timestamp ? new Date(order.order_timestamp) : null,
                        updatedAt: new Date()
                    });
                }
            }

            logger.info('Orders synced successfully:', orders.length);
            return orders;
        } catch (error) {
            logger.error('Failed to sync orders:', error);
            throw error;
        }
    }

    /**
     * Get specific order details
     */
    async getOrder(orderId: string): Promise<KiteOrder[]> {
        try {
            const orderHistory = await this.kite.getOrderHistory(orderId);

            // Update database with latest order info
            const latestOrder = orderHistory[orderHistory.length - 1];
            if (latestOrder) {
                await db.update('Order', { orderId }, {
                    status: latestOrder.status,
                    executionPrice: latestOrder.average_price || null,
                    executionTime: latestOrder.order_timestamp ? new Date(latestOrder.order_timestamp) : null,
                    updatedAt: new Date()
                });
            }

            return orderHistory;
        } catch (error) {
            logger.error('Failed to get order:', error);
            throw error;
        }
    }

    /**
     * Get positions from KiteConnect
     */
    async getPositions(): Promise<{ net: KitePosition[], day: KitePosition[] }> {
        try {
            const positions = await this.kite.getPositions();

            // Sync positions with database
            for (const position of positions.net) {
                if (position.quantity !== 0) {
                    const instrument = await db.findUnique('Instrument', { symbol: position.tradingsymbol });

                    if (instrument) {
                        // Check if position exists in database
                        const existingPositions = await db.findMany('Position', {
                            where: {
                                sessionId: this.sessionId,
                                instrumentId: instrument.id,
                                closeTime: null
                            }
                        });

                        if (existingPositions.length === 0) {
                            // Create new position
                            await db.create('Position', {
                                id: `position_${Date.now()}`,
                                sessionId: this.sessionId,
                                instrumentId: instrument.id,
                                symbol: position.tradingsymbol,
                                quantity: position.quantity,
                                averagePrice: position.average_price,
                                currentPrice: position.last_price,
                                side: position.quantity > 0 ? 'LONG' : 'SHORT',
                                unrealizedPnL: position.unrealised,
                                realizedPnL: position.realised,
                                openTime: new Date(),
                                closeTime: null
                            });
                        } else {
                            // Update existing position
                            await db.update('Position', { id: existingPositions[0].id }, {
                                quantity: position.quantity,
                                averagePrice: position.average_price,
                                currentPrice: position.last_price,
                                unrealizedPnL: position.unrealised,
                                realizedPnL: position.realised,
                                updatedAt: new Date()
                            });
                        }
                    }
                }
            }

            logger.info('Positions synced successfully');
            return positions;
        } catch (error) {
            logger.error('Failed to get positions:', error);
            throw error;
        }
    }

    /**
     * Get holdings from KiteConnect
     */
    async getHoldings() {
        try {
            const holdings = await this.kite.getHoldings();
            logger.info('Holdings retrieved successfully:', holdings.length);
            return holdings;
        } catch (error) {
            logger.error('Failed to get holdings:', error);
            throw error;
        }
    }

    /**
     * Get order book from database
     */
    async getOrderBook() {
        try {
            const orders = await db.findMany('Order', {
                where: { sessionId: this.sessionId },
                orderBy: { orderTime: 'desc' }
            });
            return orders;
        } catch (error) {
            logger.error('Failed to get order book:', error);
            throw error;
        }
    }

    /**
     * Get pending orders
     */
    async getPendingOrders() {
        try {
            const orders = await db.findMany('Order', {
                where: {
                    sessionId: this.sessionId,
                    status: 'PENDING'
                },
                orderBy: { orderTime: 'asc' }
            });
            return orders;
        } catch (error) {
            logger.error('Failed to get pending orders:', error);
            throw error;
        }
    }

    /**
     * Calculate order metrics
     */
    async getOrderMetrics() {
        try {
            const orders = await db.findMany('Order', {
                where: { sessionId: this.sessionId }
            });

            const totalOrders = orders.length;
            const completedOrders = orders.filter(o => o.status === 'COMPLETE').length;
            const cancelledOrders = orders.filter(o => o.status === 'CANCELLED').length;
            const pendingOrders = orders.filter(o => o.status === 'PENDING').length;

            const successRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

            return {
                totalOrders,
                completedOrders,
                cancelledOrders,
                pendingOrders,
                successRate
            };
        } catch (error) {
            logger.error('Failed to get order metrics:', error);
            throw error;
        }
    }

    /**
     * Place bracket order (BO)
     */
    async placeBracketOrder(signal: TradeSignal): Promise<string> {
        try {
            if (!signal.stopLoss || !signal.target) {
                throw new Error('Bracket order requires both stop loss and target');
            }

            const orderParams: OrderParams = {
                exchange: 'NSE',
                tradingsymbol: signal.symbol,
                transaction_type: signal.action === 'BUY' ? 'BUY' : 'SELL',
                quantity: signal.quantity,
                order_type: 'LIMIT',
                product: 'BO',
                validity: 'DAY',
                price: signal.price,
                squareoff: Math.abs(signal.target - signal.price),
                stoploss: Math.abs(signal.price - signal.stopLoss),
                trailing_stoploss: 0
            };

            const orderId = await this.kite.placeOrder('bo', orderParams);

            logger.info('Bracket order placed successfully:', orderId);
            return orderId;
        } catch (error) {
            logger.error('Failed to place bracket order:', error);
            throw error;
        }
    }

    /**
     * Place cover order (CO)
     */
    async placeCoverOrder(signal: TradeSignal): Promise<string> {
        try {
            if (!signal.stopLoss) {
                throw new Error('Cover order requires stop loss');
            }

            const orderParams: OrderParams = {
                exchange: 'NSE',
                tradingsymbol: signal.symbol,
                transaction_type: signal.action === 'BUY' ? 'BUY' : 'SELL',
                quantity: signal.quantity,
                order_type: 'MARKET',
                product: 'CO',
                validity: 'DAY',
                trigger_price: signal.stopLoss
            };

            const orderId = await this.kite.placeOrder('co', orderParams);

            logger.info('Cover order placed successfully:', orderId);
            return orderId;
        } catch (error) {
            logger.error('Failed to place cover order:', error);
            throw error;
        }
    }
} 