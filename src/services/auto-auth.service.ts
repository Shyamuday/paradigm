import { KiteConnect } from 'kiteconnect';
import express from 'express';
import { CredentialManagerService } from './credential-manager.service';
import { logger } from '../logger/logger';

export class AutoAuthService {
    private static instance: AutoAuthService;
    private credentialManager: CredentialManagerService;
    private kite: KiteConnect | null = null;
    private isAuthenticated = false;

    private constructor() {
        this.credentialManager = CredentialManagerService.getInstance();
    }

    public static getInstance(): AutoAuthService {
        if (!AutoAuthService.instance) {
            AutoAuthService.instance = new AutoAuthService();
        }
        return AutoAuthService.instance;
    }

    /**
     * Automatic authentication flow
     * 1. Check for existing valid session
     * 2. If no session, check for stored credentials
     * 3. If no credentials, prompt for login
     */
    async authenticate(userEmail: string, userName?: string): Promise<KiteConnect> {
        try {
            logger.info('🔐 Starting automatic authentication...');

            const provider = 'zerodha';
            const userId = await this.credentialManager.getOrCreateUser(userEmail, userName);
            logger.info(`👤 User ID: ${userId}`);

            // Step 1: Check for existing valid session
            const existingSession = await this.credentialManager.getActiveAuthSession(userId, provider);
            if (existingSession) {
                logger.info('✅ Found existing valid session');
                this.kite = new KiteConnect({ api_key: '4kii2cglymgxjpqq' }); // We'll get the real key from credentials
                this.kite.setAccessToken(existingSession.accessToken);

                // Test the session
                const profile = await this.kite.getProfile();
                logger.info(`✅ Session validated - User: ${profile.user_name}`);
                this.isAuthenticated = true;
                return this.kite;
            }

            // Step 2: Check for stored credentials
            let credentials = await this.credentialManager.getApiCredentials(userId, provider);
            if (!credentials) {
                logger.info('📝 No stored credentials found. Saving default credentials...');

                // Save default credentials
                await this.credentialManager.saveApiCredentials(
                    userId,
                    provider,
                    '4kii2cglymgxjpqq',
                    'fmapqarltxl0lhyetqeasfgjias6ov3h',
                    'http://localhost:3000/callback'
                );

                credentials = await this.credentialManager.getApiCredentials(userId, provider);
            }

            if (!credentials) {
                throw new Error('Failed to get API credentials');
            }

            // Step 3: Try to use stored credentials for silent login
            this.kite = new KiteConnect({ api_key: credentials.apiKey });

            // Check if we have a file-based session as fallback
            const fileSession = await this.checkFileSession();
            if (fileSession) {
                logger.info('📄 Using file-based session as fallback');
                this.kite.setAccessToken(fileSession.access_token);

                // Test and save to database
                try {
                    const profile = await this.kite.getProfile();
                    await this.saveSessionToDatabase(userId, provider, fileSession, profile);
                    this.isAuthenticated = true;
                    return this.kite;
                } catch (error) {
                    logger.warn('File session expired, proceeding with OAuth login');
                }
            }

            // Step 4: OAuth login required
            logger.info('🔄 No valid session found, starting OAuth login...');
            await this.performOAuthLogin(userId, provider, credentials);

            this.isAuthenticated = true;
            return this.kite!;

        } catch (error) {
            logger.error('❌ Authentication failed:', error);
            throw error;
        }
    }

    /**
     * Check for file-based session
     */
    private async checkFileSession(): Promise<any> {
        try {
            const fs = require('fs');
            const path = require('path');
            const sessionFile = path.join(process.cwd(), 'data', 'zerodha-session.json');

            if (fs.existsSync(sessionFile)) {
                const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
                if (new Date() < new Date(sessionData.expires_at)) {
                    return sessionData;
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Save session to database
     */
    private async saveSessionToDatabase(userId: string, provider: string, sessionData: any, profile: any): Promise<void> {
        await this.credentialManager.saveAuthSession(userId, provider, {
            accessToken: sessionData.access_token,
            refreshToken: sessionData.refresh_token || undefined,
            userType: profile.user_type,
            userName: profile.user_name,
            userShortname: profile.user_shortname,
            email: profile.email,
            mobile: (profile as any).mobile,
            broker: profile.broker,
            exchanges: profile.exchanges || [],
            products: profile.products || [],
            orderTypes: profile.order_types || [],
            loginTime: new Date(sessionData.login_time),
            expiresAt: new Date(sessionData.expires_at)
        });
    }

    /**
     * Perform OAuth login
     */
    private async performOAuthLogin(userId: string, provider: string, credentials: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const app = express();
            const PORT = 3000;

            app.get('/', (req, res) => {
                logger.info('🔐 Redirecting to Kite login...');
                const loginURL = this.kite!.getLoginURL();
                res.redirect(loginURL);
            });

            app.get('/callback', async (req, res) => {
                try {
                    const requestToken = req.query.request_token as string;
                    if (!requestToken) {
                        throw new Error('No request token received');
                    }

                    logger.info('✅ Received request token, generating session...');
                    const sessionResponse = await this.kite!.generateSession(requestToken, credentials.apiSecret);

                    // Set access token
                    this.kite!.setAccessToken(sessionResponse.access_token);

                    // Save to database
                    await this.saveSessionToDatabase(userId, provider, sessionResponse, sessionResponse);

                    logger.info('✅ OAuth login successful, session saved to database');

                    res.send(`
                        <h2>✅ Login Successful!</h2>
                        <p>User: ${sessionResponse.user_name}</p>
                        <p>Email: ${sessionResponse.email}</p>
                        <p>Session saved to database. You can close this window.</p>
                    `);

                    resolve();
                } catch (error) {
                    logger.error('❌ OAuth login failed:', error);
                    res.status(500).send(`
                        <h2>❌ Login Failed</h2>
                        <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
                    `);
                    reject(error);
                }
            });

            const server = app.listen(PORT, async () => {
                logger.info(`
🔐 Automatic OAuth Login
------------------------
1. Starting local server for authentication
2. Opening Kite login page in your browser
3. After login, session will be saved to database
                `);

                try {
                    const { default: open } = await import('open');
                    await open(`http://localhost:${PORT}`);
                } catch (error) {
                    logger.info('Please open http://localhost:3000 manually');
                }
            });

            server.on('close', () => {
                logger.info('Login server closed');
            });
        });
    }

    /**
     * Get current KiteConnect instance
     */
    getKite(): KiteConnect | null {
        return this.kite;
    }

    /**
     * Check if authenticated
     */
    isUserAuthenticated(): boolean {
        return this.isAuthenticated;
    }

    /**
     * Logout and clear sessions
     */
    async logout(userId: string, provider: string): Promise<void> {
        try {
            await this.credentialManager.deactivateSessions(userId, provider);
            this.isAuthenticated = false;
            this.kite = null;
            logger.info('✅ Logout successful');
        } catch (error) {
            logger.error('❌ Logout failed:', error);
            throw error;
        }
    }
} 