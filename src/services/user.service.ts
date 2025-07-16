import { db } from '../database/database';
import { logger } from '../logger/logger';
import { TradingSession } from '../types';

export class UserService {
    async createUser(email: string, name?: string) {
        try {
            const user = await db.create('User', {
                id: `user_${Date.now()}`,
                email,
                name: name || null,
                createdAt: new Date(),
                updatedAt: new Date()
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
            const user = await db.findUnique('User', { id });
            return user;
        } catch (error) {
            logger.error('Failed to get user by ID:', error);
            throw error;
        }
    }

    async getUserByEmail(email: string) {
        try {
            const user = await db.findUnique('User', { email });
            return user;
        } catch (error) {
            logger.error('Failed to get user by email:', error);
            throw error;
        }
    }

    async createTradingSession(userId: string, sessionData: Partial<TradingSession>) {
        try {
            const session = await db.create('TradingSession', {
                id: `session_${Date.now()}`,
                userId,
                startTime: new Date(),
                endTime: sessionData.endTime || null,
                mode: sessionData.mode || 'paper',
                capital: sessionData.capital || 100000,
                status: 'active',
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                totalPnL: 0,
                maxDrawdown: 0,
                config: sessionData.config || {}
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
            const session = await db.findUnique('TradingSession', { id: sessionId });
            return session;
        } catch (error) {
            logger.error('Failed to get trading session:', error);
            throw error;
        }
    }

    async getActiveTradingSessions(userId: string) {
        try {
            const sessions = await db.findMany('TradingSession', {
                where: {
                    userId,
                    status: 'active',
                }
            });
            return sessions;
        } catch (error) {
            logger.error('Failed to get active trading sessions:', error);
            throw error;
        }
    }

    async updateTradingSession(sessionId: string, updates: Partial<TradingSession>) {
        try {
            const session = await db.update('TradingSession', { id: sessionId }, updates);
            logger.info('Trading session updated:', session.id);
            return session;
        } catch (error) {
            logger.error('Failed to update trading session:', error);
            throw error;
        }
    }

    async endTradingSession(sessionId: string) {
        try {
            const session = await db.update('TradingSession', { id: sessionId }, {
                status: 'completed',
                endTime: new Date()
            });
            logger.info('Trading session ended:', session.id);
            return session;
        } catch (error) {
            logger.error('Failed to end trading session:', error);
            throw error;
        }
    }

    async getAllUsers() {
        try {
            const users = await db.findMany('User', {
                orderBy: { createdAt: 'desc' }
            });
            return users;
        } catch (error) {
            logger.error('Failed to get all users:', error);
            throw error;
        }
    }

    async deleteUser(userId: string) {
        try {
            const user = await db.delete('User', { id: userId });
            logger.info('User deleted:', user.id);
            return user;
        } catch (error) {
            logger.error('Failed to delete user:', error);
            throw error;
        }
    }

    async updateUser(userId: string, updates: { name?: string; email?: string }) {
        try {
            const updateData = {
                ...updates,
                updatedAt: new Date()
            };
            const user = await db.update('User', { id: userId }, updateData);
            logger.info('User updated:', user.id);
            return user;
        } catch (error) {
            logger.error('Failed to update user:', error);
            throw error;
        }
    }
} 