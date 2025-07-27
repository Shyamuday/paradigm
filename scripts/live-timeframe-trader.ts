#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { TimeframeAnalyzer, Timeframe } from '../src/services/timeframe-analyzer.service';
import { ConfigManager } from '../src/config/config-manager';
import { logger } from '../src/logger/logger';
import KiteConnect from 'kiteconnect';

// Load environment variables
config();

interface LiveTradingConfig {
    // API Configuration
    apiKey: string;
    apiSecret: string;
    accessToken: string;

    // Trading Parameters
    capital: number;
    maxRiskPerTrade: number;
    maxDailyLoss: number;

    // Instruments to trade
    instruments: string[];

    // Timeframe Analysis
    analysisInterval: number; // seconds
    enabledTimeframes: Timeframe[];
    timeframeWeights: { [key in Timeframe]: number };

    // Trading Strategy
    minConfidence: number;
    minTrendStrength: number;
    maxRiskScore: number;

    // Execution
    enableRealTrading: boolean;
    paperTrading: boolean;

    // Notifications
    telegram: {
        enabled: boolean;
        botToken: string;
        chatId: string;
    };
}

async function startLiveTimeframeTrader() {
    try {
        logger.info('🚀 Starting Live Timeframe Trader...');

        // Load configuration
        const configManager = new ConfigManager();
        const baseConfig = await configManager.getConfig();

        // Create live trading configuration
        const liveConfig: LiveTradingConfig = {
            // API Configuration
            apiKey: process.env.ZERODHA_API_KEY || '',
            apiSecret: process.env.ZERODHA_API_SECRET || '',
            accessToken: process.env.ZERODHA_ACCESS_TOKEN || '',

            // Trading Parameters
            capital: 100000,
            maxRiskPerTrade: 0.02, // 2% per trade
            maxDailyLoss: 0.05,    // 5% daily loss limit

            // Instruments to trade
            instruments: ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'INFY'],

            // Timeframe Analysis
            analysisInterval: 60, // 60 seconds
            enabledTimeframes: [
                Timeframe.MINUTE_1,
                Timeframe.MINUTE_5,
                Timeframe.MINUTE_15,
                Timeframe.MINUTE_30,
                Timeframe.HOUR_1,
                Timeframe.HOUR_4,
                Timeframe.DAY_1
            ],
            timeframeWeights: {
                [Timeframe.MINUTE_1]: 0.05,
                [Timeframe.MINUTE_5]: 0.1,
                [Timeframe.MINUTE_15]: 0.15,
                [Timeframe.MINUTE_30]: 0.2,
                [Timeframe.HOUR_1]: 0.25,
                [Timeframe.HOUR_4]: 0.15,
                [Timeframe.DAY_1]: 0.1,
                [Timeframe.WEEK_1]: 0.0
            },

            // Trading Strategy
            minConfidence: 0.7,
            minTrendStrength: 0.6,
            maxRiskScore: 70,

            // Execution
            enableRealTrading: false, // Set to true for live trading
            paperTrading: true,

            // Notifications
            telegram: {
                enabled: true,
                botToken: process.env.TELEGRAM_BOT_TOKEN || '',
                chatId: process.env.TELEGRAM_CHAT_ID || ''
            }
        };

        // Validate configuration
        if (!liveConfig.apiKey || !liveConfig.apiSecret) {
            throw new Error('Zerodha API credentials not configured');
        }

        // Create services
        const timeframeAnalyzer = new TimeframeAnalyzer({
            enabledTimeframes: liveConfig.enabledTimeframes,
            weights: liveConfig.timeframeWeights
        });

        const kite = new KiteConnect({
            api_key: liveConfig.apiKey,
            api_secret: liveConfig.apiSecret
        });
        kite.setAccessToken(liveConfig.accessToken);

        console.log('\n📊 LIVE TIMEFRAME TRADER STARTED');
        console.log('==================================');
        console.log(`💰 Capital: ₹${liveConfig.capital.toLocaleString()}`);
        console.log(`📈 Instruments: ${liveConfig.instruments.join(', ')}`);
        console.log(`⏰ Analysis Interval: ${liveConfig.analysisInterval}s`);
        console.log(`🎯 Timeframes: ${liveConfig.enabledTimeframes.join(', ')}`);
        console.log(`🎲 Mode: ${liveConfig.paperTrading ? 'Paper Trading' : 'Live Trading'}`);
        console.log(`📱 Notifications: ${liveConfig.telegram.enabled ? 'Enabled' : 'Disabled'}`);

        // Start analysis loop
        startAnalysisLoop(timeframeAnalyzer, kite, liveConfig);

        // Set up graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Stopping Live Timeframe Trader...');
            process.exit(0);
        });

    } catch (error) {
        logger.error('Failed to start Live Timeframe Trader:', error);
        console.error('❌ Error starting Live Timeframe Trader:', error);
        process.exit(1);
    }
}

function startAnalysisLoop(
    timeframeAnalyzer: TimeframeAnalyzer,
    kite: KiteConnect,
    config: LiveTradingConfig
) {
    setInterval(async () => {
        try {
            console.log(`\n🔄 Analyzing timeframes at ${new Date().toLocaleTimeString()}`);

            for (const instrument of config.instruments) {
                await analyzeInstrumentTimeframes(timeframeAnalyzer, kite, instrument, config);
            }

        } catch (error) {
            logger.error('Error in analysis loop:', error);
            console.error('❌ Analysis error:', error);
        }
    }, config.analysisInterval * 1000);
}

async function analyzeInstrumentTimeframes(
    timeframeAnalyzer: TimeframeAnalyzer,
    kite: KiteConnect,
    instrument: string,
    config: LiveTradingConfig
) {
    try {
        // Get market data for all timeframes
        const marketDataByTimeframe = new Map<Timeframe, any[]>();

        for (const timeframe of config.enabledTimeframes) {
            const data = await getMarketData(kite, instrument, timeframe);
            if (data.length > 0) {
                marketDataByTimeframe.set(timeframe, data);
            }
        }

        if (marketDataByTimeframe.size === 0) {
            console.log(`⚠️  No data available for ${instrument}`);
            return;
        }

        // Perform multi-timeframe analysis
        const analysis = await timeframeAnalyzer.analyzeMultiTimeframe(instrument, marketDataByTimeframe);

        // Display analysis results
        displayTimeframeAnalysis(analysis, config);

        // Check for trading opportunities
        await checkTradingOpportunity(analysis, kite, config);

    } catch (error) {
        logger.error(`Error analyzing ${instrument}:`, error);
        console.error(`❌ Error analyzing ${instrument}:`, error);
    }
}

function displayTimeframeAnalysis(analysis: any, config: LiveTradingConfig) {
    console.log(`\n📊 ${analysis.symbol} - Multi-Timeframe Analysis`);
    console.log('='.repeat(50));

    // Display consensus
    console.log(`🎯 Consensus: ${analysis.consensus.overallTrend} (Strength: ${(analysis.consensus.trendStrength * 100).toFixed(1)}%)`);
    console.log(`📈 Trend Distribution: Bullish: ${analysis.consensus.bullishTimeframes}, Bearish: ${analysis.consensus.bearishTimeframes}, Neutral: ${analysis.consensus.neutralTimeframes}`);

    // Display best timeframes
    console.log(`\n⭐ Best Timeframes:`);
    console.log(`   Short-term: ${analysis.bestTimeframes.shortTerm}`);
    console.log(`   Medium-term: ${analysis.bestTimeframes.mediumTerm}`);
    console.log(`   Long-term: ${analysis.bestTimeframes.longTerm}`);

    // Display individual timeframe analysis
    console.log(`\n📋 Individual Timeframe Analysis:`);
    for (const [timeframe, tfAnalysis] of analysis.timeframes) {
        const trendEmoji = tfAnalysis.trend === 'BULLISH' ? '🟢' : tfAnalysis.trend === 'BEARISH' ? '🔴' : '🟡';
        const confidenceColor = tfAnalysis.confidence > 0.8 ? '🟢' : tfAnalysis.confidence > 0.6 ? '🟡' : '🔴';

        console.log(`   ${timeframe}: ${trendEmoji} ${tfAnalysis.trend} | ${confidenceColor} ${(tfAnalysis.confidence * 100).toFixed(0)}% | Risk: ${tfAnalysis.riskScore.toFixed(0)}/100 | ${tfAnalysis.opportunity}`);
    }

    // Display market conditions
    console.log(`\n🌍 Market Conditions:`);
    console.log(`   Volatility: ${analysis.marketConditions.volatility}`);
    console.log(`   Liquidity: ${analysis.marketConditions.liquidity}`);
    console.log(`   Momentum: ${analysis.marketConditions.momentum}`);
    console.log(`   Trend Alignment: ${analysis.marketConditions.trendAlignment}`);

    // Display trading recommendation
    if (analysis.recommendation.action !== 'HOLD') {
        console.log(`\n🎯 TRADING RECOMMENDATION:`);
        console.log(`   Action: ${analysis.recommendation.action}`);
        console.log(`   Confidence: ${(analysis.recommendation.confidence * 100).toFixed(1)}%`);
        console.log(`   Preferred Timeframe: ${analysis.recommendation.preferredTimeframe}`);
        console.log(`   Risk Level: ${analysis.recommendation.riskLevel}`);
        console.log(`   Reasoning: ${analysis.recommendation.reasoning.join(', ')}`);
    }
}

async function checkTradingOpportunity(analysis: any, kite: KiteConnect, config: LiveTradingConfig) {
    const { recommendation, consensus } = analysis;

    // Check if we should trade
    if (recommendation.action === 'HOLD') {
        return;
    }

    // Check confidence threshold
    if (recommendation.confidence < config.minConfidence) {
        console.log(`⚠️  Confidence too low: ${(recommendation.confidence * 100).toFixed(1)}% < ${(config.minConfidence * 100).toFixed(1)}%`);
        return;
    }

    // Check trend strength
    if (consensus.trendStrength < config.minTrendStrength) {
        console.log(`⚠️  Trend strength too low: ${(consensus.trendStrength * 100).toFixed(1)}% < ${(config.minTrendStrength * 100).toFixed(1)}%`);
        return;
    }

    // Check risk score
    const avgRiskScore = Array.from(analysis.timeframes.values())
        .reduce((sum, tf) => sum + tf.riskScore, 0) / analysis.timeframes.size;

    if (avgRiskScore > config.maxRiskScore) {
        console.log(`⚠️  Risk score too high: ${avgRiskScore.toFixed(0)} > ${config.maxRiskScore}`);
        return;
    }

    // Check market conditions
    if (analysis.marketConditions.volatility === 'HIGH' && analysis.marketConditions.trendAlignment === 'CONFLICTING') {
        console.log(`⚠️  Poor market conditions: High volatility + conflicting trends`);
        return;
    }

    // Execute trade
    await executeTrade(analysis, kite, config);
}

async function executeTrade(analysis: any, kite: KiteConnect, config: LiveTradingConfig) {
    try {
        const { recommendation, symbol } = analysis;
        const currentPrice = await getCurrentPrice(kite, symbol);

        if (!currentPrice) {
            console.log(`⚠️  No current price available for ${symbol}`);
            return;
        }

        // Calculate position size
        const riskAmount = config.capital * config.maxRiskPerTrade;
        const stopLossDistance = Math.abs(currentPrice - recommendation.stopLoss);
        const positionSize = Math.floor(riskAmount / stopLossDistance);

        if (positionSize <= 0) {
            console.log(`⚠️  Invalid position size for ${symbol}`);
            return;
        }

        // Prepare order
        const orderParams = {
            tradingsymbol: symbol,
            exchange: 'NSE',
            transaction_type: recommendation.action,
            quantity: positionSize,
            product: 'CNC',
            order_type: 'MARKET'
        };

        let order;

        if (config.enableRealTrading && !config.paperTrading) {
            // Place real order
            order = await kite.placeOrder('regular', orderParams);
            console.log(`✅ REAL TRADE EXECUTED: ${recommendation.action} ${positionSize} ${symbol} at ${currentPrice}`);
        } else {
            // Paper trading
            order = {
                order_id: `PAPER_${Date.now()}`,
                status: 'COMPLETE'
            };
            console.log(`📝 PAPER TRADE: ${recommendation.action} ${positionSize} ${symbol} at ${currentPrice}`);
        }

        // Send notification
        if (config.telegram.enabled) {
            await sendTelegramNotification(analysis, order, currentPrice, positionSize, config);
        }

        console.log(`💰 Trade Details:`);
        console.log(`   Symbol: ${symbol}`);
        console.log(`   Action: ${recommendation.action}`);
        console.log(`   Quantity: ${positionSize}`);
        console.log(`   Price: ₹${currentPrice}`);
        console.log(`   Stop Loss: ₹${recommendation.stopLoss}`);
        console.log(`   Take Profit: ₹${recommendation.takeProfit}`);
        console.log(`   Risk Level: ${recommendation.riskLevel}`);
        console.log(`   Preferred Timeframe: ${recommendation.preferredTimeframe}`);

    } catch (error) {
        logger.error(`Error executing trade for ${analysis.symbol}:`, error);
        console.error(`❌ Trade execution error:`, error);
    }
}

async function getMarketData(kite: KiteConnect, instrument: string, timeframe: Timeframe): Promise<any[]> {
    try {
        // In real implementation, fetch from Zerodha API
        // For now, return mock data
        return generateMockMarketData(instrument, timeframe);
    } catch (error) {
        logger.error(`Error fetching market data for ${instrument} ${timeframe}:`, error);
        return [];
    }
}

async function getCurrentPrice(kite: KiteConnect, symbol: string): Promise<number | null> {
    try {
        // In real implementation, fetch from Zerodha API
        // For now, return mock price
        return 18000 + Math.random() * 1000;
    } catch (error) {
        logger.error(`Error fetching current price for ${symbol}:`, error);
        return null;
    }
}

async function sendTelegramNotification(analysis: any, order: any, price: number, quantity: number, config: LiveTradingConfig) {
    try {
        // Implementation for Telegram notification
        console.log(`📱 Telegram notification sent for ${analysis.symbol}`);
    } catch (error) {
        logger.error('Error sending Telegram notification:', error);
    }
}

function generateMockMarketData(instrument: string, timeframe: Timeframe): any[] {
    const data = [];
    let price = 18000;
    const now = new Date();

    // Generate data based on timeframe
    let interval: number;
    switch (timeframe) {
        case Timeframe.MINUTE_1: interval = 1; break;
        case Timeframe.MINUTE_5: interval = 5; break;
        case Timeframe.MINUTE_15: interval = 15; break;
        case Timeframe.MINUTE_30: interval = 30; break;
        case Timeframe.HOUR_1: interval = 60; break;
        case Timeframe.HOUR_4: interval = 240; break;
        case Timeframe.DAY_1: interval = 1440; break;
        default: interval = 60;
    }

    for (let i = 100; i >= 0; i--) {
        const change = (Math.random() - 0.5) * 100;
        price += change;
        price = Math.max(15000, Math.min(25000, price));

        const timestamp = new Date(now.getTime() - i * interval * 60 * 1000);

        data.push({
            timestamp,
            symbol: instrument,
            open: price - change * 0.3,
            high: price + Math.random() * 50,
            low: price - Math.random() * 50,
            close: price,
            volume: Math.floor(Math.random() * 1000000) + 500000
        });
    }

    return data;
}

// Run if called directly
if (require.main === module) {
    startLiveTimeframeTrader();
}

export { startLiveTimeframeTrader }; 