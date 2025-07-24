import { AutomatedTradingService, TradingConfig } from '../services/automated-trading.service';
import { logger } from '../logger/logger';
import { MovingAverageStrategy } from '../services/strategies/moving-average-strategy';
import { RsiStrategy } from '../services/strategies/rsi-strategy';
import { BreakoutStrategy } from '../services/strategies/breakout-strategy';

async function runAutomatedTradingExample(): Promise<void> {
    console.log('🚀 Starting Automated Trading Example');
    console.log('=====================================');

    try {
        // Initialize the automated trading service
        const tradingService = new AutomatedTradingService();

        // Configure trading parameters
        const tradingConfig: TradingConfig = {
            maxPositions: 5,                    // Maximum simultaneous positions
            maxRiskPerTrade: 2,                 // Maximum 2% risk per trade
            maxDailyLoss: 1000,                 // Maximum daily loss in INR
            maxDrawdown: 10,                    // Maximum drawdown percentage
            autoExecute: true,                  // Enable automatic order execution
            simulationMode: false,              // Set to true for paper trading
            allowedSymbols: [                   // Allowed symbols for trading
                'RELIANCE',
                'TCS',
                'HDFCBANK',
                'INFY',
                'HINDUNILVR',
                'ITC',
                'SBIN',
                'BAJFINANCE',
                'MARUTI',
                'KOTAKBANK'
            ],
            tradingHours: {
                start: '09:15',                 // Market open time
                end: '15:30'                    // Market close time
            },
            riskManagement: {
                stopLoss: { type: 'PERCENTAGE' as const, value: 2 },
                takeProfit: { type: 'PERCENTAGE' as const, value: 4 },
                maxDrawdown: 10,
                maxDailyLoss: 1000,
                maxOpenPositions: 3
            }
        };

        // Set up event handlers
        setupEventHandlers(tradingService);

        // Initialize the trading service
        await tradingService.initialize(tradingConfig);

        // Add multiple strategies
        await addTradingStrategies(tradingService);

        // Start automated trading
        await tradingService.startTrading();

        // Monitor trading for a specified duration
        await monitorTrading(tradingService);

        // Stop trading
        await tradingService.stopTrading();

        console.log('\n✅ Automated trading example completed successfully');

    } catch (error) {
        logger.error('Automated trading example failed:', error);
        console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    }
}

function setupEventHandlers(tradingService: AutomatedTradingService): void {
    console.log('📡 Setting up event handlers...');

    // Trading lifecycle events
    tradingService.on('initialized', () => {
        console.log('✅ Trading service initialized');
    });

    tradingService.on('trading_started', () => {
        console.log('🟢 Automated trading started');
    });

    tradingService.on('trading_stopped', () => {
        console.log('🔴 Automated trading stopped');
    });

    // Signal and order events
    tradingService.on('signal_generated', (signal) => {
        console.log(`📊 Signal: ${signal.action} ${signal.symbol} at ₹${signal.price}`);
        console.log(`   Strategy: ${signal.strategy}, Quantity: ${signal.quantity}`);
        if (signal.stopLoss) console.log(`   Stop Loss: ₹${signal.stopLoss}`);
        if (signal.target) console.log(`   Target: ₹${signal.target}`);
    });

    tradingService.on('order_placed', ({ signal, order }) => {
        console.log(`📋 Order placed: ${order.orderId} for ${signal.symbol}`);
        console.log(`   Type: ${signal.action}, Quantity: ${signal.quantity}, Price: ₹${signal.price}`);
    });

    tradingService.on('order_filled', (order) => {
        console.log(`✅ Order filled: ${order.orderId} for ${order.symbol}`);
        console.log(`   Executed at: ₹${order.price}, Quantity: ${order.quantity}`);
    });

    tradingService.on('order_rejected', (order) => {
        console.log(`❌ Order rejected: ${order.orderId} - ${order.reason}`);
    });

    tradingService.on('order_failed', ({ signal, error }) => {
        console.log(`❌ Order failed for ${signal.symbol}: ${error}`);
    });

    // Position events
    tradingService.on('position_exiting', ({ position, reason }) => {
        console.log(`📤 Exiting position: ${position.symbol} - Reason: ${reason}`);
        console.log(`   PnL: ₹${position.unrealizedPnL || 0}`);
    });

    tradingService.on('position_updated', (position) => {
        const pnlColor = (position.unrealizedPnL || 0) >= 0 ? '🟢' : '🔴';
        console.log(`${pnlColor} Position: ${position.symbol} ${position.side} - PnL: ₹${position.unrealizedPnL || 0}`);
    });

    tradingService.on('significant_pnl_change', ({ position, unrealizedPnL }) => {
        const pnlColor = unrealizedPnL >= 0 ? '🟢' : '🔴';
        console.log(`${pnlColor} Significant PnL change: ${position.symbol} - ₹${unrealizedPnL}`);
    });

    // Risk management events
    tradingService.on('risk_limit_exceeded', ({ type, value }) => {
        console.log(`⚠️ Risk limit exceeded: ${type} - Value: ${value}`);
    });

    tradingService.on('risk_breach', (riskEvent) => {
        console.log(`⚠️ Risk breach: ${riskEvent.type} - ${riskEvent.message}`);
    });
}

async function addTradingStrategies(tradingService: AutomatedTradingService): Promise<void> {
    console.log('📈 Adding trading strategies...');

    // 1. Moving Average Crossover Strategy
    const maStrategy = {
        name: 'MA_Crossover_Strategy',
        description: 'EMA crossover strategy for trend following',
        type: 'TREND_FOLLOWING' as const,
        enabled: true,
        parameters: {
            shortPeriod: 10,
            longPeriod: 20,
            volumeThreshold: 100000
        },
        capitalAllocation: 10000,
        instruments: ['RELIANCE', 'TCS', 'HDFCBANK'],
        version: '1.0',
        category: 'TECHNICAL_ANALYSIS' as const,
        riskLevel: 'MEDIUM' as const,
        timeframes: ['5m'],
        entryRules: [],
        exitRules: [],
        positionSizing: {
            method: 'RISK_PER_TRADE' as const,
            riskPerTrade: 1.5
        },
        riskManagement: {
            stopLoss: { type: 'PERCENTAGE' as const, value: 1.5 },
            takeProfit: { type: 'PERCENTAGE' as const, value: 3 },
            maxDrawdown: 10,
            maxDailyLoss: 1000,
            maxOpenPositions: 3
        },
        filters: [],
        notifications: []
    };

    await tradingService.addStrategy(maStrategy);
    console.log('✅ Added Moving Average Crossover Strategy');

    // 2. RSI Mean Reversion Strategy
    const rsiStrategy = {
        name: 'RSI_Mean_Reversion',
        description: 'RSI-based mean reversion strategy',
        type: 'MEAN_REVERSION' as const,
        enabled: true,
        parameters: {
            period: 14,
            oversoldThreshold: 30,
            overboughtThreshold: 70,
            volumeThreshold: 50000
        },
        capitalAllocation: 10000,
        instruments: ['INFY', 'HINDUNILVR', 'ITC'],
        version: '1.0',
        category: 'TECHNICAL_ANALYSIS' as const,
        riskLevel: 'MEDIUM' as const,
        timeframes: ['15m'],
        entryRules: [],
        exitRules: [],
        positionSizing: {
            method: 'PERCENTAGE_OF_CAPITAL' as const,
            percentageOfCapital: 5
        },
        riskManagement: {
            stopLoss: { type: 'PERCENTAGE' as const, value: 2 },
            takeProfit: { type: 'PERCENTAGE' as const, value: 3 },
            maxDrawdown: 10,
            maxDailyLoss: 1000,
            maxOpenPositions: 3
        },
        filters: [],
        notifications: []
    };

    await tradingService.addStrategy(rsiStrategy);
    console.log('✅ Added RSI Mean Reversion Strategy');

    // 3. Breakout Strategy
    const breakoutStrategy = {
        name: 'Breakout_Strategy',
        description: 'Support/resistance breakout strategy',
        type: 'BREAKOUT' as const,
        enabled: true,
        parameters: {
            lookbackPeriod: 20,
            breakoutThreshold: 0.015,
            volumeMultiplier: 1.5,
            confirmationPeriod: 2
        },
        capitalAllocation: 10000,
        instruments: ['SBIN', 'BAJFINANCE', 'MARUTI'],
        version: '1.0',
        category: 'TECHNICAL_ANALYSIS' as const,
        riskLevel: 'MEDIUM' as const,
        timeframes: ['30m'],
        entryRules: [],
        exitRules: [],
        positionSizing: {
            method: 'RISK_PER_TRADE' as const,
            riskPerTrade: 2
        },
        riskManagement: {
            stopLoss: { type: 'PERCENTAGE' as const, value: 2 },
            takeProfit: { type: 'PERCENTAGE' as const, value: 4 },
            maxDrawdown: 10,
            maxDailyLoss: 1000,
            maxOpenPositions: 3
        },
        filters: [],
        notifications: []
    };

    await tradingService.addStrategy(breakoutStrategy);
    console.log('✅ Added Breakout Strategy');

    console.log(`📊 Total strategies added: ${tradingService.getActiveStrategies().length}`);
}

async function monitorTrading(tradingService: AutomatedTradingService): Promise<void> {
    console.log('\n📊 Monitoring trading activity...');
    console.log('Press Ctrl+C to stop monitoring');

    const monitoringInterval = setInterval(async () => {
        try {
            const stats = await tradingService.getTradingStats();
            const positions = tradingService.getActivePositions();

            console.log('\n📈 Trading Statistics:');
            console.log(`   Total Trades: ${stats.totalTrades}`);
            console.log(`   Win Rate: ${stats.winRate.toFixed(1)}%`);
            console.log(`   Total PnL: ₹${stats.totalPnL.toFixed(2)}`);
            console.log(`   Daily PnL: ₹${stats.dailyPnL.toFixed(2)}`);
            console.log(`   Active Positions: ${positions.length}`);

            if (positions.length > 0) {
                console.log('\n📋 Active Positions:');
                positions.forEach((position, index) => {
                    const pnlColor = (position.unrealizedPnL || 0) >= 0 ? '🟢' : '🔴';
                    console.log(`   ${index + 1}. ${position.symbol} ${position.side} - PnL: ₹${(position.unrealizedPnL || 0).toFixed(2)} ${pnlColor}`);
                });
            }

            console.log('─'.repeat(50));

        } catch (error) {
            logger.error('Monitoring error:', error);
        }
    }, 10000); // Update every 10 seconds

    // Stop monitoring after 30 minutes (for example)
    setTimeout(() => {
        clearInterval(monitoringInterval);
        console.log('\n⏰ Monitoring period ended');
    }, 30 * 60 * 1000);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down gracefully...');
        clearInterval(monitoringInterval);
        process.exit(0);
    });
}

// Helper function to display real-time trading dashboard
function displayTradingDashboard(tradingService: AutomatedTradingService): void {
    setInterval(async () => {
        // Clear console
        console.clear();

        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║                 AUTOMATED TRADING DASHBOARD             ║');
        console.log('╠══════════════════════════════════════════════════════════╣');

        const stats = await tradingService.getTradingStats();
        const positions = tradingService.getActivePositions();
        const strategies = tradingService.getActiveStrategies();

        console.log(`║ Status: ${tradingService.isRunning() ? '🟢 RUNNING' : '🔴 STOPPED'}                                  ║`);
        console.log(`║ Active Strategies: ${strategies.length}                                   ║`);
        console.log(`║ Active Positions: ${positions.length}                                    ║`);
        console.log(`║ Total Trades: ${stats.totalTrades}                                       ║`);
        console.log(`║ Win Rate: ${stats.winRate.toFixed(1)}%                                   ║`);
        console.log(`║ Total PnL: ₹${stats.totalPnL.toFixed(2)}                             ║`);
        console.log(`║ Daily PnL: ₹${stats.dailyPnL.toFixed(2)}                             ║`);
        console.log('╚══════════════════════════════════════════════════════════╝');

        if (positions.length > 0) {
            console.log('\n📊 Active Positions:');
            positions.forEach((position, index) => {
                const pnlColor = (position.unrealizedPnL || 0) >= 0 ? '🟢' : '🔴';
                console.log(`${index + 1}. ${position.symbol} ${position.side} | Entry: ₹${position.entryPrice} | Current: ₹${position.currentPrice} | PnL: ₹${(position.unrealizedPnL || 0).toFixed(2)} ${pnlColor}`);
            });
        }

        console.log('\n🔄 Last updated:', new Date().toLocaleTimeString());
        console.log('Press Ctrl+C to stop trading');

    }, 5000); // Update every 5 seconds
}

// Main execution
async function main(): Promise<void> {
    try {
        await runAutomatedTradingExample();
    } catch (error) {
        console.error('❌ Main execution failed:', error);
        process.exit(1);
    }
}

// Export for use in other files
export { runAutomatedTradingExample, setupEventHandlers, addTradingStrategies };

// Run if this file is executed directly
if (require.main === module) {
    main();
} 