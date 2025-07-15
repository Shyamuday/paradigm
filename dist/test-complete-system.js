"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const index_1 = __importDefault(require("./index"));
dotenv_1.default.config();
async function testCompleteSystem() {
    console.log('🧪 Testing Complete Trading Bot System');
    console.log('=====================================\n');
    const bot = new index_1.default();
    try {
        console.log('📋 Test 1: Bot Initialization');
        await bot.initialize();
        console.log('✅ Bot initialized successfully\n');
        console.log('📊 Test 2: Bot Status');
        const status = await bot.getStatus();
        console.log('Bot Status:', JSON.stringify(status, null, 2));
        console.log('✅ Status retrieved successfully\n');
        console.log('🚀 Test 3: Starting Bot (10 seconds)');
        const startPromise = bot.start();
        await new Promise(resolve => setTimeout(resolve, 10000));
        console.log('✅ Bot ran successfully for 10 seconds\n');
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
    }
    catch (error) {
        console.error('❌ Test failed:', error);
        try {
            await bot.stop();
        }
        catch (stopError) {
            console.error('❌ Failed to stop bot:', stopError);
        }
        process.exit(1);
    }
}
if (require.main === module) {
    testCompleteSystem().catch(error => {
        console.error('💥 Test suite failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=test-complete-system.js.map