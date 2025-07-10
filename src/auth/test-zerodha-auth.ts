import dotenv from 'dotenv';
import { ZerodhaAuth, ZerodhaAuthConfig } from './zerodha-auth';

// Load environment variables
dotenv.config();

async function testZerodhaAuth() {
  console.log('Testing Comprehensive Zerodha Authentication with 2FA...');
  
  // Your Zerodha credentials
  const config: ZerodhaAuthConfig = {
    apiKey: '4kii2cglymgxjpqq',
    apiSecret: 'fmapqarltxl0lhyetqeasfgjias6ov3h',
    userId: 'XB7556',
    password: 'Lumia620@',
    totpKey: 'your_totp_secret_key_here' // You need to provide your TOTP secret key
  };
  
  console.log('🔑 API Key:', config.apiKey);
  console.log('🔐 API Secret:', config.apiSecret);
  console.log('👤 User ID:', config.userId);
  console.log('🔐 Password:', config.password);
  console.log('⚠️  TOTP Key:', config.totpKey === 'your_totp_secret_key_here' ? 'NOT SET' : 'SET');
  
  if (config.totpKey === 'your_totp_secret_key_here') {
    console.log('❌ You need to set your TOTP secret key for 2FA');
    console.log('📋 To get your TOTP key:');
    console.log('1. Login to Zerodha Kite');
    console.log('2. Go to Settings > API');
    console.log('3. Find your TOTP secret key');
    console.log('4. Add it to the config above');
    return;
  }
  
  try {
    const auth = new ZerodhaAuth(config);
    
    // Listen for events
    auth.on('session_loaded', (session) => {
      console.log('✅ Session loaded:', session);
    });
    
    auth.on('login_success', (session) => {
      console.log('✅ Login successful:', session);
    });
    
    auth.on('login_failed', (error) => {
      console.log('❌ Login failed:', error);
    });
    
    auth.on('logout', () => {
      console.log('✅ Logout successful');
    });
    
    console.log('Initializing Zerodha Auth...');
    await auth.initialize();
    
    const session = auth.getSession();
    if (session) {
      console.log('✅ Authentication successful!');
      console.log('User ID:', session.userId);
      console.log('Login Time:', session.loginTime);
      console.log('Token Expires:', session.tokenExpiryTime);
      
      // Test an API call
      try {
        console.log('Testing API call...');
        const profile = await auth.makeAuthenticatedRequest('/user/profile');
        console.log('✅ API call successful:', profile.data);
      } catch (error) {
        console.error('❌ API call failed:', error);
      }
    } else {
      console.log('❌ Authentication failed');
    }
    
  } catch (error) {
    console.error('❌ Zerodha auth test failed:', error);
  }
}

// Run the test
testZerodhaAuth(); 