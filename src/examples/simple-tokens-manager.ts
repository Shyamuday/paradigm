import { ZerodhaAuth } from '../auth/zerodha-auth';
import { InstrumentsManager, ZerodhaInstrument } from '../services/instruments-manager.service';

/**
 * Simple example showing how to get all tokens and manage them manually
 */
async function simpleTokensManager(): Promise<void> {
    try {
        console.log('🔐 Authenticating...');
        const auth = new ZerodhaAuth();
        // Optionally, you may want to call await auth.startOAuthLogin() or similar if needed

        console.log('📊 Creating instruments manager...');
        const manager = new InstrumentsManager(auth);

        // 1. GET ALL AVAILABLE TOKENS/INSTRUMENTS
        console.log('\n📋 Step 1: Getting all available tokens...');
        const allInstruments = await manager.getAllInstruments();

        console.log(`✅ Total instruments available: ${allInstruments.length}`);

        // Show breakdown by exchange
        const byExchange = allInstruments.reduce((acc, inst) => {
            acc[inst.exchange] = (acc[inst.exchange] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        console.log('\n📊 Breakdown by exchange:');
        Object.entries(byExchange).forEach(([exchange, count]) => {
            console.log(`   ${exchange}: ${count} instruments`);
        });

        // 2. GET SPECIFIC EXCHANGE TOKENS
        console.log('\n📋 Step 2: Getting NSE tokens...');
        const nseTokens = await manager.getInstrumentsByExchange('NSE');
        console.log(`✅ NSE instruments: ${nseTokens.length}`);

        // Show top 10 NSE stocks by instrument token
        console.log('\n🔝 Top 10 NSE stocks:');
        nseTokens
            .filter(inst => inst.instrument_type === 'EQ')
            .slice(0, 10)
            .forEach((inst, index) => {
                console.log(`   ${index + 1}. ${inst.tradingsymbol} (Token: ${inst.instrument_token})`);
            });

        // 3. SELECT TOKENS FOR MONITORING
        console.log('\n📋 Step 3: Selecting tokens for manual monitoring...');
        const selectedSymbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'WIPRO'];
        const selectedTokens: string[] = [];

        selectedSymbols.forEach(symbol => {
            const instrument = allInstruments.find(inst => inst.tradingsymbol === symbol);
            if (instrument) {
                selectedTokens.push(instrument.tradingsymbol);
                console.log(`✅ ${symbol}: Token ${instrument.instrument_token}`);
            } else {
                console.log(`❌ ${symbol}: Not found`);
            }
        });

        // 4. GET LIVE MARKET DATA
        console.log('\n📋 Step 4: Getting live market data...');

        // Get LTP (Last Traded Price)
        const ltps = await manager.getLTPQuotes(selectedTokens);
        console.log('\n💰 Last Traded Prices:');
        ltps.forEach((ltpQuote, token) => {
            const instrument = allInstruments.find(inst => inst.tradingsymbol === token);
            console.log(`   ${instrument?.tradingsymbol}: ₹${ltpQuote.last_price}`);
        });

        // Get full market quotes
        const quotes = await manager.getMarketQuotes(selectedTokens);
        console.log('\n📊 Full Market Quotes:');
        quotes.forEach((quote, token) => {
            const instrument = allInstruments.find(inst => inst.tradingsymbol === token);
            console.log(`   ${instrument?.tradingsymbol}:`);
            console.log(`     Current Price: ₹${quote.last_price}`);
            console.log(`     Day's Range: ₹${quote.ohlc.low} - ₹${quote.ohlc.high}`);
            console.log(`     Volume: ${quote.volume.toLocaleString()}`);
            console.log(`     Change: ${quote.net_change > 0 ? '+' : ''}${quote.net_change.toFixed(2)}%`);
        });

        // 5. SETUP MANUAL TIME-BASED MONITORING
        console.log('\n📋 Step 5: Setting up manual monitoring...');

        // Add selected tokens to watchlist
        manager.addToWatchlist(selectedTokens);

        let updateCount = 0;
        const maxUpdates = 12; // Run for 12 updates (2 minutes with 10s intervals)

        // Manual monitoring with 10-second intervals
        const monitoringInterval = setInterval(async () => {
            updateCount++;

            console.log(`\n⏰ Update ${updateCount}/${maxUpdates} - ${new Date().toLocaleTimeString()}`);

            try {
                // Get fresh LTP data
                const freshLtps = await manager.getLTPQuotes(selectedTokens);

                console.log('📈 Current Prices:');
                freshLtps.forEach((ltpQuote, token) => {
                    const instrument = allInstruments.find(inst => inst.tradingsymbol === token);
                    console.log(`   ${instrument?.tradingsymbol || token}: ₹${ltpQuote.last_price}`);
                });

                // Calculate price changes (if we have previous data)
                if (updateCount > 1) {
                    const cachedData = manager.getAllMarketData();
                    if (cachedData.size > 0) {
                        console.log('📊 Changes since last update:');
                        cachedData.forEach((quote, token) => {
                            const instrument = allInstruments.find(inst => inst.tradingsymbol === token);
                            const currentLTP = freshLtps.get(token)?.last_price ?? quote.last_price;
                            const change = currentLTP - quote.last_price;
                            const changePercent = (change / quote.last_price) * 100;

                            if (Math.abs(change) > 0.01) {
                                console.log(`   ${instrument?.tradingsymbol || token}: ${change > 0 ? '+' : ''}₹${change.toFixed(2)} (${changePercent.toFixed(2)}%)`);
                            }
                        });
                    }
                }

                // Update cache every 3rd update
                if (updateCount % 3 === 0) {
                    await manager.updateWatchlistData();
                    console.log('🔄 Cache updated');
                }

            } catch (error) {
                console.log(`❌ Update failed: ${error}`);
            }

            // Stop after max updates
            if (updateCount >= maxUpdates) {
                clearInterval(monitoringInterval);
                console.log('\n⏹️ Manual monitoring completed');

                // Export final data
                manager.exportMarketData('final_market_data.json');
                console.log('📁 Final data exported');
            }
        }, 10000); // 10 seconds

        // 6. GET HISTORICAL DATA FOR ANALYSIS
        console.log('\n📋 Step 6: Getting historical data for analysis...');

        // Get historical data for RELIANCE
        const relianceInstrument = allInstruments.find(inst => inst.tradingsymbol === 'RELIANCE');
        if (relianceInstrument) {
            const fromDateRaw = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const toDateRaw = new Date().toISOString().split('T')[0];
            const fromDate = fromDateRaw || '';
            const toDate = toDateRaw || '';

            // Ensure relianceInstrument.instrument_token is number
            const instrumentToken = relianceInstrument.instrument_token;

            if (fromDate && toDate) {
                const historicalData = await manager.getHistoricalData(
                    instrumentToken,
                    'day',
                    fromDate,
                    toDate
                );

                console.log(`📈 RELIANCE Historical Data (30 days): ${historicalData.length} records`);

                // Show last 5 days
                const last5Days = historicalData.slice(-5);
                console.log('\n📊 Last 5 trading days:');
                last5Days.forEach(data => {
                    console.log(`   ${data.date}: ₹${data.close} (Volume: ${data.volume?.toLocaleString() || data.volume || 'N/A'})`);
                });

                // Simple analysis
                const prices = historicalData.map(d => d.close).filter((p): p is number => typeof p === 'number');
                if (prices.length > 0) {
                    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
                    const currentPrice = prices[prices.length - 1];
                    if (typeof currentPrice === 'number') {
                        const priceChange = ((currentPrice - avgPrice) / avgPrice) * 100;

                        console.log(`\n📊 Analysis:`);
                        console.log(`   30-day average: ₹${avgPrice.toFixed(2)}`);
                        console.log(`   Current price: ₹${currentPrice.toFixed(2)}`);
                        console.log(`   vs Average: ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%`);
                    } else {
                        console.log('   Current price is unavailable.');
                    }
                }
            }
        }

        console.log('\n🎉 Token management demonstration completed!');
        console.log('📁 Check the data/ folder for exported files');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run the simple example
if (require.main === module) {
    simpleTokensManager().catch(console.error);
} 