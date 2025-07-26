import { ConfigManager } from '../config/config-manager';
import { EnhancedStrategyService } from '../services/enhanced-strategy.service';
import { MarketData } from '../schemas/strategy.schema';
import { logger } from '../logger/logger';

async function demonstrateEnhancedStrategyService() {
    logger.info('Starting Enhanced Strategy Service Demo');

    try {
        // Initialize config manager
        const configManager = new ConfigManager();
        await configManager.loadConfig();

        // Initialize enhanced strategy service
        const strategyService = new EnhancedStrategyService(configManager);
        await strategyService.initialize();

        // Get available strategies
        const availableStrategies = await strategyService.getAvailableStrategies();
        logger.info('Available strategies:', availableStrategies);

        // Create sample market data
        const sampleMarketData: MarketData[] = [
            {
                symbol: 'NIFTY',
                timestamp: new Date('2024-01-01T09:15:00Z'),
                open: 19000,
                high: 19100,
                low: 18950,
                close: 19050,
                volume: 1000000
            },
            {
                symbol: 'NIFTY',
                timestamp: new Date('2024-01-01T09:16:00Z'),
                open: 19050,
                high: 19150,
                low: 19000,
                close: 19100,
                volume: 1200000
            },
            {
                symbol: 'NIFTY',
                timestamp: new Date('2024-01-01T09:17:00Z'),
                open: 19100,
                high: 19200,
                low: 19050,
                close: 19150,
                volume: 1500000
            }
        ];

        // Execute all strategies
        logger.info('Executing all strategies...');
        const results = await strategyService.executeAllStrategies(sampleMarketData);

        // Display results
        for (const result of results) {
            if (result.success) {
                logger.info(`Strategy execution successful. Generated ${result.signals.length} signals.`);
                for (const signal of result.signals) {
                    logger.info(`Signal: ${signal.action} ${signal.symbol} at ${signal.price}`);
                }
            } else {
                logger.error(`Strategy execution failed: ${result.error}`);
            }
        }

        // Get strategy health
        logger.info('Getting strategy health...');
        const healthChecks = await strategyService.getAllStrategyHealth();
        for (const health of healthChecks) {
            logger.info(`Strategy ${health.strategyName}: Healthy=${health.isHealthy}, Signals=${health.signalCount}, Errors=${health.errorCount}`);
        }

        // Get strategy performance
        for (const strategyName of availableStrategies) {
            const performance = await strategyService.getStrategyPerformance(strategyName);
            if (performance) {
                logger.info(`Strategy ${strategyName} Performance: Win Rate=${performance.winRate.toFixed(2)}%, Total PnL=${performance.totalPnL}`);
            }
        }

        // Demonstrate strategy reload
        logger.info('Demonstrating strategy reload...');
        if (availableStrategies.length > 0) {
            const strategyToReload = availableStrategies[0];
            if (strategyToReload) {
                const reloadSuccess = await strategyService.reloadStrategy(strategyToReload);
                logger.info(`Strategy reload ${reloadSuccess ? 'successful' : 'failed'}: ${strategyToReload}`);
            }
        }

        // Get execution metrics
        logger.info('Getting execution metrics...');
        for (const strategyName of availableStrategies) {
            const metrics = await strategyService.getExecutionMetrics(strategyName, 5);
            if (metrics.length > 0) {
                const latestMetric = metrics[metrics.length - 1];
                if (latestMetric) {
                    logger.info(`Strategy ${strategyName} latest execution: ${latestMetric.executionTime}ms, ${latestMetric.signalsGenerated} signals`);
                }
            }
        }

        logger.info('Enhanced Strategy Service Demo completed successfully');

    } catch (error) {
        logger.error('Enhanced Strategy Service Demo failed:', error);
    }
}

// Example configuration for strategies
export const sampleStrategyConfig = {
    moving_average: {
        name: 'Moving Average Crossover',
        enabled: true,
        type: 'TREND_FOLLOWING',
        version: '1.0.0',
        category: 'TECHNICAL',
        riskLevel: 'MEDIUM',
        description: 'Simple moving average crossover strategy',
        parameters: {
            shortPeriod: 10,
            longPeriod: 20,
            volumeThreshold: 1000
        },
        capitalAllocation: 0.3,
        instruments: ['NIFTY', 'BANKNIFTY'],
        timeframes: ['1D', '1H'],
        entryRules: [],
        exitRules: [],
        positionSizing: {
            method: 'PERCENTAGE',
            value: 10,
            maxPositionSize: 0.2,
            minPositionSize: 0.01,
        },
        riskManagement: {
            maxRiskPerTrade: 0.02,
            maxDailyLoss: 1000,
            maxDrawdown: 0.1,
            stopLossType: 'PERCENTAGE',
            stopLossValue: 2,
            takeProfitType: 'PERCENTAGE',
            takeProfitValue: 4,
            trailingStop: false,
        },
        filters: [],
        notifications: []
    },
    rsi: {
        name: 'RSI Mean Reversion',
        enabled: true,
        type: 'MEAN_REVERSION',
        version: '1.0.0',
        category: 'TECHNICAL',
        riskLevel: 'MEDIUM',
        description: 'RSI-based mean reversion strategy',
        parameters: {
            period: 14,
            overbought: 70,
            oversold: 30
        },
        capitalAllocation: 0.2,
        instruments: ['NIFTY', 'BANKNIFTY'],
        timeframes: ['1D', '4H'],
        entryRules: [],
        exitRules: [],
        positionSizing: {
            method: 'PERCENTAGE',
            value: 8,
            maxPositionSize: 0.15,
            minPositionSize: 0.01,
        },
        riskManagement: {
            maxRiskPerTrade: 0.015,
            maxDailyLoss: 800,
            maxDrawdown: 0.08,
            stopLossType: 'PERCENTAGE',
            stopLossValue: 1.5,
            takeProfitType: 'PERCENTAGE',
            takeProfitValue: 3,
            trailingStop: false,
        },
        filters: [],
        notifications: []
    }
};

// Export the demo function
export { demonstrateEnhancedStrategyService };

// Run the demo if this file is executed directly
if (require.main === module) {
    demonstrateEnhancedStrategyService().catch(console.error);
} 