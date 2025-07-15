"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoTOTPZerodhaAuth = void 0;
exports.createAutoTOTPAuth = createAutoTOTPAuth;
const axios_1 = __importDefault(require("axios"));
const qs = __importStar(require("qs"));
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const totp = require('totp-generator');
const logger_1 = require("../logger/logger");
class AutoTOTPZerodhaAuth {
    constructor(config) {
        this.session = null;
        if (!config.totpSecret) {
            throw new Error('TOTP secret is required for automatic authentication');
        }
        this.config = {
            ...config,
            redirectUri: config.redirectUri || 'https://127.0.0.1'
        };
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        this.sessionFilePath = path.join(dataDir, 'zerodha-auto-session.json');
        this.httpClient = axios_1.default.create({
            withCredentials: true,
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
    }
    async authenticate() {
        try {
            console.log('🔐 Starting Automatic TOTP Authentication...\n');
            const existingSession = this.loadSavedSession();
            if (existingSession && this.isSessionValid(existingSession)) {
                console.log('✅ Using existing valid session');
                console.log(`   User: ${existingSession.userId}`);
                console.log(`   Expires: ${existingSession.expiryTime}\n`);
                this.session = existingSession;
                return existingSession;
            }
            console.log('🔄 No valid session found, performing automatic login...\n');
            const newSession = await this.performAutomaticLogin();
            this.saveSession(newSession);
            this.session = newSession;
            console.log('\n🎉 Automatic TOTP Authentication completed successfully!');
            console.log('   Session saved and ready for API calls\n');
            return newSession;
        }
        catch (error) {
            logger_1.logger.error('Automatic TOTP authentication failed:', error);
            throw error;
        }
    }
    getSession() {
        return this.session;
    }
    async apiCall(endpoint, method = 'GET', data) {
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
                response = await axios_1.default.get(url, { headers });
            }
            else if (method === 'POST') {
                response = await axios_1.default.post(url, data, { headers });
            }
            else if (method === 'DELETE') {
                response = await axios_1.default.delete(url, { headers });
            }
            return response?.data;
        }
        catch (error) {
            if (error.response?.status === 403) {
                console.log('🔄 Session expired, re-authenticating automatically...');
                this.clearSession();
                await this.authenticate();
                return this.apiCall(endpoint, method, data);
            }
            throw error;
        }
    }
    clearSession() {
        this.session = null;
        if (fs.existsSync(this.sessionFilePath)) {
            fs.unlinkSync(this.sessionFilePath);
        }
        console.log('✅ Session cleared');
    }
    async performAutomaticLogin() {
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
        }
        catch (error) {
            if (error.response?.status === 400 || error.response?.status === 401) {
                console.log('✅ Credentials processed (expected response)');
            }
            else {
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
        }
        catch (error) {
            if (error.response?.status === 302 || error.response?.status === 400) {
                console.log('✅ TOTP processed (expected response)');
            }
            else {
                throw new Error(`TOTP authentication failed: ${error.response?.data?.message || 'Invalid TOTP code'}`);
            }
        }
        console.log('📋 Step 4: Extracting request token...');
        const requestToken = await this.extractRequestToken(loginUrl);
        console.log('📋 Step 5: Generating access token...');
        const session = await this.generateAccessToken(requestToken);
        return session;
    }
    generateTOTP() {
        try {
            const code = totp(this.config.totpSecret);
            return code;
        }
        catch (error) {
            throw new Error(`TOTP generation failed: ${error}`);
        }
    }
    async extractRequestToken(loginUrl) {
        try {
            await this.httpClient.get(loginUrl, { maxRedirects: 0 });
            throw new Error('Expected redirect but none occurred');
        }
        catch (error) {
            if (error.response && error.response.status === 302) {
                const redirectURL = error.response.headers.location;
                const url = new URL(redirectURL);
                const requestToken = url.searchParams.get("request_token");
                if (!requestToken) {
                    throw new Error('No request_token found in redirect URL');
                }
                console.log('✅ Request token extracted successfully');
                return requestToken;
            }
            else {
                throw error;
            }
        }
    }
    async generateAccessToken(requestToken) {
        const checksum = crypto.createHash("sha256")
            .update(this.config.apiKey + requestToken + this.config.apiSecret)
            .digest("hex");
        const response = await axios_1.default.post("https://api.kite.trade/session/token", qs.stringify({
            api_key: this.config.apiKey,
            request_token: requestToken,
            checksum: checksum
        }), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });
        const data = response.data.data;
        const loginTime = new Date().toISOString();
        const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        return {
            accessToken: data.access_token,
            publicToken: data.public_token,
            userId: data.user_id,
            loginTime,
            expiryTime
        };
    }
    loadSavedSession() {
        try {
            if (!fs.existsSync(this.sessionFilePath)) {
                return null;
            }
            const data = fs.readFileSync(this.sessionFilePath, 'utf8');
            return JSON.parse(data);
        }
        catch (error) {
            logger_1.logger.warn('Failed to load saved session:', error);
            return null;
        }
    }
    saveSession(session) {
        try {
            fs.writeFileSync(this.sessionFilePath, JSON.stringify(session, null, 2));
            logger_1.logger.info('Session saved successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to save session:', error);
        }
    }
    isSessionValid(session) {
        const now = new Date();
        const expiry = new Date(session.expiryTime);
        return now < expiry;
    }
}
exports.AutoTOTPZerodhaAuth = AutoTOTPZerodhaAuth;
async function createAutoTOTPAuth() {
    const config = {
        apiKey: process.env.ZERODHA_API_KEY || '',
        apiSecret: process.env.ZERODHA_API_SECRET || '',
        userId: process.env.ZERODHA_USER_ID || '',
        password: process.env.ZERODHA_PASSWORD || '',
        totpSecret: process.env.ZERODHA_TOTP_SECRET || ''
    };
    const missingFields = [];
    if (!config.apiKey)
        missingFields.push('ZERODHA_API_KEY');
    if (!config.apiSecret)
        missingFields.push('ZERODHA_API_SECRET');
    if (!config.userId)
        missingFields.push('ZERODHA_USER_ID');
    if (!config.password)
        missingFields.push('ZERODHA_PASSWORD');
    if (!config.totpSecret)
        missingFields.push('ZERODHA_TOTP_SECRET');
    if (missingFields.length > 0) {
        throw new Error(`Missing required environment variables: ${missingFields.join(', ')}`);
    }
    const auth = new AutoTOTPZerodhaAuth(config);
    await auth.authenticate();
    return auth;
}
//# sourceMappingURL=easy-auth.js.map