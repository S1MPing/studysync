import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StudyRoom {
  id: number;
  name: string;
  description?: string | null;
  courseId?: number | null;
  hostId: number;
  jitsiRoomId: string;
  maxParticipants: number;
  isOpen: boolean;
  createdAt: string;
  course?: { id: number; code: string; name: string } | null;
  host?: { id: number; firstName: string; lastName: string } | null;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useRooms() {
  return useQuery<StudyRoom[]>({
    queryKey: ["/api/rooms"],
    queryFn: async () => {
      const res = await fetch("/api/rooms", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch rooms");
      return res.json();
    },
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      courseId?: number | null;
      maxParticipants?: number;
    }) => {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create room");
      return res.json() as Promise<StudyRoom>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
    },
  });
}

export function useCloseRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/rooms/${id}/close`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to close room");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/rooms/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete room");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
    },
  });
}
