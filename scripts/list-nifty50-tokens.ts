#!/usr/bin/env ts-node

import { DatabaseManager } from '../src/database/database';
import { db } from '../src/database/database';
import { NiftyCategorizationService } from '../src/services/nifty-categorization.service';
import { logger } from '../src/logger/logger';

interface TokenInfo {
    symbol: string;
    name: string;
    instrumentToken: number;
    exchange: string;
    instrumentType: string;
    category: string[];
}

export async function listNifty50Tokens() {
    try {
        console.log('📊 Listing All Nifty 50 Tokens from Database...\n');

        // Initialize services
        const dbManager = DatabaseManager.getInstance();
        const niftyService = new NiftyCategorizationService();

        // Connect to database
        await dbManager.connect();
        console.log('✅ Connected to database');

        // Get Nifty 50 constituent symbols
        const nifty50Constituents = await niftyService.getNifty50Constituents();
        console.log(`📋 Found ${nifty50Constituents.length} Nifty 50 constituent symbols`);

        // Get all Nifty-related instruments from database
        const allNiftyInstruments = await db.instrument.findMany({
            where: {
                OR: [
                    { name: { contains: 'NIFTY', mode: 'insensitive' } },
                    { symbol: { contains: 'NIFTY', mode: 'insensitive' } },
                    { symbol: { in: nifty50Constituents } }
                ]
            },
            orderBy: [
                { name: 'asc' },
                { symbol: 'asc' }
            ]
        });

        console.log(`📈 Found ${allNiftyInstruments.length} Nifty-related instruments in database`);

        // Categorize instruments
        const categorizedTokens = {
            'NIFTY_50_INDEX': [] as TokenInfo[],
            'NIFTY_50_CONSTITUENTS': [] as TokenInfo[],
            'NIFTY_50_OPTIONS': [] as TokenInfo[],
            'NIFTY_50_FUTURES': [] as TokenInfo[],
            'NIFTY_50_ETFS': [] as TokenInfo[],
            'OTHER_NIFTY': [] as TokenInfo[]
        };

        // Process each instrument
        allNiftyInstruments.forEach(inst => {
            const tokenInfo: TokenInfo = {
                symbol: inst.symbol,
                name: inst.name,
                instrumentToken: parseInt(inst.symbol),
                exchange: inst.exchange,
                instrumentType: inst.instrumentType,
                category: []
            };

            // Categorize based on type and name
            if (inst.instrumentType === 'INDEX' && inst.name.includes('NIFTY 50')) {
                categorizedTokens['NIFTY_50_INDEX'].push(tokenInfo);
                tokenInfo.category.push('INDEX');
            } else if (inst.instrumentType === 'EQ' && nifty50Constituents.includes(inst.symbol)) {
                categorizedTokens['NIFTY_50_CONSTITUENTS'].push(tokenInfo);
                tokenInfo.category.push('CONSTITUENT');
            } else if ((inst.instrumentType === 'CE' || inst.instrumentType === 'PE') &&
                inst.name.includes('NIFTY 50')) {
                categorizedTokens['NIFTY_50_OPTIONS'].push(tokenInfo);
                tokenInfo.category.push('OPTION');
            } else if (inst.instrumentType === 'FUT' && inst.name.includes('NIFTY 50')) {
                categorizedTokens['NIFTY_50_FUTURES'].push(tokenInfo);
                tokenInfo.category.push('FUTURE');
            } else if (inst.instrumentType === 'EQ' && inst.name.includes('NIFTY 50')) {
                categorizedTokens['NIFTY_50_ETFS'].push(tokenInfo);
                tokenInfo.category.push('ETF');
            } else {
                categorizedTokens['OTHER_NIFTY'].push(tokenInfo);
                tokenInfo.category.push('OTHER');
            }
        });

        // Display results
        console.log('\n📊 NIFTY 50 TOKENS BREAKDOWN');
        console.log('==================================================');

        // Show Nifty 50 Index
        if (categorizedTokens['NIFTY_50_INDEX'].length > 0) {
            console.log('\n🔝 NIFTY 50 INDEX:');
            console.log('--------------------------------------------------');
            categorizedTokens['NIFTY_50_INDEX'].forEach(token => {
                console.log(`   📈 ${token.symbol} | ${token.name} | Token: ${token.instrumentToken} | Exchange: ${token.exchange}`);
            });
        }

        // Show Nifty 50 Constituent Stocks
        if (categorizedTokens['NIFTY_50_CONSTITUENTS'].length > 0) {
            console.log('\n🏢 NIFTY 50 CONSTITUENT STOCKS:');
            console.log('--------------------------------------------------');
            categorizedTokens['NIFTY_50_CONSTITUENTS'].forEach((token, index) => {
                console.log(`   ${(index + 1).toString().padStart(2, ' ')}. ${token.symbol.padEnd(15)} | ${token.name.padEnd(30)} | Token: ${token.instrumentToken.toString().padStart(8, ' ')} | ${token.exchange}`);
            });
        }

        // Show Nifty 50 Options
        if (categorizedTokens['NIFTY_50_OPTIONS'].length > 0) {
            console.log('\n📊 NIFTY 50 OPTIONS (Sample - First 10):');
            console.log('--------------------------------------------------');
            categorizedTokens['NIFTY_50_OPTIONS'].slice(0, 10).forEach(token => {
                console.log(`   ${token.symbol.padEnd(20)} | ${token.name.padEnd(40)} | Token: ${token.instrumentToken.toString().padStart(8, ' ')} | ${token.exchange}`);
            });
            if (categorizedTokens['NIFTY_50_OPTIONS'].length > 10) {
                console.log(`   ... and ${categorizedTokens['NIFTY_50_OPTIONS'].length - 10} more options`);
            }
        }

        // Show Nifty 50 Futures
        if (categorizedTokens['NIFTY_50_FUTURES'].length > 0) {
            console.log('\n📈 NIFTY 50 FUTURES:');
            console.log('--------------------------------------------------');
            categorizedTokens['NIFTY_50_FUTURES'].forEach(token => {
                console.log(`   ${token.symbol.padEnd(20)} | ${token.name.padEnd(40)} | Token: ${token.instrumentToken.toString().padStart(8, ' ')} | ${token.exchange}`);
            });
        }

        // Show Nifty 50 ETFs
        if (categorizedTokens['NIFTY_50_ETFS'].length > 0) {
            console.log('\n💼 NIFTY 50 ETFs:');
            console.log('--------------------------------------------------');
            categorizedTokens['NIFTY_50_ETFS'].forEach(token => {
                console.log(`   ${token.symbol.padEnd(20)} | ${token.name.padEnd(40)} | Token: ${token.instrumentToken.toString().padStart(8, ' ')} | ${token.exchange}`);
            });
        }

        // Show Other Nifty instruments
        if (categorizedTokens['OTHER_NIFTY'].length > 0) {
            console.log('\n🔍 OTHER NIFTY-RELATED INSTRUMENTS:');
            console.log('--------------------------------------------------');
            categorizedTokens['OTHER_NIFTY'].forEach(token => {
                console.log(`   ${token.symbol.padEnd(20)} | ${token.name.padEnd(40)} | Token: ${token.instrumentToken.toString().padStart(8, ' ')} | ${token.exchange} | ${token.instrumentType}`);
            });
        }

        // Summary statistics
        console.log('\n📊 SUMMARY STATISTICS');
        console.log('==================================================');
        Object.entries(categorizedTokens).forEach(([category, tokens]) => {
            if (tokens.length > 0) {
                console.log(`   ${category.padEnd(25)}: ${tokens.length.toString().padStart(3, ' ')} tokens`);
            }
        });

        // Show total unique tokens
        const allTokens = new Set<number>();
        Object.values(categorizedTokens).flat().forEach(token => {
            allTokens.add(token.instrumentToken);
        });

        console.log(`\n   Total Unique Tokens: ${allTokens.size}`);

        // Export to JSON option
        console.log('\n💾 Export Options:');
        console.log('   - All tokens are available in the database');
        console.log('   - Use the NiftyCategorizationService for programmatic access');
        console.log('   - Run this script anytime to get updated list');

        // Show sample usage
        console.log('\n🔧 Sample Usage:');
        console.log('   const niftyService = new NiftyCategorizationService();');
        console.log('   const constituents = await niftyService.getNifty50Constituents();');
        console.log('   const instruments = await niftyService.getInstrumentsForIndex("NIFTY_50");');

        console.log('\n✅ Nifty 50 tokens listing completed!');

    } catch (error) {
        logger.error('Error listing Nifty 50 tokens:', error);
        console.error('❌ Error:', error);
    } finally {
        await DatabaseManager.getInstance().disconnect();
    }
}

// Run the script if called directly
if (require.main === module) {
    listNifty50Tokens();
} 