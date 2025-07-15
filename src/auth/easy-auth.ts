import axios from 'axios';
import * as qs from 'qs';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
const totp = require('totp-generator');
import { logger } from '../logger/logger';

export interface AutoTOTPConfig {
    apiKey: string;
    apiSecret: string;
    userId: string;
    password: string;
    totpSecret: string; // Required - Base32 TOTP secret
    redirectUri?: string;
}

export interface SavedSession {
    accessToken: string;
    publicToken: string;
    userId: string;
    loginTime: string;
    expiryTime: string;
}

export class AutoTOTPZerodhaAuth {
    private config: AutoTOTPConfig;
    private session: SavedSession | null = null;
    private sessionFilePath: string;
    private httpClient: any;

    constructor(config: AutoTOTPConfig) {
        // Validate required TOTP secret
        if (!config.totpSecret) {
            throw new Error('TOTP secret is required for automatic authentication');
        }

        this.config = {
            ...config,
            redirectUri: config.redirectUri || 'https://127.0.0.1'
        };

        // Store session in data directory
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        this.sessionFilePath = path.join(dataDir, 'zerodha-auto-session.json');

        // Create HTTP client with session support
        this.httpClient = axios.create({
            withCredentials: true,
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
    }

    /**
     * Automatic TOTP-based authentication - fully automated
     */
    async authenticate(): Promise<SavedSession> {
        try {
            console.log('🔐 Starting Automatic TOTP Authentication...\n');

            // Try to load existing session first
            const existingSession = this.loadSavedSession();
            if (existingSession && this.isSessionValid(existingSession)) {
                console.log('✅ Using existing valid session');
                console.log(`   User: ${existingSession.userId}`);
                console.log(`   Expires: ${existingSession.expiryTime}\n`);
                this.session = existingSession;
                return existingSession;
            }

            console.log('🔄 No valid session found, performing automatic login...\n');

            // Perform automatic login with TOTP
            const newSession = await this.performAutomaticLogin();

            // Save the session for future use
            this.saveSession(newSession);
            this.session = newSession;

            console.log('\n🎉 Automatic TOTP Authentication completed successfully!');
            console.log('   Session saved and ready for API calls\n');

            return newSession;

        } catch (error) {
            logger.error('Automatic TOTP authentication failed:', error);
            throw error;
        }
    }

    /**
     * Get current session
     */
    getSession(): SavedSession | null {
        return this.session;
    }

    /**
     * Make authenticated API calls
     */
    async apiCall(endpoint: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', data?: any): Promise<any> {
        if (!this.session) {
            throw new Error('No active session. Please call authenticate() first.');
        }

        const url = `https://api.kite.trade${endpoint}`;
        const headers = {
            'Authorization': `token ${this.config.apiKey}:${this.session.accessToken}`,
            'X-Kite-Version': '3'
        };

        try {
            let response;
            if (method === 'GET') {
                response = await axios.get(url, { headers });
            } else if (method === 'POST') {
                response = await axios.post(url, data, { headers });
            } else if (method === 'DELETE') {
                response = await axios.delete(url, { headers });
            }

            return response?.data;
        } catch (error: any) {
            if (error.response?.status === 403) {
                console.log('🔄 Session expired, re-authenticating automatically...');
                this.clearSession();
                await this.authenticate();
                // Retry the request with new session
                return this.apiCall(endpoint, method, data);
            }
            throw error;
        }
    }

    /**
     * Clear saved session
     */
    clearSession(): void {
        this.session = null;
        if (fs.existsSync(this.sessionFilePath)) {
            fs.unlinkSync(this.sessionFilePath);
        }
        console.log('✅ Session cleared');
    }

    // Private methods

    private async performAutomaticLogin(): Promise<SavedSession> {
        const loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${this.config.apiKey}`;

        console.log('📋 Step 1: Establishing session...');
        await this.httpClient.get(loginUrl);
        console.log('✅ Session established');

        console.log('📋 Step 2: Sending credentials...');
        try {
            await this.httpClient.post("https://kite.zerodha.com/api/login", {
                user_id: this.config.userId,
                password: this.config.password
            });
            console.log('✅ Credentials accepted');
        } catch (error: any) {
            if (error.response?.status === 400 || error.response?.status === 401) {
                console.log('✅ Credentials processed (expected response)');
            } else {
                throw new Error(`Login failed: ${error.response?.data?.message || error.message}`);
            }
        }

        console.log('📋 Step 3: Generating TOTP automatically...');
        const totpCode = this.generateTOTP();
        console.log(`✅ TOTP generated: ${totpCode}`);

        try {
            await this.httpClient.post("https://kite.zerodha.com/api/twofa", {
                user_id: this.config.userId,
                request_id: null,
                twofa_value: totpCode
            });
            console.log('✅ TOTP authentication completed');
        } catch (error: any) {
            if (error.response?.status === 302 || error.response?.status === 400) {
                console.log('✅ TOTP processed (expected response)');
            } else {
                throw new Error(`TOTP authentication failed: ${error.response?.data?.message || 'Invalid TOTP code'}`);
            }
        }

        console.log('📋 Step 4: Extracting request token...');
        const requestToken = await this.extractRequestToken(loginUrl);

        console.log('📋 Step 5: Generating access token...');
        const session = await this.generateAccessToken(requestToken);

        return session;
    }

    private generateTOTP(): string {
        try {
            const code = totp(this.config.totpSecret);
            return code;
        } catch (error) {
            throw new Error(`TOTP generation failed: ${error}`);
        }
    }

    private async extractRequestToken(loginUrl: string): Promise<string> {
        try {
            await this.httpClient.get(loginUrl, { maxRedirects: 0 });
            throw new Error('Expected redirect but none occurred');
        } catch (error: any) {
            if (error.response && error.response.status === 302) {
                const redirectURL = error.response.headers.location;
                const url = new URL(redirectURL);
                const requestToken = url.searchParams.get("request_token");

                if (!requestToken) {
                    throw new Error('No request_token found in redirect URL');
                }

                console.log('✅ Request token extracted successfully');
                return requestToken;
            } else {
                throw error;
            }
        }
    }

    private async generateAccessToken(requestToken: string): Promise<SavedSession> {
        const checksum = crypto.createHash("sha256")
            .update(this.config.apiKey + requestToken + this.config.apiSecret)
            .digest("hex");

        const response = await axios.post("https://api.kite.trade/session/token",
            qs.stringify({
                api_key: this.config.apiKey,
                request_token: requestToken,
                checksum: checksum
            }), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });

        const data = response.data.data;
        const loginTime = new Date().toISOString();
        const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

        return {
            accessToken: data.access_token,
            publicToken: data.public_token,
            userId: data.user_id,
            loginTime,
            expiryTime
        };
    }

    private loadSavedSession(): SavedSession | null {
        try {
            if (!fs.existsSync(this.sessionFilePath)) {
                return null;
            }

            const data = fs.readFileSync(this.sessionFilePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            logger.warn('Failed to load saved session:', error);
            return null;
        }
    }

    private saveSession(session: SavedSession): void {
        try {
            fs.writeFileSync(this.sessionFilePath, JSON.stringify(session, null, 2));
            logger.info('Session saved successfully');
        } catch (error) {
            logger.error('Failed to save session:', error);
        }
    }

    private isSessionValid(session: SavedSession): boolean {
        const now = new Date();
        const expiry = new Date(session.expiryTime);
        return now < expiry;
    }
}

// Helper function for easy usage with environment variables
export async function createAutoTOTPAuth(): Promise<AutoTOTPZerodhaAuth> {
    const config: AutoTOTPConfig = {
        apiKey: process.env.ZERODHA_API_KEY || '',
        apiSecret: process.env.ZERODHA_API_SECRET || '',
        userId: process.env.ZERODHA_USER_ID || '',
        password: process.env.ZERODHA_PASSWORD || '',
        totpSecret: process.env.ZERODHA_TOTP_SECRET || ''
    };

    // Validate all required fields
    const missingFields = [];
    if (!config.apiKey) missingFields.push('ZERODHA_API_KEY');
    if (!config.apiSecret) missingFields.push('ZERODHA_API_SECRET');
    if (!config.userId) missingFields.push('ZERODHA_USER_ID');
    if (!config.password) missingFields.push('ZERODHA_PASSWORD');
    if (!config.totpSecret) missingFields.push('ZERODHA_TOTP_SECRET');

    if (missingFields.length > 0) {
        throw new Error(`Missing required environment variables: ${missingFields.join(', ')}`);
    }

    const auth = new AutoTOTPZerodhaAuth(config);
    await auth.authenticate();
    return auth;
}