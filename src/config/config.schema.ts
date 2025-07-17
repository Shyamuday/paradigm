import { z } from 'zod';

// Schema for trading configuration
const TradingConfigSchema = z.object({
    mode: z.enum(['paper', 'live', 'backtest']),
    capital: z.number().positive(),
    maxDailyLoss: z.number().positive(),
    maxPositionSize: z.number().min(0).max(1),
    maxOpenPositions: z.number().int().positive(),
});

// Schema for market data configuration
const MarketDataConfigSchema = z.object({
    websocketUrl: z.string().url(),
    historicalDays: z.number().int().positive(),
    instruments: z.array(z.object({
        symbol: z.string(),
        exchange: z.string(),
        instrumentType: z.string(),
    })),
});

// Schema for risk management configuration
const RiskConfigSchema = z.object({
    maxDailyLoss: z.number().positive(),
    maxPositionSize: z.number().min(0).max(1),
    maxOpenPositions: z.number().int().positive(),
    defaultStopLossPercentage: z.number().positive(),
    trailingStopLoss: z.boolean(),
    maxRiskPerTrade: z.number().min(0).max(1),
    maxPortfolioRisk: z.number().min(0).max(1),
});

// Schema for schedule configuration
const ScheduleConfigSchema = z.object({
    startTime: z.string(),
    endTime: z.string(),
    timezone: z.string(),
    preMarketStart: z.string(),
    postMarketEnd: z.string(),
});

// Schema for strategy configuration
const StrategyConfigSchema = z.object({
    name: z.string(),
    enabled: z.boolean(),
    description: z.string(),
    parameters: z.record(z.string(), z.any()),
    capitalAllocation: z.number().min(0).max(1),
    instruments: z.array(z.string()),
});

// Schema for logging configuration
export const LoggingConfigSchema = z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    filePath: z.string(),
    maxFileSize: z.string(),
    maxFiles: z.number().int().positive(),
});
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

// Schema for database configuration
const DatabaseConfigSchema = z.object({
    url: z.string().url(),
    poolSize: z.number().int().positive(),
    timeout: z.number().int().positive(),
});

// Schema for dashboard configuration
const DashboardConfigSchema = z.object({
    enabled: z.boolean(),
    port: z.number().int().positive(),
    corsOrigin: z.string(),
});

// Main bot configuration schema
export const BotConfigSchema = z.object({
    trading: TradingConfigSchema,
    marketData: MarketDataConfigSchema,
    risk: RiskConfigSchema,
    schedule: ScheduleConfigSchema,
    strategies: z.record(z.string(), StrategyConfigSchema),
    logging: LoggingConfigSchema,
    database: DatabaseConfigSchema,
    dashboard: DashboardConfigSchema,
});

export type BotConfig = z.infer<typeof BotConfigSchema>;