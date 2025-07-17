import { AutomatedTradingService, TradingConfig } from '../services/automated-trading.service';
import { logger } from '../logger/logger';

async function runSimpleTradingExample(): Promise<void> {
    console.log('🚀 Simple Trading Example - Starting...');

    try {
        // 1. Create trading service instance
        const tradingService = new AutomatedTradingService();

        // 2. Configure basic trading parameters
        const config: TradingConfig = {
            maxPositions: 3,
            maxRiskPerTrade: 1.5,
            maxDailyLoss: 500,
            maxDrawdown: 5,
            autoExecute: false,          // Start with simulation mode
            simulationMode: true,        // Paper trading first
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

        // 3. Setup event listeners for monitoring
        tradingService.on('signal_generated', (signal) => {
            console.log(`📊 SIGNAL: ${signal.action} ${signal.symbol} at ₹${signal.price}`);
        });

        tradingService.on('order_placed', ({ signal, order }) => {
            console.log(`✅ ORDER: ${order.orderId} placed for ${signal.symbol}`);
        });

        tradingService.on('position_updated', (position) => {
            console.log(`💰 POSITION: ${position.symbol} PnL: ₹${position.unrealizedPnL || 0}`);
        });

        // 4. Initialize and start trading
        await tradingService.initialize(config);
        console.log('✅ Trading service initialized');

        // 5. Add a simple moving average strategy
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

        // 6. Start trading
        await tradingService.startTrading();
        console.log('🟢 Trading started');

        // 7. Run for 30 seconds then stop
        console.log('⏱️ Running for 30 seconds...');
        await new Promise(resolve => setTimeout(resolve, 30000));

        // 8. Stop trading
        await tradingService.stopTrading();
        console.log('🔴 Trading stopped');

        // 9. Show final stats
        const stats = await tradingService.getTradingStats();
        console.log('\n📊 Final Statistics:');
        console.log(`   Signals Generated: ${stats.totalTrades}`);
        console.log(`   Active Positions: ${stats.currentPositions}`);
        console.log(`   Total PnL: ₹${stats.totalPnL}`);

        console.log('\n✅ Simple trading example completed!');

    } catch (error) {
        console.error('❌ Error:', error);
        logger.error('Trading example failed:', error);
    }
}

// Run the example
if (require.main === module) {
    runSimpleTradingExample();
}

export { runSimpleTradingExample }; 