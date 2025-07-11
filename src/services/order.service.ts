import { db } from '../database/database';
import { logger } from '../logger/logger';
import { TradeOrder, TradeSignal, OrderResult } from '../types';

export class OrderService {
    async createTrade(sessionId: string, signal: TradeSignal, strategyId?: string) {
        try {
            // Get instrument
            const instrument = await db.instrument.findUnique({
                where: { symbol: signal.symbol },
            });

            if (!instrument) {
                throw new Error(`Instrument not found: ${signal.symbol}`);
            }

            const trade = await db.trade.create({
                data: {
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
                },
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
            const trade = await db.trade.update({
                where: { id: tradeId },
                data: {
                    status,
                    orderId: orderId || null,
                    executionTime: status === 'COMPLETE' ? new Date() : null,
                    realizedPnL: executionPrice ? this.calculateRealizedPnL(tradeId, executionPrice) : null,
                },
            });

            logger.info('Trade status updated:', trade.id, status);
            return trade;
        } catch (error) {
            logger.error('Failed to update trade status:', error);
            throw error;
        }
    }

    async getTrade(tradeId: string) {
        try {
            const trade = await db.trade.findUnique({
                where: { id: tradeId },
                include: {
                    instrument: true,
                    strategy: true,
                    session: true,
                    positions: true,
                },
            });

            return trade;
        } catch (error) {
            logger.error('Failed to get trade:', error);
            throw error;
        }
    }

    async getTradesBySession(sessionId: string) {
        try {
            const trades = await db.trade.findMany({
                where: { sessionId },
                include: {
                    instrument: true,
                    strategy: true,
                    positions: true,
                },
                orderBy: { orderTime: 'desc' },
            });

            return trades;
        } catch (error) {
            logger.error('Failed to get trades by session:', error);
            throw error;
        }
    }

    async getTradesByStrategy(strategyId: string) {
        try {
            const trades = await db.trade.findMany({
                where: { strategyId },
                include: {
                    instrument: true,
                    session: true,
                    positions: true,
                },
                orderBy: { orderTime: 'desc' },
            });

            return trades;
        } catch (error) {
            logger.error('Failed to get trades by strategy:', error);
            throw error;
        }
    }

    async getPendingTrades(sessionId: string) {
        try {
            const trades = await db.trade.findMany({
                where: {
                    sessionId,
                    status: 'PENDING',
                },
                include: {
                    instrument: true,
                    strategy: true,
                },
                orderBy: { orderTime: 'asc' },
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
            const instrument = await db.instrument.findUnique({
                where: { symbol: positionData.symbol },
            });

            if (!instrument) {
                throw new Error(`Instrument not found: ${positionData.symbol}`);
            }

            const position = await db.position.create({
                data: {
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
                },
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

            const position = await db.position.update({
                where: { id: positionId },
                data: updateData,
            });

            logger.info('Position updated:', position.id);
            return position;
        } catch (error) {
            logger.error('Failed to update position:', error);
            throw error;
        }
    }

    async closePosition(positionId: string, closePrice: number) {
        try {
            const position = await db.position.update({
                where: { id: positionId },
                data: {
                    currentPrice: closePrice,
                    closeTime: new Date(),
                    realizedPnL: this.calculatePositionPnL(positionId, closePrice),
                    unrealizedPnL: 0,
                },
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
            const positions = await db.position.findMany({
                where: { sessionId },
                include: {
                    instrument: true,
                    trade: true,
                },
                orderBy: { openTime: 'desc' },
            });

            return positions;
        } catch (error) {
            logger.error('Failed to get positions:', error);
            throw error;
        }
    }

    async getOpenPositions(sessionId: string) {
        try {
            const positions = await db.position.findMany({
                where: {
                    sessionId,
                    closeTime: null,
                },
                include: {
                    instrument: true,
                    trade: true,
                },
                orderBy: { openTime: 'desc' },
            });

            return positions;
        } catch (error) {
            logger.error('Failed to get open positions:', error);
            throw error;
        }
    }

    private calculateRealizedPnL(tradeId: string, executionPrice: number): number {
        // TODO: Implement P&L calculation based on trade type and execution price
        return 0;
    }

    private calculatePositionPnL(positionId: string, closePrice: number): number {
        // TODO: Implement P&L calculation based on position and close price
        return 0;
    }

    async getSessionPnL(sessionId: string) {
        try {
            const positions = await db.position.findMany({
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
} 