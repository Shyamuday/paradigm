import { MarketDataService } from './market-data.service';
import { InstrumentsManager } from './instruments-manager.service';
import { KiteConnect } from 'kiteconnect';
import { logger } from '../logger/logger';
import { TickData } from '../types';

export class LiveDataIntegrationService {
    private marketDataService: MarketDataService;
    private instrumentsManager: InstrumentsManager;
    private kite: KiteConnect;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 5000; // 5 seconds

    constructor(instrumentsManager: InstrumentsManager, kite: KiteConnect) {
        this.instrumentsManager = instrumentsManager;
        this.kite = kite;
        this.marketDataService = new MarketDataService(instrumentsManager, kite);
    }

    /**
     * Process live tick data from Zerodha websocket
     */
    async processLiveTickData(zerodhaTickData: any): Promise<void> {
        try {
            // Transform Zerodha tick data to our format
            const tickData: TickData = {
                instrumentToken: zerodhaTickData.instrument_token,
                symbol: zerodhaTickData.tradingsymbol,
                ltp: zerodhaTickData.last_price,
                open: zerodhaTickData.ohlc?.open || zerodhaTickData.last_price,
                high: zerodhaTickData.ohlc?.high || zerodhaTickData.last_price,
                low: zerodhaTickData.ohlc?.low || zerodhaTickData.last_price,
                close: zerodhaTickData.last_price,
                volume: zerodhaTickData.volume || 0,
                change: zerodhaTickData.change || 0,
                changePercent: zerodhaTickData.change_percent || 0,
                timestamp: new Date(zerodhaTickData.timestamp || Date.now())
            };

            // Save tick data (aggregation will be handled separately)
            await this.marketDataService.saveTickData(tickData);

            logger.debug(`Processed live tick for ${tickData.symbol}: ${tickData.ltp}`);
        } catch (error) {
            logger.error('Failed to process live tick data:', error);
        }
    }

    /**
     * Process live candle data from Zerodha
     */
    async processLiveCandleData(zerodhaCandleData: any): Promise<void> {
        try {
            const candleData = {
                instrumentToken: zerodhaCandleData.instrument_token,
                symbol: zerodhaCandleData.tradingsymbol,
                open: zerodhaCandleData.open,
                high: zerodhaCandleData.high,
                low: zerodhaCandleData.low,
                close: zerodhaCandleData.close,
                volume: zerodhaCandleData.volume,
                timestamp: new Date(zerodhaCandleData.timestamp)
            };

            // Convert to tick data format for consistency
            const tickData: TickData = {
                ...candleData,
                ltp: candleData.close,
                change: candleData.close - candleData.open,
                changePercent: ((candleData.close - candleData.open) / candleData.open) * 100
            };

            await this.marketDataService.saveTickData(tickData);
            logger.debug(`Processed live candle for ${candleData.symbol}`);
        } catch (error) {
            logger.error('Failed to process live candle data:', error);
        }
    }

    /**
     * Get real-time data for multiple timeframes
     */
    async getRealTimeMultiTimeframeData(symbol: string): Promise<any> {
        try {
            // Get latest market data as fallback
            const latestData = await this.marketDataService.getLatestMarketData(symbol);
            return {
                symbol,
                timeframes: {
                    '1min': latestData,
                    '5min': latestData,
                    '15min': latestData,
                    '1hour': latestData,
                    '1day': latestData
                }
            };
        } catch (error) {
            logger.error('Failed to get real-time multi-timeframe data:', error);
            throw error;
        }
    }

    /**
     * Monitor data quality for live feeds
     */
    async monitorDataQuality(symbol: string): Promise<{
        lastUpdate: Date | null;
        dataGaps: any[];
        latency: number;
    }> {
        try {
            const latestDataArray = await this.marketDataService.getLatestMarketData(symbol);
            const latestData = Array.isArray(latestDataArray) && latestDataArray.length > 0 ? latestDataArray[0] : null;
            const now = new Date();
            const latency = latestData?.timestamp ? now.getTime() - latestData.timestamp.getTime() : 0;

            return {
                lastUpdate: latestData?.timestamp || null,
                dataGaps: [], // TODO: Implement data gap detection
                latency
            };
        } catch (error) {
            logger.error('Failed to monitor data quality:', error);
            return {
                lastUpdate: null,
                dataGaps: [],
                latency: 0
            };
        }
    }

    /**
     * Start live data monitoring
     */
    async startLiveMonitoring(symbols: string[]): Promise<void> {
        try {
            logger.info(`Starting live monitoring for ${symbols.length} symbols`);

            // Set up periodic quality checks
            setInterval(async () => {
                for (const symbol of symbols) {
                    try {
                        const quality = await this.monitorDataQuality(symbol);

                        if (quality.dataGaps.length > 0) {
                            logger.warn(`Data quality issues for ${symbol}:`, quality.dataGaps);
                        }

                        if (quality.latency > 30000) { // 30 seconds
                            logger.warn(`High latency for ${symbol}: ${quality.latency}ms`);
                        }
                    } catch (error) {
                        logger.error(`Failed to monitor ${symbol}:`, error);
                    }
                }
            }, 60000); // Check every minute

            this.isConnected = true;
            logger.info('Live monitoring started successfully');
        } catch (error) {
            logger.error('Failed to start live monitoring:', error);
            throw error;
        }
    }

    /**
     * Stop live data monitoring
     */
    async stopLiveMonitoring(): Promise<void> {
        try {
            this.isConnected = false;
            logger.info('Live monitoring stopped');
        } catch (error) {
            logger.error('Failed to stop live monitoring:', error);
        }
    }

    /**
     * Get connection status
     */
    getConnectionStatus(): { isConnected: boolean; reconnectAttempts: number } {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts
        };
    }
} 