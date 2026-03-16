import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { AppNotification } from "./use-notifications";

function getWsUrl() {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

type AddNotif = (n: Omit<AppNotification, "id" | "timestamp" | "read">) => void;

export function useGlobalRealtime(userId: string | undefined, addNotification?: AddNotif) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(true);
  const addNotifRef = useRef(addNotification);
  useEffect(() => { addNotifRef.current = addNotification; }, [addNotification]);

  useEffect(() => {
    if (!userId) return;

    activeRef.current = true;

    const connect = () => {
      if (!activeRef.current) return;
      try {
        const ws = new WebSocket(getWsUrl());
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "join-user", userId }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            if (msg.type === "session-update") {
              queryClient.invalidateQueries({ queryKey: [api.sessions.list.path] });
              if (msg.sessionId) {
                queryClient.invalidateQueries({ queryKey: [api.sessions.get.path, msg.sessionId] });
              }
              // Notification
              if (msg.status && msg.actorName) {
                const statusLabels: Record<string, string> = {
                  accepted: "accepted your session request",
                  declined: "declined your session request",
                  scheduled: "scheduled your session",
                  completed: "marked your session as completed",
                  cancelled: "cancelled the session",
                };
                const label = statusLabels[msg.status];
                if (label) {
                  addNotifRef.current?.({
                    type: "session_update",
                    title: "Session Update",
                    body: `${msg.actorName} ${label}`,
                    sessionId: msg.sessionId,
                  });
                }
              }
            }

            if (msg.type === "session-request") {
              queryClient.invalidateQueries({ queryKey: [api.sessions.list.path] });
              addNotifRef.current?.({
                type: "session_request",
                title: "New Session Request",
                body: `${msg.studentName} requested a tutoring session`,
                sessionId: msg.sessionId,
              });
            }

            if (msg.type === "message-notification") {
              queryClient.invalidateQueries({ queryKey: [api.sessions.list.path] });
              addNotifRef.current?.({
                type: "message",
                title: msg.senderName || "New Message",
                body: msg.preview || "Sent you a message",
                sessionId: msg.sessionId,
              });
            }
          } catch {}
        };

        ws.onclose = () => {
          if (activeRef.current) {
            reconnectRef.current = setTimeout(connect, 3000);
          }
        };
      } catch {}
    };

    connect();

    return () => {
      activeRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [userId, queryClient]);
}
