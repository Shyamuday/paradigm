import { PrismaClient } from '@prisma/client';
export declare class DatabaseManager {
    private static instance;
    private prisma;
    private constructor();
    static getInstance(): DatabaseManager;
    getClient(): PrismaClient;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    healthCheck(): Promise<boolean>;
}
export declare const db: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
//# sourceMappingURL=database.d.ts.map