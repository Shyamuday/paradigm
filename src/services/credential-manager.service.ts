import { PrismaClient } from '@prisma/client';
import { logger } from '../logger/logger';

export class CredentialManagerService {
    private static instance: CredentialManagerService;
    private prisma: PrismaClient;

    private constructor() {
        this.prisma = new PrismaClient();
    }

    public static getInstance(): CredentialManagerService {
        if (!CredentialManagerService.instance) {
            CredentialManagerService.instance = new CredentialManagerService();
        }
        return CredentialManagerService.instance;
    }

    /**
     * Save API credentials to database
     */
    async saveApiCredentials(userId: string, provider: string, apiKey: string, apiSecret: string, redirectUrl?: string): Promise<void> {
        try {
            await this.prisma.apiCredential.upsert({
                where: {
                    userId_provider: {
                        userId,
                        provider
                    }
                },
                update: {
                    apiKey,
                    apiSecret,
                    redirectUrl,
                    isActive: true,
                    updatedAt: new Date()
                },
                create: {
                    userId,
                    provider,
                    apiKey,
                    apiSecret,
                    redirectUrl,
                    isActive: true
                }
            });

            logger.info(`API credentials saved for user ${userId} and provider ${provider}`);
        } catch (error) {
            logger.error('Failed to save API credentials:', error);
            throw error;
        }
    }

    /**
     * Get API credentials from database
     */
    async getApiCredentials(userId: string, provider: string): Promise<{ apiKey: string; apiSecret: string; redirectUrl?: string } | null> {
        try {
            const credentials = await this.prisma.apiCredential.findUnique({
                where: {
                    userId_provider: {
                        userId,
                        provider
                    }
                }
            });

            if (!credentials || !credentials.isActive) {
                return null;
            }

            return {
                apiKey: credentials.apiKey,
                apiSecret: credentials.apiSecret,
                redirectUrl: credentials.redirectUrl || undefined
            };
        } catch (error) {
            logger.error('Failed to get API credentials:', error);
            throw error;
        }
    }

    /**
     * Save authentication session to database
     */
    async saveAuthSession(
        userId: string,
        provider: string,
        sessionData: {
            accessToken: string;
            refreshToken?: string | undefined;
            userType?: string | undefined;
            userName?: string | undefined;
            userShortname?: string | undefined;
            email?: string | undefined;
            mobile?: string | undefined;
            broker?: string | undefined;
            exchanges?: string[] | undefined;
            products?: string[] | undefined;
            orderTypes?: string[] | undefined;
            loginTime: Date;
            expiresAt: Date;
        }
    ): Promise<void> {
        try {
            // Deactivate existing sessions for this user and provider
            await this.prisma.authSession.updateMany({
                where: {
                    userId,
                    provider,
                    isActive: true
                },
                data: {
                    isActive: false,
                    updatedAt: new Date()
                }
            });

            // Create new session
            await this.prisma.authSession.create({
                data: {
                    userId,
                    provider,
                    accessToken: sessionData.accessToken,
                    refreshToken: sessionData.refreshToken,
                    userType: sessionData.userType,
                    userName: sessionData.userName,
                    userShortname: sessionData.userShortname,
                    email: sessionData.email,
                    mobile: sessionData.mobile,
                    broker: sessionData.broker,
                    exchanges: sessionData.exchanges || [],
                    products: sessionData.products || [],
                    orderTypes: sessionData.orderTypes || [],
                    loginTime: sessionData.loginTime,
                    expiresAt: sessionData.expiresAt,
                    isActive: true
                }
            });

            logger.info(`Auth session saved for user ${userId} and provider ${provider}`);
        } catch (error) {
            logger.error('Failed to save auth session:', error);
            throw error;
        }
    }

    /**
     * Get active authentication session from database
     */
    async getActiveAuthSession(userId: string, provider: string): Promise<{
        accessToken: string;
        refreshToken?: string;
        userName?: string;
        email?: string;
        expiresAt: Date;
    } | null> {
        try {
            const session = await this.prisma.authSession.findFirst({
                where: {
                    userId,
                    provider,
                    isActive: true,
                    expiresAt: {
                        gt: new Date()
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            if (!session) {
                return null;
            }

            return {
                accessToken: session.accessToken,
                refreshToken: session.refreshToken || undefined,
                userName: session.userName || undefined,
                email: session.email || undefined,
                expiresAt: session.expiresAt
            };
        } catch (error) {
            logger.error('Failed to get auth session:', error);
            throw error;
        }
    }

    /**
     * Deactivate all sessions for a user and provider
     */
    async deactivateSessions(userId: string, provider: string): Promise<void> {
        try {
            await this.prisma.authSession.updateMany({
                where: {
                    userId,
                    provider,
                    isActive: true
                },
                data: {
                    isActive: false,
                    updatedAt: new Date()
                }
            });

            logger.info(`All sessions deactivated for user ${userId} and provider ${provider}`);
        } catch (error) {
            logger.error('Failed to deactivate sessions:', error);
            throw error;
        }
    }

    /**
     * Clean up expired sessions
     */
    async cleanupExpiredSessions(): Promise<number> {
        try {
            const result = await this.prisma.authSession.updateMany({
                where: {
                    expiresAt: {
                        lt: new Date()
                    },
                    isActive: true
                },
                data: {
                    isActive: false,
                    updatedAt: new Date()
                }
            });

            logger.info(`Cleaned up ${result.count} expired sessions`);
            return result.count;
        } catch (error) {
            logger.error('Failed to cleanup expired sessions:', error);
            throw error;
        }
    }

    /**
     * Get user by email or create if not exists
     */
    async getOrCreateUser(email: string, name?: string): Promise<string> {
        try {
            const user = await this.prisma.user.upsert({
                where: { email },
                update: {},
                create: {
                    email,
                    name: name || email.split('@')[0] || null
                }
            });

            return user.id;
        } catch (error) {
            logger.error('Failed to get or create user:', error);
            throw error;
        }
    }

    /**
     * Close database connection
     */
    async disconnect(): Promise<void> {
        await this.prisma.$disconnect();
    }
} 