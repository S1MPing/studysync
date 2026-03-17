import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  sessionId: number;
}

const clients: ConnectedClient[] = [];
const globalClients = new Map<string, Set<WebSocket>>();

// roomId → (userId → ws)
const roomParticipants = new Map<string, Map<string, WebSocket>>();

export function getOnlineUserIds(): string[] {
  return Array.from(globalClients.keys());
}

export function getRoomParticipantIds(roomId: string): string[] {
  const room = roomParticipants.get(roomId);
  if (!room) return [];
  return Array.from(room.keys());
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

        // Relay whiteboard draw event to other session participant
        if (msg.type === "whiteboard-draw" && client) {
          const payload = JSON.stringify({ type: "whiteboard-draw", data: msg.data });
          clients
            .filter(c => c.sessionId === client!.sessionId && c.ws !== ws && c.ws.readyState === WebSocket.OPEN)
            .forEach(c => c.ws.send(payload));
        }

        if (msg.type === "whiteboard-clear" && client) {
          const payload = JSON.stringify({ type: "whiteboard-clear" });
          clients
            .filter(c => c.sessionId === client!.sessionId && c.ws !== ws && c.ws.readyState === WebSocket.OPEN)
            .forEach(c => c.ws.send(payload));
        }

        // ── Room WebRTC signaling ──────────────────────────────────────────────

        // Join a study room call
        if (msg.type === "room-join" && msg.roomId && msg.userId) {
          const roomId: string = String(msg.roomId);
          const userId: string = String(msg.userId);

          if (!roomParticipants.has(roomId)) roomParticipants.set(roomId, new Map());
          const room = roomParticipants.get(roomId)!;

          // Send existing peers to the joiner
          const existingPeers = Array.from(room.keys());
          ws.send(JSON.stringify({ type: "room-peers", peers: existingPeers }));

          // Notify existing peers
          const joinedPayload = JSON.stringify({ type: "room-peer-joined", userId });
          room.forEach((peerWs) => {
            if (peerWs.readyState === WebSocket.OPEN) peerWs.send(joinedPayload);
          });

          room.set(userId, ws);
          return;
        }

        // Leave a study room call
        if (msg.type === "room-leave" && msg.roomId && msg.userId) {
          const roomId: string = String(msg.roomId);
          const userId: string = String(msg.userId);
          const room = roomParticipants.get(roomId);
          if (room) {
            room.delete(userId);
            const leftPayload = JSON.stringify({ type: "room-peer-left", userId });
            room.forEach((peerWs) => {
              if (peerWs.readyState === WebSocket.OPEN) peerWs.send(leftPayload);
            });
            if (room.size === 0) roomParticipants.delete(roomId);
          }
          return;
        }

        // Relay offer to specific peer
        if (msg.type === "room-offer" && msg.roomId && msg.toUserId) {
          const room = roomParticipants.get(String(msg.roomId));
          const targetWs = room?.get(String(msg.toUserId));
          if (targetWs?.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify({
              type: "room-offer",
              fromUserId: msg.fromUserId,
              sdp: msg.sdp,
            }));
          }
          return;
        }

        // Relay answer to specific peer
        if (msg.type === "room-answer" && msg.roomId && msg.toUserId) {
          const room = roomParticipants.get(String(msg.roomId));
          const targetWs = room?.get(String(msg.toUserId));
          if (targetWs?.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify({
              type: "room-answer",
              fromUserId: msg.fromUserId,
              sdp: msg.sdp,
            }));
          }
          return;
        }

        // Relay ICE candidate to specific peer
        if (msg.type === "room-ice" && msg.roomId && msg.toUserId) {
          const room = roomParticipants.get(String(msg.roomId));
          const targetWs = room?.get(String(msg.toUserId));
          if (targetWs?.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify({
              type: "room-ice",
              fromUserId: msg.fromUserId,
              candidate: msg.candidate,
            }));
          }
          return;
        }

        // Send room invite notification to a user
        if (msg.type === "room-invite" && msg.toUserId) {
          broadcastToUser(String(msg.toUserId), {
            type: "room-invite-notification",
            fromName: msg.fromName,
            roomId: msg.roomId,
            roomName: msg.roomName,
          });
          return;
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

      // Remove from room participants and notify peers
      roomParticipants.forEach((room, roomId) => {
        room.forEach((peerWs, userId) => {
          if (peerWs === ws) {
            room.delete(userId);
            const leftPayload = JSON.stringify({ type: "room-peer-left", userId });
            room.forEach((otherWs) => {
              if (otherWs.readyState === WebSocket.OPEN) otherWs.send(leftPayload);
            });
            if (room.size === 0) roomParticipants.delete(roomId);
          }
        });
      });
    });
  });

  console.log("WebSocket server running on /ws");
}
