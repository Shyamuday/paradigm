import { db } from '../database/database';
import { logger } from '../logger/logger';
import { TradeOrder, TradeSignal, OrderResult } from '../types';

export class OrderService {
    async createTrade(sessionId: string, signal: TradeSignal, strategyId?: string) {
        try {
            // Get instrument
            const instrument = await db.findUnique('Instrument', { symbol: signal.symbol });

            if (!instrument) {
                throw new Error(`Instrument not found: ${signal.symbol}`);
            }

            const trade = await db.create('Trade', {
                id: `trade_${Date.now()}`,
                sessionId,
                instrumentId: instrument.id,
                strategyId: strategyId || null,
                action: signal.action,
                quantity: signal.quantity,
                price: signal.price,
                orderType: 'MARKET', // Default to market order
                status: 'PENDING',
                stopLoss: signal.stopLoss || null,
                target: signal.target || null,
                trailingStop: false,
                orderTime: new Date(),
                executionTime: null,
                realizedPnL: null,
                unrealizedPnL: null
            });

            logger.info('Trade created:', trade.id);
            return trade;
        } catch (error) {
            logger.error('Failed to create trade:', error);
            throw error;
        }
    }

    async updateTradeStatus(tradeId: string, status: string, orderId?: string, executionPrice?: number) {
        try {
            const updateData: any = {
                status,
                orderId: orderId || null,
                executionTime: status === 'COMPLETE' ? new Date() : null,
                realizedPnL: executionPrice ? await this.calculateRealizedPnL(tradeId, executionPrice) : null,
            };

            const trade = await db.update('Trade', { id: tradeId }, updateData);

            logger.info('Trade status updated:', trade.id, status);
            return trade;
        } catch (error) {
            logger.error('Failed to update trade status:', error);
            throw error;
        }
    }

    async getTrade(tradeId: string) {
        try {
            const trade = await db.findUnique('Trade', { id: tradeId });
            return trade;
        } catch (error) {
            logger.error('Failed to get trade:', error);
            throw error;
        }
    }

    async getTradesBySession(sessionId: string) {
        try {
            const trades = await db.findMany('Trade', {
                where: { sessionId },
                orderBy: { orderTime: 'desc' }
            });
            return trades;
        } catch (error) {
            logger.error('Failed to get trades by session:', error);
            throw error;
        }
    }

    async getTradesByStrategy(strategyId: string) {
        try {
            const trades = await db.findMany('Trade', {
                where: { strategyId },
                orderBy: { orderTime: 'desc' }
            });
            return trades;
        } catch (error) {
            logger.error('Failed to get trades by strategy:', error);
            throw error;
        }
    }

    async getPendingTrades(sessionId: string) {
        try {
            const trades = await db.findMany('Trade', {
                where: {
                    sessionId,
                    status: 'PENDING',
                },
                orderBy: { orderTime: 'asc' }
            });
            return trades;
        } catch (error) {
            logger.error('Failed to get pending trades:', error);
            throw error;
        }
    }

    async createPosition(sessionId: string, tradeId: string, positionData: {
        symbol: string;
        quantity: number;
        averagePrice: number;
        side: 'LONG' | 'SHORT';
        stopLoss?: number;
        target?: number;
    }) {
        try {
            // Get instrument
            const instrument = await db.findUnique('Instrument', { symbol: positionData.symbol });

            if (!instrument) {
                throw new Error(`Instrument not found: ${positionData.symbol}`);
            }

            const position = await db.create('Position', {
                id: `position_${Date.now()}`,
                sessionId,
                instrumentId: instrument.id,
                tradeId,
                quantity: positionData.quantity,
                averagePrice: positionData.averagePrice,
                currentPrice: positionData.averagePrice, // Initialize with average price
                side: positionData.side,
                stopLoss: positionData.stopLoss || null,
                target: positionData.target || null,
                trailingStop: false,
                openTime: new Date(),
                closeTime: null,
                unrealizedPnL: null,
                realizedPnL: null
            });

            logger.info('Position created:', position.id);
            return position;
        } catch (error) {
            logger.error('Failed to create position:', error);
            throw error;
        }
    }

    async updatePosition(positionId: string, updates: {
        currentPrice?: number;
        quantity?: number;
        stopLoss?: number;
        target?: number;
        unrealizedPnL?: number;
        realizedPnL?: number;
    }) {
        try {
            const updateData: any = {};

            if (updates.currentPrice !== undefined) updateData.currentPrice = updates.currentPrice;
            if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
            if (updates.stopLoss !== undefined) updateData.stopLoss = updates.stopLoss;
            if (updates.target !== undefined) updateData.target = updates.target;
            if (updates.unrealizedPnL !== undefined) updateData.unrealizedPnL = updates.unrealizedPnL;
            if (updates.realizedPnL !== undefined) updateData.realizedPnL = updates.realizedPnL;

            const position = await db.update('Position', { id: positionId }, updateData);

            logger.info('Position updated:', position.id);
            return position;
        } catch (error) {
            logger.error('Failed to update position:', error);
            throw error;
        }
    }

    async closePosition(positionId: string, closePrice: number) {
        try {
            const position = await db.update('Position', { id: positionId }, {
                currentPrice: closePrice,
                closeTime: new Date(),
                realizedPnL: await this.calculatePositionPnL(positionId, closePrice),
                unrealizedPnL: 0,
            });

            logger.info('Position closed:', position.id);
            return position;
        } catch (error) {
            logger.error('Failed to close position:', error);
            throw error;
        }
    }

    async getPositions(sessionId: string) {
        try {
            const positions = await db.findMany('Position', {
                where: { sessionId },
                orderBy: { openTime: 'desc' }
            });
            return positions;
        } catch (error) {
            logger.error('Failed to get positions:', error);
            throw error;
        }
    }

    async getOpenPositions(sessionId: string) {
        try {
            const positions = await db.findMany('Position', {
                where: {
                    sessionId,
                    closeTime: null,
                },
                orderBy: { openTime: 'desc' }
            });
            return positions;
        } catch (error) {
            logger.error('Failed to get open positions:', error);
            throw error;
        }
    }

    private async calculateRealizedPnL(tradeId: string, executionPrice: number): Promise<number> {
        try {
            const trade = await db.findUnique('Trade', { id: tradeId });

            if (!trade) {
                logger.error('Trade not found for P&L calculation:', tradeId);
                return 0;
            }

            // Get related positions
            const positions = await db.findMany('Position', {
                where: { tradeId }
            });

            // For a closing trade, calculate P&L based on position
            if (positions.length > 0) {
                const position = positions[0]; // Get the related position
                const pnl = await this.calculatePositionPnL(position.id, executionPrice);
                return pnl;
            }

            // For an opening trade, P&L is 0 as position is just being established
            return 0;
        } catch (error) {
            logger.error('Error calculating realized P&L:', error);
            return 0;
        }
    }

    private async calculatePositionPnL(positionId: string, closePrice: number): Promise<number> {
        try {
            const position = await db.findUnique('Position', { id: positionId });

            if (!position || !position.averagePrice || !position.quantity) {
                return 0;
            }

            const priceDiff = position.side === 'LONG'
                ? closePrice - position.averagePrice
                : position.averagePrice - closePrice;

            return priceDiff * position.quantity;
        } catch (error) {
            logger.error('Error calculating position P&L:', error);
            return 0;
        }
    }

    async updatePositionPnL(positionId: string, currentPrice: number) {
        try {
            const position = await db.findUnique('Position', { id: positionId });

            if (!position) {
                logger.error('Position not found for P&L update:', positionId);
                return;
            }

            const unrealizedPnL = await this.calculatePositionPnL(position.id, currentPrice);

            await db.update('Position', { id: positionId }, {
                currentPrice,
                unrealizedPnL,
            });

            logger.debug('Position P&L updated:', positionId, unrealizedPnL);
        } catch (error) {
            logger.error('Failed to update position P&L:', error);
            throw error;
        }
    }

    async getPositionMetrics(sessionId: string) {
        try {
            const positions = await db.findMany('Position', {
                where: {
                    sessionId,
                    closeTime: null, // Only open positions
                },
                include: {
                    instrument: true,
                },
            });

            let totalValue = 0;
            let totalUnrealizedPnL = 0;
            let totalRealizedPnL = 0;

            for (const position of positions) {
                if (position.currentPrice && position.quantity) {
                    totalValue += position.currentPrice * Math.abs(position.quantity);
                    totalUnrealizedPnL += position.unrealizedPnL || 0;
                    totalRealizedPnL += position.realizedPnL || 0;
                }
            }

            return {
                openPositions: positions.length,
                totalPositionValue: totalValue,
                totalUnrealizedPnL,
                totalRealizedPnL,
                netPnL: totalUnrealizedPnL + totalRealizedPnL,
            };
        } catch (error) {
            logger.error('Failed to get position metrics:', error);
            throw error;
        }
    }

    async getSessionPnL(sessionId: string) {
        try {
            const positions = await db.findMany('Position', {
                where: { sessionId },
                select: {
                    realizedPnL: true,
                    unrealizedPnL: true,
                },
            });

            const totalRealizedPnL = positions.reduce((sum, pos) => sum + (pos.realizedPnL || 0), 0);
            const totalUnrealizedPnL = positions.reduce((sum, pos) => sum + (pos.unrealizedPnL || 0), 0);

            return {
                realizedPnL: totalRealizedPnL,
                unrealizedPnL: totalUnrealizedPnL,
                totalPnL: totalRealizedPnL + totalUnrealizedPnL,
            };
        } catch (error) {
            logger.error('Failed to get session P&L:', error);
            throw error;
        }
    }

    async getRecentTrades(limit: number = 10) {
        try {
            const trades = await db.findMany('Trade', {
                take: limit,
                orderBy: {
                    orderTime: 'desc'
                },
                include: {
                    instrument: true
                }
            });
            return trades;
        } catch (error) {
            logger.error('Failed to get recent trades:', error);
            throw error;
        }
    }
} 