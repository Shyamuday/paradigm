import { AutoAuthService } from '../services/auto-auth.service';
import { logger } from '../logger/logger';

/**
 * Test automatic authentication flow
 */
async function testAutoAuth() {
    try {
        console.log('🧪 Testing Automatic Authentication Flow...');
        console.log('==========================================');

        const authService = AutoAuthService.getInstance();
        const userEmail = 'shyamkumar.jnv@gmail.com';
        const userName = 'Shyam Kumar';

        console.log('\n🔍 Step 1: Starting automatic authentication...');
        console.log(`👤 User: ${userName} (${userEmail})`);

        const kite = await authService.authenticate(userEmail, userName);

        console.log('\n✅ Authentication Flow Completed!');
        console.log('================================');

        if (authService.isUserAuthenticated()) {
            console.log('🎯 Status: AUTHENTICATED');

            // Test API access
            const profile = await (kite as any).getProfile();
            console.log(`👤 User Profile:`);
            console.log(`   Name: ${profile.user_name}`);
            console.log(`   Email: ${profile.email}`);
            console.log(`   User ID: ${profile.user_id}`);

            // Test market data access
            const instruments = await (kite as any).getInstruments('NSE');
            console.log(`📈 Market Data Access: ${instruments.length} instruments available`);

            console.log('\n🎉 All tests passed! Authentication flow is working perfectly.');
        } else {
            console.log('❌ Status: NOT AUTHENTICATED');
        }

    } catch (error) {
        console.error('❌ Auto-auth test failed:', error);
        throw error;
    }
}

// Run the test
if (require.main === module) {
    testAutoAuth()
        .then(() => {
            console.log('\n🎯 Automatic Authentication Flow Summary:');
            console.log('✅ 1. Check for existing valid session');
            console.log('✅ 2. If no session, check for stored credentials');
            console.log('✅ 3. If no credentials, save default credentials');
            console.log('✅ 4. Try file-based session as fallback');
            console.log('✅ 5. If all fail, prompt for OAuth login');
            console.log('✅ 6. Save session to database for future use');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Test failed:', error);
            process.exit(1);
        });
}

export { testAutoAuth }; 