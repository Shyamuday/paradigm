import { IStrategy, BaseStrategy } from './strategy-engine.service';
import { MovingAverageStrategy } from './strategies/moving-average-strategy';
import { RsiStrategy } from './strategies/rsi-strategy';
import { BreakoutStrategy } from './strategies/breakout-strategy';
import { EnhancedMomentumStrategy } from './strategies/enhanced-momentum-strategy';
import { OptionsStrategy } from './strategies/options-strategy';
import { ADXStrategy } from './strategies/adx-strategy';
import { StrategyConfig } from '../schemas/strategy.schema';
import { logger } from '../logger/logger';

export class StrategyFactory {
    private static strategies: { [key: string]: new () => any } = {
        moving_average: MovingAverageStrategy,
        rsi: RsiStrategy,
        breakout: BreakoutStrategy,
        momentum: EnhancedMomentumStrategy,
        options: OptionsStrategy,
        adx: ADXStrategy,
    };

    static async createStrategy(name: string, config: StrategyConfig): Promise<IStrategy | null> {
        const StrategyClass = this.strategies[name];
        if (!StrategyClass) {
            logger.error(`Strategy '${name}' not found. Available strategies: ${Object.keys(this.strategies).join(', ')}`);
            return null;
        }

        try {
            const strategy = new StrategyClass();
            await strategy.initialize(config);
            return strategy;
        } catch (error) {
            logger.error(`Failed to create strategy '${name}':`, error);
            return null;
        }
    }

    static registerStrategy(name: string, strategyClass: new () => IStrategy): void {
        if (this.strategies[name]) {
            logger.warn(`Strategy '${name}' is already registered. Overwriting.`);
        }
        this.strategies[name] = strategyClass;
        logger.info(`Strategy '${name}' registered successfully.`);
    }

    static getAvailableStrategies(): string[] {
        return Object.keys(this.strategies);
    }

    static getStrategyInfo(name: string): { name: string; description: string; type: string } | null {
        const StrategyClass = this.strategies[name];
        if (!StrategyClass) {
            return null;
        }

        const instance = new StrategyClass();
        return {
            name: instance.name,
            description: instance.description || '',
            type: instance.type
        };
    }
}