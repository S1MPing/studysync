import { useState } from "react";
import { useTutors } from "@/hooks/use-users";
import { useCourses } from "@/hooks/use-courses";
import { useTutorCourses } from "@/hooks/use-tutor";
import { useCreateSession } from "@/hooks/use-sessions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search, Star, BookOpen, MapPin, Loader2, MoreVertical, Ban, Flag, Clock, Zap } from "lucide-react";
import { useAvailabilities } from "@/hooks/use-tutor";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

// dayOfWeek: 1=Mon, 2=Tue, ..., 7=Sun (matches DB schema)
function jsToDbDay(jsDay: number) {
  // JS: 0=Sun, 1=Mon...6=Sat → DB: 1=Mon..7=Sun
  return jsDay === 0 ? 7 : jsDay;
}

export function FindTutors() {
  const [courseFilter, setCourseFilter] = useState<string>("");
  const [nameSearch, setNameSearch] = useState<string>("");
  const [availableToday, setAvailableToday] = useState(false);
  const { data: tutors, isLoading: tutorsLoading } = useTutors({ courseId: courseFilter === "all" ? "" : courseFilter });
  const { data: courses } = useCourses();
  const { t } = useI18n();

  const filteredTutors = tutors?.filter((tutor: any) => {
    if (!nameSearch.trim()) return true;
    const q = nameSearch.toLowerCase();
    return (
      tutor.firstName?.toLowerCase().includes(q) ||
      tutor.lastName?.toLowerCase().includes(q) ||
      `${tutor.firstName} ${tutor.lastName}`.toLowerCase().includes(q) ||
      tutor.university?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-primary rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-[0.07]" />
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{t("dashboard.findATutor")}</h1>
          <p className="text-primary-foreground/70 text-sm mb-6">Search by name or course and connect with peer tutors at your university.</p>

          <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
            <div className="flex items-center bg-card rounded-lg px-3 text-foreground flex-1">
              <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search tutors by name..."
                value={nameSearch}
                onChange={e => setNameSearch(e.target.value)}
                className="bg-transparent border-0 outline-none text-sm h-10 w-full placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex items-center bg-card rounded-lg px-3 text-foreground min-w-[180px]">
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger className="border-0 shadow-none focus:ring-0 px-0 h-10 text-sm">
                  <SelectValue placeholder="Filter by course..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses?.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.code} - {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              onClick={() => setAvailableToday(v => !v)}
              className={`flex items-center gap-1.5 px-3 h-10 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                availableToday
                  ? "bg-emerald-500 text-white"
                  : "bg-card text-foreground hover:bg-white/90"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Available Today
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tutorsLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse h-52 bg-muted/30 rounded-xl border-0" />
          ))
        ) : filteredTutors?.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <h3 className="text-base font-semibold">No tutors found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          filteredTutors?.map((tutor) => (
            <TutorCard key={tutor.id} tutor={tutor} filterAvailableToday={availableToday} />
          ))
        )}
      </div>
    </div>
  );
}

function TutorCard({ tutor, filterAvailableToday }: { tutor: any; filterAvailableToday?: boolean }) {
  const { data: tutorCourses } = useTutorCourses(tutor.id);
  const { data: availability = [] } = useAvailabilities(tutor.id);

  const todayDbDay = jsToDbDay(new Date().getDay());
  const currentHour = new Date().getHours();

  const todaySlots = (availability as any[]).filter(s => s.dayOfWeek === todayDbDay);
  const isAvailableToday = todaySlots.length > 0;
  const isAvailableNow = todaySlots.some(s => {
    const startH = parseInt(s.startTime.split(":")[0]);
    const endH = parseInt(s.endTime.split(":")[0]);
    return currentHour >= startH && currentHour < endH;
  });

  // If filter is active, hide tutors without today's availability
  if (filterAvailableToday && !isAvailableToday) return null;
  const { toast } = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportDetails, setReportDetails] = useState("");

  const blockUser = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/users/${tutor.id}/block`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to block");
    },
    onSuccess: () => toast({ title: `${tutor.firstName} has been blocked` }),
    onError: () => toast({ title: "Failed to block user", variant: "destructive" }),
  });

  const submitReport = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/users/${tutor.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: reportReason, details: reportDetails }),
      });
      if (!res.ok) throw new Error("Failed to report");
    },
    onSuccess: () => {
      toast({ title: "Report submitted. Our team will review it." });
      setReportOpen(false);
      setReportDetails("");
    },
    onError: () => toast({ title: "Failed to submit report", variant: "destructive" }),
  });

  return (
    <Card className="rounded-xl shadow-soft hover:shadow-elevated transition-all border-border/60 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-3">
          <Avatar className="w-12 h-12 border border-border shadow-sm">
            <AvatarImage src={tutor.profileImageUrl || ""} />
            <AvatarFallback className="bg-primary/8 text-primary text-base font-bold">{tutor.firstName?.[0]}</AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-md">
              <Star className="w-3 h-3 fill-current" />
              <span className="text-[10px] font-bold">4.8</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground">
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem onClick={() => blockUser.mutate()} className="text-xs gap-2 cursor-pointer">
                  <Ban className="w-3.5 h-3.5" /> Block user
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setReportOpen(true)} className="text-xs gap-2 text-destructive cursor-pointer">
                  <Flag className="w-3.5 h-3.5" /> Report user
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold">{tutor.firstName} {tutor.lastName}</h3>
          {isAvailableNow && (
            <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" /> Available Now
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 mb-2">
          <MapPin className="w-3 h-3" /> {tutor.university} · Lvl {tutor.level}
        </p>
        {isAvailableToday && !isAvailableNow && (
          <div className="flex items-center gap-1 mb-2">
            <Clock className="w-3 h-3 text-blue-500" />
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
              Available today: {todaySlots.map((s: any) => `${s.startTime}–${s.endTime}`).join(", ")}
            </span>
          </div>
        )}

        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{tutor.bio || "Peer tutor ready to help you succeed!"}</p>

        {tutorCourses && tutorCourses.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {tutorCourses.map((tc: any) => (
              <Badge key={tc.id} variant="secondary" className="rounded-md text-[10px] bg-primary/5 text-primary px-2 py-0.5">
                {tc.course?.code || tc.courseId} {tc.grade ? `(${tc.grade})` : ""}
              </Badge>
            ))}
          </div>
        )}

        <ConnectDialog tutor={tutor} tutorCourses={tutorCourses || []} />

        {/* Report dialog */}
        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogContent className="sm:max-w-[380px] rounded-xl p-5">
            <DialogHeader>
              <DialogTitle className="text-base">Report {tutor.firstName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Reason</Label>
                <Select value={reportReason} onValueChange={setReportReason}>
                  <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="harassment">Harassment</SelectItem>
                    <SelectItem value="spam">Spam</SelectItem>
                    <SelectItem value="inappropriate">Inappropriate content</SelectItem>
                    <SelectItem value="fake">Fake profile</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Details (optional)</Label>
                <Textarea className="resize-none rounded-lg text-sm min-h-[72px]" placeholder="Describe the issue..."
                  value={reportDetails} onChange={e => setReportDetails(e.target.value)} />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" size="sm" onClick={() => setReportOpen(false)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={() => submitReport.mutate()} disabled={submitReport.isPending}>
                {submitReport.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Submit Report"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function ConnectDialog({ tutor, tutorCourses }: { tutor: any, tutorCourses: any[] }) {
  const [open, setOpen] = useState(false);
  const createSession = useCreateSession();
  const { toast } = useToast();
  const [courseId, setCourseId] = useState("");
  const [notes, setNotes] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState("4");

  const handleSubmit = () => {
    if (!courseId) return;
    createSession.mutate({
      tutorId: tutor.id,
      courseId: parseInt(courseId),
      notes: notes || undefined,
      recurringWeeks: recurring ? parseInt(recurringWeeks) : undefined,
    } as any, {
      onSuccess: () => {
        setOpen(false);
        setCourseId("");
        setNotes("");
        setRecurring(false);
        toast({ title: recurring ? `${recurringWeeks} recurring sessions requested!` : "Request sent! The tutor will be notified." });
      },
      onError: () => {
        toast({ title: "Failed to send request", variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full rounded-lg text-xs h-9" size="sm">
          Connect with {tutor.firstName}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] rounded-xl p-5">
        <DialogHeader className="mb-3">
          <DialogTitle className="text-lg font-bold">Connect with {tutor.firstName}</DialogTitle>
          <p className="text-xs text-muted-foreground">Send a request. Once accepted, you can chat to agree on a time.</p>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Select a course {tutor.firstName} teaches</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="h-10 rounded-lg text-sm">
                <SelectValue placeholder="Pick a course" />
              </SelectTrigger>
              <SelectContent>
                {tutorCourses.length > 0 ? (
                  tutorCourses.map((tc: any) => (
                    <SelectItem key={tc.courseId || tc.id} value={(tc.courseId || tc.id).toString()}>
                      {tc.course?.code ? `${tc.course.code} - ${tc.course.name}` : `Course ${tc.courseId}`}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>No courses listed</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Message (optional)</Label>
            <Textarea
              placeholder="Hi! I need help with chapter 4 derivatives..."
              className="resize-none rounded-lg text-sm min-h-[80px]"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Recurring session toggle */}
          <div className="border border-border/60 rounded-lg p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)}
                className="rounded border-border" />
              <span className="text-xs font-semibold">Recurring weekly sessions</span>
            </label>
            {recurring && (
              <div className="flex items-center gap-2 pl-5">
                <span className="text-xs text-muted-foreground">Repeat for</span>
                <Select value={recurringWeeks} onValueChange={setRecurringWeeks}>
                  <SelectTrigger className="h-7 w-20 rounded-md text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["2","3","4","6","8","10","12"].map(w => (
                      <SelectItem key={w} value={w}>{w} weeks</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button
            className="w-full h-10 rounded-lg text-sm font-semibold"
            onClick={handleSubmit}
            disabled={createSession.isPending || !courseId}
          >
            {createSession.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> :
              recurring ? `Send ${recurringWeeks} Recurring Requests` : "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
