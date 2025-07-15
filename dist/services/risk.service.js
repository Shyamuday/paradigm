"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskService = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../logger/logger");
const prisma = new client_1.PrismaClient();
class RiskService {
    async createRiskProfile(userId, profile) {
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
            };
        }
        catch (error) {
            logger_1.logger.error('Error creating risk profile:', error);
            throw error;
        }
    }
    async updateRiskProfile(id, profile) {
        try {
            const result = await prisma.riskProfile.update({
                where: { id },
                data: profile
            });
            return {
                ...result,
                var: result.var || 0,
                sharpeRatio: result.sharpeRatio || 0
            };
        }
        catch (error) {
            logger_1.logger.error('Error updating risk profile:', error);
            throw error;
        }
    }
    async getRiskProfile(userId) {
        try {
            const result = await prisma.riskProfile.findUnique({
                where: { userId }
            });
            if (!result)
                return null;
            return {
                ...result,
                var: result.var || 0,
                sharpeRatio: result.sharpeRatio || 0
            };
        }
        catch (error) {
            logger_1.logger.error('Error fetching risk profile:', error);
            throw error;
        }
    }
    async updateRiskMetrics(sessionId, metrics) {
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
            };
        }
        catch (error) {
            logger_1.logger.error('Error updating risk metrics:', error);
            throw error;
        }
    }
    async getRiskMetrics(sessionId, startDate, endDate) {
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
            }));
        }
        catch (error) {
            logger_1.logger.error('Error fetching risk metrics:', error);
            throw error;
        }
    }
    calculateValueAtRisk(returns, confidenceLevel = 0.95) {
        if (!returns.length)
            return 0;
        const sortedReturns = returns.sort((a, b) => a - b);
        const index = Math.floor((1 - confidenceLevel) * returns.length);
        return -sortedReturns[index];
    }
    calculateSharpeRatio(returns, riskFreeRate = 0.02) {
        if (!returns.length)
            return 0;
        const meanReturn = returns.reduce((a, b) => a + b) / returns.length;
        const stdDev = Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returns.length);
        return stdDev === 0 ? 0 : (meanReturn - riskFreeRate) / stdDev;
    }
    async checkPositionRisk(userId, positionSize, currentPositions) {
        try {
            const profile = await this.getRiskProfile(userId);
            if (!profile)
                return true;
            if (positionSize > profile.maxPositionSize) {
                logger_1.logger.warn(`Position size ${positionSize} exceeds maximum allowed ${profile.maxPositionSize}`);
                return false;
            }
            if (currentPositions >= profile.maxOpenTrades) {
                logger_1.logger.warn(`Maximum number of open trades (${profile.maxOpenTrades}) reached`);
                return false;
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error('Error checking position risk:', error);
            throw error;
        }
    }
    async checkDailyLossLimit(userId, sessionId) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const [profile, metrics] = await Promise.all([
                this.getRiskProfile(userId),
                this.getRiskMetrics(sessionId, today, today)
            ]);
            if (!profile || !metrics.length)
                return true;
            const dailyPnL = metrics[0].dailyPnL;
            if (Math.abs(dailyPnL) > profile.maxDailyLoss) {
                logger_1.logger.warn(`Daily loss limit of ${profile.maxDailyLoss} exceeded. Current loss: ${dailyPnL}`);
                return false;
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error('Error checking daily loss limit:', error);
            throw error;
        }
    }
}
exports.RiskService = RiskService;
//# sourceMappingURL=risk.service.js.map