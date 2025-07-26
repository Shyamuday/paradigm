#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { ADXStrategy } from '../src/services/strategies/adx-strategy';
import { MarketData } from '../src/schemas/strategy.schema';
import { logger } from '../src/logger/logger';

// Load environment variables
config();

/**
 * Generate mock market data for testing
 */
function generateMockMarketData(symbol: string, periods: number = 50): MarketData[] {
    const data: MarketData[] = [];
    let price = 18000;
    const now = new Date();

    for (let i = periods; i >= 0; i--) {
        // Create trending price movement
        const trend = Math.sin(i * 0.1) * 100; // Oscillating trend
        const noise = (Math.random() - 0.5) * 50; // Random noise
        const change = trend + noise;

        price += change;
        price = Math.max(15000, Math.min(25000, price));

        const timestamp = new Date(now.getTime() - i * 60 * 1000); // 1-minute intervals

        const high = price + Math.random() * 20;
        const low = price - Math.random() * 20;
        const open = price + (Math.random() - 0.5) * 10;
        const close = price;
        const volume = Math.floor(Math.random() * 1000000) + 500000;

        data.push({
            symbol,
            timestamp,
            open,
            high,
            low,
            close,
            volume
        });
    }

    return data.reverse(); // Return in chronological order
}

/**
 * Test ADX Strategy
 */
async function testADXStrategy() {
    try {
        console.log('🧪 Testing ADX Strategy');
        console.log('='.repeat(50));

        // Create ADX strategy instance
        const adxStrategy = new ADXStrategy({
            period: 14,
            threshold: 25,
            diThreshold: 5,
            stopLoss: 2,
            takeProfit: 6,
            maxPositionSize: 100,
            minVolume: 1000000
        });

        console.log('✅ ADX Strategy created with configuration:');
        console.log(`   Period: 14`);
        console.log(`   Threshold: 25`);
        console.log(`   DI Threshold: 5`);
        console.log(`   Stop Loss: 2%`);
        console.log(`   Take Profit: 6%`);

        // Generate mock market data
        const marketData = generateMockMarketData('NIFTY', 100);
        console.log(`\n📊 Generated ${marketData.length} data points`);

        // Test strategy with different data scenarios
        console.log('\n🔍 Testing Strategy Scenarios:');

        // Scenario 1: Strong uptrend
        console.log('\n1️⃣ Strong Uptrend Scenario:');
        const uptrendData = generateMockMarketData('NIFTY', 50).map((d, i) => ({
            ...d,
            close: 18000 + (i * 10) + (Math.random() - 0.5) * 20, // Strong uptrend
            high: 18000 + (i * 10) + Math.random() * 30,
            low: 18000 + (i * 10) - Math.random() * 30,
            volume: Math.floor(Math.random() * 2000000) + 1000000
        }));

        const uptrendSignals = await adxStrategy.generateSignals(uptrendData);
        console.log(`   Signals generated: ${uptrendSignals.length}`);
        if (uptrendSignals.length > 0) {
            const signal = uptrendSignals[0];
            if (signal) {
                console.log(`   Signal: ${signal.action} ${signal.side}`);
                console.log(`   Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
                console.log(`   Reasoning: ${signal.reasoning || 'No reasoning'}`);
            }
        }

        // Scenario 2: Strong downtrend
        console.log('\n2️⃣ Strong Downtrend Scenario:');
        const downtrendData = generateMockMarketData('NIFTY', 50).map((d, i) => ({
            ...d,
            close: 20000 - (i * 10) + (Math.random() - 0.5) * 20, // Strong downtrend
            high: 20000 - (i * 10) + Math.random() * 30,
            low: 20000 - (i * 10) - Math.random() * 30,
            volume: Math.floor(Math.random() * 2000000) + 1000000
        }));

        const downtrendSignals = await adxStrategy.generateSignals(downtrendData);
        console.log(`   Signals generated: ${downtrendSignals.length}`);
        if (downtrendSignals.length > 0) {
            const signal = downtrendSignals[0];
            if (signal) {
                console.log(`   Signal: ${signal.action} ${signal.side}`);
                console.log(`   Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
                console.log(`   Reasoning: ${signal.reasoning || 'No reasoning'}`);
            }
        }

        // Scenario 3: Sideways market
        console.log('\n3️⃣ Sideways Market Scenario:');
        const sidewaysData = generateMockMarketData('NIFTY', 50).map((d, i) => ({
            ...d,
            close: 18500 + Math.sin(i * 0.2) * 100 + (Math.random() - 0.5) * 50, // Sideways
            high: 18500 + Math.sin(i * 0.2) * 100 + Math.random() * 30,
            low: 18500 + Math.sin(i * 0.2) * 100 - Math.random() * 30,
            volume: Math.floor(Math.random() * 500000) + 200000 // Lower volume
        }));

        const sidewaysSignals = await adxStrategy.generateSignals(sidewaysData);
        console.log(`   Signals generated: ${sidewaysSignals.length}`);
        if (sidewaysSignals.length > 0) {
            const signal = sidewaysSignals[0];
            if (signal) {
                console.log(`   Signal: ${signal.action} ${signal.side}`);
                console.log(`   Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
                console.log(`   Reasoning: ${signal.reasoning || 'No reasoning'}`);
            }
        }

        // Test strategy state and performance
        console.log('\n📈 Strategy State and Performance:');
        const state = adxStrategy.getState();
        const performance = adxStrategy.getPerformance();

        console.log(`   State: ${state.isActive ? 'Active' : 'Inactive'}`);
        console.log(`   Total Signals: ${state.totalSignals}`);
        console.log(`   Current P&L: ₹${state.totalPnL.toFixed(2)}`);

        if (state.metadata) {
            console.log(`   ADX: ${state.metadata.adx?.toFixed(2) || 'N/A'}`);
            console.log(`   DI+: ${state.metadata.diPlus?.toFixed(2) || 'N/A'}`);
            console.log(`   DI-: ${state.metadata.diMinus?.toFixed(2) || 'N/A'}`);
            console.log(`   Trend Strength: ${state.metadata.trendStrength || 'N/A'}`);
            console.log(`   Trend Direction: ${state.metadata.trendDirection || 'N/A'}`);
        }

        // Test risk management
        console.log('\n🛡️ Risk Management Test:');
        if (uptrendSignals.length > 0) {
            const originalSignal = uptrendSignals[0];
            if (originalSignal) {
                const riskManagedSignal = adxStrategy.applyRiskManagement(originalSignal);

                console.log(`   Original Quantity: ${originalSignal.quantity}`);
                console.log(`   Risk-Adjusted Quantity: ${riskManagedSignal.quantity}`);
                console.log(`   Stop Loss: ₹${riskManagedSignal.stopLoss?.toFixed(2) || 'N/A'}`);
                console.log(`   Take Profit: ₹${riskManagedSignal.takeProfit?.toFixed(2) || 'N/A'}`);
            }
        }

        // Test position sizing
        console.log('\n💰 Position Sizing Test:');
        const testSignal = {
            id: 'test_signal',
            symbol: 'NIFTY',
            action: 'BUY' as const,
            side: 'LONG' as const,
            quantity: 1,
            price: 18500,
            confidence: 0.8,
            timestamp: new Date(),
            strategyName: 'ADX Strategy'
        };

        const positionSize = adxStrategy.calculatePositionSize(testSignal, 100000);
        console.log(`   Available Capital: ₹100,000`);
        console.log(`   Signal Confidence: 80%`);
        console.log(`   Calculated Position Size: ${positionSize} shares`);

        // Test exit conditions
        console.log('\n🚪 Exit Conditions Test:');
        const testPosition = {
            id: 'test_position',
            sessionId: 'test_session',
            instrumentId: 'NIFTY',
            symbol: 'NIFTY',
            quantity: 100,
            averagePrice: 18500,
            entryPrice: 18500,
            currentPrice: 18500,
            side: 'LONG' as const,
            stopLoss: 18130,
            target: 19610,
            trailingStop: false,
            unrealizedPnL: 0,
            realizedPnL: null,
            openTime: new Date(),
            closeTime: null,
            entryTime: new Date(),
            status: 'OPEN' as const,
            strategyName: 'ADX Strategy'
        };

        const shouldExit = await adxStrategy.shouldExit(testPosition, marketData);
        console.log(`   Should Exit Position: ${shouldExit ? 'Yes' : 'No'}`);

        // Cleanup
        await adxStrategy.cleanup();
        console.log('\n✅ ADX Strategy test completed successfully');

    } catch (error) {
        console.error('❌ Error testing ADX Strategy:', error);
        logger.error('ADX Strategy test failed:', error);
    }
}

// Run if called directly
if (require.main === module) {
    testADXStrategy();
}

export { testADXStrategy }; 