"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const easy_auth_1 = require("./easy-auth");
async function demonstrateAutoTOTP() {
    console.log('🚀 Zerodha Automatic TOTP Authentication Example\n');
    try {
        console.log('📋 Method 1: Using createAutoTOTPAuth() with environment variables');
        const auth = await (0, easy_auth_1.createAutoTOTPAuth)();
        const session = auth.getSession();
        console.log('✅ Session Details:');
        console.log(`   User ID: ${session?.userId}`);
        console.log(`   Access Token: ${session?.accessToken.substring(0, 20)}...`);
        console.log(`   Expires: ${session?.expiryTime}\n`);
        console.log('📊 Testing API calls...');
        const profile = await auth.apiCall('/user/profile');
        console.log('✅ User Profile:', profile.data.user_name);
        const margins = await auth.apiCall('/user/margins');
        console.log('✅ Available Cash:', margins.data.equity.available.cash);
        const holdings = await auth.apiCall('/portfolio/holdings');
        console.log('✅ Holdings Count:', holdings.data.length);
        console.log('\n🎉 All tests passed! Automatic TOTP authentication is working perfectly.');
    }
    catch (error) {
        console.error('❌ Error:', error);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Make sure all environment variables are set in your .env file:');
        console.log('   ZERODHA_API_KEY=your_api_key');
        console.log('   ZERODHA_API_SECRET=your_api_secret');
        console.log('   ZERODHA_USER_ID=your_user_id');
        console.log('   ZERODHA_PASSWORD=your_password');
        console.log('   ZERODHA_TOTP_SECRET=your_base32_totp_secret');
        console.log('2. Verify your TOTP secret is in base32 format');
        console.log('3. Check that your Zerodha credentials are correct');
    }
}
async function demonstrateDirectUsage() {
    console.log('\n📋 Method 2: Using AutoTOTPZerodhaAuth class directly');
    const auth = new easy_auth_1.AutoTOTPZerodhaAuth({
        apiKey: process.env.ZERODHA_API_KEY || '',
        apiSecret: process.env.ZERODHA_API_SECRET || '',
        userId: process.env.ZERODHA_USER_ID || '',
        password: process.env.ZERODHA_PASSWORD || '',
        totpSecret: process.env.ZERODHA_TOTP_SECRET || ''
    });
    await auth.authenticate();
    console.log('✅ Direct authentication completed');
    const instruments = await auth.apiCall('/instruments');
    console.log('✅ Instruments loaded:', instruments.length);
}
if (require.main === module) {
    demonstrateAutoTOTP()
        .then(() => demonstrateDirectUsage())
        .catch(console.error);
}
//# sourceMappingURL=auto-totp-example.js.map