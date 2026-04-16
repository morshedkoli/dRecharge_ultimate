"use client";
import { use, useEffect, useState } from "react";
import { AppUser, Transaction, BalanceRequest } from "@/types";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { WalletAmount } from "@/components/admin/WalletAmount";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { suspendUser, activateUser } from "@/lib/functions";
import { relativeTime, fullDateTime, getInitials, maskNumber } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, Lock, Plus, Minus, Wallet, Clock, CreditCard,
  ShieldCheck, ShieldOff, Loader2, X, Receipt, RefreshCw, User
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
    setSubmitting(true);
    try {
      await callBalanceApi("add", amt, addNote);
      toast.success(`৳${amt.toFixed(2)} added to wallet`);
      setShowAddBalance(false); setAddAmount(""); setAddNote("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSubmitting(false); }
  }

  async function handleDeductBalance() {
    const amt = parseFloat(deductAmount);
    if (isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }
    setSubmitting(true);
    try {
      await callBalanceApi("deduct", amt, deductNote);
      toast.success(`৳${amt.toFixed(2)} deducted from wallet`);
      setShowDeductBalance(false); setDeductAmount(""); setDeductNote("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSubmitting(false); }
  }

  // ── type badge colours ──────────────────────────────────────────────────────
  const txTypeBadge: Record<string, string> = {
    send:   "bg-blue-50 text-blue-700",
    topup:  "bg-[#E8F1EE] text-primary",
    deduct: "bg-red-50 text-red-700",
    refund: "bg-purple-50 text-purple-700",
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
              {getInitials(user.displayName || user.email)}
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
              <p className="text-on-surface-variant">{user.email}</p>
              {user.phoneNumber && <p className="text-sm text-on-surface-variant mt-0.5">{user.phoneNumber}</p>}

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
                  onConfirm={() => suspendUser(user.uid).then(() => { toast.success("User suspended"); }).catch((e) => { toast.error(e.message); })}
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
                  onConfirm={() => activateUser(user.uid).then(() => { toast.success("User activated"); }).catch((e) => { toast.error(e.message); })}
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
              <p className="font-headline text-3xl font-extrabold text-[#134235]">
                <WalletAmount amount={user.walletBalance} />
              </p>
              <div className="flex items-center gap-3 mt-3">
                <button onClick={() => setShowAddBalance(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#E8F1EE] text-primary hover:bg-primary/15 border border-primary/10 rounded-xl text-xs font-bold font-manrope transition-all">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
                <button onClick={() => setShowDeductBalance(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-xl text-xs font-bold font-manrope transition-all">
                  <Minus className="w-3.5 h-3.5" /> Deduct
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

        {/* Transactions table */}
        {tab === "tx" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[640px]">
              <thead>
                <tr className="text-[11px] font-extrabold text-on-surface-variant/60 uppercase tracking-[0.2em] bg-surface-container/30 font-manrope">
                  <th className="px-8 py-4">Date</th>
                  <th className="px-8 py-4">Type</th>
                  <th className="px-8 py-4">Provider</th>
                  <th className="px-8 py-4">Recipient / Note</th>
                  <th className="px-8 py-4">Amount</th>
                  <th className="px-8 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03]">
                {transactions.map((tx) => {
                  const isCredit = tx.type === "topup" || tx.type === "refund";
                  const isAdminAdj = tx.type === "topup" || tx.type === "deduct";
                  return (
                    <tr key={tx.id} className="group hover:bg-surface-container/20 transition-colors">
                      <td className="px-8 py-4 text-on-surface-variant text-xs whitespace-nowrap">{relativeTime(tx.createdAt)}</td>
                      <td className="px-8 py-4">
                        <span className={`text-[10px] px-3 py-1 rounded-full font-bold capitalize font-manrope uppercase tracking-wider ${txTypeBadge[tx.type] ?? "bg-surface-container text-on-surface-variant"}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-8 py-4">
                        {tx.serviceId
                          ? <span className="text-xs bg-surface-container text-on-surface-variant px-2.5 py-1 rounded-lg font-mono">{tx.serviceId.slice(0, 8)}</span>
                          : <span className="text-on-surface-variant/40">—</span>}
                      </td>
                      <td className="px-8 py-4 text-on-surface-variant">
                        {isAdminAdj
                          ? <span className="text-xs font-manrope">{tx.note || "Admin adjustment"}</span>
                          : tx.recipientNumber ? <span className="font-mono text-sm">{maskNumber(tx.recipientNumber)}</span> : "—"}
                      </td>
                      <td className={`px-8 py-4 font-bold font-manrope ${isCredit ? "text-primary" : "text-red-600"}`}>
                        {isCredit ? "+" : "−"}<WalletAmount amount={tx.amount} />
                      </td>
                      <td className="px-8 py-4"><StatusBadge status={tx.status} /></td>
                    </tr>
                  );
                })}
                {transactions.length === 0 && (
                  <tr><td colSpan={6} className="px-8 py-14 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-surface-container mx-auto flex items-center justify-center mb-3">
                      <Receipt className="w-6 h-6 text-on-surface-variant" />
                    </div>
                    <p className="text-on-surface-variant text-sm font-manrope font-semibold">No transactions yet</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Balance requests table */}
        {tab === "req" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[480px]">
              <thead>
                <tr className="text-[11px] font-extrabold text-on-surface-variant/60 uppercase tracking-[0.2em] bg-surface-container/30 font-manrope">
                  <th className="px-8 py-4">Date</th>
                  <th className="px-8 py-4">Amount</th>
                  <th className="px-8 py-4">Medium</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03]">
                {requests.map((r) => (
                  <tr key={r.id} className="group hover:bg-surface-container/20 transition-colors">
                    <td className="px-8 py-4 text-on-surface-variant text-xs whitespace-nowrap">{relativeTime(r.createdAt)}</td>
                    <td className="px-8 py-4 font-bold font-manrope text-[#134235]"><WalletAmount amount={r.amount} /></td>
                    <td className="px-8 py-4">
                      {r.medium
                        ? <span className="text-xs bg-surface-container px-2.5 py-1 rounded-lg font-manrope font-semibold text-on-surface-variant">{r.medium}</span>
                        : <span className="text-on-surface-variant/40">—</span>}
                    </td>
                    <td className="px-8 py-4"><StatusBadge status={r.status} /></td>
                    <td className="px-8 py-4 text-on-surface-variant text-xs">{r.note || "—"}</td>
                  </tr>
                ))}
                {requests.length === 0 && (
                  <tr><td colSpan={5} className="px-8 py-14 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-surface-container mx-auto flex items-center justify-center mb-3">
                      <CreditCard className="w-6 h-6 text-on-surface-variant" />
                    </div>
                    <p className="text-on-surface-variant text-sm font-manrope font-semibold">No balance requests</p>
                  </td></tr>
                )}
              </tbody>
            </table>
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
    </div>
  );
}
