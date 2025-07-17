import { z } from 'zod';

// Market depth schema
export const MarketDepthSchema = z.object({
  price: z.number().positive(),
  quantity: z.number().int().nonnegative(),
  orders: z.number().int().nonnegative(),
});

// OHLC data schema
export const OHLCSchema = z.object({
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
});

// Market quote schema
export const MarketQuoteSchema = z.object({
  instrument_token: z.number().int().positive(),
  timestamp: z.string(),
  last_trade_time: z.string(),
  last_price: z.number(),
  last_quantity: z.number().int().nonnegative(),
  buy_quantity: z.number().int().nonnegative(),
  sell_quantity: z.number().int().nonnegative(),
  volume: z.number().int().nonnegative(),
  average_price: z.number().nonnegative(),
  oi: z.number().int().nonnegative(),
  oi_day_high: z.number().int().nonnegative(),
  oi_day_low: z.number().int().nonnegative(),
  net_change: z.number(),
  lower_circuit_limit: z.number().nonnegative(),
  upper_circuit_limit: z.number().nonnegative(),
  ohlc: OHLCSchema,
  depth: z.object({
    buy: z.array(MarketDepthSchema),
    sell: z.array(MarketDepthSchema),
  }),
});

// OHLC quote schema
export const OHLCQuoteSchema = z.object({
  instrument_token: z.number().int().positive(),
  last_price: z.number(),
  ohlc: OHLCSchema,
});

// LTP quote schema
export const LTPQuoteSchema = z.object({
  instrument_token: z.number().int().positive(),
  last_price: z.number(),
});

// Historical data schema
export const HistoricalDataSchema = z.object({
  date: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().int().nonnegative(),
  oi: z.number().int().nonnegative().optional(),
});

// Zerodha instrument schema
export const ZerodhaInstrumentSchema = z.object({
  instrument_token: z.number().int().positive(),
  exchange_token: z.number().int().positive(),
  tradingsymbol: z.string().min(1),
  name: z.string().min(1),
  last_price: z.number().nonnegative(),
  expiry: z.string(),
  strike: z.number().nonnegative(),
  tick_size: z.number().positive(),
  lot_size: z.number().int().positive(),
  instrument_type: z.string().min(1),
  segment: z.string().min(1),
  exchange: z.string().min(1),
});

// Instruments response schema
export const InstrumentsResponseSchema = z.object({
  status: z.enum(['success', 'error']),
  data: z.array(ZerodhaInstrumentSchema),
  message: z.string().optional(),
});

// Market quotes response schema
export const MarketQuotesResponseSchema = z.object({
  status: z.enum(['success', 'error']),
  data: z.record(z.string(), MarketQuoteSchema),
  message: z.string().optional(),
});

// OHLC quotes response schema
export const OHLCQuotesResponseSchema = z.object({
  status: z.enum(['success', 'error']),
  data: z.record(z.string(), OHLCQuoteSchema),
  message: z.string().optional(),
});

// LTP quotes response schema
export const LTPQuotesResponseSchema = z.object({
  status: z.enum(['success', 'error']),
  data: z.record(z.string(), LTPQuoteSchema),
  message: z.string().optional(),
});

// Historical data response schema
export const HistoricalDataResponseSchema = z.object({
  status: z.enum(['success', 'error']),
  data: z.object({
    instrument_token: z.number().int().positive(),
    timestamp: z.array(z.string()),
    ohlc: z.object({
      open: z.array(z.number()),
      high: z.array(z.number()),
      low: z.array(z.number()),
      close: z.array(z.number()),
    }),
    volume: z.array(z.number().int().nonnegative()),
    oi: z.array(z.number().int().nonnegative()).optional(),
  }),
  message: z.string().optional(),
});

// Instrument search parameters schema
export const InstrumentSearchSchema = z.object({
  exchange: z.enum(['NSE', 'BSE', 'NFO', 'BFO', 'CDS', 'MCX']).optional(),
  instrumentType: z.string().optional(),
  tradingsymbol: z.string().optional(),
  name: z.string().optional(),
});

// Historical data parameters schema
export const HistoricalDataParamsSchema = z.object({
  instrumentToken: z.number().int().positive(),
  interval: z.enum(['minute', '3minute', '5minute', '10minute', '15minute', '30minute', '60minute', 'day']),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  continuous: z.boolean().optional(),
  oi: z.boolean().optional(),
});

// Types inferred from schemas
export type MarketDepth = z.infer<typeof MarketDepthSchema>;
export type OHLC = z.infer<typeof OHLCSchema>;
export type MarketQuote = z.infer<typeof MarketQuoteSchema>;
export type OHLCQuote = z.infer<typeof OHLCQuoteSchema>;
export type LTPQuote = z.infer<typeof LTPQuoteSchema>;
export type HistoricalData = z.infer<typeof HistoricalDataSchema>;
export type ZerodhaInstrument = z.infer<typeof ZerodhaInstrumentSchema>;
export type InstrumentsResponse = z.infer<typeof InstrumentsResponseSchema>;
export type MarketQuotesResponse = z.infer<typeof MarketQuotesResponseSchema>;
export type OHLCQuotesResponse = z.infer<typeof OHLCQuotesResponseSchema>;
export type LTPQuotesResponse = z.infer<typeof LTPQuotesResponseSchema>;
export type HistoricalDataResponse = z.infer<typeof HistoricalDataResponseSchema>;
export type InstrumentSearch = z.infer<typeof InstrumentSearchSchema>;
export type HistoricalDataParams = z.infer<typeof HistoricalDataParamsSchema>; 