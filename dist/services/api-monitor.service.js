"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiMonitorService = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../logger/logger");
const prisma = new client_1.PrismaClient();
class ApiMonitorService {
    async trackApiCall(userId, endpoint, method, responseTime, isError = false) {
        try {
            const date = new Date();
            const hour = date.getHours();
            date.setHours(0, 0, 0, 0);
            await prisma.apiUsage.upsert({
                where: {
                    userId_endpoint_method_date_hour: {
                        userId,
                        endpoint,
                        method,
                        date,
                        hour
                    }
                },
                update: {
                    requestCount: { increment: 1 },
                    errorCount: isError ? { increment: 1 } : { increment: 0 },
                    avgResponseTime: responseTime
                },
                create: {
                    userId,
                    endpoint,
                    method,
                    date,
                    hour,
                    requestCount: 1,
                    errorCount: isError ? 1 : 0,
                    avgResponseTime: responseTime
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error tracking API call:', error);
            throw error;
        }
    }
    async checkQuota(userId, endpoint) {
        try {
            const quota = await prisma.apiQuota.findUnique({
                where: {
                    userId_endpoint: {
                        userId,
                        endpoint
                    }
                }
            });
            if (!quota)
                return true;
            if (quota.resetTime <= new Date()) {
                await prisma.apiQuota.update({
                    where: { id: quota.id },
                    data: {
                        currentUsage: 0,
                        resetTime: this.getNextResetTime(),
                        isExceeded: false
                    }
                });
                return true;
            }
            return quota.currentUsage < quota.dailyLimit;
        }
        catch (error) {
            logger_1.logger.error('Error checking API quota:', error);
            throw error;
        }
    }
    async incrementQuotaUsage(userId, endpoint) {
        try {
            const quota = await prisma.apiQuota.findUnique({
                where: {
                    userId_endpoint: {
                        userId,
                        endpoint
                    }
                }
            });
            if (!quota)
                return;
            const isExceeded = quota.currentUsage + 1 >= quota.dailyLimit;
            await prisma.apiQuota.update({
                where: { id: quota.id },
                data: {
                    currentUsage: { increment: 1 },
                    isExceeded
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error incrementing API quota usage:', error);
            throw error;
        }
    }
    async setQuota(userId, endpoint, dailyLimit) {
        try {
            const quota = await prisma.apiQuota.upsert({
                where: {
                    userId_endpoint: {
                        userId,
                        endpoint
                    }
                },
                update: {
                    dailyLimit,
                    resetTime: this.getNextResetTime()
                },
                create: {
                    userId,
                    endpoint,
                    dailyLimit,
                    currentUsage: 0,
                    resetTime: this.getNextResetTime(),
                    isExceeded: false
                }
            });
            return quota;
        }
        catch (error) {
            logger_1.logger.error('Error setting API quota:', error);
            throw error;
        }
    }
    async logApiError(userId, endpoint, errorCode, errorMessage, requestData, responseData) {
        try {
            const error = await prisma.apiError.create({
                data: {
                    userId,
                    endpoint,
                    errorCode,
                    errorMessage,
                    requestData: requestData ? requestData : client_1.Prisma.JsonNull,
                    responseData: responseData ? responseData : client_1.Prisma.JsonNull
                }
            });
            return error;
        }
        catch (error) {
            logger_1.logger.error('Error logging API error:', error);
            throw error;
        }
    }
    async getApiUsageStats(userId, startDate, endDate) {
        try {
            const stats = await prisma.apiUsage.findMany({
                where: {
                    userId,
                    date: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                orderBy: [
                    { date: 'asc' },
                    { hour: 'asc' }
                ]
            });
            return stats.map(stat => ({
                ...stat,
                method: stat.method
            }));
        }
        catch (error) {
            logger_1.logger.error('Error fetching API usage stats:', error);
            throw error;
        }
    }
    async getErrorStats(userId, startDate, endDate) {
        try {
            const errors = await prisma.apiError.findMany({
                where: {
                    userId,
                    timestamp: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                orderBy: {
                    timestamp: 'desc'
                }
            });
            return errors;
        }
        catch (error) {
            logger_1.logger.error('Error fetching API error stats:', error);
            throw error;
        }
    }
    getNextResetTime() {
        const resetTime = new Date();
        resetTime.setHours(0, 0, 0, 0);
        resetTime.setDate(resetTime.getDate() + 1);
        return resetTime;
    }
}
exports.ApiMonitorService = ApiMonitorService;
//# sourceMappingURL=api-monitor.service.js.map