import { ZerodhaAuth } from './zerodha-auth';

async function testOAuthLogin() {
    try {
        console.log("\n🔐 Testing Zerodha OAuth Login");
        console.log("--------------------------------");

        const auth = new ZerodhaAuth();

        // Check if we have a valid session
        if (auth.checkSession()) {
            console.log("\n✅ Found existing valid session!");

            // Test the connection
            const kite = auth.getKite();
            const profile = await kite.getProfile();
            console.log(`User: ${profile.user_name}`);
            console.log(`User ID: ${profile.user_id}`);
            return;
        }

        // Start OAuth login flow
        console.log("\n🌐 Starting OAuth login flow...");
        console.log("A browser window will open for Zerodha login");
        console.log("Callback URL: http://localhost:3000/callback");

        await auth.startOAuthLogin();

        console.log("\n✅ OAuth login flow completed!");
        console.log("You can now close this terminal");

    } catch (error) {
        console.error("\n❌ Error during OAuth login:");
        if (error instanceof Error) {
            console.error("→", error.message);
        }
        console.log("\nPossible solutions:");
        console.log("1. Make sure http://localhost:3000/callback is set as your redirect URL in Zerodha developer console");
        console.log("2. Check if your API key is active in Kite Connect dashboard");
        console.log("3. Verify that your Zerodha account is active");
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    testOAuthLogin().catch(console.error);
} 