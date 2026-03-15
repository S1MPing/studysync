import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

function getWsUrl() {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

export function useGlobalRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(true);

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
