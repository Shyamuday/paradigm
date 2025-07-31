#!/usr/bin/env ts-node

import { ZerodhaAuth } from '../src/auth/zerodha-auth';

async function authenticate() {
    try {
        console.log('🔐 Starting Zerodha Authentication with New Credentials...\n');

        // Initialize auth with new credentials
        const auth = new ZerodhaAuth(
            '1urf6ofjq7ahd52t',  // New API Key
            '13kjztc6zx9zjx5ch2cxl6v77lz5uprm',  // New API Secret
            'http://localhost:3000/callback'  // New redirect URL
        );

        console.log('📋 Using New API Key: 1urf6ofjq7ahd52t');
        console.log('🔑 Using New API Secret: 13kjztc6zx9zjx5ch2cxl6v77lz5uprm');
        console.log('🌐 Using Redirect URL: http://localhost:3000/callback\n');

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

        console.log('\n🎉 Authentication completed successfully!');
        console.log('💾 Session has been saved to data/zerodha-session.json');
        console.log('🚀 You can now run the Nifty 50 download script');

    } catch (error) {
        console.error('❌ Authentication failed:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
}

// Run the authentication
if (require.main === module) {
    authenticate();
} 