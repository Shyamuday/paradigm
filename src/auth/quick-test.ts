import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔐 Zerodha API Credentials Status');
console.log('==================================\n');

// Check all credentials
const credentials = {
    apiKey: process.env.ZERODHA_API_KEY || '4kii2cglymgxjpqq',
    apiSecret: process.env.ZERODHA_API_SECRET || 'fmapqarltxl0lhyetqeasfgjias6ov3h',
    userId: process.env.ZERODHA_USER_ID || 'XB7556',
    password: process.env.ZERODHA_PASSWORD || 'Lumia620@',
    totpSecret: process.env.ZERODHA_TOTP_SECRET || '',
    redirectUri: process.env.ZERODHA_REDIRECT_URI || 'https://127.0.0.1'
};

console.log('📋 Credentials Status:');
console.log('🔑 API Key:', credentials.apiKey ? '✅ READY' : '❌ MISSING');
console.log('🔐 API Secret:', credentials.apiSecret ? '✅ READY' : '❌ MISSING');
console.log('👤 User ID:', credentials.userId ? '✅ READY' : '❌ MISSING');
console.log('🔐 Password:', credentials.password ? '✅ READY' : '❌ MISSING');
console.log('🔢 TOTP Secret:', credentials.totpSecret ? '✅ READY' : '❌ MISSING');
console.log('🔗 Redirect URI:', credentials.redirectUri);
console.log('');

if (!credentials.totpSecret) {
    console.log('⚠️  Only TOTP Secret is missing!');
    console.log('');
    console.log('🚀 To complete setup, you need to:');
    console.log('1. Get your TOTP secret from Zerodha Kite');
    console.log('2. Add it to your .env file:');
    console.log('   ZERODHA_TOTP_SECRET=your_base32_totp_secret');
    console.log('');
    console.log('📖 How to get TOTP secret:');
    console.log('1. Login to https://kite.zerodha.com');
    console.log('2. Go to Settings → API');
    console.log('3. When setting up 2FA, scan the QR code');
    console.log('4. The secret shown is your TOTP secret');
    console.log('');
    console.log('✅ Once you add the TOTP secret, you can run:');
    console.log('   npm run auth:login');
    console.log('   npm run auth:test');
} else {
    console.log('🎉 All credentials are ready!');
    console.log('');
    console.log('🚀 You can now run:');
    console.log('   npm run auth:login  # Standalone login example');
    console.log('   npm run auth:test   # Comprehensive test suite');
    console.log('');
    console.log('📊 The system will automatically:');
    console.log('   • Login to Zerodha Kite');
    console.log('   • Generate TOTP for 2FA');
    console.log('   • Extract access token');
    console.log('   • Test API calls');
}

console.log('');
console.log('📁 Files created:');
console.log('   • src/auth/zerodha-api-auth.ts          # Main auth class');
console.log('   • src/auth/automated-login-example.ts   # Standalone example');
console.log('   • src/auth/test-zerodha-api-auth.ts    # Test suite');
console.log('   • docs/API_AUTHENTICATION.md            # Documentation'); 