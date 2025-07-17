import express from 'express';
import crypto from 'crypto';
import { EventEmitter } from 'events';

// API Credentials
const API_CREDENTIALS = {
    API_KEY: "4kii2cglymgxjpqq",
    API_SECRET: "fmapqarltxl0lhyetqeasfgjias6ov3h"
};

export interface OrderUpdate {
    order_id: string;
    exchange_order_id: string;
    placed_by: string;
    status: string;
    status_message: string | null;
    order_timestamp: string;
    exchange_timestamp: string | null;
    variety: string;
    exchange: string;
    tradingsymbol: string;
    instrument_token: number;
    order_type: string;
    transaction_type: string;
    validity: string;
    product: string;
    quantity: number;
    disclosed_quantity: number;
    price: number;
    trigger_price: number;
    average_price: number;
    filled_quantity: number;
    pending_quantity: number;
    cancelled_quantity: number;
    market_protection: number;
    meta: Record<string, any>;
    tag: string | null;
    guid: string;
}

export class OrderUpdateHandler extends EventEmitter {
    private app: express.Application;
    private server: any;

    constructor(private port: number = 3000) {
        super();
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }

    private setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (_req, res) => {
            res.json({ status: 'ok' });
        });

        // Webhook endpoint for order updates
        this.app.post('/kite/postback', (req, res): void => {
            try {
                // Verify the request
                if (!this.verifyWebhookRequest(req)) {
                    console.error('❌ Invalid webhook signature');
                    res.status(401).json({ status: 'error', message: 'Invalid signature' });
                    return;
                }

                const update = req.body as OrderUpdate;

                console.log('\n📦 Received order update:');
                console.log(`Order ID: ${update.order_id}`);
                console.log(`Status: ${update.status}`);
                console.log(`Symbol: ${update.tradingsymbol}`);
                console.log(`Quantity: ${update.filled_quantity}/${update.quantity}`);
                console.log(`Price: ${update.average_price}`);

                // Emit the update event
                this.emit('orderUpdate', update);

                res.json({ status: 'success' });
            } catch (error) {
                console.error('❌ Error processing webhook:', error);
                res.status(500).json({ status: 'error', message: 'Internal server error' });
            }
        });
    }

    /**
     * Verify the webhook request signature
     */
    private verifyWebhookRequest(req: express.Request): boolean {
        try {
            const { order_id, checksum } = req.body;

            // Construct the checksum string
            const checksumString = order_id + API_CREDENTIALS.API_KEY;

            // Calculate SHA-256 hash
            const calculatedChecksum = crypto
                .createHash('sha256')
                .update(checksumString)
                .digest('hex');

            return calculatedChecksum === checksum;
        } catch (error) {
            console.error('Error verifying webhook:', error);
            return false;
        }
    }

    /**
     * Start the webhook server
     */
    start(): Promise<void> {
        return new Promise((resolve) => {
            this.server = this.app.listen(this.port, () => {
                console.log(`\n🚀 Webhook server running on port ${this.port}`);
                resolve();
            });
        });
    }

    /**
     * Stop the webhook server
     */
    stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.server) {
                this.server.close((err: any) => {
                    if (err) reject(err);
                    else resolve();
                });
            } else {
                resolve();
            }
        });
    }
} 