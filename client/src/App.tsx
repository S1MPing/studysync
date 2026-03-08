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
import { I18nProvider } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Root */}
      <Route path="/">
        {!isLoading && isAuthenticated ? (
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
        <AuthPage />
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

      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
