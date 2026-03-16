import { useState } from "react";
import { useSessions, useUpdateSessionStatus, useDeleteSession, useScheduleSession } from "@/hooks/use-sessions";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { BookOpen, CalendarCheck, CalendarPlus, Check, X, Loader2, MessageSquare, PhoneOff, Star } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CalendarSync } from "@/components/CalendarSync";

export function Sessions() {
  const { user } = useAuth();
  const { data: sessionsRaw, isLoading } = useSessions();
  const sessions = sessionsRaw as any[] | undefined;
  const updateStatus = useUpdateSessionStatus();
  const deleteSession = useDeleteSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reviewSession, setReviewSession] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  // All filter state must be declared before any early return to satisfy React's rules of hooks
  const [tutorFilter, setTutorFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [universityFilter, setUniversityFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "morning" | "afternoon" | "evening" | "night">("all");

  // Scheduling dialog state
  const scheduleSession = useScheduleSession();
  const [scheduleDialog, setScheduleDialog] = useState<{ sessionId: number } | null>(null);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("18:00");
  const [schedRecurring, setSchedRecurring] = useState(false);
  const [schedRecurringDays, setSchedRecurringDays] = useState<number[]>([]);

  const DAY_LABELS: { value: number; label: string }[] = [
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
    { value: 7, label: "Sun" },
  ];

  const toggleRecurringDay = (day: number) => {
    setSchedRecurringDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleScheduleSubmit = () => {
    if (!scheduleDialog || !schedDate) return;
    const payload: any = {
      id: scheduleDialog.sessionId,
      date: schedDate,
      startTime: schedTime,
    };
    if (schedRecurring && schedRecurringDays.length > 0) {
      payload.isRecurring = true;
      payload.recurringDays = schedRecurringDays.sort((a, b) => a - b).join(",");
    }
    scheduleSession.mutate(payload, {
      onSuccess: () => {
        setScheduleDialog(null);
        setSchedDate("");
        setSchedTime("18:00");
        setSchedRecurring(false);
        setSchedRecurringDays([]);
        toast({ title: schedRecurring ? "Recurring schedule set!" : "Session scheduled!" });
      },
      onError: () => toast({ title: "Failed to schedule session", variant: "destructive" }),
    });
  };

  const submitReview = useMutation({
    mutationFn: async ({ sessionId, revieweeId, rating, comment }: any) => {
      const res = await fetch(`/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, revieweeId, rating, comment }),
      });
      if (!res.ok) throw new Error("Failed to submit review");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Review submitted! Thank you." });
      setReviewSession(null);
      setReviewRating(5);
      setReviewComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
    onError: () => toast({ title: "Failed to submit review", variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const learningSessions = (sessions?.filter(s => s.studentId === user?.id) || []);
  const tutoringSessions = (sessions?.filter(s => s.tutorId === user?.id) || []);

  const isTutorOnly = user?.role === "tutor";

  const allForCurrentRole = isTutorOnly ? tutoringSessions : learningSessions;

  // Filters
  const uniqueTutors = Array.from(
    new Map(
      tutoringSessions.map(s => [s.tutorId, s.tutor]),
    ).values(),
  );
  const uniqueCourses = Array.from(
    new Map(
      allForCurrentRole
        .filter(s => s.course)
        .map(s => [s.courseId, s.course]),
    ).values(),
  );
  const uniqueUniversities = Array.from(
    new Set(
      allForCurrentRole
        .map(s => isTutorOnly ? s.student?.university : s.tutor?.university)
        .filter(Boolean),
    ),
  ) as string[];

  const applyFilters = (list: any[]) =>
    list.filter((s) => {
      // Tutor filter (for student view)
      if (!isTutorOnly && tutorFilter !== "all" && s.tutorId !== tutorFilter) return false;
      // Course filter
      if (courseFilter !== "all" && String(s.courseId) !== courseFilter) return false;
      // University filter (counterparty)
      const uni = isTutorOnly ? s.student?.university : s.tutor?.university;
      if (universityFilter !== "all" && uni !== universityFilter) return false;
      // Time-of-day filter based on startTime (HH:mm) if present
      if (timeFilter !== "all" && s.startTime) {
        const [hStr] = s.startTime.split(":");
        const hour = parseInt(hStr || "0", 10);
        const tag =
          hour >= 5 && hour < 12 ? "morning" :
          hour >= 12 && hour < 17 ? "afternoon" :
          hour >= 17 && hour < 21 ? "evening" :
          "night";
        if (tag !== timeFilter) return false;
      }
      return true;
    });

  const filteredLearning = applyFilters(learningSessions);
  const filteredTutoring = applyFilters(tutoringSessions);

  const handleDelete = (id: number) => {
    deleteSession.mutate(id);
  };

  const renderSessionCard = (session: any, isTutorView: boolean) => (
    <Card key={session.id} className="rounded-2xl border-border/50 shadow-sm hover:shadow-md transition-all overflow-hidden mb-4">
      <CardContent className="p-0 flex flex-col sm:flex-row">
        <div className="bg-muted/40 p-6 flex flex-col justify-center items-center sm:w-32 border-b sm:border-b-0 sm:border-r border-border/50">
          {session.date ? (
            <>
              <span className="text-xs font-bold uppercase text-muted-foreground">{format(new Date(session.date), 'MMM')}</span>
              <span className="text-3xl font-display font-bold text-foreground">{format(new Date(session.date), 'dd')}</span>
            </>
          ) : (
            <span className="text-xs font-bold text-muted-foreground">TBD</span>
          )}
          <span className="text-xs font-semibold text-muted-foreground mt-1">{session.startTime || '—'}</span>
        </div>
        
        <div className="p-6 flex-1">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-lg font-bold font-display">{session.course?.code || `Session #${session.id}`}</h3>
              <p className="text-sm text-muted-foreground">
                {isTutorView ? `Student: ${session.student?.firstName || 'Unknown'}` : `Tutor: ${session.tutor?.firstName || 'Unknown'}`}
              </p>
            </div>
            <StatusBadge status={session.status} />
          </div>
          
          <p className="text-sm text-muted-foreground mt-4 line-clamp-2">
            {session.notes ? `"${session.notes}"` : "No specific notes provided."}
          </p>
          
          <div className="mt-6 flex flex-wrap gap-3 items-center">
            {session.status === 'pending' && isTutorView && (
              <>
                <Button size="sm" onClick={() => updateStatus.mutate({ id: session.id, status: 'accepted' })} disabled={updateStatus.isPending} className="rounded-lg shadow-sm bg-primary hover:bg-primary/90 text-white">
                  <Check className="w-4 h-4 mr-1" /> Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: session.id, status: 'declined' })} disabled={updateStatus.isPending} className="rounded-lg text-destructive hover:bg-destructive/10 border-destructive/20">
                  <X className="w-4 h-4 mr-1" /> Decline
                </Button>
              </>
            )}
            {session.status === 'pending' && !isTutorView && (
              <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: session.id, status: 'cancelled' })} disabled={updateStatus.isPending} className="rounded-lg text-destructive hover:bg-destructive/10 border-destructive/20">
                <X className="w-4 h-4 mr-1" /> Cancel Request
              </Button>
            )}
            
            {(session.status === 'accepted' || session.status === 'completed') && (
              <Link href={`/sessions/${session.id}`}>
                <Button size="sm" variant="outline" className="rounded-lg border-primary/20 text-primary hover:bg-primary/5">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {session.status === 'completed' ? 'View Details' : 'Open Workspace'}
                </Button>
              </Link>
            )}
            {session.status === 'accepted' && !session.date && (
              <Button size="sm" variant="outline"
                className="rounded-lg border-primary/20 text-primary hover:bg-primary/5"
                onClick={() => {
                  setSchedDate("");
                  setSchedTime("18:00");
                  setSchedRecurring(false);
                  setSchedRecurringDays([]);
                  setScheduleDialog({ sessionId: session.id });
                }}>
                <CalendarPlus className="w-4 h-4 mr-1" /> Propose a Time
              </Button>
            )}

            {(session.status === "accepted" || session.status === "scheduled") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStatus.mutate({ id: session.id, status: "cancelled" })}
                disabled={updateStatus.isPending}
                className="rounded-lg text-destructive hover:bg-destructive/10 border-destructive/20"
              >
                <PhoneOff className="w-4 h-4 mr-1" /> End / Cancel
              </Button>
            )}

            {session.status === "completed" && (
              <Button size="sm" variant="outline" className="rounded-lg border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
                onClick={() => { setReviewSession(session); setReviewRating(5); setReviewComment(""); }}>
                <Star className="w-3.5 h-3.5 mr-1 fill-amber-400 text-amber-400" /> Leave Review
              </Button>
            )}
            {["completed", "cancelled", "declined"].includes(session.status) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDelete(session.id)}
                disabled={deleteSession.isPending}
                className="rounded-lg text-destructive hover:bg-destructive/10 border-destructive/20"
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-4xl mx-auto w-full space-y-8 pb-12">
      <div className="mb-8 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold">My Sessions</h1>
            <p className="text-muted-foreground mt-2">
              {isTutorOnly ? "View and manage sessions you are teaching." : "View and manage sessions where you are learning."}
            </p>
          </div>
          <div className="pt-1">
            <CalendarSync sessions={sessions || []} />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          {!isTutorOnly && uniqueTutors.length > 0 && (
            <select
              className="h-9 px-3 rounded-lg border border-border bg-background text-sm"
              value={tutorFilter}
              onChange={(e) => setTutorFilter(e.target.value)}
            >
              <option value="all">All tutors</option>
              {uniqueTutors.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </select>
          )}

          {uniqueCourses.length > 0 && (
            <select
              className="h-9 px-3 rounded-lg border border-border bg-background text-sm"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
            >
              <option value="all">All courses</option>
              {uniqueCourses.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          )}

          {uniqueUniversities.length > 0 && (
            <select
              className="h-9 px-3 rounded-lg border border-border bg-background text-sm"
              value={universityFilter}
              onChange={(e) => setUniversityFilter(e.target.value)}
            >
              <option value="all">All universities</option>
              {uniqueUniversities.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          )}

          <select
            className="h-9 px-3 rounded-lg border border-border bg-background text-sm"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
          >
            <option value="all">Any time</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
            <option value="night">Night</option>
          </select>
        </div>
      </div>

      {/* Role-specific lists */}
      {isTutorOnly ? (
        <div className="space-y-6">
          {filteredTutoring.length > 0 ? filteredTutoring.map(s => renderSessionCard(s, true)) : <EmptyState type="teaching" />}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredLearning.length > 0 ? filteredLearning.map(s => renderSessionCard(s, false)) : <EmptyState />}
        </div>
      )}

      {/* Schedule Dialog */}
      <Dialog open={!!scheduleDialog} onOpenChange={(open) => !open && setScheduleDialog(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base">Propose a Time</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Pick a date and time for this session.</p>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold">Date</p>
              <Input type="date" className="h-9 rounded-lg text-sm"
                value={schedDate} onChange={e => setSchedDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold">Time</p>
              <Input type="time" className="h-9 rounded-lg text-sm"
                value={schedTime} onChange={e => setSchedTime(e.target.value)} />
            </div>

            {/* Recurring toggle */}
            <div className="border border-border/60 rounded-lg p-3 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={schedRecurring}
                  onChange={e => setSchedRecurring(e.target.checked)}
                  className="rounded border-border" />
                <span className="text-xs font-semibold">Recurring sessions</span>
              </label>
              {schedRecurring && (
                <div className="space-y-2 pl-1">
                  <p className="text-[11px] text-muted-foreground">Select days of the week:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_LABELS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleRecurringDay(value)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                          ${schedRecurringDays.includes(value)
                            ? "bg-primary text-white"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {schedRecurringDays.length > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      Days: {schedRecurringDays.sort((a, b) => a - b).join(",")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setScheduleDialog(null)}>Cancel</Button>
            <Button size="sm" disabled={!schedDate || scheduleSession.isPending}
              onClick={handleScheduleSubmit}>
              {scheduleSession.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={!!reviewSession} onOpenChange={(open) => !open && setReviewSession(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base">Leave a Review</DialogTitle>
            {reviewSession && (
              <p className="text-xs text-muted-foreground mt-1">
                Rate your session for {reviewSession.course?.code || "this course"}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <p className="text-xs font-semibold mb-2">Rating</p>
              <div className="flex gap-1.5">
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={() => setReviewRating(n)}
                    className="transition-transform hover:scale-110">
                    <Star className={`w-7 h-7 ${n <= reviewRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold">Comment (optional)</p>
              <Textarea className="resize-none rounded-lg text-sm min-h-[80px]"
                placeholder="Share your experience..."
                value={reviewComment} onChange={e => setReviewComment(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setReviewSession(null)}>Cancel</Button>
            <Button size="sm" disabled={submitReview.isPending}
              onClick={() => reviewSession && submitReview.mutate({
                sessionId: reviewSession.id,
                revieweeId: user?.id === reviewSession.studentId ? reviewSession.tutorId : reviewSession.studentId,
                rating: reviewRating,
                comment: reviewComment || undefined,
              })}>
              {submitReview.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Submit Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    accepted: "bg-primary/10 text-primary border-primary/20",
    completed: "bg-blue-100 text-blue-800 border-blue-200",
    declined: "bg-muted text-muted-foreground border-border",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20"
  };
  return (
    <Badge variant="outline" className={`capitalize font-bold text-xs px-3 py-1 rounded-full ${styles[status] || styles.pending}`}>
      {status}
    </Badge>
  );
}

function EmptyState({ type = "learning" }: { type?: "learning" | "teaching" }) {
  return (
    <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border/60">
      <CalendarCheck className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
      <h3 className="text-xl font-bold font-display text-foreground">No sessions yet</h3>
      <p className="text-muted-foreground mt-2 mb-6 max-w-sm mx-auto">
        {type === "learning" 
          ? "You haven't requested any sessions. Find a peer tutor to get started!"
          : "You don't have any tutoring requests right now."}
      </p>
      {type === "learning" && (
        <Link href="/tutors">
          <Button className="rounded-full px-8 shadow-md">Find Tutors</Button>
        </Link>
      )}
    </div>
  );
}
