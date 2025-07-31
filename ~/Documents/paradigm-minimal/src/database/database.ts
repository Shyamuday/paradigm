import { PrismaClient } from '@prisma/client';

// Global Prisma instance
export const db = new PrismaClient();

// Database connection functions
export async function connectDatabase(): Promise<void> {
    try {
        await db.$connect();
        console.log('✅ Database connected successfully');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        throw error;
    }
}

export async function disconnectDatabase(): Promise<void> {
    try {
        await db.$disconnect();
        console.log('✅ Database disconnected successfully');
    } catch (error) {
        console.error('❌ Database disconnection failed:', error);
    }
} 