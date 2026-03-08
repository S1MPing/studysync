import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

export function useSessions() {
  return useQuery({
    queryKey: [api.sessions.list.path],
    queryFn: async () => {
      const res = await fetch(api.sessions.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json() as Promise<z.infer<typeof api.sessions.list.responses[200]>>;
    },
  });
}

export function useSession(id: number) {
  return useQuery({
    queryKey: [api.sessions.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.sessions.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch session");
      return res.json() as Promise<z.infer<typeof api.sessions.get.responses[200]>>;
    },
    enabled: !!id,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.sessions.create.input>) => {
      const res = await fetch(api.sessions.create.path, {
        method: api.sessions.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to request session");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.sessions.list.path] });
    },
  });
}

export function useUpdateSessionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "accepted" | "declined" | "scheduled" | "completed" | "cancelled" }) => {
      const url = buildUrl(api.sessions.updateStatus.path, { id });
      const res = await fetch(url, {
        method: api.sessions.updateStatus.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.sessions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.sessions.get.path, variables.id] });
    },
  });
}

export function useScheduleSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, date, startTime, durationMinutes }: { id: number; date: string; startTime: string; durationMinutes?: number }) => {
      const url = buildUrl(api.sessions.schedule.path, { id });
      const res = await fetch(url, {
        method: api.sessions.schedule.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, startTime, durationMinutes: durationMinutes || 60 }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to schedule session");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.sessions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.sessions.get.path, variables.id] });
    },
  });
}
