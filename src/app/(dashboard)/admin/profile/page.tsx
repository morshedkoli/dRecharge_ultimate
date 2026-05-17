"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useProfile } from "@/lib/hooks/user/useProfile";
import { toast } from "sonner";
import {
  User, Lock, KeyRound, Save, Mail, Phone, AtSign,
  ShieldCheck, Loader2, Eye, EyeOff, CheckCircle2, Info,
} from "lucide-react";

// ── Shared input style (matches admin design system) ─────────────────────────
const inputCls =
  "w-full border border-outline-variant bg-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-on-surface-variant/50";

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
  accent = "green",
}: {
  icon: typeof KeyRound;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accent?: "green" | "amber" | "red";
}) {
  const accentCls = {
    green: "bg-[#E8F1EE] text-primary",
    amber: "bg-amber-50 text-amber-600",
    red:   "bg-red-50 text-red-500",
  }[accent];

  return (
    <div className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow">
      <div className="px-8 py-5 border-b border-black/[0.04] flex items-center gap-4">
        <div className={`p-2.5 rounded-xl shrink-0 ${accentCls}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-manrope font-bold text-[#134235] text-lg leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-8">{children}</div>
    </div>
  );
}

export default function AdminProfilePage() {
  const { user }                       = useAuth();
  const { profile, loading, refetch }  = useProfile();

  // ── Password state ──────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent,     setShowCurrent]     = useState(false);
  const [showNew,         setShowNew]         = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // ── PIN state ───────────────────────────────────────────────────────────────
  const [newPin,     setNewPin]     = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin,    setShowPin]    = useState(false);
  const [pinLoading, setPinLoading] = useState(false);

  // ── Username state ──────────────────────────────────────────────────────────
  const [newUsername,     setNewUsername]     = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Pre-fill username from profile
  useEffect(() => {
    if (profile?.username) setNewUsername(profile.username);
  }, [profile?.username]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (newPassword !== confirmPassword) { toast.error("New passwords do not match"); return; }
    if (newPassword.length < 6)          { toast.error("Password must be at least 6 characters"); return; }
    setPasswordLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "changePassword", currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");
      toast.success("Password updated successfully");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally { setPasswordLoading(false); }
  }

  async function handlePinChange(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (newPin !== confirmPin)                   { toast.error("PINs do not match"); return; }
    if (newPin.length < 4 || newPin.length > 6)  { toast.error("PIN must be 4–6 digits"); return; }
    setPinLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "setPin", pin: newPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update PIN");
      toast.success("Transaction PIN updated");
      setNewPin(""); setConfirmPin("");
      await refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update PIN");
    } finally { setPinLoading(false); }
  }

  async function handleUsernameChange(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!/^[a-z0-9_]{3,20}$/.test(newUsername)) {
      toast.error("3–20 chars: letters, numbers, underscores only");
      return;
    }
    setUsernameLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "changeUsername", username: newUsername }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update username");
      toast.success("Username updated");
      await refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update username");
    } finally { setUsernameLoading(false); }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const roleBadge: Record<string, string> = {
    super_admin:   "bg-violet-100 text-violet-700",
    admin:         "bg-primary/10 text-primary",
    support_admin: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="p-6 sm:p-10 max-w-4xl mx-auto pb-24 space-y-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">My Profile</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Manage your account security and transaction PIN
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Left: Account Info ─────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-black/5 rounded-2xl p-6 premium-shadow">

            {/* Avatar */}
            <div className="flex flex-col items-center gap-3 pb-5 border-b border-black/[0.04]">
              <div className="w-16 h-16 rounded-2xl bg-[#E8F1EE] flex items-center justify-center text-2xl font-extrabold text-primary font-manrope">
                {(profile?.displayName || user?.email || "A").slice(0, 1).toUpperCase()}
              </div>
              <div className="text-center">
                <p className="font-manrope font-bold text-on-surface text-base">
                  {profile?.displayName || "Admin"}
                </p>
                <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg font-manrope ${roleBadge[profile?.role ?? ""] ?? "bg-surface-container text-on-surface-variant"}`}>
                  {(profile?.role ?? "admin").replace("_", " ")}
                </span>
              </div>
            </div>

            {/* Info rows */}
            <div className="pt-5 space-y-4 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-0.5 flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> Email
                </p>
                <p className="text-on-surface font-medium break-all">{user?.email ?? "—"}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-0.5 flex items-center gap-1.5">
                  <AtSign className="w-3 h-3" /> Username
                </p>
                {profile?.username ? (
                  <code className="font-mono text-on-surface bg-surface-container px-2 py-0.5 rounded-lg text-xs">{profile.username}</code>
                ) : (
                  <span className="text-on-surface-variant/50 italic text-xs">not set</span>
                )}
              </div>

              {profile?.phoneNumber && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-0.5 flex items-center gap-1.5">
                    <Phone className="w-3 h-3" /> Phone
                  </p>
                  <p className="font-mono text-on-surface text-xs">{profile.phoneNumber}</p>
                </div>
              )}

              {/* PIN status */}
              <div className="pt-3 border-t border-black/[0.04]">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold font-manrope text-on-surface">Transaction PIN</span>
                  {profile?.hasPin ? (
                    <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-primary bg-[#E8F1EE] px-2 py-0.5 rounded-lg font-manrope">
                      <CheckCircle2 className="w-3 h-3" /> Set
                    </span>
                  ) : (
                    <span className="ml-auto text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg font-manrope">
                      Not set
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                  Required to send money from the admin panel.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Forms ───────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">

          {/* ── Transaction PIN ─────────────────────────────────────────────── */}
          <Section icon={KeyRound} title="Transaction PIN" subtitle="4–6 digit PIN required when sending money from the admin panel" accent="green">
            {!profile?.hasPin && (
              <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200/60 rounded-xl px-4 py-3">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 font-manrope font-semibold">
                  You haven&apos;t set a PIN yet. You won&apos;t be able to initiate send-money transactions until a PIN is configured.
                </p>
              </div>
            )}
            <form onSubmit={handlePinChange} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">
                    New PIN
                  </label>
                  <div className="relative">
                    <input
                      type={showPin ? "text" : "password"}
                      required
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="••••"
                      disabled={pinLoading}
                      className={`${inputCls} pr-10 tracking-[0.3em] font-mono text-base`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">
                    Confirm PIN
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={6}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    disabled={pinLoading}
                    className={`${inputCls} tracking-[0.3em] font-mono text-base`}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={pinLoading || newPin.length < 4 || !confirmPin}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary text-sm font-bold font-manrope rounded-xl hover:opacity-90 active:scale-[0.98] disabled:opacity-40 transition-all shadow-lg shadow-primary/20"
              >
                {pinLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><Save className="w-4 h-4" /> {profile?.hasPin ? "Update PIN" : "Set PIN"}</>
                }
              </button>
            </form>
          </Section>

          {/* ── Username ────────────────────────────────────────────────────── */}
          <Section icon={AtSign} title="Username" subtitle="Set a username as an alternative login credential" accent="green">
            <form onSubmit={handleUsernameChange} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 font-mono text-sm select-none">@</span>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder="your_username"
                    maxLength={20}
                    disabled={usernameLoading}
                    className={`${inputCls} pl-8 font-mono`}
                  />
                </div>
                <p className="text-xs text-on-surface-variant mt-1.5">3–20 chars · letters, numbers, underscores</p>
              </div>
              <button
                type="submit"
                disabled={usernameLoading || newUsername.length < 3}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary text-sm font-bold font-manrope rounded-xl hover:opacity-90 active:scale-[0.98] disabled:opacity-40 transition-all shadow-lg shadow-primary/20"
              >
                {usernameLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><Save className="w-4 h-4" /> Save Username</>
                }
              </button>
            </form>
          </Section>

          {/* ── Password ────────────────────────────────────────────────────── */}
          <Section icon={Lock} title="Account Password" subtitle="Change your login password" accent="amber">
            <form onSubmit={handlePasswordChange} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={passwordLoading}
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={passwordLoading}
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
                    >
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={passwordLoading}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={passwordLoading || !currentPassword || !newPassword}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white text-sm font-bold font-manrope rounded-xl hover:bg-amber-600 active:scale-[0.98] disabled:opacity-40 transition-all"
                >
                  {passwordLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
                    : <><ShieldCheck className="w-4 h-4" /> Update Password</>
                  }
                </button>
                <p className="text-xs text-on-surface-variant">
                  <Info className="w-3.5 h-3.5 inline mr-1" />
                  Re-login required after change
                </p>
              </div>
            </form>
          </Section>

        </div>
      </div>
    </div>
  );
}
