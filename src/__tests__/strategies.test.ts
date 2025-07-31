import { MovingAverageStrategy } from '../services/strategies/moving-average-strategy';
import { RsiStrategy } from '../services/strategies/rsi-strategy';
import { MarketData } from '../services/strategies/strategy.interface';

describe('Strategies', () => {
    describe('MovingAverageStrategy', () => {
        it('should generate a BUY signal on a golden cross', async () => {
            const strategy = new MovingAverageStrategy();
            await strategy.initialize({ shortPeriod: 2, longPeriod: 4 });
            const marketData: MarketData[] = [
                { symbol: 'TEST', timestamp: new Date(), close: 100, high: 100, low: 100, volume: 1000 },
                { symbol: 'TEST', timestamp: new Date(), close: 101, high: 101, low: 101, volume: 1000 },
                { symbol: 'TEST', timestamp: new Date(), close: 102, high: 102, low: 102, volume: 1000 },
                { symbol: 'TEST', timestamp: new Date(), close: 98, high: 98, low: 98, volume: 1000 },
                { symbol: 'TEST', timestamp: new Date(), close: 108, high: 108, low: 108, volume: 1000 },
            ];
            const signals = await strategy.generateSignals(marketData);
            expect(signals).toHaveLength(1);
            expect(signals[0]?.action).toBe('BUY');
        });
    });

    describe('RsiStrategy', () => {
        it('should generate a BUY signal when the RSI crosses above the oversold line', async () => {
            const strategy = new RsiStrategy();
            await strategy.initialize({ period: 3, overbought: 70, oversold: 30 });
            const marketData: MarketData[] = [
                { symbol: 'TEST', timestamp: new Date(), close: 100, high: 100, low: 100, volume: 1000 },
                { symbol: 'TEST', timestamp: new Date(), close: 90, high: 90, low: 90, volume: 1000 },
                { symbol: 'TEST', timestamp: new Date(), close: 80, high: 80, low: 80, volume: 1000 },
                { symbol: 'TEST', timestamp: new Date(), close: 70, high: 70, low: 70, volume: 1000 },
                { symbol: 'TEST', timestamp: new Date(), close: 85, high: 85, low: 85, volume: 1000 },
            ];
            const signals = await strategy.generateSignals(marketData);
            expect(signals).toHaveLength(1);
            expect(signals[0]?.action).toBe('BUY');
        });
    });
});