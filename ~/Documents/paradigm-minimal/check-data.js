const { PrismaClient } = require('@prisma/client');

async function checkData() {
  const prisma = new PrismaClient();
  
  try {
    console.log('📊 Checking database data...\n');
    
    // Check timeframes
    const timeframes = await prisma.timeframe.findMany();
    console.log('Available timeframes:');
    timeframes.forEach(tf => console.log(`  - ${tf.name} (${tf.minutes} minutes)`));
    
    // Check instruments with data
    const instrumentsWithData = await prisma.candleData.groupBy({
      by: ['instrumentId'],
      _count: { id: true }
    });
    
    console.log(`\nInstruments with data: ${instrumentsWithData.length}`);
    
    // Get sample data
    const sampleData = await prisma.candleData.findFirst({
      include: {
        instrument: true,
        timeframe: true
      }
    });
    
    if (sampleData) {
      console.log(`\nSample data: ${sampleData.instrument.symbol} ${sampleData.timeframe.name} ${sampleData.timestamp}`);
      console.log(`Sample OHLC: O:${sampleData.open} H:${sampleData.high} L:${sampleData.low} C:${sampleData.close} V:${sampleData.volume}`);
    }
    
    // Get data count by timeframe
    const dataByTimeframe = await prisma.candleData.groupBy({
      by: ['timeframeId'],
      _count: { id: true },
      include: {
        timeframe: true
      }
    });
    
    console.log('\nData by timeframe:');
    dataByTimeframe.forEach(item => {
      console.log(`  - ${item.timeframe.name}: ${item._count.id} records`);
    });
    
    // Get data count by instrument
    const dataByInstrument = await prisma.candleData.groupBy({
      by: ['instrumentId'],
      _count: { id: true },
      include: {
        instrument: true
      }
    });
    
    console.log('\nTop 10 instruments by data count:');
    dataByInstrument
      .sort((a, b) => b._count.id - a._count.id)
      .slice(0, 10)
      .forEach(item => {
        console.log(`  - ${item.instrument.symbol}: ${item._count.id} records`);
      });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData(); 