import { ReactNode, useState, useEffect, useCallback } from "react";
import { GlobalSearch, useGlobalSearch } from "@/components/GlobalSearch";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useI18n, languageNames, type Language } from "@/lib/i18n";
import {
  LayoutDashboard, Search, Calendar,
  LogOut, Loader2, Settings, Bell, Moon, Sun, Monitor,
  HelpCircle, X, ChevronRight, ChevronDown, Globe, Info, User, Shield, Menu, FolderOpen, TrendingUp,
  Phone, PhoneOff, Video, MessageSquare, PhoneCall, CalendarCheck, Check, Trash2, Volume2, VolumeX,
  Brain, Users, Clock
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useIncomingCall } from "@/hooks/use-incoming-call";
import { useGlobalRealtime } from "@/hooks/use-global-ws";
import { useNotifications, type AppNotification } from "@/hooks/use-notifications";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useSessionReminders } from "@/hooks/use-session-reminders";
import { formatDistanceToNow } from "date-fns";

type ThemeMode = "light" | "dark" | "system";

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove("dark");
  if (mode === "dark") root.classList.add("dark");
  else if (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) root.classList.add("dark");
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout, isLoggingOut } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [notifSettingsOpen, setNotifSettingsOpen] = useState(false);
  const { notifications: appNotifs, unreadCount: notifCount, prefs: notifPrefs, addNotification, markRead, markAllRead, clearAll, updatePrefs } = useNotifications();
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    (typeof window !== "undefined" ? localStorage.getItem("studysync-theme") as ThemeMode : null) || "light"
  );

  const setTheme = (mode: ThemeMode) => { setThemeState(mode); localStorage.setItem("studysync-theme", mode); applyTheme(mode); };

  useEffect(() => {
    applyTheme(theme);
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const h = () => applyTheme("system");
      mq.addEventListener("change", h);
      return () => mq.removeEventListener("change", h);
    }
  }, [theme]);

  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearch();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSearchOpen]);

  const isTutor = user?.role === "tutor";
  const navItems = isTutor
    ? [
        { label: t("nav.dashboard"), href: "/dashboard", icon: LayoutDashboard },
        { label: t("nav.sessions"), href: "/sessions", icon: Calendar },
        { label: "Shared Files", href: "/media", icon: FolderOpen },
        { label: "My Stats", href: "/progress", icon: TrendingUp },
        { label: t("nav.quiz") || "Quiz", href: "/quiz", icon: Brain },
        { label: t("nav.rooms") || "Rooms", href: "/rooms", icon: Users },
      ]
    : [
        { label: t("nav.dashboard"), href: "/dashboard", icon: LayoutDashboard },
        { label: t("nav.findTutors"), href: "/tutors", icon: Search },
        { label: t("nav.sessions"), href: "/sessions", icon: Calendar },
        { label: "Shared Files", href: "/media", icon: FolderOpen },
        { label: "My Progress", href: "/progress", icon: TrendingUp },
        { label: t("nav.quiz") || "Quiz", href: "/quiz", icon: Brain },
        { label: t("nav.rooms") || "Rooms", href: "/rooms", icon: Users },
      ];

  const themeOptions: { mode: ThemeMode; icon: any; label: string }[] = [
    { mode: "light", icon: Sun, label: t("settings.light") },
    { mode: "dark", icon: Moon, label: t("settings.dark") },
    { mode: "system", icon: Monitor, label: t("settings.system") },
  ];
  const languages: Language[] = ["en", "fr", "de", "es", "tw"];

  // Unread message count from sessions lastMessage + localStorage lastSeen
  const { data: sessions } = useQuery<any[]>({
    queryKey: ["/api/sessions"],
    queryFn: async () => {
      const res = await fetch("/api/sessions", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const unreadCount = (() => {
    if (!sessions || !user) return 0;
    try {
      const lastSeen: Record<string, string> = JSON.parse(localStorage.getItem("ss_last_seen") || "{}");
      return sessions.filter((s: any) => {
        const lm = s.lastMessage;
        if (!lm || lm.senderId === user.id) return false;
        const seen = lastSeen[s.id];
        if (!seen) return true;
        return new Date(lm.createdAt) > new Date(seen);
      }).length;
    } catch { return 0; }
  })();

  const { permission: pushPermission, requestPermission: requestPush, notify: pushNotify } = usePushNotifications();
  const addNotificationWithPush = useCallback((notif: Omit<AppNotification, "id" | "timestamp" | "read">) => {
    addNotification(notif);
    if (pushPermission === "granted") {
      pushNotify(notif.title, notif.body, notif.sessionId ? `/sessions/${notif.sessionId}` : undefined);
    }
  }, [addNotification, pushNotify, pushPermission]);

  const { incomingCall, answerCall, declineCall } = useIncomingCall(user?.id, addNotificationWithPush);
  useGlobalRealtime(user?.id, addNotificationWithPush);
  useSessionReminders(sessions || [], addNotificationWithPush);

  if (!user) return <>{children}</>;
  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || user.email?.charAt(0).toUpperCase() || "?";
  const handleLogout = () => { setSettingsOpen(false); logout(); };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Notification Panel */}
      <AnimatePresence>
        {notifOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setNotifOpen(false)} className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[2px]" />
            <motion.div initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed right-0 top-0 h-full w-80 max-w-[100vw] bg-card border-l border-border/60 shadow-xl z-50 flex flex-col">
              <div className="flex items-center justify-between px-4 py-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">Notifications</h2>
                  {notifCount > 0 && <span className="bg-destructive text-white text-[9px] font-bold rounded-full min-w-[18px] h-4 flex items-center justify-center px-1">{notifCount}</span>}
                </div>
                <div className="flex items-center gap-1">
                  {appNotifs.length > 0 && (
                    <>
                      <button onClick={markAllRead} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground" title="Mark all read">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={clearAll} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground" title="Clear all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <button onClick={() => setNotifOpen(false)} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {appNotifs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                    <Bell className="w-8 h-8 opacity-30" />
                    <p className="text-xs">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {appNotifs.map((n) => {
                      const Icon = n.type === "message" ? MessageSquare : n.type === "call" ? PhoneCall : CalendarCheck;
                      const iconColor = n.type === "message" ? "text-blue-500" : n.type === "call" ? "text-green-500" : "text-primary";
                      const iconBg = n.type === "message" ? "bg-blue-500/10" : n.type === "call" ? "bg-green-500/10" : "bg-primary/10";
                      return (
                        <button key={n.id}
                          onClick={() => { markRead(n.id); if (n.sessionId) { setNotifOpen(false); window.location.href = `/sessions/${n.sessionId}`; } }}
                          className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${n.read ? "opacity-60" : ""}`}>
                          <div className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                            <Icon className={`w-4 h-4 ${iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <p className="text-xs font-semibold truncate">{n.title}</p>
                              {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{n.body}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">{formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Incoming call overlay */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm"
          >
            <div
              className="bg-zinc-900 text-white rounded-2xl shadow-2xl p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => answerCall(incomingCall)}
              role="button"
              aria-label={`Answer ${incomingCall.mode} call from ${incomingCall.callerName}`}
            >
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 animate-pulse">
                {incomingCall.mode === "video" ? <Video className="w-5 h-5 text-primary" /> : <Phone className="w-5 h-5 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-400">{incomingCall.mode === "video" ? "Incoming video call" : "Incoming audio call"} — tap to answer</p>
                <p className="font-semibold text-sm truncate">{incomingCall.callerName}</p>
              </div>
              <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => declineCall()}
                  className="w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
                  title="Decline"
                >
                  <PhoneOff className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => answerCall(incomingCall)}
                  className="w-9 h-9 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors"
                  title="Answer"
                >
                  <Phone className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border/60 bg-card sticky top-0 h-screen">
        <div className="px-4 py-3 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <a href="/" onClick={(e) => { e.preventDefault(); window.location.href = "/"; }} className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
              <img src="/favicon-96x96.png" alt="StudySync" className="w-7 h-7" />
              <span className="text-base font-bold tracking-tight">StudySync</span>
            </a>
            <div className="flex items-center gap-1">
              <button onClick={() => setNotifOpen(true)} className="relative w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground" title="Notifications">
                <Bell className="w-4 h-4" />
                {notifCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-destructive text-white text-[8px] font-bold rounded-full flex items-center justify-center">{notifCount > 9 ? "9+" : notifCount}</span>}
              </button>
              <button onClick={() => setSettingsOpen(true)} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground" title="Menu">
                <Menu className="w-4 h-4" />
              </button>
            </div>
          </div>
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground text-xs transition-colors"
            title="Search (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="text-[9px] bg-background border border-border rounded px-1 py-0.5 font-mono">⌘K</kbd>
          </button>
        </div>
        <nav className="flex-1 px-2.5 py-3 space-y-0.5">
          {navItems.map((item) => {
            const active = location.startsWith(item.href);
            const isSessionsNav = item.href === "/sessions";
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all relative
                  ${active ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                <item.icon className="w-4 h-4 shrink-0" />{item.label}
                {isSessionsNav && unreadCount > 0 && (
                  <span className="ml-auto bg-destructive text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="px-2.5 py-3 border-t border-border/50">
          <Link href="/profile">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
              <Avatar className="w-6 h-6 border border-border shrink-0">
                <AvatarImage src={user.profileImageUrl || ""} />
                <AvatarFallback className="bg-primary/8 text-primary text-[10px] font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{user.firstName} {user.lastName}</p>
                <p className="text-[10px] text-muted-foreground capitalize truncate">{user.role || "student"}</p>
              </div>
            </div>
          </Link>
        </div>
      </aside>

      {/* Settings panel */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSettingsOpen(false)} className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[2px]" />
            <motion.div initial={{ x: -300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed left-0 top-0 h-full w-68 bg-card border-r border-border/60 shadow-xl z-50 flex flex-col">

              <div className="flex items-center justify-between px-4 py-4 border-b border-border/50">
                <h2 className="text-sm font-semibold">{t("settings.title")}</h2>
                <button onClick={() => setSettingsOpen(false)} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="px-4 py-3 bg-muted/20 border-b border-border/50">
                <div className="flex items-center gap-2.5">
                  <Avatar className="w-8 h-8 border border-border">
                    <AvatarImage src={user.profileImageUrl || ""} />
                    <AvatarFallback className="bg-primary/8 text-primary text-xs font-bold">{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-xs">{user.firstName} {user.lastName}</p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{user.email}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
                {/* Notifications master toggle */}
                <div className="px-1">
                  <div className="flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-blue-500/8 flex items-center justify-center"><Bell className="w-3.5 h-3.5 text-blue-600" /></div>
                      <div>
                        <p className="text-xs font-medium">{t("settings.notifications")}</p>
                        <p className="text-[10px] text-muted-foreground">{notifPrefs.enabled ? "All on" : "All off"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setNotifSettingsOpen(!notifSettingsOpen)} className="text-muted-foreground">
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${notifSettingsOpen ? "rotate-180" : ""}`} />
                      </button>
                      <Switch checked={notifPrefs.enabled} onCheckedChange={(v) => updatePrefs({ enabled: v, messages: v, calls: v, sessionRequests: v, sessionUpdates: v })} />
                    </div>
                  </div>
                  <AnimatePresence>
                    {notifSettingsOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }} className="overflow-hidden">
                        <div className="space-y-0.5 pb-1 pl-9 pr-2">
                          {([
                            { key: "messages", icon: MessageSquare, label: "Messages", color: "text-blue-500" },
                            { key: "calls", icon: PhoneCall, label: "Calls", color: "text-green-500" },
                            { key: "sessionRequests", icon: CalendarCheck, label: "Session Requests", color: "text-primary" },
                            { key: "sessionUpdates", icon: CalendarCheck, label: "Session Updates", color: "text-primary" },
                          ] as const).map(({ key, icon: Icon, label, color }) => (
                            <div key={key} className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50">
                              <div className="flex items-center gap-2">
                                <Icon className={`w-3 h-3 ${color}`} />
                                <span className="text-xs text-muted-foreground">{label}</span>
                              </div>
                              <Switch
                                checked={notifPrefs[key]}
                                onCheckedChange={(v) => updatePrefs({ [key]: v, enabled: v || notifPrefs.messages || notifPrefs.calls || notifPrefs.sessionRequests || notifPrefs.sessionUpdates })}
                              />
                            </div>
                          ))}
                          {/* Push notifications permission */}
                          <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50">
                            <div className="flex items-center gap-2">
                              <Bell className="w-3 h-3 text-violet-500" />
                              <span className="text-xs text-muted-foreground">Browser Push</span>
                            </div>
                            {pushPermission === "granted" ? (
                              <span className="text-[10px] text-emerald-600 font-medium">Enabled</span>
                            ) : pushPermission === "denied" ? (
                              <span className="text-[10px] text-destructive font-medium">Blocked</span>
                            ) : (
                              <button
                                onClick={requestPush}
                                className="text-[10px] text-primary font-semibold hover:underline"
                              >
                                Enable
                              </button>
                            )}
                          </div>
                          {/* Sound toggle */}
                          <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50">
                            <div className="flex items-center gap-2">
                              {notifPrefs.soundEnabled
                                ? <Volume2 className="w-3 h-3 text-amber-500" />
                                : <VolumeX className="w-3 h-3 text-muted-foreground" />}
                              <span className="text-xs text-muted-foreground">Notification Sound</span>
                            </div>
                            <Switch
                              checked={notifPrefs.soundEnabled}
                              onCheckedChange={(v) => updatePrefs({ soundEnabled: v })}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Theme dropdown */}
                <div className="px-1">
                  <button onClick={() => setThemeOpen(!themeOpen)}
                    className="w-full flex items-center gap-2.5 px-2 py-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-7 h-7 rounded-md bg-slate-500/8 flex items-center justify-center">
                      {theme === "dark" ? <Moon className="w-3.5 h-3.5 text-slate-500" /> : theme === "system" ? <Monitor className="w-3.5 h-3.5 text-slate-500" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-xs font-medium">{t("settings.theme")}</p>
                      <p className="text-[10px] text-muted-foreground">{themeOptions.find(o => o.mode === theme)?.label}</p>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${themeOpen ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {themeOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }} className="overflow-hidden">
                        <div className="space-y-0.5 pb-1 pl-9">
                          {themeOptions.map((opt) => (
                            <button key={opt.mode} onClick={() => { setTheme(opt.mode); setThemeOpen(false); }}
                              className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center gap-2 transition-all
                                ${theme === opt.mode ? "bg-primary text-white font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                              <opt.icon className="w-3.5 h-3.5" /> {opt.label}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Language dropdown */}
                <div className="px-1">
                  <button onClick={() => setLangOpen(!langOpen)}
                    className="w-full flex items-center gap-2.5 px-2 py-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-7 h-7 rounded-md bg-orange-500/8 flex items-center justify-center"><Globe className="w-3.5 h-3.5 text-orange-500" /></div>
                    <div className="flex-1 text-left">
                      <p className="text-xs font-medium">{t("settings.language")}</p>
                      <p className="text-[10px] text-muted-foreground">{languageNames[language]}</p>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${langOpen ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {langOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }} className="overflow-hidden">
                        <div className="space-y-0.5 pb-1 pl-9">
                          {languages.map((lang) => (
                            <button key={lang} onClick={() => { setLanguage(lang); setLangOpen(false); }}
                              className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-all
                                ${language === lang ? "bg-primary text-white font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                              {languageNames[lang]}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="my-1.5 border-t border-border/50 mx-2" />

                <Link href="/profile" onClick={() => setSettingsOpen(false)}>
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="w-7 h-7 rounded-md bg-primary/8 flex items-center justify-center"><User className="w-3.5 h-3.5 text-primary" /></div>
                    <p className="text-xs font-medium flex-1">{t("nav.profile")}</p>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </Link>
                <Link href="/about" onClick={() => setSettingsOpen(false)}>
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="w-7 h-7 rounded-md bg-violet-500/8 flex items-center justify-center"><Info className="w-3.5 h-3.5 text-violet-500" /></div>
                    <p className="text-xs font-medium flex-1">{t("nav.about")}</p>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </Link>
                <Link href="/media" onClick={() => setSettingsOpen(false)}>
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="w-7 h-7 rounded-md bg-teal-500/8 flex items-center justify-center"><FolderOpen className="w-3.5 h-3.5 text-teal-600" /></div>
                    <p className="text-xs font-medium flex-1">Shared Files</p>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </Link>
                {(user as any)?.isAdmin && (
                  <Link href="/admin" onClick={() => setSettingsOpen(false)}>
                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="w-7 h-7 rounded-md bg-amber-500/8 flex items-center justify-center"><Shield className="w-3.5 h-3.5 text-amber-500" /></div>
                      <p className="text-xs font-medium flex-1">Admin Panel</p>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                )}
                <Link href="/help" onClick={() => setSettingsOpen(false)}>
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="w-7 h-7 rounded-md bg-emerald-500/8 flex items-center justify-center"><HelpCircle className="w-3.5 h-3.5 text-emerald-500" /></div>
                    <p className="text-xs font-medium flex-1">{t("nav.help")}</p>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </Link>
              </div>

              <div className="px-2.5 py-3 border-t border-border/50">
                <button onClick={handleLogout} disabled={isLoggingOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-destructive hover:bg-destructive/8 transition-colors font-medium text-xs">
                  {isLoggingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                  {t("nav.logout")}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-30 w-full border-b border-border/60 bg-card/90 backdrop-blur-md">
          <div className="px-4 flex items-center justify-between h-12">
            <a href="/" onClick={(e) => { e.preventDefault(); window.location.href = "/"; }} className="flex items-center gap-2 cursor-pointer">
              <img src="/favicon-96x96.png" alt="StudySync" className="w-6 h-6" />
              <span className="text-sm font-bold">StudySync</span>
            </a>
            <div className="flex items-center gap-1">
              <button onClick={() => setSearchOpen(true)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/60 transition-colors text-muted-foreground">
                <Search className="w-4 h-4" />
              </button>
              <button onClick={() => setNotifOpen(true)} className="relative w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground">
                <Bell className="w-4 h-4" />
                {notifCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-destructive text-white text-[8px] font-bold rounded-full flex items-center justify-center">{notifCount > 9 ? "9+" : notifCount}</span>}
              </button>
              <button onClick={() => setSettingsOpen(true)} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground">
                <Menu className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>
        {!(user as any).isVerified && (
          <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center gap-2.5">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-snug flex-1">
              <span className="font-semibold">Account pending verification.</span>{" "}
              We review new accounts within 24–48 hours. Booking sessions, joining rooms, and calls are locked until then.
            </p>
          </div>
        )}
        <main className="flex-1 px-4 md:px-6 py-6 max-w-5xl w-full mx-auto">{children}</main>
        <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border/60 bg-card/95 backdrop-blur-md pb-safe pt-1 px-1 flex justify-around z-30">
          {navItems.map((item) => {
            const active = location.startsWith(item.href);
            const isSessionsNav = item.href === "/sessions";
            // Shorten long labels for mobile
            const mobileLabel = item.label === "Find Tutors" ? "Tutors"
              : item.label === "Shared Files" ? "Files"
              : item.label === "My Progress" ? "Progress"
              : item.label === "My Stats" ? "Stats"
              : item.label;
            return (
              <Link key={item.href} href={item.href}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg transition-colors relative min-w-0 flex-1 max-w-[68px] ${active ? "text-primary" : "text-muted-foreground"}`}>
                <div className="relative">
                  <item.icon className="w-[18px] h-[18px]" />
                  {isSessionsNav && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-destructive text-white text-[7px] font-bold rounded-full min-w-[11px] h-[11px] flex items-center justify-center px-0.5">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-[8px] font-medium truncate w-full text-center">{mobileLabel}</span>
              </Link>
            );
          })}
          <button onClick={() => setSettingsOpen(true)} className="flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg text-muted-foreground flex-1 max-w-[68px]">
            <Settings className="w-[18px] h-[18px]" /><span className="text-[8px] font-medium">More</span>
          </button>
        </div>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
