import { ZerodhaAuth } from '../auth/zerodha-auth';
import { InstrumentsManager, ZerodhaInstrument } from './instruments-manager.service';
import { db } from '../database/database';
import { logger } from '../logger/logger';
import { DatabaseManager } from '../database/database';

/**
 * Enhanced Instruments Manager with Database Storage
 * 
 * Extends the base InstrumentsManager to provide:
 * - Database storage and retrieval of instruments
 * - Batch processing for large datasets
 * - Instrument synchronization between Zerodha and local database
 * - Advanced filtering and search capabilities
 * - Statistics and reporting
 */
export class EnhancedInstrumentsManager extends InstrumentsManager {
    private dbManager: DatabaseManager;

    constructor(auth: ZerodhaAuth) {
        super(auth);
        this.dbManager = DatabaseManager.getInstance();
    }

    /**
     * Fetch all instruments from Zerodha and store in database
     */
    async fetchAndStoreAllInstruments(): Promise<{
        totalFetched: number;
        stored: number;
        updated: number;
        errors: number;
        successRate: number;
    }> {
        try {
            logger.info('🚀 Starting enhanced instrument fetch and store process...');

            // Ensure database connection
            if (!this.dbManager.isConnectionActive()) {
                await this.dbManager.connect();
            }

            // Fetch instruments from Zerodha
            const instruments = await this.getAllInstruments();
            logger.info(`📈 Fetched ${instruments.length} instruments from Zerodha`);

            // Store in database
            const result = await this.storeInstrumentsInDatabase(instruments);

            logger.info('✅ Enhanced instrument fetch and store completed', result);
            return result;

        } catch (error) {
            logger.error('❌ Enhanced instrument fetch and store failed:', error);
            throw error;
        }
    }

    /**
     * Store instruments in database with batch processing
     */
    private async storeInstrumentsInDatabase(instruments: ZerodhaInstrument[]): Promise<{
        totalFetched: number;
        stored: number;
        updated: number;
        errors: number;
        successRate: number;
    }> {
        let storedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;
        const batchSize = 100;

        logger.info(`💾 Storing ${instruments.length} instruments in database...`);

        for (let i = 0; i < instruments.length; i += batchSize) {
            const batch = instruments.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(instruments.length / batchSize);

            logger.info(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} instruments)...`);

            for (const instrument of batch) {
                try {
                    await this.storeSingleInstrument(instrument);
                    storedCount++;
                } catch (error) {
                    if (error instanceof Error && error.message.includes('already exists')) {
                        // Try to update instead
                        try {
                            await this.updateSingleInstrument(instrument);
                            updatedCount++;
                        } catch (updateError) {
                            errorCount++;
                            logger.error(`Failed to update instrument ${instrument.tradingsymbol}:`, updateError);
                        }
                    } else {
                        errorCount++;
                        logger.error(`Failed to store instrument ${instrument.tradingsymbol}:`, error);
                    }
                }
            }

            // Progress update
            const progress = ((i + batch.length) / instruments.length * 100).toFixed(1);
            logger.info(`   Progress: ${progress}% (${storedCount} stored, ${updatedCount} updated, ${errorCount} errors)`);
        }

        const successRate = ((storedCount + updatedCount) / instruments.length * 100);

        return {
            totalFetched: instruments.length,
            stored: storedCount,
            updated: updatedCount,
            errors: errorCount,
            successRate
        };
    }

    /**
     * Store a single instrument in database
     */
    private async storeSingleInstrument(instrument: ZerodhaInstrument): Promise<void> {
        // Check if instrument already exists
        const existingInstrument = await db.instrument.findUnique({
            where: { symbol: instrument.tradingsymbol }
        });

        if (existingInstrument) {
            throw new Error(`Instrument ${instrument.tradingsymbol} already exists`);
        }

        // Create new instrument
        await db.instrument.create({
            data: {
                symbol: instrument.tradingsymbol,
                name: instrument.name,
                exchange: instrument.exchange,
                instrumentType: instrument.instrument_type,
                lotSize: instrument.lot_size || null,
                tickSize: instrument.tick_size || null,
                underlyingSymbol: this.extractUnderlyingSymbol(instrument) || null,
                strikePrice: instrument.strike || null,
                expiryDate: instrument.expiry ? new Date(instrument.expiry) : null,
                optionType: this.extractOptionType(instrument) || null,
                contractSize: instrument.lot_size || null,
                isActive: true
            }
        });
    }

    /**
     * Update a single instrument in database
     */
    private async updateSingleInstrument(instrument: ZerodhaInstrument): Promise<void> {
        await db.instrument.update({
            where: { symbol: instrument.tradingsymbol },
            data: {
                name: instrument.name,
                exchange: instrument.exchange,
                instrumentType: instrument.instrument_type,
                lotSize: instrument.lot_size || null,
                tickSize: instrument.tick_size || null,
                underlyingSymbol: this.extractUnderlyingSymbol(instrument),
                strikePrice: instrument.strike || null,
                expiryDate: instrument.expiry ? new Date(instrument.expiry) : null,
                optionType: this.extractOptionType(instrument),
                contractSize: instrument.lot_size || null,
                updatedAt: new Date()
            }
        });
    }

    /**
     * Extract underlying symbol for options/futures
     */
    private extractUnderlyingSymbol(instrument: ZerodhaInstrument): string | null {
        if (instrument.segment === 'NFO-OPT' || instrument.segment === 'NFO-FUT') {
            // For options/futures, extract the underlying from the name
            // Example: "NIFTY 23DEC 19500 CE" -> "NIFTY"
            const parts = instrument.name.split(' ');
            return parts[0] || null;
        }
        return null;
    }

    /**
     * Extract option type
     */
    private extractOptionType(instrument: ZerodhaInstrument): string | null {
        if (instrument.instrument_type === 'CE' || instrument.instrument_type === 'PE') {
            return instrument.instrument_type;
        }
        return null;
    }

    /**
     * Get instruments from database
     */
    async getInstrumentsFromDatabase(options: {
        exchange?: string;
        instrumentType?: string;
        isActive?: boolean;
        limit?: number;
        offset?: number;
    } = {}): Promise<any[]> {
        try {
            const where: any = {};

            if (options.exchange) {
                where.exchange = options.exchange;
            }

            if (options.instrumentType) {
                where.instrumentType = options.instrumentType;
            }

            if (options.isActive !== undefined) {
                where.isActive = options.isActive;
            }

            const findManyOptions: any = {
                where,
                orderBy: { symbol: 'asc' }
            };

            if (options.limit) {
                findManyOptions.take = options.limit;
            }

            if (options.offset) {
                findManyOptions.skip = options.offset;
            }

            const instruments = await db.instrument.findMany(findManyOptions);

            logger.info(`📊 Retrieved ${instruments.length} instruments from database`);
            return instruments;

        } catch (error) {
            logger.error('❌ Failed to get instruments from database:', error);
            throw error;
        }
    }

    /**
     * Search instruments in database
     */
    async searchInstrumentsInDatabase(query: string, options: {
        exchange?: string;
        instrumentType?: string;
        limit?: number;
    } = {}): Promise<any[]> {
        try {
            const where: any = {
                OR: [
                    { symbol: { contains: query, mode: 'insensitive' } },
                    { name: { contains: query, mode: 'insensitive' } }
                ]
            };

            if (options.exchange) {
                where.exchange = options.exchange;
            }

            if (options.instrumentType) {
                where.instrumentType = options.instrumentType;
            }

            const instruments = await db.instrument.findMany({
                where,
                take: options.limit || 50,
                orderBy: { symbol: 'asc' }
            });

            logger.info(`🔍 Found ${instruments.length} instruments matching "${query}"`);
            return instruments;

        } catch (error) {
            logger.error('❌ Failed to search instruments in database:', error);
            throw error;
        }
    }

    /**
     * Get database statistics
     */
    async getDatabaseStatistics(): Promise<{
        totalInstruments: number;
        activeInstruments: number;
        byExchange: Record<string, number>;
        byInstrumentType: Record<string, number>;
    }> {
        try {
            const totalInstruments = await db.instrument.count();
            const activeInstruments = await db.instrument.count({ where: { isActive: true } });

            const exchangeStats = await db.instrument.groupBy({
                by: ['exchange'],
                _count: { exchange: true }
            });

            const instrumentTypeStats = await db.instrument.groupBy({
                by: ['instrumentType'],
                _count: { instrumentType: true }
            });

            const byExchange: Record<string, number> = {};
            exchangeStats.forEach(stat => {
                byExchange[stat.exchange] = stat._count.exchange;
            });

            const byInstrumentType: Record<string, number> = {};
            instrumentTypeStats.forEach(stat => {
                byInstrumentType[stat.instrumentType] = stat._count.instrumentType;
            });

            return {
                totalInstruments,
                activeInstruments,
                byExchange,
                byInstrumentType
            };

        } catch (error) {
            logger.error('❌ Failed to get database statistics:', error);
            throw error;
        }
    }

    /**
     * Sync instruments between Zerodha and database
     */
    async syncInstruments(): Promise<{
        synced: number;
        added: number;
        updated: number;
        errors: number;
    }> {
        try {
            logger.info('🔄 Starting instrument synchronization...');

            // Get instruments from Zerodha
            const zerodhaInstruments = await this.getAllInstruments();

            // Get instruments from database
            const dbInstruments = await db.instrument.findMany({
                select: { symbol: true, updatedAt: true }
            });

            const dbSymbols = new Set(dbInstruments.map(inst => inst.symbol));
            let added = 0;
            let updated = 0;
            let errors = 0;

            for (const instrument of zerodhaInstruments) {
                try {
                    if (dbSymbols.has(instrument.tradingsymbol)) {
                        await this.updateSingleInstrument(instrument);
                        updated++;
                    } else {
                        await this.storeSingleInstrument(instrument);
                        added++;
                    }
                } catch (error) {
                    errors++;
                    logger.error(`Failed to sync instrument ${instrument.tradingsymbol}:`, error);
                }
            }

            const result = {
                synced: zerodhaInstruments.length,
                added,
                updated,
                errors
            };

            logger.info('✅ Instrument synchronization completed', result);
            return result;

        } catch (error) {
            logger.error('❌ Instrument synchronization failed:', error);
            throw error;
        }
    }

    /**
     * Get instruments by exchange from database
     */
    async getInstrumentsByExchangeFromDB(exchange: string): Promise<any[]> {
        return this.getInstrumentsFromDatabase({ exchange });
    }

    /**
     * Get active instruments from database
     */
    async getActiveInstrumentsFromDB(): Promise<any[]> {
        return this.getInstrumentsFromDatabase({ isActive: true });
    }

    /**
 * Get options instruments from database
 */
    async getOptionsInstrumentsFromDB(): Promise<any[]> {
        const instruments = await db.instrument.findMany({
            where: {
                instrumentType: { in: ['CE', 'PE'] }
            },
            orderBy: { symbol: 'asc' }
        });
        return instruments;
    }

    /**
     * Get equity instruments from database
     */
    async getEquityInstrumentsFromDB(): Promise<any[]> {
        return this.getInstrumentsFromDatabase({ instrumentType: 'EQ' });
    }
} 