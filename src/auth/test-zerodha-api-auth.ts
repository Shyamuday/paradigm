import dotenv from 'dotenv';
import { ZerodhaApiAuth, ZerodhaApiAuthConfig } from './zerodha-api-auth';
import { logger } from '../logger/logger';

// Load environment variables
dotenv.config();

async function testZerodhaApiAuth() {
    console.log('🚀 Testing Automated Zerodha API Authentication...\n');

    // Configuration from environment variables with fallback to existing credentials
    const config: ZerodhaApiAuthConfig = {
        apiKey: process.env.ZERODHA_API_KEY || '4kii2cglymgxjpqq',
        apiSecret: process.env.ZERODHA_API_SECRET || 'fmapqarltxl0lhyetqeasfgjias6ov3h',
        userId: process.env.ZERODHA_USER_ID || 'XB7556',
        password: process.env.ZERODHA_PASSWORD || 'Lumia620@',
        totpSecret: process.env.ZERODHA_TOTP_SECRET || '',
        redirectUri: process.env.ZERODHA_REDIRECT_URI || 'https://127.0.0.1'
    };

    console.log('📋 Configuration:');
    console.log('🔑 API Key:', config.apiKey ? '✅ SET' : '❌ MISSING');
    console.log('🔐 API Secret:', config.apiSecret ? '✅ SET' : '❌ MISSING');
    console.log('👤 User ID:', config.userId ? '✅ SET' : '❌ MISSING');
    console.log('🔐 Password:', config.password ? '✅ SET' : '❌ MISSING');
    console.log('🔢 TOTP Secret:', config.totpSecret ? '✅ SET' : '❌ MISSING');
    console.log('🔗 Redirect URI:', config.redirectUri);
    console.log('');

    // Check if all required fields are present
    const missingFields = [];
    if (!config.apiKey) missingFields.push('ZERODHA_API_KEY');
    if (!config.apiSecret) missingFields.push('ZERODHA_API_SECRET');
    if (!config.userId) missingFields.push('ZERODHA_USER_ID');
    if (!config.password) missingFields.push('ZERODHA_PASSWORD');
    if (!config.totpSecret) missingFields.push('ZERODHA_TOTP_SECRET');

    if (missingFields.length > 0) {
        console.log('❌ Missing required environment variables:');
        missingFields.forEach(field => console.log(`   - ${field}`));
        console.log('\n📋 Please set these in your .env file:');
        console.log('   ZERODHA_API_KEY=your_api_key');
        console.log('   ZERODHA_API_SECRET=your_api_secret');
        console.log('   ZERODHA_USER_ID=your_kite_user_id');
        console.log('   ZERODHA_PASSWORD=your_kite_password');
        console.log('   ZERODHA_TOTP_SECRET=your_base32_totp_secret');
        console.log('   ZERODHA_REDIRECT_URI=https://127.0.0.1');
        console.log('\n🔐 How to get your TOTP secret:');
        console.log('   1. Login to Zerodha Kite');
        console.log('   2. Go to Settings > API');
        console.log('   3. When setting up 2FA, scan the QR code with an authenticator app');
        console.log('   4. The secret shown is your TOTP secret (base32 format)');
        return;
    }

    try {
        console.log('⏳ Initializing Zerodha API Auth...\n');

        const auth = new ZerodhaApiAuth(config);

        // Listen for events
        auth.on('session_loaded', (session) => {
            console.log('✅ Session loaded from file:');
            console.log('   User ID:', session.userId);
            console.log('   Login Time:', session.loginTime);
            console.log('   Token Expires:', session.tokenExpiryTime);
            console.log('');
        });

        auth.on('login_success', (session) => {
            console.log('🎉 Login successful!');
            console.log('   User ID:', session.userId);
            console.log('   Access Token:', session.accessToken.substring(0, 10) + '...');
            console.log('   Public Token:', session.publicToken.substring(0, 10) + '...');
            console.log('   Login Time:', session.loginTime);
            console.log('   Token Expires:', session.tokenExpiryTime);
            console.log('');
        });

        auth.on('login_failed', (error) => {
            console.log('❌ Login failed:', error.message);
        });

        auth.on('logout', () => {
            console.log('👋 Logout successful');
        });

        // Initialize authentication
        await auth.initialize();

        const session = auth.getSession();
        if (session) {
            console.log('✅ Authentication successful!\n');

            // Test API calls
            console.log('🧪 Testing API calls...\n');

            try {
                console.log('📊 Fetching user profile...');
                const profile = await auth.makeAuthenticatedRequest('/user/profile');
                console.log('✅ Profile fetched successfully:');
                console.log('   Name:', profile.data.user_name);
                console.log('   Email:', profile.data.email);
                console.log('   User Type:', profile.data.user_type);
                console.log('   Broker:', profile.data.broker);
                console.log('');

                console.log('💰 Fetching account margins...');
                const margins = await auth.makeAuthenticatedRequest('/user/margins');
                console.log('✅ Margins fetched successfully:');
                console.log('   Available Cash:', margins.data.equity.available.cash);
                console.log('   Used Margin:', margins.data.equity.used.debits);
                console.log('');

                console.log('📈 Fetching holdings...');
                const holdings = await auth.makeAuthenticatedRequest('/portfolio/holdings');
                console.log('✅ Holdings fetched successfully:');
                console.log('   Total Holdings:', holdings.data.length);
                if (holdings.data.length > 0) {
                    console.log('   Sample Holding:', holdings.data[0].tradingsymbol);
                }
                console.log('');

                console.log('📋 Fetching positions...');
                const positions = await auth.makeAuthenticatedRequest('/portfolio/positions');
                console.log('✅ Positions fetched successfully:');
                console.log('   Net Positions:', positions.data.net.length);
                console.log('   Day Positions:', positions.data.day.length);
                console.log('');

            } catch (error: any) {
                console.error('❌ API call failed:', error.response?.data || error.message);
            }

            // Test logout (optional)
            console.log('🤔 Would you like to test logout? (This will invalidate the session)');
            console.log('   Skipping logout to preserve session for trading...\n');

        } else {
            console.log('❌ Authentication failed - no session created');
        }

    } catch (error: any) {
        console.error('❌ Zerodha API auth test failed:', error.message);
        if (error.response?.data) {
            console.error('   API Error:', error.response.data);
        }
    }
}

// Main execution
if (require.main === module) {
    console.log('🔐 Zerodha API Authentication Test Suite');
    console.log('=========================================\n');

    testZerodhaApiAuth().catch(error => {
        console.error('💥 Test suite failed:', error);
        process.exit(1);
    });
} 