import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  sessionId: number;
}

const clients: ConnectedClient[] = [];
const globalClients = new Map<string, Set<WebSocket>>();

export function getOnlineUserIds(): string[] {
  return Array.from(globalClients.keys());
}

export function broadcastToUser(userId: string, data: object) {
  const payload = JSON.stringify(data);

  // Broadcast to global (user-level) connections
  const wsSet = globalClients.get(userId);
  if (wsSet) {
    wsSet.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    });
  }

  // Also broadcast to session-based connections for that user
  clients
    .filter(c => c.userId === userId && c.ws.readyState === WebSocket.OPEN)
    .forEach(c => c.ws.send(payload));
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    let client: ConnectedClient | null = null;

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // Register client globally (user-level, no session)
        if (msg.type === "join-user" && msg.userId) {
          const uid: string = msg.userId;
          if (!globalClients.has(uid)) globalClients.set(uid, new Set());
          globalClients.get(uid)!.add(ws);
          return;
        }

        // Register client to a session room
        if (msg.type === "join") {
          client = { ws, userId: msg.userId, sessionId: msg.sessionId };
          clients.push(client);
          return;
        }

        // Broadcast message to everyone in the same session
        if (msg.type === "chat" && client) {
          const payload = JSON.stringify({
            type: "chat",
            data: msg.data,
          });

          clients
            .filter(c => c.sessionId === client!.sessionId && c.ws !== ws && c.ws.readyState === WebSocket.OPEN)
            .forEach(c => c.ws.send(payload));
        }

        // Relay typing indicator to other session participant
        if (msg.type === "typing" && client) {
          const payload = JSON.stringify({
            type: "typing",
            userId: msg.userId,
          });
          clients
            .filter(c => c.sessionId === client!.sessionId && c.ws !== ws && c.ws.readyState === WebSocket.OPEN)
            .forEach(c => c.ws.send(payload));
        }

        // Relay read receipt
        if (msg.type === "read" && client) {
          const payload = JSON.stringify({ type: "read", userId: msg.userId });
          clients
            .filter(c => c.sessionId === client!.sessionId && c.ws !== ws && c.ws.readyState === WebSocket.OPEN)
            .forEach(c => c.ws.send(payload));
        }
      } catch (err) {
        console.error("WebSocket message error:", err);
      }
    });

    ws.on("close", () => {
      const idx = clients.findIndex(c => c.ws === ws);
      if (idx !== -1) clients.splice(idx, 1);

      // Remove from global clients
      globalClients.forEach((wsSet, uid) => {
        wsSet.delete(ws);
        if (wsSet.size === 0) globalClients.delete(uid);
      });
    });
  });

  console.log("WebSocket server running on /ws");
}
