import { useState } from "react";
import { useLocation, Link } from "wouter";
import { GraduationCap, Eye, EyeOff, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function AuthPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ firstName: "", lastName: "", email: "", password: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Login failed"); return; }
      queryClient.setQueryData(["/api/auth/user"], data);
      setLocation("/dashboard");
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(registerForm),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Registration failed"); return; }
      queryClient.setQueryData(["/api/auth/user"], data);
      setLocation("/setup-profile");
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  const inputClass = "w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/60";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity">
              <img src="/favicon-96x96.png" alt="StudySync" className="w-8 h-8" />
              <span className="text-xl font-bold tracking-tight">StudySync</span>
            </div>
          </Link>
          <p className="text-muted-foreground mt-2 text-sm">
            {tab === "login" ? "Welcome back. Sign in to continue." : "Create your account to get started."}
          </p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-soft">

          {/* Tabs */}
          <div className="flex border-b border-border/60">
            <button
              onClick={() => { setTab("login"); setError(""); }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === "login" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >Sign In</button>
            <button
              onClick={() => { setTab("register"); setError(""); }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === "register" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >Create Account</button>
          </div>

          <div className="p-5">
            {error && (
              <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-destructive/8 border border-destructive/15 text-destructive text-sm">
                {error}
              </div>
            )}

            {tab === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Email</label>
                  <input type="email" required value={loginForm.email}
                    onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} required value={loginForm.password}
                      onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Enter your password" className={`${inputClass} pr-10`} />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Sign In
                </button>
              </form>
            )}

            {tab === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium block mb-1.5">First name</label>
                    <input type="text" required value={registerForm.firstName}
                      onChange={e => setRegisterForm(f => ({ ...f, firstName: e.target.value }))}
                      placeholder="Kwame" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Last name</label>
                    <input type="text" required value={registerForm.lastName}
                      onChange={e => setRegisterForm(f => ({ ...f, lastName: e.target.value }))}
                      placeholder="Mensah" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Email</label>
                  <input type="email" required value={registerForm.email}
                    onChange={e => setRegisterForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} required minLength={6} value={registerForm.password}
                      onChange={e => setRegisterForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="At least 6 characters" className={`${inputClass} pr-10`} />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Account
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          By continuing you agree to StudySync's Terms of Service.
        </p>
      </div>
    </div>
  );
}
