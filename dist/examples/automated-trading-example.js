"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAutomatedTradingExample = runAutomatedTradingExample;
exports.setupEventHandlers = setupEventHandlers;
exports.addTradingStrategies = addTradingStrategies;
const automated_trading_service_1 = require("../services/automated-trading.service");
const logger_1 = require("../logger/logger");
async function runAutomatedTradingExample() {
    console.log('🚀 Starting Automated Trading Example');
    console.log('=====================================');
    try {
        const tradingService = new automated_trading_service_1.AutomatedTradingService();
        const tradingConfig = {
            maxPositions: 5,
            maxRiskPerTrade: 2,
            maxDailyLoss: 1000,
            maxDrawdown: 10,
            autoExecute: true,
            simulationMode: false,
            allowedSymbols: [
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
                start: '09:15',
                end: '15:30'
            },
            riskManagement: {
                enabled: true,
                stopLossPercentage: 2,
                takeProfitPercentage: 4,
                maxPositionsPerSymbol: 1,
                maxRiskPerSymbol: 5,
                trailingStopLoss: true,
                trailingStopLossPercentage: 1
            }
        };
        setupEventHandlers(tradingService);
        await tradingService.initialize(tradingConfig);
        await addTradingStrategies(tradingService);
        await tradingService.startTrading();
        await monitorTrading(tradingService);
        await tradingService.stopTrading();
        console.log('\n✅ Automated trading example completed successfully');
    }
    catch (error) {
        logger_1.logger.error('Automated trading example failed:', error);
        console.error('❌ Error:', error);
    }
}
function setupEventHandlers(tradingService) {
    console.log('📡 Setting up event handlers...');
    tradingService.on('initialized', () => {
        console.log('✅ Trading service initialized');
    });
    tradingService.on('trading_started', () => {
        console.log('🟢 Automated trading started');
    });
    tradingService.on('trading_stopped', () => {
        console.log('🔴 Automated trading stopped');
    });
    tradingService.on('signal_generated', (signal) => {
        console.log(`📊 Signal: ${signal.action} ${signal.symbol} at ₹${signal.price}`);
        console.log(`   Strategy: ${signal.strategy}, Quantity: ${signal.quantity}`);
        if (signal.stopLoss)
            console.log(`   Stop Loss: ₹${signal.stopLoss}`);
        if (signal.target)
            console.log(`   Target: ₹${signal.target}`);
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
    tradingService.on('risk_limit_exceeded', ({ type, value }) => {
        console.log(`⚠️ Risk limit exceeded: ${type} - Value: ${value}`);
    });
    tradingService.on('risk_breach', (riskEvent) => {
        console.log(`⚠️ Risk breach: ${riskEvent.type} - ${riskEvent.message}`);
    });
}
async function addTradingStrategies(tradingService) {
    console.log('📈 Adding trading strategies...');
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
async function monitorTrading(tradingService) {
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
        }
        catch (error) {
            logger_1.logger.error('Monitoring error:', error);
        }
    }, 10000);
    setTimeout(() => {
        clearInterval(monitoringInterval);
        console.log('\n⏰ Monitoring period ended');
    }, 30 * 60 * 1000);
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down gracefully...');
        clearInterval(monitoringInterval);
        process.exit(0);
    });
}
function displayTradingDashboard(tradingService) {
    setInterval(async () => {
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
    }, 5000);
}
async function main() {
    try {
        await runAutomatedTradingExample();
    }
    catch (error) {
        console.error('❌ Main execution failed:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=automated-trading-example.js.map