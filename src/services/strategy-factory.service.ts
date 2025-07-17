import { IStrategy } from './strategies/strategy.interface';
import { MovingAverageStrategy } from './strategies/moving-average-strategy';
import { RsiStrategy } from './strategies/rsi-strategy';
import { logger } from '../logger/logger';

export class StrategyFactory {
    private static strategies: { [key: string]: new () => IStrategy } = {
        moving_average: MovingAverageStrategy,
        rsi: RsiStrategy,
    };

    static async createStrategy(name: string, config: any): Promise<IStrategy | null> {
        const StrategyClass = this.strategies[name];
        if (!StrategyClass) {
            logger.error(`Strategy '${name}' not found.`);
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
    }
}