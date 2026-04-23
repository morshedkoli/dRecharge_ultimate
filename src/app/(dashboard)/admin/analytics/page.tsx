"use client";

import { useState, useEffect, useMemo } from "react";
import { ListOrdered, Inbox, Search, TrendingUp, ArrowDownRight, ArrowUpRight, Clock } from "lucide-react";
import { relativeTime } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { WalletAmount } from "@/components/admin/WalletAmount";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

// -- Overview Metrics Component --
function OverviewMetrics({ txs, reqs }: { txs: any[], reqs: any[] }) {
  const metrics = useMemo(() => {
    let topupAmt = 0, topupCount = 0;
    let deductAmt = 0, deductCount = 0;
    let reqAmt = 0, reqCount = 0;

    txs.forEach(t => {
      if (t.status === "completed") {
        if (t.type === "topup" || t.type === "credit") {
          topupAmt += t.amount;
          topupCount++;
        } else if (t.type === "deduct") {
          deductAmt += t.amount;
          deductCount++;
        }
      }
    });

    reqs.forEach(r => {
      if (r.status === "pending") {
        reqAmt += r.amount;
        reqCount++;
      }
    });

    return { topupAmt, topupCount, deductAmt, deductCount, reqAmt, reqCount };
  }, [txs, reqs]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card>
        <CardContent className="p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Add Balance</p>
            <h4 className="text-2xl font-bold text-[#134235]"><WalletAmount amount={metrics.topupAmt} /></h4>
            <p className="text-xs text-on-surface-variant mt-1">{metrics.topupCount} transactions</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
            <ArrowDownRight className="w-5 h-5 text-orange-700" />
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Deduct Balance</p>
            <h4 className="text-2xl font-bold text-[#134235]"><WalletAmount amount={metrics.deductAmt} /></h4>
            <p className="text-xs text-on-surface-variant mt-1">{metrics.deductCount} transactions</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Pending Requests</p>
            <h4 className="text-2xl font-bold text-[#134235]"><WalletAmount amount={metrics.reqAmt} /></h4>
            <p className="text-xs text-on-surface-variant mt-1">{metrics.reqCount} pending</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// -- Ledger Tab Component --
function LedgerTab({ usersMap, txs, loading }: { usersMap: Record<string, any>, txs: any[], loading: boolean }) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTxs = txs.filter(t => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const user = usersMap[t.userId];
      const matchName = user?.displayName?.toLowerCase().includes(q);
      const matchPhone = user?.phone?.toLowerCase().includes(q);
      const matchNote = t.note?.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchNote) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 bg-surface-container/50 p-1 rounded-lg w-fit">
          {["all", "send", "topup", "deduct"].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                typeFilter === t ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              }`}>
              {t}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64 sm:ml-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <Input type="text" placeholder="Search user or note..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-white" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && Array(6).fill(0).map((_, i) => (
          <Card key={i}><CardContent className="h-32 animate-pulse bg-surface-container/30" /></Card>
        ))}
        {!loading && filteredTxs.map((t) => {
          const user = usersMap[t.userId];
          return (
            <Card key={t._id} className="group hover:border-primary/20 transition-all">
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-on-surface text-sm truncate">{user?.displayName || "Unknown User"}</p>
                    <p className="font-mono text-[11px] text-on-surface-variant truncate">{user?.phone || t.userId.slice(0, 8)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-[#134235] text-base">
                      {t.type === 'topup' || t.type === 'credit' ? '+' : t.type === 'deduct' ? '-' : ''}
                      <WalletAmount amount={t.amount} />
                    </div>
                    <span className={`inline-block px-1.5 py-0.5 mt-1 text-[9px] font-bold uppercase rounded tracking-wider ${
                      t.type === 'topup' || t.type === 'credit' ? 'bg-green-100 text-green-700' :
                      t.type === 'deduct' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                    }`}>{t.type}</span>
                  </div>
                </div>
                <div className="flex justify-between items-end border-t border-outline-variant/30 pt-3">
                  <div className="text-xs text-on-surface-variant min-w-0 pr-2">
                    <div className="truncate">{t.note || t.serviceId || "—"}</div>
                    <div className="text-[10px] text-on-surface-variant/70 mt-0.5">{relativeTime(t.createdAt)}</div>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={t.status} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {!loading && filteredTxs.length === 0 && (
        <div className="text-center py-12 text-sm text-on-surface-variant font-manrope">No transactions found.</div>
      )}
    </div>
  );
}

// -- Requests Tab Component --
function RequestsTab({ usersMap, reqs, loading }: { usersMap: Record<string, any>, reqs: any[], loading: boolean }) {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && Array(6).fill(0).map((_, i) => (
          <Card key={i}><CardContent className="h-32 animate-pulse bg-surface-container/30" /></Card>
        ))}
        {!loading && reqs.map((r) => {
          const user = usersMap[r.userId];
          return (
            <Card key={r._id} className="group hover:border-primary/20 transition-all">
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-on-surface text-sm truncate">{user?.displayName || "Unknown User"}</p>
                    <p className="font-mono text-[11px] text-on-surface-variant truncate">{user?.phone || r.userId.slice(0, 8)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-primary text-base">
                      <WalletAmount amount={r.amount} />
                    </div>
                    <div className="text-[10px] font-medium text-on-surface-variant mt-0.5">
                      Bal: <WalletAmount amount={user?.walletBalance || 0} />
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-end border-t border-outline-variant/30 pt-3">
                  <div className="text-xs min-w-0 pr-2">
                    <div className="text-on-surface-variant truncate"><span className="font-semibold">Via:</span> {r.medium || "—"}</div>
                    <div className="text-on-surface-variant truncate"><span className="font-semibold">Note:</span> {r.note || "—"}</div>
                    {r.adminNote && <div className="text-red-600 truncate mt-0.5 font-medium"><span className="font-semibold">Admin:</span> {r.adminNote}</div>}
                    <div className="text-[10px] text-on-surface-variant/70 mt-1">{relativeTime(r.createdAt)}</div>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {!loading && reqs.length === 0 && (
        <div className="text-center py-12 text-sm text-on-surface-variant font-manrope">No balance requests found.</div>
      )}
    </div>
  );
}

// -- Main Page --
export default function AnalyticsPage() {
  const [tab, setTab] = useState<"payment_report" | "requests">("payment_report");
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [txs, setTxs] = useState<any[]>([]);
  const [reqs, setReqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch("/api/admin/users").then(res => res.json()),
      fetch("/api/admin/transactions").then(res => res.json()),
      fetch("/api/admin/balance-requests").then(res => res.json())
    ]).then(([usersData, txsData, reqsData]) => {
      if (!mounted) return;
      
      if (usersData.users) {
        const map: Record<string, any> = {};
        usersData.users.forEach((u: any) => {
          map[u.uid] = { displayName: u.displayName, phone: u.phoneNumber, walletBalance: u.walletBalance };
        });
        setUsersMap(map);
      }
      
      if (txsData.transactions) setTxs(txsData.transactions);
      if (reqsData.requests) setReqs(reqsData.requests);
      
      setLoading(false);
    }).catch((e) => {
      console.error(e);
      if (mounted) setLoading(false);
    });

    return () => { mounted = false; };
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-bold tracking-tight text-[#134235] mb-1">Payment Report</h1>
          <p className="text-sm text-on-surface-variant">System performance and transaction history</p>
        </div>
      </section>

      {/* Overview Metrics */}
      <OverviewMetrics txs={txs} reqs={reqs} />

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-container/50 p-1 rounded-lg w-fit">
        {[
          { key: "payment_report", label: "Payment Report", icon: ListOrdered },
          { key: "requests", label: "Requests History", icon: Inbox },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
              tab === key
                ? "bg-white text-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "payment_report" && <LedgerTab usersMap={usersMap} txs={txs} loading={loading} />}
      {tab === "requests" && <RequestsTab usersMap={usersMap} reqs={reqs} loading={loading} />}
    </div>
  );
}
