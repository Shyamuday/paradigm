#!/usr/bin/env ts-node

import { KiteConnect } from 'kiteconnect';
import express from 'express';
import * as fs from 'fs';
import * as path from 'path';

const API_KEY = '4kii2cglymgxjpqq';
const API_SECRET = 'fmapqarltxl0lhyetqeasfgjias6ov3h';

async function refreshToken() {
    console.log('🔐 Refreshing Zerodha Access Token...\n');

    const kite = new KiteConnect({
        api_key: API_KEY
    });

    // Create a simple server to handle the callback
    const app = express();
    const PORT = 3000;

    return new Promise((resolve, reject) => {
        app.get('/callback', async (req: any, res: any) => {
            try {
                const { action, status, request_token } = req.query;

                if (action === 'login' && status === 'success' && request_token) {
                    console.log('✅ Login successful, getting access token...');

                    const response = await kite.generateSession(request_token, API_SECRET);
                    const { access_token, user_id, user_name, email } = response;

                    // Save session to file
                    const sessionData = {
                        access_token,
                        user_id,
                        user_name,
                        email,
                        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
                        login_time: new Date().toISOString()
                    };

                    const sessionPath = path.join(__dirname, '..', 'data', 'zerodha-session.json');
                    fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));

                    console.log(`✅ Access token refreshed for user: ${user_name} (${user_id})`);
                    console.log('🎯 Ready for live trading!');

                    res.send(`
                        <html>
                            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                                <h1 style="color: green;">✅ Token Refreshed Successfully!</h1>
                                <p>You can close this window and return to the terminal.</p>
                                <p>Live trading will start automatically.</p>
                            </body>
                        </html>
                    `);

                    // Stop server and resolve
                    setTimeout(() => {
                        server.close();
                        resolve(sessionData);
                    }, 2000);

                } else {
                    res.send('❌ Authentication failed');
                    reject(new Error('Authentication failed'));
                }
            } catch (error) {
                console.error('❌ Error during authentication:', error);
                res.send('❌ Authentication error');
                reject(error);
            }
        });

        const server = app.listen(PORT, () => {
            console.log(`🌐 Server running on http://localhost:${PORT}`);
            
            // Generate login URL
            const loginUrl = kite.getLoginURL();
            console.log(`🔗 Please visit this URL to login:`);
            console.log(loginUrl);
            console.log('\n⏳ Waiting for authentication...');
        });

        // Timeout after 5 minutes
        setTimeout(() => {
            server.close();
            reject(new Error('Authentication timeout'));
        }, 5 * 60 * 1000);
    });
}

// Run token refresh
refreshToken()
    .then((sessionData) => {
        console.log('\n🚀 Starting live trading with fresh token...');
        // Import and run live trading
        require('./paper-to-live-trading.ts');
    })
    .catch((error) => {
        console.error('❌ Token refresh failed:', error);
        process.exit(1);
    }); 