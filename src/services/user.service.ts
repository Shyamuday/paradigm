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
                }
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
                where: { id }
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
                where: { email }
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
                    endTime: sessionData.endTime || null
                }
            });

            logger.info('Trading session created:', session.id);
            return session;
        } catch (error) {
            logger.error('Failed to create trading session:', error);
            throw error;
        }
    }

    async getActiveTradingSession(userId: string) {
        try {
            const session = await db.tradingSession.findFirst({
                where: {
                    userId,
                    status: 'active'
                },
                orderBy: {
                    startTime: 'desc'
                }
            });
            return session;
        } catch (error) {
            logger.error('Failed to get active trading session:', error);
            throw error;
        }
    }

    async getAllUsers() {
        try {
            const users = await db.user.findMany({
                orderBy: {
                    createdAt: 'desc'
                }
            });
            return users;
        } catch (error) {
            logger.error('Failed to get all users:', error);
            throw error;
        }
    }

    async updateUser(id: string, email?: string, name?: string) {
        try {
            const updateData: any = {};
            if (email !== undefined) updateData.email = email;
            if (name !== undefined) updateData.name = name;

            const user = await db.user.update({
                where: { id },
                data: updateData
            });

            logger.info('User updated:', user.id);
            return user;
        } catch (error) {
            logger.error('Failed to update user:', error);
            throw error;
        }
    }

    async deleteUser(id: string) {
        try {
            // First, delete all related trading sessions
            await db.tradingSession.deleteMany({
                where: { userId: id }
            });

            // Then delete the user
            const user = await db.user.delete({
                where: { id }
            });

            logger.info('User deleted:', user.id);
            return user;
        } catch (error) {
            logger.error('Failed to delete user:', error);
            throw error;
        }
    }

    async deactivateTradingSession(sessionId: string) {
        try {
            const session = await db.tradingSession.update({
                where: { id: sessionId },
                data: {
                    status: 'completed',
                    endTime: new Date()
                }
            });

            logger.info('Trading session deactivated:', sessionId);
            return session;
        } catch (error) {
            logger.error('Failed to deactivate trading session:', error);
            throw error;
        }
    }

    async getUserTradingSessions(userId: string) {
        try {
            const sessions = await db.tradingSession.findMany({
                where: { userId },
                orderBy: {
                    startTime: 'desc'
                }
            });
            return sessions;
        } catch (error) {
            logger.error('Failed to get user trading sessions:', error);
            throw error;
        }
    }
} 