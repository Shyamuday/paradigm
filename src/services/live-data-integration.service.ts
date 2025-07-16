import { MarketDataService } from './market-data.service';
import { logger } from '../logger/logger';
import { TickData } from '../types';

export class LiveDataIntegrationService {
    private marketDataService: MarketDataService;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 5000; // 5 seconds

    constructor() {
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

            // Save and automatically aggregate to all timeframes
            await this.marketDataService.saveTickDataAndAggregate(tickData);

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

            await this.marketDataService.saveTickDataAndAggregate(tickData);
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
            return await this.marketDataService.getLatestMultiTimeframeData(symbol);
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
            const stats = await this.marketDataService.getInstrumentStats(symbol);
            const now = new Date();
            const latency = stats.lastUpdate ? now.getTime() - stats.lastUpdate.getTime() : 0;

            // Check for data gaps (if no update in last 5 minutes)
            const dataGaps = [];
            if (latency > 5 * 60 * 1000) { // 5 minutes
                dataGaps.push({
                    timeframe: 'live',
                    duration: latency,
                    message: `No data for ${Math.round(latency / 1000)} seconds`
                });
            }

            return {
                lastUpdate: stats.lastUpdate,
                dataGaps,
                latency
            };
        } catch (error) {
            logger.error('Failed to monitor data quality:', error);
            throw error;
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