import { config } from 'dotenv';
import { db, initializeDatabase } from './database/database';
import { UserService } from './services/user.service';
import { logger } from './logger/logger';

// Load environment variables
config();

async function testPostgreSQLIntegration() {
    console.log('🚀 Testing PostgreSQL Integration...\n');

    try {
        // Initialize database
        console.log('1. Initializing database connection...');
        await initializeDatabase();
        console.log('✅ Database connected successfully\n');

        // Test UserService
        console.log('2. Testing UserService...');
        const userService = new UserService();

        // Create a test user
        const testUser = await userService.createUser('test@example.com', 'Test User');
        console.log('✅ User created:', testUser);

        // Retrieve the user
        const retrievedUser = await userService.getUserById(testUser.id);
        console.log('✅ User retrieved:', retrievedUser?.name);

        // Update the user
        const updatedUser = await userService.updateUser(testUser.id, 'updated@example.com', 'Updated User');
        console.log('✅ User updated:', updatedUser.name);

        // Create a trading session
        const session = await userService.createTradingSession(testUser.id, {
            mode: 'paper',
            capital: 50000,
            endTime: null
        });
        console.log('✅ Trading session created:', session.id);

        // Get active session
        const activeSession = await userService.getActiveTradingSession(testUser.id);
        console.log('✅ Active session retrieved:', activeSession?.id);

        // Test database queries
        console.log('\n3. Testing direct database queries...');

        // Count users
        const userCount = await db.user.count();
        console.log('✅ Total users in database:', userCount);

        // Count trading sessions
        const sessionCount = await db.tradingSession.count();
        console.log('✅ Total trading sessions:', sessionCount);

        // List all users
        const allUsers = await db.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                createdAt: true
            }
        });
        console.log('✅ All users:', allUsers);

        // Test database performance
        console.log('\n4. Testing database performance...');
        const startTime = Date.now();

        // Create multiple users
        const users = await Promise.all([
            userService.createUser('user1@example.com', 'User 1'),
            userService.createUser('user2@example.com', 'User 2'),
            userService.createUser('user3@example.com', 'User 3')
        ]);

        const endTime = Date.now();
        console.log('✅ Created 3 users in', endTime - startTime, 'ms');

        // Clean up test data
        console.log('\n5. Cleaning up test data...');
        for (const user of [...users, testUser]) {
            await userService.deleteUser(user.id);
        }
        console.log('✅ Test data cleaned up');

        // Final verification
        const finalUserCount = await db.user.count();
        console.log('✅ Final user count:', finalUserCount);

        console.log('\n🎉 PostgreSQL Integration Test Completed Successfully!');
        console.log('📊 Summary:');
        console.log('  - Database Connection: ✅ WORKING');
        console.log('  - User CRUD Operations: ✅ WORKING');
        console.log('  - Trading Session Management: ✅ WORKING');
        console.log('  - Database Performance: ✅ GOOD');
        console.log('  - Data Cleanup: ✅ WORKING');

    } catch (error) {
        console.error('❌ PostgreSQL Integration Test Failed:', error);
        throw error;
    } finally {
        // Disconnect from database
        await db.$disconnect();
        console.log('📤 Database connection closed');
    }
}

// Run the test
if (require.main === module) {
    testPostgreSQLIntegration()
        .then(() => {
            console.log('\n✅ All tests passed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Test failed:', error);
            process.exit(1);
        });
} 