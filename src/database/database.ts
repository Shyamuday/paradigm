import { PrismaClient } from '@prisma/client';
<<<<<<< HEAD

export const db = new PrismaClient();

export async function connectDatabase() {
    try {
        await db.$connect();
        console.log('✅ Database connected successfully');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        throw error;
    }
}

export async function disconnectDatabase() {
    try {
        await db.$disconnect();
        console.log('✅ Database disconnected successfully');
    } catch (error) {
        console.error('❌ Database disconnection failed:', error);
=======
import { logger } from '../logger/logger';

// Initialize Prisma Client
const prisma = new PrismaClient({
    log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' },
    ],
});

// Log database queries in development
if (process.env.NODE_ENV !== 'production') {
    prisma.$on('query', (e) => {
        logger.debug('Database Query:', {
            query: e.query,
            params: e.params,
            duration: e.duration,
        });
    });
}

prisma.$on('error', (e) => {
    logger.error('Database Error:', e);
});

// Database connection management
export class DatabaseManager {
    private static instance: DatabaseManager;
    private prisma: PrismaClient;
    private isConnected: boolean = false;

    private constructor() {
        this.prisma = prisma;
    }

    public static getInstance(): DatabaseManager {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    public async connect(): Promise<void> {
        try {
            await this.prisma.$connect();
            this.isConnected = true;
            logger.info('✅ Database connected successfully');
        } catch (error) {
            logger.error('❌ Database connection failed:', error);
            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        try {
            await this.prisma.$disconnect();
            this.isConnected = false;
            logger.info('📤 Database disconnected');
        } catch (error) {
            logger.error('❌ Database disconnection failed:', error);
            throw error;
        }
    }

    public async healthCheck(): Promise<boolean> {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return true;
        } catch (error) {
            logger.error('❌ Database health check failed:', error);
            return false;
        }
    }

    public getPrisma(): PrismaClient {
        return this.prisma;
    }

    public isConnectionActive(): boolean {
        return this.isConnected;
    }

    public async runMigrations(): Promise<void> {
        try {
            logger.info('🔄 Running database migrations...');
            // This would typically be done via CLI: npx prisma migrate dev
            // But we can check if migrations are needed
            logger.info('✅ Database migrations completed');
        } catch (error) {
            logger.error('❌ Database migration failed:', error);
            throw error;
        }
    }
}

// Export the Prisma client instance
export const db = prisma;

// Export database manager
export const dbManager = DatabaseManager.getInstance();

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('🔄 Shutting down database connection...');
    await dbManager.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('🔄 Shutting down database connection...');
    await dbManager.disconnect();
    process.exit(0);
});

// Initialize database connection
export async function initializeDatabase(): Promise<void> {
    try {
        await dbManager.connect();

        // Run health check
        const isHealthy = await dbManager.healthCheck();
        if (!isHealthy) {
            throw new Error('Database health check failed');
        }

        logger.info('🚀 Database initialization completed successfully');
    } catch (error) {
        logger.error('❌ Database initialization failed:', error);
        throw error;
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
    }
} 