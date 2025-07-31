const { PrismaClient } = require('@prisma/client');

async function countInstruments() {
  const prisma = new PrismaClient();
  
  try {
    console.log('📊 COUNTING INSTRUMENTS IN DATABASE...\n');
    
    // Total count
    const total = await prisma.instrument.count();
    console.log(`Total instruments: ${total}`);
    
    // By exchange
    const byExchange = await prisma.instrument.groupBy({
      by: ['exchange'],
      _count: {
        id: true
      }
    });
    
    console.log('\nBy Exchange:');
    byExchange.forEach(e => {
      console.log(`  ${e.exchange || 'NULL'}: ${e._count.id}`);
    });
    
    // By active status
    const byActive = await prisma.instrument.groupBy({
      by: ['isActive'],
      _count: {
        id: true
      }
    });
    
    console.log('\nBy Active Status:');
    byActive.forEach(a => {
      console.log(`  ${a.isActive ? 'Active' : 'Inactive'}: ${a._count.id}`);
    });
    
    // Sample instruments
    const sampleInstruments = await prisma.instrument.findMany({
      take: 10,
      select: {
        symbol: true,
        name: true,
        exchange: true,
        isActive: true
      }
    });
    
    console.log('\nSample Instruments:');
    sampleInstruments.forEach(inst => {
      console.log(`  ${inst.symbol} (${inst.exchange || 'N/A'}) - ${inst.name || 'No name'} - ${inst.isActive ? 'Active' : 'Inactive'}`);
    });
    
    // Count candle data
    const candleDataCount = await prisma.candleData.count();
    console.log(`\nTotal candle data records: ${candleDataCount}`);
    
    // Count timeframes
    const timeframeCount = await prisma.timeframe.count();
    console.log(`Total timeframes: ${timeframeCount}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

countInstruments(); 