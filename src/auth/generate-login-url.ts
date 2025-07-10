import { ZerodhaAuth, ZerodhaAuthConfig } from './zerodha-auth';
import { logger } from '../logger/logger';

async function generateLoginUrl() {
  const config: ZerodhaAuthConfig = {
    apiKey: '4kii2cglymgxjpqq',
    apiSecret: 'fmapqarltxl0lhyetqeasfgjias6ov3h'
  };

  const auth = new ZerodhaAuth(config);
  const loginUrl = auth.generateLoginUrl();
  
  console.log('\n=== ZERODHA LOGIN URL ===');
  console.log(loginUrl);
  console.log('\n=== INSTRUCTIONS ===');
  console.log('1. Copy the URL above');
  console.log('2. Open it in your browser');
  console.log('3. Login manually');
  console.log('4. After successful login, you\'ll be redirected to a URL with request_token');
  console.log('5. Copy the request_token from the URL');
  console.log('6. Use it with the trading bot\n');
}

if (require.main === module) {
  generateLoginUrl().catch(console.error);
} 