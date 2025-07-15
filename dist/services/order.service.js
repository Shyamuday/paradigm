"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const database_1 = require("../database/database");
const logger_1 = require("../logger/logger");
class OrderService {
    async createTrade(sessionId, signal, strategyId) {
        try {
            const instrument = await database_1.db.instrument.findUnique({
                where: { symbol: signal.symbol },
            });
            if (!instrument) {
                throw new Error(`Instrument not found: ${signal.symbol}`);
            }
            const trade = await database_1.db.trade.create({
                data: {
                    sessionId,
                    instrumentId: instrument.id,
                    strategyId: strategyId || null,
                    action: signal.action,
                    quantity: signal.quantity,
                    price: signal.price,
                    orderType: 'MARKET',
                    status: 'PENDING',
                    stopLoss: signal.stopLoss || null,
                    target: signal.target || null,
                    trailingStop: false,
                },
            });
            logger_1.logger.info('Trade created:', trade.id);
            return trade;
        }
        catch (error) {
            logger_1.logger.error('Failed to create trade:', error);
            throw error;
        }
    }
    async updateTradeStatus(tradeId, status, orderId, executionPrice) {
        try {
            const trade = await database_1.db.trade.update({
                where: { id: tradeId },
                data: {
                    status,
                    orderId: orderId || null,
                    executionTime: status === 'COMPLETE' ? new Date() : null,
                    realizedPnL: executionPrice ? await this.calculateRealizedPnL(tradeId, executionPrice) : null,
                },
            });
            logger_1.logger.info('Trade status updated:', trade.id, status);
            return trade;
        }
        catch (error) {
            logger_1.logger.error('Failed to update trade status:', error);
            throw error;
        }
    }
    async getTrade(tradeId) {
        try {
            const trade = await database_1.db.trade.findUnique({
                where: { id: tradeId },
                include: {
                    instrument: true,
                    strategy: true,
                    session: true,
                    positions: true,
                },
            });
            return trade;
        }
        catch (error) {
            logger_1.logger.error('Failed to get trade:', error);
            throw error;
        }
    }
    async getTradesBySession(sessionId) {
        try {
            const trades = await database_1.db.trade.findMany({
                where: { sessionId },
                include: {
                    instrument: true,
                    strategy: true,
                    positions: true,
                },
                orderBy: { orderTime: 'desc' },
            });
            return trades;
        }
        catch (error) {
            logger_1.logger.error('Failed to get trades by session:', error);
            throw error;
        }
    }
    async getTradesByStrategy(strategyId) {
        try {
            const trades = await database_1.db.trade.findMany({
                where: { strategyId },
                include: {
                    instrument: true,
                    session: true,
                    positions: true,
                },
                orderBy: { orderTime: 'desc' },
            });
            return trades;
        }
        catch (error) {
            logger_1.logger.error('Failed to get trades by strategy:', error);
            throw error;
        }
    }
    async getPendingTrades(sessionId) {
        try {
            const trades = await database_1.db.trade.findMany({
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
        }
        catch (error) {
            logger_1.logger.error('Failed to get pending trades:', error);
            throw error;
        }
    }
    async createPosition(sessionId, tradeId, positionData) {
        try {
            const instrument = await database_1.db.instrument.findUnique({
                where: { symbol: positionData.symbol },
            });
            if (!instrument) {
                throw new Error(`Instrument not found: ${positionData.symbol}`);
            }
            const position = await database_1.db.position.create({
                data: {
                    sessionId,
                    instrumentId: instrument.id,
                    tradeId,
                    quantity: positionData.quantity,
                    averagePrice: positionData.averagePrice,
                    currentPrice: positionData.averagePrice,
                    side: positionData.side,
                    stopLoss: positionData.stopLoss || null,
                    target: positionData.target || null,
                    trailingStop: false,
                },
            });
            logger_1.logger.info('Position created:', position.id);
            return position;
        }
        catch (error) {
            logger_1.logger.error('Failed to create position:', error);
            throw error;
        }
    }
    async updatePosition(positionId, updates) {
        try {
            const updateData = {};
            if (updates.currentPrice !== undefined)
                updateData.currentPrice = updates.currentPrice;
            if (updates.quantity !== undefined)
                updateData.quantity = updates.quantity;
            if (updates.stopLoss !== undefined)
                updateData.stopLoss = updates.stopLoss;
            if (updates.target !== undefined)
                updateData.target = updates.target;
            if (updates.unrealizedPnL !== undefined)
                updateData.unrealizedPnL = updates.unrealizedPnL;
            if (updates.realizedPnL !== undefined)
                updateData.realizedPnL = updates.realizedPnL;
            const position = await database_1.db.position.update({
                where: { id: positionId },
                data: updateData,
            });
            logger_1.logger.info('Position updated:', position.id);
            return position;
        }
        catch (error) {
            logger_1.logger.error('Failed to update position:', error);
            throw error;
        }
    }
    async closePosition(positionId, closePrice) {
        try {
            const position = await database_1.db.position.update({
                where: { id: positionId },
                data: {
                    currentPrice: closePrice,
                    closeTime: new Date(),
                    realizedPnL: await this.calculatePositionPnL(positionId, closePrice),
                    unrealizedPnL: 0,
                },
            });
            logger_1.logger.info('Position closed:', position.id);
            return position;
        }
        catch (error) {
            logger_1.logger.error('Failed to close position:', error);
            throw error;
        }
    }
    async getPositions(sessionId) {
        try {
            const positions = await database_1.db.position.findMany({
                where: { sessionId },
                include: {
                    instrument: true,
                    trade: true,
                },
                orderBy: { openTime: 'desc' },
            });
            return positions;
        }
        catch (error) {
            logger_1.logger.error('Failed to get positions:', error);
            throw error;
        }
    }
    async getOpenPositions(sessionId) {
        try {
            const positions = await database_1.db.position.findMany({
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
        }
        catch (error) {
            logger_1.logger.error('Failed to get open positions:', error);
            throw error;
        }
    }
    async calculateRealizedPnL(tradeId, executionPrice) {
        try {
            const trade = await database_1.db.trade.findUnique({
                where: { id: tradeId },
                include: {
                    positions: true,
                }
            });
            if (!trade) {
                logger_1.logger.error('Trade not found for P&L calculation:', tradeId);
                return 0;
            }
            if (trade.positions.length > 0) {
                const position = trade.positions[0];
                const pnl = await this.calculatePositionPnL(position, executionPrice);
                return pnl;
            }
            return 0;
        }
        catch (error) {
            logger_1.logger.error('Error calculating realized P&L:', error);
            return 0;
        }
    }
    async calculatePositionPnL(position, closePrice) {
        if (!position || !position.averagePrice || !position.quantity) {
            return 0;
        }
        const entryPrice = position.averagePrice;
        const quantity = position.quantity;
        const side = position.side;
        if (side === 'LONG') {
            return (closePrice - entryPrice) * quantity;
        }
        else if (side === 'SHORT') {
            return (entryPrice - closePrice) * quantity;
        }
        return 0;
    }
    async updatePositionPnL(positionId, currentPrice) {
        try {
            const position = await database_1.db.position.findUnique({
                where: { id: positionId },
            });
            if (!position) {
                logger_1.logger.error('Position not found for P&L update:', positionId);
                return;
            }
            const unrealizedPnL = await this.calculatePositionPnL(position, currentPrice);
            await database_1.db.position.update({
                where: { id: positionId },
                data: {
                    currentPrice,
                    unrealizedPnL,
                },
            });
            logger_1.logger.debug('Position P&L updated:', positionId, unrealizedPnL);
        }
        catch (error) {
            logger_1.logger.error('Failed to update position P&L:', error);
            throw error;
        }
    }
    async getPositionMetrics(sessionId) {
        try {
            const positions = await database_1.db.position.findMany({
                where: {
                    sessionId,
                    closeTime: null,
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
        }
        catch (error) {
            logger_1.logger.error('Failed to get position metrics:', error);
            throw error;
        }
    }
    async getSessionPnL(sessionId) {
        try {
            const positions = await database_1.db.position.findMany({
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
        }
        catch (error) {
            logger_1.logger.error('Failed to get session P&L:', error);
            throw error;
        }
    }
    async getRecentTrades(limit = 10) {
        try {
            const trades = await database_1.db.trade.findMany({
                take: limit,
                orderBy: {
                    orderTime: 'desc'
                },
                include: {
                    instrument: true
                }
            });
            return trades;
        }
        catch (error) {
            logger_1.logger.error('Failed to get recent trades:', error);
            throw error;
        }
    }
}
exports.OrderService = OrderService;
//# sourceMappingURL=order.service.js.map