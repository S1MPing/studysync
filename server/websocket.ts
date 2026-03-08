import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  sessionId: number;
}

const clients: ConnectedClient[] = [];

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    let client: ConnectedClient | null = null;

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());

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
      } catch (err) {
        console.error("WebSocket message error:", err);
      }
    });

    ws.on("close", () => {
      const idx = clients.findIndex(c => c.ws === ws);
      if (idx !== -1) clients.splice(idx, 1);
    });
  });

  console.log("WebSocket server running on /ws");
}
