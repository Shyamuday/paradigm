import { PrismaClient } from '@prisma/client';
import { RiskProfile, RiskMetrics } from '../types';
import { logger } from '../logger/logger';

const prisma = new PrismaClient();

export class RiskService {
    // Risk Profile Management
    async createRiskProfile(userId: string, profile: Omit<RiskProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<RiskProfile> {
        try {
            const result = await prisma.riskProfile.create({
                data: {
                    userId,
                    ...profile
                }
            });

            return {
                ...result,
                var: result.var || 0,
                sharpeRatio: result.sharpeRatio || 0
            } as RiskProfile;
        } catch (error) {
            logger.error('Error creating risk profile:', error);
            throw error;
        }
    }

    async updateRiskProfile(id: string, profile: Partial<Omit<RiskProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<RiskProfile> {
        try {
            const result = await prisma.riskProfile.update({
                where: { id },
                data: profile
            });

            return {
                ...result,
                var: result.var || 0,
                sharpeRatio: result.sharpeRatio || 0
            } as RiskProfile;
        } catch (error) {
            logger.error('Error updating risk profile:', error);
            throw error;
        }
    }

    async getRiskProfile(userId: string): Promise<RiskProfile | null> {
        try {
            const result = await prisma.riskProfile.findUnique({
                where: { userId }
            });

            if (!result) return null;

            return {
                ...result,
                var: result.var || 0,
                sharpeRatio: result.sharpeRatio || 0
            } as RiskProfile;
        } catch (error) {
            logger.error('Error fetching risk profile:', error);
            throw error;
        }
    }

    // Risk Metrics Management
    async updateRiskMetrics(sessionId: string, metrics: Partial<Omit<RiskMetrics, 'id' | 'sessionId' | 'date'>>): Promise<RiskMetrics> {
        try {
            const date = new Date();
            date.setHours(0, 0, 0, 0);

            const result = await prisma.riskMetrics.upsert({
                where: {
                    sessionId_date: {
                        sessionId,
                        date
                    }
                },
                update: metrics,
                create: {
                    sessionId,
                    date,
                    dailyPnL: 0,
                    drawdown: 0,
                    currentRisk: 0,
                    maxDrawdown: 0,
                    winRate: 0,
                    profitFactor: 0,
                    ...metrics
                }
            });

            return {
                ...result,
                var: result.var || 0,
                sharpeRatio: result.sharpeRatio || 0
            } as RiskMetrics;
        } catch (error) {
            logger.error('Error updating risk metrics:', error);
            throw error;
        }
    }

    async getRiskMetrics(sessionId: string, startDate: Date, endDate: Date): Promise<RiskMetrics[]> {
        try {
            const results = await prisma.riskMetrics.findMany({
                where: {
                    sessionId,
                    date: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                orderBy: {
                    date: 'asc'
                }
            });

            return results.map(result => ({
                ...result,
                var: result.var || 0,
                sharpeRatio: result.sharpeRatio || 0
            })) as RiskMetrics[];
        } catch (error) {
            logger.error('Error fetching risk metrics:', error);
            throw error;
        }
    }

    // Risk Calculations
    calculateValueAtRisk(returns: number[], confidenceLevel: number = 0.95): number {
        if (!returns.length) return 0;
        const sortedReturns = returns.sort((a, b) => a - b);
        const index = Math.floor((1 - confidenceLevel) * returns.length);
        return -sortedReturns[index];
    }

    calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
        if (!returns.length) return 0;
        const meanReturn = returns.reduce((a, b) => a + b) / returns.length;
        const stdDev = Math.sqrt(
            returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returns.length
        );
        return stdDev === 0 ? 0 : (meanReturn - riskFreeRate) / stdDev;
    }

    // Position Risk Management
    async checkPositionRisk(userId: string, positionSize: number, currentPositions: number): Promise<boolean> {
        try {
            const profile = await this.getRiskProfile(userId);
            if (!profile) return true;

            // Check maximum position size
            if (positionSize > profile.maxPositionSize) {
                logger.warn(`Position size ${positionSize} exceeds maximum allowed ${profile.maxPositionSize}`);
                return false;
            }

            // Check maximum open trades
            if (currentPositions >= profile.maxOpenTrades) {
                logger.warn(`Maximum number of open trades (${profile.maxOpenTrades}) reached`);
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Error checking position risk:', error);
            throw error;
        }
    }

    // Daily Loss Management
    async checkDailyLossLimit(userId: string, sessionId: string): Promise<boolean> {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const [profile, metrics] = await Promise.all([
                this.getRiskProfile(userId),
                this.getRiskMetrics(sessionId, today, today)
            ]);

            if (!profile || !metrics.length) return true;

            const dailyPnL = metrics[0].dailyPnL;
            if (Math.abs(dailyPnL) > profile.maxDailyLoss) {
                logger.warn(`Daily loss limit of ${profile.maxDailyLoss} exceeded. Current loss: ${dailyPnL}`);
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Error checking daily loss limit:', error);
            throw error;
        }
    }
} 