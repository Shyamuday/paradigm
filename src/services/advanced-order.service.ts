import { OrderService } from './order.service';
import { MarketDataService } from './market-data.service';
import { InstrumentsManager } from './instruments-manager.service';
import { KiteConnect } from 'kiteconnect';
import { logger } from '../logger/logger';

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

interface OrderMonitorConfig {
    orderId: string;
    symbol: string;
    stopPrice: number;
    targetPrice?: number;
    trailingStop?: boolean;
    trailDistance?: number;
}

// Remove the local TradeSignal interface and use the one from types
import { TradeSignal } from '../types';

export class AdvancedOrderService {
    private orderService: OrderService;
    private marketDataService: MarketDataService;
    private monitoredOrders: Map<string, OrderMonitorConfig>;
    private monitorInterval: NodeJS.Timeout | null;

    constructor(instrumentsManager: InstrumentsManager, kite: KiteConnect) {
        this.orderService = new OrderService();
        this.marketDataService = new MarketDataService(instrumentsManager, kite);
        this.monitoredOrders = new Map();
        this.monitorInterval = null;
        this.startMonitoring();
    }

    async createBracketOrder(sessionId: string, config: BracketOrderConfig) {
        try {
            // Create main entry order
            const entryOrder = await this.orderService.createTrade(sessionId, {
                id: `signal_${Date.now()}`,
                strategy: 'BracketOrder',
                symbol: config.symbol,
                action: 'BUY',
                quantity: config.quantity,
                price: config.entryPrice || 0,
                stopLoss: config.stopLoss,
                target: config.target,
                timestamp: new Date()
            });

            // Add to monitoring if it's a trailing stop
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

            logger.info('Bracket order created', { id: entryOrder?.id ?? 'unknown' });
            return entryOrder;
        } catch (error) {
            logger.error('Failed to create bracket order:', error);
            throw error;
        }
    }

    async createIcebergOrder(sessionId: string, config: IcebergOrderConfig) {
        try {
            const totalLots = Math.ceil(config.totalQuantity / config.displayQuantity);
            const orders = [];
            let remainingQuantity = config.totalQuantity;

            for (let i = 0; i < totalLots; i++) {
                const lotQuantity = Math.min(config.displayQuantity, remainingQuantity);
                const lotPrice = this.calculateIcebergLotPrice(config.limitPrice, config.priceVariance);

                const order = await this.orderService.createTrade(sessionId, {
                    id: `signal_${Date.now()}_${i}`,
                    strategy: 'IcebergOrder',
                    symbol: config.symbol,
                    action: config.side,
                    quantity: lotQuantity,
                    price: lotPrice || 0,
                    timestamp: new Date()
                });

                orders.push(order);
                remainingQuantity -= lotQuantity;
            }

            logger.info(`Iceberg order created with ${orders.length} lots`);
            return orders;
        } catch (error) {
            logger.error('Failed to create iceberg order:', error);
            throw error;
        }
    }

    async createTrailingStopOrder(sessionId: string, config: TrailingStopConfig) {
        try {
            const order = await this.orderService.createTrade(sessionId, {
                id: `signal_${Date.now()}`,
                strategy: 'TrailingStopOrder',
                symbol: config.symbol,
                action: 'SELL',
                quantity: config.quantity,
                price: config.activationPrice,
                stopLoss: config.activationPrice,
                timestamp: new Date()
            });

            // Add to monitoring
            this.monitoredOrders.set(order.id, {
                orderId: order.id,
                symbol: config.symbol,
                stopPrice: config.activationPrice,
                trailingStop: true,
                trailDistance: config.trailDistance
            });

            logger.info('Trailing stop order created:', order.id);
            return order;
        } catch (error) {
            logger.error('Failed to create trailing stop order:', error);
            throw error;
        }
    }

    private startMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }

        this.monitorInterval = setInterval(async () => {
            try {
                for (const [orderId, config] of this.monitoredOrders) {
                    const marketData = await this.marketDataService.getLatestMarketData(config.symbol);
                    if (!marketData.length) continue;

                    const currentPrice = marketData[0]?.close;
                    if (currentPrice === undefined || currentPrice === null) continue;

                    // Check if stop loss is hit
                    if (currentPrice <= config.stopPrice) {
                        await this.triggerStopLoss(orderId);
                        continue;
                    }

                    // Check if target is hit
                    if (config.targetPrice && currentPrice >= config.targetPrice) {
                        await this.triggerTarget(orderId);
                        continue;
                    }

                    // Update trailing stop if applicable
                    if (config.trailingStop && config.trailDistance) {
                        const newStopPrice = currentPrice - config.trailDistance;
                        if (newStopPrice > config.stopPrice) {
                            config.stopPrice = newStopPrice;
                            await this.updateStopLoss(orderId, newStopPrice);
                        }
                    }
                }
            } catch (error) {
                logger.error('Error in order monitoring:', error);
            }
        }, 1000); // Check every second
    }

    private async triggerStopLoss(orderId: string) {
        try {
            await this.orderService.updateTradeStatus(orderId, 'STOPPED');
            this.monitoredOrders.delete(orderId);
            logger.info('Stop loss triggered for order:', orderId);
        } catch (error) {
            logger.error('Failed to trigger stop loss:', error);
        }
    }

    private async triggerTarget(orderId: string) {
        try {
            await this.orderService.updateTradeStatus(orderId, 'COMPLETED');
            this.monitoredOrders.delete(orderId);
            logger.info('Target achieved for order:', orderId);
        } catch (error) {
            logger.error('Failed to trigger target:', error);
        }
    }

    private async updateStopLoss(orderId: string, newStopPrice: number) {
        try {
            const trade = await this.orderService.getTrade(orderId);
            if (!trade) return;

            await this.orderService.updateTradeStatus(orderId, 'UPDATED');
            logger.info(`Updated trailing stop for order: ${orderId} New stop: ${newStopPrice}`);
        } catch (error) {
            logger.error('Failed to update stop loss:', error);
        }
    }

    private calculateIcebergLotPrice(basePrice?: number, variance?: number): number | undefined {
        if (!basePrice || !variance) return undefined;

        const varianceAmount = basePrice * (variance / 100);
        const minPrice = basePrice - varianceAmount;
        const maxPrice = basePrice + varianceAmount;

        return minPrice + Math.random() * (maxPrice - minPrice);
    }

    async cancelOrder(orderId: string) {
        try {
            await this.orderService.updateTradeStatus(orderId, 'CANCELLED');
            this.monitoredOrders.delete(orderId);
            logger.info('Order cancelled:', orderId);
        } catch (error) {
            logger.error('Failed to cancel order:', error);
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