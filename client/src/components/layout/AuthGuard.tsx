import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Clock } from "lucide-react";

function PendingVerification() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8 text-amber-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Pending Verification</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your account is awaiting admin approval. You'll receive access once verified — usually within 24 hours.
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-sm text-amber-700 dark:text-amber-400 text-left space-y-1">
          <p className="font-semibold text-xs uppercase tracking-wide mb-2">While you wait</p>
          <p className="text-xs">✓ Your profile has been submitted for review</p>
          <p className="text-xs">✓ Admin will verify your details shortly</p>
          <p className="text-xs">✓ You'll have full access once approved</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Questions? Contact us at{" "}
          <a href="mailto:tno.godson@gmail.com" className="underline text-foreground">tno.godson@gmail.com</a>
        </p>
        <button onClick={() => logout()} className="text-xs text-muted-foreground underline">Sign out</button>
      </div>
    </div>
  );
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/auth");
    } else if (user && (!user.role || !user.university)) {
      if (location !== "/setup-profile") {
        setLocation("/setup-profile");
      }
    }
  }, [isLoading, isAuthenticated, user, location, setLocation]);

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

  if (!user) return null;

  // Profile incomplete → setup (handled by useEffect above)
  if (!user.role || !user.university) return null;

  // Profile complete but not verified → show pending screen
  if (!(user as any).isVerified) {
    return <PendingVerification />;
  }

  return <>{children}</>;
}
