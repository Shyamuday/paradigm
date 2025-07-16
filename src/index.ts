import 'reflect-metadata';
import dotenv from 'dotenv';
import { logger } from './logger/logger';
import { ConfigManager } from './config/config-manager';
import { ZerodhaAuth } from './auth/zerodha-auth';
import { db } from './database/database';
import { UserService } from './services/user.service';
import { MarketDataService } from './services/market-data.service';
import { OrderService } from './services/order.service';
import { StrategyService } from './services/strategy.service';
import { OrderManagerService } from './services/order-manager.service';
import { InstrumentsManager } from './services/instruments-manager.service';
import { InstrumentConfig } from './types';

// Load environment variables
dotenv.config();

class TradingBot {
  private configManager: ConfigManager;
  private authManager?: ZerodhaAuth;
  private userService: UserService;
  private marketDataService?: MarketDataService;
  private orderService: OrderService;
  private strategyService: StrategyService;
  private orderManagerService?: OrderManagerService;
  private instrumentsManager?: InstrumentsManager;
  private currentSessionId?: string;
  private isRunning: boolean = false;

  constructor() {
    logger.info('🚀 Initializing Paradigm Algo Trading Bot...');

    // Initialize core components
    this.configManager = new ConfigManager();
    this.userService = new UserService();
    this.orderService = new OrderService();
    this.strategyService = new StrategyService();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('📋 Starting bot initialization...');

      // 1. Load configuration
      await this.configManager.loadConfig();
      logger.info('✅ Configuration loaded');

      // 2. Initialize authentication
      await this.initializeAuthentication();
      logger.info('✅ Authentication initialized');

      // 3. Initialize market data
      await this.initializeMarketData();
      logger.info('✅ Market data initialized');

      // 4. Initialize strategies
      await this.initializeStrategies();
      logger.info('✅ Trading strategies initialized');

      // 5. Create or load user session
      await this.initializeUserSession();
      logger.info('✅ User session initialized');

      logger.info('🎉 Bot initialization completed successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize bot:', error);
      throw error;
    }
  }

  private async initializeAuthentication(): Promise<void> {
    try {
      this.authManager = new ZerodhaAuth();

      // Check if we have a valid session
      const hasValidSession = await this.authManager.hasValidSession();

      if (!hasValidSession) {
        logger.info('🔄 No valid session found, starting OAuth login...');
        await this.authManager.startOAuthLogin();
      }

      logger.info('🎉 Zerodha authentication successful!');

    } catch (error) {
      logger.error('Failed to initialize authentication:', error);
      throw error;
    }
  }

  private async initializeMarketData(): Promise<void> {
    try {
      if (!this.authManager) {
        throw new Error('Authentication not initialized');
      }

      // Initialize instruments manager
      this.instrumentsManager = new InstrumentsManager(this.authManager);

      // Initialize market data service
      this.marketDataService = new MarketDataService(this.instrumentsManager, this.authManager.getKite());

      // Initialize order manager
      if (this.currentSessionId) {
        this.orderManagerService = new OrderManagerService(this.authManager.getKite(), this.currentSessionId);
      }

      logger.info('✅ Market data services initialized');
    } catch (error) {
      logger.error('Failed to initialize market data:', error);
      throw error;
    }
  }

  private async initializeStrategies(): Promise<void> {
    try {
      // Create default strategies
      const defaultStrategies = [
        {
          name: 'Moving Average Crossover',
          description: 'Simple moving average crossover strategy',
          enabled: true,
          parameters: {
            shortPeriod: 10,
            longPeriod: 20,
            volumeThreshold: 1000
          },
          capitalAllocation: 0.1,
          instruments: ['RELIANCE', 'TCS', 'INFY']
        }
      ];

      // Create strategies if they don't exist
      for (const strategyConfig of defaultStrategies) {
        const existing = await this.strategyService.getStrategyByName(strategyConfig.name);
        if (!existing) {
          await this.strategyService.createStrategy(strategyConfig as any);
          logger.info(`✅ Created strategy: ${strategyConfig.name}`);
        }
      }

      logger.info('✅ Strategies initialized');
    } catch (error) {
      logger.error('Failed to initialize strategies:', error);
      throw error;
    }
  }

  private async initializeUserSession(): Promise<void> {
    try {
      // Create or get default user
      let user = await this.userService.getUserByEmail('trader@paradigm.com');

      if (!user) {
        user = await this.userService.createUser('trader@paradigm.com', 'Paradigm Trader');
        logger.info('✅ Default user created');
      }

      // Create trading session
      const session = await this.userService.createTradingSession(user.id, {
        mode: 'paper',
        capital: 100000,
        config: {
          maxPositionSize: 10000,
          maxOpenPositions: 5,
          maxDailyLoss: 5000
        }
      });

      this.currentSessionId = session.id;
      logger.info('✅ Trading session created:', session.id);

      // Initialize order manager with session
      if (this.authManager && this.currentSessionId) {
        const kite = this.authManager.getKite();
        this.orderManagerService = new OrderManagerService(kite, this.currentSessionId);
      }

    } catch (error) {
      logger.error('Failed to initialize user session:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      if (this.isRunning) {
        logger.warn('Bot is already running');
        return;
      }

      await this.initialize();
      this.isRunning = true;

      logger.info('🚀 Trading bot started successfully');

      // Start main trading loop
      await this.runTradingLoop();

    } catch (error) {
      logger.error('Failed to start trading bot:', error);
      throw error;
    }
  }

  private async runTradingLoop(): Promise<void> {
    logger.info('🔄 Starting trading loop...');

    while (this.isRunning) {
      try {
        // Get active strategies
        const strategies = await this.strategyService.getActiveStrategies();

        for (const strategy of strategies) {
          // Generate mock market data for testing
          const mockMarketData = this.generateMockMarketData();

          // Execute strategy
          const result = await this.strategyService.executeStrategy(strategy.name, mockMarketData);

          if (result.success && result.signals.length > 0) {
            logger.info(`📊 Strategy ${strategy.name} generated ${result.signals.length} signals`);

            // Process signals
            for (const signal of result.signals) {
              if (this.orderManagerService) {
                try {
                  const orderId = await this.orderManagerService.placeOrder(signal);
                  logger.info(`📋 Order placed: ${orderId} for ${signal.symbol}`);
                } catch (error) {
                  logger.error('Failed to place order:', error);
                }
              }
            }
          }
        }

        // Wait before next iteration
        await new Promise(resolve => setTimeout(resolve, 5000));

      } catch (error) {
        logger.error('Error in trading loop:', error);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }

  private generateMockMarketData() {
    // Generate mock market data for testing
    const symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFC', 'ICICIBANK'];
    const data = [];

    for (let i = 0; i < 50; i++) {
      const basePrice = 1000 + Math.random() * 1000;
      const timestamp = new Date(Date.now() - (50 - i) * 60000);

      for (const symbol of symbols) {
        data.push({
          symbol,
          timestamp,
          close: basePrice + Math.random() * 100 - 50,
          ltp: basePrice + Math.random() * 100 - 50,
          volume: Math.floor(Math.random() * 10000) + 1000
        });
      }
    }

    return data;
  }

  async stop(): Promise<void> {
    try {
      logger.info('🛑 Stopping trading bot...');
      this.isRunning = false;

      // Cleanup market data service
      if (this.marketDataService) {
        this.marketDataService.cleanup();
      }

      // End trading session
      if (this.currentSessionId) {
        await this.userService.endTradingSession(this.currentSessionId);
      }

      logger.info('✅ Trading bot stopped successfully');
    } catch (error) {
      logger.error('Error stopping trading bot:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const bot = new TradingBot();

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

  try {
    await bot.start();
  } catch (error) {
    logger.error('Failed to start trading bot:', error);
    process.exit(1);
  }
}

// Run the bot
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { TradingBot }; 