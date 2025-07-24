import { PrismaClient, RiskProfile as PrismaRiskProfile, RiskMetrics as PrismaRiskMetrics } from '@prisma/client';
import { RiskProfile, RiskMetrics } from '../types';
import { logger } from '../logger/logger';

const prisma = new PrismaClient();

export class RiskService {
    // Risk Profile Management
    async createRiskProfile(userId: string, profile: Omit<RiskProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<PrismaRiskProfile> {
        try {
            const result = await prisma.riskProfile.create({
                data: {
                    userId,
                    maxDailyLoss: profile.maxDailyLoss,
                    maxDrawdown: profile.maxDrawdown,
                    maxPositionSize: profile.maxPositionSize,
                    maxOpenPositions: 10, // Default value
                    riskTolerance: 'MEDIUM',
                    maxDelta: null,
                    maxGamma: null,
                    maxTheta: null,
                    maxVega: null
                }
            });

            return result;
        } catch (error) {
            logger.error('Error creating risk profile:', error);
            throw error;
        }
    }

    async updateRiskProfile(id: string, profile: Partial<Omit<RiskProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<PrismaRiskProfile> {
        try {
            const result = await prisma.riskProfile.update({
                where: { id },
                data: profile
            });

            return result;
        } catch (error) {
            logger.error('Error updating risk profile:', error);
            throw error;
        }
    }

    async getRiskProfile(userId: string): Promise<PrismaRiskProfile | null> {
        try {
            const result = await prisma.riskProfile.findUnique({
                where: { userId }
            });

            return result;
        } catch (error) {
            logger.error('Error fetching risk profile:', error);
            throw error;
        }
    }

    // Risk Metrics Management
    async updateRiskMetrics(sessionId: string, metrics: Partial<Omit<RiskMetrics, 'id' | 'sessionId' | 'date'>>): Promise<PrismaRiskMetrics> {
        try {
            const timestamp = new Date();

            const result = await prisma.riskMetrics.create({
                data: {
                    sessionId,
                    timestamp,
                    dailyPnL: metrics.dailyPnL || 0,
                    drawdown: metrics.drawdown || 0,
                    totalValue: 0,
                    totalPnL: 0,
                    portfolioDelta: null,
                    portfolioGamma: null,
                    portfolioTheta: null,
                    portfolioVega: null,
                    sharpeRatio: null,
                    sortinoRatio: null,
                    maxDrawdown: null
                }
            });

            return result;
        } catch (error) {
            logger.error('Error updating risk metrics:', error);
            throw error;
        }
    }

    async getRiskMetrics(sessionId: string, startDate: Date, endDate: Date): Promise<PrismaRiskMetrics[]> {
        try {
            const results = await prisma.riskMetrics.findMany({
                where: {
                    sessionId,
                    timestamp: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                orderBy: {
                    timestamp: 'asc'
                }
            });

            return results;
        } catch (error) {
            logger.error('Error fetching risk metrics:', error);
            throw error;
        }
    }

    // Risk Calculations
    calculateValueAtRisk(returns: number[], confidenceLevel: number = 0.95): number {
        if (!returns.length) return 0;
        // Create a copy of returns array to avoid mutating the original
        const sortedReturns = [...returns].sort((a, b) => a - b);
        const index = Math.floor((1 - confidenceLevel) * returns.length);
        return -sortedReturns[index]!; // Add non-null assertion since we know array has elements

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

            // Check maximum open positions
            const maxOpenPositions = profile?.maxOpenPositions ?? 0;
            if (profile && maxOpenPositions > 0 && currentPositions >= maxOpenPositions) {
                logger.warn(`Maximum number of open positions (${maxOpenPositions}) reached`);
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

            const dailyPnL = metrics[0]?.dailyPnL ?? 0;
            if (profile && Math.abs(dailyPnL) > profile.maxDailyLoss) {
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