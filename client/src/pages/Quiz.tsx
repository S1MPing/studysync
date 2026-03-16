import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useCourses } from "@/hooks/use-courses";
import {
  useQuizzes,
  useQuiz,
  useCreateQuiz,
  useDeleteQuiz,
  useAddFlashcard,
  useDeleteFlashcard,
  useRecordAttempt,
  type Quiz,
  type Flashcard,
} from "@/hooks/use-quiz";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Brain,
  BookOpen,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  Search,
  Loader2,
  Trash2,
  Globe,
  Lock,
} from "lucide-react";

// ─── Card Flip Component ──────────────────────────────────────────────────────

function FlipCard({
  front,
  back,
  isFlipped,
  onClick,
}: {
  front: string;
  back: string;
  isFlipped: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className="relative w-full cursor-pointer"
      style={{ perspective: "1200px", minHeight: "240px" }}
      onClick={onClick}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 w-full rounded-2xl border border-border/60 bg-card shadow-md flex flex-col items-center justify-center p-8 text-center"
          style={{ backfaceVisibility: "hidden" }}
        >
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            Question
          </p>
          <p className="text-lg md:text-xl font-semibold leading-relaxed">{front}</p>
          <p className="text-xs text-muted-foreground mt-6 opacity-60">Tap to reveal answer</p>
        </div>
        {/* Back */}
        <div
          className="absolute inset-0 w-full rounded-2xl border border-primary/30 bg-primary/5 shadow-md flex flex-col items-center justify-center p-8 text-center"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-4">
            Answer
          </p>
          <p className="text-lg md:text-xl font-semibold leading-relaxed">{back}</p>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Study Mode ───────────────────────────────────────────────────────────────

function StudyMode({
  quiz,
  onClose,
}: {
  quiz: Quiz;
  onClose: () => void;
}) {
  const cards = quiz.cards || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState<Record<number, boolean>>({});
  const [finished, setFinished] = useState(false);
  const recordAttempt = useRecordAttempt();
  const { toast } = useToast();

  const card = cards[currentIndex] as Flashcard | undefined;
  const total = cards.length;
  const answeredCount = Object.keys(results).length;

  function handleMark(correct: boolean) {
    if (!card) return;
    setResults((prev) => ({ ...prev, [card.id]: correct }));

    if (currentIndex < total - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex((i) => i + 1), 300);
    } else {
      // Last card — compute score and finish
      const finalResults = { ...results, [card.id]: correct };
      const score = Object.values(finalResults).filter(Boolean).length;
      setFinished(true);
      recordAttempt.mutate(
        { quizId: quiz.id, score, total },
        {
          onError: () =>
            toast({ title: "Could not record attempt", variant: "destructive" }),
        }
      );
    }
  }

  function handleRetry() {
    setCurrentIndex(0);
    setIsFlipped(false);
    setResults({});
    setFinished(false);
  }

  function handlePrev() {
    if (currentIndex === 0) return;
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex((i) => i - 1), 150);
  }

  function handleNext() {
    if (currentIndex >= total - 1) return;
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex((i) => i + 1), 150);
  }

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
          <BookOpen className="w-7 h-7 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-semibold">No flashcards yet</p>
        <p className="text-xs text-muted-foreground">Add cards to this quiz to start studying.</p>
        <Button variant="outline" size="sm" onClick={onClose}>
          Go Back
        </Button>
      </div>
    );
  }

  const score = Object.values(results).filter(Boolean).length;

  // ── Score Screen ────────────────────────────────────────────────────────────
  if (finished) {
    const pct = Math.round((score / total) * 100);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-12 gap-6 text-center"
      >
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Brain className="w-10 h-10 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-1">
            {score} out of {total} correct!
          </h2>
          <p className="text-muted-foreground text-sm">
            {pct >= 80
              ? "Excellent work! Keep it up."
              : pct >= 50
              ? "Good effort! Review the ones you missed."
              : "Keep practicing — you'll get there!"}
          </p>
        </div>
        <div className="w-full max-w-xs">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Score</span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} className="h-3 rounded-full" />
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRetry} className="gap-2">
            <RotateCcw className="w-4 h-4" /> Try Again
          </Button>
          <Button onClick={onClose} className="gap-2">
            <ChevronLeft className="w-4 h-4" /> All Quizzes
          </Button>
        </div>
      </motion.div>
    );
  }

  // ── Active Study ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5 text-muted-foreground">
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <div className="text-center">
          <p className="text-xs font-semibold text-muted-foreground">{quiz.title}</p>
          <p className="text-[10px] text-muted-foreground/60">
            Card {currentIndex + 1} of {total}
          </p>
        </div>
        <div className="w-16" />
      </div>

      {/* Progress bar */}
      <Progress value={((currentIndex + 1) / total) * 100} className="h-1.5 rounded-full" />

      {/* Card */}
      <div style={{ minHeight: "240px" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.22 }}
          >
            {card && (
              <FlipCard
                front={card.question}
                back={card.answer}
                isFlipped={isFlipped}
                onClick={() => setIsFlipped((f) => !f)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon"
          className="w-9 h-9"
          onClick={handlePrev}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {isFlipped ? (
          <div className="flex gap-2 flex-1 justify-center">
            <Button
              variant="outline"
              className="flex-1 max-w-[140px] gap-2 border-destructive/40 text-destructive hover:bg-destructive/8"
              onClick={() => handleMark(false)}
            >
              <X className="w-4 h-4" /> Wrong
            </Button>
            <Button
              className="flex-1 max-w-[140px] gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => handleMark(true)}
            >
              <Check className="w-4 h-4" /> Correct
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            className="flex-1 max-w-xs gap-2"
            onClick={() => setIsFlipped(true)}
          >
            Reveal Answer
          </Button>
        )}

        <Button
          variant="outline"
          size="icon"
          className="w-9 h-9"
          onClick={handleNext}
          disabled={currentIndex >= total - 1}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1 flex-wrap">
        {cards.map((c, i) => {
          const answered = results[c.id];
          return (
            <button
              key={c.id}
              onClick={() => {
                setIsFlipped(false);
                setCurrentIndex(i);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentIndex
                  ? "bg-primary w-4"
                  : answered === true
                  ? "bg-emerald-500"
                  : answered === false
                  ? "bg-destructive"
                  : "bg-muted"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Create Quiz Dialog ───────────────────────────────────────────────────────

function CreateQuizDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: courses } = useCourses();
  const createQuiz = useCreateQuiz();
  const { toast } = useToast();

  const [step, setStep] = useState<"details" | "cards">("details");
  const [createdQuizId, setCreatedQuizId] = useState<number | null>(null);
  const [cardQuestion, setCardQuestion] = useState("");
  const [cardAnswer, setCardAnswer] = useState("");

  const addFlashcard = useAddFlashcard(createdQuizId ?? 0);
  const deleteFlashcard = useDeleteFlashcard();
  const { data: createdQuiz } = useQuiz(createdQuizId ?? 0);

  const [form, setForm] = useState({
    title: "",
    description: "",
    courseId: "" as string,
    isPublic: true,
  });

  function resetAll() {
    setStep("details");
    setCreatedQuizId(null);
    setCardQuestion("");
    setCardAnswer("");
    setForm({ title: "", description: "", courseId: "", isPublic: true });
  }

  async function handleCreateQuiz() {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    createQuiz.mutate(
      {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        courseId: form.courseId ? Number(form.courseId) : null,
        isPublic: form.isPublic,
      },
      {
        onSuccess: (quiz) => {
          setCreatedQuizId(quiz.id);
          setStep("cards");
        },
        onError: () => toast({ title: "Failed to create quiz", variant: "destructive" }),
      }
    );
  }

  function handleAddCard() {
    if (!cardQuestion.trim() || !cardAnswer.trim()) {
      toast({ title: "Both question and answer are required", variant: "destructive" });
      return;
    }
    addFlashcard.mutate(
      { question: cardQuestion.trim(), answer: cardAnswer.trim() },
      {
        onSuccess: () => {
          setCardQuestion("");
          setCardAnswer("");
        },
        onError: () => toast({ title: "Failed to add card", variant: "destructive" }),
      }
    );
  }

  function handleClose() {
    resetAll();
    onClose();
  }

  const cards = createdQuiz?.cards || [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            {step === "details" ? "Create New Quiz" : "Add Flashcards"}
          </DialogTitle>
        </DialogHeader>

        {step === "details" ? (
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="quiz-title">Title *</Label>
              <Input
                id="quiz-title"
                placeholder="e.g. Calculus Fundamentals"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quiz-desc">Description</Label>
              <Textarea
                id="quiz-desc"
                placeholder="Optional description..."
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Course (optional)</Label>
              <Select
                value={form.courseId}
                onValueChange={(v) => setForm((f) => ({ ...f, courseId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No course</SelectItem>
                  {(courses as any[] | undefined)?.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Public Quiz</p>
                <p className="text-xs text-muted-foreground">Visible to all students</p>
              </div>
              <Switch
                checked={form.isPublic}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isPublic: v }))}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleCreateQuiz} disabled={createQuiz.isPending} className="gap-2">
                {createQuiz.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create & Add Cards
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Add card form */}
            <div className="rounded-xl border border-border/50 p-4 space-y-3 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Card</p>
              <div className="space-y-1.5">
                <Label htmlFor="card-q">Question</Label>
                <Textarea
                  id="card-q"
                  placeholder="Enter question..."
                  rows={2}
                  value={cardQuestion}
                  onChange={(e) => setCardQuestion(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="card-a">Answer</Label>
                <Textarea
                  id="card-a"
                  placeholder="Enter answer..."
                  rows={2}
                  value={cardAnswer}
                  onChange={(e) => setCardAnswer(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                onClick={handleAddCard}
                disabled={addFlashcard.isPending}
                className="gap-1.5 w-full"
              >
                {addFlashcard.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Add Card
              </Button>
            </div>

            {/* Cards list */}
            {cards.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {cards.length} card{cards.length !== 1 ? "s" : ""} added
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {cards.map((c, idx) => (
                    <div
                      key={c.id}
                      className="flex items-start gap-3 rounded-lg border border-border/50 p-3 bg-card"
                    >
                      <span className="text-[10px] font-bold text-muted-foreground/50 mt-0.5 w-5 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-xs font-medium truncate">{c.question}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.answer}</p>
                      </div>
                      <button
                        onClick={() =>
                          deleteFlashcard.mutate(c.id, {
                            onError: () =>
                              toast({ title: "Failed to delete card", variant: "destructive" }),
                          })
                        }
                        className="w-6 h-6 rounded-md hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-xs text-muted-foreground py-4">
                No cards yet. Add your first flashcard above.
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} className="gap-1.5">
                Done ({cards.length} card{cards.length !== 1 ? "s" : ""})
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Quiz List Card ───────────────────────────────────────────────────────────

function QuizCard({
  quiz,
  onStudy,
}: {
  quiz: Quiz;
  onStudy: (quiz: Quiz) => void;
}) {
  return (
    <Card className="rounded-xl border-border/60 shadow-sm hover:shadow-md transition-all group">
      <CardContent className="p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{quiz.title}</h3>
            {quiz.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{quiz.description}</p>
            )}
          </div>
          {quiz.isPublic ? (
            <Globe className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {quiz.course && (
            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-md">
              {quiz.course.code}
            </Badge>
          )}
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            {quiz._count?.cards ?? quiz.cards?.length ?? 0} cards
          </span>
        </div>

        {quiz.creator && (
          <p className="text-[11px] text-muted-foreground">
            By {quiz.creator.firstName} {quiz.creator.lastName}
          </p>
        )}

        <Button
          size="sm"
          className="w-full gap-2 mt-1"
          onClick={() => onStudy(quiz)}
        >
          <Brain className="w-3.5 h-3.5" /> Study
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main Quiz Page ───────────────────────────────────────────────────────────

export function Quiz() {
  const { user } = useAuth();
  const { data: courses } = useCourses();
  const [searchQuery, setSearchQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [studyingQuiz, setStudyingQuiz] = useState<Quiz | null>(null);
  const [studyingQuizId, setStudyingQuizId] = useState<number | null>(null);

  const { data: quizzes, isLoading, error } = useQuizzes(
    courseFilter && courseFilter !== "all" ? Number(courseFilter) : undefined
  );

  // When we want to study, fetch the full quiz with cards
  const { data: fullQuiz, isLoading: loadingCards } = useQuiz(studyingQuizId ?? 0);

  const isTutorOrBoth = user?.role === "tutor" || (user as any)?.role === "both";

  // Filter by search
  const filteredQuizzes = (quizzes || []).filter((q) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      q.title.toLowerCase().includes(query) ||
      q.description?.toLowerCase().includes(query) ||
      q.course?.code.toLowerCase().includes(query)
    );
  });

  function handleStudy(quiz: Quiz) {
    setStudyingQuiz(quiz);
    setStudyingQuizId(quiz.id);
  }

  // Once full quiz data arrives, switch to study mode
  useEffect(() => {
    if (fullQuiz && studyingQuizId && fullQuiz.id === studyingQuizId) {
      setStudyingQuiz(fullQuiz);
    }
  }, [fullQuiz, studyingQuizId]);

  // ── Study Mode ────────────────────────────────────────────────────────────
  if (studyingQuiz) {
    if (loadingCards && !fullQuiz) {
      return (
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }
    return (
      <div className="max-w-xl mx-auto py-6">
        <StudyMode
          quiz={fullQuiz ?? studyingQuiz}
          onClose={() => {
            setStudyingQuiz(null);
            setStudyingQuizId(null);
          }}
        />
      </div>
    );
  }

  // ── List View ─────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 pb-16"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Quiz & Flashcards</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Study smarter with interactive flashcard quizzes
          </p>
        </div>

        {isTutorOrBoth && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Create Quiz
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search quizzes..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="All Courses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {(courses as any[] | undefined)?.map((c: any) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.code} — {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 bg-muted/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-border/60 bg-muted/10">
          <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-semibold text-sm">Quizzes unavailable</p>
          <p className="text-xs text-muted-foreground mt-1">
            The quiz service is not ready yet. Check back soon.
          </p>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-border/60 bg-muted/10">
          <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-semibold text-sm">
            {searchQuery || (courseFilter && courseFilter !== "all")
              ? "No quizzes match your filters"
              : "No quizzes yet"}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            {isTutorOrBoth
              ? "Create the first quiz for your students!"
              : "Your tutors haven't published any quizzes yet."}
          </p>
          {isTutorOrBoth && (
            <Button size="sm" className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" /> Create Quiz
            </Button>
          )}
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredQuizzes.map((quiz) => (
            <motion.div
              key={quiz.id}
              variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            >
              <QuizCard quiz={quiz} onStudy={handleStudy} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create Dialog */}
      <CreateQuizDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </motion.div>
  );
}
