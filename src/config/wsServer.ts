import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { IncomingHttpHeaders } from 'http';

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

interface CustomWebSocket extends WebSocket {
  userId?: number;
}

const clients = new Map<CustomWebSocket, number>();

export const setupWebSocket = (server: any) => {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: CustomWebSocket, request: IncomingMessage, userId: number) => {
    console.log(`🔌 User ${userId} connected`);
    ws.userId = userId;
    clients.set(ws, userId);

    ws.on('message', (data: string) => {
      try {
        const parsed = JSON.parse(data);
        console.log(`📩 Message from user ${userId}:`, parsed);

        // Exemplu: broadcast la toți ceilalți useri
        clients.forEach((uid, client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              from: userId,
              message: parsed.message
            }));
          }
        });

      } catch (err) {
        console.error('❌ Invalid JSON message', err);
      }
    });

    ws.on('close', () => {
      console.log(`❎ User ${userId} disconnected`);
      clients.delete(ws);
    });
  });

  server.on('upgrade', (request: IncomingMessage, socket: Socket, head: Buffer) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) return socket.destroy();

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, decoded.userId);
      });
    } catch (err) {
      console.error('❌ Invalid token on WebSocket:', err);
      socket.destroy();
    }
  });
};
