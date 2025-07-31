import { DatabaseManager } from '../database/database';
import { db } from '../database/database';
import { logger } from '../logger/logger';

export interface NiftyIndex {
    name: string;
    description: string;
    symbol: string;
    type: 'INDEX' | 'ETF' | 'FUTURES' | 'OPTIONS';
    constituents?: string[];
    weightage?: Record<string, number>;
}

export interface NiftyInstrument {
    symbol: string;
    name: string;
    exchange: string;
    instrumentType: string;
    underlyingSymbol?: string | null;
    strikePrice?: number | null;
    expiryDate?: Date | null;
    optionType?: string | null;
    indexCategory?: string[];
}

export class NiftyCategorizationService {
    private dbManager: DatabaseManager;

    constructor() {
        this.dbManager = DatabaseManager.getInstance();
    }

    /**
     * Get all Nifty instruments categorized by index
     */
    async getNiftyInstrumentsByCategory(): Promise<Record<string, NiftyInstrument[]>> {
        try {
            await this.dbManager.connect();

            const niftyInstruments = await db.instrument.findMany({
                where: {
                    OR: [
                        { name: { contains: 'NIFTY', mode: 'insensitive' } },
                        { symbol: { contains: 'NIFTY', mode: 'insensitive' } }
                    ]
                },
                orderBy: { name: 'asc' }
            });

            const categorized: Record<string, NiftyInstrument[]> = {
                'NIFTY_50': [],
                'NIFTY_100': [],
                'NIFTY_500': [],
                'NIFTY_MIDCAP_100': [],
                'NIFTY_SMALLCAP_100': [],
                'NIFTY_NEXT_50': [],
                'BANKNIFTY': [],
                'FINNIFTY': [],
                'NIFTY_IT': [],
                'NIFTY_PHARMA': [],
                'NIFTY_AUTO': [],
                'NIFTY_METAL': [],
                'NIFTY_REALTY': [],
                'NIFTY_FMCG': [],
                'NIFTY_ENERGY': [],
                'NIFTY_INFRA': [],
                'NIFTY_PSU_BANK': [],
                'NIFTY_PRIVATE_BANK': [],
                'NIFTY_CONSUMER_DURABLES': [],
                'NIFTY_HEALTHCARE': [],
                'NIFTY_MEDIA': [],
                'NIFTY_OIL_GAS': [],
                'NIFTY_SERVICES': [],
                'NIFTY_TECH': [],
                'OTHER_NIFTY': []
            };

            niftyInstruments.forEach(inst => {
                const instrument: NiftyInstrument = {
                    symbol: inst.symbol,
                    name: inst.name,
                    exchange: inst.exchange,
                    instrumentType: inst.instrumentType,
                    underlyingSymbol: inst.underlyingSymbol,
                    strikePrice: inst.strikePrice,
                    expiryDate: inst.expiryDate,
                    optionType: inst.optionType,
                    indexCategory: this.categorizeInstrument(inst)
                };

                // Add to appropriate categories
                if (instrument.indexCategory) {
                    instrument.indexCategory.forEach(category => {
                        if (categorized[category]) {
                            categorized[category].push(instrument);
                        }
                    });
                }
            });

            return categorized;
        } catch (error) {
            logger.error('Error categorizing Nifty instruments:', error);
            throw error;
        } finally {
            await this.dbManager.disconnect();
        }
    }

    /**
     * Categorize a single instrument into Nifty indices
     */
    private categorizeInstrument(inst: any): string[] {
        const categories: string[] = [];
        const name = inst.name.toUpperCase();
        const symbol = inst.symbol.toUpperCase();

        // Main Nifty indices
        if (name.includes('NIFTY 50') || symbol.includes('NIFTY50') || symbol.includes('NIFTY_50')) {
            categories.push('NIFTY_50');
        }
        if (name.includes('NIFTY 100') || symbol.includes('NIFTY100') || symbol.includes('NIFTY_100')) {
            categories.push('NIFTY_100');
        }
        if (name.includes('NIFTY 500') || symbol.includes('NIFTY500') || symbol.includes('NIFTY_500')) {
            categories.push('NIFTY_500');
        }
        if (name.includes('NIFTY MIDCAP 100') || symbol.includes('NIFTYMIDCAP100')) {
            categories.push('NIFTY_MIDCAP_100');
        }
        if (name.includes('NIFTY SMALLCAP 100') || symbol.includes('NIFTYSMLCAP100')) {
            categories.push('NIFTY_SMALLCAP_100');
        }
        if (name.includes('NIFTY NEXT 50') || symbol.includes('NIFTYNEXT50')) {
            categories.push('NIFTY_NEXT_50');
        }

        // Bank Nifty
        if (name.includes('BANKNIFTY') || symbol.includes('BANKNIFTY')) {
            categories.push('BANKNIFTY');
        }

        // Fin Nifty
        if (name.includes('FINNIFTY') || symbol.includes('FINNIFTY')) {
            categories.push('FINNIFTY');
        }

        // Sectoral indices
        if (name.includes('NIFTY IT') || symbol.includes('NIFTYIT')) {
            categories.push('NIFTY_IT');
        }
        if (name.includes('NIFTY PHARMA') || symbol.includes('NIFTYPHARMA')) {
            categories.push('NIFTY_PHARMA');
        }
        if (name.includes('NIFTY AUTO') || symbol.includes('NIFTYAUTO')) {
            categories.push('NIFTY_AUTO');
        }
        if (name.includes('NIFTY METAL') || symbol.includes('NIFTYMETAL')) {
            categories.push('NIFTY_METAL');
        }
        if (name.includes('NIFTY REALTY') || symbol.includes('NIFTYREALTY')) {
            categories.push('NIFTY_REALTY');
        }
        if (name.includes('NIFTY FMCG') || symbol.includes('NIFTYFMCG')) {
            categories.push('NIFTY_FMCG');
        }
        if (name.includes('NIFTY ENERGY') || symbol.includes('NIFTYENERGY')) {
            categories.push('NIFTY_ENERGY');
        }
        if (name.includes('NIFTY INFRA') || symbol.includes('NIFTYINFRA')) {
            categories.push('NIFTY_INFRA');
        }
        if (name.includes('NIFTY PSU BANK') || symbol.includes('NIFTYPSUBANK')) {
            categories.push('NIFTY_PSU_BANK');
        }
        if (name.includes('NIFTY PRIVATE BANK') || symbol.includes('NIFTYPVTBANK')) {
            categories.push('NIFTY_PRIVATE_BANK');
        }
        if (name.includes('NIFTY CONSUMER DURABLES') || symbol.includes('NIFTYCONDUR')) {
            categories.push('NIFTY_CONSUMER_DURABLES');
        }
        if (name.includes('NIFTY HEALTHCARE') || symbol.includes('NIFTYHEALTH')) {
            categories.push('NIFTY_HEALTHCARE');
        }
        if (name.includes('NIFTY MEDIA') || symbol.includes('NIFTYMEDIA')) {
            categories.push('NIFTY_MEDIA');
        }
        if (name.includes('NIFTY OIL GAS') || symbol.includes('NIFTYOILGAS')) {
            categories.push('NIFTY_OIL_GAS');
        }
        if (name.includes('NIFTY SERVICES') || symbol.includes('NIFTYSERVICES')) {
            categories.push('NIFTY_SERVICES');
        }
        if (name.includes('NIFTY TECH') || symbol.includes('NIFTYTECH')) {
            categories.push('NIFTY_TECH');
        }

        // If no specific category found but contains NIFTY, add to OTHER_NIFTY
        if (categories.length === 0 && (name.includes('NIFTY') || symbol.includes('NIFTY'))) {
            categories.push('OTHER_NIFTY');
        }

        return categories;
    }

    /**
     * Get instruments for a specific Nifty index
     */
    async getInstrumentsForIndex(indexName: string): Promise<NiftyInstrument[]> {
        const categorized = await this.getNiftyInstrumentsByCategory();
        return categorized[indexName] || [];
    }

    /**
     * Get all Nifty indices with their instrument counts
     */
    async getNiftyIndexSummary(): Promise<Record<string, number>> {
        const categorized = await this.getNiftyInstrumentsByCategory();
        const summary: Record<string, number> = {};

        Object.entries(categorized).forEach(([index, instruments]) => {
            if (instruments.length > 0) {
                summary[index] = instruments.length;
            }
        });

        return summary;
    }

    /**
     * Get Nifty 50 constituent stocks (approximate based on common constituents)
     */
    async getNifty50Constituents(): Promise<string[]> {
        // This is a sample list - in production, you'd fetch this from NSE API
        const nifty50Stocks = [
            'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN',
            'BHARTIARTL', 'KOTAKBANK', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'HCLTECH', 'SUNPHARMA',
            'TATAMOTORS', 'WIPRO', 'ULTRACEMCO', 'TITAN', 'BAJFINANCE', 'NESTLEIND', 'POWERGRID',
            'BAJAJFINSV', 'NTPC', 'HINDALCO', 'JSWSTEEL', 'ONGC', 'TATASTEEL', 'ADANIENT',
            'COALINDIA', 'BRITANNIA', 'CIPLA', 'EICHERMOT', 'HEROMOTOCO', 'DIVISLAB', 'DRREDDY',
            'SHREECEM', 'HDFC', 'INDUSINDBK', 'TECHM', 'GRASIM', 'BAJAJ-AUTO', 'TATACONSUM',
            'APOLLOHOSP', 'SBILIFE', 'ADANIPORTS', 'BPCL', 'VEDL', 'HDFCLIFE', 'M&M'
        ];

        return nifty50Stocks;
    }

    /**
     * Get Bank Nifty constituent stocks
     */
    async getBankNiftyConstituents(): Promise<string[]> {
        const bankNiftyStocks = [
            'HDFCBANK', 'ICICIBANK', 'SBIN', 'KOTAKBANK', 'AXISBANK', 'INDUSINDBK', 'HDFC',
            'SBILIFE', 'HDFCLIFE', 'PERSISTENT', 'IDFCFIRSTB', 'FEDERALBNK', 'BANKBARODA',
            'PNB', 'CANBK', 'UNIONBANK', 'AUBANK', 'KARURVYSYA', 'CSBBANK', 'RBLBANK',
            'J&KBANK', 'IDBI', 'SOUTHBANK', 'UCOBANK', 'CENTRALBK', 'INDIANB', 'BANDHANBNK',
            'KARNATAKA', 'DCBBANK', 'YESBANK', 'LAKSHVILAS', 'DEEPAKNTR', 'CHOLAFIN',
            'BAJFINANCE', 'BAJAJFINSV', 'MUTHOOTFIN', 'PEL', 'RECLTD', 'PFC', 'IRFC',
            'HUDCO', 'POWERGRID', 'NTPC', 'ADANIGREEN', 'TATAPOWER', 'TATACOMM', 'BHARTIARTL'
        ];

        return bankNiftyStocks;
    }

    /**
     * Get instruments by type for a specific index
     */
    async getInstrumentsByType(indexName: string, instrumentType: string): Promise<NiftyInstrument[]> {
        const instruments = await this.getInstrumentsForIndex(indexName);
        return instruments.filter(inst => inst.instrumentType === instrumentType);
    }

    /**
     * Get active options for a specific index
     */
    async getActiveOptionsForIndex(indexName: string): Promise<NiftyInstrument[]> {
        const instruments = await this.getInstrumentsForIndex(indexName);
        const today = new Date();

        return instruments.filter(inst =>
            (inst.instrumentType === 'CE' || inst.instrumentType === 'PE') &&
            inst.expiryDate && inst.expiryDate > today
        );
    }

    /**
     * Get futures for a specific index
     */
    async getFuturesForIndex(indexName: string): Promise<NiftyInstrument[]> {
        return this.getInstrumentsByType(indexName, 'FUT');
    }

    /**
     * Get ETFs for a specific index
     */
    async getETFsForIndex(indexName: string): Promise<NiftyInstrument[]> {
        return this.getInstrumentsByType(indexName, 'EQ');
    }

    /**
     * Search Nifty instruments by name or symbol
     */
    async searchNiftyInstruments(searchTerm: string): Promise<NiftyInstrument[]> {
        try {
            await this.dbManager.connect();

            const instruments = await db.instrument.findMany({
                where: {
                    AND: [
                        {
                            OR: [
                                { name: { contains: 'NIFTY', mode: 'insensitive' } },
                                { symbol: { contains: 'NIFTY', mode: 'insensitive' } }
                            ]
                        },
                        {
                            OR: [
                                { name: { contains: searchTerm, mode: 'insensitive' } },
                                { symbol: { contains: searchTerm, mode: 'insensitive' } }
                            ]
                        }
                    ]
                },
                orderBy: { name: 'asc' }
            });

            return instruments.map(inst => ({
                symbol: inst.symbol,
                name: inst.name,
                exchange: inst.exchange,
                instrumentType: inst.instrumentType,
                underlyingSymbol: inst.underlyingSymbol,
                strikePrice: inst.strikePrice,
                expiryDate: inst.expiryDate,
                optionType: inst.optionType,
                indexCategory: this.categorizeInstrument(inst)
            }));
        } catch (error) {
            logger.error('Error searching Nifty instruments:', error);
            throw error;
        } finally {
            await this.dbManager.disconnect();
        }
    }

    /**
     * Get statistics for Nifty instruments
     */
    async getNiftyStatistics(): Promise<{
        totalInstruments: number;
        byIndex: Record<string, number>;
        byType: Record<string, number>;
        byExchange: Record<string, number>;
    }> {
        const categorized = await this.getNiftyInstrumentsByCategory();

        const byIndex: Record<string, number> = {};
        const byType: Record<string, number> = {};
        const byExchange: Record<string, number> = {};
        let totalInstruments = 0;

        Object.entries(categorized).forEach(([index, instruments]) => {
            if (instruments.length > 0) {
                byIndex[index] = instruments.length;
                totalInstruments += instruments.length;

                instruments.forEach(inst => {
                    // Count by type
                    byType[inst.instrumentType] = (byType[inst.instrumentType] || 0) + 1;

                    // Count by exchange
                    byExchange[inst.exchange] = (byExchange[inst.exchange] || 0) + 1;
                });
            }
        });

        return {
            totalInstruments,
            byIndex,
            byType,
            byExchange
        };
    }
} 