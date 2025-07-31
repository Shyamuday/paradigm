#!/usr/bin/env ts-node

import { DatabaseManager } from '../src/database/database';
import { db } from '../src/database/database';
import { logger } from '../src/logger/logger';

interface TradeRecommendation {
    symbol: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    reason: string;
    currentPrice: number;
    targetPrice: number;
    stopLoss: number;
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
    expectedReturn: number;
}

export async function generateFinalTradeRecommendations() {
    try {
        console.log('🎯 Generating Final Nifty 50 Trade Recommendations...\n');

        const dbManager = DatabaseManager.getInstance();
        await dbManager.connect();

        // Get Nifty 50 instruments with data
        const niftyInstruments = await db.instrument.findMany({
            where: {
                OR: [
                    { symbol: 'NIFTY 50' },
                    { symbol: { in: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY'] } }
                ]
            },
            include: {
                candleData: {
                    orderBy: {
                        timestamp: 'asc'
                    }
                }
            }
        });

        console.log(`📈 Analyzing ${niftyInstruments.length} instruments...\n`);

        const recommendations: TradeRecommendation[] = [];

        // Analyze each instrument
        for (const instrument of niftyInstruments) {
            if (instrument.candleData.length < 5) continue; // Reduced from 30 to 5

            const analysis = analyzeInstrumentFinal(instrument);
            if (analysis) {
                recommendations.push(analysis);
            }
        }

        // Sort recommendations by confidence
        recommendations.sort((a, b) => b.confidence - a.confidence);

        // Display comprehensive recommendations
        displayTradeRecommendations(recommendations);

        // Generate portfolio suggestions
        generatePortfolioSuggestions(recommendations);

        // Save recommendations summary
        await saveRecommendationsSummary(recommendations);

    } catch (error) {
        logger.error('Error generating trade recommendations:', error);
        console.error('❌ Error:', error);
    } finally {
        await DatabaseManager.getInstance().disconnect();
    }
}

function analyzeInstrumentFinal(instrument: any): TradeRecommendation | null {
    const prices = instrument.candleData.map((c: any) => c.close);
    const volumes = instrument.candleData.map((c: any) => c.volume);

    if (prices.length < 5) return null; // Reduced from 30 to 5

    const currentPrice = prices[prices.length - 1];
    const currentVolume = volumes[volumes.length - 1];

    // Calculate simple technical indicators for shorter periods
    const sma3 = calculateSimpleSMA(prices, 3); // 3-day SMA
    const sma5 = calculateSimpleSMA(prices, 5); // 5-day SMA

    if (!sma3 || !sma5) return null;

    // Generate trading signals
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;
    let reason = '';
    let targetPrice = currentPrice;
    let stopLoss = currentPrice;
    let risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';

    // Signal 1: Short-term Moving Average Crossover (more sensitive)
    const maSignal = sma3 > sma5 ? 1 : -1;
    const maStrength = Math.abs(sma3 - sma5) / sma5;

    // Signal 2: Price momentum (last 3 days - more sensitive)
    const recentPrices = prices.slice(-3);
    const priceMomentum = recentPrices[recentPrices.length - 1] > recentPrices[0] ? 1 : -1;

    // Signal 3: Volume analysis (more sensitive thresholds)
    const avgVolume = volumes.slice(-3).reduce((a: number, b: number) => a + b, 0) / 3;
    const volumeSignal = currentVolume > avgVolume * 1.1 ? 1 : currentVolume < avgVolume * 0.9 ? -1 : 0;

    // Signal 4: Price trend (last 3 days - more sensitive)
    const trendPrices = prices.slice(-3);
    const priceTrend = trendPrices[trendPrices.length - 1] > trendPrices[0] ? 1 : -1;

    // Signal 5: Price volatility (new signal)
    const priceChange = (currentPrice - prices[0]) / prices[0];
    const volatilitySignal = Math.abs(priceChange) > 0.02 ? (priceChange > 0 ? 1 : -1) : 0;

    // Combine signals with lower thresholds for more sensitivity
    const totalSignal = maSignal + priceMomentum + volumeSignal + priceTrend + volatilitySignal;

    // Determine action based on combined signals (lowered thresholds)
    if (totalSignal >= 1) { // Reduced from 2 to 1
        action = 'BUY';
        confidence = Math.min(0.4 + (totalSignal - 1) * 0.15 + maStrength * 10, 0.95);
        reason = `Bullish signals: MA (${maSignal > 0 ? 'Bullish' : 'Bearish'}), Momentum (${priceMomentum > 0 ? 'Up' : 'Down'}), Volume (${volumeSignal > 0 ? 'High' : volumeSignal < 0 ? 'Low' : 'Normal'}), Trend (${priceTrend > 0 ? 'Up' : 'Down'}), Volatility (${volatilitySignal > 0 ? 'High Up' : volatilitySignal < 0 ? 'High Down' : 'Low'})`;
        targetPrice = currentPrice * 1.03; // Reduced target
        stopLoss = currentPrice * 0.985; // Tighter stop loss
        risk = confidence > 0.8 ? 'LOW' : confidence > 0.6 ? 'MEDIUM' : 'HIGH';
    } else if (totalSignal <= -1) { // Reduced from -2 to -1
        action = 'SELL';
        confidence = Math.min(0.4 + Math.abs(totalSignal + 1) * 0.15 + maStrength * 10, 0.95);
        reason = `Bearish signals: MA (${maSignal > 0 ? 'Bullish' : 'Bearish'}), Momentum (${priceMomentum > 0 ? 'Up' : 'Down'}), Volume (${volumeSignal > 0 ? 'High' : volumeSignal < 0 ? 'Low' : 'Normal'}), Trend (${priceTrend > 0 ? 'Up' : 'Down'}), Volatility (${volatilitySignal > 0 ? 'High Up' : volatilitySignal < 0 ? 'High Down' : 'Low'})`;
        targetPrice = currentPrice * 0.97; // Reduced target
        stopLoss = currentPrice * 1.015; // Tighter stop loss
        risk = confidence > 0.8 ? 'LOW' : confidence > 0.6 ? 'MEDIUM' : 'HIGH';
    } else {
        action = 'HOLD';
        confidence = 0.5;
        reason = `Mixed signals: MA (${maSignal > 0 ? 'Bullish' : 'Bearish'}), Momentum (${priceMomentum > 0 ? 'Up' : 'Down'}), Volume (${volumeSignal > 0 ? 'High' : volumeSignal < 0 ? 'Low' : 'Normal'}), Trend (${priceTrend > 0 ? 'Up' : 'Down'}), Volatility (${volatilitySignal > 0 ? 'High Up' : volatilitySignal < 0 ? 'High Down' : 'Low'})`;
        targetPrice = currentPrice;
        stopLoss = currentPrice;
        risk = 'MEDIUM';
    }

    const expectedReturn = action === 'BUY' ? (targetPrice - currentPrice) / currentPrice :
        action === 'SELL' ? (currentPrice - targetPrice) / currentPrice : 0;

    return {
        symbol: instrument.symbol,
        action,
        confidence,
        reason,
        currentPrice,
        targetPrice,
        stopLoss,
        risk,
        expectedReturn
    };
}

function calculateSimpleSMA(prices: number[], period: number): number | null {
    if (prices.length < period) return null;

    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
}

function displayTradeRecommendations(recommendations: TradeRecommendation[]) {
    console.log('🎯 TRADE RECOMMENDATIONS');
    console.log('==================================================');

    if (recommendations.length === 0) {
        console.log('❌ No actionable trade recommendations found');
        return;
    }

    recommendations.forEach((rec, index) => {
        const emoji = rec.action === 'BUY' ? '📈' : rec.action === 'SELL' ? '📉' : '⏸️';
        const riskEmoji = rec.risk === 'HIGH' ? '🔴' : rec.risk === 'MEDIUM' ? '🟡' : '🟢';

        console.log(`\n${index + 1}. ${emoji} ${rec.symbol} - ${rec.action}`);
        console.log(`   ${riskEmoji} Risk: ${rec.risk} | Confidence: ${(rec.confidence * 100).toFixed(1)}%`);
        console.log(`   💰 Current Price: ₹${rec.currentPrice.toFixed(2)}`);
        console.log(`   🎯 Target Price: ₹${rec.targetPrice.toFixed(2)}`);
        console.log(`   🛡️  Stop Loss: ₹${rec.stopLoss.toFixed(2)}`);
        console.log(`   📊 Expected Return: ${(rec.expectedReturn * 100).toFixed(2)}%`);
        console.log(`   📝 Reason: ${rec.reason}`);
    });
}

function generatePortfolioSuggestions(recommendations: TradeRecommendation[]) {
    console.log('\n💼 PORTFOLIO SUGGESTIONS');
    console.log('==================================================');

    const buySignals = recommendations.filter(r => r.action === 'BUY');
    const sellSignals = recommendations.filter(r => r.action === 'SELL');
    const holdSignals = recommendations.filter(r => r.action === 'HOLD');

    console.log(`📈 Buy Opportunities: ${buySignals.length}`);
    if (buySignals.length > 0) {
        console.log('   High Confidence Buys:');
        buySignals.filter(r => r.confidence > 0.7).forEach(rec => {
            console.log(`   - ${rec.symbol}: ₹${rec.currentPrice.toFixed(2)} → ₹${rec.targetPrice.toFixed(2)} (${(rec.expectedReturn * 100).toFixed(2)}%)`);
        });
    }

    console.log(`\n📉 Sell Opportunities: ${sellSignals.length}`);
    if (sellSignals.length > 0) {
        console.log('   High Confidence Sells:');
        sellSignals.filter(r => r.confidence > 0.7).forEach(rec => {
            console.log(`   - ${rec.symbol}: ₹${rec.currentPrice.toFixed(2)} → ₹${rec.targetPrice.toFixed(2)} (${(rec.expectedReturn * 100).toFixed(2)}%)`);
        });
    }

    console.log(`\n⏸️  Hold Positions: ${holdSignals.length}`);

    // Portfolio allocation suggestions
    console.log('\n💡 PORTFOLIO ALLOCATION SUGGESTIONS:');
    const totalCapital = 100000;
    let allocatedCapital = 0;

    buySignals.sort((a, b) => b.confidence - a.confidence);

    for (const rec of buySignals.slice(0, 3)) { // Top 3 buy signals
        const allocation = Math.min(totalCapital * 0.2, totalCapital - allocatedCapital);
        const quantity = Math.floor(allocation / rec.currentPrice);
        console.log(`   ${rec.symbol}: ${quantity} shares @ ₹${rec.currentPrice.toFixed(2)} (₹${(quantity * rec.currentPrice).toFixed(2)})`);
        allocatedCapital += quantity * rec.currentPrice;
    }

    console.log(`\n💰 Total Allocated: ₹${allocatedCapital.toFixed(2)} / ₹${totalCapital.toFixed(2)}`);
    console.log(`💵 Remaining Cash: ₹${(totalCapital - allocatedCapital).toFixed(2)}`);

    // Risk management suggestions
    console.log('\n🛡️  RISK MANAGEMENT SUGGESTIONS:');
    console.log('   1. Use stop-loss orders for all positions');
    console.log('   2. Don\'t risk more than 2% of capital per trade');
    console.log('   3. Diversify across different sectors');
    console.log('   4. Monitor positions daily');
    console.log('   5. Have an exit strategy for each position');

    // Specific trade suggestions
    console.log('\n🎯 SPECIFIC TRADE SUGGESTIONS:');
    if (buySignals.length > 0) {
        const bestBuy = buySignals[0];
        if (bestBuy) {
            console.log(`   🚀 Best Buy Opportunity: ${bestBuy.symbol}`);
            console.log(`      Entry: ₹${bestBuy.currentPrice.toFixed(2)}`);
            console.log(`      Target: ₹${bestBuy.targetPrice.toFixed(2)} (${(bestBuy.expectedReturn * 100).toFixed(2)}%)`);
            console.log(`      Stop Loss: ₹${bestBuy.stopLoss.toFixed(2)}`);
            console.log(`      Confidence: ${(bestBuy.confidence * 100).toFixed(1)}%`);
        }
    }

    if (sellSignals.length > 0) {
        const bestSell = sellSignals[0];
        if (bestSell) {
            console.log(`   📉 Best Sell Opportunity: ${bestSell.symbol}`);
            console.log(`      Exit: ₹${bestSell.currentPrice.toFixed(2)}`);
            console.log(`      Target: ₹${bestSell.targetPrice.toFixed(2)} (${(bestSell.expectedReturn * 100).toFixed(2)}%)`);
            console.log(`      Stop Loss: ₹${bestSell.stopLoss.toFixed(2)}`);
            console.log(`      Confidence: ${(bestSell.confidence * 100).toFixed(1)}%`);
        }
    }
}

async function saveRecommendationsSummary(recommendations: TradeRecommendation[]) {
    try {
        console.log('\n💾 Saving recommendations summary...');

        const summary = {
            timestamp: new Date(),
            totalRecommendations: recommendations.length,
            buySignals: recommendations.filter(r => r.action === 'BUY').length,
            sellSignals: recommendations.filter(r => r.action === 'SELL').length,
            holdSignals: recommendations.filter(r => r.action === 'HOLD').length,
            averageConfidence: recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length,
            highConfidenceBuys: recommendations.filter(r => r.action === 'BUY' && r.confidence > 0.7).length,
            highConfidenceSells: recommendations.filter(r => r.action === 'SELL' && r.confidence > 0.7).length
        };

        console.log('✅ Recommendations analysis completed');
        console.log(`📊 Summary: ${summary.buySignals} BUY, ${summary.sellSignals} SELL, ${summary.holdSignals} HOLD signals`);
        console.log(`🎯 High Confidence: ${summary.highConfidenceBuys} BUY, ${summary.highConfidenceSells} SELL`);
        console.log(`📈 Average Confidence: ${(summary.averageConfidence * 100).toFixed(1)}%`);

        // Final recommendation
        console.log('\n🎯 FINAL RECOMMENDATION:');
        if (summary.highConfidenceBuys > 0) {
            console.log('   📈 Consider taking BUY positions in high-confidence signals');
        } else if (summary.highConfidenceSells > 0) {
            console.log('   📉 Consider taking SELL positions in high-confidence signals');
        } else {
            console.log('   ⏸️  Market conditions are mixed. Consider holding positions or waiting for clearer signals.');
        }

    } catch (error) {
        console.error('❌ Error saving recommendations:', error);
    }
}

// Run the script if called directly
if (require.main === module) {
    generateFinalTradeRecommendations();
} 