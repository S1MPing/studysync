import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.users.updateProfile.input>) => {
      const res = await fetch(api.users.updateProfile.path, {
        method: api.users.updateProfile.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.me.path] });
    },
  });
}

export function useTutors(filters?: { courseId?: string; university?: string }) {
  return useQuery({
    queryKey: [api.users.tutors.path, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.courseId) params.append("courseId", filters.courseId);
      if (filters?.university) params.append("university", filters.university);
      
      const url = `${api.users.tutors.path}?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tutors");
      return res.json() as Promise<z.infer<typeof api.users.tutors.responses[200]>>;
    },
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: [api.users.getById.path, id],
    queryFn: async () => {
      const url = buildUrl(api.users.getById.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json() as Promise<z.infer<typeof api.users.getById.responses[200]>>;
    },
    enabled: !!id,
  });
}
