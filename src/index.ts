import 'reflect-metadata';
import dotenv from 'dotenv';
import { logger } from './logger/logger';
import { ConfigManager } from './config/config-manager';
import { ZerodhaAuth, ZerodhaAuthConfig } from './auth/zerodha-auth';

// Load environment variables
dotenv.config();

class TradingBot {
  private configManager: ConfigManager;
  private authManager?: ZerodhaAuth;

  constructor() {
    logger.info('Initializing Paradigm Algo Trading Bot...');
    
    // Initialize working modules
    this.configManager = new ConfigManager();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Starting bot initialization...');

      // Load configuration
      await this.configManager.loadConfig();
      
      // Initialize authentication
      const authConfig: ZerodhaAuthConfig = {
        apiKey: '4kii2cglymgxjpqq',
        apiSecret: 'fmapqarltxl0lhyetqeasfgjias6ov3h',
        // For manual login (recommended for security)
        // userId: 'XB7556',
        // password: 'Lumia620@',
        // totpKey: 'your_totp_secret_key_here'
      };
      
      this.authManager = new ZerodhaAuth(authConfig);
      await this.authManager.initialize();

      logger.info('Bot initialization completed successfully');
    } catch (error) {
      logger.error('Failed to initialize bot:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting trading bot...');
      
      if (this.authManager) {
        const session = this.authManager.getSession();
        if (session) {
          logger.info('✅ Authentication successful!');
          logger.info('User ID:', session.userId);
          logger.info('Login Time:', session.loginTime);
          logger.info('Token Expires:', session.tokenExpiryTime);
        }
      }

      logger.info('Trading bot started successfully');
    } catch (error) {
      logger.error('Failed to start bot:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      logger.info('Stopping trading bot...');
      
      if (this.authManager) {
        await this.authManager.logout();
      }
      
      logger.info('Trading bot stopped successfully');
    } catch (error) {
      logger.error('Failed to stop bot:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const bot = new TradingBot();
  
  try {
    await bot.initialize();
    await bot.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Fatal error in main:', error);
    process.exit(1);
  }
}

// Start the bot if this file is run directly
if (require.main === module) {
  main();
}

export default TradingBot; 