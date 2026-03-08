import { useAuth } from "@/hooks/use-auth";
import { useSessions } from "@/hooks/use-sessions";
import { useI18n } from "@/lib/i18n";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, ArrowRight, UserCheck, CheckCircle2, TrendingUp, BookOpen, Search } from "lucide-react";
import { format } from "date-fns";

export function Dashboard() {
  const { user } = useAuth();
  const { data: sessions, isLoading } = useSessions();
  const { t } = useI18n();

  const upcomingSessions = sessions?.filter(s =>
    s.status === "accepted" && new Date(s.date) >= new Date()
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 3) || [];

  const pendingRequests = sessions?.filter(s => s.status === "pending") || [];
  const completed = sessions?.filter(s => s.status === "completed") || [];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("dashboard.goodMorning") : hour < 17 ? t("dashboard.goodAfternoon") : t("dashboard.goodEvening");

  return (
    <div className="space-y-8 pb-20">

      {/* Welcome */}
      <div className="bg-primary rounded-2xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-[0.07]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <p className="text-primary-foreground/60 text-xs font-medium mb-1 uppercase tracking-wide">{greeting}</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              {t("dashboard.welcome")}, {user?.firstName || "there"}
            </h1>
            <p className="text-primary-foreground/60 mt-1 text-sm">
              {upcomingSessions.length > 0
                ? t("dashboard.hasUpcoming", { count: upcomingSessions.length, s: upcomingSessions.length > 1 ? "s" : "" })
                : t("dashboard.noUpcomingShort")}
            </p>
          </div>
          <Link href="/tutors">
            <Button variant="secondary" className="rounded-lg font-semibold text-sm gap-1.5 shrink-0 shadow-sm">
              {t("dashboard.findATutor")} <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t("dashboard.upcoming"), value: upcomingSessions.length, icon: Calendar, color: "text-primary", bg: "bg-primary/8" },
          { label: t("dashboard.pending"), value: pendingRequests.length, icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/8" },
          { label: t("dashboard.completed"), value: completed.length, icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/8" },
          { label: t("dashboard.hoursLearned"), value: `${completed.length}h`, icon: TrendingUp, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/8" },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-xl border-border/60 shadow-soft">
            <CardContent className="p-4">
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
              <div className="text-xs text-muted-foreground font-medium mt-0.5">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Upcoming */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("dashboard.upcomingSessions")}</h2>
            <Link href="/sessions" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
              {t("dashboard.viewAll")} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />)}
            </div>
          ) : upcomingSessions.length > 0 ? (
            <div className="space-y-3">
              {upcomingSessions.map((session) => (
                <Card key={session.id} className="rounded-xl border-border/60 shadow-soft hover:shadow-elevated transition-shadow">
                  <CardContent className="p-0 flex items-stretch">
                    <div className="flex flex-col justify-center items-center w-16 bg-primary/4 border-r border-border/50 py-3 shrink-0 rounded-l-xl">
                      <span className="text-[9px] font-bold uppercase text-primary/50 tracking-wider">{format(new Date(session.date), "MMM")}</span>
                      <span className="text-xl font-bold text-primary">{format(new Date(session.date), "dd")}</span>
                    </div>
                    <div className="flex-1 p-3.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-sm">{session.course?.code || "Session"}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {session.startTime} · {session.durationMinutes}m
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold bg-primary/8 text-primary px-2 py-0.5 rounded-md flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" /> {t("dashboard.confirmed")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <UserCheck className="w-3 h-3" />
                          {session.tutorId === user?.id ? t("dashboard.youreTeaching") : `${t("dashboard.tutor")}: ${session.tutor?.firstName}`}
                        </span>
                        <Link href={`/sessions/${session.id}`}>
                          <Button variant="outline" size="sm" className="h-6 text-[10px] rounded-md px-2.5 border-primary/15 text-primary hover:bg-primary hover:text-white transition-colors">
                            {t("dashboard.enterRoom")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-xl border border-dashed border-border/60 bg-transparent shadow-none">
              <CardContent className="p-10 text-center">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-5 h-5 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-sm mb-1">{t("dashboard.noUpcoming")}</h3>
                <p className="text-xs text-muted-foreground mb-4">{t("dashboard.noUpcomingDesc")}</p>
                <Link href="/tutors">
                  <Button size="sm" className="rounded-lg text-xs px-4">{t("dashboard.browseTutors")}</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="rounded-xl border-border/60 shadow-soft">
            <CardHeader className="pb-2 border-b border-border/50 px-4 pt-4">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  {pendingRequests.length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${pendingRequests.length > 0 ? "bg-amber-400" : "bg-muted-foreground/30"}`} />
                </span>
                {t("dashboard.pendingRequests")}
                {pendingRequests.length > 0 && (
                  <span className="ml-auto bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    {pendingRequests.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pendingRequests.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {pendingRequests.slice(0, 4).map((req) => (
                    <div key={req.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                      <p className="font-semibold text-xs">{req.course?.code || "Subject"}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(req.date), "MMM dd")} at {req.startTime}</p>
                      <Link href="/sessions">
                        <Button variant="link" size="sm" className="px-0 h-auto mt-1 text-[10px] text-primary font-semibold">{t("dashboard.review")} →</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <CheckCircle2 className="w-6 h-6 text-muted-foreground/20 mx-auto mb-1.5" />
                  <p className="text-xs text-muted-foreground">{t("dashboard.allCaughtUp")}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/60 shadow-soft">
            <CardContent className="p-4 space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("dashboard.quickActions")}</p>
              {[
                { href: "/tutors", icon: Search, label: t("dashboard.findATutor") },
                { href: "/sessions", icon: Calendar, label: t("nav.sessions") },
                { href: "/profile", icon: UserCheck, label: t("dashboard.editProfile") },
              ].map(item => (
                <Link key={item.href} href={item.href}>
                  <Button variant="outline" className="w-full justify-start rounded-lg h-9 text-xs border-border/60 hover:border-primary/20 hover:bg-primary/4 hover:text-primary gap-2">
                    <item.icon className="w-3.5 h-3.5" /> {item.label}
                  </Button>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
