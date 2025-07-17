import { ZerodhaAuth } from '../auth/zerodha-auth';
import { logger } from '../logger/logger';

/**
 * Simple authentication example using the cleaned-up ZerodhaAuth class
 */
async function authExample() {
    try {
        console.log('🔐 Starting Zerodha Authentication Example');

        // Initialize auth with environment variables
        const auth = new ZerodhaAuth();

        // Check if we have a valid session
        const hasValidSession = await auth.hasValidSession();

        if (hasValidSession) {
            console.log('✅ Using existing valid session');
        } else {
            console.log('🔄 No valid session found, starting OAuth login...');

            // Start OAuth login flow
            await auth.startOAuthLogin();

            console.log('✅ Authentication completed successfully');
        }

        // Get KiteConnect instance
        const kite = auth.getKite();

        // Test API access
        const profile = await kite.getProfile();
        console.log('\n📊 User Profile:');
        console.log(`   Name: ${profile.user_name}`);
        console.log(`   Email: ${profile.email}`);
        console.log(`   User ID: ${profile.user_id}`);

        // Test market data access
        const instruments = await kite.getInstruments('NSE');
        console.log(`\n📈 Available Instruments: ${instruments.length}`);

        // Show some sample instruments
        const sampleInstruments = instruments.slice(0, 5);
        console.log('\n🔍 Sample Instruments:');
        sampleInstruments.forEach((instrument, index) => {
            console.log(`   ${index + 1}. ${instrument.tradingsymbol} (${instrument.name})`);
        });

        console.log('\n🎉 Authentication example completed successfully!');

    } catch (error) {
        logger.error('Authentication example failed:', error);
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    }
}

// Run the example
if (require.main === module) {
    authExample();
}

export { authExample }; 