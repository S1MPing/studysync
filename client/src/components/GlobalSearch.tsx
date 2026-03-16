import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";

interface SearchResults {
  users: Array<{ id: string; firstName: string; lastName: string; profileImageUrl?: string; role: string }>;
  courses: Array<{ id: number; code: string; name: string }>;
  quizzes: Array<{ id: number; title: string; course?: { code: string } | null }>;
}

export function useGlobalSearch() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, setLocation] = useLocation();
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Debounce the search query by 300ms
  useEffect(() => {
    if (inputValue.length < 2) {
      setSearchQuery("");
      return;
    }
    const timer = setTimeout(() => {
      setSearchQuery(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Reset input when dialog closes
  useEffect(() => {
    if (!open) {
      setInputValue("");
      setSearchQuery("");
    }
  }, [open]);

  const { data: results, isFetching } = useQuery<SearchResults>({
    queryKey: ["/api/search", searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: searchQuery.length >= 2,
  });

  const hasResults =
    results &&
    (results.users.length > 0 || results.courses.length > 0 || results.quizzes.length > 0);

  const handleSelect = (path: string) => {
    onClose();
    setLocation(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <CommandInput
        placeholder="Search people, courses, quizzes..."
        value={inputValue}
        onValueChange={setInputValue}
      />
      <CommandList>
        {isFetching && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isFetching && searchQuery.length >= 2 && !hasResults && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}

        {!isFetching && searchQuery.length < 2 && (
          <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
        )}

        {!isFetching && results && results.users.length > 0 && (
          <CommandGroup heading="People">
            {results.users.map((u) => {
              const initials = `${u.firstName?.[0] || ""}${u.lastName?.[0] || ""}`.toUpperCase() || "?";
              return (
                <CommandItem
                  key={u.id}
                  value={`user-${u.id}-${u.firstName}-${u.lastName}`}
                  onSelect={() => handleSelect("/tutors")}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Avatar className="w-6 h-6 shrink-0">
                    <AvatarImage src={u.profileImageUrl || ""} />
                    <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate">
                    {u.firstName} {u.lastName}
                  </span>
                  <span className="text-[10px] capitalize px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                    {u.role}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {!isFetching && results && results.courses.length > 0 && (
          <CommandGroup heading="Courses">
            {results.courses.map((c) => (
              <CommandItem
                key={c.id}
                value={`course-${c.id}-${c.code}-${c.name}`}
                onSelect={() => handleSelect("/tutors")}
                className="flex items-center gap-2 cursor-pointer"
              >
                <span className="text-xs font-mono font-semibold text-primary shrink-0">
                  {c.code}
                </span>
                <span className="flex-1 truncate text-sm">{c.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!isFetching && results && results.quizzes.length > 0 && (
          <CommandGroup heading="Quizzes">
            {results.quizzes.map((q) => (
              <CommandItem
                key={q.id}
                value={`quiz-${q.id}-${q.title}`}
                onSelect={() => handleSelect("/quiz")}
                className="flex items-center gap-2 cursor-pointer"
              >
                <span className="flex-1 truncate text-sm">{q.title}</span>
                {q.course?.code && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0 font-mono">
                    {q.course.code}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
