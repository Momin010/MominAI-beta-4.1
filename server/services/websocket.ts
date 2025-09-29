import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

export interface WSMessage {
  type: 'ai_stream' | 'code_change' | 'cursor_position' | 'collaboration' | 'system';
  data: any;
  sessionId?: string;
  userId?: string;
}

export interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  sessionId: string;
  projectId?: string;
}

export class WebSocketManager {
  private clients = new Map<string, ConnectedClient>();
  private sessions = new Map<string, Set<string>>();

  constructor(private wss: WebSocketServer) {
    this.setupWebSocketServer();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const userId = url.searchParams.get('userId');
      const sessionId = url.searchParams.get('sessionId');
      const projectId = url.searchParams.get('projectId');

      if (!userId || !sessionId) {
        ws.close(1008, 'Missing userId or sessionId');
        return;
      }

      const clientId = crypto.randomUUID();
      const client: ConnectedClient = {
        ws,
        userId,
        sessionId,
        projectId: projectId || undefined
      };

      this.clients.set(clientId, client);
      this.addToSession(sessionId, clientId);

      ws.on('message', (data) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        this.removeClient(clientId);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.removeClient(clientId);
      });

      // Send connection confirmation
      this.sendToClient(clientId, {
        type: 'system',
        data: { status: 'connected', clientId }
      });
    });
  }

  private handleMessage(clientId: string, message: WSMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'ai_stream':
        // Handle AI streaming requests
        this.handleAIStream(clientId, message);
        break;

      case 'code_change':
        // Broadcast code changes to other clients in the same session
        this.broadcastToSession(client.sessionId, message, clientId);
        break;

      case 'cursor_position':
        // Broadcast cursor position for collaborative editing
        this.broadcastToSession(client.sessionId, {
          ...message,
          data: { ...message.data, userId: client.userId }
        }, clientId);
        break;

      case 'collaboration':
        // Handle collaborative features
        this.handleCollaboration(clientId, message);
        break;
    }
  }

  private async handleAIStream(clientId: string, message: WSMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      // This would integrate with your AI orchestrator
      // For now, simulate streaming response
      const response = message.data.message;
      
      // Simulate streaming chunks
      const chunks = response.split(' ');
      for (let i = 0; i < chunks.length; i++) {
        setTimeout(() => {
          this.sendToClient(clientId, {
            type: 'ai_stream',
            data: {
              chunk: chunks[i] + ' ',
              isComplete: i === chunks.length - 1
            }
          });
        }, i * 100);
      }
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'system',
        data: { error: 'AI request failed' }
      });
    }
  }

  private handleCollaboration(clientId: string, message: WSMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Broadcast collaboration events to all clients in the project
    if (client.projectId) {
      this.broadcastToProject(client.projectId, {
        ...message,
        data: { ...message.data, userId: client.userId }
      }, clientId);
    }
  }

  private addToSession(sessionId: string, clientId: string) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Set());
    }
    this.sessions.get(sessionId)!.add(clientId);
  }

  private removeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      const sessionClients = this.sessions.get(client.sessionId);
      if (sessionClients) {
        sessionClients.delete(clientId);
        if (sessionClients.size === 0) {
          this.sessions.delete(client.sessionId);
        }
      }
    }
    this.clients.delete(clientId);
  }

  public sendToClient(clientId: string, message: WSMessage) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  public broadcastToSession(sessionId: string, message: WSMessage, excludeClientId?: string) {
    const sessionClients = this.sessions.get(sessionId);
    if (!sessionClients) return;

    sessionClients.forEach(clientId => {
      if (clientId !== excludeClientId) {
        this.sendToClient(clientId, message);
      }
    });
  }

  public broadcastToProject(projectId: string, message: WSMessage, excludeClientId?: string) {
    this.clients.forEach((client, clientId) => {
      if (client.projectId === projectId && clientId !== excludeClientId) {
        this.sendToClient(clientId, message);
      }
    });
  }

  public broadcastToUser(userId: string, message: WSMessage) {
    this.clients.forEach((client, clientId) => {
      if (client.userId === userId) {
        this.sendToClient(clientId, message);
      }
    });
  }

  public getSessionClients(sessionId: string): ConnectedClient[] {
    const sessionClientIds = this.sessions.get(sessionId);
    if (!sessionClientIds) return [];

    return Array.from(sessionClientIds)
      .map(clientId => this.clients.get(clientId))
      .filter(Boolean) as ConnectedClient[];
  }

  public getStats() {
    return {
      totalClients: this.clients.size,
      totalSessions: this.sessions.size,
      clientsPerSession: Array.from(this.sessions.entries()).map(([sessionId, clients]) => ({
        sessionId,
        clientCount: clients.size
      }))
    };
  }
}