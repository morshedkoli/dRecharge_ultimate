"use client";
import { useState, useEffect, useCallback } from "react";
import { useBalanceRequests } from "@/lib/hooks/admin/useBalanceRequests";
import { WalletAmount } from "@/components/admin/WalletAmount";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { approveBalanceRequest, rejectBalanceRequest } from "@/lib/functions";
import { relativeTime } from "@/lib/utils";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, History } from "lucide-react";
import { BalanceRequest } from "@/types";

function PendingTab({
  requests,
  loading,
  refetch,
  usersMap,
}: {
  requests: BalanceRequest[];
  loading: boolean;
  refetch: () => void;
  usersMap: Record<string, { displayName: string; phone: string }>;
}) {
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  return (
    <div className="space-y-6">
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-[320px] bg-white border border-black/5 rounded-2xl p-6 animate-pulse premium-shadow" />
          ))}
        </div>
      )}
      
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {requests.filter(r => !processingIds.has(r.id)).map((req) => {
            const user = usersMap[req.userId];
            return (
              <div key={req.id} className="bg-white border border-black/5 rounded-2xl p-6 flex flex-col premium-shadow card-hover transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-[#134235] font-manrope text-lg truncate">{user?.displayName || "Unknown User"}</p>
                    <p className="font-mono text-xs text-on-surface-variant mt-0.5 truncate">{user?.phone || req.userId.slice(0, 8)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-[#134235] text-xl font-inter"><WalletAmount amount={req.amount} /></div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mt-1">{req.medium || "—"}</div>
                  </div>
                </div>
                
                <div className="space-y-3 flex-1 mb-6 text-sm">
                  <div className="flex justify-between border-b border-black/[0.03] pb-2">
                    <span className="text-on-surface-variant">Requested</span>
                    <span className="font-medium text-on-surface">{relativeTime(req.createdAt)}</span>
                  </div>
                  <div className="flex flex-col gap-1 border-b border-black/[0.03] pb-2">
                    <span className="text-on-surface-variant text-xs">User Note</span>
                    <span className="font-medium text-on-surface text-xs leading-relaxed bg-surface-container/30 p-2 rounded-xl border border-black/[0.02] break-words line-clamp-3">{req.note || "No note provided"}</span>
                  </div>
                  <div className="pt-1">
                    <input type="text" placeholder="Admin Note (required for reject)"
                      value={adminNotes[req.id] || ""}
                      onChange={(e) => setAdminNotes((n) => ({ ...n, [req.id]: e.target.value }))}
                      className="w-full border border-outline-variant bg-surface rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/50" />
                  </div>
                </div>

                <div className="flex gap-3 mt-auto">
                  <ConfirmDialog title="Approve balance request?"
                    description={`This will add ৳ ${req.amount.toFixed(2)} to the user's wallet.`}
                    confirmLabel="Approve"
                    onConfirm={async () => {
                      setProcessingIds(prev => new Set([...prev, req.id]));
                      try {
                        await approveBalanceRequest(req.id, adminNotes[req.id]);
                        toast.success(`৳ ${req.amount.toFixed(2)} added to wallet`);
                        refetch();
                      } catch (e) {
                        setProcessingIds(prev => { const s = new Set(prev); s.delete(req.id); return s; });
                        throw e;
                      }
                    }}>
                    <button className="flex-1 inline-flex justify-center items-center gap-1.5 px-3 py-2.5 bg-primary text-on-primary text-sm rounded-xl hover:opacity-90 font-bold font-manrope shadow-[0_4px_14px_rgba(19,66,53,0.15)] transition-all active:scale-[0.98]">
                      <CheckCircle className="w-4 h-4" /> Approve
                    </button>
                  </ConfirmDialog>
                  <ConfirmDialog title="Reject this request?"
                    description="The user will be notified with your admin note. A reason is required."
                    confirmLabel="Reject" confirmVariant="destructive"
                    onConfirm={async () => {
                      const note = adminNotes[req.id];
                      if (!note || note.trim().length < 5) {
                        toast.error("Please provide a rejection reason (min 5 chars)");
                        throw new Error("Note required");
                      }
                      setProcessingIds(prev => new Set([...prev, req.id]));
                      try {
                        await rejectBalanceRequest(req.id, note);
                        toast.success("Request rejected");
                        refetch();
                      } catch (e) {
                        setProcessingIds(prev => { const s = new Set(prev); s.delete(req.id); return s; });
                        throw e;
                      }
                    }}>
                    <button className="flex-1 inline-flex justify-center items-center gap-1.5 px-3 py-2.5 border border-red-200 bg-red-50 text-red-600 text-sm rounded-xl hover:bg-red-100 font-bold font-manrope transition-all active:scale-[0.98]">
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </ConfirmDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!loading && requests.filter(r => !processingIds.has(r.id)).length === 0 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-[#E8F1EE] mx-auto flex items-center justify-center mb-4">
            <CheckCircle className="w-7 h-7 text-primary" />
          </div>
          <p className="text-on-surface-variant text-sm font-manrope font-semibold">No pending requests — all clear!</p>
        </div>
      )}
    </div>
  );
}

function HistoryTab({
  requests,
  loading,
  usersMap,
}: {
  requests: BalanceRequest[];
  loading: boolean;
  usersMap: Record<string, { displayName: string; phone: string }>;
}) {
  return (
    <div className="space-y-6">
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-[220px] bg-white border border-black/5 rounded-2xl p-6 animate-pulse premium-shadow" />
          ))}
        </div>
      )}
      
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {requests.map((req) => {
            const user = usersMap[req.userId];
            return (
              <div key={req.id} className="bg-white border border-black/5 rounded-2xl p-6 flex flex-col premium-shadow card-hover transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-[#134235] font-manrope text-lg truncate">{user?.displayName || "Unknown User"}</p>
                    <p className="font-mono text-xs text-on-surface-variant mt-0.5 truncate">{user?.phone || req.userId.slice(0, 8)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-[#134235] text-xl font-inter"><WalletAmount amount={req.amount} /></div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mt-1">{req.medium || "—"}</div>
                  </div>
                </div>
                
                <div className="space-y-3 flex-1 text-sm">
                  <div className="flex justify-between items-center border-b border-black/[0.03] pb-2">
                    <span className="text-on-surface-variant">Status</span>
                    <StatusBadge status={req.status} />
                  </div>
                  <div className="flex justify-between border-b border-black/[0.03] pb-2">
                    <span className="text-on-surface-variant">Processed</span>
                    <span className="font-medium text-on-surface text-xs">{relativeTime(req.processedAt)}</span>
                  </div>
                  <div className="flex flex-col gap-1 pt-1">
                    <span className="text-on-surface-variant text-xs">Admin Note</span>
                    <span className="font-medium text-on-surface text-xs leading-relaxed bg-surface-container/30 p-2 rounded-xl border border-black/[0.02] break-words line-clamp-3">{req.adminNote || "No note provided"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!loading && requests.length === 0 && (
        <p className="text-center text-on-surface-variant py-16 text-sm font-manrope">No processed requests</p>
      )}
    </div>
  );
}

export default function BalanceRequestsPage() {
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [usersMap, setUsersMap] = useState<Record<string, { displayName: string; phone: string }>>({});

  const {
    requests: pendingRequests,
    loading: pendingLoading,
    refetch: refetchPending,
  } = useBalanceRequests("pending");

  const {
    requests: historyRequests,
    loading: historyLoading,
    refetch: refetchHistory,
  } = useBalanceRequests("processed");

  const refetchBoth = useCallback(() => {
    refetchPending();
    refetchHistory();
  }, [refetchPending, refetchHistory]);

  useEffect(() => {
    let mounted = true;
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        if (!mounted || !data.users) return;
        const map: Record<string, { displayName: string; phone: string }> = {};
        data.users.forEach((u: { uid?: string; _id?: string; displayName: string; phoneNumber: string }) => {
          map[u.uid || u._id || ""] = { displayName: u.displayName, phone: u.phoneNumber };
        });
        setUsersMap(map);
      })
      .catch(console.error);
    return () => { mounted = false; };
  }, []);

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-8 pb-12">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">Balance Requests</h1>
          <p className="text-on-surface-variant font-body text-lg">Review and approve user top-up requests.</p>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-container p-1 rounded-xl w-fit">
        {([
          { key: "pending", label: "Pending", icon: Clock },
          { key: "history", label: "History", icon: History },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold font-manrope transition-all ${
              tab === key
                ? "bg-white text-[#134235] shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "pending" ? (
        <PendingTab
          requests={pendingRequests}
          loading={pendingLoading}
          refetch={refetchBoth}
          usersMap={usersMap}
        />
      ) : (
        <HistoryTab
          requests={historyRequests}
          loading={historyLoading}
          usersMap={usersMap}
        />
      )}
    </div>
  );
}
