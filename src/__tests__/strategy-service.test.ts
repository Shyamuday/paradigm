import { StrategyService } from '../services/strategy.service';
import { ConfigManager } from '../config/config-manager';
import { MarketData } from '../services/strategies/strategy.interface';

describe('StrategyService', () => {
    let configManager: ConfigManager;
    let strategyService: StrategyService;

    beforeEach(async () => {
        configManager = new ConfigManager();
        await configManager.loadConfig();
        strategyService = new StrategyService(configManager);
    });

    it('should execute all enabled strategies', async () => {
        const marketData: MarketData[] = [
            { symbol: 'TEST', timestamp: new Date(), open: 100, close: 100, high: 100, low: 100, volume: 1000 },
            { symbol: 'TEST', timestamp: new Date(), open: 100, close: 101, high: 101, low: 101, volume: 1000 },
            { symbol: 'TEST', timestamp: new Date(), open: 101, close: 102, high: 102, low: 102, volume: 1000 },
            { symbol: 'TEST', timestamp: new Date(), open: 102, close: 98, high: 98, low: 98, volume: 1000 },
            { symbol: 'TEST', timestamp: new Date(), open: 98, close: 108, high: 108, low: 108, volume: 1000 },
        ];
        const results = await strategyService.executeAllStrategies(marketData);
        expect(results).toHaveLength(1);
        expect(results[0]?.success).toBe(true);
        expect(results[0]?.signals).toHaveLength(1);
    });
});