import { PrismaClient } from '@prisma/client';
import { logger } from '../logger/logger';
import { TradeOrder, TradeSignal, OrderResult } from '../types';

const prisma = new PrismaClient();

export class OrderService {
    async createTrade(sessionId: string, signal: TradeSignal, strategyId?: string) {
        try {
            // Get instrument
            const instrument = await prisma.instrument.findUnique({
                where: { symbol: signal.symbol }
            });

            if (!instrument) {
                throw new Error(`Instrument not found: ${signal.symbol}`);
            }

            const trade = await prisma.trade.create({
                data: {
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
                }
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
            };

            if (executionPrice) {
                updateData.realizedPnL = await this.calculateRealizedPnL(tradeId, executionPrice);
            }

            const trade = await prisma.trade.update({
                where: { id: tradeId },
                data: updateData
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
            const trade = await prisma.trade.findUnique({
                where: { id: tradeId }
            });
            return trade;
        } catch (error) {
            logger.error('Failed to get trade:', error);
            throw error;
        }
    }

    async getTradesBySession(sessionId: string) {
        try {
            const trades = await prisma.trade.findMany({
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
            const trades = await prisma.trade.findMany({
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
            const trades = await prisma.trade.findMany({
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
            const instrument = await prisma.instrument.findUnique({
                where: { symbol: positionData.symbol }
            });

            if (!instrument) {
                throw new Error(`Instrument not found: ${positionData.symbol}`);
            }

            const position = await prisma.position.create({
                data: {
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
                }
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

            const position = await prisma.position.update({
                where: { id: positionId },
                data: updateData
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
            const position = await prisma.position.update({
                where: { id: positionId },
                data: {
                    currentPrice: closePrice,
                    closeTime: new Date(),
                    realizedPnL: await this.calculatePositionPnL(positionId, closePrice),
                    unrealizedPnL: 0,
                }
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
            const positions = await prisma.position.findMany({
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
            const positions = await prisma.position.findMany({
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
            const trade = await prisma.trade.findUnique({
                where: { id: tradeId }
            });

            if (!trade) {
                logger.error('Trade not found for P&L calculation:', tradeId);
                return 0;
            }

            // Get related positions
            const positions = await prisma.position.findMany({
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
            logger.error('Failed to calculate realized P&L:', error);
            return 0;
        }
    }

    private async calculatePositionPnL(positionId: string, closePrice: number): Promise<number> {
        try {
            const position = await prisma.position.findUnique({
                where: { id: positionId }
            });

            if (!position) {
                logger.error('Position not found for P&L calculation:', positionId);
                return 0;
            }

            const priceDiff = closePrice - position.averagePrice;
            const pnl = position.side === 'LONG' ? priceDiff : -priceDiff;
            return pnl * position.quantity;
        } catch (error) {
            logger.error('Failed to calculate position P&L:', error);
            return 0;
        }
    }

    async updatePositionPnL(positionId: string, currentPrice: number) {
        try {
            const position = await prisma.position.findUnique({
                where: { id: positionId }
            });

            if (!position) {
                throw new Error(`Position not found: ${positionId}`);
            }

            const priceDiff = currentPrice - position.averagePrice;
            const unrealizedPnL = position.side === 'LONG' ? priceDiff : -priceDiff;
            const totalPnL = unrealizedPnL * position.quantity;

            await prisma.position.update({
                where: { id: positionId },
                data: {
                    currentPrice,
                    unrealizedPnL: totalPnL
                }
            });

            logger.info('Position P&L updated:', positionId, totalPnL);
            return totalPnL;
        } catch (error) {
            logger.error('Failed to update position P&L:', error);
            throw error;
        }
    }

    async getPositionMetrics(sessionId: string) {
        try {
            const positions = await prisma.position.findMany({
                where: { sessionId },
                include: {
                    instrument: true
                }
            });

            const metrics = {
                totalPositions: positions.length,
                openPositions: positions.filter(p => p.closeTime === null).length,
                closedPositions: positions.filter(p => p.closeTime !== null).length,
                totalRealizedPnL: positions.reduce((sum, p) => sum + (p.realizedPnL || 0), 0),
                totalUnrealizedPnL: positions.reduce((sum, p) => sum + (p.unrealizedPnL || 0), 0),
                longPositions: positions.filter(p => p.side === 'LONG').length,
                shortPositions: positions.filter(p => p.side === 'SHORT').length,
                positionsByInstrument: {}
            };

            // Group positions by instrument
            positions.forEach(position => {
                const symbol = position.instrument.symbol;
                if (!metrics.positionsByInstrument[symbol]) {
                    metrics.positionsByInstrument[symbol] = {
                        count: 0,
                        totalPnL: 0,
                        openPositions: 0
                    };
                }
                metrics.positionsByInstrument[symbol].count++;
                metrics.positionsByInstrument[symbol].totalPnL += (position.realizedPnL || 0) + (position.unrealizedPnL || 0);
                if (position.closeTime === null) {
                    metrics.positionsByInstrument[symbol].openPositions++;
                }
            });

            return metrics;
        } catch (error) {
            logger.error('Failed to get position metrics:', error);
            throw error;
        }
    }

    async getSessionPnL(sessionId: string) {
        try {
            const trades = await prisma.trade.findMany({
                where: { sessionId }
            });

            const positions = await prisma.position.findMany({
                where: { sessionId }
            });

            const realizedPnL = trades.reduce((sum, trade) => sum + (trade.realizedPnL || 0), 0);
            const unrealizedPnL = positions.reduce((sum, position) => sum + (position.unrealizedPnL || 0), 0);

            return {
                realizedPnL,
                unrealizedPnL,
                totalPnL: realizedPnL + unrealizedPnL,
                tradeCount: trades.length,
                positionCount: positions.length
            };
        } catch (error) {
            logger.error('Failed to get session P&L:', error);
            throw error;
        }
    }

    async getRecentTrades(limit: number = 10) {
        try {
            const trades = await prisma.trade.findMany({
                take: limit,
                orderBy: { orderTime: 'desc' },
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