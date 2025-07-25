import { KiteConnect } from 'kiteconnect';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import { logger } from '../logger/logger';
import {
    SessionDataSchema,
    ZerodhaLoginResponseSchema,
    AccessTokenValidationSchema,
    ZerodhaErrorResponseSchema,
    type SessionData,
    type ZerodhaLoginResponse,
    type AccessTokenValidation
} from '../schemas/auth.schema';
import { z } from 'zod';

// Session data interface (legacy for file storage)
interface SavedSession {
    access_token: string;
    refresh_token?: string | undefined;
    user_id: string;
    user_name?: string | undefined;
    email?: string | undefined;
    expires_at: string;
    login_time: string;
}


export class ZerodhaAuth {
    private kite: InstanceType<typeof KiteConnect>;
    private sessionFile: string;
    private apiKey: string;
    private apiSecret: string;
    private redirectUrl: string;

    constructor(apiKey?: string, apiSecret?: string, redirectUrl?: string) {
        // Use provided credentials or environment variables
        this.apiKey = apiKey || process.env.ZERODHA_API_KEY || '';
        this.apiSecret = apiSecret || process.env.ZERODHA_API_SECRET || '';
        this.redirectUrl = redirectUrl || process.env.KITE_REDIRECT_URL || "http://localhost:3000/callback";

        if (!this.apiKey || !this.apiSecret) {
            throw new Error('API Key and Secret are required. Provide them as parameters or set ZERODHA_API_KEY and ZERODHA_API_SECRET environment variables.');
        }

        // Initialize KiteConnect
        this.kite = new KiteConnect({
            api_key: this.apiKey
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

                    // Generate session with validation
                    const sessionResponse = await this.kite.generateSession(requestToken, this.apiSecret);

                    // Validate the response using Zod
                    const validatedSession = ZerodhaLoginResponseSchema.parse(sessionResponse);

                    if (validatedSession.status === 'error' || !validatedSession.data) {
                        throw new Error(validatedSession.message || 'Login failed');
                    }

                    const session = validatedSession.data;

                    // Set the access token
                    this.kite.setAccessToken(session.access_token);

                    // Save session info
                    await this.saveSession({
                        access_token: session.access_token,
                        refresh_token: session.refresh_token || undefined,
                        user_id: session.user_id,
                        user_name: session.user_name,
                        email: session.email || undefined,
                        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                        login_time: new Date().toISOString()
                    });

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
                    const profileTestResponse = await this.kite.getProfile();
                    const validatedProfileTest = AccessTokenValidationSchema.parse(profileTestResponse);
                    console.log('\nAPI Connection Test:', validatedProfileTest.status === 'success' ? '✅ Successful' : '❌ Failed');

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

                // Open browser (only in non-test environment)
                if (process.env.NODE_ENV !== 'test') {
                    try {
                        const { default: open } = await import('open');
                        await open(`http://localhost:${PORT}`);
                    } catch (error) {
                        console.log('Could not open browser automatically. Please open http://localhost:3000 manually.');
                    }
                } else {
                    console.log('Test environment detected. Please open http://localhost:3000 manually if needed.');
                }
            });

            // Cleanup
            server.on('close', () => {
                console.log('Login server closed');
            });
        });
    }

    /**
     * Login with access token (from OAuth or manual)
     */
    async loginWithToken(accessToken: string): Promise<void> {
        try {
            // Set the access token
            this.kite.setAccessToken(accessToken);

            // Verify token by getting profile with validation
            const profileResponse = await this.kite.getProfile();

            // Validate the profile response using Zod
            const validatedProfile = AccessTokenValidationSchema.parse(profileResponse);

            if (validatedProfile.status === 'error' || !validatedProfile.data) {
                throw new Error(validatedProfile.message || 'Token validation failed');
            }

            const profile = validatedProfile.data;

            // Save session
            await this.saveSession({
                access_token: accessToken,
                user_id: profile.user_id,
                user_name: profile.user_name,
                email: profile.email || undefined,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                login_time: new Date().toISOString()
            });

            console.log('\n✅ Token login successful!');
            console.log(`User: ${profile.user_name}`);
            console.log(`User ID: ${profile.user_id}`);

        } catch (error) {
            console.error('\n❌ Token login failed:', error);
            throw error;
        }
    }

    /**
     * Save session data to file
     */
    private async saveSession(sessionData: SavedSession): Promise<void> {
        try {
            fs.writeFileSync(this.sessionFile, JSON.stringify(sessionData, null, 2));
        } catch (error) {
            console.error('Failed to save session:', error);
            throw error;
        }
    }

    /**
     * Check if we have a valid session
     */
    async hasValidSession(): Promise<boolean> {
        try {
            if (!fs.existsSync(this.sessionFile)) {
                return false;
            }

            const sessionData: SavedSession = JSON.parse(fs.readFileSync(this.sessionFile, 'utf8'));

            // Check if session is expired
            if (new Date() > new Date(sessionData.expires_at)) {
                console.log('Session expired');
                return false;
            }

            // Set the access token and test it
            this.kite.setAccessToken(sessionData.access_token);
            const profileResponse = await this.kite.getProfile();

            // Validate the profile response
            const validatedProfile = AccessTokenValidationSchema.parse(profileResponse);

            if (validatedProfile.status === 'error' || !validatedProfile.data) {
                logger.warn('Session validation failed:', validatedProfile.message);
                return false;
            }

            console.log('\n✅ Valid session found');
            console.log(`User: ${validatedProfile.data.user_name}`);

            return true;
        } catch (error) {
            console.log('No valid session found:', error instanceof Error ? error.message : 'Unknown error');
            return false;
        }
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

    /**
     * Get login URL for manual authentication
     */
    getLoginURL(): string {
        return this.kite.getLoginURL();
    }
} 