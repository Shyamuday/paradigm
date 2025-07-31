#!/usr/bin/env ts-node
import { connectDatabase, disconnectDatabase } from './database/database';
import { AutoMarketTrader } from './auto-market-trader';

async function main() {
  console.log('🚀 Starting Paradigm Minimal Trading System');

  try {
    await connectDatabase();
    console.log('✅ Database connected successfully');

    // Check if we should auto-start trading
    const shouldAutoTrade = process.argv.includes('--auto-trade') || process.argv.includes('--live');

    if (shouldAutoTrade) {
      console.log('\n🎯 Auto-trading mode enabled!');
      console.log('📅 Checking market hours and starting live trading...\n');

      const trader = new AutoMarketTrader();
      await trader.start();
    } else {
      console.log('\n📊 Available commands:');
      console.log('  npm start -- --auto-trade  - Auto start live trading during market hours');
      console.log('  npm start -- --live        - Force start live trading');
      console.log('  npm run db:studio          - Open database studio');
      console.log('  npm run db:generate        - Generate Prisma client');
      console.log('  npm run db:push            - Push database schema');

      console.log('\n💡 Tip: Run "npm start -- --auto-trade" to automatically start live trading during market hours (9 AM - 3:30 PM, Mon-Fri)');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    const shouldAutoTrade = process.argv.includes('--auto-trade') || process.argv.includes('--live');
    if (!shouldAutoTrade) {
      await disconnectDatabase();
    }
  }
}

if (require.main === module) {
  main();
} 
