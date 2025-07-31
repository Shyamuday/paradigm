#!/usr/bin/env ts-node

import { ZerodhaAuth } from '../src/auth/zerodha-auth';

async function simpleAuth() {
    try {
        console.log('🔐 Simple Authentication with New Credentials...\n');

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

        console.log('\n🎉 Authentication successful!');

    } catch (error) {
        console.error('❌ Authentication failed:', error instanceof Error ? error.message : 'Unknown error');
    }
}

// Run the script
if (require.main === module) {
    simpleAuth();
} 