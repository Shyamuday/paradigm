#!/usr/bin/env ts-node

import { NiftyCategorizationService } from '../services/nifty-categorization.service';
import { ZerodhaAuth } from '../auth/zerodha-auth';
import { logger } from '../logger/logger';

export async function niftyTradingExample() {
    try {
        console.log('🎯 Nifty Trading Strategy Example\n');

        const niftyService = new NiftyCategorizationService();
        const auth = new ZerodhaAuth();

        // Check authentication
        if (!(await auth.hasValidSession())) {
            console.log('❌ No valid session found. Please login first.');
            return;
        }

        console.log('✅ Authentication successful');

        // 1. Get Nifty 50 instruments for index trading
        console.log('\n📊 1. NIFTY 50 Trading Setup');
        const nifty50Instruments = await niftyService.getInstrumentsForIndex('NIFTY_50');
        const nifty50ETFs = await niftyService.getETFsForIndex('NIFTY_50');
        const nifty50Options = await niftyService.getActiveOptionsForIndex('NIFTY_50');

        console.log(`   NIFTY 50 Instruments: ${nifty50Instruments.length}`);
        console.log(`   NIFTY 50 ETFs: ${nifty50ETFs.length}`);
        console.log(`   NIFTY 50 Active Options: ${nifty50Options.length}`);

        // 2. Get Bank Nifty instruments for sector trading
        console.log('\n🏦 2. BANKNIFTY Trading Setup');
        const bankNiftyInstruments = await niftyService.getInstrumentsForIndex('BANKNIFTY');
        const bankNiftyOptions = await niftyService.getActiveOptionsForIndex('BANKNIFTY');

        console.log(`   BANKNIFTY Instruments: ${bankNiftyInstruments.length}`);
        console.log(`   BANKNIFTY Active Options: ${bankNiftyOptions.length}`);

        // 3. Get constituent stocks for portfolio construction
        console.log('\n📋 3. Constituent Stocks for Portfolio Construction');
        const nifty50Constituents = await niftyService.getNifty50Constituents();
        const bankNiftyConstituents = await niftyService.getBankNiftyConstituents();

        console.log(`   NIFTY 50 Constituents: ${nifty50Constituents.length} stocks`);
        console.log(`   BANKNIFTY Constituents: ${bankNiftyConstituents.length} stocks`);

        // 4. Example: Nifty 50 Index Trading Strategy
        console.log('\n📈 4. Nifty 50 Index Trading Strategy Example');

        // Get the main Nifty 50 index instrument
        const nifty50Index = nifty50Instruments.find(inst =>
            inst.name === 'NIFTY 50' && inst.instrumentType === 'INDEX'
        );

        if (nifty50Index) {
            console.log(`   Main Index: ${nifty50Index.symbol} (${nifty50Index.name})`);

            // Example ETF for index tracking
            const trackingETF = nifty50ETFs.find(etf =>
                etf.name.includes('SBI-ETF NIFTY 50') || etf.name.includes('NIFTY 50 ETF')
            );

            if (trackingETF) {
                console.log(`   Tracking ETF: ${trackingETF.symbol} (${trackingETF.name})`);
            }
        }

        // 5. Example: Options Trading Strategy
        console.log('\n🎯 5. Options Trading Strategy Example');

        if (nifty50Options.length > 0) {
            // Get ATM options (closest to current market price)
            const atmOptions = nifty50Options.filter(option =>
                option.strikePrice && option.strikePrice >= 22000 && option.strikePrice <= 23000
            );

            if (atmOptions.length > 0) {
                console.log(`   ATM Options Available: ${atmOptions.length}`);

                // Example: Bull Call Spread
                const callOptions = atmOptions.filter(opt => opt.optionType === 'CE');
                const putOptions = atmOptions.filter(opt => opt.optionType === 'PE');

                if (callOptions.length >= 2) {
                    const lowerStrike = callOptions[0];
                    const higherStrike = callOptions[1];
                    if (lowerStrike && higherStrike) {
                        console.log(`   Bull Call Spread Setup:`);
                        console.log(`     Buy: ${lowerStrike.symbol} (Strike: ${lowerStrike.strikePrice})`);
                        console.log(`     Sell: ${higherStrike.symbol} (Strike: ${higherStrike.strikePrice})`);
                    }
                }
            }
        }

        // 6. Example: Sector Rotation Strategy
        console.log('\n🔄 6. Sector Rotation Strategy Example');

        const sectoralIndices = [
            'NIFTY_IT', 'NIFTY_PHARMA', 'NIFTY_AUTO', 'NIFTY_METAL',
            'NIFTY_REALTY', 'NIFTY_FMCG', 'NIFTY_ENERGY', 'NIFTY_INFRA'
        ];

        for (const sector of sectoralIndices) {
            const sectorInstruments = await niftyService.getInstrumentsForIndex(sector);
            if (sectorInstruments.length > 0) {
                console.log(`   ${sector}: ${sectorInstruments.length} instruments available`);
            }
        }

        // 7. Example: Multi-Index Portfolio
        console.log('\n💼 7. Multi-Index Portfolio Example');

        const portfolioIndices = ['NIFTY_50', 'NIFTY_NEXT_50', 'NIFTY_MIDCAP_100'];
        const portfolio: Record<string, { totalInstruments: number; etfs: number; sampleETF: string }> = {};

        for (const index of portfolioIndices) {
            const instruments = await niftyService.getInstrumentsForIndex(index);
            const etfs = await niftyService.getETFsForIndex(index);

            portfolio[index] = {
                totalInstruments: instruments.length,
                etfs: etfs.length,
                sampleETF: etfs[0]?.symbol || 'N/A'
            };
        }

        console.log('   Portfolio Allocation:');
        Object.entries(portfolio).forEach(([index, data]) => {
            console.log(`     ${index}: ${data.totalInstruments} instruments, ${data.etfs} ETFs`);
            if (data.sampleETF !== 'N/A') {
                console.log(`       Sample ETF: ${data.sampleETF}`);
            }
        });

        // 8. Example: Risk Management with Different Indices
        console.log('\n🛡️ 8. Risk Management Strategy Example');

        // Conservative: NIFTY 50 (Large Cap)
        const conservativeInstruments = await niftyService.getInstrumentsForIndex('NIFTY_50');

        // Moderate: NIFTY 100 (Large + Mid Cap)
        const moderateInstruments = await niftyService.getInstrumentsForIndex('NIFTY_100');

        // Aggressive: NIFTY 500 (All Cap)
        const aggressiveInstruments = await niftyService.getInstrumentsForIndex('NIFTY_500');

        console.log('   Risk Profiles:');
        console.log(`     Conservative (NIFTY 50): ${conservativeInstruments.length} instruments`);
        console.log(`     Moderate (NIFTY 100): ${moderateInstruments.length} instruments`);
        console.log(`     Aggressive (NIFTY 500): ${aggressiveInstruments.length} instruments`);

        // 9. Example: Search and Filter Instruments
        console.log('\n🔍 9. Advanced Search Example');

        // Search for specific instruments
        const searchResults = await niftyService.searchNiftyInstruments('ETF');
        console.log(`   ETFs containing "ETF": ${searchResults.length} found`);

        if (searchResults.length > 0) {
            console.log('   Sample ETFs:');
            searchResults.slice(0, 5).forEach(inst => {
                console.log(`     ${inst.symbol} | ${inst.name}`);
            });
        }

        // 10. Example: Market Analysis Setup
        console.log('\n📊 10. Market Analysis Setup');

        const stats = await niftyService.getNiftyStatistics();
        console.log(`   Total Nifty Instruments: ${stats.totalInstruments}`);
        console.log('   Market Coverage:');

        Object.entries(stats.byIndex)
            .filter(([, count]) => count > 10)
            .sort(([, a], [, b]) => b - a)
            .forEach(([index, count]) => {
                console.log(`     ${index}: ${count} instruments`);
            });

        console.log('\n✅ Nifty Trading Example completed successfully!');
        console.log('\n🎯 Key Takeaways:');
        console.log('   • You can now categorize all Nifty instruments by index');
        console.log('   • Build index-based trading strategies');
        console.log('   • Create sector rotation portfolios');
        console.log('   • Implement options strategies on indices');
        console.log('   • Construct multi-index portfolios');
        console.log('   • Search and filter instruments efficiently');

    } catch (error) {
        logger.error('Error in Nifty trading example:', error);
        console.error('❌ Error:', error);
    }
}

// Run the example if called directly
if (require.main === module) {
    niftyTradingExample();
} 