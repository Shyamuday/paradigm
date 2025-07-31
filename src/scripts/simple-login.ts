import { KiteConnect } from 'kiteconnect';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';

/**
 * Simple login without Zod validation to see actual response
 */
async function simpleLogin() {
    try {
        console.log('🔐 Starting Simple Zerodha Login...');

        // Use hardcoded credentials
        const apiKey = '4kii2cglymgxjpqq';
        const apiSecret = 'fmapqarltxl0lhyetqeasfgjias6ov3h';

        console.log(`📋 Using API Key: ${apiKey}`);
        console.log(`🔑 Using API Secret: ${apiSecret.substring(0, 8)}...`);

        // Initialize KiteConnect
        const kite = new KiteConnect({
            api_key: apiKey
        });

        // Setup session storage
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        const sessionFile = path.join(dataDir, 'zerodha-session.json');

        // Check if we have a valid session
        if (fs.existsSync(sessionFile)) {
            const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
            if (new Date() < new Date(sessionData.expires_at)) {
                console.log('✅ Using existing valid session');
                kite.setAccessToken(sessionData.access_token);

                // Test the session
                const profile = await kite.getProfile();
                console.log('\n📊 User Profile:');
                console.log(`   Name: ${profile.user_name}`);
                console.log(`   Email: ${profile.email}`);
                console.log(`   User ID: ${profile.user_id}`);
                return;
            }
        }

        console.log('🔄 No valid session found, starting OAuth login...');

        const app = express();
        const PORT = 3000;

        return new Promise<void>((resolve, reject) => {
            // Handle the initial redirect to Kite login
            app.get('/', (req, res) => {
                console.log('\n🔐 Redirecting to Kite login...');
                const loginURL = kite.getLoginURL();
                res.redirect(loginURL);
            });

            // Handle the callback from Kite
            app.get('/callback', async (req, res) => {
                try {
                    const requestToken = req.query.request_token as string;
                    if (!requestToken) {
                        throw new Error('No request token received');
                    }

                    console.log('\n✅ Received request token');
                    console.log('Generating session...');

                    // Generate session WITHOUT validation
                    const sessionResponse = await kite.generateSession(requestToken, apiSecret);

                    console.log('\n📋 Raw Session Response:');
                    console.log(JSON.stringify(sessionResponse, null, 2));

                    // Check if response has error (handle as any to avoid TypeScript issues)
                    const response = sessionResponse as any;
                    if (response.error_type) {
                        throw new Error(`Login failed: ${response.message}`);
                    }

                    // Set the access token
                    kite.setAccessToken(sessionResponse.access_token);

                    // Save session info
                    const sessionData = {
                        access_token: sessionResponse.access_token,
                        refresh_token: sessionResponse.refresh_token || undefined,
                        user_id: sessionResponse.user_id,
                        user_name: sessionResponse.user_name,
                        email: sessionResponse.email || undefined,
                        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                        login_time: new Date().toISOString()
                    };

                    fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));

                    console.log('\n✅ Login successful!');
                    console.log(`User: ${sessionResponse.user_name}`);
                    console.log(`Email: ${sessionResponse.email}`);

                    res.send(`
                        <h2>✅ Login Successful!</h2>
                        <p>User: ${sessionResponse.user_name}</p>
                        <p>Email: ${sessionResponse.email}</p>
                        <p>Session has been saved. You can close this window.</p>
                    `);

                    // Test API access
                    const profileTestResponse = await kite.getProfile();
                    console.log('\nAPI Connection Test:', profileTestResponse.user_name ? '✅ Successful' : '❌ Failed');

                    resolve();
                } catch (error) {
                    console.error('\n❌ Error during login:', error);
                    res.status(500).send(`
                        <h2>❌ Login Failed</h2>
                        <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
                        <p>Please try again.</p>
                    `);
                    reject(error);
                }
            });

            // Start server and open browser
            const server = app.listen(PORT, async () => {
                console.log(`
🔐 Zerodha OAuth Login
----------------------
1. Starting local server for authentication
2. Opening Kite login page in your browser
3. After login, you'll be redirected back here
                `);

                // Open browser
                try {
                    const { default: open } = await import('open');
                    await open(`http://localhost:${PORT}`);
                } catch (error) {
                    console.log('Could not open browser automatically. Please open http://localhost:3000 manually.');
                }
            });

            // Cleanup
            server.on('close', () => {
                console.log('Login server closed');
            });
        });

    } catch (error) {
        console.error('❌ Simple login failed:', error);
        throw error;
    }
}

// Run the simple login
if (require.main === module) {
    simpleLogin()
        .then(() => {
            console.log('\n🎉 Simple login completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Login failed:', error);
            process.exit(1);
        });
}

export { simpleLogin }; 