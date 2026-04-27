"use client";
import { useEffect, useState, useCallback } from "react";
import { Transaction, Service, TxStatus, BalanceRequest, RequestStatus } from "@/types";
import { useAuth } from "@/lib/hooks/useAuth";
import { History, Search, Zap, ArrowRight, Activity, Clock, CheckCircle2, XCircle, Wallet, RefreshCw } from "lucide-react";
import { relativeTime } from "@/lib/utils";
import Link from "next/link";
import clsx from "clsx";

export default function UserHistoryPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balanceRequests, setBalanceRequests] = useState<BalanceRequest[]>([]);
  const [servicesMap, setServicesMap] = useState<Record<string, Service>>({});
  const [loadingTxs, setLoadingTxs] = useState(true);
  const [loadingReqs, setLoadingReqs] = useState(true);
  const [search, setSearch] = useState("");

  const loading = loadingTxs || loadingReqs;

  const fetchAll = useCallback(async () => {
    if (!user) { setLoadingTxs(false); setLoadingReqs(false); return; }
    try {
      const [txRes, reqRes, svcRes] = await Promise.all([
        fetch("/api/transactions", { credentials: "include" }),
        fetch("/api/balance-requests", { credentials: "include" }),
        fetch("/api/services?includeInactive=1", { credentials: "include" }),
      ]);
      const [txData, reqData, svcData] = await Promise.all([txRes.json(), reqRes.json(), svcRes.json()]);
      setTransactions((txData.transactions || []).map((t: any) => ({ ...t, id: t._id || t.id })));
      setBalanceRequests((reqData.requests || []).map((r: any) => ({ ...r, id: r._id || r.id })));
      const map: Record<string, Service> = {};
      (svcData.services || []).forEach((s: Service) => { map[s.id] = s; });
      setServicesMap(map);
    } catch (err) {
      console.error("History fetch error:", err);
    } finally {
      setLoadingTxs(false);
      setLoadingReqs(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const allItems = [...transactions, ...balanceRequests].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const filtered = allItems.filter(item => {
    if (!search) return true;
    const q = search.toLowerCase();
    if ("recipientNumber" in item) return (item as Transaction).recipientNumber?.includes(q) || false;
    if ("medium" in item) return ((item as BalanceRequest).medium || "").toLowerCase().includes(q);
    return false;
  });

  function getStatusStyle(status: TxStatus | RequestStatus) {
    switch (status) {
      case "complete": case "approved": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "pending":  return "bg-amber-50 text-amber-700 border-amber-200";
      case "processing": return "bg-blue-50 text-blue-700 border-blue-200";
      case "waiting":  return "bg-amber-50 text-amber-700 border-amber-200";
      case "failed": case "rejected": return "bg-red-50 text-red-700 border-red-200";
      default: return "bg-gray-50 text-gray-600 border-gray-200";
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "complete": case "approved": return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "pending": return <Clock className="w-3.5 h-3.5" />;
      case "processing": return <Activity className="w-3.5 h-3.5 animate-pulse" />;
      case "waiting": return <Clock className="w-3.5 h-3.5" />;
      case "failed": case "rejected": return <XCircle className="w-3.5 h-3.5" />;
      default: return null;
    }
  }

  return (
    <div className="p-6 sm:p-10 max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-[#134235] rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -right-20 -top-40 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute right-40 bottom-[-20%] w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-sm font-bold font-manrope mb-4">
              <History className="w-4 h-4 text-emerald-300" />
              <span className="text-emerald-50 tracking-wide">Activity Logs</span>
            </div>
            <h1 className="text-3xl font-extrabold font-headline tracking-tight">Transaction History</h1>
            <p className="text-[#A2C2B5] text-sm mt-2">Track your top-ups, payments & requests in real-time.</p>
          </div>
          <div className="shrink-0 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 min-w-[120px] text-center">
            <p className="text-xs text-[#A2C2B5] font-bold uppercase tracking-widest mb-1 font-manrope">Total</p>
            <p className="text-4xl font-extrabold">{allItems.length}</p>
          </div>
        </div>
      </div>

      {/* Search + Refresh */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search recipient, medium…"
            className="w-full pl-11 pr-4 py-2.5 border border-outline-variant bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <button onClick={fetchAll} disabled={loading}
          className="p-2.5 border border-outline-variant bg-white rounded-xl text-on-surface-variant hover:bg-surface-container transition-all disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Empty state */}
      {!loading && allItems.length === 0 && (
        <div className="border border-dashed border-primary/20 rounded-3xl px-5 py-20 text-center bg-white premium-shadow">
          <div className="w-20 h-20 bg-[#E8F1EE] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <History className="w-8 h-8 text-primary" />
          </div>
          <p className="text-xl text-[#134235] font-extrabold font-headline mb-2">No transactions found</p>
          <p className="text-sm text-on-surface-variant mb-8 max-w-sm mx-auto">
            You haven&apos;t initiated any transactions yet. Head over to services to get started.
          </p>
          <Link href="/user/services" className="inline-flex items-center gap-2 text-sm font-bold bg-primary text-white px-8 py-3.5 rounded-xl hover:opacity-90 transition-all shadow-md font-manrope">
            Browse Services <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Cards */}
      {(loading || filtered.length > 0) && (
        <div className="space-y-3">
          {loading && Array(5).fill(0).map((_, i) => (
            <div key={i} className="bg-white border border-black/5 rounded-2xl p-4 animate-pulse premium-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-surface-container shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-surface-container rounded w-1/3" />
                  <div className="h-3 bg-surface-container rounded w-1/2" />
                </div>
                <div className="h-6 bg-surface-container rounded-full w-20" />
              </div>
            </div>
          ))}

          {!loading && filtered.map((item) => {
            const isReq = "medium" in item || "adminNote" in item || ("amount" in item && !("recipientNumber" in item));
            if (isReq) {
              const req = item as BalanceRequest;
              return (
                <div key={req.id} className="bg-white border border-black/5 rounded-2xl p-4 premium-shadow hover:border-primary/20 hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                      <Wallet className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#134235] font-manrope">Wallet Top-Up Request</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="font-mono text-[10px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded uppercase tracking-wider">REQ-{req.id.slice(0,6)}</span>
                        {req.medium && <span className="text-[10px] font-semibold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">{req.medium}</span>}
                        <span className="text-[10px] text-on-surface-variant">{relativeTime(req.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <p className="font-extrabold text-emerald-600 text-base">+৳{req.amount.toLocaleString()}</p>
                      <span className={clsx("inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold border uppercase tracking-wider font-manrope", getStatusStyle(req.status))}>
                        {getStatusIcon(req.status)} {req.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            const tx = item as Transaction;
            const svc = tx.serviceId ? servicesMap[tx.serviceId] : undefined;
            const isCredit = tx.type === "topup" || tx.type === "refund";

            return (
              <div key={tx.id} className="bg-white border border-black/5 rounded-2xl p-4 premium-shadow hover:border-primary/20 hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#E8F1EE] border border-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                    {svc?.icon ? (
                      <img src={svc.icon} alt={svc.name} className="w-full h-full object-cover" />
                    ) : (
                      <Zap className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#134235] font-manrope truncate">{svc?.name || (isCredit ? "Wallet Credit" : "Unknown Service")}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-mono text-[10px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded uppercase tracking-wider">TX-{tx.id.slice(0,6)}</span>
                      {tx.recipientNumber && <span className="font-mono text-[10px] text-on-surface-variant">{tx.recipientNumber}</span>}
                      <span className="text-[10px] text-on-surface-variant">{relativeTime(tx.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <p className={`font-extrabold text-base ${isCredit ? "text-emerald-600" : "text-on-surface"}`}>
                      {isCredit ? "+" : "−"}৳{tx.amount.toLocaleString()}
                    </p>
                    <span className={clsx("inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold border uppercase tracking-wider font-manrope", getStatusStyle(tx.status))}>
                      {getStatusIcon(tx.status)} {tx.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {!loading && filtered.length > 0 && (
        <p className="text-center text-[11px] font-bold tracking-wider uppercase font-manrope text-on-surface-variant flex items-center justify-center gap-2">
          Showing {filtered.length} records · Auto-refreshing
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
        </p>
      )}
    </div>
  );
}
