"use client";
import { use, useEffect, useState } from "react";
import { AppUser, Transaction, BalanceRequest } from "@/types";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { WalletAmount } from "@/components/admin/WalletAmount";
import { relativeTime, fullDateTime, getInitials, maskNumber } from "@/lib/utils";
import { apiFetch } from "@/lib/functions";
import { toast } from "sonner";
import {
  ArrowLeft, Lock, Plus, Minus, Wallet, Clock, CreditCard,
  ShieldCheck, ShieldOff, Loader2, X, Receipt, RefreshCw, User,
  Landmark, Key, Mail, ChevronDown, ChevronUp, Copy
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
          <button onClick={onClose} disabled={submitting} className="p-2 text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors disabled:opacity-50">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {warning && (
            <div className="px-4 py-3 bg-amber-50 border border-amber-200/60 rounded-xl text-xs text-amber-700 font-manrope font-semibold flex items-start gap-2">
              <span>⚠️</span><span>{warning}</span>
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

export default function SubUserDetailPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params);
  const [user, setUser] = useState<AppUser | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tab, setTab] = useState<"tx" | "payments">("tx");
  
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
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiFetch<{ user: AppUser; transactions: Transaction[] }>(`/api/user/subusers/${uid}`)
      .then((data) => {
        if (!mounted) return;
        if (data.user) setUser(data.user);
        if (data.transactions) setTransactions(data.transactions);
      })
      .catch((e) => {
        toast.error("Failed to load user");
        console.error(e);
      });
    return () => { mounted = false; };
  }, [uid]);

  const apiCall = (body: any) => apiFetch<any>(`/api/user/subusers/${uid}`, { method: "PATCH", body: JSON.stringify(body) });

  async function handleTransferBalance(type: "topup" | "deduct") {
    const amt = parseFloat(type === "topup" ? addAmount : deductAmount);
    const note = type === "topup" ? addNote : deductNote;
    if (isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await apiCall({ action: "transferBalance", type, amount: amt, note });
      toast.success(type === "topup" ? `৳${amt.toFixed(2)} transferred to sub-user` : `৳${amt.toFixed(2)} returned to your wallet`);
      setUser(u => u ? { ...u, walletBalance: res.walletBalance } : u);
      if (type === "topup") { setShowAddBalance(false); setAddAmount(""); setAddNote(""); }
      else { setShowDeductBalance(false); setDeductAmount(""); setDeductNote(""); }
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSubmitting(false); }
  }

  async function handleSetCreditLimit() {
    const limit = parseFloat(creditLimitInput);
    if (isNaN(limit) || limit < 0) { toast.error("Enter a valid credit limit"); return; }
    setSavingCredit(true);
    try {
      await apiCall({ action: "setCreditLimit", limit });
      setUser(u => u ? { ...u, creditLimit: limit } : u);
      toast.success(`Credit limit set to ৳${limit.toFixed(2)}`);
      setShowCreditLimit(false); setCreditLimitInput("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSavingCredit(false); }
  }

  async function handleChangeName() {
    if (!newName.trim()) { toast.error("Enter a new name"); return; }
    setSavingName(true);
    try {
      const result = await apiCall({ action: "changeName", displayName: newName.trim() });
      setUser(u => u ? { ...u, displayName: result.displayName } : u);
      toast.success("Name updated successfully");
      setNewName("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSavingName(false); }
  }

  async function handleChangeEmail() {
    if (!newEmail.trim()) { toast.error("Enter a new email"); return; }
    setSavingEmail(true);
    try {
      const result = await apiCall({ action: "changeEmail", email: newEmail.trim() });
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
      await apiCall({ action: "adminChangePassword", newPassword });
      toast.success("Password changed successfully");
      setNewPassword("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSavingPassword(false); }
  }

  async function handleChangePin() {
    if (!/^\d{4,6}$/.test(newPin)) { toast.error("PIN must be 4–6 digits"); return; }
    setSavingPin(true);
    try {
      await apiCall({ action: "adminChangePin", pin: newPin });
      toast.success("PIN changed successfully");
      setNewPin("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSavingPin(false); }
  }

  async function handleToggleStatus(suspend: boolean) {
    if (!confirm(`Are you sure you want to ${suspend ? "suspend" : "activate"} this user?`)) return;
    try {
      await apiCall({ action: suspend ? "suspend" : "activate" });
      setUser(u => u ? { ...u, status: suspend ? "suspended" : "active" } : u);
      toast.success(`User ${suspend ? "suspended" : "activated"}`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

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
      <div className="flex items-center gap-4">
        <Link href="/user/subusers"
          className="p-2.5 rounded-xl bg-white border border-black/5 text-on-surface-variant hover:text-[#134235] hover:shadow-sm transition-all premium-shadow">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">Manage User</h1>
          <p className="text-sm text-on-surface-variant mt-1">ID: <span className="font-mono text-xs">{user.uid}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-8 border border-black/5 relative overflow-hidden premium-shadow group/card">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/10 to-transparent" />
            <button onClick={() => {
                const text = `Login URL: ${window.location.origin}/login\nUsername: ${user.username || user.email}\nPassword: ${newPassword || "********"}`;
                navigator.clipboard.writeText(text);
                toast.success("Credentials copied");
              }}
              className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-white/60 hover:bg-white text-[#134235] border border-[#134235]/10 hover:border-[#134235]/30 rounded-xl text-xs font-bold font-manrope transition-all backdrop-blur-sm opacity-0 group-hover/card:opacity-100 focus:opacity-100 shadow-sm"
              title="Copy Login Details">
              <Copy className="w-3.5 h-3.5" /> Copy Credentials
            </button>
            <div className="relative flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
              <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-xl flex items-center justify-center text-primary font-bold font-manrope text-3xl shrink-0">
                {getInitials(user.displayName)}
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
                    <h2 className="font-headline text-2xl font-extrabold text-on-surface">{user.displayName}</h2>
                    <StatusBadge status={user.status} />
                  </div>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-on-surface-variant">
                    <div className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {user.email}</div>
                    {user.phoneNumber && <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {user.phoneNumber}</div>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  <button onClick={() => handleToggleStatus(isActive)}
                    className={`px-4 py-2 text-sm font-bold font-manrope rounded-xl transition-all flex items-center gap-2 border ${
                      isActive ? "bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300" : "bg-white text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300"
                    }`}>
                    {isActive ? <><ShieldOff className="w-4 h-4"/> Suspend</> : <><ShieldCheck className="w-4 h-4"/> Activate</>}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow">
            <button onClick={() => setShowAdminTools(v => !v)} className="w-full flex items-center justify-between px-8 py-5 hover:bg-surface-container/20 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-violet-50"><User className="w-4 h-4 text-violet-600" /></div>
                <div className="text-left">
                  <p className="font-manrope font-bold text-[#134235] text-sm">User Tools</p>
                  <p className="text-xs text-on-surface-variant">Change user name, email, password, or PIN</p>
                </div>
              </div>
              {showAdminTools ? <ChevronUp className="w-4 h-4 text-on-surface-variant" /> : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
            </button>

            {showAdminTools && (
              <div className="px-8 pb-8 pt-2 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-black/[0.03]">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-green-500" /><p className="font-manrope font-bold text-sm text-[#134235]">Change Name</p>
                  </div>
                  <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="New display name"
                    className="w-full border border-outline-variant bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                  <button onClick={handleChangeName} disabled={savingName || !newName.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold font-manrope hover:bg-green-700 disabled:opacity-50">
                    {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />} Update Name
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className="w-4 h-4 text-blue-500" /><p className="font-manrope font-bold text-sm text-[#134235]">Change Email</p>
                  </div>
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="New email address"
                    className="w-full border border-outline-variant bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <button onClick={handleChangeEmail} disabled={savingEmail || !newEmail.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold font-manrope hover:bg-blue-700 disabled:opacity-50">
                    {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Update Email
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Key className="w-4 h-4 text-violet-500" /><p className="font-manrope font-bold text-sm text-[#134235]">Change Password</p>
                  </div>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 6 chars)"
                    className="w-full border border-outline-variant bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                  <div className="flex gap-2">
                    <button onClick={handleChangePassword} disabled={savingPassword || newPassword.length < 6}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold font-manrope hover:bg-violet-700 disabled:opacity-50">
                      {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />} Change Password
                    </button>
                    <button onClick={() => {
                        const text = `Login URL: ${window.location.origin}/login\nUsername: ${user.username || user.email}\nPassword: ${newPassword || "********"}`;
                        navigator.clipboard.writeText(text);
                        toast.success("Credentials copied");
                      }}
                      className="flex items-center justify-center px-4 py-2 bg-violet-50 text-violet-600 border border-violet-100 rounded-xl hover:bg-violet-100 transition-colors"
                      title="Copy Login Details">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="w-4 h-4 text-orange-500" /><p className="font-manrope font-bold text-sm text-[#134235]">Change PIN</p>
                  </div>
                  <input type="text" value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="New PIN (4-6 digits)" maxLength={6}
                    className="w-full border border-outline-variant bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                  <button onClick={handleChangePin} disabled={savingPin || !/^\d{4,6}$/.test(newPin)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-bold font-manrope hover:bg-orange-700 disabled:opacity-50">
                    {savingPin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Change PIN
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow">
            <div className="flex border-b border-black/[0.04] px-2 pt-2 gap-1">
              <button onClick={() => setTab("tx")} className={`flex items-center gap-2 px-5 py-3 text-sm font-bold font-manrope rounded-t-xl transition-all ${tab === "tx" ? "bg-surface-container text-[#134235] border-b-2 border-primary" : "text-on-surface-variant hover:bg-surface-container/50"}`}>
                <Receipt className="w-4 h-4" /> Transactions <span className="ml-1.5 px-2 py-0.5 rounded-md bg-black/10 text-black/70 text-[10px]">{transactions.length}</span>
              </button>
              <button onClick={() => setTab("payments")} className={`flex items-center gap-2 px-5 py-3 text-sm font-bold font-manrope rounded-t-xl transition-all ${tab === "payments" ? "bg-surface-container text-[#134235] border-b-2 border-primary" : "text-on-surface-variant hover:bg-surface-container/50"}`}>
                <Wallet className="w-4 h-4" /> Payment History <span className="ml-1.5 px-2 py-0.5 rounded-md bg-black/10 text-black/70 text-[10px]">{transactions.filter(tx => tx.type === "topup" || tx.type === "deduct").length}</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-surface-container/30">
                    <th className="px-6 py-4 font-bold text-xs uppercase tracking-widest text-on-surface-variant font-manrope border-b border-black/[0.03]">ID / Date</th>
                    <th className="px-6 py-4 font-bold text-xs uppercase tracking-widest text-on-surface-variant font-manrope border-b border-black/[0.03]">Type</th>
                    <th className="px-6 py-4 font-bold text-xs uppercase tracking-widest text-on-surface-variant font-manrope border-b border-black/[0.03]">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.03]">
                  {(tab === "payments" ? transactions.filter(tx => tx.type === "topup" || tx.type === "deduct") : transactions).length === 0 ? (
                    <tr><td colSpan={3} className="px-6 py-12 text-center text-on-surface-variant">No transactions found</td></tr>
                  ) : (tab === "payments" ? transactions.filter(tx => tx.type === "topup" || tx.type === "deduct") : transactions).map(tx => (
                    <tr key={tx.id} className="hover:bg-surface-container/30">
                      <td className="px-6 py-4">
                        <p className="font-mono text-xs font-semibold text-on-surface">{tx.id.slice(0, 8)}</p>
                        <p className="text-[11px] text-on-surface-variant">{fullDateTime(tx.createdAt as string)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${txTypeBadge[tx.type] || "bg-gray-100 text-gray-700"}`}>
                          {tx.type}
                        </span>
                        {tx.note && <p className="text-xs text-on-surface-variant mt-1.5 line-clamp-1">{tx.note}</p>}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-[#134235]">৳{tx.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-black/5 rounded-2xl p-6 premium-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-[#E8F1EE] text-primary rounded-xl"><Wallet className="w-5 h-5" /></div>
              <h3 className="font-headline text-lg font-bold text-on-surface">Wallet</h3>
            </div>
            
            <div className={`p-5 rounded-2xl border ${user.walletBalance < 0 ? "bg-red-50/50 border-red-100" : "bg-surface-container/30 border-black/[0.03]"} mb-6 relative overflow-hidden`}>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">Available Balance</p>
              <div className="flex items-baseline gap-1">
                <span className={`text-xl font-bold font-manrope ${user.walletBalance < 0 ? "text-red-700" : "text-on-surface-variant"}`}>৳</span>
                <span className={`text-4xl font-extrabold tracking-tight font-headline ${user.walletBalance < 0 ? "text-red-600" : "text-[#134235]"}`}>
                  {user.walletBalance.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <button onClick={() => setShowAddBalance(true)} disabled={!isActive}
                className="flex flex-col items-center justify-center gap-2 bg-[#134235] text-white p-4 rounded-xl hover:bg-[#0a241c] disabled:opacity-50 transition-all shadow-lg shadow-[#134235]/20">
                <Plus className="w-5 h-5" />
                <span className="text-xs font-bold font-manrope tracking-wide">Top Up</span>
              </button>
              <button onClick={() => setShowDeductBalance(true)} disabled={!isActive}
                className="flex flex-col items-center justify-center gap-2 border border-[#134235]/20 text-[#134235] bg-white p-4 rounded-xl hover:bg-surface-container disabled:opacity-50 transition-all">
                <Minus className="w-5 h-5" />
                <span className="text-xs font-bold font-manrope tracking-wide">Return</span>
              </button>
            </div>

            <div className="pt-6 border-t border-black/5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-orange-600">
                  <CreditCard className="w-4 h-4" />
                  <span className="font-manrope font-bold text-sm">Credit Limit</span>
                </div>
                <span className="font-mono font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md text-xs">
                  ৳{user.creditLimit.toFixed(2)}
                </span>
              </div>
              <button onClick={() => { setCreditLimitInput(user.creditLimit.toString()); setShowCreditLimit(true); }}
                className="w-full py-2.5 text-xs font-bold font-manrope border border-orange-200 text-orange-600 bg-orange-50/50 hover:bg-orange-100 rounded-xl transition-all">
                Manage Limit
              </button>
            </div>
          </div>
        </div>
      </div>

      <BalanceModal
        open={showAddBalance} onClose={() => setShowAddBalance(false)}
        title="Transfer Balance to User"
        icon={Plus} iconBg="bg-primary/10" iconColor="text-primary"
        inputColor="focus:ring-primary/20"
        actionLabel="Transfer Balance" actionBg="bg-primary hover:opacity-90 shadow-lg shadow-primary/20"
        warning="This amount will be deducted from your own wallet."
        amount={addAmount} setAmount={setAddAmount} note={addNote} setNote={setAddNote}
        submitting={submitting} onSubmit={() => handleTransferBalance("topup")}
      />

      <BalanceModal
        open={showDeductBalance} onClose={() => setShowDeductBalance(false)}
        title="Return Balance from User"
        icon={Minus} iconBg="bg-red-50" iconColor="text-red-500"
        inputColor="focus:ring-red-300"
        actionLabel="Return Balance" actionBg="bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20"
        warning="This amount will be returned to your wallet. User must have sufficient balance."
        amount={deductAmount} setAmount={setDeductAmount} note={deductNote} setNote={setDeductNote}
        submitting={submitting} onSubmit={() => handleTransferBalance("deduct")}
      />

      {showCreditLimit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !savingCredit && setShowCreditLimit(false)} />
          <div className="relative bg-white rounded-2xl border border-black/5 premium-shadow w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.03]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600"><CreditCard className="w-5 h-5" /></div>
                <h3 className="font-manrope font-bold text-[#134235] text-lg">Set Credit Limit</h3>
              </div>
              <button onClick={() => setShowCreditLimit(false)} disabled={savingCredit} className="p-2 text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl text-xs text-orange-800 font-medium">
                Set to 0 to disable credit.
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-1.5">Credit Limit (BDT)</label>
                <input type="number" min="0" value={creditLimitInput} onChange={e => setCreditLimitInput(e.target.value)} placeholder="0"
                  className="w-full border bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowCreditLimit(false)} disabled={savingCredit}
                  className="flex-1 px-4 py-3 text-sm font-bold font-manrope border rounded-xl hover:bg-surface-container transition-colors">Cancel</button>
                <button onClick={handleSetCreditLimit} disabled={savingCredit}
                  className="flex-1 px-4 py-3 text-sm font-bold font-manrope text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all">
                  {savingCredit ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save Limit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
