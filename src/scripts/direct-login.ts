import { ZerodhaAuth } from '../auth/zerodha-auth';
import { logger } from '../logger/logger';

/**
 * Direct login using hardcoded credentials
 */
async function directLogin() {
    try {
        console.log('🔐 Starting Direct Zerodha Login...');

        // Use hardcoded credentials
        const apiKey = '4kii2cglymgxjpqq';
        const apiSecret = 'fmapqarltxl0lhyetqeasfgjias6ov3h';
        const redirectUrl = 'http://localhost:3000/callback';

        console.log(`📋 Using API Key: ${apiKey}`);
        console.log(`🔑 Using API Secret: ${apiSecret.substring(0, 8)}...`);

        // Initialize auth with direct credentials
        const auth = new ZerodhaAuth(apiKey, apiSecret, redirectUrl);

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

        console.log('\n🎉 Direct login completed successfully!');
        console.log('✅ You are now logged in and ready to trade!');

    } catch (error) {
        logger.error('Direct login failed:', error);
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    }
}

// Run the direct login
if (require.main === module) {
    directLogin();
}

export { directLogin }; 