import { ZerodhaAuth } from '../auth/zerodha-auth';
import { EnhancedInstrumentsManager } from '../services/enhanced-instruments-manager.service';
import { logger } from '../logger/logger';

/**
 * Enhanced Instruments Manager Example
 * 
 * This example demonstrates:
 * 1. Fetching all instruments from Zerodha and storing in database
 * 2. Retrieving instruments from database with various filters
 * 3. Searching instruments in database
 * 4. Getting database statistics
 * 5. Synchronizing instruments between Zerodha and database
 */

async function enhancedInstrumentsExample() {
    let auth: ZerodhaAuth | null = null;
    let manager: EnhancedInstrumentsManager | null = null;

    try {
        console.log('🚀 Starting Enhanced Instruments Manager Example');

        // 1. Initialize authentication
        console.log('\n🔐 Initializing authentication...');
        auth = new ZerodhaAuth();

        const hasValidSession = await auth.hasValidSession();
        if (!hasValidSession) {
            console.log('🔄 No valid session found, starting OAuth login...');
            await auth.startOAuthLogin();
        } else {
            console.log('✅ Using existing valid session');
        }

        // 2. Initialize enhanced instruments manager
        console.log('\n📋 Initializing enhanced instruments manager...');
        manager = new EnhancedInstrumentsManager(auth);

        // 3. Fetch and store all instruments
        console.log('\n📈 Fetching and storing all instruments...');
        const fetchResult = await manager.fetchAndStoreAllInstruments();

        console.log('\n📊 Fetch and Store Results:');
        console.log(`   Total fetched: ${fetchResult.totalFetched}`);
        console.log(`   Stored: ${fetchResult.stored}`);
        console.log(`   Updated: ${fetchResult.updated}`);
        console.log(`   Errors: ${fetchResult.errors}`);
        console.log(`   Success rate: ${fetchResult.successRate.toFixed(1)}%`);

        // 4. Get database statistics
        console.log('\n📈 Getting database statistics...');
        const stats = await manager.getDatabaseStatistics();

        console.log('\n🗄️ Database Statistics:');
        console.log(`   Total instruments: ${stats.totalInstruments}`);
        console.log(`   Active instruments: ${stats.activeInstruments}`);

        console.log('\n📊 By Exchange:');
        Object.entries(stats.byExchange).forEach(([exchange, count]) => {
            console.log(`   ${exchange}: ${count} instruments`);
        });

        console.log('\n📊 By Instrument Type:');
        Object.entries(stats.byInstrumentType).forEach(([type, count]) => {
            console.log(`   ${type}: ${count} instruments`);
        });

        // 5. Search instruments in database
        console.log('\n🔍 Searching for instruments...');

        // Search for NIFTY instruments
        const niftyInstruments = await manager.searchInstrumentsInDatabase('NIFTY', { limit: 10 });
        console.log(`\n📋 Found ${niftyInstruments.length} NIFTY instruments:`);
        niftyInstruments.slice(0, 5).forEach((inst, index) => {
            console.log(`   ${index + 1}. ${inst.symbol} - ${inst.name} (${inst.exchange})`);
        });

        // Search for RELIANCE instruments
        const relianceInstruments = await manager.searchInstrumentsInDatabase('RELIANCE', { limit: 5 });
        console.log(`\n📋 Found ${relianceInstruments.length} RELIANCE instruments:`);
        relianceInstruments.forEach((inst, index) => {
            console.log(`   ${index + 1}. ${inst.symbol} - ${inst.name} (${inst.exchange})`);
        });

        // 6. Get instruments by exchange
        console.log('\n📊 Getting instruments by exchange...');

        const nseInstruments = await manager.getInstrumentsByExchangeFromDB('NSE');
        console.log(`   NSE instruments: ${nseInstruments.length}`);

        const bseInstruments = await manager.getInstrumentsByExchangeFromDB('BSE');
        console.log(`   BSE instruments: ${bseInstruments.length}`);

        const nfoInstruments = await manager.getInstrumentsByExchangeFromDB('NFO');
        console.log(`   NFO instruments: ${nfoInstruments.length}`);

        // 7. Get specific instrument types
        console.log('\n📊 Getting specific instrument types...');

        const equityInstruments = await manager.getEquityInstrumentsFromDB();
        console.log(`   Equity instruments: ${equityInstruments.length}`);

        const optionsInstruments = await manager.getOptionsInstrumentsFromDB();
        console.log(`   Options instruments: ${optionsInstruments.length}`);

        // 8. Get active instruments with pagination
        console.log('\n📊 Getting active instruments with pagination...');

        const activeInstruments = await manager.getInstrumentsFromDatabase({
            isActive: true,
            limit: 20,
            offset: 0
        });
        console.log(`   First 20 active instruments: ${activeInstruments.length}`);

        console.log('\n📋 Sample active instruments:');
        activeInstruments.slice(0, 10).forEach((inst, index) => {
            console.log(`   ${index + 1}. ${inst.symbol} - ${inst.name} (${inst.exchange})`);
        });

        // 9. Synchronize instruments (optional - for demonstration)
        console.log('\n🔄 Synchronizing instruments...');
        const syncResult = await manager.syncInstruments();

        console.log('\n📊 Sync Results:');
        console.log(`   Synced: ${syncResult.synced}`);
        console.log(`   Added: ${syncResult.added}`);
        console.log(`   Updated: ${syncResult.updated}`);
        console.log(`   Errors: ${syncResult.errors}`);

        console.log('\n🎉 Enhanced Instruments Manager Example completed successfully!');

    } catch (error) {
        console.error('\n❌ Enhanced Instruments Manager Example failed:', error);
        logger.error('Enhanced instruments example failed:', error);
    }
}

// Handle script execution
if (require.main === module) {
    enhancedInstrumentsExample()
        .then(() => {
            console.log('\n✅ Example completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Example failed:', error);
            process.exit(1);
        });
}

export { enhancedInstrumentsExample }; 