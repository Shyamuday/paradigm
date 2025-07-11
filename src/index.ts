import 'reflect-metadata';
import dotenv from 'dotenv';
import { logger } from './logger/logger';
import { ConfigManager } from './config/config-manager';
import { ZerodhaApiAuth, ZerodhaApiAuthConfig } from './auth/zerodha-api-auth';
import { DatabaseManager } from './database/database';
import { UserService } from './services/user.service';
import { MarketDataService } from './services/market-data.service';
import { OrderService } from './services/order.service';
import { StrategyService } from './services/strategy.service';
import { InstrumentConfig } from './types';

// Load environment variables
dotenv.config();

class TradingBot {
  private configManager: ConfigManager;
  private databaseManager: DatabaseManager;
  private authManager?: ZerodhaApiAuth;
  private userService: UserService;
  private marketDataService: MarketDataService;
  private orderService: OrderService;
  private strategyService: StrategyService;
  private currentSessionId?: string;
  private isRunning: boolean = false;

  constructor() {
    logger.info('🚀 Initializing Paradigm Algo Trading Bot...');

    // Initialize core components
    this.configManager = new ConfigManager();
    this.databaseManager = DatabaseManager.getInstance();
    this.userService = new UserService();
    this.marketDataService = new MarketDataService();
    this.orderService = new OrderService();
    this.strategyService = new StrategyService();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('📋 Starting bot initialization...');

      // 1. Load configuration
      await this.configManager.loadConfig();
      logger.info('✅ Configuration loaded');

      // 2. Connect to database
      await this.databaseManager.connect();
      logger.info('✅ Database connected');

      // 3. Initialize authentication
      await this.initializeAuthentication();
      logger.info('✅ Authentication initialized');

      // 4. Initialize market data
      await this.initializeMarketData();
      logger.info('✅ Market data initialized');

      // 5. Initialize strategies
      await this.initializeStrategies();
      logger.info('✅ Trading strategies initialized');

      // 6. Create or load user session
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
      const authConfig: ZerodhaApiAuthConfig = {
        apiKey: process.env.ZERODHA_API_KEY || '4kii2cglymgxjpqq',
        apiSecret: process.env.ZERODHA_API_SECRET || 'fmapqarltxl0lhyetqeasfgjias6ov3h',
        userId: process.env.ZERODHA_USER_ID || 'XB7556',
        password: process.env.ZERODHA_PASSWORD || 'Lumia620@',
        totpSecret: process.env.ZERODHA_TOTP_SECRET || '',
        redirectUri: process.env.ZERODHA_REDIRECT_URI || 'https://127.0.0.1'
      };

      this.authManager = new ZerodhaApiAuth(authConfig);

      // Set up event listeners
      this.authManager.on('login_success', (session) => {
        logger.info('🎉 Zerodha login successful!');
        logger.info('   User ID:', session.userId);
        logger.info('   Access Token:', session.accessToken.substring(0, 10) + '...');
        logger.info('   Token Expires:', session.tokenExpiryTime);
      });

      this.authManager.on('login_failed', (error) => {
        logger.error('❌ Zerodha login failed:', error.message);
      });

      await this.authManager.initialize();
    } catch (error) {
      logger.error('Failed to initialize authentication:', error);
      throw error;
    }
  }

  private async initializeMarketData(): Promise<void> {
    try {
      const marketDataConfig = this.configManager.getMarketDataConfig();

      // Create instruments from config
      for (const instrumentConfig of marketDataConfig.instruments) {
        try {
          const existingInstrument = await this.marketDataService.getInstrumentBySymbol(instrumentConfig.symbol);
          if (!existingInstrument) {
            await this.marketDataService.createInstrument(instrumentConfig);
            logger.info('📈 Instrument created:', instrumentConfig.symbol);
          }
        } catch (error) {
          logger.warn('Failed to create instrument:', instrumentConfig.symbol, error);
        }
      }
    } catch (error) {
      logger.error('Failed to initialize market data:', error);
      throw error;
    }
  }

  private async initializeStrategies(): Promise<void> {
    try {
      const strategiesConfig = this.configManager.getStrategiesConfig();

      for (const [strategyName, strategyConfig] of Object.entries(strategiesConfig)) {
        try {
          const existingStrategy = await this.strategyService.getStrategyByName(strategyName);
          if (!existingStrategy) {
            await this.strategyService.createStrategy(strategyConfig);
            logger.info('📊 Strategy created:', strategyName);
          }
        } catch (error) {
          logger.warn('Failed to create strategy:', strategyName, error);
        }
      }
    } catch (error) {
      logger.error('Failed to initialize strategies:', error);
      throw error;
    }
  }

  private async initializeUserSession(): Promise<void> {
    try {
      const tradingConfig = this.configManager.getTradingConfig();

      // Create a default user if none exists
      let user = await this.userService.getUserByEmail('bot@paradigm.com');
      if (!user) {
        const newUser = await this.userService.createUser('bot@paradigm.com', 'Paradigm Trading Bot');
        user = await this.userService.getUserByEmail('bot@paradigm.com');
      }

      if (!user) {
        throw new Error('Failed to create or find user');
      }

      // Create a new trading session
      const session = await this.userService.createTradingSession(user.id, {
        mode: tradingConfig.mode,
        capital: tradingConfig.capital,
        status: 'active',
      });

      this.currentSessionId = session.id;
      logger.info('📊 Trading session created:', session.id);
    } catch (error) {
      logger.error('Failed to initialize user session:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      logger.info('🚀 Starting trading bot...');

      if (!this.authManager) {
        throw new Error('Authentication manager not initialized');
      }

      const session = this.authManager.getSession();
      if (!session) {
        throw new Error('No active authentication session');
      }

      this.isRunning = true;
      logger.info('✅ Trading bot started successfully');

      // Start the main trading loop
      this.startTradingLoop();

    } catch (error) {
      logger.error('❌ Failed to start bot:', error);
      throw error;
    }
  }

  private async startTradingLoop(): Promise<void> {
    logger.info('🔄 Starting trading loop...');

    while (this.isRunning) {
      try {
        await this.executeTradingCycle();

        // Wait 1 minute before next cycle
        await new Promise(resolve => setTimeout(resolve, 60000));
      } catch (error) {
        logger.error('❌ Error in trading loop:', error);
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds on error
      }
    }
  }

  private async executeTradingCycle(): Promise<void> {
    try {
      if (!this.currentSessionId) {
        throw new Error('No active trading session');
      }

      logger.debug('📊 Executing trading cycle...');

      // 1. Get market data
      const marketData = await this.getMarketData();

      // 2. Execute active strategies
      const activeStrategies = await this.strategyService.getActiveStrategies();

      for (const strategy of activeStrategies) {
        try {
          const result = await this.strategyService.executeStrategy(strategy.name, marketData);

          if (result.success && result.signals.length > 0) {
            logger.info(`📈 Strategy ${strategy.name} generated ${result.signals.length} signals`);

            // 3. Process signals and create trades
            for (const signal of result.signals) {
              await this.processSignal(signal, strategy.id);
            }
          }
        } catch (error) {
          logger.error(`❌ Error executing strategy ${strategy.name}:`, error);
        }
      }

      // 4. Update open positions
      await this.updateOpenPositions();

    } catch (error) {
      logger.error('❌ Error in trading cycle:', error);
    }
  }

  private async getMarketData(): Promise<any[]> {
    try {
      const instruments = await this.marketDataService.getAllInstruments();
      const marketData = [];

      for (const instrument of instruments) {
        const latestData = await this.marketDataService.getLatestMarketData(instrument.symbol);
        if (latestData) {
          marketData.push({
            symbol: instrument.symbol,
            ltp: latestData.ltp,
            open: latestData.open,
            high: latestData.high,
            low: latestData.low,
            close: latestData.close,
            volume: latestData.volume,
            timestamp: latestData.timestamp,
          });
        }
      }

      return marketData;
    } catch (error) {
      logger.error('Failed to get market data:', error);
      return [];
    }
  }

  private async processSignal(signal: any, strategyId: string): Promise<void> {
    try {
      if (!this.currentSessionId) return;

      logger.info(`📊 Processing signal: ${signal.action} ${signal.symbol} at ${signal.price}`);

      // Create trade from signal
      const trade = await this.orderService.createTrade(this.currentSessionId, signal, strategyId);

      // In a real implementation, you would:
      // 1. Apply risk management checks
      // 2. Send order to broker (Zerodha)
      // 3. Update trade status based on execution

      logger.info(`✅ Trade created: ${trade.id}`);
    } catch (error) {
      logger.error('Failed to process signal:', error);
    }
  }

  private async updateOpenPositions(): Promise<void> {
    try {
      if (!this.currentSessionId) return;

      const openPositions = await this.orderService.getOpenPositions(this.currentSessionId);

      for (const position of openPositions) {
        // Update position with current market price
        const latestData = await this.marketDataService.getLatestMarketData(position.instrument.symbol);
        if (latestData?.ltp) {
          await this.orderService.updatePosition(position.id, {
            currentPrice: latestData.ltp,
            unrealizedPnL: this.calculateUnrealizedPnL(position, latestData.ltp),
          });
        }
      }
    } catch (error) {
      logger.error('Failed to update open positions:', error);
    }
  }

  private calculateUnrealizedPnL(position: any, currentPrice: number): number {
    const quantity = position.quantity;
    const averagePrice = position.averagePrice;
    const side = position.side;

    if (side === 'LONG') {
      return quantity * (currentPrice - averagePrice);
    } else {
      return quantity * (averagePrice - currentPrice);
    }
  }

  async stop(): Promise<void> {
    try {
      logger.info('🛑 Stopping trading bot...');

      this.isRunning = false;

      if (this.currentSessionId) {
        await this.userService.stopTradingSession(this.currentSessionId);
      }

      if (this.authManager) {
        await this.authManager.logout();
      }

      await this.databaseManager.disconnect();

      logger.info('✅ Trading bot stopped successfully');
    } catch (error) {
      logger.error('❌ Failed to stop bot:', error);
      throw error;
    }
  }

  async getStatus(): Promise<any> {
    try {
      const session = this.authManager?.getSession();
      const currentSession = this.currentSessionId ? await this.userService.getTradingSession(this.currentSessionId) : null;
      const pnl = this.currentSessionId ? await this.orderService.getSessionPnL(this.currentSessionId) : null;

      return {
        isRunning: this.isRunning,
        authentication: {
          isAuthenticated: !!session,
          userId: session?.userId,
          tokenExpiry: session?.tokenExpiryTime,
        },
        session: currentSession,
        pnl,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to get status:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
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
      logger.info('🛑 Received SIGINT, shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('🛑 Received SIGTERM, shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error('💥 Fatal error in main:', error);
    process.exit(1);
  }
}

// Start the bot if this file is run directly
if (require.main === module) {
  main();
}

export default TradingBot; 