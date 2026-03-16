import { useAuth } from "@/hooks/use-auth";
import { useSessions } from "@/hooks/use-sessions";
import { useI18n } from "@/lib/i18n";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calendar, Clock, ArrowRight, UserCheck, CheckCircle2, TrendingUp,
  BookOpen, Search, Flame, Zap, Award, Target, Sparkles, Star,
  ChevronRight, GraduationCap, MessageSquare, Video
} from "lucide-react";
import { format, differenceInMinutes, differenceInCalendarDays, isToday, isYesterday } from "date-fns";
import { useEffect, useRef, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

// ─── Gamification helpers ────────────────────────────────────────────────────

function computeStreak(sessions: any[]): number {
  const completedDates = sessions
    .filter(s => s.status === "completed" && s.date)
    .map(s => format(new Date(s.date), "yyyy-MM-dd"))
    .sort()
    .reverse();

  if (completedDates.length === 0) return 0;

  const unique = Array.from(new Set(completedDates));
  let streak = 0;
  let checkDate = new Date();

  for (const d of unique) {
    const diff = differenceInCalendarDays(checkDate, new Date(d));
    if (diff <= 1) {
      streak++;
      checkDate = new Date(d);
    } else {
      break;
    }
  }
  return streak;
}

function computeXP(sessions: any[]): number {
  const completed = sessions.filter(s => s.status === "completed").length;
  const streak = computeStreak(sessions);
  return completed * 100 + streak * 25;
}

function xpLevel(xp: number): { level: number; title: string; nextXP: number; color: string } {
  const levels = [
    { level: 1, title: "Newcomer", nextXP: 200, color: "text-slate-500" },
    { level: 2, title: "Learner", nextXP: 500, color: "text-blue-500" },
    { level: 3, title: "Scholar", nextXP: 1000, color: "text-indigo-500" },
    { level: 4, title: "Expert", nextXP: 2000, color: "text-violet-500" },
    { level: 5, title: "Master", nextXP: 99999, color: "text-amber-500" },
  ];
  return levels.findLast(l => xp >= (l.level === 1 ? 0 : levels[l.level - 2]?.nextXP || 0)) || levels[0];
}

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return format(d, "yyyy-MM-dd");
  });
}

// ─── Fade-in animation ───────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function Dashboard() {
  const { user } = useAuth();
  const { data: sessions, isLoading } = useSessions();
  const { t } = useI18n();
  const { toast } = useToast();
  const remindedRef = useRef<Set<number>>(new Set());

  // Session reminder
  useEffect(() => {
    if (!sessions) return;
    const check = () => {
      const now = new Date();
      sessions.forEach((s: any) => {
        if ((s.status !== "accepted" && s.status !== "scheduled") || !s.date || !s.startTime) return;
        if (remindedRef.current.has(s.id)) return;
        const [h, m] = s.startTime.split(":").map(Number);
        const sessionStart = new Date(s.date);
        sessionStart.setHours(h, m, 0, 0);
        const minutesUntil = differenceInMinutes(sessionStart, now);
        if (minutesUntil >= 0 && minutesUntil <= 30) {
          remindedRef.current.add(s.id);
          toast({
            title: `Session starting in ${minutesUntil} min`,
            description: `${s.course?.code || "Session"} with ${s.tutorId === user?.id ? s.student?.firstName : s.tutor?.firstName} at ${s.startTime}`,
          });
        }
      });
    };
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [sessions]);

  const allSessions = sessions || [];
  const upcomingSessions = allSessions.filter((s: any) =>
    (s.status === "accepted" || s.status === "scheduled") && s.date && new Date(s.date) >= new Date()
  ).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const nextSession = upcomingSessions[0] || null;
  const pendingRequests = allSessions.filter((s: any) => s.status === "pending");
  const completed = allSessions.filter((s: any) => s.status === "completed");
  const totalMinutes = completed.reduce((sum: number, s: any) => sum + (s.durationMinutes || 60), 0);
  const hoursLearned = (totalMinutes / 60).toFixed(1);

  const streak = useMemo(() => computeStreak(allSessions), [allSessions]);
  const xp = useMemo(() => computeXP(allSessions), [allSessions]);
  const levelInfo = useMemo(() => xpLevel(xp), [xp]);
  const last7 = getLast7Days();
  const studiedDays = useMemo(() => new Set(
    allSessions
      .filter(s => (s.status === "completed" || s.status === "accepted") && s.date)
      .map((s: any) => format(new Date(s.date), "yyyy-MM-dd"))
  ), [allSessions]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const stats = [
    { label: "Upcoming", value: upcomingSessions.length, icon: Calendar, color: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-l-indigo-400" },
    { label: "Pending", value: pendingRequests.length, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-l-amber-400" },
    { label: "Completed", value: completed.length, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-l-emerald-400" },
    { label: "Hours Studied", value: `${hoursLearned}h`, icon: TrendingUp, color: "text-sky-500", bg: "bg-sky-500/10", border: "border-l-sky-400" },
  ];

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-20 max-w-6xl mx-auto"
    >

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-indigo-600 text-white">
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-black/10 blur-3xl" />
            {/* Dot grid */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.5" fill="white" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dots)" />
            </svg>
          </div>

          <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6 justify-between">
            <div className="space-y-1.5">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">{greeting}</p>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Welcome back, {user?.firstName || "there"} 👋
              </h1>
              <p className="text-white/70 text-sm">
                {nextSession
                  ? `Next session: ${(nextSession as any).course?.code || "Session"} on ${format(new Date(nextSession.date!), "EEE, MMM d")} at ${nextSession.startTime}`
                  : upcomingSessions.length === 0
                    ? "No upcoming sessions yet. Start learning today!"
                    : `You have ${upcomingSessions.length} upcoming session${upcomingSessions.length > 1 ? "s" : ""}`
                }
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* XP Badge */}
              <div className="hidden sm:flex flex-col items-center bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span className="text-[11px] font-bold text-white/70 uppercase tracking-wide">Level {levelInfo.level}</span>
                </div>
                <span className="text-xl font-bold">{xp} XP</span>
                <span className="text-[10px] text-white/50 mt-0.5">{levelInfo.title}</span>
              </div>

              {/* Streak Badge */}
              <div className="hidden sm:flex flex-col items-center bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
                <div className="flex items-center gap-1 mb-0.5">
                  <Flame className="w-3.5 h-3.5 text-orange-300" />
                  <span className="text-[11px] font-bold text-white/70 uppercase tracking-wide">Streak</span>
                </div>
                <span className="text-xl font-bold">{streak}</span>
                <span className="text-[10px] text-white/50 mt-0.5">{streak === 1 ? "day" : "days"}</span>
              </div>

              {user?.role === "tutor" ? (
                <Link href="/sessions">
                  <Button variant="secondary" size="sm" className="rounded-lg font-semibold gap-1.5 shadow-md bg-white text-primary hover:bg-white/90">
                    View Requests <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              ) : (
                <Link href="/tutors">
                  <Button variant="secondary" size="sm" className="rounded-lg font-semibold gap-1.5 shadow-md bg-white text-primary hover:bg-white/90">
                    Find a Tutor <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Stats Row ────────────────────────────────────────────────────── */}
      <motion.div variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <motion.div key={s.label} variants={fadeUp}>
            <Card className={`rounded-xl border-l-4 ${s.border} border-border/50 shadow-sm hover:shadow-md transition-shadow`}>
              <CardContent className="p-4">
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                  <s.icon className={`w-4.5 h-4.5 ${s.color}`} />
                </div>
                <div className="text-2xl font-bold tracking-tight">{s.value}</div>
                <div className="text-xs text-muted-foreground font-medium mt-0.5">{s.label}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Main Grid ────────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Left: Upcoming sessions */}
        <motion.div variants={fadeUp} className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> Upcoming Sessions
            </h2>
            <Link href="/sessions" className="text-xs text-primary hover:underline font-medium flex items-center gap-0.5">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />)}
            </div>
          ) : upcomingSessions.length > 0 ? (
            <div className="space-y-3">
              {upcomingSessions.slice(0, 4).map((session: any, idx: number) => (
                <motion.div key={session.id} variants={fadeUp} custom={idx}>
                  <Card className="rounded-xl border-border/60 shadow-sm hover:shadow-md transition-all group">
                    <CardContent className="p-0 flex items-stretch">
                      {/* Date block */}
                      <div className="flex flex-col justify-center items-center w-16 bg-primary/5 border-r border-border/50 py-4 shrink-0 rounded-l-xl group-hover:bg-primary/8 transition-colors">
                        <span className="text-[9px] font-bold uppercase text-primary/60 tracking-wider">{format(new Date(session.date), "MMM")}</span>
                        <span className="text-xl font-bold text-primary">{format(new Date(session.date), "dd")}</span>
                        <span className="text-[9px] text-muted-foreground">{format(new Date(session.date), "EEE")}</span>
                      </div>
                      {/* Info */}
                      <div className="flex-1 p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-sm">{session.course?.code || "Session"}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              {session.startTime || "TBD"} · {session.durationMinutes || 60}m
                            </p>
                          </div>
                          <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Confirmed
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <UserCheck className="w-3 h-3" />
                            {session.tutorId === user?.id
                              ? `Teaching ${session.student?.firstName || "Student"}`
                              : `Tutor: ${session.tutor?.firstName || "Unknown"}`
                            }
                          </span>
                          <div className="flex items-center gap-2">
                            <Link href={`/sessions/${session.id}`}>
                              <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg px-2.5 text-muted-foreground hover:text-primary hover:bg-primary/5 gap-1">
                                <MessageSquare className="w-3 h-3" /> Chat
                              </Button>
                            </Link>
                            <Link href={`/sessions/${session.id}`}>
                              <Button size="sm" className="h-7 text-[11px] rounded-lg px-2.5 gap-1">
                                <Video className="w-3 h-3" /> Enter
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card className="rounded-xl border border-dashed border-border/60 bg-transparent shadow-none">
              <CardContent className="p-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <GraduationCap className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <h3 className="font-semibold text-sm mb-1">No upcoming sessions</h3>
                <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
                  {user?.role === "tutor"
                    ? "Students will appear here once they request a session with you."
                    : "Find a tutor and book your first session to start learning."}
                </p>
                {user?.role !== "tutor" && (
                  <Link href="/tutors">
                    <Button size="sm" className="rounded-lg text-xs px-5 gap-1.5">
                      <Search className="w-3 h-3" /> Browse Tutors
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pending requests (for tutors) */}
          {user?.role === "tutor" && pendingRequests.length > 0 && (
            <motion.div variants={fadeUp}>
              <Card className="rounded-xl border-border/60 shadow-sm">
                <CardHeader className="pb-2 border-b border-border/50 px-4 pt-4">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                    </span>
                    Pending Requests
                    <span className="ml-auto bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                      {pendingRequests.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-border/50">
                  {pendingRequests.slice(0, 3).map((req: any) => (
                    <div key={req.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors">
                      <div>
                        <p className="font-semibold text-xs">{req.course?.code || "Subject"}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {req.student?.firstName} · {req.date ? format(new Date(req.date), "MMM dd") : "Date TBD"}
                        </p>
                      </div>
                      <Link href="/sessions">
                        <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-lg px-2.5 border-primary/20 text-primary hover:bg-primary/5">
                          Review →
                        </Button>
                      </Link>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>

        {/* Right Sidebar */}
        <motion.div variants={stagger} className="space-y-4">

          {/* Study Streak Widget */}
          <motion.div variants={fadeUp}>
            <Card className="rounded-xl border-border/60 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 px-4 pt-4 pb-3 border-b border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-semibold flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-orange-500" /> Study Streak
                  </h3>
                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                    {streak} {streak === 1 ? "day" : "days"} 🔥
                  </span>
                </div>
                {/* 7-day streak dots */}
                <div className="flex items-center gap-1.5 mt-2">
                  {last7.map((day, i) => {
                    const studied = studiedDays.has(day);
                    const isToday2 = day === format(new Date(), "yyyy-MM-dd");
                    return (
                      <div key={day} className="flex flex-col items-center gap-0.5 flex-1">
                        <div className={`w-full aspect-square rounded-md ${studied ? "bg-orange-400" : isToday2 ? "bg-muted border-2 border-dashed border-border" : "bg-muted"}`} />
                        <span className="text-[9px] text-muted-foreground">{format(new Date(day), "EEEEE")}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* XP Progress */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500" /> Level {levelInfo.level} · {levelInfo.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{xp} / {levelInfo.nextXP} XP</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
                    style={{ width: `${Math.min(100, (xp / levelInfo.nextXP) * 100)}%` }}
                  />
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Achievements */}
          <motion.div variants={fadeUp}>
            <Card className="rounded-xl border-border/60 shadow-sm">
              <CardHeader className="pb-2 px-4 pt-4 border-b border-border/50">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-violet-500" /> Achievements
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 grid grid-cols-3 gap-2">
                {[
                  { icon: "🎓", label: "First Session", earned: completed.length >= 1 },
                  { icon: "⭐", label: "5 Sessions", earned: completed.length >= 5 },
                  { icon: "🔥", label: "3-Day Streak", earned: streak >= 3 },
                  { icon: "📚", label: "10 Sessions", earned: completed.length >= 10 },
                  { icon: "💎", label: "10h Studied", earned: parseFloat(hoursLearned) >= 10 },
                  { icon: "🏆", label: "25 Sessions", earned: completed.length >= 25 },
                ].map((a) => (
                  <div key={a.label}
                    className={`flex flex-col items-center text-center p-2 rounded-lg border transition-all ${
                      a.earned
                        ? "bg-violet-500/8 border-violet-300/30 dark:border-violet-700/30"
                        : "bg-muted/30 border-border/30 opacity-40 grayscale"
                    }`}>
                    <span className="text-lg mb-0.5">{a.icon}</span>
                    <span className="text-[9px] text-muted-foreground font-medium leading-tight">{a.label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={fadeUp}>
            <Card className="rounded-xl border-border/60 shadow-sm">
              <CardContent className="p-4 space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</p>
                {[
                  { href: "/tutors", icon: Search, label: "Find a Tutor", desc: "Browse available tutors" },
                  { href: "/sessions", icon: Calendar, label: "My Sessions", desc: "View & manage sessions" },
                  { href: "/profile", icon: UserCheck, label: "Edit Profile", desc: "Update your info" },
                ].map(item => (
                  <Link key={item.href} href={item.href}>
                    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:border-primary/20 hover:bg-primary/4 transition-all group cursor-pointer">
                      <div className="w-7 h-7 rounded-lg bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors shrink-0">
                        <item.icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold group-hover:text-primary transition-colors">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                      </div>
                      <ChevronRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-primary/60 ml-auto transition-colors shrink-0" />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Study Tip */}
          <motion.div variants={fadeUp}>
            <Card className="rounded-xl border-border/60 shadow-sm bg-gradient-to-br from-primary/5 to-indigo-500/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-primary mb-1">Study Tip</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Spaced repetition is one of the most effective study techniques. Review material at increasing intervals to boost long-term retention.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </motion.div>
      </div>
    </motion.div>
  );
}
