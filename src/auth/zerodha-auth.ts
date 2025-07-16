import { KiteConnect } from 'kiteconnect';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import open from 'open';

// API Credentials
const API_CREDENTIALS = {
    API_KEY: "4kii2cglymgxjpqq",
    API_SECRET: "fmapqarltxl0lhyetqeasfgjias6ov3h",
    CLIENT_ID: "XB7556",
    // Use environment variable for redirect URL with fallback to localhost
    REDIRECT_URL: process.env.KITE_REDIRECT_URL || "http://localhost:3000/callback"
};

interface SavedSession {
    access_token: string;
    refresh_token?: string;
    user_id: string;
    user_name: string;
    expires_at: string;
    login_time: string;
}

export class ZerodhaAuth {
    private kite: InstanceType<typeof KiteConnect>;
    private sessionFile: string;

    constructor() {
        // Initialize KiteConnect
        this.kite = new KiteConnect({
            api_key: API_CREDENTIALS.API_KEY
        });

        // Setup session storage
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        this.sessionFile = path.join(dataDir, 'zerodha-session.json');
    }

    /**
     * Start OAuth login flow
     */
    async startOAuthLogin(): Promise<void> {
        const app = express();
        const PORT = 3000;

        return new Promise((resolve, reject) => {
            // Handle the initial redirect to Kite login
            app.get('/', (req, res) => {
                console.log('\n🔐 Redirecting to Kite login...');
                const loginURL = this.kite.getLoginURL();
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
                    const session = await this.kite.generateSession(requestToken, API_CREDENTIALS.API_SECRET);

                    // Set the access token
                    this.kite.setAccessToken(session.access_token);

                    // Save session info
                    const sessionData: SavedSession = {
                        access_token: session.access_token,
                        refresh_token: session.refresh_token,
                        user_id: session.user_id,
                        user_name: session.user_name,
                        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                        login_time: new Date().toISOString()
                    };

                    fs.writeFileSync(this.sessionFile, JSON.stringify(sessionData, null, 2));

                    console.log('\n✅ Login successful!');
                    console.log(`User: ${session.user_name}`);
                    console.log(`Email: ${session.email}`);

                    res.send(`
                        <h2>✅ Login Successful!</h2>
                        <p>User: ${session.user_name}</p>
                        <p>Email: ${session.email}</p>
                        <p>Session has been saved. You can close this window.</p>
                    `);

                    // Test API access
                    const profile = await this.kite.getProfile();
                    console.log('\nAPI Connection Test:', profile ? '✅ Successful' : '❌ Failed');

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
            const server = app.listen(PORT, () => {
                console.log(`
🔐 Zerodha OAuth Login
----------------------
1. Starting local server for authentication
2. Opening Kite login page in your browser
3. After login, you'll be redirected back here
                `);
                open(`http://localhost:${PORT}`);
            });

            // Cleanup
            server.on('close', () => {
                console.log('Login server closed');
            });
        });
    }

    /**
     * Login with manual token (enctoken from Kite Web)
     */
    async loginWithToken(enctoken: string): Promise<void> {
        try {
            // Initialize with token
            this.kite.setAccessToken(enctoken);

            // Test the connection
            const profile = await this.kite.getProfile();

            // Save session
            const sessionData: SavedSession = {
                access_token: enctoken,
                user_id: profile.user_id,
                user_name: profile.user_name,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                login_time: new Date().toISOString()
            };

            fs.writeFileSync(this.sessionFile, JSON.stringify(sessionData, null, 2));

            console.log('\n✅ Manual token login successful!');
            console.log(`User: ${profile.user_name}`);
            console.log(`User ID: ${profile.user_id}`);

        } catch (error) {
            console.error('\n❌ Manual token login failed:', error);
            throw error;
        }
    }

    /**
     * Check if we have a valid session
     */
    checkSession(): boolean {
        try {
            if (fs.existsSync(this.sessionFile)) {
                const session = JSON.parse(fs.readFileSync(this.sessionFile, 'utf8')) as SavedSession;
                const expiresAt = new Date(session.expires_at);

                if (expiresAt > new Date()) {
                    console.log('\n✅ Found valid session:');
                    console.log(`User: ${session.user_name}`);
                    console.log(`Expires: ${expiresAt.toLocaleString()}`);

                    // Set the access token
                    this.kite.setAccessToken(session.access_token);
                    return true;
                }
            }
        } catch (error) {
            console.error('Error reading session:', error);
        }
        return false;
    }

    /**
     * Get the KiteConnect instance
     */
    getKite(): InstanceType<typeof KiteConnect> {
        return this.kite;
    }

    /**
     * Logout and invalidate session
     */
    async logout(): Promise<void> {
        try {
            await this.kite.invalidateAccessToken();
            if (fs.existsSync(this.sessionFile)) {
                fs.unlinkSync(this.sessionFile);
            }
            console.log('\n✅ Logged out successfully');
        } catch (error) {
            console.error('\n❌ Logout failed:', error);
            throw error;
        }
    }
} 