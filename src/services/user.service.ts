import { db } from '../database/database';
import { logger } from '../logger/logger';
import { TradingSession } from '../types';

export class UserService {
    async createUser(email: string, name?: string) {
        try {
            const user = await db.user.create({
                data: {
                    email,
                    name: name || null,
                },
            });

            logger.info('User created successfully:', user.id);
            return user;
        } catch (error) {
            logger.error('Failed to create user:', error);
            throw error;
        }
    }

    async getUserById(id: string) {
        try {
            const user = await db.user.findUnique({
                where: { id },
                include: {
                    sessions: true,
                },
            });

            return user;
        } catch (error) {
            logger.error('Failed to get user by ID:', error);
            throw error;
        }
    }

    async getUserByEmail(email: string) {
        try {
            const user = await db.user.findUnique({
                where: { email },
                include: {
                    sessions: true,
                },
            });

            return user;
        } catch (error) {
            logger.error('Failed to get user by email:', error);
            throw error;
        }
    }

    async createTradingSession(userId: string, sessionData: Partial<TradingSession>) {
        try {
            const session = await db.tradingSession.create({
                data: {
                    userId,
                    mode: sessionData.mode || 'paper',
                    capital: sessionData.capital || 100000,
                    status: 'active',
                },
            });

            logger.info('Trading session created:', session.id);
            return session;
        } catch (error) {
            logger.error('Failed to create trading session:', error);
            throw error;
        }
    }

    async getTradingSession(sessionId: string) {
        try {
            const session = await db.tradingSession.findUnique({
                where: { id: sessionId },
                include: {
                    user: true,
                    trades: true,
                    positions: true,
                },
            });

            return session;
        } catch (error) {
            logger.error('Failed to get trading session:', error);
            throw error;
        }
    }

    async getActiveTradingSessions(userId: string) {
        try {
            const sessions = await db.tradingSession.findMany({
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
        } catch (error) {
            logger.error('Failed to get active trading sessions:', error);
            throw error;
        }
    }

    async updateTradingSession(sessionId: string, updates: Partial<TradingSession>) {
        try {
            const session = await db.tradingSession.update({
                where: { id: sessionId },
                data: updates,
            });

            logger.info('Trading session updated:', session.id);
            return session;
        } catch (error) {
            logger.error('Failed to update trading session:', error);
            throw error;
        }
    }

    async stopTradingSession(sessionId: string) {
        try {
            const session = await db.tradingSession.update({
                where: { id: sessionId },
                data: {
                    status: 'stopped',
                    endTime: new Date(),
                },
            });

            logger.info('Trading session stopped:', session.id);
            return session;
        } catch (error) {
            logger.error('Failed to stop trading session:', error);
            throw error;
        }
    }
} 