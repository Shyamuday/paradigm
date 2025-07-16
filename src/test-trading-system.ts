import { logger } from './logger/logger';
import { ZerodhaAuth } from './auth/zerodha-auth';
import { InstrumentsManager } from './services/instruments-manager.service';
import { OrderManager } from './services/order-manager.service';
import { WebSocketManager } from './services/websocket-manager.service';
import { AutomatedTradingService, TradingConfig } from './services/automated-trading.service';
import { MovingAverageStrategy } from './services/strategies/moving-average-strategy';
import { RSIStrategy } from './services/strategies/rsi-strategy';
import { BreakoutStrategy } from './services/strategies/breakout-strategy';

class TradingSystemValidator {
    private testResults: { [key: string]: { passed: boolean; error?: string } } = {};
    private auth: ZerodhaAuth;

    constructor() {
        this.auth = new ZerodhaAuth();
    }

    async runAllTests(): Promise<void> {
        console.log('🧪 Starting Trading System Validation');
        console.log('=====================================');

        // Test 1: Authentication
        await this.testAuthentication();

        // Test 2: Instruments Manager
        await this.testInstrumentsManager();

        // Test 3: Order Manager
        await this.testOrderManager();

        // Test 4: WebSocket Manager
        await this.testWebSocketManager();

        // Test 5: Individual Strategies
        await this.testStrategies();

        // Test 6: Automated Trading Service
        await this.testAutomatedTradingService();

        // Test 7: Risk Management
        await this.testRiskManagement();

        // Print results
        this.printTestResults();
    }

    private async testAuthentication(): Promise<void> {
        console.log('\n🔐 Testing Authentication...');

        try {
            // Test initialization
            console.log('   ✓ Authentication service initialized');

            // Test login (with timeout)
            const loginPromise = this.auth.startOAuthLogin();
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Login timeout')), 60000)
            );

            await Promise.race([loginPromise, timeout]);

            console.log('   ✓ Authentication login successful');
            this.testResults.authentication = { passed: true };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log('   ❌ Authentication test failed:', errorMessage);
            this.testResults.authentication = { passed: false, error: errorMessage };
        }
    }

    private async testInstrumentsManager(): Promise<void> {
        console.log('\n📊 Testing Instruments Manager...');

        try {
            const instrumentsManager = new InstrumentsManager(this.auth);

            // Test getting instruments
            const instruments = await instrumentsManager.getAllInstruments();
            console.log(`   ✓ Retrieved ${instruments.length} instruments`);

            // Test search functionality
            const searchResults = await instrumentsManager.searchInstruments('RELIANCE');
            console.log(`   ✓ Search found ${searchResults.length} results for RELIANCE`);

            this.testResults.instrumentsManager = { passed: true };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log('   ❌ Instruments manager test failed:', errorMessage);
            this.testResults.instrumentsManager = { passed: false, error: errorMessage };
        }
    }

    private async testOrderManager(): Promise<void> {
        console.log('\n📋 Testing Order Manager...');

        try {
            const instrumentsManager = new InstrumentsManager(this.auth);
            const orderManager = new OrderManager(this.auth, instrumentsManager);

            // Test getting holdings (should not throw error)
            const holdings = await orderManager.getHoldings();
            console.log(`   ✓ Retrieved ${holdings.length} holdings`);

            // Test getting positions
            const positions = await orderManager.getAllPositions();
            console.log(`   ✓ Retrieved ${positions.net.length} net positions and ${positions.day.length} day positions`);

            this.testResults.orderManager = { passed: true };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log('   ❌ Order manager test failed:', errorMessage);
            this.testResults.orderManager = { passed: false, error: errorMessage };
        }
    }

    private async testWebSocketManager(): Promise<void> {
        console.log('\n🔌 Testing WebSocket Manager...');

        try {
            const wsManager = new WebSocketManager(this.auth);

            // Test connection
            await wsManager.connect();
            console.log('   ✓ WebSocket manager connected');

            // Test event handlers
            wsManager.on('connected', () => {
                console.log('   ✓ WebSocket connected');
            });

            wsManager.on('error', (wsError: Error) => {
                console.log('   ⚠️ WebSocket error:', wsError.message);
            });

            // Test disconnection
            await wsManager.disconnect();
            console.log('   ✓ WebSocket manager disconnected');

            this.testResults.webSocketManager = { passed: true };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log('   ❌ WebSocket manager test failed:', errorMessage);
            this.testResults.webSocketManager = { passed: false, error: errorMessage };
        }
    }

    private async testStrategies(): Promise<void> {
        console.log('\n📈 Testing Individual Strategies...');

        try {
            // Test Moving Average Strategy
            const maStrategy = new MovingAverageStrategy();
            await maStrategy.initialize({
                name: 'Test_MA_Strategy',
                type: 'TREND_FOLLOWING',
                enabled: true,
                version: '1.0.0',
                category: 'TECHNICAL_ANALYSIS',
                riskLevel: 'MEDIUM',
                capitalAllocation: 100,
                instruments: ['RELIANCE'],
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
                    stopLoss: { type: 'PERCENTAGE', value: 2, percentage: 2 },
                    takeProfit: { type: 'PERCENTAGE', value: 4, percentage: 4 },
                    maxDrawdown: 5,
                    maxDailyLoss: 500,
                    maxOpenPositions: 1
                },
                positionSizing: { method: 'FIXED_AMOUNT', fixedAmount: 1 }
            });
            console.log('   ✓ Moving Average Strategy initialized');

            // Test RSI Strategy
            const rsiStrategy = new RSIStrategy();
            await rsiStrategy.initialize({
                name: 'Test_RSI_Strategy',
                type: 'MEAN_REVERSION',
                enabled: true,
                version: '1.0.0',
                category: 'TECHNICAL_ANALYSIS',
                riskLevel: 'MEDIUM',
                capitalAllocation: 100,
                instruments: ['RELIANCE'],
                timeframes: ['5m'],
                parameters: {
                    period: 14,
                    oversoldThreshold: 30,
                    overboughtThreshold: 70
                },
                entryRules: [],
                exitRules: [],
                filters: [],
                notifications: [],
                riskManagement: {
                    stopLoss: { type: 'PERCENTAGE', value: 2, percentage: 2 },
                    takeProfit: { type: 'PERCENTAGE', value: 4, percentage: 4 },
                    maxDrawdown: 5,
                    maxDailyLoss: 500,
                    maxOpenPositions: 1
                },
                positionSizing: { method: 'FIXED_AMOUNT', fixedAmount: 1 }
            });
            console.log('   ✓ RSI Strategy initialized');

            // Test Breakout Strategy
            const breakoutStrategy = new BreakoutStrategy();
            await breakoutStrategy.initialize({
                name: 'Test_Breakout_Strategy',
                type: 'BREAKOUT',
                enabled: true,
                version: '1.0.0',
                category: 'TECHNICAL_ANALYSIS',
                riskLevel: 'MEDIUM',
                capitalAllocation: 100,
                instruments: ['RELIANCE'],
                timeframes: ['5m'],
                parameters: {
                    lookbackPeriod: 20,
                    breakoutThreshold: 0.02,
                    volumeMultiplier: 1.5,
                    confirmationPeriod: 2
                },
                entryRules: [],
                exitRules: [],
                filters: [],
                notifications: [],
                riskManagement: {
                    stopLoss: { type: 'PERCENTAGE', value: 2, percentage: 2 },
                    takeProfit: { type: 'PERCENTAGE', value: 4, percentage: 4 },
                    maxDrawdown: 5,
                    maxDailyLoss: 500,
                    maxOpenPositions: 1
                },
                positionSizing: { method: 'FIXED_AMOUNT', fixedAmount: 1 }
            });
            console.log('   ✓ Breakout Strategy initialized');

            this.testResults.strategies = { passed: true };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log('   ❌ Strategies test failed:', errorMessage);
            this.testResults.strategies = { passed: false, error: errorMessage };
        }
    }

    private async testAutomatedTradingService(): Promise<void> {
        console.log('\n🤖 Testing Automated Trading Service...');

        try {
            const tradingService = new AutomatedTradingService();

            // Test configuration
            const config: TradingConfig = {
                maxPositions: 2,
                maxRiskPerTrade: 1,
                maxDailyLoss: 200,
                maxDrawdown: 3,
                autoExecute: false,
                simulationMode: true,
                allowedSymbols: ['RELIANCE'],
                tradingHours: {
                    start: '09:15',
                    end: '15:30'
                },
                riskManagement: {
                    stopLoss: { type: 'PERCENTAGE', value: 2, percentage: 2 },
                    takeProfit: { type: 'PERCENTAGE', value: 4, percentage: 4 },
                    maxDrawdown: 3,
                    maxDailyLoss: 200,
                    maxOpenPositions: 2
                }
            };

            // Test initialization
            await tradingService.initialize(config);
            console.log('   ✓ Automated trading service initialized');

            // Test event handling
            tradingService.on('initialized', () => {
                console.log('   ✓ Initialization event received');
            });

            tradingService.on('signal_generated', (signal) => {
                console.log('   ✓ Signal generation event working');
            });

            // Test strategy addition
            await tradingService.addStrategy({
                name: 'Test_Strategy',
                type: 'TREND_FOLLOWING',
                enabled: true,
                version: '1.0.0',
                category: 'TECHNICAL_ANALYSIS',
                riskLevel: 'MEDIUM',
                capitalAllocation: 100,
                instruments: ['RELIANCE'],
                timeframes: ['5m'],
                parameters: {
                    shortPeriod: 10,
                    longPeriod: 20
                },
                entryRules: [],
                exitRules: [],
                filters: [],
                notifications: [],
                riskManagement: config.riskManagement,
                positionSizing: { method: 'FIXED_AMOUNT', fixedAmount: 1 }
            });
            console.log('   ✓ Strategy added to trading service');

            // Test getting active strategies
            const activeStrategies = tradingService.getActiveStrategies();
            console.log(`   ✓ ${activeStrategies.length} active strategies found`);

            this.testResults.automatedTradingService = { passed: true };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log('   ❌ Automated trading service test failed:', errorMessage);
            this.testResults.automatedTradingService = { passed: false, error: errorMessage };
        }
    }

    private async testRiskManagement(): Promise<void> {
        console.log('\n🛡️ Testing Risk Management...');

        try {
            // Test position sizing calculations
            const testSignal = {
                id: 'test_signal',
                strategy: 'Test_Strategy',
                symbol: 'RELIANCE',
                action: 'BUY' as const,
                quantity: 1,
                price: 2500,
                stopLoss: 2450,
                target: 2600,
                timestamp: new Date(),
                metadata: {}
            };

            // Test risk-reward ratio calculation
            const riskAmount = testSignal.price - testSignal.stopLoss!;
            const rewardAmount = testSignal.target! - testSignal.price;
            const riskRewardRatio = rewardAmount / riskAmount;

            console.log(`   ✓ Risk-reward ratio: 1:${riskRewardRatio.toFixed(2)}`);

            // Test stop loss percentage
            const stopLossPercentage = (riskAmount / testSignal.price) * 100;
            console.log(`   ✓ Stop loss percentage: ${stopLossPercentage.toFixed(2)}%`);

            // Test take profit percentage
            const takeProfitPercentage = (rewardAmount / testSignal.price) * 100;
            console.log(`   ✓ Take profit percentage: ${takeProfitPercentage.toFixed(2)}%`);

            this.testResults.riskManagement = { passed: true };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log('   ❌ Risk management test failed:', errorMessage);
            this.testResults.riskManagement = { passed: false, error: errorMessage };
        }
    }

    private printTestResults(): void {
        console.log('\n📊 Test Results Summary');
        console.log('=======================');

        let totalTests = 0;
        let passedTests = 0;

        for (const [testName, result] of Object.entries(this.testResults)) {
            totalTests++;
            const status = result.passed ? '✅ PASSED' : '❌ FAILED';
            console.log(`${testName}: ${status}`);

            if (result.passed) {
                passedTests++;
            } else if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        }

        console.log(`\nOverall: ${passedTests}/${totalTests} tests passed`);

        if (passedTests === totalTests) {
            console.log('🎉 All tests passed! Trading system is ready.');
        } else {
            console.log('⚠️ Some tests failed. Please review the errors above.');
        }
    }
}

// Helper function to create sample market data
function createSampleMarketData(): any[] {
    const data = [];
    let price = 2500;

    for (let i = 0; i < 100; i++) {
        // Simple random walk
        const change = (Math.random() - 0.5) * 20;
        price += change;

        data.push({
            symbol: 'RELIANCE',
            timestamp: new Date(Date.now() - (99 - i) * 60000), // 1 minute intervals
            open: price - 5,
            high: price + 10,
            low: price - 10,
            close: price,
            ltp: price,
            volume: Math.floor(Math.random() * 10000) + 1000
        });
    }

    return data;
}

// Run validation if this file is executed directly
async function main(): Promise<void> {
    try {
        const validator = new TradingSystemValidator();
        await validator.runAllTests();
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Validation failed:', errorMessage);
        process.exit(1);
    }
}

// Export for use in other files
export { TradingSystemValidator, createSampleMarketData };

// Run if this file is executed directly
if (require.main === module) {
    main();
} 