#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { KiteConnect } from 'kiteconnect';
import express from 'express';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

class RelianceOrderPlacer {
    private kite: any;
    private API_KEY = '4kii2cglymgxjpqq';
    private API_SECRET = 'fmapqarltxl0lhyetqeasfgjias6ov3h';

    async placeRelianceOrder(): Promise<void> {
        try {
            console.log('🚀 Placing RELIANCE Buy Order...\n');

            // Initialize KiteConnect
            this.kite = new KiteConnect({
                api_key: this.API_KEY
            });

            // Auto-authenticate
            await this.autoAuthenticate();
            console.log('✅ Authentication completed');

            // Get current RELIANCE price
            const currentPrice = await this.getReliancePrice();
            console.log(`📊 Current RELIANCE Price: ₹${currentPrice.toFixed(2)}`);

            // Calculate order price: Current Price - ₹20
            const orderPrice = currentPrice - 20;
            console.log(`📊 Order Price: ₹${orderPrice.toFixed(2)} (Current Price - ₹20)`);

            // Place the order
            const orderParams = {
                tradingsymbol: 'RELIANCE',
                exchange: 'NSE',
                transaction_type: 'BUY',
                quantity: 1,
                product: 'MIS', // Intraday
                order_type: 'LIMIT',
                price: orderPrice // Current price minus ₹20
            };

            console.log('📋 Order Details:');
            console.log(`   Symbol: RELIANCE`);
            console.log(`   Action: BUY`);
            console.log(`   Quantity: 1`);
            console.log(`   Price: ₹${orderPrice.toFixed(2)} (LIMIT - Current Price - ₹20)`);
            console.log(`   Exchange: NSE`);
            console.log(`   Product: MIS (Intraday)`);

            const orderId = await this.kite.placeOrder('regular', orderParams);

            console.log('\n✅ ORDER PLACED SUCCESSFULLY!');
            console.log(`📋 Order ID: ${orderId}`);
            console.log(`📊 Order placed at: ${new Date().toLocaleString()}`);

            // Get order details
            await this.getOrderDetails(orderId);

        } catch (error) {
            console.error('❌ Error placing order:', error);
            throw error;
        }
    }

    private async autoAuthenticate(): Promise<void> {
        console.log('🔐 Auto-authenticating with Zerodha...');

        // Check if we have a valid session
        const sessionPath = path.join(__dirname, '..', 'data', 'zerodha-session.json');

        if (fs.existsSync(sessionPath)) {
            try {
                const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
                const expiresAt = new Date(sessionData.expires_at);
                const now = new Date();

                // Check if token is still valid (with 5 minute buffer)
                if (expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
                    this.kite.setAccessToken(sessionData.access_token);

                    // Test the token
                    const profile = await this.kite.getProfile();
                    console.log(`✅ Valid session found for: ${profile.user_name} (${profile.user_id})`);
                    return;
                } else {
                    console.log('⚠️  Session expired, refreshing...');
                }
            } catch (error) {
                console.log('⚠️  Invalid session file, starting fresh authentication...');
            }
        }

        // Need to authenticate
        await this.performOAuthLogin();
    }

    private async performOAuthLogin(): Promise<void> {
        console.log('🔄 Starting OAuth login...');

        return new Promise((resolve, reject) => {
            const app = express();
            const PORT = 3000;

            app.get('/callback', async (req: any, res: any) => {
                try {
                    const { action, status, request_token } = req.query;

                    if (action === 'login' && status === 'success' && request_token) {
                        console.log('✅ Login successful, getting access token...');

                        const response = await this.kite.generateSession(request_token, this.API_SECRET);
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

                        console.log(`✅ Access token saved for user: ${user_name} (${user_id})`);

                        res.send(`
                            <html>
                                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                                    <h1 style="color: green;">✅ Authentication Successful!</h1>
                                    <p>You can close this window and return to the terminal.</p>
                                    <p>Order placement will continue automatically.</p>
                                </body>
                            </html>
                        `);

                        // Stop server and resolve
                        setTimeout(() => {
                            server.close();
                            resolve();
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
                const loginUrl = this.kite.getLoginURL();
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

    private async getReliancePrice(): Promise<number> {
        try {
            const quote = await this.kite.getQuote('NSE:RELIANCE');
            return quote['NSE:RELIANCE'].last_price;
        } catch (error) {
            console.log('⚠️  Could not get live price, using fallback price');
            return 2800; // Fallback price
        }
    }

    private async getOrderDetails(orderId: string): Promise<void> {
        try {
            const orders = await this.kite.getOrders();
            const order = orders.find((o: any) => o.order_id === orderId);

            if (order) {
                console.log('\n📋 Order Details:');
                console.log(`   Status: ${order.status}`);
                console.log(`   Order Type: ${order.order_type}`);
                console.log(`   Price: ₹${order.price}`);
                console.log(`   Quantity: ${order.quantity}`);
                console.log(`   Pending Quantity: ${order.pending_quantity}`);
                console.log(`   Filled Quantity: ${order.filled_quantity}`);
                console.log(`   Transaction Type: ${order.transaction_type}`);
                console.log(`   Product: ${order.product}`);
                console.log(`   Exchange: ${order.exchange}`);
                console.log(`   Trading Symbol: ${order.tradingsymbol}`);
            }
        } catch (error) {
            console.log('⚠️  Could not fetch order details:', error);
        }
    }
}

// Place the order
async function main() {
    const orderPlacer = new RelianceOrderPlacer();
    await orderPlacer.placeRelianceOrder();
}

if (require.main === module) {
    main().catch(console.error);
} 