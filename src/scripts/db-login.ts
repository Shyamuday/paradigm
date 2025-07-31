import { KiteConnect } from 'kiteconnect';
import express from 'express';
import { CredentialManagerService } from '../services/credential-manager.service';

/**
 * Database-based login using stored credentials
 */
async function dbLogin() {
    try {
        console.log('🔐 Starting Database-Based Zerodha Login...');

        const credentialManager = CredentialManagerService.getInstance();

        // User details (in a real app, this would come from user input or session)
        const userEmail = 'shyamkumar.jnv@gmail.com';
        const userName = 'Shyam Kumar';
        const provider = 'zerodha';

        // Get or create user
        const userId = await credentialManager.getOrCreateUser(userEmail, userName);
        console.log(`👤 User ID: ${userId}`);

        // Check if we have stored credentials
        let credentials = await credentialManager.getApiCredentials(userId, provider);

        if (!credentials) {
            console.log('📝 No stored credentials found. Saving default credentials...');

            // Save default credentials to database
            await credentialManager.saveApiCredentials(
                userId,
                provider,
                '4kii2cglymgxjpqq',
                'fmapqarltxl0lhyetqeasfgjias6ov3h',
                'http://localhost:3000/callback'
            );

            credentials = await credentialManager.getApiCredentials(userId, provider);
        }

        if (!credentials) {
            throw new Error('Failed to get API credentials from database');
        }

        console.log(`📋 Using API Key: ${credentials.apiKey}`);
        console.log(`🔑 Using API Secret: ${credentials.apiSecret.substring(0, 8)}...`);

        // Initialize KiteConnect
        const kite = new KiteConnect({
            api_key: credentials.apiKey
        });

        // Check if we have a valid session in database
        const dbSession = await credentialManager.getActiveAuthSession(userId, provider);

        if (dbSession) {
            console.log('✅ Using existing valid session from database');
            kite.setAccessToken(dbSession.accessToken);

            // Test the session
            const profile = await kite.getProfile();
            console.log('\n📊 User Profile:');
            console.log(`   Name: ${profile.user_name}`);
            console.log(`   Email: ${profile.email}`);
            console.log(`   User ID: ${profile.user_id}`);
            console.log(`   Session expires: ${dbSession.expiresAt.toLocaleString()}`);
            return;
        }

        console.log('🔄 No valid session found in database, starting OAuth login...');

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

                    // Generate session
                    const sessionResponse = await kite.generateSession(requestToken, credentials!.apiSecret);

                    console.log('\n📋 Session Response:');
                    console.log(`   User: ${sessionResponse.user_name}`);
                    console.log(`   Email: ${sessionResponse.email}`);
                    console.log(`   User ID: ${sessionResponse.user_id}`);

                    // Set the access token
                    kite.setAccessToken(sessionResponse.access_token);

                    // Save session to database
                    await credentialManager.saveAuthSession(userId, provider, {
                        accessToken: sessionResponse.access_token,
                        refreshToken: sessionResponse.refresh_token || undefined,
                        userType: sessionResponse.user_type,
                        userName: sessionResponse.user_name,
                        userShortname: sessionResponse.user_shortname,
                        email: sessionResponse.email,
                        mobile: (sessionResponse as any).mobile,
                        broker: sessionResponse.broker,
                        exchanges: sessionResponse.exchanges || [],
                        products: sessionResponse.products || [],
                        orderTypes: sessionResponse.order_types || [],
                        loginTime: new Date(sessionResponse.login_time),
                        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
                    });

                    console.log('\n✅ Login successful! Session saved to database.');
                    console.log(`User: ${sessionResponse.user_name}`);
                    console.log(`Email: ${sessionResponse.email}`);

                    res.send(`
                        <h2>✅ Login Successful!</h2>
                        <p>User: ${sessionResponse.user_name}</p>
                        <p>Email: ${sessionResponse.email}</p>
                        <p>Session has been saved to database. You can close this window.</p>
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
🔐 Zerodha OAuth Login (Database)
---------------------------------
1. Starting local server for authentication
2. Opening Kite login page in your browser
3. After login, session will be saved to database
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
        console.error('❌ Database login failed:', error);
        throw error;
    } finally {
        // Close database connection
        await CredentialManagerService.getInstance().disconnect();
    }
}

// Run the database login
if (require.main === module) {
    dbLogin()
        .then(() => {
            console.log('\n🎉 Database login completed successfully!');
            console.log('✅ Credentials and session are now stored in the database');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Login failed:', error);
            process.exit(1);
        });
}

export { dbLogin }; 