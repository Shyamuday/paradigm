import { PrismaClient } from '@prisma/client';
import { logger } from '../logger/logger';

export class DatabaseManager {
    private static instance: DatabaseManager;
    private prisma: PrismaClient;

    private constructor() {
        this.prisma = new PrismaClient({
            log: ['query', 'info', 'warn', 'error'],
        });
    }

    public static getInstance(): DatabaseManager {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    public getClient(): PrismaClient {
        return this.prisma;
    }

    public async connect(): Promise<void> {
        try {
            await this.prisma.$connect();
            logger.info('Database connected successfully');
        } catch (error) {
            logger.error('Failed to connect to database:', error);
            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        try {
            await this.prisma.$disconnect();
            logger.info('Database disconnected successfully');
        } catch (error) {
            logger.error('Failed to disconnect from database:', error);
            throw error;
        }
    }

    public async healthCheck(): Promise<boolean> {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return true;
        } catch (error) {
            logger.error('Database health check failed:', error);
            return false;
        }
    }
}

export const db = DatabaseManager.getInstance().getClient(); 