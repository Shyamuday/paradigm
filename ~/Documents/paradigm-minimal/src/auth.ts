import KiteConnect from 'kiteconnect';
import * as fs from 'fs';
import * as path from 'path';

export class ZerodhaAuth {
    private kite: KiteConnect;
    private sessionFile: string;

    constructor() {
        this.kite = new KiteConnect({
            api_key: process.env.ZERODHA_API_KEY || '',
            api_secret: process.env.ZERODHA_API_SECRET || ''
        });

        this.sessionFile = path.join(process.cwd(), 'data', 'zerodha-session.json');
    }

    async authenticate(): Promise<void> {
        try {
            // Try to load existing session
            if (await this.loadSession()) {
                console.log('✅ Using existing session');
                return;
            }

            // If no session exists, need to authenticate
            console.log('🔐 No existing session found. Please authenticate...');

            // For now, we'll use a simple approach
            // In production, you'd want to implement proper OAuth flow
            if (!process.env.ZERODHA_ACCESS_TOKEN) {
                throw new Error('ZERODHA_ACCESS_TOKEN environment variable is required. Please set it with your access token.');
            }

            this.kite.setAccessToken(process.env.ZERODHA_ACCESS_TOKEN);

            // Test the connection
            const userProfile = await this.kite.getProfile();
            console.log(`✅ Authenticated as: ${userProfile.user_name}`);

            // Save session
            await this.saveSession();

        } catch (error) {
            console.error('❌ Authentication failed:', error);
            throw error;
        }
    }

    getKite(): KiteConnect {
        return this.kite;
    }

    async hasValidSession(): Promise<boolean> {
        try {
            if (!this.kite.access_token) {
                return false;
            }

            // Test the session by making a simple API call
            await this.kite.getProfile();
            return true;
        } catch (error) {
            return false;
        }
    }

    private async loadSession(): Promise<boolean> {
        try {
            if (!fs.existsSync(this.sessionFile)) {
                return false;
            }

            const data = await fs.promises.readFile(this.sessionFile, 'utf-8');
            const session = JSON.parse(data);

            if (session.access_token && session.timestamp) {
                // Check if session is not expired (24 hours)
                const sessionAge = Date.now() - new Date(session.timestamp).getTime();
                const maxAge = 24 * 60 * 60 * 1000; // 24 hours

                if (sessionAge < maxAge) {
                    this.kite.setAccessToken(session.access_token);
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('❌ Failed to load session:', error);
            return false;
        }
    }

    private async saveSession(): Promise<void> {
        try {
            const sessionData = {
                access_token: this.kite.access_token,
                timestamp: new Date().toISOString()
            };

            const dataDir = path.dirname(this.sessionFile);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            await fs.promises.writeFile(this.sessionFile, JSON.stringify(sessionData, null, 2));
            console.log('💾 Session saved');
        } catch (error) {
            console.error('❌ Failed to save session:', error);
        }
    }

    async logout(): Promise<void> {
        try {
            if (this.kite.access_token) {
                await this.kite.invalidateAccessToken();
            }

            if (fs.existsSync(this.sessionFile)) {
                fs.unlinkSync(this.sessionFile);
            }

            console.log('✅ Logged out successfully');
        } catch (error) {
            console.error('❌ Logout failed:', error);
        }
    }
} 