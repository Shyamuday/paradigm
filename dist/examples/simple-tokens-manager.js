"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const easy_auth_1 = require("../auth/easy-auth");
const instruments_manager_service_1 = require("../services/instruments-manager.service");
async function simpleTokensManager() {
    try {
        console.log('🔐 Authenticating...');
        const auth = await (0, easy_auth_1.createAutoTOTPAuth)();
        console.log('📊 Creating instruments manager...');
        const manager = new instruments_manager_service_1.InstrumentsManager(auth);
        console.log('\n📋 Step 1: Getting all available tokens...');
        const allInstruments = await manager.getAllInstruments();
        console.log(`✅ Total instruments available: ${allInstruments.length}`);
        const byExchange = allInstruments.reduce((acc, inst) => {
            acc[inst.exchange] = (acc[inst.exchange] || 0) + 1;
            return acc;
        }, {});
        console.log('\n📊 Breakdown by exchange:');
        Object.entries(byExchange).forEach(([exchange, count]) => {
            console.log(`   ${exchange}: ${count} instruments`);
        });
        console.log('\n📋 Step 2: Getting NSE tokens...');
        const nseTokens = await manager.getInstrumentsByExchange('NSE');
        console.log(`✅ NSE instruments: ${nseTokens.length}`);
        console.log('\n🔝 Top 10 NSE stocks:');
        nseTokens
            .filter(inst => inst.instrument_type === 'EQ')
            .slice(0, 10)
            .forEach((inst, index) => {
            console.log(`   ${index + 1}. ${inst.tradingsymbol} (Token: ${inst.instrument_token})`);
        });
        console.log('\n📋 Step 3: Selecting tokens for manual monitoring...');
        const selectedSymbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'WIPRO'];
        const selectedTokens = [];
        selectedSymbols.forEach(symbol => {
            const instrument = allInstruments.find(inst => inst.tradingsymbol === symbol);
            if (instrument) {
                selectedTokens.push(instrument.instrument_token);
                console.log(`✅ ${symbol}: Token ${instrument.instrument_token}`);
            }
            else {
                console.log(`❌ ${symbol}: Not found`);
            }
        });
        console.log('\n📋 Step 4: Getting live market data...');
        const ltps = await manager.getLTP(selectedTokens);
        console.log('\n💰 Last Traded Prices:');
        ltps.forEach((price, token) => {
            const instrument = allInstruments.find(inst => inst.instrument_token === token);
            console.log(`   ${instrument?.tradingsymbol}: ₹${price}`);
        });
        const quotes = await manager.getMarketQuotes(selectedTokens);
        console.log('\n📊 Full Market Quotes:');
        quotes.forEach((quote, token) => {
            const instrument = allInstruments.find(inst => inst.instrument_token === token);
            console.log(`   ${instrument?.tradingsymbol}:`);
            console.log(`     Current Price: ₹${quote.last_price}`);
            console.log(`     Day's Range: ₹${quote.ohlc.low} - ₹${quote.ohlc.high}`);
            console.log(`     Volume: ${quote.volume.toLocaleString()}`);
            console.log(`     Change: ${quote.net_change > 0 ? '+' : ''}${quote.net_change.toFixed(2)}%`);
        });
        console.log('\n📋 Step 5: Setting up manual monitoring...');
        manager.addToWatchlist(selectedTokens);
        let updateCount = 0;
        const maxUpdates = 12;
        const monitoringInterval = setInterval(async () => {
            updateCount++;
            console.log(`\n⏰ Update ${updateCount}/${maxUpdates} - ${new Date().toLocaleTimeString()}`);
            try {
                const freshLtps = await manager.getLTP(selectedTokens);
                console.log('📈 Current Prices:');
                freshLtps.forEach((price, token) => {
                    const instrument = allInstruments.find(inst => inst.instrument_token === token);
                    console.log(`   ${instrument?.tradingsymbol || token}: ₹${price}`);
                });
                if (updateCount > 1) {
                    const cachedData = manager.getAllMarketData();
                    if (cachedData.size > 0) {
                        console.log('📊 Changes since last update:');
                        cachedData.forEach((quote, token) => {
                            const instrument = allInstruments.find(inst => inst.instrument_token === token);
                            const currentPrice = freshLtps.get(token) || quote.last_price;
                            const change = currentPrice - quote.last_price;
                            const changePercent = (change / quote.last_price) * 100;
                            if (Math.abs(change) > 0.01) {
                                console.log(`   ${instrument?.tradingsymbol || token}: ${change > 0 ? '+' : ''}₹${change.toFixed(2)} (${changePercent.toFixed(2)}%)`);
                            }
                        });
                    }
                }
                if (updateCount % 3 === 0) {
                    await manager.updateWatchlistData();
                    console.log('🔄 Cache updated');
                }
            }
            catch (error) {
                console.log(`❌ Update failed: ${error}`);
            }
            if (updateCount >= maxUpdates) {
                clearInterval(monitoringInterval);
                console.log('\n⏹️ Manual monitoring completed');
                manager.exportMarketData('final_market_data.json');
                console.log('📁 Final data exported');
            }
        }, 10000);
        console.log('\n📋 Step 6: Getting historical data for analysis...');
        const relianceInstrument = allInstruments.find(inst => inst.tradingsymbol === 'RELIANCE');
        if (relianceInstrument) {
            const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const toDate = new Date().toISOString().split('T')[0];
            const historicalData = await manager.getHistoricalData(relianceInstrument.instrument_token, 'day', fromDate, toDate);
            console.log(`📈 RELIANCE Historical Data (30 days): ${historicalData.length} records`);
            const last5Days = historicalData.slice(-5);
            console.log('\n📊 Last 5 trading days:');
            last5Days.forEach(data => {
                console.log(`   ${data.date}: ₹${data.close} (Volume: ${data.volume?.toLocaleString() || data.volume || 'N/A'})`);
            });
            const prices = historicalData.map(d => d.close);
            if (prices.length > 0) {
                const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
                const currentPrice = prices[prices.length - 1];
                const priceChange = ((currentPrice - avgPrice) / avgPrice) * 100;
                console.log(`\n📊 Analysis:`);
                console.log(`   30-day average: ₹${avgPrice.toFixed(2)}`);
                console.log(`   Current price: ₹${currentPrice.toFixed(2)}`);
                console.log(`   vs Average: ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%`);
            }
        }
        console.log('\n🎉 Token management demonstration completed!');
        console.log('📁 Check the data/ folder for exported files');
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
}
if (require.main === module) {
    simpleTokensManager().catch(console.error);
}
//# sourceMappingURL=simple-tokens-manager.js.map