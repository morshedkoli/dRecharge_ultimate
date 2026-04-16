"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Zap, Lock, Mail, Shield, User, Eye, EyeOff, ArrowRight, Sparkles, Loader2 } from "lucide-react";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [quickLoading, setQuickLoading] = useState<"admin" | "user" | null>(null);
  const [quickStatus, setQuickStatus]   = useState<string>("");

  /* ── helpers ──────────────────────────────────────────────────────────── */
  async function signInAndRedirect(emailVal: string, passVal: string, redirectTo?: string) {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: emailVal, password: passVal }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Login failed");

    const userRole = data.role || "user";
    const requestedRedirect = searchParams.get("redirect");
    const defaultDest = (
      ["admin", "super_admin", "support_admin"].includes(userRole)
        ? "/admin/overview"
        : "/user/dashboard"
    );
    const dest = redirectTo ?? requestedRedirect ?? defaultDest;

    router.refresh();
    window.location.assign(dest);
  }

  /* ── email/password login ─────────────────────────────────────────────── */
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signInAndRedirect(email, password);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  /* ── DEV QUICK LOGIN ──────────────────────────────────────────────────── */
  async function handleQuickLogin(role: "admin" | "user") {
    setQuickLoading(role);
    setQuickStatus("Setting up dev account…");
    try {
      const res = await fetch("/api/dev/quick-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Setup failed");
      }
      const { email: devEmail, password: devPass, redirectTo } = await res.json();
      setQuickStatus("Signing in…");
      await signInAndRedirect(devEmail, devPass, redirectTo);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Quick login failed");
    } finally {
      setQuickLoading(null);
      setQuickStatus("");
    }
  }

  const isAnyLoading = loading || quickLoading !== null;

  /* ── UI ───────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex bg-surface overflow-hidden">

      {/* ── LEFT: branding panel ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-[#134235] overflow-hidden flex-col justify-between p-16">
        {/* decorative circles */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-white/[0.03]" />
          <div className="absolute top-1/2 -translate-y-1/2 -right-40 w-[560px] h-[560px] rounded-full bg-white/[0.04]" />
          <div className="absolute -bottom-40 left-1/3 w-[400px] h-[400px] rounded-full bg-[#2D5A4C]/40" />
          <div className="absolute top-1/4 left-1/4  w-2   h-2   rounded-full bg-white/30" />
          <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 rounded-full bg-white/20" />
          <div className="absolute bottom-1/3 left-1/5 w-1  h-1   rounded-full bg-white/20" />
        </div>

        {/* logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/10">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-white text-2xl font-extrabold font-manrope tracking-tight">dRecharge</span>
            <p className="text-white/50 text-[10px] uppercase tracking-[0.25em] font-bold">Admin Portal</p>
          </div>
        </div>

        {/* hero copy */}
        <div className="relative space-y-6">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 backdrop-blur-sm rounded-full px-4 py-2">
            <Sparkles className="w-4 h-4 text-white/70" />
            <span className="text-white/70 text-xs font-bold font-manrope uppercase tracking-widest">Secure Access</span>
          </div>
          <h1 className="text-5xl font-extrabold font-manrope text-white leading-[1.1] tracking-tight">
            Manage.<br />Monitor.<br />Control.
          </h1>
          <p className="text-white/60 text-lg leading-relaxed max-w-sm">
            The dRecharge administration portal gives you complete oversight of USSD transactions, devices, and users.
          </p>
          <div className="space-y-3 pt-4">
            {[
              "Real-time execution queue monitoring",
              "Role-based access control",
              "Comprehensive audit trail",
            ].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
                </div>
                <span className="text-white/70 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-white/30 text-xs font-manrope">© 2026 dRecharge · All rights reserved</div>
      </div>

      {/* ── RIGHT: form panel ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16 relative bg-surface overflow-y-auto">
        {/* bg blobs */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/[0.02] rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="w-full max-w-md relative">

          {/* mobile logo */}
          <div className="flex items-center justify-center gap-3 mb-10 lg:hidden">
            <div className="w-11 h-11 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-[#134235] text-xl font-extrabold font-manrope">dRecharge</span>
              <p className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold">Portal</p>
            </div>
          </div>

          {/* heading */}
          <div className="mb-8">
            <h2 className="font-headline text-4xl font-extrabold tracking-tight text-[#134235] mb-2">Welcome back</h2>
            <p className="text-on-surface-variant">Sign in to continue to your dashboard.</p>
          </div>

          {/* ━━━ DEV QUICK LOGIN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="mb-8 p-5 rounded-2xl border-2 border-dashed border-primary/20 bg-primary/[0.03] space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-primary/70" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70 font-manrope">
                Dev Quick Login
              </span>
              <span className="ml-auto text-[9px] text-on-surface-variant/50 font-mono">auto-creates if needed</span>
            </div>

            {quickStatus && (
              <p className="text-xs text-primary/70 font-manrope font-semibold animate-pulse pl-1">{quickStatus}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              {/* Admin */}
              <button
                id="quick-login-admin"
                type="button"
                onClick={() => handleQuickLogin("admin")}
                disabled={isAnyLoading}
                className="group relative flex flex-col items-center gap-2.5 p-5 bg-white border border-black/[0.06] rounded-2xl hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-wait overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />

                <div className="relative p-3 bg-[#E8F1EE] rounded-xl group-hover:bg-primary/15 transition-colors">
                  {quickLoading === "admin" ? (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  ) : (
                    <Shield className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="relative text-center">
                  <p className="text-sm font-extrabold text-[#134235] font-manrope">Admin</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5 font-manrope">
                    {quickLoading === "admin" ? "Logging in…" : "One-click login"}
                  </p>
                </div>
                {quickLoading !== "admin" && (
                  <ArrowRight className="relative w-3.5 h-3.5 text-primary/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                )}
              </button>

              {/* User */}
              <button
                id="quick-login-user"
                type="button"
                onClick={() => handleQuickLogin("user")}
                disabled={isAnyLoading}
                className="group relative flex flex-col items-center gap-2.5 p-5 bg-white border border-black/[0.06] rounded-2xl hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-wait overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />

                <div className="relative p-3 bg-surface-container rounded-xl group-hover:bg-primary/10 transition-colors">
                  {quickLoading === "user" ? (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  ) : (
                    <User className="w-5 h-5 text-on-surface-variant group-hover:text-primary transition-colors" />
                  )}
                </div>
                <div className="relative text-center">
                  <p className="text-sm font-extrabold text-[#134235] font-manrope">User</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5 font-manrope">
                    {quickLoading === "user" ? "Logging in…" : "One-click login"}
                  </p>
                </div>
                {quickLoading !== "user" && (
                  <ArrowRight className="relative w-3.5 h-3.5 text-primary/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                )}
              </button>
            </div>

            <p className="text-[10px] text-on-surface-variant/50 text-center font-manrope">
              admin@finpay.com · user@finpay.com
            </p>
          </div>
          {/* ━━━ END DEV SECTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

          {/* divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant/50" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface px-4 text-xs text-on-surface-variant font-medium">or continue with email</span>
            </div>
          </div>

          {/* email form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isAnyLoading}
                  className="w-full pl-11 pr-4 py-3.5 border border-outline-variant bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 placeholder:text-on-surface-variant/50 transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input
                  id="password-input"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isAnyLoading}
                  className="w-full pl-11 pr-12 py-3.5 border border-outline-variant bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 placeholder:text-on-surface-variant/50 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="email-login-btn"
              type="submit"
              disabled={isAnyLoading}
              className="w-full bg-primary text-on-primary rounded-xl px-4 py-4 text-sm font-bold font-manrope hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 shadow-xl shadow-primary/20 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-on-surface-variant mt-8">
            Secure access portal · dRecharge © 2026
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <LoginPageContent />
    </Suspense>
  );
}
