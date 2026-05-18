"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useProfile } from "@/lib/hooks/user/useProfile";
import { toast } from "sonner";
import {
  User, Lock, KeyRound, Save, Mail, Phone, Info, AtSign, CreditCard, Loader2,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function patchSelf(uid: string, body: object) {
  const res = await fetch(`/api/admin/users/${uid}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function UserProfilePage() {
  const { user } = useAuth();
  const { profile, loading: profileLoading, refetch } = useProfile();

  // ── Editable identity fields ───────────────────────────────────────────────
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername]       = useState("");
  const [email, setEmail]             = useState("");
  const [phone, setPhone]             = useState("");

  // Per-field saving flags
  const [savingName, setSavingName]         = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingEmail, setSavingEmail]       = useState(false);
  const [savingPhone, setSavingPhone]       = useState(false);

  // Email change requires current password
  const [emailPassword, setEmailPassword] = useState("");

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // PIN
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  // Sync state with profile
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || "");
      setUsername(profile.username || "");
      setEmail(profile.email || "");
      setPhone(profile.phoneNumber || "");
    }
  }, [profile]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleNameSave() {
    if (!user) return;
    const v = displayName.trim();
    if (v.length < 2) { toast.error("Name must be at least 2 characters"); return; }
    setSavingName(true);
    try {
      await patchSelf(user.uid, { action: "selfChangeName", displayName: v });
      toast.success("Name updated");
      await refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSavingName(false);
    }
  }

  async function handleUsernameSave() {
    if (!user) return;
    const v = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(v)) {
      toast.error("Username must be 3–20 chars: letters, numbers, underscores only");
      return;
    }
    setSavingUsername(true);
    try {
      await patchSelf(user.uid, { action: "changeUsername", username: v });
      toast.success("Username updated");
      await refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSavingUsername(false);
    }
  }

  async function handleEmailSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const v = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { toast.error("Enter a valid email"); return; }
    if (!emailPassword) { toast.error("Enter your current password to confirm"); return; }
    setSavingEmail(true);
    try {
      await patchSelf(user.uid, { action: "selfChangeEmail", email: v, currentPassword: emailPassword });
      toast.success("Email updated");
      setEmailPassword("");
      await refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handlePhoneSave() {
    if (!user) return;
    const v = phone.trim();
    if (v && !/^[+\d][\d\s\-]{5,19}$/.test(v)) {
      toast.error("Phone number format is invalid");
      return;
    }
    setSavingPhone(true);
    try {
      await patchSelf(user.uid, { action: "selfChangePhone", phoneNumber: v });
      toast.success(v ? "Phone updated" : "Phone removed");
      await refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSavingPhone(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setPasswordLoading(true);
    try {
      await patchSelf(user.uid, { action: "changePassword", currentPassword, newPassword });
      toast.success("Password updated");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handlePinChange(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (newPin !== confirmPin) { toast.error("PINs do not match"); return; }
    if (newPin.length < 4 || newPin.length > 6) { toast.error("PIN must be 4–6 digits"); return; }
    setPinLoading(true);
    try {
      await patchSelf(user.uid, { action: "setPin", pin: newPin });
      toast.success("PIN updated");
      setNewPin(""); setConfirmPin("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setPinLoading(false);
    }
  }

  // ── Dirty flags so Save buttons only enable when changed ───────────────────
  const nameDirty     = displayName.trim() !== (profile?.displayName ?? "").trim();
  const usernameDirty = username.trim().toLowerCase() !== (profile?.username ?? "").trim().toLowerCase();
  const emailDirty    = email.trim().toLowerCase() !== (profile?.email ?? "").trim().toLowerCase();
  const phoneDirty    = (phone.trim() || "") !== ((profile?.phoneNumber ?? "").trim());

  if (profileLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6 pb-12">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#134235] via-[#1a5446] to-[#247060] p-6 md:p-8 text-white premium-shadow">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/5 blur-2xl" />
        <div className="relative space-y-2">
          <h1 className="font-headline text-3xl md:text-4xl font-extrabold leading-tight">Profile & Security</h1>
          <p className="text-white/80 text-sm max-w-lg">
            Update your personal details, change your sign-in credentials, and manage your transaction PIN.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Account snapshot (read-only) ─────────────────────────────── */}
        <aside className="bg-white border border-black/5 rounded-2xl p-6 premium-shadow space-y-4 lg:col-span-1">
          <div className="flex items-center gap-3 pb-4 border-b border-black/[0.04]">
            <div className="w-12 h-12 rounded-xl bg-primary text-on-primary font-bold flex items-center justify-center text-lg font-manrope">
              {(profile?.displayName || profile?.email || "U").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[#134235] font-manrope truncate">{profile?.displayName || "—"}</p>
              <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{profile?.role}</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-2 pb-2 border-b border-black/[0.03]">
              <span className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">Account ID</span>
              <span className="font-mono text-[10px] text-on-surface truncate">{user?.uid}</span>
            </div>
            <div className="pt-1">
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-primary" /> Credit Limit
              </p>
              {(profile?.creditLimit ?? 0) > 0 ? (
                <p className="font-bold text-primary text-lg">৳{(profile?.creditLimit ?? 0).toLocaleString()}</p>
              ) : (
                <p className="font-mono text-on-surface-variant/60 text-xs italic">No credit assigned</p>
              )}
              <p className="text-[10px] text-on-surface-variant/70 mt-1">Assigned by admin. Spend when wallet is ৳0.</p>
            </div>
          </div>
        </aside>

        {/* ── Editable identity ───────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-black/5 rounded-2xl p-6 sm:p-8 premium-shadow">
            <h2 className="font-headline font-bold text-lg text-[#134235] mb-1 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" /> Personal Details
            </h2>
            <p className="text-sm text-on-surface-variant mb-6">
              Each field saves independently — change one, click Save, and you&rsquo;re done.
            </p>

            <div className="space-y-5">
              {/* Full name */}
              <EditableField
                label="Full Name"
                icon={User}
                input={
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    maxLength={60}
                    disabled={savingName}
                    className={inputCls}
                  />
                }
                button={
                  <SaveButton onClick={handleNameSave} loading={savingName} disabled={!nameDirty || displayName.trim().length < 2} />
                }
              />

              {/* Username */}
              <EditableField
                label="Username"
                icon={AtSign}
                hint="3–20 chars · letters, numbers, underscores"
                input={
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 font-mono text-sm select-none">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      placeholder="your_username"
                      maxLength={20}
                      disabled={savingUsername}
                      className={`${inputCls} pl-8 font-mono`}
                    />
                  </div>
                }
                button={
                  <SaveButton onClick={handleUsernameSave} loading={savingUsername} disabled={!usernameDirty || username.length < 3} />
                }
              />

              {/* Phone */}
              <EditableField
                label="Phone Number"
                icon={Phone}
                hint="Leave blank to remove"
                input={
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+8801700000000"
                    disabled={savingPhone}
                    className={inputCls}
                  />
                }
                button={
                  <SaveButton onClick={handlePhoneSave} loading={savingPhone} disabled={!phoneDirty} />
                }
              />

              {/* Email — needs password */}
              <div className="rounded-xl border border-black/5 bg-surface-container/30 p-4 space-y-3">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant font-manrope">
                  <Mail className="w-3.5 h-3.5 text-primary" /> Email Address
                </label>
                <form onSubmit={handleEmailSave} className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={savingEmail}
                    className={inputCls}
                  />
                  {emailDirty && (
                    <>
                      <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
                        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>Email is used for sign-in and recovery — confirm with your password.</span>
                      </div>
                      <input
                        type="password"
                        value={emailPassword}
                        onChange={(e) => setEmailPassword(e.target.value)}
                        placeholder="Current password"
                        disabled={savingEmail}
                        className={inputCls}
                      />
                    </>
                  )}
                  <div className="flex justify-end">
                    <SaveButton
                      type="submit"
                      loading={savingEmail}
                      disabled={!emailDirty || !emailPassword || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}
                    />
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* PIN */}
          <div className="bg-white border border-black/5 rounded-2xl p-6 sm:p-8 premium-shadow">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="font-headline font-bold text-lg text-[#134235] flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-primary" /> Transaction PIN
                </h2>
                <p className="text-sm text-on-surface-variant">A 4–6 digit code used to approve outgoing funds.</p>
              </div>
              {profile?.hasPin && (
                <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap font-manrope">PIN set</span>
              )}
            </div>
            <form onSubmit={handlePinChange} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant font-manrope mb-2">New PIN</label>
                  <input type="password" required maxLength={6}
                    value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="••••" disabled={pinLoading}
                    className={`${inputCls} text-lg tracking-[0.25em]`} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant font-manrope mb-2">Confirm PIN</label>
                  <input type="password" required maxLength={6}
                    value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="••••" disabled={pinLoading}
                    className={`${inputCls} text-lg tracking-[0.25em]`} />
                </div>
              </div>
              <div className="flex justify-end">
                <SaveButton type="submit" loading={pinLoading} disabled={!newPin || !confirmPin} />
              </div>
            </form>
          </div>

          {/* Password */}
          <div className="bg-white border border-black/5 rounded-2xl p-6 sm:p-8 premium-shadow">
            <h2 className="font-headline font-bold text-lg text-[#134235] flex items-center gap-2 mb-1">
              <Lock className="w-5 h-5 text-primary" /> Account Password
            </h2>
            <p className="text-sm text-on-surface-variant mb-6">Update the master credential used to sign in.</p>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant font-manrope mb-2">Current Password</label>
                <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={passwordLoading}
                  className={inputCls} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant font-manrope mb-2">New Password</label>
                  <input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={passwordLoading}
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant font-manrope mb-2">Confirm New Password</label>
                  <input type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={passwordLoading}
                    className={inputCls} />
                </div>
              </div>
              <div className="flex justify-end">
                <SaveButton type="submit" loading={passwordLoading} disabled={!currentPassword || !newPassword} label="Update Password" />
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable bits ────────────────────────────────────────────────────────────

const inputCls =
  "w-full border border-outline-variant bg-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

function EditableField({
  label, icon: Icon, hint, input, button,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  input: React.ReactNode;
  button: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant font-manrope mb-2">
        <Icon className="w-3.5 h-3.5 text-primary" /> {label}
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">{input}</div>
        <div className="shrink-0">{button}</div>
      </div>
      {hint && <p className="text-[11px] text-on-surface-variant/70 mt-1.5">{hint}</p>}
    </div>
  );
}

function SaveButton({
  onClick, type = "button", loading, disabled, label = "Save",
}: {
  onClick?: () => void;
  type?: "button" | "submit";
  loading: boolean;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary font-bold font-manrope text-sm py-3 px-5 rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 transition-all whitespace-nowrap min-w-[90px]"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      {label}
    </button>
  );
}
