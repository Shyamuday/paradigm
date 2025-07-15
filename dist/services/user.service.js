"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const database_1 = require("../database/database");
const logger_1 = require("../logger/logger");
class UserService {
    async createUser(email, name) {
        try {
            const user = await database_1.db.user.create({
                data: {
                    email,
                    name: name || null,
                },
            });
            logger_1.logger.info('User created successfully:', user.id);
            return user;
        }
        catch (error) {
            logger_1.logger.error('Failed to create user:', error);
            throw error;
        }
    }
    async getUserById(id) {
        try {
            const user = await database_1.db.user.findUnique({
                where: { id },
                include: {
                    sessions: true,
                },
            });
            return user;
        }
        catch (error) {
            logger_1.logger.error('Failed to get user by ID:', error);
            throw error;
        }
    }
    async getUserByEmail(email) {
        try {
            const user = await database_1.db.user.findUnique({
                where: { email },
                include: {
                    sessions: true,
                },
            });
            return user;
        }
        catch (error) {
            logger_1.logger.error('Failed to get user by email:', error);
            throw error;
        }
    }
    async createTradingSession(userId, sessionData) {
        try {
            const session = await database_1.db.tradingSession.create({
                data: {
                    userId,
                    mode: sessionData.mode || 'paper',
                    capital: sessionData.capital || 100000,
                    status: 'active',
                },
            });
            logger_1.logger.info('Trading session created:', session.id);
            return session;
        }
        catch (error) {
            logger_1.logger.error('Failed to create trading session:', error);
            throw error;
        }
    }
    async getTradingSession(sessionId) {
        try {
            const session = await database_1.db.tradingSession.findUnique({
                where: { id: sessionId },
                include: {
                    user: true,
                    trades: true,
                    positions: true,
                },
            });
            return session;
        }
        catch (error) {
            logger_1.logger.error('Failed to get trading session:', error);
            throw error;
        }
    }
    async getActiveTradingSessions(userId) {
        try {
            const sessions = await database_1.db.tradingSession.findMany({
                where: {
                    userId,
                    status: 'active',
                },
                include: {
                    trades: true,
                    positions: true,
                },
            });
            return sessions;
        }
        catch (error) {
            logger_1.logger.error('Failed to get active trading sessions:', error);
            throw error;
        }
    }
    async updateTradingSession(sessionId, updates) {
        try {
            const session = await database_1.db.tradingSession.update({
                where: { id: sessionId },
                data: updates,
            });
            logger_1.logger.info('Trading session updated:', session.id);
            return session;
        }
        catch (error) {
            logger_1.logger.error('Failed to update trading session:', error);
            throw error;
        }
    }
    async stopTradingSession(sessionId) {
        try {
            const session = await database_1.db.tradingSession.update({
                where: { id: sessionId },
                data: {
                    status: 'stopped',
                    endTime: new Date(),
                },
            });
            logger_1.logger.info('Trading session stopped:', session.id);
            return session;
        }
        catch (error) {
            logger_1.logger.error('Failed to stop trading session:', error);
            throw error;
        }
    }
}
exports.UserService = UserService;
//# sourceMappingURL=user.service.js.map