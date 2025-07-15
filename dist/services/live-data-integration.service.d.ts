export declare class LiveDataIntegrationService {
    private marketDataService;
    private isConnected;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectDelay;
    constructor();
    processLiveTickData(zerodhaTickData: any): Promise<void>;
    processLiveCandleData(zerodhaCandleData: any): Promise<void>;
    getRealTimeMultiTimeframeData(symbol: string): Promise<any>;
    monitorDataQuality(symbol: string): Promise<{
        lastUpdate: Date | null;
        dataGaps: any[];
        latency: number;
    }>;
    startLiveMonitoring(symbols: string[]): Promise<void>;
    stopLiveMonitoring(): Promise<void>;
    getConnectionStatus(): {
        isConnected: boolean;
        reconnectAttempts: number;
    };
}
//# sourceMappingURL=live-data-integration.service.d.ts.map