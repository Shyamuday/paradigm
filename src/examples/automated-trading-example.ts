import { AutomatedTradingService, TradingConfig } from '../services/automated-trading.service';
import { logger } from '../logger/logger';
import { MovingAverageStrategy } from '../services/strategies/moving-average-strategy';
import { RSIStrategy } from '../services/strategies/rsi-strategy';
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
                enabled: true,
                stopLossPercentage: 2,          // 2% stop loss
                takeProfitPercentage: 4,        // 4% take profit (1:2 risk-reward)
                maxPositionsPerSymbol: 1,
                maxRiskPerSymbol: 5,
                trailingStopLoss: true,
                trailingStopLossPercentage: 1
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
        console.error('❌ Error:', error);
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
        type: 'TREND_FOLLOWING',
        enabled: true,
        symbols: ['RELIANCE', 'TCS', 'HDFCBANK'],
        timeframe: '5m',
        parameters: {
            shortPeriod: 10,
            longPeriod: 20,
            volumeThreshold: 100000
        },
        entryRules: [],
        exitRules: [],
        riskManagement: {
            enabled: true,
            stopLossPercentage: 1.5,
            takeProfitPercentage: 3
        },
        positionSizing: {
            method: 'RISK_PER_TRADE',
            riskPerTrade: 1.5
        }
    };

    await tradingService.addStrategy(maStrategy);
    console.log('✅ Added Moving Average Crossover Strategy');

    // 2. RSI Mean Reversion Strategy
    const rsiStrategy = {
        name: 'RSI_Mean_Reversion',
        description: 'RSI-based mean reversion strategy',
        type: 'MEAN_REVERSION',
        enabled: true,
        symbols: ['INFY', 'HINDUNILVR', 'ITC'],
        timeframe: '15m',
        parameters: {
            period: 14,
            oversoldThreshold: 30,
            overboughtThreshold: 70,
            volumeThreshold: 50000
        },
        entryRules: [],
        exitRules: [],
        riskManagement: {
            enabled: true,
            stopLossPercentage: 2,
            takeProfitPercentage: 3
        },
        positionSizing: {
            method: 'PERCENTAGE_OF_CAPITAL',
            percentageOfCapital: 5
        }
    };

    await tradingService.addStrategy(rsiStrategy);
    console.log('✅ Added RSI Mean Reversion Strategy');

    // 3. Breakout Strategy
    const breakoutStrategy = {
        name: 'Breakout_Strategy',
        description: 'Support/resistance breakout strategy',
        type: 'BREAKOUT',
        enabled: true,
        symbols: ['SBIN', 'BAJFINANCE', 'MARUTI'],
        timeframe: '30m',
        parameters: {
            lookbackPeriod: 20,
            breakoutThreshold: 0.015,
            volumeMultiplier: 1.5,
            confirmationPeriod: 2
        },
        entryRules: [],
        exitRules: [],
        riskManagement: {
            enabled: true,
            stopLossPercentage: 2.5,
            takeProfitPercentage: 5
        },
        positionSizing: {
            method: 'VOLATILITY_BASED',
            volatilityPeriod: 20
        }
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