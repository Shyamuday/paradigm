// Common types and interfaces for the trading bot

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TickData {
  instrumentToken: number;
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
  timestamp: Date;
}

export interface CandleData {
  instrumentToken: number;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
}

// Multi-timeframe data interfaces
export interface TimeframeConfig {
  id: string;
  name: string; // 1min, 3min, 5min, 15min, 30min, 1hour, 1day
  description?: string;
  intervalMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MultiTimeframeCandleData {
  id: string;
  instrumentId: string;
  instrument: Instrument;
  timeframeId: string;
  timeframe: TimeframeConfig;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  typicalPrice?: number;
  weightedPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  upperShadow?: number;
  lowerShadow?: number;
  bodySize?: number;
  totalRange?: number;
}

export interface TickDataPoint {
  id: string;
  instrumentId: string;
  instrument: Instrument;
  timestamp: Date;
  ltp: number;
  volume: number;
  change?: number;
  changePercent?: number;
}

export interface VolumeProfileData {
  id: string;
  instrumentId: string;
  instrument: Instrument;
  timeframeId: string;
  timeframe: TimeframeConfig;
  date: Date;
  priceLevel: number;
  volume: number;
  poc: boolean; // Point of Control
}

export interface TimeframeInterval {
  name: string;
  minutes: number;
  description: string;
}

export interface CandleAggregationRequest {
  symbol: string;
  timeframe: string;
  from: Date;
  to: Date;
  limit?: number;
}

export interface CandleAggregationResult {
  symbol: string;
  timeframe: string;
  candles: MultiTimeframeCandleData[];
  totalCount: number;
  hasMore: boolean;
}

export interface TradeSignal {
  id: string;
  strategy: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  quantity: number;
  price: number;
  stopLoss?: number;
  target?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface TradeOrder {
  id: string;
  signalId: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  stopLoss?: number;
  target?: number;
  status: 'PENDING' | 'COMPLETE' | 'CANCELLED' | 'REJECTED';
  orderId?: string; // Zerodha order ID
  executionPrice?: number;
  orderTime: Date;
  executionTime?: Date;
}

export interface Position {
  id: string;
  sessionId: string;
  instrumentId: string;
  instrument: Instrument;
  symbol: string;
  quantity: number;
  averagePrice: number;
  entryPrice: number;
  currentPrice: number | null;
  side: 'LONG' | 'SHORT';
  stopLoss: number | null;
  target: number | null;
  trailingStop: boolean;
  unrealizedPnL: number | null;
  realizedPnL: number | null;
  openTime: Date;
  closeTime: Date | null;
  entryTime: Date;
  exitTime?: Date;
  exitPrice?: number;
  exitReason?: string;
  status: 'OPEN' | 'CLOSED' | 'CLOSING';
  strategyName: string;
  highestPrice?: number;
  lowestPrice?: number;
}

export interface StrategyConfig {
  name: string;
  enabled: boolean;
  description?: string;
  parameters: Record<string, any>;
  capitalAllocation: number;
  instruments: string[];
  // Enhanced strategy configuration
  type: StrategyType;
  version: string;
  author?: string;
  category: StrategyCategory;
  riskLevel: RiskLevel;
  timeframes: string[];
  entryRules: StrategyRule[];
  exitRules: StrategyRule[];
  positionSizing: PositionSizingConfig;
  riskManagement: RiskManagementConfig;
  filters: StrategyFilter[];
  notifications: NotificationConfig[];
  backtestConfig?: BacktestConfig;
  liveConfig?: LiveTradingConfig;
}

// Strategy Types
export type StrategyType =
  | 'TREND_FOLLOWING'
  | 'MEAN_REVERSION'
  | 'BREAKOUT'
  | 'MOMENTUM'
  | 'SCALPING'
  | 'ARBITRAGE'
  | 'PAIRS_TRADING'
  | 'OPTIONS_STRATEGY'
  | 'FUTURES_STRATEGY'
  | 'CUSTOM'
  | 'MACHINE_LEARNING'
  | 'QUANTITATIVE'
  | 'DISCRETIONARY';

export type StrategyCategory =
  | 'TECHNICAL_ANALYSIS'
  | 'FUNDAMENTAL_ANALYSIS'
  | 'QUANTITATIVE'
  | 'MACHINE_LEARNING'
  | 'ARBITRAGE'
  | 'OPTIONS'
  | 'FUTURES'
  | 'FOREX'
  | 'CRYPTO'
  | 'CUSTOM';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

// Strategy Rules
export interface StrategyRule {
  id: string;
  name: string;
  type: RuleType;
  condition: RuleCondition;
  parameters: Record<string, any>;
  priority: number;
  isActive: boolean;
  description?: string;
}

export type RuleType =
  | 'ENTRY'
  | 'EXIT'
  | 'FILTER'
  | 'CONFIRMATION'
  | 'REVERSAL'
  | 'CUSTOM';

export type RuleCondition =
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'IF_THEN'
  | 'IF_THEN_ELSE'
  | 'CUSTOM';

// Position Sizing
export interface PositionSizingConfig {
  method: PositionSizingMethod;
  fixedAmount?: number;
  percentageOfCapital?: number;
  riskPerTrade?: number;
  kellyCriterion?: boolean;
  volatilityBased?: boolean;
  customFormula?: string;
  maxPositionSize?: number;
  minPositionSize?: number;
}

export type PositionSizingMethod =
  | 'FIXED_AMOUNT'
  | 'PERCENTAGE_OF_CAPITAL'
  | 'RISK_PER_TRADE'
  | 'KELLY_CRITERION'
  | 'VOLATILITY_BASED'
  | 'CUSTOM_FORMULA';

// Risk Management
export interface RiskManagementConfig {
  stopLoss: StopLossConfig;
  takeProfit: TakeProfitConfig;
  trailingStop?: TrailingStopConfig;
  maxDrawdown: number;
  maxDailyLoss: number;
  maxOpenPositions: number;
  correlationLimit?: number;
  sectorExposure?: number;
  leverageLimit?: number;
}

export interface StopLossConfig {
  type: StopLossType;
  value: number;
  atrMultiplier?: number;
  percentage?: number;
  fixedAmount?: number;
  timeBased?: boolean;
  timeLimit?: number;
}

export type StopLossType =
  | 'FIXED_POINTS'
  | 'PERCENTAGE'
  | 'ATR_BASED'
  | 'TIME_BASED'
  | 'CUSTOM';

export interface TakeProfitConfig {
  type: TakeProfitType;
  value: number;
  atrMultiplier?: number;
  percentage?: number;
  fixedAmount?: number;
  partialExit?: PartialExitConfig[];
}

export type TakeProfitType =
  | 'FIXED_POINTS'
  | 'PERCENTAGE'
  | 'ATR_BASED'
  | 'RISK_REWARD_RATIO'
  | 'CUSTOM';

export interface PartialExitConfig {
  percentage: number;
  target: number;
  stopLoss?: number;
}

export interface TrailingStopConfig {
  enabled: boolean;
  type: TrailingStopType;
  value: number;
  activationLevel?: number;
  lockInProfit?: boolean;
}

export type TrailingStopType =
  | 'FIXED_POINTS'
  | 'PERCENTAGE'
  | 'ATR_BASED'
  | 'CUSTOM';

// Strategy Filters
export interface StrategyFilter {
  id: string;
  name: string;
  type: FilterType;
  parameters: Record<string, any>;
  isActive: boolean;
  description?: string;
}

export type FilterType =
  | 'TIME_FILTER'
  | 'VOLUME_FILTER'
  | 'VOLATILITY_FILTER'
  | 'TREND_FILTER'
  | 'MARKET_CONDITION'
  | 'CORRELATION_FILTER'
  | 'NEWS_FILTER'
  | 'CUSTOM_FILTER';

// Notifications
export interface NotificationConfig {
  id: string;
  type: NotificationType;
  conditions: NotificationCondition[];
  channels: NotificationChannel[];
  isActive: boolean;
}

export type NotificationType =
  | 'SIGNAL_GENERATED'
  | 'POSITION_OPENED'
  | 'POSITION_CLOSED'
  | 'STOP_LOSS_HIT'
  | 'TAKE_PROFIT_HIT'
  | 'DRAWDOWN_ALERT'
  | 'PERFORMANCE_UPDATE'
  | 'ERROR_ALERT';

export interface NotificationCondition {
  metric: string;
  operator: 'GT' | 'LT' | 'EQ' | 'GTE' | 'LTE';
  value: number;
}

export interface NotificationChannel {
  type: 'EMAIL' | 'SMS' | 'PUSH' | 'WEBHOOK' | 'TELEGRAM' | 'DISCORD';
  config: Record<string, any>;
}

// Backtest Configuration
export interface BacktestConfig {
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  commission: number;
  slippage: number;
  dataSource: string;
  timeframes: string[];
  instruments: string[];
  warmupPeriod: number;
  includeDividends: boolean;
  includeCorporateActions: boolean;
}

// Live Trading Configuration
export interface LiveTradingConfig {
  executionMode: ExecutionMode;
  orderTypes: OrderType[];
  executionDelay: number;
  maxSlippage: number;
  retryAttempts: number;
  retryDelay: number;
  marketHoursOnly: boolean;
  preMarket: boolean;
  postMarket: boolean;
}

export type ExecutionMode =
  | 'PAPER_TRADING'
  | 'LIVE_TRADING'
  | 'SIMULATION'
  | 'HYBRID';

export type OrderType =
  | 'MARKET'
  | 'LIMIT'
  | 'STOP_LOSS'
  | 'STOP_LIMIT'
  | 'TRAILING_STOP'
  | 'BRACKET_ORDER'
  | 'COVER_ORDER';

// Technical Indicators
export interface TechnicalIndicator {
  name: string;
  type: IndicatorType;
  parameters: Record<string, any>;
  timeframe: string;
  description?: string;
}

export type IndicatorType =
  | 'MOVING_AVERAGE'
  | 'RSI'
  | 'MACD'
  | 'BOLLINGER_BANDS'
  | 'STOCHASTIC'
  | 'ATR'
  | 'ADX'
  | 'CCI'
  | 'WILLIAMS_R'
  | 'OBV'
  | 'VWAP'
  | 'PIVOT_POINTS'
  | 'FIBONACCI'
  | 'ICHIMOKU'
  | 'PARABOLIC_SAR'
  | 'CUSTOM';

// Strategy Performance Metrics
export interface StrategyPerformance {
  id: string;
  strategyId: string;
  period: string;
  startDate: Date;
  endDate: Date;
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageHoldingPeriod: number;
  volatility: number;
  beta: number;
  alpha: number;
  informationRatio: number;
  treynorRatio: number;
  jensenAlpha: number;
  createdAt: Date;
}

// Strategy State
export interface StrategyState {
  id: string;
  strategyId: string;
  status: StrategyStatus;
  currentPositions: Position[];
  pendingSignals: TradeSignal[];
  lastExecutionTime: Date;
  nextExecutionTime?: Date;
  errorCount: number;
  lastError?: string;
  performanceMetrics: Partial<StrategyPerformance>;
  isHealthy: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type StrategyStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'STOPPED'
  | 'ERROR'
  | 'MAINTENANCE'
  | 'BACKTESTING';

// Strategy Template
export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  type: StrategyType;
  category: StrategyCategory;
  riskLevel: RiskLevel;
  defaultParameters: Record<string, any>;
  requiredParameters: string[];
  optionalParameters: string[];
  defaultTimeframes: string[];
  defaultInstruments: string[];
  exampleConfig: StrategyConfig;
  documentation: string;
  tags: string[];
  isPublic: boolean;
  author: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskConfig {
  maxDailyLoss: number;
  maxPositionSize: number;
  maxOpenPositions: number;
  defaultStopLossPercentage: number;
  trailingStopLoss: boolean;
  maxRiskPerTrade: number;
  maxPortfolioRisk: number;
}

export interface TradingConfig {
  mode: 'paper' | 'live' | 'backtest';
  capital: number;
  maxDailyLoss: number;
  maxPositionSize: number;
  maxOpenPositions: number;
}

export interface MarketDataConfig {
  websocketUrl: string;
  historicalDays: number;
  instruments: InstrumentConfig[];
}

export interface InstrumentConfig {
  symbol: string;
  exchange: string;
  instrumentType: string;
  lotSize?: number;
  tickSize?: number;
}

export interface ScheduleConfig {
  startTime: string;
  endTime: string;
  timezone: string;
  preMarketStart: string;
  postMarketEnd: string;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  filePath: string;
  maxFileSize: string;
  maxFiles: number;
}

export interface DatabaseConfig {
  url: string;
  poolSize: number;
  timeout: number;
}

export interface DashboardConfig {
  enabled: boolean;
  port: number;
  corsOrigin: string;
}

export interface BotConfig {
  trading: TradingConfig;
  marketData: MarketDataConfig;
  risk: RiskConfig;
  schedule: ScheduleConfig;
  strategies: Record<string, StrategyConfig>;
  logging: LoggingConfig;
  database: DatabaseConfig;
  dashboard: DashboardConfig;
}

export interface ZerodhaCredentials {
  apiKey: string;
  apiSecret: string;
  requestToken: string;
  accessToken?: string;
}

export interface ZerodhaInstrument {
  instrument_token: number;
  tradingsymbol: string;
  name: string;
  exchange: string;
  instrument_type: string;
  lot_size: number;
  tick_size: number;
}

export interface ZerodhaOrder {
  order_id: string;
  tradingsymbol: string;
  exchange: string;
  transaction_type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  order_type: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  status: 'OPEN' | 'COMPLETE' | 'CANCELLED' | 'REJECTED';
  order_timestamp: Date;
  exchange_timestamp?: Date;
}

export interface ZerodhaPosition {
  tradingsymbol: string;
  exchange: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  day_change: number;
  day_change_percentage: number;
}

export interface SystemLog {
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  category: 'AUTH' | 'MARKET_DATA' | 'STRATEGY' | 'ORDER' | 'POSITION' | 'RISK';
  message: string;
  data?: Record<string, any>;
  timestamp: Date;
}

export interface TradingSession {
  id: string;
  userId?: string;
  startTime: Date;
  endTime?: Date | null;
  mode?: 'paper' | 'live' | 'backtest';
  capital?: number;
  status: 'ACTIVE' | 'COMPLETED' | 'STOPPED';
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  maxDrawdown: number;
  config?: any;
}

export type EventType =
  | 'tick_received'
  | 'signal_generated'
  | 'order_placed'
  | 'order_executed'
  | 'position_opened'
  | 'position_closed'
  | 'risk_check_passed'
  | 'risk_check_failed'
  | 'error_occurred';

export interface BotEvent {
  type: EventType;
  data: any;
  timestamp: Date;
}

export interface StrategyResult {
  success: boolean;
  signals: TradeSignal[];
  error?: string;
}

export interface RiskCheckResult {
  approved: boolean;
  reason?: string;
  modifiedSignal?: TradeSignal;
}

export interface OrderResult {
  success: boolean;
  order?: TradeOrder;
  error?: string;
}

export interface PositionResult {
  success: boolean;
  position?: Position;
  error?: string;
}

// Risk Management Types
export interface RiskProfile {
  id: string;
  userId: string;
  maxDailyLoss: number;
  maxDrawdown: number;
  maxPositionSize: number;
  riskPerTrade: number;
  maxOpenTrades: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  var: number;
  sharpeRatio: number;
}

export interface RiskMetrics {
  id: string;
  sessionId: string;
  date: Date;
  dailyPnL: number;
  drawdown: number;
  currentRisk: number;
  var: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
}

// Alert System Types
export type AlertType = 'PRICE' | 'VOLUME' | 'TECHNICAL_INDICATOR' | 'PNL' | 'RISK';
export type AlertCondition = 'ABOVE' | 'BELOW' | 'CROSSES_ABOVE' | 'CROSSES_BELOW' | 'EQUALS';
export type NotificationMethod = 'EMAIL' | 'SMS' | 'PUSH' | 'WEBHOOK';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface Alert {
  id: string;
  userId: string;
  instrumentId?: string;
  type: AlertType;
  condition: AlertCondition;
  value: number;
  currentValue?: number;
  message?: string;
  isActive: boolean;
  isTriggered: boolean;
  triggeredAt?: Date;
  createdAt: Date;
  notifications: AlertNotification[];
}

export interface AlertNotification {
  id: string;
  alertId: string;
  method: NotificationMethod;
  destination: string;
  status: NotificationStatus;
  sentAt?: Date;
  createdAt: Date;
}

// Backtesting Types
export interface BacktestResult {
  id: string;
  strategyId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  annualReturn: number;
  maxDrawdown: number;
  sharpeRatio?: number;
  sortinoRatio?: number;
  calmarRatio?: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  createdAt: Date;
  trades: BacktestTrade[];
}

export interface BacktestTrade {
  id: string;
  backtestId: string;
  instrumentId: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  entryTime: Date;
  exitTime?: Date;
  holdingPeriod?: number;
}

// Transaction Cost Types
export interface TransactionCost {
  id: string;
  tradeId: string;
  brokerage: number;
  stt: number;
  exchangeFee: number;
  gst: number;
  stampDuty: number;
  sebiTurnover: number;
  totalCost: number;
  costPercentage: number;
}

export interface BrokeragePlan {
  id: string;
  brokerName: string;
  planName: string;
  equityDelivery: number;
  equityIntraday: number;
  equityFutures: number;
  equityOptions: number;
  currencyFutures: number;
  currencyOptions: number;
  commodityFutures: number;
  commodityOptions: number;
  dpCharges: number;
  isActive: boolean;
  createdAt: Date;
}

// API Monitoring Types
export interface ApiUsage {
  id: string;
  userId: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  requestCount: number;
  errorCount: number;
  avgResponseTime?: number;
  date: Date;
  hour: number;
}

export interface ApiQuota {
  id: string;
  userId: string;
  endpoint: string;
  dailyLimit: number;
  currentUsage: number;
  resetTime: Date;
  isExceeded: boolean;
}

export interface ApiError {
  id: string;
  userId: string;
  endpoint: string;
  errorCode: string;
  errorMessage: string;
  requestData?: any;
  responseData?: any;
  timestamp: Date;
}

export interface Trade {
  id: string;
  sessionId: string;
  instrumentId: string;
  instrument: Instrument;
  strategyId: string | null;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  orderId: string | null;
  status: 'PENDING' | 'COMPLETE' | 'CANCELLED' | 'REJECTED';
  stopLoss: number | null;
  target: number | null;
  trailingStop: boolean;
  orderTime: Date;
  executionTime: Date | null;
  realizedPnL: number | null;
  unrealizedPnL: number | null;
}

export interface MarketData {
  id: string;
  instrumentId: string;
  instrument: Instrument;
  symbol: string;
  timestamp: Date;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  ltp: number | null;
  change: number | null;
  changePercent: number | null;
}

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  instrumentType: string;
  lotSize: number;
  tickSize: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
} 