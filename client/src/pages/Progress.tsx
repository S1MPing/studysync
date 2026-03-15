import { useSessions } from "@/hooks/use-sessions";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Clock, Users, Star, CheckCircle2, BookOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Progress() {
  const { user } = useAuth();
  const { data: sessions, isLoading } = useSessions();

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isTutor = user?.role === "tutor";

  const mySessions = isTutor
    ? sessions?.filter((s: any) => s.tutorId === user?.id) || []
    : sessions?.filter((s: any) => s.studentId === user?.id) || [];

  const completed = mySessions.filter((s: any) => s.status === "completed");
  const pending = mySessions.filter((s: any) => s.status === "pending");
  const accepted = mySessions.filter((s: any) => s.status === "accepted" || s.status === "scheduled");
  const cancelled = mySessions.filter((s: any) => s.status === "cancelled" || s.status === "declined");

  const totalMinutes = completed.reduce((sum: number, s: any) => sum + (s.durationMinutes || 60), 0);
  const hoursTotal = (totalMinutes / 60).toFixed(1);

  // Unique tutors/students
  const uniqueCounterparties = new Set(
    completed.map((s: any) => isTutor ? s.studentId : s.tutorId)
  ).size;

  // Unique courses
  const uniqueCourses = new Set(completed.map((s: any) => s.courseId).filter(Boolean)).size;

  // Last 5 completed
  const recentCompleted = [...completed]
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const stats = [
    {
      label: isTutor ? "Sessions Taught" : "Sessions Completed",
      value: completed.length,
      icon: CheckCircle2,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: isTutor ? "Hours Tutored" : "Hours Learned",
      value: `${hoursTotal}h`,
      icon: Clock,
      color: "text-violet-600",
      bg: "bg-violet-500/10",
    },
    {
      label: isTutor ? "Students Helped" : "Tutors Worked With",
      value: uniqueCounterparties,
      icon: Users,
      color: "text-teal-600",
      bg: "bg-teal-500/10",
    },
    {
      label: "Courses",
      value: uniqueCourses,
      icon: BookOpen,
      color: "text-amber-600",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto w-full space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-display">My Progress</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-2">
          {isTutor ? "Your tutoring statistics and history." : "Track your learning journey and session history."}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-5">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-2xl font-bold font-display">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Session status breakdown */}
      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-6">
          <h2 className="text-sm font-semibold mb-4">Session Breakdown</h2>
          <div className="space-y-3">
            {[
              { label: "Completed", count: completed.length, color: "bg-blue-500/10 text-blue-700 border-blue-200" },
              { label: "Active / Upcoming", count: accepted.length, color: "bg-primary/10 text-primary border-primary/20" },
              { label: "Pending", count: pending.length, color: "bg-amber-100 text-amber-800 border-amber-200" },
              { label: "Cancelled / Declined", count: cancelled.length, color: "bg-muted text-muted-foreground border-border" },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <Badge variant="outline" className={`text-xs font-semibold px-3 py-0.5 rounded-full ${color}`}>
                  {count}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent completed sessions */}
      {recentCompleted.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Recent Completed Sessions</h2>
          <div className="space-y-3">
            {recentCompleted.map((s: any) => (
              <Card key={s.id} className="rounded-xl border-border/50 hover:shadow-sm transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-muted flex flex-col items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold uppercase text-muted-foreground leading-none">
                      {s.date ? format(new Date(s.date), "MMM") : "—"}
                    </span>
                    <span className="text-base font-bold leading-none">
                      {s.date ? format(new Date(s.date), "d") : "—"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {s.course?.code || `Session #${s.id}`}
                      {s.course?.name ? ` – ${s.course.name}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isTutor ? `Student: ${s.student?.firstName || "Unknown"}` : `Tutor: ${s.tutor?.firstName || "Unknown"}`}
                      {s.durationMinutes ? ` · ${s.durationMinutes} min` : ""}
                    </p>
                  </div>
                  <Link href={`/sessions/${s.id}`}>
                    <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {completed.length === 0 && (
        <div className="text-center py-16 bg-muted/20 rounded-3xl border border-dashed border-border/60">
          <TrendingUp className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-lg font-bold font-display">No completed sessions yet</h3>
          <p className="text-muted-foreground mt-2 mb-6 text-sm max-w-sm mx-auto">
            {isTutor
              ? "Your stats will show up here once you complete tutoring sessions."
              : "Your learning journey starts here. Find a tutor and book your first session!"}
          </p>
          {!isTutor && (
            <Link href="/tutors">
              <Button className="rounded-full px-8 shadow-md">Find Tutors</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
