import { OrderUpdateHandler, OrderUpdate } from './order-updates';
import ngrok from 'ngrok';

async function main() {
    try {
        console.log('\n🔄 Starting Zerodha Webhook Server');
        console.log('--------------------------------');

        // Start the webhook server
        const webhookHandler = new OrderUpdateHandler(3000);

        // Listen for order updates
        webhookHandler.on('orderUpdate', (update: OrderUpdate) => {
            console.log('\n📊 Order Update Details:');
            console.log(JSON.stringify(update, null, 2));
        });

        await webhookHandler.start();

        // Start ngrok
        console.log('\n🔒 Starting secure tunnel with ngrok...');
        const url = await ngrok.connect({
            addr: 3000,
            proto: 'http'
        });

        console.log('\n✅ Setup complete!');
        console.log('\nUse this URL as your Postback URL in Zerodha:');
        console.log(`${url}/kite/postback`);
        console.log('\nThis URL will be different each time you restart ngrok.');
        console.log('Make sure to update it in your Zerodha settings.');

        // Keep the process running
        process.on('SIGINT', async () => {
            console.log('\n\n🛑 Shutting down...');
            await ngrok.kill();
            await webhookHandler.stop();
            process.exit(0);
        });

    } catch (error) {
        console.error('\n❌ Error starting webhook server:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
} 