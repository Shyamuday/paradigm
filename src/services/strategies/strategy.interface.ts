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

    /**
     * Initializes the strategy with a given configuration.
     * @param config - The strategy-specific configuration.
     */
    initialize(config: any): Promise<void>;

    /**
     * Generates trade signals based on the provided market data.
     * @param marketData - An array of market data points.
     * @returns A promise that resolves to an array of trade signals.
     */
    generateSignals(marketData: MarketData[]): Promise<TradeSignal[]>;
}