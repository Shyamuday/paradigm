<<<<<<< HEAD
import {
    StrategyConfig,
    TradeSignal,
    MarketData,
    Position,
    StrategyState,
    StrategyPerformance
} from '../../schemas/strategy.schema';

// Re-export types for use in other modules
export type { TradeSignal, MarketData };

export interface IStrategy {
    name: string;
    type: string;
    version: string;
    description?: string;
=======
export interface MarketData {
    symbol: string;
    timestamp: Date;
    close: number;
    high: number;
    low: number;
    volume: number;
}

export interface TradeSignal {
    symbol: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    price: number;
    timestamp: Date;
    strategy: string;
    metadata?: any;
}

export interface IStrategy {
    name: string;
    description: string;
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345

    /**
     * Initializes the strategy with a given configuration.
     * @param config - The strategy-specific configuration.
     */
<<<<<<< HEAD
    initialize(config: StrategyConfig): Promise<void>;

    /**
     * Validates the strategy configuration.
     * @param config - The configuration to validate.
     * @returns True if valid, false otherwise.
     */
    validateConfig(config: StrategyConfig): boolean;
=======
    initialize(config: any): Promise<void>;
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345

    /**
     * Generates trade signals based on the provided market data.
     * @param marketData - An array of market data points.
     * @returns A promise that resolves to an array of trade signals.
     */
    generateSignals(marketData: MarketData[]): Promise<TradeSignal[]>;
<<<<<<< HEAD

    /**
     * Calculates position size based on signal and available capital.
     * @param signal - The trade signal.
     * @param capital - Available capital.
     * @returns The calculated position size.
     */
    calculatePositionSize(signal: TradeSignal, capital: number): number;

    /**
     * Applies risk management rules to a trade signal.
     * @param signal - The trade signal to process.
     * @returns The processed trade signal with risk management applied.
     */
    applyRiskManagement(signal: TradeSignal): TradeSignal;

    /**
     * Determines if a position should be exited based on current market data.
     * @param position - The current position.
     * @param marketData - Current market data.
     * @returns True if position should be exited, false otherwise.
     */
    shouldExit(position: Position, marketData: MarketData[]): Promise<boolean>;

    /**
     * Gets the current state of the strategy.
     * @returns The strategy state.
     */
    getState(): StrategyState;

    /**
     * Gets the performance metrics of the strategy.
     * @returns The strategy performance.
     */
    getPerformance(): StrategyPerformance;

    /**
     * Cleans up resources when the strategy is stopped.
     */
    cleanup(): Promise<void>;
=======
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
}