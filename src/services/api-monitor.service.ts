import { PrismaClient, Prisma } from '@prisma/client';
import { ApiUsage, ApiQuota, ApiError } from '../types';
import { logger } from '../logger/logger';

const prisma = new PrismaClient();

export class ApiMonitorService {
    // API Usage Tracking
    async trackApiCall(userId: string, endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', responseTime: number, isError: boolean = false): Promise<void> {
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
        } catch (error) {
            logger.error('Error tracking API call:', error);
            throw error;
        }
    }

    // API Quota Management
    async checkQuota(userId: string, endpoint: string): Promise<boolean> {
        try {
            const quota = await prisma.apiQuota.findUnique({
                where: {
                    userId_endpoint: {
                        userId,
                        endpoint
                    }
                }
            });

            if (!quota) return true; // No quota set

            // Reset quota if reset time has passed
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
        } catch (error) {
            logger.error('Error checking API quota:', error);
            throw error;
        }
    }

    async incrementQuotaUsage(userId: string, endpoint: string): Promise<void> {
        try {
            const quota = await prisma.apiQuota.findUnique({
                where: {
                    userId_endpoint: {
                        userId,
                        endpoint
                    }
                }
            });

            if (!quota) return; // No quota to update

            const isExceeded = quota.currentUsage + 1 >= quota.dailyLimit;

            await prisma.apiQuota.update({
                where: { id: quota.id },
                data: {
                    currentUsage: { increment: 1 },
                    isExceeded
                }
            });
        } catch (error) {
            logger.error('Error incrementing API quota usage:', error);
            throw error;
        }
    }

    async setQuota(userId: string, endpoint: string, dailyLimit: number): Promise<ApiQuota> {
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

            return quota as ApiQuota;
        } catch (error) {
            logger.error('Error setting API quota:', error);
            throw error;
        }
    }

    // Error Tracking
    async logApiError(userId: string, endpoint: string, errorCode: string, errorMessage: string, requestData?: any, responseData?: any): Promise<ApiError> {
        try {
            const error = await prisma.apiError.create({
                data: {
                    userId,
                    endpoint,
                    errorCode,
                    errorMessage,
                    requestData: requestData ? (requestData as Prisma.InputJsonValue) : Prisma.JsonNull,
                    responseData: responseData ? (responseData as Prisma.InputJsonValue) : Prisma.JsonNull
                }
            });

            return error as ApiError;
        } catch (error) {
            logger.error('Error logging API error:', error);
            throw error;
        }
    }

    // Usage Analytics
    async getApiUsageStats(userId: string, startDate: Date, endDate: Date): Promise<ApiUsage[]> {
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
                method: stat.method as 'GET' | 'POST' | 'PUT' | 'DELETE'
            })) as ApiUsage[];
        } catch (error) {
            logger.error('Error fetching API usage stats:', error);
            throw error;
        }
    }

    async getErrorStats(userId: string, startDate: Date, endDate: Date): Promise<ApiError[]> {
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

            return errors as ApiError[];
        } catch (error) {
            logger.error('Error fetching API error stats:', error);
            throw error;
        }
    }

    // Helper Methods
    private getNextResetTime(): Date {
        const resetTime = new Date();
        resetTime.setHours(0, 0, 0, 0);
        resetTime.setDate(resetTime.getDate() + 1);
        return resetTime;
    }
} 