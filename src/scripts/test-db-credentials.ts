import { PrismaClient } from '@prisma/client';

/**
 * Test database credentials storage
 */
async function testDbCredentials() {
    try {
        console.log('🔍 Testing Database Credentials Storage...');

        const prisma = new PrismaClient();

        // Test database connection
        console.log('📊 Testing database connection...');
        await prisma.$connect();
        console.log('✅ Database connected successfully');

        // Check if tables exist
        console.log('\n📋 Checking database tables...');

        try {
            const users = await prisma.user.findMany({ take: 1 });
            console.log('✅ Users table exists');
        } catch (error) {
            console.log('❌ Users table not found');
        }

        try {
            // Try to access the new tables (this will fail if they don't exist)
            const apiCredentials = await (prisma as any).apiCredential.findMany({ take: 1 });
            console.log('✅ API Credentials table exists');
        } catch (error) {
            console.log('❌ API Credentials table not found - migration may be needed');
        }

        try {
            const authSessions = await (prisma as any).authSession.findMany({ take: 1 });
            console.log('✅ Auth Sessions table exists');
        } catch (error) {
            console.log('❌ Auth Sessions table not found - migration may be needed');
        }

        // Show current session file for comparison
        console.log('\n📁 Current Session Storage:');
        const fs = require('fs');
        const path = require('path');
        const sessionFile = path.join(process.cwd(), 'data', 'zerodha-session.json');

        if (fs.existsSync(sessionFile)) {
            const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
            console.log('📄 File-based session found:');
            console.log(`   User: ${sessionData.user_name}`);
            console.log(`   Email: ${sessionData.email}`);
            console.log(`   Expires: ${sessionData.expires_at}`);
        } else {
            console.log('❌ No file-based session found');
        }

        console.log('\n🎯 Database Storage Benefits:');
        console.log('✅ Centralized credential management');
        console.log('✅ Multi-user support');
        console.log('✅ Session history tracking');
        console.log('✅ Automatic cleanup of expired sessions');
        console.log('✅ Better security (no hardcoded credentials)');
        console.log('✅ Scalable architecture');

        console.log('\n📋 Next Steps:');
        console.log('1. Run database migration: npx prisma migrate dev');
        console.log('2. Use database login: npm run trading:auth:db');
        console.log('3. Credentials will be stored securely in database');

        await prisma.$disconnect();

    } catch (error) {
        console.error('❌ Database test failed:', error);
    }
}

// Run the test
if (require.main === module) {
    testDbCredentials()
        .then(() => {
            console.log('\n🎉 Database credentials test completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Test failed:', error);
            process.exit(1);
        });
}

export { testDbCredentials }; 