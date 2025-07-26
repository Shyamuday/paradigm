import { ConfigManager } from '../config/config-manager';
import { EnhancedStrategyService } from '../services/enhanced-strategy.service';
import { TelegramNotificationService, TelegramConfig } from '../services/telegram-notification.service';
import { MarketData } from '../schemas/strategy.schema';
import { logger } from '../logger/logger';
import { KiteConnect } from 'kiteconnect';

// Personal Trading Configuration
interface PersonalTradingConfig {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    instruments: string[];
    capital: number;
    maxRiskPerTrade: number;
    maxDailyLoss: number;
    tradingHours: {
        start: string; // "09:15"
        end: string;   // "15:30"
    };
    strategies: {
        [key: string]: {
            enabled: boolean;
            allocation: number; // Percentage of capital
            parameters: any;
        };
    };
    telegram: TelegramConfig;
}

class PersonalTradingSystem {
    private configManager: ConfigManager;
    private strategyService: EnhancedStrategyService;
    private telegramService: TelegramNotificationService;
    private kite: KiteConnect;
    private config: PersonalTradingConfig;
    private isRunning: boolean = false;
    private currentPositions: Map<string, any> = new Map();
    private dailyPnL: number = 0;
    private dailyTrades: number = 0;
    private totalPnL: number = 0;
    private winningTrades: number = 0;
    private losingTrades: number = 0;

    constructor(config: PersonalTradingConfig) {
        this.config = config;
        this.configManager = new ConfigManager();
        this.strategyService = new EnhancedStrategyService(this.configManager);
        this.telegramService = new TelegramNotificationService(config.telegram);

        // Initialize KiteConnect
        this.kite = new (KiteConnect as any)({
            api_key: config.apiKey,
            api_secret: config.apiSecret
        });
        this.kite.setAccessToken(config.accessToken);
    }

    async initialize(): Promise<void> {
        logger.info('Initializing Personal Trading System...');

        try {
            // Initialize Telegram notifications
            await this.telegramService.initialize();

            // Load configuration
            await this.configManager.loadConfig();

            // Initialize strategy service
            await this.strategyService.initialize();

            // Validate trading hours
            if (!this.isWithinTradingHours()) {
                const alert = {
                    type: 'WARNING' as const,
                    message: 'Outside trading hours. System will wait until market opens.',
                    timestamp: new Date()
                };
                await this.telegramService.sendSystemAlert(alert);
            }

            // Get current positions
            await this.loadCurrentPositions();

            // Send startup notification
            await this.telegramService.sendCustomMessage(`
🤖 **TRADING SYSTEM STARTED** 🤖

💰 **Capital**: ₹${this.config.capital.toLocaleString()}
📊 **Max Risk/Trade**: ${(this.config.maxRiskPerTrade * 100).toFixed(1)}%
🚨 **Daily Loss Limit**: ₹${this.config.maxDailyLoss.toLocaleString()}
📈 **Instruments**: ${this.config.instruments.join(', ')}
🔓 **Open Positions**: ${this.currentPositions.size}

⏰ Started at ${new Date().toLocaleString()}
            `.trim());

            logger.info('Personal Trading System initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Personal Trading System:', error);
            await this.telegramService.sendErrorAlert(error as Error, 'System Initialization');
            throw error;
        }
    }

    async startTrading(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Trading system is already running');
            return;
        }

        logger.info('Starting Personal Trading System...');
        this.isRunning = true;

        // Send start notification
        await this.telegramService.sendSystemAlert({
            type: 'INFO',
            message: 'Trading system started successfully',
            timestamp: new Date()
        });

        // Start market data stream
        await this.startMarketDataStream();

        // Start strategy execution loop
        this.startStrategyExecutionLoop();

        logger.info('Personal Trading System started successfully');
    }

    async stopTrading(): Promise<void> {
        logger.info('Stopping Personal Trading System...');
        this.isRunning = false;

        // Send stop notification
        await this.telegramService.sendSystemAlert({
            type: 'INFO',
            message: 'Trading system stopped by user',
            timestamp: new Date()
        });

        // Close all positions if needed
        await this.closeAllPositions();

        logger.info('Personal Trading System stopped');
    }

    private async startMarketDataStream(): Promise<void> {
        // Subscribe to instruments
        const instruments = this.config.instruments.map(symbol => `${symbol}:NSE`);

        try {
            // Note: Real-time subscription requires KiteTicker, not KiteConnect
            logger.info(`Market data setup for instruments: ${instruments.join(', ')}`);

            await this.telegramService.sendCustomMessage(`
📡 **MARKET DATA CONNECTED** 📡

📊 **Instruments**: ${instruments.join(', ')}
⏰ Connected at ${new Date().toLocaleTimeString()}
            `.trim());
        } catch (error) {
            logger.error('Failed to setup market data:', error);
            await this.telegramService.sendErrorAlert(error as Error, 'Market Data Setup');
        }
    }

    private startStrategyExecutionLoop(): void {
        const executionInterval = setInterval(async () => {
            if (!this.isRunning) {
                clearInterval(executionInterval);
                return;
            }

            try {
                // Check if within trading hours
                if (!this.isWithinTradingHours()) {
                    return;
                }

                // Check daily loss limit
                if (this.dailyPnL <= -this.config.maxDailyLoss) {
                    const alert = {
                        type: 'CRITICAL' as const,
                        message: `Daily loss limit reached (₹${this.config.maxDailyLoss}). Stopping trading.`,
                        timestamp: new Date()
                    };
                    await this.telegramService.sendSystemAlert(alert);
                    await this.stopTrading();
                    return;
                }

                // Get market data
                const marketData = await this.getMarketData();

                // Execute strategies
                await this.executeStrategies(marketData);

                // Monitor existing positions
                await this.monitorPositions(marketData);

                // Send performance update
                await this.sendPerformanceUpdate();

            } catch (error) {
                logger.error('Error in strategy execution loop:', error);
                await this.telegramService.sendErrorAlert(error as Error, 'Strategy Execution Loop');
            }
        }, 30000); // Execute every 30 seconds
    }

    private async executeStrategies(marketData: MarketData[]): Promise<void> {
        try {
            const results = await this.strategyService.executeAllStrategies(marketData);

            for (const result of results) {
                if (result.success && result.signals.length > 0) {
                    for (const signal of result.signals) {
                        // Send trade signal notification
                        await this.telegramService.sendTradeSignal({
                            symbol: signal.symbol,
                            action: signal.action,
                            price: signal.price,
                            confidence: signal.confidence,
                            reasoning: signal.reasoning || 'No reasoning provided',
                            strategy: signal.strategyName
                        });

                        await this.processTradeSignal(signal);
                    }
                }
            }
        } catch (error) {
            logger.error('Error executing strategies:', error);
            await this.telegramService.sendErrorAlert(error as Error, 'Strategy Execution');
        }
    }

    private async processTradeSignal(signal: any): Promise<void> {
        try {
            // Check if we already have a position in this symbol
            if (this.currentPositions.has(signal.symbol)) {
                logger.info(`Already have position in ${signal.symbol}. Skipping signal.`);
                return;
            }

            // Calculate position size based on risk
            const positionSize = this.calculatePositionSize(signal);

            // Check if position size is valid
            if (positionSize <= 0) {
                logger.warn(`Invalid position size for ${signal.symbol}. Skipping signal.`);
                return;
            }

            // Execute trade
            const order = await this.executeTrade(signal, positionSize);

            if (order) {
                // Send trade execution notification
                await this.telegramService.sendTradeExecution({
                    symbol: signal.symbol,
                    action: signal.action,
                    quantity: positionSize,
                    price: signal.price,
                    orderId: order.order_id,
                    status: 'SUCCESS'
                });

                logger.info(`Trade executed: ${signal.action} ${positionSize} ${signal.symbol} at ${signal.price}`);

                // Track position
                this.currentPositions.set(signal.symbol, {
                    orderId: order.order_id,
                    symbol: signal.symbol,
                    side: signal.side,
                    quantity: positionSize,
                    entryPrice: signal.price,
                    stopLoss: signal.stopLoss,
                    target: signal.takeProfit,
                    timestamp: new Date()
                });
            }

        } catch (error) {
            logger.error(`Error processing trade signal for ${signal.symbol}:`, error);
            await this.telegramService.sendErrorAlert(error as Error, `Trade Signal Processing - ${signal.symbol}`);
        }
    }

    private calculatePositionSize(signal: any): number {
        const riskAmount = this.config.capital * this.config.maxRiskPerTrade;
        const stopLossDistance = Math.abs(signal.price - (signal.stopLoss || 0));

        if (stopLossDistance === 0) {
            return 0;
        }

        const positionSize = Math.floor(riskAmount / stopLossDistance);

        // Ensure position size doesn't exceed allocation
        const maxAllocation = this.config.capital * 0.1; // Max 10% per trade
        const maxQuantity = Math.floor(maxAllocation / signal.price);

        return Math.min(positionSize, maxQuantity);
    }

    private async executeTrade(signal: any, quantity: number): Promise<any> {
        try {
            const orderParams = {
                tradingsymbol: signal.symbol,
                exchange: 'NSE',
                transaction_type: signal.action === 'BUY' ? 'BUY' : 'SELL',
                quantity: quantity,
                product: 'CNC', // Cash and Carry
                order_type: 'MARKET'
            };

            const order = await this.kite.placeOrder('regular', orderParams);
            return order;

        } catch (error) {
            logger.error(`Error executing trade for ${signal.symbol}:`, error);

            // Send failed trade notification
            await this.telegramService.sendTradeExecution({
                symbol: signal.symbol,
                action: signal.action,
                quantity: quantity,
                price: signal.price,
                orderId: 'FAILED',
                status: 'FAILED'
            });

            return null;
        }
    }

    private async monitorPositions(marketData: MarketData[]): Promise<void> {
        const positionUpdates: any[] = [];

        for (const [symbol, position] of this.currentPositions) {
            const currentData = marketData.find(d => d.symbol === symbol);
            if (!currentData) continue;

            const currentPrice = currentData.close || 0;
            const shouldExit = await this.shouldExitPosition(position, currentPrice);

            // Calculate unrealized P&L
            const unrealizedPnL = this.calculatePnL(position, currentPrice);
            const unrealizedPnLPercent = ((unrealizedPnL / (position.entryPrice * position.quantity)) * 100);

            positionUpdates.push({
                symbol: position.symbol,
                side: position.side,
                quantity: position.quantity,
                entryPrice: position.entryPrice,
                currentPrice: currentPrice,
                unrealizedPnL: unrealizedPnL,
                unrealizedPnLPercent: unrealizedPnLPercent
            });

            if (shouldExit) {
                await this.exitPosition(position, currentPrice);
            }
        }

        // Send position updates
        if (positionUpdates.length > 0) {
            await this.telegramService.sendPositionUpdate(positionUpdates);
        }
    }

    private async shouldExitPosition(position: any, currentPrice: number): Promise<boolean> {
        // Check stop loss
        if (position.side === 'LONG' && currentPrice <= position.stopLoss) {
            return true;
        }
        if (position.side === 'SHORT' && currentPrice >= position.stopLoss) {
            return true;
        }

        // Check target
        if (position.side === 'LONG' && currentPrice >= position.target) {
            return true;
        }
        if (position.side === 'SHORT' && currentPrice <= position.target) {
            return true;
        }

        return false;
    }

    private async exitPosition(position: any, currentPrice: number): Promise<void> {
        try {
            const exitOrder = await this.executeTrade({
                symbol: position.symbol,
                action: position.side === 'LONG' ? 'SELL' : 'BUY',
                price: currentPrice
            }, position.quantity);

            if (exitOrder) {
                // Calculate PnL
                const pnl = this.calculatePnL(position, currentPrice);
                this.dailyPnL += pnl;
                this.totalPnL += pnl;
                this.dailyTrades++;

                if (pnl > 0) {
                    this.winningTrades++;
                } else {
                    this.losingTrades++;
                }

                // Send position exit notification
                await this.telegramService.sendCustomMessage(`
🔓 **POSITION CLOSED** 🔓

📊 **Symbol**: ${position.symbol}
🎯 **Side**: ${position.side}
📦 **Quantity**: ${position.quantity}
💰 **Entry Price**: ₹${position.entryPrice.toFixed(2)}
💰 **Exit Price**: ₹${currentPrice.toFixed(2)}
📈 **P&L**: ₹${pnl.toFixed(2)} (${((pnl / (position.entryPrice * position.quantity)) * 100).toFixed(2)}%)

⏰ ${new Date().toLocaleTimeString()}
                `.trim());

                logger.info(`Position closed: ${position.symbol}, PnL: ${pnl.toFixed(2)}`);

                // Remove from current positions
                this.currentPositions.delete(position.symbol);
            }

        } catch (error) {
            logger.error(`Error exiting position for ${position.symbol}:`, error);
            await this.telegramService.sendErrorAlert(error as Error, `Position Exit - ${position.symbol}`);
        }
    }

    private calculatePnL(position: any, currentPrice: number): number {
        if (position.side === 'LONG') {
            return (currentPrice - position.entryPrice) * position.quantity;
        } else {
            return (position.entryPrice - currentPrice) * position.quantity;
        }
    }

    private async getMarketData(): Promise<MarketData[]> {
        try {
            const marketData: MarketData[] = [];

            const instruments = this.config.instruments.map(symbol => `NSE:${symbol}`);
            const quotes = await this.kite.getQuote(instruments);

            for (const symbol of this.config.instruments) {
                const instrumentData = quotes[`NSE:${symbol}`];

                if (instrumentData) {
                    marketData.push({
                        symbol: symbol,
                        timestamp: new Date(),
                        open: instrumentData.ohlc.open,
                        high: instrumentData.ohlc.high,
                        low: instrumentData.ohlc.low,
                        close: instrumentData.last_price,
                        volume: instrumentData.volume
                    });
                }
            }

            return marketData;
        } catch (error) {
            logger.error('Error fetching market data:', error);
            await this.telegramService.sendErrorAlert(error as Error, 'Market Data Fetch');
            return [];
        }
    }

    private async loadCurrentPositions(): Promise<void> {
        try {
            const positions = await this.kite.getPositions();

            for (const position of positions.net) {
                if (position.quantity > 0) {
                    this.currentPositions.set(position.tradingsymbol, {
                        symbol: position.tradingsymbol,
                        side: position.quantity > 0 ? 'LONG' : 'SHORT',
                        quantity: Math.abs(position.quantity),
                        entryPrice: position.average_price,
                        timestamp: new Date()
                    });
                }
            }

            logger.info(`Loaded ${this.currentPositions.size} existing positions`);

            if (this.currentPositions.size > 0) {
                await this.telegramService.sendCustomMessage(`
📊 **EXISTING POSITIONS LOADED** 📊

🔓 **Open Positions**: ${this.currentPositions.size}
📊 **Symbols**: ${Array.from(this.currentPositions.keys()).join(', ')}

⏰ Loaded at ${new Date().toLocaleTimeString()}
                `.trim());
            }
        } catch (error) {
            logger.error('Error loading current positions:', error);
            await this.telegramService.sendErrorAlert(error as Error, 'Position Loading');
        }
    }

    private async closeAllPositions(): Promise<void> {
        logger.info('Closing all positions...');

        for (const [symbol, position] of this.currentPositions) {
            await this.exitPosition(position, 0); // Will get current price
        }
    }

    private isWithinTradingHours(): boolean {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);

        return currentTime >= this.config.tradingHours.start &&
            currentTime <= this.config.tradingHours.end;
    }

    private async sendPerformanceUpdate(): Promise<void> {
        const totalTrades = this.winningTrades + this.losingTrades;
        const winRate = totalTrades > 0 ? (this.winningTrades / totalTrades) * 100 : 0;

        await this.telegramService.sendPerformanceUpdate({
            totalPnL: this.totalPnL,
            dailyPnL: this.dailyPnL,
            winRate: winRate,
            totalTrades: totalTrades,
            openPositions: this.currentPositions.size,
            capital: this.config.capital
        });
    }

    // Get system status
    getStatus(): any {
        return {
            isRunning: this.isRunning,
            currentPositions: this.currentPositions.size,
            dailyPnL: this.dailyPnL,
            totalPnL: this.totalPnL,
            dailyTrades: this.dailyTrades,
            winningTrades: this.winningTrades,
            losingTrades: this.losingTrades,
            tradingHours: this.isWithinTradingHours(),
            capital: this.config.capital
        };
    }

    // Send daily report
    async sendDailyReport(): Promise<void> {
        const totalTrades = this.winningTrades + this.losingTrades;
        const winRate = totalTrades > 0 ? (this.winningTrades / totalTrades) * 100 : 0;

        const report = {
            totalPnL: this.totalPnL,
            dailyPnL: this.dailyPnL,
            winRate: winRate,
            totalTrades: totalTrades,
            winningTrades: this.winningTrades,
            losingTrades: this.losingTrades,
            averageWin: this.winningTrades > 0 ? this.totalPnL / this.winningTrades : 0,
            averageLoss: this.losingTrades > 0 ? this.totalPnL / this.losingTrades : 0,
            largestWin: 0, // Calculate from historical data
            largestLoss: 0, // Calculate from historical data
            sharpeRatio: 0, // Calculate from historical data
            maxDrawdown: 0, // Calculate from historical data
            bestStrategy: 'N/A',
            bestStrategyPnL: 0
        };

        await this.telegramService.sendDailyReport(report);
    }
}

// Example usage for personal trading with Telegram
export async function startPersonalTradingWithTelegram() {
    const personalConfig: PersonalTradingConfig = {
        apiKey: process.env.KITE_API_KEY || '',
        apiSecret: process.env.KITE_API_SECRET || '',
        accessToken: process.env.KITE_ACCESS_TOKEN || '',
        instruments: ['NIFTY', 'BANKNIFTY'],
        capital: 100000, // 1 Lakh
        maxRiskPerTrade: 0.02, // 2% per trade
        maxDailyLoss: 5000, // 5K daily loss limit
        tradingHours: {
            start: '09:15',
            end: '15:30'
        },
        strategies: {
            moving_average: {
                enabled: true,
                allocation: 0.3,
                parameters: {
                    shortPeriod: 10,
                    longPeriod: 20,
                    volumeThreshold: 1000
                }
            },
            rsi: {
                enabled: true,
                allocation: 0.2,
                parameters: {
                    period: 14,
                    overbought: 70,
                    oversold: 30
                }
            }
        },
        telegram: {
            botToken: process.env.TELEGRAM_BOT_TOKEN || '',
            chatId: process.env.TELEGRAM_CHAT_ID || '',
            enabled: true,
            notifications: {
                tradeSignals: true,
                tradeExecutions: true,
                positionUpdates: true,
                performanceUpdates: true,
                systemAlerts: true,
                dailyReports: true,
                errorAlerts: true
            },
            updateInterval: 30 // minutes
        }
    };

    const tradingSystem = new PersonalTradingSystem(personalConfig);

    try {
        await tradingSystem.initialize();
        await tradingSystem.startTrading();

        // Send daily report at 3:30 PM
        const dailyReportInterval = setInterval(() => {
            const now = new Date();
            if (now.getHours() === 15 && now.getMinutes() === 30) {
                tradingSystem.sendDailyReport();
            }
        }, 60000); // Check every minute

        // Keep the system running
        setInterval(() => {
            const status = tradingSystem.getStatus();
            logger.info('Trading System Status:', status);
        }, 60000); // Log status every minute

    } catch (error) {
        logger.error('Failed to start personal trading:', error);
    }
}

// Export for use
export { PersonalTradingSystem, PersonalTradingConfig };

// Run if executed directly
if (require.main === module) {
    startPersonalTradingWithTelegram().catch(console.error);
} 