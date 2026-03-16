import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Flashcard {
  id: number;
  quizId: number;
  question: string;
  answer: string;
  createdAt: string;
}

export interface Quiz {
  id: number;
  title: string;
  description?: string | null;
  courseId?: number | null;
  creatorId: number;
  isPublic: boolean;
  createdAt: string;
  course?: { id: number; code: string; name: string } | null;
  creator?: { id: number; firstName: string; lastName: string } | null;
  cards?: Flashcard[];
  _count?: { cards: number };
}

export interface QuizAttempt {
  quizId: number;
  score: number;
  total: number;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useQuizzes(courseId?: number) {
  const url = courseId
    ? `/api/quizzes?courseId=${courseId}`
    : "/api/quizzes";

  return useQuery<Quiz[]>({
    queryKey: ["/api/quizzes", courseId],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch quizzes");
      return res.json();
    },
  });
}

export function useQuiz(id: number) {
  return useQuery<Quiz>({
    queryKey: ["/api/quizzes", id],
    queryFn: async () => {
      const res = await fetch(`/api/quizzes/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch quiz");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      courseId?: number | null;
      isPublic?: boolean;
    }) => {
      const res = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create quiz");
      return res.json() as Promise<Quiz>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
    },
  });
}

export function useDeleteQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/quizzes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete quiz");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
    },
  });
}

export function useAddFlashcard(quizId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { question: string; answer: string }) => {
      const res = await fetch(`/api/quizzes/${quizId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add flashcard");
      return res.json() as Promise<Flashcard>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes", quizId] });
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
    },
  });
}

export function useDeleteFlashcard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (cardId: number) => {
      const res = await fetch(`/api/quizzes/cards/${cardId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete flashcard");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
    },
  });
}

export function useRecordAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ quizId, score, total }: QuizAttempt) => {
      const res = await fetch(`/api/quizzes/${quizId}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, total }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to record attempt");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes", variables.quizId] });
    },
  });
}
