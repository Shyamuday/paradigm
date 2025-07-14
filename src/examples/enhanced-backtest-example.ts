import { EnhancedBacktestService } from '../services/enhanced-backtest.service';
import { logger } from '../logger/logger';

async function runEnhancedBacktestExample() {
    try {
        logger.info('Starting Enhanced Backtest Example');

        const backtestService = new EnhancedBacktestService();

        // Configuration for comprehensive backtest
        const backtestConfig = {
            startDate: new Date('2023-01-01'),
            endDate: new Date('2023-12-31'),
            initialCapital: 100000, // ₹1,00,000
            symbols: ['RELIANCE', 'TCS', 'INFY', 'SBIN', 'HDFCBANK'],
            strategyId: 'strategy_001', // Ensure this strategy exists in your database
            includeFees: true,
            timeframe: '1day',
            riskParameters: {
                maxPositionSize: 0.2, // 20% max position size
                stopLoss: 0.05, // 5% stop loss
                takeProfit: 0.15, // 15% take profit
                maxDrawdown: 0.1 // 10% max drawdown
            },
            optionsConfig: {
                enableOptions: true,
                maxExposure: 0.3, // 30% max options exposure
                greeksLimits: {
                    maxDelta: 0.8,
                    maxGamma: 0.1,
                    maxTheta: -0.05,
                    maxVega: 0.3
                }
            }
        };

        logger.info('Running enhanced backtest with configuration:', backtestConfig);

        // Run the backtest
        const results = await backtestService.runBacktest(backtestConfig);

        // Display comprehensive results
        console.log('\n=== ENHANCED BACKTEST RESULTS ===');
        console.log(`Strategy: ${results.strategyId}`);
        console.log(`Period: ${results.startDate.toISOString().split('T')[0]} to ${results.endDate.toISOString().split('T')[0]}`);
        console.log(`Initial Capital: ₹${results.initialCapital.toLocaleString()}`);
        console.log(`Final Capital: ₹${results.finalCapital.toLocaleString()}`);
        console.log(`Total Return: ${(results.totalReturn * 100).toFixed(2)}%`);
        console.log(`Annualized Return: ${(results.annualizedReturn * 100).toFixed(2)}%`);
        console.log(`Max Drawdown: ${(results.maxDrawdown * 100).toFixed(2)}%`);
        console.log(`Volatility: ${(results.volatility * 100).toFixed(2)}%`);
        console.log(`Sharpe Ratio: ${results.sharpeRatio.toFixed(2)}`);
        console.log(`Sortino Ratio: ${results.sortinoRatio.toFixed(2)}`);

        // Trade Statistics
        console.log('\n=== TRADE STATISTICS ===');
        console.log(`Total Trades: ${results.totalTrades}`);
        console.log(`Winning Trades: ${results.winningTrades}`);
        console.log(`Losing Trades: ${results.losingTrades}`);
        console.log(`Win Rate: ${(results.winRate * 100).toFixed(2)}%`);
        console.log(`Average Win: ₹${results.avgWin.toFixed(2)}`);
        console.log(`Average Loss: ₹${results.avgLoss.toFixed(2)}`);
        console.log(`Profit Factor: ${results.profitFactor.toFixed(2)}`);

        // Options-specific Statistics
        console.log('\n=== OPTIONS STATISTICS ===');
        console.log(`Total Options Trades: ${results.totalOptionsTrades}`);
        console.log(`Options Win Rate: ${(results.optionsWinRate * 100).toFixed(2)}%`);
        console.log(`Average Options P&L: ₹${results.averageOptionsPnL.toFixed(2)}`);

        // Greeks Exposure
        console.log('\n=== GREEKS EXPOSURE ===');
        console.log(`Average Delta: ${results.greeksExposure.avgDelta.toFixed(3)}`);
        console.log(`Average Gamma: ${results.greeksExposure.avgGamma.toFixed(3)}`);
        console.log(`Average Theta: ${results.greeksExposure.avgTheta.toFixed(3)}`);
        console.log(`Average Vega: ${results.greeksExposure.avgVega.toFixed(3)}`);

        // Risk Metrics
        console.log('\n=== RISK METRICS ===');
        console.log(`VaR (95%): ${(results.riskMetrics.var95 * 100).toFixed(2)}%`);
        console.log(`CVaR (95%): ${(results.riskMetrics.cvar95 * 100).toFixed(2)}%`);
        console.log(`Beta: ${results.riskMetrics.beta.toFixed(2)}`);
        console.log(`Alpha: ${(results.riskMetrics.alpha * 100).toFixed(2)}%`);
        console.log(`Information Ratio: ${results.riskMetrics.informationRatio.toFixed(2)}`);
        console.log(`Calmar Ratio: ${results.riskMetrics.calmarRatio.toFixed(2)}`);
        console.log(`Correlation to Market: ${(results.riskMetrics.correlationToMarket * 100).toFixed(2)}%`);

        // Display top 10 trades by P&L
        console.log('\n=== TOP 10 TRADES BY P&L ===');
        const topTrades = results.trades
            .sort((a, b) => b.pnl - a.pnl)
            .slice(0, 10);

        topTrades.forEach((trade, index) => {
            console.log(`${index + 1}. ${trade.symbol} (${trade.instrumentType})`);
            console.log(`   Entry: ${trade.entryDate.toISOString().split('T')[0]} @ ₹${trade.entryPrice.toFixed(2)}`);
            console.log(`   Exit: ${trade.exitDate.toISOString().split('T')[0]} @ ₹${trade.exitPrice.toFixed(2)}`);
            console.log(`   P&L: ₹${trade.pnl.toFixed(2)} | Qty: ${trade.quantity}`);
            if (trade.instrumentType === 'OPTION') {
                console.log(`   Strike: ₹${trade.strikePrice} | Type: ${trade.optionType} | Expiry: ${trade.expiryDate?.toISOString().split('T')[0]}`);
            }
            console.log(`   Technical: ADX=${trade.technicalSignals.adx.toFixed(1)}, RSI=${trade.technicalSignals.rsi.toFixed(1)}`);
            console.log('');
        });

        // Display monthly returns
        console.log('\n=== MONTHLY RETURNS ===');
        results.monthlyReturns.forEach(month => {
            console.log(`${month.month}: ${(month.return * 100).toFixed(2)}%`);
        });

        // Display trade recommendations
        console.log('\n=== TRADE RECOMMENDATIONS ===');
        if (results.recommendations.length > 0) {
            results.recommendations.forEach((rec, index) => {
                console.log(`${index + 1}. ${rec.symbol} - ${rec.action} (${rec.instrumentType})`);
                console.log(`   Confidence: ${rec.confidence}%`);
                console.log(`   Trend: ${rec.technicalAnalysis.trend} | Momentum: ${rec.technicalAnalysis.momentum}`);
                console.log(`   Position Size: ${(rec.positionSize * 100).toFixed(1)}%`);
                console.log(`   Stop Loss: ₹${rec.riskReward.stopLoss.toFixed(2)} | Take Profit: ₹${rec.riskReward.takeProfit.toFixed(2)}`);
                console.log(`   Risk/Reward: 1:${rec.riskReward.riskRewardRatio.toFixed(1)}`);
                console.log(`   Reasoning: ${rec.reasoning}`);
                console.log('');
            });
        } else {
            console.log('No trade recommendations generated');
        }

        // Save results to database
        logger.info('Saving backtest results to database...');
        const savedResult = await backtestService.saveBacktestResult(results);
        console.log(`\nBacktest results saved with ID: ${savedResult.id}`);

        // Get current trade recommendations for live trading
        console.log('\n=== CURRENT LIVE TRADE RECOMMENDATIONS ===');
        const liveRecommendations = await backtestService.getTradeRecommendations(
            backtestConfig.symbols,
            '1day'
        );

        if (liveRecommendations.length > 0) {
            liveRecommendations.slice(0, 5).forEach((rec, index) => {
                console.log(`${index + 1}. ${rec.symbol} - ${rec.action}`);
                console.log(`   Confidence: ${rec.confidence}%`);
                console.log(`   Entry Price Range: ₹${(rec.riskReward.stopLoss * 1.05).toFixed(2)} - ₹${(rec.riskReward.takeProfit * 0.95).toFixed(2)}`);
                console.log(`   Max Risk: ${(rec.maxRisk * 100).toFixed(1)}% of portfolio`);
                console.log(`   Technical Analysis: ${rec.technicalAnalysis.trend} trend, ${rec.technicalAnalysis.momentum} momentum`);
                console.log('');
            });
        } else {
            console.log('No live trade recommendations available');
        }

        // Performance summary
        console.log('\n=== PERFORMANCE SUMMARY ===');
        const performanceGrade = getPerformanceGrade(results);
        console.log(`Overall Performance Grade: ${performanceGrade}`);
        console.log(`Strategy Effectiveness: ${results.winRate > 0.6 ? 'HIGH' : results.winRate > 0.4 ? 'MEDIUM' : 'LOW'}`);
        console.log(`Risk-Adjusted Returns: ${results.sharpeRatio > 1.5 ? 'EXCELLENT' : results.sharpeRatio > 1.0 ? 'GOOD' : results.sharpeRatio > 0.5 ? 'FAIR' : 'POOR'}`);
        console.log(`Options Strategy Effectiveness: ${results.optionsWinRate > 0.6 ? 'HIGH' : results.optionsWinRate > 0.4 ? 'MEDIUM' : 'LOW'}`);

        // Trading insights
        console.log('\n=== TRADING INSIGHTS ===');
        if (results.totalReturn > 0.15) {
            console.log('✅ Strategy shows strong returns - consider increasing position sizes');
        }
        if (results.sharpeRatio > 1.0) {
            console.log('✅ Good risk-adjusted returns - strategy is well-balanced');
        }
        if (results.maxDrawdown < 0.1) {
            console.log('✅ Low drawdown - capital preservation is good');
        }
        if (results.optionsWinRate > results.winRate) {
            console.log('✅ Options strategies outperforming equity trades');
        }
        if (results.winRate < 0.4) {
            console.log('⚠️  Low win rate - consider refining entry/exit criteria');
        }
        if (results.maxDrawdown > 0.2) {
            console.log('⚠️  High drawdown - consider improving risk management');
        }

        logger.info('Enhanced backtest example completed successfully');

    } catch (error) {
        logger.error('Enhanced backtest example failed:', error);
        throw error;
    }
}

function getPerformanceGrade(results: any): string {
    let score = 0;

    // Return contribution (30%)
    if (results.annualizedReturn > 0.20) score += 30;
    else if (results.annualizedReturn > 0.15) score += 25;
    else if (results.annualizedReturn > 0.10) score += 20;
    else if (results.annualizedReturn > 0.05) score += 10;

    // Sharpe ratio contribution (25%)
    if (results.sharpeRatio > 2.0) score += 25;
    else if (results.sharpeRatio > 1.5) score += 20;
    else if (results.sharpeRatio > 1.0) score += 15;
    else if (results.sharpeRatio > 0.5) score += 10;

    // Win rate contribution (20%)
    if (results.winRate > 0.7) score += 20;
    else if (results.winRate > 0.6) score += 16;
    else if (results.winRate > 0.5) score += 12;
    else if (results.winRate > 0.4) score += 8;

    // Drawdown contribution (15%)
    if (results.maxDrawdown < 0.05) score += 15;
    else if (results.maxDrawdown < 0.10) score += 12;
    else if (results.maxDrawdown < 0.15) score += 8;
    else if (results.maxDrawdown < 0.20) score += 4;

    // Profit factor contribution (10%)
    if (results.profitFactor > 2.0) score += 10;
    else if (results.profitFactor > 1.5) score += 8;
    else if (results.profitFactor > 1.2) score += 6;
    else if (results.profitFactor > 1.0) score += 3;

    // Convert score to grade
    if (score >= 85) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 75) return 'A-';
    if (score >= 70) return 'B+';
    if (score >= 65) return 'B';
    if (score >= 60) return 'B-';
    if (score >= 55) return 'C+';
    if (score >= 50) return 'C';
    if (score >= 45) return 'C-';
    if (score >= 40) return 'D';
    return 'F';
}

// Example of using trade recommendations for live trading decisions
async function demonstrateLiveTradeRecommendations() {
    try {
        logger.info('Demonstrating live trade recommendations');

        const backtestService = new EnhancedBacktestService();

        // Get recommendations for key stocks
        const symbols = ['RELIANCE', 'TCS', 'INFY', 'SBIN', 'HDFCBANK', 'BAJFINANCE', 'ICICIBANK'];
        const recommendations = await backtestService.getTradeRecommendations(symbols, '1day');

        console.log('\n=== LIVE TRADING RECOMMENDATIONS ===');
        console.log(`Generated ${recommendations.length} recommendations\n`);

        // Filter high-confidence recommendations
        const highConfidenceRecs = recommendations.filter(rec => rec.confidence >= 70);

        if (highConfidenceRecs.length > 0) {
            console.log('HIGH CONFIDENCE TRADES (70%+ confidence):');
            highConfidenceRecs.forEach((rec, index) => {
                console.log(`${index + 1}. 🎯 ${rec.symbol} - ${rec.action}`);
                console.log(`   📊 Confidence: ${rec.confidence}%`);
                console.log(`   📈 Technical: ${rec.technicalAnalysis.trend} trend, ${rec.technicalAnalysis.momentum} momentum`);
                console.log(`   💰 Position: ${(rec.positionSize * 100).toFixed(1)}% of portfolio`);
                console.log(`   🛡️ Stop Loss: ₹${rec.riskReward.stopLoss.toFixed(2)}`);
                console.log(`   🎯 Take Profit: ₹${rec.riskReward.takeProfit.toFixed(2)}`);
                console.log(`   📝 Reasoning: ${rec.reasoning}`);
                console.log('');
            });
        }

        // Filter medium-confidence recommendations
        const mediumConfidenceRecs = recommendations.filter(rec => rec.confidence >= 50 && rec.confidence < 70);

        if (mediumConfidenceRecs.length > 0) {
            console.log('MEDIUM CONFIDENCE TRADES (50-69% confidence):');
            mediumConfidenceRecs.slice(0, 3).forEach((rec, index) => {
                console.log(`${index + 1}. ⚖️ ${rec.symbol} - ${rec.action} (${rec.confidence}% confidence)`);
                console.log(`   Consider smaller position size due to lower confidence`);
                console.log('');
            });
        }

        // Provide trading advice
        console.log('TRADING ADVICE:');
        if (highConfidenceRecs.length > 0) {
            console.log('✅ Execute high-confidence trades first');
            console.log('✅ Use proper position sizing and risk management');
            console.log('✅ Set stop-losses and take-profits as recommended');
        }

        if (recommendations.length === 0) {
            console.log('⏳ No strong signals detected - consider waiting for better opportunities');
        }

        console.log('⚠️ Always verify recommendations with your own analysis');
        console.log('⚠️ Never risk more than you can afford to lose');

    } catch (error) {
        logger.error('Failed to demonstrate live trade recommendations:', error);
        throw error;
    }
}

// Run examples
async function main() {
    try {
        await runEnhancedBacktestExample();
        await demonstrateLiveTradeRecommendations();
    } catch (error) {
        logger.error('Example execution failed:', error);
        process.exit(1);
    }
}

// Export for use
export {
    runEnhancedBacktestExample,
    demonstrateLiveTradeRecommendations,
    getPerformanceGrade
};

// Run if called directly
if (require.main === module) {
    main();
} 