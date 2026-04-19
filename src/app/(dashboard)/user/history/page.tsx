"use client";
import { useEffect, useState, useCallback } from "react";
import { Transaction, Service, TxStatus, BalanceRequest, RequestStatus } from "@/types";
import { useAuth } from "@/lib/hooks/useAuth";
import { History, LayoutDashboard, Search, Zap, ArrowRight, Activity, Clock, CheckCircle2, XCircle, Wallet } from "lucide-react";
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

      setTransactions(txData.transactions || []);
      setBalanceRequests(reqData.requests || []);

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

  const allItems = [...transactions, ...balanceRequests].sort((a, b) => {
    const tA = new Date(a.createdAt).getTime() || 0;
    const tB = new Date(b.createdAt).getTime() || 0;
    return tB - tA;
  });

  function getStatusStyle(status: TxStatus) {
    switch (status) {
      case "complete": return "bg-green-50 text-green-700 border-green-200/60";
      case "pending":  return "bg-amber-50 text-amber-700 border-amber-200/60";
      case "processing":return "bg-blue-50 text-blue-700 border-blue-200/60";
      case "waiting":  return "bg-amber-50 text-amber-700 border-amber-200/60";
      case "failed":   return "bg-red-50 text-red-700 border-red-200/60";
      default:         return "bg-gray-50 text-gray-700 border-gray-200/60";
    }
  }

  function getRequestStyle(status: RequestStatus) {
    switch (status) {
      case "approved": return "bg-green-50 text-green-700 border-green-200/60";
      case "pending":  return "bg-amber-50 text-amber-700 border-amber-200/60";
      case "rejected":   return "bg-red-50 text-red-700 border-red-200/60";
      default:         return "bg-gray-50 text-gray-700 border-gray-200/60";
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "complete": 
      case "approved": return <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />;
      case "pending":  return <Clock className="w-3.5 h-3.5 mr-1.5" />;
      case "processing":return <Activity className="w-3.5 h-3.5 mr-1.5 animate-pulse" />;
      case "waiting":  return <Clock className="w-3.5 h-3.5 mr-1.5" />;
      case "failed":   
      case "rejected": return <XCircle className="w-3.5 h-3.5 mr-1.5" />;
      default:         return null;
    }
  }

  const renderSkeletonRows = () => {
    return [1, 2, 3, 4, 5].map((i) => (
      <tr key={i} className="animate-pulse border-b border-gray-50">
        <td className="px-5 py-4"><div className="h-4 bg-gray-100 rounded w-full max-w-[150px]" /></td>
        <td className="px-5 py-4"><div className="h-4 bg-gray-100 rounded w-full max-w-[100px]" /></td>
        <td className="px-5 py-4"><div className="h-4 bg-gray-100 rounded w-32" /></td>
        <td className="px-5 py-4"><div className="h-6 bg-gray-100 rounded-full w-24" /></td>
        <td className="px-5 py-4"><div className="h-4 bg-gray-100 rounded w-20" /></td>
      </tr>
    ));
  };

  return (
    <div className="p-6 sm:p-10 max-w-6xl mx-auto space-y-8 pb-12">
      {/* ── Premium Header ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#134235] rounded-3xl p-8 sm:p-10 text-white shadow-lg relative overflow-hidden mb-8">
        {/* Subtle geometric background overlay */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
           <div className="absolute -right-20 -top-40 w-96 h-96 bg-white/5 rounded-full blur-3xl mix-blend-overlay" />
           <div className="absolute right-40 bottom-[-20%] w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl mix-blend-overlay" />
        </div>
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-sm font-bold font-manrope mb-4 backdrop-blur-md">
              <History className="w-4 h-4 text-emerald-300" />
              <span className="text-emerald-50 tracking-wide">Activity Logs</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold mb-3 font-headline tracking-tight text-white shadow-sm">
              Transaction History
            </h1>
            <p className="text-[#A2C2B5] text-sm md:text-base leading-relaxed max-w-lg font-medium">
              Track your recent top-ups, disbursements, and payments. All transactions are securely logged in real-time.
            </p>
          </div>
          
          <div className="shrink-0">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 flex flex-col justify-center min-w-[140px] premium-shadow">
              <span className="text-xs text-[#A2C2B5] font-bold uppercase tracking-widest mb-1 font-manrope">Total Logs</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-white">{allItems.length}</span>
                <span className="text-sm font-medium text-[#A2C2B5]">entries</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {allItems.length === 0 && !loading ? (
        <div className="border border-dashed border-[#2D5A4C]/20 rounded-3xl px-5 py-20 text-center bg-white shadow-sm premium-shadow">
           <div className="w-20 h-20 bg-[#E8F1EE] rounded-2xl flex items-center justify-center mx-auto mb-6">
             <History className="w-8 h-8 text-primary" />
           </div>
           <p className="text-xl text-[#134235] font-extrabold font-headline mb-2">No transactions found</p>
           <p className="text-sm text-on-surface-variant mb-8 max-w-sm mx-auto">
             You haven&apos;t initiated any transactions yet. Head over to the services directory to get started.
           </p>
           <Link href="/user/services" className="inline-flex items-center justify-center gap-2 text-sm font-bold bg-primary text-white px-8 py-3.5 rounded-xl hover:bg-primary-dim transition-all shadow-md hover:shadow-lg font-manrope">
             Browse Services <ArrowRight className="w-4 h-4" />
           </Link>
        </div>
      ) : (
        <div className="bg-white border border-black/5 rounded-2xl premium-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-surface-container border-b border-black/[0.04] text-on-surface-variant font-manrope">
                  <th className="px-6 py-4.5 font-bold text-[11px] uppercase tracking-[0.1em]">Details</th>
                  <th className="px-6 py-4.5 font-bold text-[11px] uppercase tracking-[0.1em]">Amount</th>
                  <th className="px-6 py-4.5 font-bold text-[11px] uppercase tracking-[0.1em]">Recipient</th>
                  <th className="px-6 py-4.5 font-bold text-[11px] uppercase tracking-[0.1em]">Status</th>
                  <th className="px-6 py-4.5 font-bold text-[11px] uppercase tracking-[0.1em]">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {loading ? renderSkeletonRows() : allItems.map((item) => {
                  if ("medium" in item || "adminNote" in item || ("amount" in item && !("recipientNumber" in item))) {
                    // BalanceRequest
                    const req = item as BalanceRequest;
                    return (
                      <tr key={req.id} className="hover:bg-surface-container/50 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100/50 flex items-center justify-center shrink-0">
                               <Wallet className="w-4.5 h-4.5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-bold text-[#134235] font-manrope">Wallet Top-Up</p>
                              <p className="text-[11px] text-on-surface-variant/80 font-medium font-mono uppercase tracking-wider mt-0.5">REQ-{req.id.slice(0, 6)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-extrabold text-green-600 tracking-tight text-[15px]">+৳{req.amount.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-xs bg-surface text-on-surface-variant border border-black/5 px-2.5 py-1 rounded-lg uppercase tracking-wider">{req.medium || "—"}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={clsx("inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-bold border uppercase tracking-wider font-manrope", getRequestStyle(req.status))}>
                            {getStatusIcon(req.status)}
                            {req.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-on-surface-variant font-medium">
                          {req.createdAt ? relativeTime(req.createdAt) : "Just now"}
                        </td>
                      </tr>
                    );
                  }

                  // Transaction
                  const tx = item as Transaction;
                  const svc = tx.serviceId ? servicesMap[tx.serviceId] : undefined;
                  
                  return (
                    <tr key={tx.id} className="hover:bg-surface-container/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-[#E8F1EE] border border-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                             {svc?.icon ? (
                               <img src={svc.icon} alt={svc.name || "Service"} className="w-full h-full object-cover" />
                             ) : (
                               <Zap className="w-4.5 h-4.5 text-primary" />
                             )}
                          </div>
                          <div>
                            <p className="font-bold text-[#134235] font-manrope">{svc?.name || "Unknown Service"}</p>
                            <p className="text-[11px] text-on-surface-variant/80 font-medium font-mono uppercase tracking-wider mt-0.5">TX-{tx.id.slice(0, 6)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-extrabold text-on-surface tracking-tight text-[15px]">-৳{tx.amount.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-xs bg-surface text-on-surface-variant border border-black/5 px-2.5 py-1 rounded-lg tracking-wider">{tx.recipientNumber || "—"}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={clsx("inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-bold border uppercase tracking-wider font-manrope", getStatusStyle(tx.status))}>
                          {getStatusIcon(tx.status)}
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-on-surface-variant font-medium">
                        {tx.createdAt ? relativeTime(tx.createdAt) : "Just now"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* Footer stats */}
          {!loading && allItems.length > 0 && (
            <div className="px-6 py-4 border-t border-black/[0.04] bg-surface flex items-center justify-between text-[11px] font-bold tracking-wider uppercase font-manrope text-on-surface-variant">
              <p>Showing latest {allItems.length} records</p>
              <p className="flex items-center gap-2">Auto-refreshing live data <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" /></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
