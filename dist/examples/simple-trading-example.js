"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSimpleTradingExample = runSimpleTradingExample;
const automated_trading_service_1 = require("../services/automated-trading.service");
const logger_1 = require("../logger/logger");
async function runSimpleTradingExample() {
    console.log('🚀 Simple Trading Example - Starting...');
    try {
        const tradingService = new automated_trading_service_1.AutomatedTradingService();
        const config = {
            maxPositions: 3,
            maxRiskPerTrade: 1.5,
            maxDailyLoss: 500,
            maxDrawdown: 5,
            autoExecute: false,
            simulationMode: true,
            allowedSymbols: ['RELIANCE', 'TCS', 'INFY'],
            tradingHours: {
                start: '09:15',
                end: '15:30'
            },
            riskManagement: {
                stopLoss: {
                    type: 'PERCENTAGE',
                    value: 2,
                    percentage: 2
                },
                takeProfit: {
                    type: 'PERCENTAGE',
                    value: 4,
                    percentage: 4
                },
                maxDrawdown: 5,
                maxDailyLoss: 500,
                maxOpenPositions: 3
            }
        };
        tradingService.on('signal_generated', (signal) => {
            console.log(`📊 SIGNAL: ${signal.action} ${signal.symbol} at ₹${signal.price}`);
        });
        tradingService.on('order_placed', ({ signal, order }) => {
            console.log(`✅ ORDER: ${order.orderId} placed for ${signal.symbol}`);
        });
        tradingService.on('position_updated', (position) => {
            console.log(`💰 POSITION: ${position.symbol} PnL: ₹${position.unrealizedPnL || 0}`);
        });
        await tradingService.initialize(config);
        console.log('✅ Trading service initialized');
        await tradingService.addStrategy({
            name: 'Simple_MA_Strategy',
            type: 'TREND_FOLLOWING',
            enabled: true,
            version: '1.0.0',
            category: 'TECHNICAL_ANALYSIS',
            riskLevel: 'MEDIUM',
            capitalAllocation: 100,
            instruments: ['RELIANCE', 'TCS'],
            timeframes: ['5m'],
            parameters: {
                shortPeriod: 10,
                longPeriod: 20
            },
            entryRules: [],
            exitRules: [],
            filters: [],
            notifications: [],
            riskManagement: {
                stopLoss: {
                    type: 'PERCENTAGE',
                    value: 2,
                    percentage: 2
                },
                takeProfit: {
                    type: 'PERCENTAGE',
                    value: 4,
                    percentage: 4
                },
                maxDrawdown: 5,
                maxDailyLoss: 500,
                maxOpenPositions: 1
            },
            positionSizing: { method: 'FIXED_AMOUNT', fixedAmount: 1 }
        });
        console.log('✅ Strategy added');
        await tradingService.startTrading();
        console.log('🟢 Trading started');
        console.log('⏱️ Running for 30 seconds...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        await tradingService.stopTrading();
        console.log('🔴 Trading stopped');
        const stats = await tradingService.getTradingStats();
        console.log('\n📊 Final Statistics:');
        console.log(`   Signals Generated: ${stats.totalTrades}`);
        console.log(`   Active Positions: ${stats.currentPositions}`);
        console.log(`   Total PnL: ₹${stats.totalPnL}`);
        console.log('\n✅ Simple trading example completed!');
    }
    catch (error) {
        console.error('❌ Error:', error);
        logger_1.logger.error('Trading example failed:', error);
    }
}
if (require.main === module) {
    runSimpleTradingExample();
}
//# sourceMappingURL=simple-trading-example.js.map