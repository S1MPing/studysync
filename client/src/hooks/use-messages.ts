import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useCallback, useState } from "react";
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
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerRead, setPartnerRead] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable refs for state setters so they can be used in WS callbacks without closure issues
  const setTypingRef = useRef(setPartnerTyping);
  const setReadRef = useRef(setPartnerRead);
  const typingTimerRefInner = useRef(typingTimerRef);

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
          queryClient.setQueryData(
            [api.messages.list.path, sessionId],
            (old: any[] | undefined) => {
              if (!old) return [msg.data];
              if (old.some((m: any) => m.id === msg.data?.id)) return old;
              return [...old, msg.data];
            }
          );
        } else if (msg.type === "typing") {
          setTypingRef.current(true);
          const timer = typingTimerRefInner.current;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setTypingRef.current(false), 3500);
        } else if (msg.type === "read") {
          setReadRef.current(true);
        }
      } catch {}
    };

    ws.onclose = () => {
      setTimeout(() => {
        if (wsRef.current === ws) wsRef.current = null;
      }, 2000);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId, userId, queryClient]);

  const broadcastMessage = useCallback((messageData: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat", data: messageData }));
    }
  }, []);

  const sendTyping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing", userId }));
    }
  }, [userId]);

  const sendRead = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "read", userId }));
    }
  }, [userId]);

  return { broadcastMessage, sendTyping, sendRead, partnerTyping, partnerRead };
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

export function useDeleteMessage(sessionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.messages.delete.path, { id });
      const res = await fetch(url, {
        method: api.messages.delete.method,
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete message");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.messages.list.path, sessionId] });
    },
  });
}
