import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useI18n, languageNames, type Language } from "@/lib/i18n";
import {
  GraduationCap, LayoutDashboard, Search, Calendar,
  LogOut, Loader2, Settings, Bell, Moon, Sun, Monitor,
  HelpCircle, X, ChevronRight, ChevronDown, Globe, Info, User
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";

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
  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [notifications, setNotifications] = useState(true);
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

  const isTutor = user?.role === "tutor";
  const navItems = [
    { label: t("nav.dashboard"), href: "/dashboard", icon: LayoutDashboard },
    isTutor
      ? { label: t("nav.findStudents") || "Find Students", href: "/students", icon: Search }
      : { label: t("nav.findTutors"), href: "/tutors", icon: Search },
    { label: t("nav.sessions"), href: "/sessions", icon: Calendar },
  ];

  const themeOptions: { mode: ThemeMode; icon: any; label: string }[] = [
    { mode: "light", icon: Sun, label: t("settings.light") },
    { mode: "dark", icon: Moon, label: t("settings.dark") },
    { mode: "system", icon: Monitor, label: t("settings.system") },
  ];
  const languages: Language[] = ["en", "fr", "de", "es", "tw"];

  if (!user) return <>{children}</>;
  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || user.email?.charAt(0).toUpperCase() || "?";
  const handleLogout = () => { setSettingsOpen(false); logout(); };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border/60 bg-card sticky top-0 h-screen">
        <div className="px-4 py-4 border-b border-border/50">
          <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-2 hover:opacity-80 transition-opacity w-full text-left">
            <img src="/favicon-96x96.png" alt="StudySync" className="w-7 h-7" />
            <span className="text-base font-bold tracking-tight">StudySync</span>
          </button>
        </div>
        <nav className="flex-1 px-2.5 py-3 space-y-0.5">
          {navItems.map((item) => {
            const active = location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all
                  ${active ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                <item.icon className="w-4 h-4 shrink-0" />{item.label}
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
                {/* Notifications */}
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-blue-500/8 flex items-center justify-center"><Bell className="w-3.5 h-3.5 text-blue-600" /></div>
                    <div>
                      <p className="text-xs font-medium">{t("settings.notifications")}</p>
                      <p className="text-[10px] text-muted-foreground">{notifications ? t("settings.enabled") : t("settings.disabled")}</p>
                    </div>
                  </div>
                  <Switch checked={notifications} onCheckedChange={setNotifications} />
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
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="w-7 h-7 rounded-md bg-emerald-500/8 flex items-center justify-center"><HelpCircle className="w-3.5 h-3.5 text-emerald-500" /></div>
                  <p className="text-xs font-medium flex-1">{t("nav.help")}</p>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
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
            <Link href="/" className="flex items-center gap-2">
              <img src="/favicon-96x96.png" alt="StudySync" className="w-6 h-6" />
              <span className="text-sm font-bold">StudySync</span>
            </Link>
            <button onClick={() => setSettingsOpen(true)} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 md:px-6 py-6 max-w-5xl w-full mx-auto">{children}</main>
        <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border/60 bg-card/95 backdrop-blur-md pb-safe pt-1.5 px-6 flex justify-around z-30">
          {navItems.map((item) => {
            const active = location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
                <item.icon className="w-4.5 h-4.5" /><span className="text-[9px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          <button onClick={() => setSettingsOpen(true)} className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-muted-foreground">
            <Settings className="w-4.5 h-4.5" /><span className="text-[9px] font-medium">{t("nav.settings")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
