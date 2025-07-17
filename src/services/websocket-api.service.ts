import * as WebSocket from 'ws';
import * as http from 'http';
import { EventEmitter } from 'events';
import { logger } from '../logger/logger';
import { CacheService } from './cache.service';
import { performanceMonitor } from './performance-monitor.service';
import { notificationService } from './notification.service';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
  id?: string;
}

export interface WebSocketClient {
  id: string;
  ws: WebSocket;
  isAlive: boolean;
  subscriptions: Set<string>;
  lastPing: number;
  metadata: {
    userAgent?: string;
    ip?: string;
    connectedAt: Date;
  };
}

export interface APIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>;
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  auth?: boolean;
}

export class WebSocketAPIService extends EventEmitter {
  private wss: WebSocket.Server;
  private httpServer: http.Server;
  private clients: Map<string, WebSocketClient> = new Map();
  private endpoints: Map<string, APIEndpoint> = new Map();
  private isRunning = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 8080) {
    super();
    
    this.httpServer = http.createServer();
    this.wss = new WebSocket.Server({ server: this.httpServer });
    
    this.setupWebSocketHandlers();
    this.setupDefaultEndpoints();
    this.startHeartbeat();
  }

  /**
   * Start the WebSocket API service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('WebSocket API service already running');
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        this.httpServer.listen(8080, () => {
          logger.info('WebSocket API service started on port 8080');
          resolve();
        });
        
        this.httpServer.on('error', reject);
      });

      this.isRunning = true;
      this.emit('started');
    } catch (error) {
      logger.error('Failed to start WebSocket API service', error);
      throw error;
    }
  }

  /**
   * Stop the WebSocket API service
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('WebSocket API service not running');
      return;
    }

    this.isRunning = false;

    // Close all client connections
    for (const client of this.clients.values()) {
      client.ws.close();
    }
    this.clients.clear();

    // Stop intervals
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close server
    this.wss.close();
    this.httpServer.close();

    logger.info('WebSocket API service stopped');
    this.emit('stopped');
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      const clientId = this.generateClientId();
      const ip = req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const client: WebSocketClient = {
        id: clientId,
        ws,
        isAlive: true,
        subscriptions: new Set(),
        lastPing: Date.now(),
        metadata: {
          userAgent,
          ip,
          connectedAt: new Date()
        }
      };

      this.clients.set(clientId, client);
      logger.info('WebSocket client connected', { clientId, ip, userAgent });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'welcome',
        data: {
          clientId,
          message: 'Connected to Paradigm Trading Bot API',
          timestamp: Date.now()
        },
        timestamp: Date.now()
      });

      // Handle incoming messages
      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          this.handleMessage(clientId, message);
        } catch (error) {
          logger.error('Error parsing WebSocket message', error);
          this.sendToClient(clientId, {
            type: 'error',
            data: { message: 'Invalid message format' },
            timestamp: Date.now()
          });
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info('WebSocket client disconnected', { clientId });
        this.emit('clientDisconnected', clientId);
      });

      // Handle ping/pong
      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.isAlive = true;
          client.lastPing = Date.now();
        }
      });

      this.emit('clientConnected', clientId);
    });
  }

  /**
   * Setup default API endpoints
   */
  private setupDefaultEndpoints(): void {
    // Health check endpoint
    this.addEndpoint({
      path: '/health',
      method: 'GET',
      handler: async (req, res) => {
        const status = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          clients: this.clients.size,
          memory: process.memoryUsage()
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
      }
    });

    // Get connected clients
    this.addEndpoint({
      path: '/clients',
      method: 'GET',
      handler: async (req, res) => {
        const clients = Array.from(this.clients.values()).map(client => ({
          id: client.id,
          isAlive: client.isAlive,
          subscriptions: Array.from(client.subscriptions),
          lastPing: client.lastPing,
          metadata: client.metadata
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ clients }));
      }
    });

    // Broadcast message endpoint
    this.addEndpoint({
      path: '/broadcast',
      method: 'POST',
      handler: async (req, res) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const message = JSON.parse(body);
            this.broadcast(message);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, recipients: this.clients.size }));
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid message format' }));
          }
        });
      }
    });

    // Get service status
    this.addEndpoint({
      path: '/status',
      method: 'GET',
      handler: async (req, res) => {
        const status = {
          isRunning: this.isRunning,
          clients: this.clients.size,
          endpoints: Array.from(this.endpoints.keys()),
          uptime: process.uptime(),
          memory: process.memoryUsage()
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
      }
    });
  }

  /**
   * Add a new API endpoint
   */
  addEndpoint(endpoint: APIEndpoint): void {
    const key = `${endpoint.method}:${endpoint.path}`;
    this.endpoints.set(key, endpoint);
    logger.info('API endpoint added', { path: endpoint.path, method: endpoint.method });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      logger.warn('Message from unknown client', { clientId });
      return;
    }

    // Rate limiting - simple implementation
    const now = Date.now();
    const messageCount = (client as any).messageCount || 0;
    const lastReset = (client as any).lastReset || now;
    
    if (now - lastReset > 60000) {
      (client as any).messageCount = 1;
      (client as any).lastReset = now;
    } else if (messageCount > 100) {
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Rate limit exceeded' },
        timestamp: Date.now()
      });
      return;
    } else {
      (client as any).messageCount = messageCount + 1;
    }

    try {
      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, message.data);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.data);
          break;
        case 'ping':
          this.sendToClient(clientId, {
            type: 'pong',
            data: { timestamp: Date.now() },
            timestamp: Date.now()
          });
          break;
        case 'get_status':
          this.handleGetStatus(clientId);
          break;
        default:
          // Emit custom message for external handlers
          this.emit('message', clientId, message);
          break;
      }
    } catch (error) {
      logger.error('Error handling WebSocket message', error);
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Internal server error' },
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle subscription request
   */
  private handleSubscribe(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { topics } = data;
    if (Array.isArray(topics)) {
      topics.forEach(topic => {
        client.subscriptions.add(topic);
      });

      this.sendToClient(clientId, {
        type: 'subscribed',
        data: { topics: Array.from(client.subscriptions) },
        timestamp: Date.now()
      });

      logger.info('Client subscribed to topics', { clientId, topics });
    }
  }

  /**
   * Handle unsubscription request
   */
  private handleUnsubscribe(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { topics } = data;
    if (Array.isArray(topics)) {
      topics.forEach(topic => {
        client.subscriptions.delete(topic);
      });

      this.sendToClient(clientId, {
        type: 'unsubscribed',
        data: { topics: Array.from(client.subscriptions) },
        timestamp: Date.now()
      });

      logger.info('Client unsubscribed from topics', { clientId, topics });
    }
  }

  /**
   * Handle status request
   */
  private handleGetStatus(clientId: string): void {
    const status = {
      isRunning: this.isRunning,
      clients: this.clients.size,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };

    this.sendToClient(clientId, {
      type: 'status',
      data: status,
      timestamp: Date.now()
    });
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot send message to client', { clientId, readyState: client?.ws.readyState });
      return;
    }

    try {
      client.ws.send(JSON.stringify(message));
      performanceMonitor.recordMetric('websocket_messages_sent', 1);
    } catch (error) {
      logger.error('Error sending message to client', error);
    }
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message: WebSocketMessage): void {
    const deadClients: string[] = [];

    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(message));
          performanceMonitor.recordMetric('websocket_messages_sent', 1);
        } catch (error) {
          logger.error('Error broadcasting to client', { clientId, error });
          deadClients.push(clientId);
        }
      } else {
        deadClients.push(clientId);
      }
    }

    // Clean up dead clients
    deadClients.forEach(clientId => this.clients.delete(clientId));

    logger.debug('Message broadcasted', { 
      recipients: this.clients.size - deadClients.length,
      deadClients: deadClients.length 
    });
  }

  /**
   * Broadcast to clients subscribed to specific topic
   */
  broadcastToTopic(topic: string, message: WebSocketMessage): void {
    const subscribers = Array.from(this.clients.values())
      .filter(client => client.subscriptions.has(topic));

    const deadClients: string[] = [];

    subscribers.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(message));
          performanceMonitor.recordMetric('websocket_messages_sent', 1);
        } catch (error) {
          logger.error('Error sending topic message to client', { clientId: client.id, error });
          deadClients.push(client.id);
        }
      } else {
        deadClients.push(client.id);
      }
    });

    // Clean up dead clients
    deadClients.forEach(clientId => this.clients.delete(clientId));

    logger.debug('Topic message broadcasted', { 
      topic, 
      recipients: subscribers.length - deadClients.length 
    });
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.pingInterval = setInterval(() => {
      for (const [clientId, client] of this.clients.entries()) {
        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.ping();
          } catch (error) {
            logger.error('Error pinging client', { clientId, error });
            this.clients.delete(clientId);
          }
        } else {
          this.clients.delete(clientId);
        }
      }
    }, 30000); // Ping every 30 seconds

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const deadClients: string[] = [];

      for (const [clientId, client] of this.clients.entries()) {
        // Remove clients that haven't responded to ping for 2 minutes
        if (now - client.lastPing > 120000) {
          deadClients.push(clientId);
        }
      }

      deadClients.forEach(clientId => {
        const client = this.clients.get(clientId);
        if (client) {
          client.ws.close();
          this.clients.delete(clientId);
          logger.info('Removed inactive client', { clientId });
        }
      });
    }, 60000); // Cleanup every minute
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get client by ID
   */
  getClient(clientId: string): WebSocketClient | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get all connected clients
   */
  getAllClients(): WebSocketClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get clients subscribed to topic
   */
  getSubscribers(topic: string): WebSocketClient[] {
    return Array.from(this.clients.values())
      .filter(client => client.subscriptions.has(topic));
  }

  /**
   * Get service status
   */
  getStatus(): {
    isRunning: boolean;
    clients: number;
    endpoints: string[];
    uptime: number;
  } {
    return {
      isRunning: this.isRunning,
      clients: this.clients.size,
      endpoints: Array.from(this.endpoints.keys()),
      uptime: process.uptime()
    };
  }
}

// Export singleton instance
export const websocketAPIService = new WebSocketAPIService(); 