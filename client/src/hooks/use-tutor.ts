import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

export function useTutorCourses(tutorId: string) {
  return useQuery({
    queryKey: [api.tutorCourses.list.path, tutorId],
    queryFn: async () => {
      const url = buildUrl(api.tutorCourses.list.path, { tutorId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tutor courses");
      return res.json() as Promise<any[]>;
    },
    enabled: !!tutorId,
  });
}

export function useAvailabilities(tutorId: string) {
  return useQuery({
    queryKey: [api.availabilities.list.path, tutorId],
    queryFn: async () => {
      const url = buildUrl(api.availabilities.list.path, { tutorId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch availabilities");
      return res.json() as Promise<z.infer<typeof api.availabilities.list.responses[200]>>;
    },
    enabled: !!tutorId,
  });
}

export function useAddAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.availabilities.add.input>) => {
      const res = await fetch(api.availabilities.add.path, {
        method: api.availabilities.add.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add availability");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.availabilities.list.path] });
    },
  });
}

export function useRemoveAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.availabilities.remove.path, { id });
      const res = await fetch(url, {
        method: api.availabilities.remove.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove availability");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.availabilities.list.path] });
    },
  });
}

export function useAddTutorCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.tutorCourses.add.input>) => {
      const res = await fetch(api.tutorCourses.add.path, {
        method: api.tutorCourses.add.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add course");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.me.path] });
    },
  });
}

export function useRemoveTutorCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.tutorCourses.remove.path, { id });
      const res = await fetch(url, {
        method: api.tutorCourses.remove.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove course");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.me.path] });
    },
  });
}
