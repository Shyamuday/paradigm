import { z } from 'zod';

// Strategy types and categories
export const StrategyTypeSchema = z.enum([
  'TREND_FOLLOWING',
  'MEAN_REVERSION',
  'MOMENTUM',
  'BREAKOUT',
  'SCALPING',
  'SWING',
  'OPTIONS',
  'ARBITRAGE',
  'CUSTOM'
]);

export const StrategyCategorySchema = z.enum([
  'TECHNICAL',
  'FUNDAMENTAL',
  'QUANTITATIVE',
  'MACHINE_LEARNING',
  'OPTIONS',
  'MULTI_TIMEFRAME',
  'CUSTOM'
]);

export const RiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']);

export const RuleTypeSchema = z.enum(['ENTRY', 'EXIT', 'FILTER', 'RISK']);

export const RuleConditionSchema = z.enum(['AND', 'OR', 'NOT', 'SINGLE']);

export const IndicatorTypeSchema = z.enum([
  'MOVING_AVERAGE',
  'RSI',
  'MACD',
  'BOLLINGER_BANDS',
  'STOCHASTIC',
  'ATR',
  'VOLUME',
  'CUSTOM'
]);

// Market data schema
export const MarketDataSchema = z.object({
  symbol: z.string().min(1),
  timestamp: z.date(),
  open: z.number().nullable(),
  high: z.number().nullable(),
  low: z.number().nullable(),
  close: z.number().nullable(),
  volume: z.number().nullable(),
  oi: z.number().nullable().optional(),
});

// Trade signal schema
export const TradeSignalSchema = z.object({
  id: z.string().uuid(),
  symbol: z.string().min(1),
  action: z.enum(['BUY', 'SELL', 'HOLD']),
  side: z.enum(['LONG', 'SHORT']),
  quantity: z.number().positive(),
  price: z.number().positive(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  confidence: z.number().min(0).max(100),
  timestamp: z.date(),
  strategyName: z.string().min(1),
  reasoning: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Technical indicator schema
export const TechnicalIndicatorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  type: IndicatorTypeSchema,
  parameters: z.record(z.string(), z.any()),
  timeframe: z.string().min(1),
  isActive: z.boolean(),
});

// Strategy rule schema
export const StrategyRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  type: RuleTypeSchema,
  condition: RuleConditionSchema,
  parameters: z.record(z.string(), z.any()),
  priority: z.number().int().min(1),
  isActive: z.boolean(),
  description: z.string().optional(),
});

// Position sizing configuration schema
export const PositionSizingConfigSchema = z.object({
  method: z.enum(['FIXED', 'PERCENTAGE', 'KELLY', 'VOLATILITY', 'CUSTOM']),
  value: z.number().positive(),
  maxPositionSize: z.number().min(0).max(1),
  minPositionSize: z.number().min(0).max(1),
  customFormula: z.string().optional(),
});

// Risk management configuration schema
export const RiskManagementConfigSchema = z.object({
  maxRiskPerTrade: z.number().min(0).max(1),
  maxDailyLoss: z.number().positive(),
  maxDrawdown: z.number().min(0).max(1),
  stopLossType: z.enum(['FIXED', 'ATR', 'PERCENTAGE', 'TRAILING']),
  stopLossValue: z.number().positive(),
  takeProfitType: z.enum(['FIXED', 'RATIO', 'PERCENTAGE']),
  takeProfitValue: z.number().positive(),
  trailingStop: z.boolean(),
  trailingStopDistance: z.number().positive().optional(),
});

// Strategy filter schema
export const StrategyFilterSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(['TIME', 'VOLUME', 'VOLATILITY', 'TREND', 'CUSTOM']),
  parameters: z.record(z.string(), z.any()),
  isActive: z.boolean(),
});

// Notification configuration schema
export const NotificationConfigSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['EMAIL', 'SMS', 'WEBHOOK', 'DISCORD', 'TELEGRAM']),
  enabled: z.boolean(),
  events: z.array(z.enum(['SIGNAL_GENERATED', 'ORDER_EXECUTED', 'POSITION_CLOSED', 'RISK_ALERT'])),
  parameters: z.record(z.string(), z.any()),
});

// Strategy configuration schema
export const StrategyConfigSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean(),
  description: z.string().optional(),
  parameters: z.record(z.string(), z.any()),
  capitalAllocation: z.number().min(0).max(1),
  instruments: z.array(z.string().min(1)),
  type: StrategyTypeSchema,
  version: z.string().min(1),
  author: z.string().optional(),
  category: StrategyCategorySchema,
  riskLevel: RiskLevelSchema,
  timeframes: z.array(z.string().min(1)),
  entryRules: z.array(StrategyRuleSchema),
  exitRules: z.array(StrategyRuleSchema),
  positionSizing: PositionSizingConfigSchema,
  riskManagement: RiskManagementConfigSchema,
  filters: z.array(StrategyFilterSchema),
  notifications: z.array(NotificationConfigSchema),
  backtestConfig: z.object({
    startDate: z.date(),
    endDate: z.date(),
    initialCapital: z.number().positive(),
    commission: z.number().min(0),
    slippage: z.number().min(0),
    dataSource: z.string().min(1),
    timeframes: z.array(z.string().min(1)),
    instruments: z.array(z.string().min(1)),
    warmupPeriod: z.number().int().nonnegative(),
    includeDividends: z.boolean(),
    includeCorporateActions: z.boolean(),
  }).optional(),
  liveConfig: z.object({
    autoExecute: z.boolean(),
    maxPositions: z.number().int().positive(),
    allowedSymbols: z.array(z.string().min(1)),
    tradingHours: z.object({
      start: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format'),
      end: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format'),
    }),
  }).optional(),
});

// Strategy result schema
export const StrategyResultSchema = z.object({
  success: z.boolean(),
  signals: z.array(TradeSignalSchema),
  error: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Strategy state schema
export const StrategyStateSchema = z.object({
  isActive: z.boolean(),
  lastExecution: z.date().optional(),
  totalSignals: z.number().int().nonnegative(),
  successfulSignals: z.number().int().nonnegative(),
  failedSignals: z.number().int().nonnegative(),
  currentPositions: z.number().int().nonnegative(),
  totalPnL: z.number(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Strategy performance schema
export const StrategyPerformanceSchema = z.object({
  totalTrades: z.number().int().nonnegative(),
  winningTrades: z.number().int().nonnegative(),
  losingTrades: z.number().int().nonnegative(),
  winRate: z.number().min(0).max(100),
  totalPnL: z.number(),
  maxDrawdown: z.number(),
  sharpeRatio: z.number(),
  maxConsecutiveLosses: z.number().int().nonnegative(),
  averageWin: z.number(),
  averageLoss: z.number(),
  profitFactor: z.number().positive(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Strategy template schema
export const StrategyTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  type: StrategyTypeSchema,
  category: StrategyCategorySchema,
  riskLevel: RiskLevelSchema,
  defaultParameters: z.record(z.string(), z.any()),
  requiredParameters: z.array(z.string()),
  optionalParameters: z.array(z.string()),
  defaultTimeframes: z.array(z.string().min(1)),
  defaultInstruments: z.array(z.string().min(1)),
  exampleConfig: StrategyConfigSchema,
  documentation: z.string(),
  tags: z.array(z.string()),
  isPublic: z.boolean(),
  author: z.string().min(1),
  version: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Types inferred from schemas
export type StrategyType = z.infer<typeof StrategyTypeSchema>;
export type StrategyCategory = z.infer<typeof StrategyCategorySchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type RuleType = z.infer<typeof RuleTypeSchema>;
export type RuleCondition = z.infer<typeof RuleConditionSchema>;
export type IndicatorType = z.infer<typeof IndicatorTypeSchema>;
export type MarketData = z.infer<typeof MarketDataSchema>;
export type TradeSignal = z.infer<typeof TradeSignalSchema>;
export type TechnicalIndicator = z.infer<typeof TechnicalIndicatorSchema>;
export type StrategyRule = z.infer<typeof StrategyRuleSchema>;
export type PositionSizingConfig = z.infer<typeof PositionSizingConfigSchema>;
export type RiskManagementConfig = z.infer<typeof RiskManagementConfigSchema>;
export type StrategyFilter = z.infer<typeof StrategyFilterSchema>;
export type NotificationConfig = z.infer<typeof NotificationConfigSchema>;
export type StrategyConfig = z.infer<typeof StrategyConfigSchema>;
export type StrategyResult = z.infer<typeof StrategyResultSchema>;
export type StrategyState = z.infer<typeof StrategyStateSchema>;
export type StrategyPerformance = z.infer<typeof StrategyPerformanceSchema>;
export type StrategyTemplate = z.infer<typeof StrategyTemplateSchema>;

// Position schema (from types/index.ts)
export const PositionSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string(),
  instrumentId: z.string(),
  symbol: z.string().min(1),
  quantity: z.number().int(),
  averagePrice: z.number().positive(),
  entryPrice: z.number().positive(),
  currentPrice: z.number().positive().nullable(),
  side: z.enum(['LONG', 'SHORT']),
  stopLoss: z.number().positive().nullable(),
  target: z.number().positive().nullable(),
  trailingStop: z.boolean(),
  unrealizedPnL: z.number().nullable(),
  realizedPnL: z.number().nullable(),
  openTime: z.date(),
  closeTime: z.date().nullable(),
  entryTime: z.date(),
  exitTime: z.date().optional(),
  exitPrice: z.number().positive().optional(),
  exitReason: z.string().optional(),
  status: z.enum(['OPEN', 'CLOSED', 'CLOSING']),
  strategyName: z.string().min(1),
  highestPrice: z.number().positive().optional(),
  lowestPrice: z.number().positive().optional(),
});

export type Position = z.infer<typeof PositionSchema>; 