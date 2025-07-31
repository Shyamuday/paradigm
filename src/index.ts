#!/usr/bin/env ts-node
import { connectDatabase, disconnectDatabase } from './database/database';

async function main() {
  console.log('🚀 Starting Paradigm Minimal Trading System');

  try {
    await connectDatabase();
    console.log('✅ Database connected successfully');

    console.log('\n📊 Available commands:');
    console.log('  npm run paper-trade  - Start paper trading');
    console.log('  npm run monitor      - Monitor trading status');
    console.log('  npm run backtest     - Run backtest');
    console.log('  npm run db:studio    - Open database studio');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  main();
} 
