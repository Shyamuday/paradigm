import dotenv from 'dotenv';
import axios from 'axios';
import * as qs from 'qs';
import { authenticator } from 'otplib';
import * as crypto from 'crypto';

// Load environment variables
dotenv.config();

// 1. Generate TOTP code
function getTOTP(secret: string): string {
    return authenticator.generate(secret);
}

// 2. Axios instance with session support
const session = axios.create({
    withCredentials: true,
    timeout: 30000,
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
});

// 3. Main automated login function
async function automatedZerodhaLogin(): Promise<void> {
    const API_KEY = process.env.ZERODHA_API_KEY || '4kii2cglymgxjpqq';
    const API_SECRET = process.env.ZERODHA_API_SECRET || 'fmapqarltxl0lhyetqeasfgjias6ov3h';
    const USER_ID = process.env.ZERODHA_USER_ID || 'XB7556';
    const PASSWORD = process.env.ZERODHA_PASSWORD || 'Lumia620@';
    const TOTP_SECRET = process.env.ZERODHA_TOTP_SECRET;
    const REDIRECT_URI = process.env.ZERODHA_REDIRECT_URI || 'https://127.0.0.1';

    if (!TOTP_SECRET) {
        console.error('❌ Missing TOTP secret');
        console.log('Please set ZERODHA_TOTP_SECRET in your .env file:');
        console.log('ZERODHA_TOTP_SECRET=your_base32_totp_secret');
        console.log('');
        console.log('🔐 How to get your TOTP secret:');
        console.log('1. Login to Zerodha Kite');
        console.log('2. Go to Settings > API');
        console.log('3. When setting up 2FA, scan the QR code with an authenticator app');
        console.log('4. The secret shown is your TOTP secret (base32 format)');
        return;
    }

    const login_url = `https://kite.zerodha.com/connect/login?v=3&api_key=${API_KEY}`;

    try {
        console.log('🚀 Starting automated Zerodha login...\n');

        // Step 1: GET login page to grab cookies
        console.log('📋 Step 1: Getting login page to establish session...');
        await session.get(login_url);
        console.log('✅ Session established');

        // Step 2: POST credentials
        console.log('📋 Step 2: Posting credentials...');
        await session.post("https://kite.zerodha.com/api/login", {
            user_id: USER_ID,
            password: PASSWORD
        });
        console.log('✅ Credentials posted successfully');

        // Step 3: POST 2FA using TOTP
        console.log('📋 Step 3: Generating and posting TOTP...');
        const totp = getTOTP(TOTP_SECRET);
        console.log('🔢 TOTP generated:', totp);

        await session.post("https://kite.zerodha.com/api/twofa", {
            user_id: USER_ID,
            request_id: null,
            twofa_value: totp
        });
        console.log('✅ 2FA completed successfully');

        // Step 4: Follow redirect to extract request_token
        console.log('📋 Step 4: Following redirect to extract request token...');
        let request_token: string | null = null;

        try {
            await session.get(login_url, { maxRedirects: 0 });
        } catch (error: any) {
            if (error.response && error.response.status === 302) {
                const redirectURL = error.response.headers.location;
                console.log('🔗 Redirect URL:', redirectURL);

                const url = new URL(redirectURL);
                request_token = url.searchParams.get("request_token");

                if (request_token) {
                    console.log("✅ request_token:", request_token);
                } else {
                    throw new Error('No request_token found in redirect URL');
                }
            } else {
                throw error;
            }
        }

        if (!request_token) {
            throw new Error('Failed to extract request_token');
        }

        // Step 5: Get access_token from request_token
        console.log('📋 Step 5: Generating access token...');
        const checksum = crypto.createHash("sha256")
            .update(API_KEY + request_token + API_SECRET)
            .digest("hex");

        const tokenResp = await axios.post("https://api.kite.trade/session/token",
            qs.stringify({
                api_key: API_KEY,
                request_token: request_token,
                checksum: checksum
            }), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        }
        );

        const access_token = tokenResp.data.data.access_token;
        const public_token = tokenResp.data.data.public_token;
        const user_id = tokenResp.data.data.user_id;

        console.log("\n🎉 SUCCESS! Login completed successfully!");
        console.log("=".repeat(50));
        console.log("📊 Session Details:");
        console.log("   User ID:", user_id);
        console.log("   Access Token:", access_token.substring(0, 10) + "...");
        console.log("   Public Token:", public_token.substring(0, 10) + "...");
        console.log("   Login Time:", new Date().toISOString());
        console.log("=".repeat(50));

        // Test API call with the access token
        console.log("\n🧪 Testing API call with access token...");
        try {
            const profileResp = await axios.get("https://api.kite.trade/user/profile", {
                headers: {
                    "Authorization": `token ${API_KEY}:${access_token}`,
                    "X-Kite-Version": "3"
                }
            });

            console.log("✅ API call successful!");
            console.log("   User Name:", profileResp.data.data.user_name);
            console.log("   Email:", profileResp.data.data.email);
            console.log("   User Type:", profileResp.data.data.user_type);

        } catch (error: any) {
            console.error("❌ API call failed:", error.response?.data || error.message);
        }

        // You can now use this access_token for all subsequent API calls
        // Example: Store it in your application state or database

    } catch (err: any) {
        console.error("❌ Login failed:", err?.response?.data || err.message);

        if (err.response?.data) {
            console.error("🔍 Error details:", err.response.data);
        }

        // Common error handling
        if (err.response?.status === 401) {
            console.error("🔐 Authentication failed - check your credentials");
        } else if (err.response?.status === 429) {
            console.error("⏰ Rate limit exceeded - please wait and try again");
        } else if (err.response?.status === 400) {
            console.error("📝 Invalid request - check your input data");
        }
    }
}

// Run the automated login
if (require.main === module) {
    console.log('🔐 Zerodha Kite Connect - Automated Login');
    console.log('==========================================\n');

    automatedZerodhaLogin().catch(error => {
        console.error('💥 Automated login failed:', error);
        process.exit(1);
    });
} 