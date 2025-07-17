import { execSync } from 'child_process';
import { config } from 'dotenv';
import { dbManager, initializeDatabase } from './database';
import { logger } from '../logger/logger';

// Load environment variables
config();

export class DatabaseSetup {
    static async setupDatabase(): Promise<void> {
        try {
            logger.info('🔄 Starting database setup...');

            // Check if DATABASE_URL is set
            if (!process.env.DATABASE_URL) {
                logger.error('❌ DATABASE_URL environment variable is not set');
                throw new Error('DATABASE_URL is required');
            }

            logger.info('📋 DATABASE_URL found:', process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@'));

            // Generate Prisma Client
            logger.info('🔄 Generating Prisma Client...');
            execSync('npx prisma generate', { stdio: 'inherit' });
            logger.info('✅ Prisma Client generated');

            // Run database migrations
            logger.info('🔄 Running database migrations...');
            execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });
            logger.info('✅ Database migrations completed');

            // Initialize database connection
            logger.info('🔄 Initializing database connection...');
            await initializeDatabase();
            logger.info('✅ Database connection initialized');

            // Run health check
            const isHealthy = await dbManager.healthCheck();
            if (!isHealthy) {
                throw new Error('Database health check failed');
            }
            logger.info('✅ Database health check passed');

            logger.info('🎉 Database setup completed successfully!');
        } catch (error) {
            logger.error('❌ Database setup failed:', error);
            throw error;
        }
    }

    static async resetDatabase(): Promise<void> {
        try {
            logger.info('🔄 Resetting database...');

            // Reset database
            execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
            logger.info('✅ Database reset completed');

            // Re-run setup
            await this.setupDatabase();
        } catch (error) {
            logger.error('❌ Database reset failed:', error);
            throw error;
        }
    }

    static async seedDatabase(): Promise<void> {
        try {
            logger.info('🔄 Seeding database...');

            // Run seed script if it exists
            try {
                execSync('npx prisma db seed', { stdio: 'inherit' });
                logger.info('✅ Database seeding completed');
            } catch (error) {
                logger.info('ℹ️  No seed script found, skipping seeding');
            }
        } catch (error) {
            logger.error('❌ Database seeding failed:', error);
            throw error;
        }
    }

    static async checkDatabaseConnection(): Promise<boolean> {
        try {
            await initializeDatabase();
            return await dbManager.healthCheck();
        } catch (error) {
            logger.error('❌ Database connection check failed:', error);
            return false;
        }
    }
}

// CLI interface
if (require.main === module) {
    const command = process.argv[2];

    switch (command) {
        case 'setup':
            DatabaseSetup.setupDatabase()
                .then(() => process.exit(0))
                .catch(() => process.exit(1));
            break;
        case 'reset':
            DatabaseSetup.resetDatabase()
                .then(() => process.exit(0))
                .catch(() => process.exit(1));
            break;
        case 'seed':
            DatabaseSetup.seedDatabase()
                .then(() => process.exit(0))
                .catch(() => process.exit(1));
            break;
        case 'check':
            DatabaseSetup.checkDatabaseConnection()
                .then((isConnected) => {
                    if (isConnected) {
                        logger.info('✅ Database connection is healthy');
                        process.exit(0);
                    } else {
                        logger.error('❌ Database connection failed');
                        process.exit(1);
                    }
                });
            break;
        default:
            console.log(`
Usage: ts-node src/database/setup.ts <command>

Commands:
  setup   - Set up database with migrations and generate Prisma client
  reset   - Reset database and re-run setup
  seed    - Seed database with initial data
  check   - Check database connection health

Examples:
  npm run db:setup
  npm run db:reset
  npm run db:seed
  npm run db:check
            `);
            process.exit(1);
    }
} 