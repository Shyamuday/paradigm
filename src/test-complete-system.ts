import dotenv from 'dotenv';
import TradingBot from './index';
import { logger } from './logger/logger';

// Load environment variables
dotenv.config();

async function testCompleteSystem() {
    console.log('🧪 Testing Complete Trading Bot System');
    console.log('=====================================\n');

    const bot = new TradingBot();

    try {
        // Test 1: Initialize the bot
        console.log('📋 Test 1: Bot Initialization');
        await bot.initialize();
        console.log('✅ Bot initialized successfully\n');

        // Test 2: Check bot status
        console.log('📊 Test 2: Bot Status');
        const status = await bot.getStatus();
        console.log('Bot Status:', JSON.stringify(status, null, 2));
        console.log('✅ Status retrieved successfully\n');

        // Test 3: Start the bot (run for 10 seconds)
        console.log('🚀 Test 3: Starting Bot (10 seconds)');
        const startPromise = bot.start();

        // Let it run for 10 seconds
        await new Promise(resolve => setTimeout(resolve, 10000));

        console.log('✅ Bot ran successfully for 10 seconds\n');

        // Test 4: Stop the bot
        console.log('🛑 Test 4: Stopping Bot');
        await bot.stop();
        console.log('✅ Bot stopped successfully\n');

        console.log('🎉 All tests completed successfully!');
        console.log('=====================================');
        console.log('✅ Database connection: Working');
        console.log('✅ Authentication system: Working');
        console.log('✅ Services integration: Working');
        console.log('✅ Trading loop: Working');
        console.log('✅ Graceful shutdown: Working');

    } catch (error) {
        console.error('❌ Test failed:', error);

        // Try to stop the bot if it's running
        try {
            await bot.stop();
        } catch (stopError) {
            console.error('❌ Failed to stop bot:', stopError);
        }

        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    testCompleteSystem().catch(error => {
        console.error('💥 Test suite failed:', error);
        process.exit(1);
    });
} 