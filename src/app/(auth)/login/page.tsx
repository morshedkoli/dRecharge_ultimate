"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Zap, Lock, Mail, Shield, User, Eye, EyeOff,
  ArrowRight, Loader2, CheckCircle,
} from "lucide-react";

/* ── Features list ──────────────────────────────────────────────── */
const FEATURES = [
  "Real-time USSD execution queue",
  "Multi-device agent management",
  "Role-based access control",
  "Comprehensive audit trail",
];

/* ── Login form ─────────────────────────────────────────────────── */
function LoginPageContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [loading,     setLoading]     = useState(false);
  const [showPass,    setShowPass]    = useState(false);
  const [quickLoading, setQuickLoading] = useState<"admin" | "user" | null>(null);
  const [quickStatus,  setQuickStatus]  = useState("");

  /* ── Helpers ─────────────────────────────────────────────────── */
  async function signInAndRedirect(emailVal: string, passVal: string, redirectTo?: string) {
    const res  = await fetch("/api/auth/session", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: emailVal, password: passVal }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Login failed");

    const role = data.role || "user";
    const dest = redirectTo
      ?? searchParams.get("redirect")
      ?? (["admin", "super_admin", "support_admin"].includes(role) ? "/admin/overview" : "/user/dashboard");

    router.refresh();
    window.location.assign(dest);
  }

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

  async function handleQuickLogin(role: "admin" | "user") {
    setQuickLoading(role);
    setQuickStatus("Setting up account…");
    try {
      const res = await fetch("/api/dev/quick-login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Setup failed");
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

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex bg-[#F4F6F5] overflow-hidden">

      {/* ── Left: brand panel ─────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative bg-[#0D2B21] flex-col justify-between p-14 overflow-hidden">
        {/* Background texture */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#134235]/60" />
          <div className="absolute top-1/2 -right-48 w-[520px] h-[520px] rounded-full bg-[#2D5A4C]/20" />
          <div className="absolute -bottom-32 left-1/3 w-[400px] h-[400px] rounded-full bg-[#134235]/40" />
          {/* Dot grid */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
            <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="white" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 backdrop-blur-sm">
            <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-white text-xl font-extrabold font-manrope tracking-tight">dRecharge</span>
            <p className="text-white/40 text-[9px] uppercase tracking-[0.25em] font-bold">Admin Portal</p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative space-y-8">
          <div>
            <p className="text-white/40 text-xs font-bold font-manrope uppercase tracking-[0.2em] mb-3">
              Control Center
            </p>
            <h1 className="text-[42px] font-extrabold font-manrope text-white leading-[1.1] tracking-tight">
              Manage.<br />Monitor.<br />Control.
            </h1>
          </div>
          <p className="text-white/50 text-base leading-relaxed max-w-sm">
            Complete oversight of USSD transactions, agent devices, and user management — all in one place.
          </p>
          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-white/30 shrink-0" />
                <span className="text-white/60 text-[13px] font-manrope">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-white/20 text-xs font-manrope">
          © 2026 dRecharge. All rights reserved.
        </div>
      </div>

      {/* ── Right: form panel ─────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 overflow-y-auto">
        <div className="w-full max-w-[420px] space-y-6 animate-fade-in">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden mb-2">
            <div className="w-10 h-10 bg-[#134235] rounded-xl flex items-center justify-center shadow-md shadow-[#134235]/20">
              <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-[#134235] text-lg font-extrabold font-manrope">dRecharge</span>
              <p className="text-on-surface-variant/50 text-[9px] uppercase tracking-widest font-bold">Admin</p>
            </div>
          </div>

          {/* Heading */}
          <div>
            <h2 className="font-manrope text-2xl font-extrabold tracking-tight text-[#134235]">
              Welcome back
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Sign in to your admin dashboard.
            </p>
          </div>

          {/* Dev quick login */}
          <div className="rounded-2xl border border-dashed border-[#2D5A4C]/20 bg-[#EBF3EE]/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-[#2D5A4C]/60" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2D5A4C]/60 font-manrope">
                  Dev Quick Login
                </span>
              </div>
              <span className="text-[9px] text-on-surface-variant/40 font-mono">auto-creates if missing</span>
            </div>
            {quickStatus && (
              <p className="text-xs text-[#2D5A4C]/70 font-manrope font-semibold animate-pulse pl-1">
                {quickStatus}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              {(["admin", "user"] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleQuickLogin(role)}
                  disabled={isAnyLoading}
                  className="group flex flex-col items-center gap-2 p-4 bg-white border border-black/[0.06] rounded-xl hover:border-[#2D5A4C]/30 hover:shadow-md hover:shadow-[#2D5A4C]/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-wait"
                >
                  <div className="p-2.5 bg-[#EBF3EE] rounded-xl group-hover:bg-[#2D5A4C]/10 transition-colors">
                    {quickLoading === role
                      ? <Loader2 className="w-5 h-5 text-[#2D5A4C] animate-spin" />
                      : role === "admin"
                        ? <Shield className="w-5 h-5 text-[#2D5A4C]" />
                        : <User className="w-5 h-5 text-on-surface-variant group-hover:text-[#2D5A4C] transition-colors" />
                    }
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-extrabold text-[#134235] font-manrope capitalize">{role}</p>
                    <p className="text-[10px] text-on-surface-variant/60 font-manrope">
                      {quickLoading === role ? "Logging in…" : "One-click"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-black/[0.07]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#F4F6F5] px-4 text-[11px] text-on-surface-variant/50 font-manrope font-bold uppercase tracking-widest">
                or sign in with email
              </span>
            </div>
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60 font-manrope mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isAnyLoading}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-black/[0.08] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]/30 placeholder:text-on-surface-variant/30 transition-all disabled:opacity-60"
                  suppressHydrationWarning
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60 font-manrope mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                <input
                  id="password-input"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isAnyLoading}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 bg-white border border-black/[0.08] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]/30 placeholder:text-on-surface-variant/30 transition-all disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="email-login-btn"
              type="submit"
              disabled={isAnyLoading}
              className="w-full bg-[#134235] text-white rounded-xl px-4 py-3.5 text-sm font-bold font-manrope hover:bg-[#0D2B21] active:scale-[0.99] transition-all disabled:opacity-50 shadow-lg shadow-[#134235]/20 flex items-center justify-center gap-2 mt-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                : <>Sign in <ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>

          <p className="text-center text-[11px] text-on-surface-variant/40 font-manrope">
            Secure admin access · dRecharge © 2026
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F4F6F5]" />}>
      <LoginPageContent />
    </Suspense>
  );
}
