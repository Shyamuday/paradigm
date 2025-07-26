#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { DatabaseManager } from '../src/database/database';
import { logger } from '../src/logger/logger';
import { PrismaClient } from '@prisma/client';

// Load environment variables
config();

interface DatabaseStats {
    totalTables: number;
    totalRecords: number;
    tableStats: Array<{
        tableName: string;
        recordCount: number;
        size: string;
    }>;
    connectionStatus: boolean;
    lastBackup?: string;
}

interface DatabaseHealth {
    isHealthy: boolean;
    connectionActive: boolean;
    responseTime: number;
    errors: string[];
    warnings: string[];
}

class DatabaseManagerCLI {
    private dbManager: DatabaseManager;
    private prisma: PrismaClient;

    constructor() {
        this.dbManager = DatabaseManager.getInstance();
        this.prisma = this.dbManager.getPrisma();
    }

    /**
     * Initialize database connection
     */
    async initialize(): Promise<void> {
        try {
            console.log('🔌 Initializing database connection...');
            await this.dbManager.connect();

            const isHealthy = await this.dbManager.healthCheck();
            if (isHealthy) {
                console.log('✅ Database connection established successfully');
            } else {
                console.log('⚠️  Database health check failed');
            }
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }

    /**
     * Get comprehensive database statistics
     */
    async getDatabaseStats(): Promise<DatabaseStats> {
        try {
            console.log('📊 Collecting database statistics...');

            const tables = [
                'users', 'trading_sessions', 'instruments', 'options_chains',
                'options_contracts', 'options_greeks', 'options_positions',
                'market_data', 'candle_data', 'tick_data', 'strategies',
                'trades', 'positions', 'risk_profiles', 'risk_metrics',
                'alerts', 'backtest_results', 'system_logs'
            ];

            const tableStats: Array<{
                tableName: string;
                recordCount: number;
                size: string;
            }> = [];
            let totalRecords = 0;

            for (const table of tables) {
                try {
                    const count = await this.prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${table}"`);
                    const size = await this.prisma.$queryRawUnsafe(`
            SELECT pg_size_pretty(pg_total_relation_size('"${table}"')) as size
          `);

                    const recordCount = (count as any)[0]?.count || 0;
                    const tableSize = (size as any)[0]?.size || '0 bytes';

                    tableStats.push({
                        tableName: table,
                        recordCount: parseInt(recordCount),
                        size: tableSize
                    });

                    totalRecords += parseInt(recordCount);
                } catch (error) {
                    console.warn(`⚠️  Could not get stats for table ${table}:`, error);
                }
            }

            const connectionStatus = this.dbManager.isConnectionActive();

            return {
                totalTables: tables.length,
                totalRecords,
                tableStats,
                connectionStatus
            };

        } catch (error) {
            console.error('❌ Error getting database stats:', error);
            throw error;
        }
    }

    /**
     * Check database health
     */
    async checkHealth(): Promise<DatabaseHealth> {
        try {
            console.log('🏥 Checking database health...');

            const startTime = Date.now();
            const isHealthy = await this.dbManager.healthCheck();
            const responseTime = Date.now() - startTime;

            const connectionActive = this.dbManager.isConnectionActive();
            const errors: string[] = [];
            const warnings: string[] = [];

            if (!isHealthy) {
                errors.push('Database health check failed');
            }

            if (!connectionActive) {
                errors.push('Database connection is not active');
            }

            if (responseTime > 1000) {
                warnings.push(`Slow response time: ${responseTime}ms`);
            }

            return {
                isHealthy: isHealthy && connectionActive,
                connectionActive,
                responseTime,
                errors,
                warnings
            };

        } catch (error) {
            console.error('❌ Error checking database health:', error);
            return {
                isHealthy: false,
                connectionActive: false,
                responseTime: 0,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
                warnings: []
            };
        }
    }

    /**
     * Clean up old data
     */
    async cleanupOldData(daysToKeep: number = 30): Promise<void> {
        try {
            console.log(`🧹 Cleaning up data older than ${daysToKeep} days...`);

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            // Clean up old market data
            const marketDataDeleted = await this.prisma.marketData.deleteMany({
                where: {
                    timestamp: {
                        lt: cutoffDate
                    }
                }
            });

            // Clean up old candle data
            const candleDataDeleted = await this.prisma.candleData.deleteMany({
                where: {
                    timestamp: {
                        lt: cutoffDate
                    }
                }
            });

            // Clean up old tick data
            const tickDataDeleted = await this.prisma.tickData.deleteMany({
                where: {
                    timestamp: {
                        lt: cutoffDate
                    }
                }
            });

            // Clean up old system logs
            const systemLogsDeleted = await this.prisma.systemLog.deleteMany({
                where: {
                    timestamp: {
                        lt: cutoffDate
                    }
                }
            });

            console.log('✅ Cleanup completed:');
            console.log(`   Market Data: ${marketDataDeleted.count} records deleted`);
            console.log(`   Candle Data: ${candleDataDeleted.count} records deleted`);
            console.log(`   Tick Data: ${tickDataDeleted.count} records deleted`);
            console.log(`   System Logs: ${systemLogsDeleted.count} records deleted`);

        } catch (error) {
            console.error('❌ Error during cleanup:', error);
            throw error;
        }
    }

    /**
     * Reset database (DANGEROUS - removes all data)
     */
    async resetDatabase(): Promise<void> {
        try {
            console.log('⚠️  WARNING: This will delete ALL data from the database!');
            console.log('Are you sure you want to continue? (yes/no)');

            // In a real CLI, you'd read user input here
            // For now, we'll just log the warning
            console.log('❌ Database reset cancelled for safety');

            // Uncomment the following lines to actually reset the database:
            /*
            console.log('🗑️  Resetting database...');
            await this.prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE');
            await this.prisma.$executeRawUnsafe('CREATE SCHEMA public');
            console.log('✅ Database reset completed');
            */

        } catch (error) {
            console.error('❌ Error resetting database:', error);
            throw error;
        }
    }

    /**
     * Create sample data for testing
     */
    async createSampleData(): Promise<void> {
        try {
            console.log('📝 Creating sample data...');

            // Create sample user
            const user = await this.prisma.user.create({
                data: {
                    email: 'trader@example.com',
                    name: 'Sample Trader'
                }
            });

            // Create sample instruments
            const instruments = await Promise.all([
                this.prisma.instrument.create({
                    data: {
                        symbol: 'NIFTY',
                        name: 'NIFTY 50',
                        exchange: 'NSE',
                        instrumentType: 'INDEX',
                        lotSize: 50,
                        tickSize: 0.05
                    }
                }),
                this.prisma.instrument.create({
                    data: {
                        symbol: 'BANKNIFTY',
                        name: 'NIFTY BANK',
                        exchange: 'NSE',
                        instrumentType: 'INDEX',
                        lotSize: 25,
                        tickSize: 0.05
                    }
                }),
                this.prisma.instrument.create({
                    data: {
                        symbol: 'RELIANCE',
                        name: 'Reliance Industries',
                        exchange: 'NSE',
                        instrumentType: 'EQUITY',
                        lotSize: 1,
                        tickSize: 0.05
                    }
                })
            ]);

            // Create sample trading session
            const session = await this.prisma.tradingSession.create({
                data: {
                    userId: user.id,
                    mode: 'PAPER',
                    capital: 100000,
                    status: 'ACTIVE'
                }
            });

            // Create sample strategy
            const strategy = await this.prisma.strategy.create({
                data: {
                    name: 'Moving Average Crossover',
                    description: 'Simple moving average crossover strategy',
                    config: {
                        shortPeriod: 10,
                        longPeriod: 20,
                        stopLoss: 2,
                        takeProfit: 5
                    }
                }
            });

            console.log('✅ Sample data created:');
            console.log(`   User: ${user.email}`);
            console.log(`   Instruments: ${instruments.length}`);
            console.log(`   Trading Session: ${session.id}`);
            console.log(`   Strategy: ${strategy.name}`);

        } catch (error) {
            console.error('❌ Error creating sample data:', error);
            throw error;
        }
    }

    /**
     * Display database statistics
     */
    async displayStats(): Promise<void> {
        try {
            const stats = await this.getDatabaseStats();

            console.log('\n📊 DATABASE STATISTICS');
            console.log('='.repeat(50));
            console.log(`Total Tables: ${stats.totalTables}`);
            console.log(`Total Records: ${stats.totalRecords.toLocaleString()}`);
            console.log(`Connection Status: ${stats.connectionStatus ? '🟢 Active' : '🔴 Inactive'}`);

            console.log('\n📋 TABLE DETAILS:');
            console.log('-'.repeat(50));

            for (const table of stats.tableStats) {
                const status = table.recordCount > 0 ? '🟢' : '⚪';
                console.log(`${status} ${table.tableName.padEnd(20)} | ${table.recordCount.toString().padStart(8)} records | ${table.size}`);
            }

        } catch (error) {
            console.error('❌ Error displaying stats:', error);
        }
    }

    /**
     * Display health check results
     */
    async displayHealth(): Promise<void> {
        try {
            const health = await this.checkHealth();

            console.log('\n🏥 DATABASE HEALTH CHECK');
            console.log('='.repeat(50));
            console.log(`Overall Status: ${health.isHealthy ? '🟢 Healthy' : '🔴 Unhealthy'}`);
            console.log(`Connection: ${health.connectionActive ? '🟢 Active' : '🔴 Inactive'}`);
            console.log(`Response Time: ${health.responseTime}ms`);

            if (health.errors.length > 0) {
                console.log('\n❌ ERRORS:');
                health.errors.forEach(error => console.log(`   - ${error}`));
            }

            if (health.warnings.length > 0) {
                console.log('\n⚠️  WARNINGS:');
                health.warnings.forEach(warning => console.log(`   - ${warning}`));
            }

        } catch (error) {
            console.error('❌ Error displaying health:', error);
        }
    }

    /**
     * Run database optimization
     */
    async optimizeDatabase(): Promise<void> {
        try {
            console.log('⚡ Optimizing database...');

            // Analyze tables
            await this.prisma.$executeRawUnsafe('ANALYZE');
            console.log('✅ Table analysis completed');

            // Vacuum database
            await this.prisma.$executeRawUnsafe('VACUUM');
            console.log('✅ Database vacuum completed');

            // Reindex database
            await this.prisma.$executeRawUnsafe('REINDEX DATABASE paradigm_db');
            console.log('✅ Database reindex completed');

            console.log('✅ Database optimization completed');

        } catch (error) {
            console.error('❌ Error optimizing database:', error);
            throw error;
        }
    }

    /**
     * Close database connection
     */
    async close(): Promise<void> {
        try {
            await this.dbManager.disconnect();
            console.log('📤 Database connection closed');
        } catch (error) {
            console.error('❌ Error closing database connection:', error);
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    const dbManager = new DatabaseManagerCLI();

    try {
        await dbManager.initialize();

        switch (command) {
            case 'stats':
                await dbManager.displayStats();
                break;

            case 'health':
                await dbManager.displayHealth();
                break;

            case 'cleanup':
                const days = parseInt(args[1] || '30') || 30;
                await dbManager.cleanupOldData(days);
                break;

            case 'reset':
                await dbManager.resetDatabase();
                break;

            case 'sample':
                await dbManager.createSampleData();
                break;

            case 'optimize':
                await dbManager.optimizeDatabase();
                break;

            default:
                console.log('\n🗄️  DATABASE MANAGER - Available Commands');
                console.log('='.repeat(50));
                console.log('stats     - Display database statistics');
                console.log('health    - Check database health');
                console.log('cleanup   - Clean up old data (default: 30 days)');
                console.log('reset     - Reset database (DANGEROUS)');
                console.log('sample    - Create sample data for testing');
                console.log('optimize  - Optimize database performance');
                console.log('\nExamples:');
                console.log('  npm run db:stats');
                console.log('  npm run db:health');
                console.log('  npm run db:cleanup 60');
                console.log('  npm run db:sample');
        }

    } catch (error) {
        console.error('❌ Database operation failed:', error);
        process.exit(1);
    } finally {
        await dbManager.close();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

export { DatabaseManagerCLI }; 