import axios, { AxiosInstance } from 'axios';
import * as qs from 'qs';
import { authenticator } from 'otplib';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { logger } from '../logger/logger';

export interface ZerodhaApiAuthConfig {
    apiKey: string;
    apiSecret: string;
    userId: string;
    password: string;
    totpSecret: string; // Base32 TOTP secret key
    redirectUri?: string;
}

export interface ZerodhaApiSession {
    accessToken: string;
    publicToken: string;
    userId: string;
    loginTime: string;
    tokenExpiryTime: string;
    refreshToken?: string;
}

export class ZerodhaApiAuth extends EventEmitter {
    private config: ZerodhaApiAuthConfig;
    private session: ZerodhaApiSession | null = null;
    private sessionFilePath: string;
    private httpClient: AxiosInstance;

    constructor(config: ZerodhaApiAuthConfig) {
        super();
        this.config = {
            ...config,
            redirectUri: config.redirectUri || 'https://127.0.0.1'
        };
        this.sessionFilePath = path.join(process.cwd(), 'data', 'zerodha-api-session.json');

        // Create axios instance with session support
        this.httpClient = axios.create({
            withCredentials: true,
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin'
            }
        });
    }

    async initialize(): Promise<void> {
        try {
            logger.info('Initializing Zerodha API Authentication...');

            // Ensure data directory exists
            await this.ensureDataDirectory();

            // Try to load existing session
            const existingSession = await this.loadSession();
            if (existingSession && this.isSessionValid(existingSession)) {
                this.session = existingSession;
                logger.info('Using existing valid session');
                this.emit('session_loaded', this.session);
                return;
            }

            // Perform fresh login
            await this.performApiLogin();

        } catch (error) {
            logger.error('Failed to initialize Zerodha API auth:', error);
            throw error;
        }
    }

    private async performApiLogin(): Promise<void> {
        try {
            logger.info('Starting API-based Zerodha login process...');

            // Step 1: Generate login URL and get initial cookies
            const loginUrl = this.generateLoginUrl();
            logger.info('Login URL generated:', loginUrl);

            // Step 2: Get login page to establish session
            logger.info('Getting login page to establish session...');
            await this.httpClient.get(loginUrl);

            // Step 3: Post credentials
            logger.info('Posting credentials...');
            await this.httpClient.post('https://kite.zerodha.com/api/login', {
                user_id: this.config.userId,
                password: this.config.password
            });

            // Step 4: Generate and post TOTP
            logger.info('Generating and posting TOTP...');
            const totp = this.generateTOTP();
            logger.info('TOTP generated:', totp);

            await this.httpClient.post('https://kite.zerodha.com/api/twofa', {
                user_id: this.config.userId,
                request_id: null,
                twofa_value: totp
            });

            // Step 5: Follow redirect to extract request_token
            logger.info('Following redirect to extract request token...');
            try {
                await this.httpClient.get(loginUrl, { maxRedirects: 0 });
            } catch (error: any) {
                if (error.response && error.response.status === 302) {
                    const redirectUrl = error.response.headers.location;
                    logger.info('Redirect URL:', redirectUrl);

                    const url = new URL(redirectUrl);
                    const requestToken = url.searchParams.get('request_token');

                    if (!requestToken) {
                        throw new Error('No request token found in redirect URL');
                    }

                    logger.info('Request token extracted:', requestToken);

                    // Step 6: Generate session with request token
                    await this.generateSession(requestToken);

                    logger.info('API login completed successfully');
                    this.emit('login_success', this.session);
                    return;
                }
                throw error;
            }

            throw new Error('No redirect received after 2FA');

        } catch (error) {
            logger.error('API login failed:', error);
            this.emit('login_failed', error);
            throw error;
        }
    }

    private generateLoginUrl(): string {
        return `https://kite.zerodha.com/connect/login?v=3&api_key=${this.config.apiKey}`;
    }

    private generateTOTP(): string {
        try {
            if (!this.config.totpSecret) {
                throw new Error('TOTP secret not provided');
            }

            // Generate TOTP using otplib
            const token = authenticator.generate(this.config.totpSecret);
            return token;

        } catch (error) {
            logger.error('Failed to generate TOTP:', error);
            throw new Error('TOTP generation failed');
        }
    }

    private async generateSession(requestToken: string): Promise<void> {
        try {
            logger.info('Generating session with request token...');

            // Generate checksum
            const checksum = this.generateChecksum(requestToken);

            // POST to session/token endpoint
            const response = await axios.post('https://api.kite.trade/session/token',
                qs.stringify({
                    api_key: this.config.apiKey,
                    request_token: requestToken,
                    checksum: checksum
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            const sessionData = response.data.data;

            // Create session object
            this.session = {
                accessToken: sessionData.access_token,
                publicToken: sessionData.public_token,
                userId: sessionData.user_id,
                loginTime: new Date().toISOString(),
                tokenExpiryTime: this.calculateTokenExpiry(),
                refreshToken: sessionData.refresh_token
            };

            // Save session
            await this.saveSession(this.session);

            logger.info('Session generated successfully');

        } catch (error) {
            logger.error('Session generation failed:', error);
            throw error;
        }
    }

    private generateChecksum(requestToken: string): string {
        const data = this.config.apiKey + requestToken + this.config.apiSecret;
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    private calculateTokenExpiry(): string {
        // Kite tokens expire at 6 AM IST next day
        const now = new Date();
        const expiry = new Date(now);
        expiry.setHours(6, 0, 0, 0);

        // If current time is after 6 AM, set expiry to next day
        if (now.getHours() >= 6) {
            expiry.setDate(expiry.getDate() + 1);
        }

        return expiry.toISOString();
    }

    private async ensureDataDirectory(): Promise<void> {
        const dataDir = path.dirname(this.sessionFilePath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    private async loadSession(): Promise<ZerodhaApiSession | null> {
        try {
            if (!fs.existsSync(this.sessionFilePath)) {
                return null;
            }

            const sessionData = fs.readFileSync(this.sessionFilePath, 'utf8');
            const session = JSON.parse(sessionData) as ZerodhaApiSession;

            logger.info('Session loaded from file');
            return session;

        } catch (error) {
            logger.error('Failed to load session:', error);
            return null;
        }
    }

    private async saveSession(session: ZerodhaApiSession): Promise<void> {
        try {
            fs.writeFileSync(this.sessionFilePath, JSON.stringify(session, null, 2));
            logger.info('Session saved to file');
        } catch (error) {
            logger.error('Failed to save session:', error);
        }
    }

    private isSessionValid(session: ZerodhaApiSession): boolean {
        try {
            const now = new Date();
            const expiry = new Date(session.tokenExpiryTime);
            return now < expiry;
        } catch {
            return false;
        }
    }

    async makeAuthenticatedRequest(endpoint: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', data?: any): Promise<any> {
        try {
            if (!this.session) {
                throw new Error('No active session. Please login first.');
            }

            const config: any = {
                method,
                url: `https://api.kite.trade${endpoint}`,
                headers: {
                    'Authorization': `token ${this.config.apiKey}:${this.session.accessToken}`,
                    'X-Kite-Version': '3'
                }
            };

            if (data) {
                if (method === 'POST') {
                    config.data = data;
                } else if (method === 'GET') {
                    config.params = data;
                }
            }

            const response = await axios(config);
            return response.data;

        } catch (error: any) {
            logger.error('API request failed:', error.response?.data || error.message);
            throw error;
        }
    }

    getSession(): ZerodhaApiSession | null {
        return this.session;
    }

    async logout(): Promise<void> {
        try {
            if (this.session) {
                // Call logout API
                await this.makeAuthenticatedRequest('/session/token', 'DELETE');

                // Clear session
                this.session = null;

                // Remove session file
                if (fs.existsSync(this.sessionFilePath)) {
                    fs.unlinkSync(this.sessionFilePath);
                }

                logger.info('Logout successful');
                this.emit('logout');
            }
        } catch (error) {
            logger.error('Logout failed:', error);
            throw error;
        }
    }
} 