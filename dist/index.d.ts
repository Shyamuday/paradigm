import 'reflect-metadata';
declare class TradingBot {
    private configManager;
    private databaseManager;
    private authManager?;
    private userService;
    private marketDataService;
    private orderService;
    private strategyService;
    private currentSessionId?;
    private isRunning;
    constructor();
    initialize(): Promise<void>;
    private initializeAuthentication;
    private initializeMarketData;
    private initializeStrategies;
    private initializeUserSession;
    start(): Promise<void>;
    private startTradingLoop;
    private executeTradingCycle;
    private getMarketData;
    private processSignal;
    private updateOpenPositions;
    private calculateUnrealizedPnL;
    stop(): Promise<void>;
    getStatus(): Promise<any>;
}
export default TradingBot;
//# sourceMappingURL=index.d.ts.map