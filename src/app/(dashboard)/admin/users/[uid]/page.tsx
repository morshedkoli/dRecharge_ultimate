"use client";
import { use, useEffect, useState } from "react";
import { AppUser, Transaction, BalanceRequest } from "@/types";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { WalletAmount } from "@/components/admin/WalletAmount";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { suspendUser, activateUser, adminSetCreditLimit, adminChangeEmail, adminChangePassword, adminChangeName, adminChangeUsername, adminChangePin } from "@/lib/functions";
import { relativeTime, fullDateTime, getInitials, maskNumber } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, Lock, Plus, Minus, Wallet, Clock, CreditCard,
  ShieldCheck, ShieldOff, Loader2, X, Receipt, RefreshCw, User,
  Landmark, Key, Mail, ChevronDown, ChevronUp, AtSign
} from "lucide-react";
import Link from "next/link";

function BalanceModal({
  open, onClose, title, icon: Icon, iconBg, iconColor,
  inputColor, actionLabel, actionBg, warning,
  amount, setAmount, note, setNote, submitting, onSubmit,
}: {
  open: boolean; onClose: () => void; title: string;
  icon: typeof Plus; iconBg: string; iconColor: string;
  inputColor: string; actionLabel: string; actionBg: string;
  warning?: string;
  amount: string; setAmount: (v: string) => void;
  note: string; setNote: (v: string) => void;
  submitting: boolean; onSubmit: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !submitting && onClose()} />
      <div className="relative bg-white rounded-2xl border border-black/5 premium-shadow w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.03]">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${iconBg}`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <h3 className="font-manrope font-bold text-[#134235] text-lg">{title}</h3>
          </div>
          <button onClick={onClose} disabled={submitting} className="p-2 hover:bg-surface-container rounded-xl transition-colors">
            <X className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {warning && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl font-medium border border-red-100">
              {warning}
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-1.5">Amount (BDT)</label>
            <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 500"
              className={`w-full border bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ${inputColor} transition-all`} />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-1.5">
              Note <span className="normal-case tracking-normal font-normal text-on-surface-variant/60">(optional)</span>
            </label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Reason…"
              className={`w-full border bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ${inputColor} transition-all`} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} disabled={submitting}
              className="flex-1 px-4 py-3 text-sm font-bold font-manrope border border-outline-variant rounded-xl hover:bg-surface-container transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button onClick={onSubmit} disabled={submitting}
              className={`flex-1 px-4 py-3 text-sm font-bold font-manrope text-white rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${actionBg}`}>
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Working…</> : actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UserDetailPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params);
  const [user, setUser] = useState<AppUser | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [requests, setRequests] = useState<BalanceRequest[]>([]);
  const [tab, setTab] = useState<"tx" | "req">("tx");
  const [addAmount, setAddAmount] = useState("");
  const [addNote, setAddNote] = useState("");
  const [showAddBalance, setShowAddBalance] = useState(false);
  const [deductAmount, setDeductAmount] = useState("");
  const [deductNote, setDeductNote] = useState("");
  const [showDeductBalance, setShowDeductBalance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Credit limit
  const [showCreditLimit, setShowCreditLimit] = useState(false);
  const [creditLimitInput, setCreditLimitInput] = useState("");
  const [savingCredit, setSavingCredit] = useState(false);
  // Admin tools
  const [showAdminTools, setShowAdminTools] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  // Change name
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  // Manual Job Completion
  const [savingManualJobPermission, setSavingManualJobPermission] = useState(false);

  async function handleToggleManualJobs() {
    setSavingManualJobPermission(true);
    try {
      const res = await fetch(`/api/admin/users/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setCanManuallyCompleteJobs", canManuallyCompleteJobs: !user?.canManuallyCompleteJobs })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to update permission");
      setUser(u => u ? { ...u, canManuallyCompleteJobs: payload.canManuallyCompleteJobs } : u);
      toast.success(payload.canManuallyCompleteJobs ? "Manual job completion enabled" : "Manual job completion disabled");
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSavingManualJobPermission(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    fetch(`/api/admin/users/${uid}`)
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        if (data.user) setUser(data.user);
        if (data.transactions) setTransactions(data.transactions);
        if (data.requests) setRequests(data.requests);
      })
      .catch(console.error);
    return () => { mounted = false; };
  }, [uid]);

  async function callBalanceApi(type: "add" | "deduct", amount: number, note: string) {
    const res = await fetch(`/api/admin/users/${uid}/balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, note, type }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) throw new Error(payload?.error || "Failed");
  }

  async function handleAddBalance() {
    const amt = parseFloat(addAmount);
    if (isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      await callBalanceApi("add", amt, addNote);
      toast.success(`৳${amt.toFixed(2)} added to wallet`);
      setUser(u => u ? { ...u, walletBalance: u.walletBalance + amt } : u);
      setShowAddBalance(false); setAddAmount(""); setAddNote("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSubmitting(false); }
  }

  async function handleDeductBalance() {
    const amt = parseFloat(deductAmount);
    if (isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      await callBalanceApi("deduct", amt, deductNote);
      toast.success(`৳${amt.toFixed(2)} deducted from wallet`);
      setUser(u => u ? { ...u, walletBalance: u.walletBalance - amt } : u);
      setShowDeductBalance(false); setDeductAmount(""); setDeductNote("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSubmitting(false); }
  }

  async function handleSetCreditLimit() {
    const limit = parseFloat(creditLimitInput);
    if (isNaN(limit) || limit < 0) { toast.error("Enter a valid credit limit (0 or more)"); return; }
    setSavingCredit(true);
    try {
      await adminSetCreditLimit(uid, limit);
      setUser(u => u ? { ...u, creditLimit: limit } : u);
      toast.success(`Credit limit set to ৳${limit.toFixed(2)}`);
      setShowCreditLimit(false); setCreditLimitInput("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSavingCredit(false); }
  }

  async function handleChangeEmail() {
    if (!newEmail.trim()) { toast.error("Enter a new email"); return; }
    setSavingEmail(true);
    try {
      const result = await adminChangeEmail(uid, newEmail.trim());
      setUser(u => u ? { ...u, email: result.email } : u);
      toast.success("Email updated successfully");
      setNewEmail("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSavingEmail(false); }
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setSavingPassword(true);
    try {
      await adminChangePassword(uid, newPassword);
      toast.success("Password changed successfully");
      setNewPassword("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSavingPassword(false); }
  }

  async function handleChangeName() {
    if (!newName.trim()) { toast.error("Enter a new name"); return; }
    setSavingName(true);
    try {
      const result = await adminChangeName(uid, newName.trim());
      setUser(u => u ? { ...u, displayName: result.displayName } : u);
      toast.success("Name updated successfully");
      setNewName("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSavingName(false); }
  }

  async function handleChangeUsername() {
    if (!newUsername.trim()) { toast.error("Enter a new username"); return; }
    setSavingUsername(true);
    try {
      const result = await adminChangeUsername(uid, newUsername.trim());
      setUser(u => u ? { ...u, username: result.username } : u);
      toast.success("Username updated successfully");
      setNewUsername("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSavingUsername(false); }
  }

  async function handleChangePin() {
    if (!/^\d{4,6}$/.test(newPin)) { toast.error("PIN must be 4–6 digits"); return; }
    setSavingPin(true);
    try {
      await adminChangePin(uid, newPin);
      toast.success("PIN changed successfully");
      setNewPin("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSavingPin(false); }
  }

  // ── type badge colours ──────────────────────────────────────────────────────
  const txTypeBadge: Record<string, string> = {
    send:   "bg-blue-50 text-blue-700",
    topup:  "bg-[#E8F1EE] text-primary",
    deduct: "bg-red-50 text-red-700",
    refund: "bg-purple-50 text-purple-700",
    credit: "bg-orange-50 text-orange-700",
  };

  if (!user) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );

  const isActive = user.status === "active";

  return (
    <div className="p-6 sm:p-10 max-w-5xl mx-auto space-y-8 pb-12">

      {/* ── Back + title ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <Link href="/admin/users"
          className="p-2.5 rounded-xl bg-white border border-black/5 text-on-surface-variant hover:text-[#134235] hover:shadow-sm transition-all premium-shadow">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">User Detail</h1>
          <p className="text-on-surface-variant text-sm">Full profile, wallet & activity history</p>
        </div>
      </div>

      {/* ── Profile hero card ───────────────────────────────────────────── */}
      <div className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow">
        {/* Green header bar */}
        <div className="h-2 bg-gradient-to-r from-primary to-[#2D5A4C]" />

        <div className="p-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary text-2xl font-extrabold font-manrope flex items-center justify-center shrink-0 border-2 border-primary/10">
              {getInitials(user.displayName || user.email || "")}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="font-headline text-2xl font-bold text-[#134235]">{user.displayName || "Unnamed User"}</h2>
                <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider font-manrope ${
                  user.role === "admin" || user.role === "super_admin"
                    ? "bg-red-50 text-red-700"
                    : "bg-[#E8F1EE] text-primary"
                }`}>{user.role}</span>
                <StatusBadge status={user.status} />
                {user.walletLocked && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/50 font-manrope uppercase tracking-wider">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 mt-1.5">
                {user.username && <p className="text-primary font-bold text-sm bg-primary/10 px-2 py-0.5 rounded-md">@{user.username}</p>}
                {(user.username && user.email) && <span className="w-1 h-1 rounded-full bg-black/20" />}
                <p className="text-on-surface-variant text-sm font-medium">{user.email}</p>
                {user.phoneNumber && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-black/20" />
                    <p className="text-sm text-on-surface-variant font-medium">{user.phoneNumber}</p>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-5 mt-4 text-sm text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Joined {fullDateTime(user.createdAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Last login {relativeTime(user.lastLoginAt)}
                </span>
              </div>
            </div>

            {/* Suspend / Activate */}
            <div className="shrink-0">
              {isActive ? (
                <ConfirmDialog
                  title="Suspend user?"
                  description="User will be unable to access their account."
                  confirmLabel="Suspend"
                  confirmVariant="destructive"
                  onConfirm={async () => {
                  await suspendUser(user.uid);
                  setUser(u => u ? { ...u, status: "suspended" } : u);
                  toast.success("User suspended");
                }}
                >
                  <button className="flex items-center gap-2 px-5 py-2.5 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl text-sm font-bold font-manrope transition-all">
                    <ShieldOff className="w-4 h-4" /> Suspend
                  </button>
                </ConfirmDialog>
              ) : (
                <ConfirmDialog
                  title="Activate user?"
                  description="User will regain access to their account."
                  confirmLabel="Activate"
                  onConfirm={async () => {
                  await activateUser(user.uid);
                  setUser(u => u ? { ...u, status: "active" } : u);
                  toast.success("User activated");
                }}
                >
                  <button className="flex items-center gap-2 px-5 py-2.5 border border-primary/20 text-primary bg-[#E8F1EE] hover:bg-primary/15 rounded-xl text-sm font-bold font-manrope transition-all">
                    <ShieldCheck className="w-4 h-4" /> Activate
                  </button>
                </ConfirmDialog>
              )}
            </div>
          </div>

          {/* Wallet strip */}
          <div className="mt-8 pt-6 border-t border-black/[0.04] grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Balance */}
            <div className="sm:col-span-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> Wallet Balance
              </p>
              <p className={`font-headline text-3xl font-extrabold ${user.walletBalance < 0 ? "text-red-600" : "text-[#134235]"}`}>
                {user.walletBalance < 0 ? "-" : ""}৳{Math.abs(user.walletBalance).toFixed(2)}
                {user.walletBalance < 0 && (
                  <span className="ml-2 text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-lg align-middle">CREDIT USED</span>
                )}
              </p>
              {(user.creditLimit ?? 0) > 0 && (
                <p className="mt-1 text-xs text-on-surface-variant font-manrope">
                  Credit limit: <span className="font-bold text-orange-600">৳{(user.creditLimit ?? 0).toFixed(2)}</span>
                  {user.walletBalance < 0 && (
                    <span className="ml-2 text-red-500">({Math.min(Math.abs(user.walletBalance), user.creditLimit ?? 0).toFixed(2)} used)</span>
                  )}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button onClick={() => setShowAddBalance(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#E8F1EE] text-primary hover:bg-primary/15 border border-primary/10 rounded-xl text-xs font-bold font-manrope transition-all">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
                <button onClick={() => setShowDeductBalance(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-xl text-xs font-bold font-manrope transition-all">
                  <Minus className="w-3.5 h-3.5" /> Deduct
                </button>
                <button onClick={() => { setShowCreditLimit(true); setCreditLimitInput(String(user.creditLimit ?? 0)); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200 rounded-xl text-xs font-bold font-manrope transition-all">
                  <Landmark className="w-3.5 h-3.5" /> Credit Limit
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="sm:col-span-2 grid grid-cols-2 gap-4">
              <div className="bg-surface-container/40 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-white rounded-lg"><Receipt className="w-4 h-4 text-on-surface-variant" /></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope">Transactions</span>
                </div>
                <p className="font-headline text-2xl font-extrabold text-[#134235]">{transactions.length}</p>
              </div>
              <div className="bg-surface-container/40 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-white rounded-lg"><CreditCard className="w-4 h-4 text-on-surface-variant" /></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope">Balance Reqs</span>
                </div>
                <p className="font-headline text-2xl font-extrabold text-[#134235]">{requests.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Admin Tools ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow">
        <button
          onClick={() => setShowAdminTools(v => !v)}
          className="w-full flex items-center justify-between px-8 py-5 hover:bg-surface-container/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-50">
              <User className="w-4 h-4 text-violet-600" />
            </div>
            <div className="text-left">
              <p className="font-manrope font-bold text-[#134235] text-sm">Admin Tools</p>
              <p className="text-xs text-on-surface-variant">Change user name, email, password, or PIN</p>
            </div>
          </div>
          {showAdminTools ? <ChevronUp className="w-4 h-4 text-on-surface-variant" /> : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
        </button>

        {showAdminTools && (
          <div className="px-8 pb-8 pt-2 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-black/[0.03]">
            {/* Change Name */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-green-500" />
                <p className="font-manrope font-bold text-sm text-[#134235]">Change Name</p>
              </div>
              <p className="text-xs text-on-surface-variant">Current: <span className="font-semibold text-on-surface">{user.displayName}</span></p>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="New display name"
                className="w-full border border-outline-variant bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 transition-all"
              />
              <button
                onClick={handleChangeName}
                disabled={savingName || !newName.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold font-manrope hover:bg-green-700 disabled:opacity-50 transition-all"
              >
                {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
                {savingName ? "Saving…" : "Update Name"}
              </button>
            </div>

            {/* Change Username */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <AtSign className="w-4 h-4 text-cyan-500" />
                <p className="font-manrope font-bold text-sm text-[#134235]">Change Username</p>
              </div>
              <p className="text-xs text-on-surface-variant">Current: <span className="font-semibold text-on-surface">@{user.username}</span></p>
              <input
                type="text"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="New username"
                className="w-full border border-outline-variant bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 transition-all"
              />
              <button
                onClick={handleChangeUsername}
                disabled={savingUsername || !newUsername.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-xl text-sm font-bold font-manrope hover:bg-cyan-700 disabled:opacity-50 transition-all"
              >
                {savingUsername ? <Loader2 className="w-4 h-4 animate-spin" /> : <AtSign className="w-4 h-4" />}
                {savingUsername ? "Saving…" : "Update Username"}
              </button>
            </div>

            {/* Change Email */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="w-4 h-4 text-blue-500" />
                <p className="font-manrope font-bold text-sm text-[#134235]">Change Email</p>
              </div>
              <p className="text-xs text-on-surface-variant">Current: <span className="font-semibold text-on-surface">{user.email}</span></p>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="New email address"
                className="w-full border border-outline-variant bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all"
              />
              <button
                onClick={handleChangeEmail}
                disabled={savingEmail || !newEmail.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold font-manrope hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {savingEmail ? "Saving…" : "Update Email"}
              </button>
            </div>

            {/* Change Password */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Key className="w-4 h-4 text-violet-500" />
                <p className="font-manrope font-bold text-sm text-[#134235]">Change Password</p>
              </div>
              <p className="text-xs text-on-surface-variant">Set a new password for this user directly.</p>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
                className="w-full border border-outline-variant bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all"
              />
              <button
                onClick={handleChangePassword}
                disabled={savingPassword || newPassword.length < 6}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold font-manrope hover:bg-violet-700 disabled:opacity-50 transition-all"
              >
                {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                {savingPassword ? "Saving…" : "Change Password"}
              </button>
            </div>

            {/* Change PIN */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-4 h-4 text-orange-500" />
                <p className="font-manrope font-bold text-sm text-[#134235]">Change Transaction PIN</p>
              </div>
              <p className="text-xs text-on-surface-variant">Set a new 4-6 digit PIN for this user.</p>
              <input
                type="text"
                value={newPin}
                onChange={e => setNewPin(e.target.value)}
                placeholder="New PIN (4-6 digits)"
                maxLength={6}
                className="w-full border border-outline-variant bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all"
              />
              <button
                onClick={handleChangePin}
                disabled={savingPin || !/^\d{4,6}$/.test(newPin)}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-bold font-manrope hover:bg-orange-700 disabled:opacity-50 transition-all"
              >
                {savingPin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {savingPin ? "Saving…" : "Change PIN"}
              </button>
            </div>

            {/* Manual Job Completion Permission */}
            <div className="space-y-3 col-span-1 md:col-span-2 pt-4 border-t border-black/[0.03]">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <p className="font-manrope font-bold text-sm text-[#134235]">Manual Job Completion Permission</p>
              </div>
              <div className="flex items-center justify-between bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
                <p className="text-xs text-on-surface-variant max-w-[80%]">
                  Allow this user to view pending jobs, claim them (preventing agents from executing them), and manually submit completion statuses and transaction IDs.
                </p>
                <button
                  onClick={handleToggleManualJobs}
                  disabled={savingManualJobPermission}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${user.canManuallyCompleteJobs ? 'bg-emerald-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${user.canManuallyCompleteJobs ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Tabs + tables ───────────────────────────────────────────────── */}
      <div className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow">
        {/* Tab bar */}
        <div className="flex border-b border-black/[0.04] px-2 pt-2 gap-1">
          {([
            { key: "tx",  label: "Transactions",    count: transactions.length, icon: Receipt },
            { key: "req", label: "Balance Requests", count: requests.length,    icon: CreditCard },
          ] as const).map(({ key, label, count, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold font-manrope rounded-t-xl transition-all ${
                tab === key
                  ? "bg-surface-container text-[#134235] border-b-2 border-primary"
                  : "text-on-surface-variant hover:text-[#134235] hover:bg-surface-container/50"
              }`}>
              <Icon className="w-4 h-4" />
              {label}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-manrope ${tab === key ? "bg-primary/10 text-primary" : "bg-surface-container text-on-surface-variant"}`}>
                {count}
              </span>
            </button>
          ))}
        </div>


        {/* Transactions cards */}
        {tab === "tx" && (
          <div className="p-5 space-y-2">
            {transactions.length === 0 ? (
              <div className="py-14 text-center">
                <div className="w-14 h-14 rounded-2xl bg-surface-container mx-auto flex items-center justify-center mb-3">
                  <Receipt className="w-6 h-6 text-on-surface-variant" />
                </div>
                <p className="text-on-surface-variant text-sm font-manrope font-semibold">No transactions yet</p>
              </div>
            ) : transactions.map((tx) => {
              const isCredit = tx.type === "topup" || tx.type === "refund";
              const isAdminAdj = tx.type === "topup" || tx.type === "deduct";
              return (
                <div key={tx.id} className="flex items-center gap-4 bg-surface-container/30 hover:bg-surface-container/50 border border-black/[0.04] rounded-xl px-4 py-3 transition-colors">
                  {/* Type badge */}
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider font-manrope shrink-0 ${txTypeBadge[tx.type] ?? "bg-surface-container text-on-surface-variant"}`}>
                    {tx.type}
                  </span>
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-manrope text-on-surface truncate">
                      {isAdminAdj
                        ? (tx.note || "Admin adjustment")
                        : tx.recipientNumber ? maskNumber(tx.recipientNumber) : "—"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {tx.serviceId && (
                        <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">{tx.serviceId.slice(0, 8)}</span>
                      )}
                      <span className="text-[10px] text-on-surface-variant">{relativeTime(tx.createdAt)}</span>
                    </div>
                  </div>
                  {/* Amount */}
                  <span className={`font-bold font-manrope shrink-0 ${isCredit ? "text-primary" : "text-red-600"}`}>
                    {isCredit ? "+" : "−"}<WalletAmount amount={tx.amount} />
                  </span>
                  {/* Status */}
                  <div className="shrink-0"><StatusBadge status={tx.status} /></div>
                </div>
              );
            })}
          </div>
        )}

        {/* Balance requests cards */}
        {tab === "req" && (
          <div className="p-5 space-y-2">
            {requests.length === 0 ? (
              <div className="py-14 text-center">
                <div className="w-14 h-14 rounded-2xl bg-surface-container mx-auto flex items-center justify-center mb-3">
                  <CreditCard className="w-6 h-6 text-on-surface-variant" />
                </div>
                <p className="text-on-surface-variant text-sm font-manrope font-semibold">No balance requests</p>
              </div>
            ) : requests.map((r) => (
              <div key={r.id} className="flex items-center gap-4 bg-surface-container/30 hover:bg-surface-container/50 border border-black/[0.04] rounded-xl px-4 py-3 transition-colors">
                {/* Icon */}
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                </div>
                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold font-manrope text-[#134235]"><WalletAmount amount={r.amount} /></p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {r.medium && <span className="text-[10px] font-semibold bg-surface-container text-on-surface-variant px-2 py-0.5 rounded font-manrope">{r.medium}</span>}
                    {r.note && <span className="text-[10px] text-on-surface-variant truncate">{r.note}</span>}
                    <span className="text-[10px] text-on-surface-variant">{relativeTime(r.createdAt)}</span>
                  </div>
                </div>
                {/* Status */}
                <div className="shrink-0"><StatusBadge status={r.status} /></div>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* ── Add balance modal ─────────────────────────────────────────────── */}
      <BalanceModal
        open={showAddBalance} onClose={() => setShowAddBalance(false)}
        title="Add Balance" icon={Plus}
        iconBg="bg-[#E8F1EE]" iconColor="text-primary"
        inputColor="border-outline-variant focus:ring-primary/20"
        actionLabel="Add Balance" actionBg="bg-primary hover:opacity-90"
        amount={addAmount} setAmount={setAddAmount}
        note={addNote} setNote={setAddNote}
        submitting={submitting} onSubmit={handleAddBalance}
      />

      {/* ── Deduct balance modal ──────────────────────────────────────────── */}
      <BalanceModal
        open={showDeductBalance} onClose={() => setShowDeductBalance(false)}
        title="Deduct Balance" icon={Minus}
        iconBg="bg-red-50" iconColor="text-red-600"
        inputColor="border-outline-variant focus:ring-red-300"
        actionLabel="Deduct Balance" actionBg="bg-red-600 hover:bg-red-700"
        warning="This will permanently reduce the user's wallet balance. Cannot be undone."
        amount={deductAmount} setAmount={setDeductAmount}
        note={deductNote} setNote={setDeductNote}
        submitting={submitting} onSubmit={handleDeductBalance}
      />

      {/* ── Set Credit Limit modal ────────────────────────────────────────── */}
      {showCreditLimit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !savingCredit && setShowCreditLimit(false)} />
          <div className="relative bg-white rounded-2xl border border-black/5 premium-shadow w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.03]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-50">
                  <Landmark className="w-5 h-5 text-orange-600" />
                </div>
                <h3 className="font-manrope font-bold text-[#134235] text-lg">Set Credit Limit</h3>
              </div>
              <button onClick={() => setShowCreditLimit(false)} disabled={savingCredit} className="p-2 text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors disabled:opacity-50">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="px-4 py-3 bg-orange-50 border border-orange-200/60 rounded-xl text-xs text-orange-700 font-manrope font-semibold">
                Users can spend up to this credit limit even when their balance is zero. Negative balance will be shown in red.
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-1.5">Credit Limit (BDT)</label>
                <input
                  type="number" min="0" value={creditLimitInput}
                  onChange={e => setCreditLimitInput(e.target.value)}
                  placeholder="e.g. 1000"
                  className="w-full border border-outline-variant bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all"
                />
                <p className="mt-1.5 text-xs text-on-surface-variant">Set to 0 to remove credit.</p>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowCreditLimit(false)} disabled={savingCredit}
                  className="flex-1 px-4 py-3 text-sm font-bold font-manrope border border-outline-variant rounded-xl hover:bg-surface-container transition-colors disabled:opacity-50">Cancel</button>
                <button onClick={handleSetCreditLimit} disabled={savingCredit}
                  className="flex-1 px-4 py-3 text-sm font-bold font-manrope text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingCredit ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save Limit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
