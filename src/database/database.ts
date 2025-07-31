import { PrismaClient } from '@prisma/client';

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
    }
} 