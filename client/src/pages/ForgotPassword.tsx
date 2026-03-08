import { useState } from "react";
import { Link } from "wouter";
import { GraduationCap, ArrowLeft, Loader2, Mail, CheckCircle2 } from "lucide-react";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Something went wrong");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-background dark:via-background dark:to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity">
              <img src="/favicon-96x96.png" alt="StudySync" className="w-9 h-9" />
              <span className="text-2xl font-bold text-primary tracking-tight">StudySync</span>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-xl border border-border/40 overflow-hidden">
          <div className="p-6">

            {sent ? (
              /* Success state */
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Check your email</h2>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  We've sent a password reset link to<br />
                  <span className="font-medium text-foreground">{email}</span>
                </p>
                <p className="text-xs text-muted-foreground mb-6">
                  Didn't receive it? Check your spam folder or wait a minute and try again.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => { setSent(false); setEmail(""); }}
                    className="w-full py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
                  >
                    Try another email
                  </button>
                  <Link href="/auth">
                    <button className="w-full py-2.5 text-primary bg-primary/5 rounded-xl font-semibold text-sm hover:bg-primary/10 transition-colors">
                      Back to Sign In
                    </button>
                  </Link>
                </div>
              </div>
            ) : (
              /* Form state */
              <>
                <div className="mb-6">
                  <Link href="/auth" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4" /> Back to Sign In
                  </Link>
                  <h2 className="text-xl font-semibold text-foreground">Forgot your password?</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter your email and we'll send you a link to reset it.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Send Reset Link
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Remember your password?{" "}
          <Link href="/auth" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
