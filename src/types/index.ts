export interface PaperTrade {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  success: boolean;
  entryTime: Date;
  exitTime: Date;
  rsiAtEntry: number;
  sma20AtEntry: number;
  stopLoss: number;
  takeProfit: number;
  timeframe: string;
  strategy: string;
}

export interface PaperTradingConfig {
  rsiMin: number;
  rsiMax: number;
  rsiOversold: number;
  rsiOverbought: number;
  startHour: number;
  endHour: number;
  avoidDays: number[];
  volumeMultiplier: number;
  useMACD: boolean;
  useBollingerBands: boolean;
  useATR: boolean;
  atrMultiplier: number;
  maxDailyLoss: number;
  maxPositions: number;
  capital: number;
  positionSize: number;
}

export interface PaperTradingSession {
  startTime: Date;
  endTime: Date | null;
  initialCapital: number;
  currentCapital: number;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  successRate: number;
  totalPnl: number;
  dailyPnl: number;
  openPositions: Map<string, PaperTrade>;
  closedPositions: PaperTrade[];
  dailyStats: {
    [date: string]: {
      trades: number;
      pnl: number;
      successRate: number;
    };
  };
}

export interface TimeframeConfig {
  name: string;
  checkInterval: number;
  lastCheck: Date;
  shouldCheck: (now: Date) => boolean;
}

export interface TradingSignal {
  action: 'BUY' | 'SELL';
  confidence: number;
  price: number;
  rsi: number;
  sma20: number;
  timeframe: string;
  symbol: string;
} 