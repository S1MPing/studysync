import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setLocation("/auth");
    } else if (user && !(user as any).isBanned && !user.university) {
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

  // Banned users must never be redirected — Router handles BannedScreen
  if ((user as any).isBanned) return null;

  // Profile incomplete → show setup page if already there, otherwise useEffect redirects
  if (!user.university) {
    if (location === "/setup-profile") return <>{children}</>;
    return null;
  }

  // Unverified users get partial access — banner shown in AppLayout
  return <>{children}</>;
}
