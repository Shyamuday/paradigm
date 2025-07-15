import { BotConfig } from '../types';
export declare class ConfigManager {
    private config;
    private configPath;
    constructor();
    loadConfig(): Promise<void>;
    getConfig(): BotConfig;
    updateConfig(updates: Partial<BotConfig>): void;
    private getDefaultConfig;
    private mergeConfig;
    private overrideWithEnvVars;
    getTradingConfig(): import("../types").TradingConfig;
    getMarketDataConfig(): import("../types").MarketDataConfig;
    getRiskConfig(): import("../types").RiskConfig;
    getScheduleConfig(): import("../types").ScheduleConfig;
    getStrategiesConfig(): Record<string, import("../types").StrategyConfig>;
    getLoggingConfig(): import("../types").LoggingConfig;
    getDatabaseConfig(): import("../types").DatabaseConfig;
    getDashboardConfig(): import("../types").DashboardConfig;
    getZerodhaCredentials(): {
        apiKey: string;
        apiSecret: string;
        requestToken: string;
    };
}
//# sourceMappingURL=config-manager.d.ts.map