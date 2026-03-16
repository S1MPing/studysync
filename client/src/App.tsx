import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AppLayout } from "@/components/layout/AppLayout";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Landing } from "@/pages/Landing";
import { AuthPage } from "@/pages/AuthPage";
import { ProfileSetup } from "@/pages/ProfileSetup";
import { Dashboard } from "@/pages/Dashboard";
import { FindTutors } from "@/pages/FindTutors";
import { Sessions } from "@/pages/Sessions";
import { SessionDetail } from "@/pages/SessionDetail";
import { Profile } from "@/pages/Profile";
import { ForgotPassword } from "@/pages/ForgotPassword";
import { ResetPassword } from "@/pages/ResetPassword";
import { About } from "@/pages/About";
import { FindStudents } from "@/pages/FindStudents";
import { Admin } from "@/pages/Admin";
import { MediaGallery } from "@/pages/MediaGallery";
import { Help } from "@/pages/Help";
import { Progress } from "@/pages/Progress";
import { Quiz } from "@/pages/Quiz";
import { Rooms } from "@/pages/Rooms";
import { I18nProvider } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { useState, useEffect, Component, type ReactNode } from "react";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-sm w-full text-center space-y-4">
            <p className="text-lg font-bold text-destructive">Something went wrong</p>
            <p className="text-sm text-muted-foreground">{(this.state.error as Error).message}</p>
            <button onClick={() => window.location.reload()} className="text-sm underline text-primary">Reload page</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function BannedScreen({ bannedUntil, banReason }: { bannedUntil?: string | null; banReason?: string | null }) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    if (!bannedUntil) return;
    const target = new Date(bannedUntil).getTime();
    const update = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setTimeLeft(null); window.location.reload(); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const parts = [];
      if (d > 0) parts.push(`${d}d`);
      if (h > 0 || d > 0) parts.push(`${h}h`);
      if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
      parts.push(`${s}s`);
      setTimeLeft(parts.join(" "));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [bannedUntil]);

  const isPermanent = !bannedUntil;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="12" cy="12" r="9" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-destructive">Account Suspended</h1>
          {banReason && (
            <p className="text-sm font-medium text-foreground">Reason: {banReason}</p>
          )}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isPermanent
              ? "Your account has been permanently suspended for violating our community guidelines."
              : "Your account has been temporarily suspended."}
          </p>
        </div>
        {!isPermanent && timeLeft && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 space-y-1">
            <p className="text-xs text-muted-foreground">Access restored in</p>
            <p className="text-2xl font-bold tabular-nums text-destructive">{timeLeft}</p>
            <p className="text-[10px] text-muted-foreground">Until {new Date(bannedUntil!).toLocaleString()}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground leading-relaxed">
          If you believe this is a mistake, contact us at{" "}
          <a href="mailto:tno.godson@gmail.com" className="underline text-foreground">tno.godson@gmail.com</a>.
        </p>
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium animate-pulse">Loading your academic journey...</p>
        </div>
      </div>
    );
  }

  if ((user as any)?.isBanned) {
    return <BannedScreen bannedUntil={(user as any).bannedUntil} banReason={(user as any).banReason} />;
  }

  return (
    <Switch>
      {/* Root */}
      <Route path="/">
        {isAuthenticated ? (
          <AuthGuard>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </AuthGuard>
        ) : (
          <Landing />
        )}
      </Route>

      {/* Auth */}
      <Route path="/auth">
        {isAuthenticated ? (
          <AuthGuard>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </AuthGuard>
        ) : (
          <AuthPage />
        )}
      </Route>

      {/* Forgot Password */}
      <Route path="/forgot-password">
        <ForgotPassword />
      </Route>

      {/* Reset Password */}
      <Route path="/reset-password">
        <ResetPassword />
      </Route>

      {/* Profile setup */}
      <Route path="/setup-profile">
        <AuthGuard>
          <ProfileSetup />
        </AuthGuard>
      </Route>

      {/* Protected Routes */}
      <Route path="/dashboard">
        <AuthGuard>
          <AppLayout>
            <Dashboard />
          </AppLayout>
        </AuthGuard>
      </Route>

      <Route path="/tutors">
        <AuthGuard>
          <AppLayout>
            <FindTutors />
          </AppLayout>
        </AuthGuard>
      </Route>

      <Route path="/students">
        <AuthGuard>
          <AppLayout>
            <FindStudents />
          </AppLayout>
        </AuthGuard>
      </Route>

      <Route path="/sessions">
        <AuthGuard>
          <AppLayout>
            <Sessions />
          </AppLayout>
        </AuthGuard>
      </Route>

      <Route path="/sessions/:id">
        <AuthGuard>
          <AppLayout>
            <SessionDetail />
          </AppLayout>
        </AuthGuard>
      </Route>

      <Route path="/profile">
        <AuthGuard>
          <AppLayout>
            <Profile />
          </AppLayout>
        </AuthGuard>
      </Route>

      <Route path="/about">
        <AuthGuard>
          <AppLayout>
            <About />
          </AppLayout>
        </AuthGuard>
      </Route>

      <Route path="/media">
        <AuthGuard>
          <AppLayout>
            <MediaGallery />
          </AppLayout>
        </AuthGuard>
      </Route>

      <Route path="/help">
        <AuthGuard>
          <AppLayout>
            <Help />
          </AppLayout>
        </AuthGuard>
      </Route>

      <Route path="/progress">
        <AuthGuard>
          <AppLayout>
            <Progress />
          </AppLayout>
        </AuthGuard>
      </Route>

      <Route path="/quiz">
        <AuthGuard>
          <AppLayout>
            <Quiz />
          </AppLayout>
        </AuthGuard>
      </Route>

      <Route path="/rooms">
        <AuthGuard>
          <AppLayout>
            <Rooms />
          </AppLayout>
        </AuthGuard>
      </Route>

      {/* Admin — standalone layout (no AppLayout, has its own dark sidebar) */}
      <Route path="/admin">
        <AuthGuard>
          <Admin />
        </AuthGuard>
      </Route>

      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </I18nProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
