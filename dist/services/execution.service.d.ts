interface ExecutionConfig {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    startTime?: Date;
    endTime?: Date;
    maxParticipationRate?: number;
    priceLimit?: number;
}
interface VWAPConfig extends ExecutionConfig {
    lookbackPeriods?: number;
    deviationThreshold?: number;
}
interface TWAPConfig extends ExecutionConfig {
    numIntervals: number;
    randomizeInterval?: boolean;
    intervalVariance?: number;
}
interface PoVConfig extends ExecutionConfig {
    participationRate: number;
    minVolume?: number;
    volumeLookback?: number;
}
export declare class ExecutionService {
    private orderService;
    private marketDataService;
    private activeExecutions;
    private executionInterval;
    constructor();
    executeVWAP(sessionId: string, config: VWAPConfig): Promise<string>;
    executeTWAP(sessionId: string, config: TWAPConfig): Promise<string>;
    executePoV(sessionId: string, config: PoVConfig): Promise<string>;
    private startExecutionLoop;
    private processVWAPExecution;
    private processTWAPExecution;
    private processPoVExecution;
    private placeExecutionOrder;
    private createExecution;
    private completeExecution;
    private calculateVWAP;
    cancelExecution(executionId: string): Promise<void>;
    getExecution(executionId: string): Promise<any>;
    getActiveExecutions(): Promise<any>;
}
export {};
//# sourceMappingURL=execution.service.d.ts.map