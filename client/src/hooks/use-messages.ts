import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useCallback } from "react";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

function getWsUrl() {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

export function useMessages(sessionId: number) {
  return useQuery({
    queryKey: [api.messages.list.path, sessionId],
    queryFn: async () => {
      const url = buildUrl(api.messages.list.path, { sessionId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json() as Promise<z.infer<typeof api.messages.list.responses[200]>>;
    },
    enabled: !!sessionId,
  });
}

export function useRealtimeMessages(sessionId: number, userId: string) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!sessionId || !userId) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", userId, sessionId }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "chat") {
          // Add the new message to the cache
          queryClient.setQueryData(
            [api.messages.list.path, sessionId],
            (old: any[] | undefined) => old ? [...old, msg.data] : [msg.data]
          );
        }
      } catch {}
    };

    ws.onclose = () => {
      // Reconnect after 2 seconds
      setTimeout(() => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      }, 2000);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId, userId, queryClient]);

  const broadcastMessage = useCallback((messageData: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "chat",
        data: messageData,
      }));
    }
  }, []);

  return { broadcastMessage };
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, ...data }: z.infer<typeof api.messages.send.input> & { sessionId: number }) => {
      const url = buildUrl(api.messages.send.path, { sessionId });
      const res = await fetch(url, {
        method: api.messages.send.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: (newMessage, variables) => {
      // Add message to cache immediately
      queryClient.setQueryData(
        [api.messages.list.path, variables.sessionId],
        (old: any[] | undefined) => old ? [...old, newMessage] : [newMessage]
      );
    },
  });
}
