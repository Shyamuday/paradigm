import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { logger } from '../logger/logger';

export interface ZerodhaAuthConfig {
  apiKey: string;
  apiSecret: string;
  userId?: string; // Optional for manual login
  password?: string; // Optional for manual login
  totpKey?: string; // TOTP secret key for 2FA (optional for manual login)
  requestToken?: string;
  proxy?: string; // Optional proxy server (e.g., "http://proxy:port")
}

export interface ZerodhaSession {
  accessToken: string;
  publicToken: string;
  userId: string;
  loginTime: string;
  tokenExpiryTime: string;
}

export class ZerodhaAuth extends EventEmitter {
  private config: ZerodhaAuthConfig;
  private session: ZerodhaSession | null = null;
  private sessionFilePath: string;

  constructor(config: ZerodhaAuthConfig) {
    super();
    this.config = config;
    this.sessionFilePath = path.join(process.cwd(), 'data', 'zerodha-session.json');
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Zerodha Authentication...');
      
      // Try to load existing session
      const existingSession = await this.loadSession();
      if (existingSession && this.isSessionValid(existingSession)) {
        this.session = existingSession;
        logger.info('Using existing session');
        this.emit('session_loaded', this.session);
        return;
      }
      
      // Perform fresh login
      await this.performLogin();
      
    } catch (error) {
      logger.error('Failed to initialize Zerodha auth:', error);
      throw error;
    }
  }

  private async performLogin(): Promise<void> {
    try {
      logger.info('Starting Zerodha login process...');
      
      // Step 1: Generate login URL
      const loginUrl = this.generateLoginUrl();
      logger.info('Login URL generated:', loginUrl);
      
      // Step 2: Perform web login (manual or automated)
      const requestToken = await this.performWebLogin(loginUrl);
      
      // Step 3: Generate session with request token
      await this.generateSession(requestToken);
      
      logger.info('Login completed successfully');
      this.emit('login_success', this.session);
      
    } catch (error) {
      logger.error('Login failed:', error);
      this.emit('login_failed', error);
      throw error;
    }
  }

  generateLoginUrl(): string {
    return `https://kite.zerodha.com/connect/login?v=3&api_key=${this.config.apiKey}`;
  }

  private async performWebLogin(loginUrl: string): Promise<string> {
    try {
      logger.info('Performing web login...');
      
      // Import Puppeteer
      const puppeteer = require('puppeteer');
      
      const launchOptions: any = {
        headless: false,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
      };

      // Add proxy if configured
      if (this.config.proxy) {
        launchOptions.args.push(`--proxy-server=${this.config.proxy}`);
        logger.info('Using proxy:', this.config.proxy);
      }

      const browser = await puppeteer.launch(launchOptions);
      
      const page = await browser.newPage();
      
      // Navigate to login page
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
      
      // Check if we have credentials for automated login
      if (this.config.userId && this.config.password && this.config.totpKey) {
        logger.info('Performing automated login...');
        
        // Wait for login form and fill credentials
        await page.waitForSelector('#userid', { timeout: 10000 });
        await page.type('#userid', this.config.userId);
        await page.type('#password', this.config.password);
        
        // Click login button
        await page.click('button[type="submit"]');
        
        // Wait for 2FA page
        await page.waitForSelector('#pin', { timeout: 15000 });
        
        // Generate TOTP
        const totp = this.generateTOTP();
        logger.info('TOTP generated:', totp);
        
        // Fill TOTP
        await page.type('#pin', totp);
        await page.click('button[type="submit"]');
      } else {
        logger.info('Browser opened. Please login manually...');
      }
      
      // Wait for redirect with request token
      await page.waitForFunction(() => {
        return (globalThis as any).location.href.includes('request_token=');
      }, { timeout: 300000 });
      
      const currentUrl = page.url();
      logger.info('Redirect detected:', currentUrl);
      
      // Extract request token
      const urlParams = new URLSearchParams(currentUrl.split('?')[1]);
      const requestToken = urlParams.get('request_token');
      
      if (!requestToken) {
        throw new Error('No request token found in redirect URL');
      }
      
      logger.info('Request token obtained:', requestToken);
      await browser.close();
      
      return requestToken;
      
    } catch (error) {
      logger.error('Web login failed:', error);
      throw error;
    }
  }

  private generateTOTP(): string {
    try {
      if (!this.config.totpKey) {
        throw new Error('TOTP key not provided');
      }
      
      // Import TOTP library
      const totp = require('totp-generator');
      
      // Generate TOTP using the secret key
      const token = totp(this.config.totpKey);
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
        `api_key=${this.config.apiKey}&request_token=${requestToken}&checksum=${checksum}`,
        {
          headers: {
            'X-Kite-Version': '3',
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      if (response.data.status !== 'success') {
        throw new Error(`Session generation failed: ${response.data.message}`);
      }
      
      const data = response.data.data;
      
      // Create session object
      this.session = {
        accessToken: data.access_token,
        publicToken: data.public_token,
        userId: data.user_id,
        loginTime: data.login_time,
        tokenExpiryTime: this.calculateTokenExpiry()
      };
      
      // Save session
      await this.saveSession(this.session);
      
      logger.info('Session generated successfully', {
        userId: this.session.userId,
        loginTime: this.session.loginTime
      });
      
    } catch (error) {
      logger.error('Session generation failed:', error);
      throw error;
    }
  }

  private generateChecksum(requestToken: string): string {
    const crypto = require('crypto');
    const data = this.config.apiKey + requestToken + this.config.apiSecret;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private calculateTokenExpiry(): string {
    // Token expires at 6 AM next day as per Zerodha docs
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(6, 0, 0, 0);
    return tomorrow.toISOString();
  }

  private async loadSession(): Promise<ZerodhaSession | null> {
    try {
      if (fs.existsSync(this.sessionFilePath)) {
        const sessionData = fs.readFileSync(this.sessionFilePath, 'utf8');
        const session = JSON.parse(sessionData) as ZerodhaSession;
        
        logger.info('Loaded existing session', {
          userId: session.userId,
          loginTime: session.loginTime
        });
        
        return session;
      }
    } catch (error) {
      logger.warn('Failed to load session:', error);
    }
    return null;
  }

  private async saveSession(session: ZerodhaSession): Promise<void> {
    try {
      const dataDir = path.dirname(this.sessionFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      fs.writeFileSync(this.sessionFilePath, JSON.stringify(session, null, 2));
      logger.info('Session saved successfully');
    } catch (error) {
      logger.error('Failed to save session:', error);
      throw error;
    }
  }

  private isSessionValid(session: ZerodhaSession): boolean {
    const expiryTime = new Date(session.tokenExpiryTime);
    const now = new Date();
    
    // Check if session expires in next 5 minutes
    const fiveMinutesFromNow = new Date(now.getTime() + (5 * 60 * 1000));
    return expiryTime > fiveMinutesFromNow;
  }

  async makeAuthenticatedRequest(endpoint: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', data?: any): Promise<any> {
    if (!this.session) {
      throw new Error('No active session');
    }

    if (!this.isSessionValid(this.session)) {
      logger.warn('Session expired, refreshing...');
      await this.performLogin();
    }

    try {
      const response = await axios({
        method,
        url: `https://api.kite.trade${endpoint}`,
        headers: {
          'Authorization': `token ${this.config.apiKey}:${this.session.accessToken}`,
          'X-Kite-Version': '3'
        },
        data: method === 'POST' ? data : undefined
      });

      return response.data;
      
    } catch (error) {
      logger.error(`Authenticated request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  getSession(): ZerodhaSession | null {
    return this.session;
  }

  async logout(): Promise<void> {
    try {
      if (this.session) {
        // Call logout endpoint
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