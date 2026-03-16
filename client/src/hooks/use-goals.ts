import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StudyGoal {
  weeklyHoursTarget: number;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useGoal() {
  return useQuery<StudyGoal | null>({
    queryKey: ["/api/goals"],
    queryFn: async () => {
      const res = await fetch("/api/goals", { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch goal");
      return res.json();
    },
  });
}

export function useUpsertGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: StudyGoal) => {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save goal");
      return res.json() as Promise<StudyGoal>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
    },
  });
}
