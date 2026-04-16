"use client";
import { useState, useEffect } from "react";
import { useBalanceRequests } from "@/lib/hooks/admin/useBalanceRequests";
import { WalletAmount } from "@/components/admin/WalletAmount";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { approveBalanceRequest, rejectBalanceRequest } from "@/lib/functions";
import { relativeTime } from "@/lib/utils";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, History } from "lucide-react";

function PendingTab({ usersMap }: { usersMap: Record<string, any> }) {
  const { requests, loading } = useBalanceRequests("pending");
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  return (
    <div className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-[11px] font-extrabold text-on-surface-variant/60 uppercase tracking-[0.2em] bg-surface-container/30 font-manrope">
              <th className="px-8 py-4">User</th>
              <th className="px-8 py-4">Amount</th>
              <th className="px-8 py-4">Medium</th>
              <th className="px-8 py-4">Note</th>
              <th className="px-8 py-4">Requested</th>
              <th className="px-8 py-4">Admin Note</th>
              <th className="px-8 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.03]">
            {loading && Array(3).fill(0).map((_, i) => (
              <tr key={i}><td colSpan={7} className="px-8 py-4">
                <div className="h-4 bg-surface-container rounded-lg animate-pulse" />
              </td></tr>
            ))}
            {!loading && requests.map((req) => {
              const user = usersMap[req.userId];
              return (
                <tr key={req.id} className="group hover:bg-surface-container/20 transition-colors align-top">
                  <td className="px-8 py-5">
                    <p className="font-bold text-on-surface font-manrope">{user?.displayName || "Unknown User"}</p>
                    <p className="font-mono text-[11px] text-on-surface-variant mt-0.5">{user?.phone || req.userId.slice(0, 8)}</p>
                  </td>
                  <td className="px-8 py-5 font-bold text-[#134235] font-inter"><WalletAmount amount={req.amount} /></td>
                  <td className="px-8 py-5 text-on-surface-variant text-xs font-bold uppercase tracking-wider font-manrope">{req.medium || "—"}</td>
                  <td className="px-8 py-5 text-on-surface-variant max-w-[160px] truncate">{req.note || "—"}</td>
                  <td className="px-8 py-5 text-on-surface-variant text-xs">{relativeTime(req.createdAt)}</td>
                  <td className="px-8 py-5">
                    <input type="text" placeholder="Note (required for reject)"
                      value={adminNotes[req.id] || ""}
                      onChange={(e) => setAdminNotes((n) => ({ ...n, [req.id]: e.target.value }))}
                      className="w-full border border-outline-variant bg-surface rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[180px]" />
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex gap-2">
                      <ConfirmDialog title="Approve balance request?"
                        description={`This will add ৳ ${req.amount.toFixed(2)} to the user's wallet.`}
                        confirmLabel="Approve"
                        onConfirm={async () => {
                          await approveBalanceRequest(req.id, adminNotes[req.id]);
                          toast.success(`৳ ${req.amount.toFixed(2)} added to wallet`);
                        }}>
                        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary text-xs rounded-xl hover:opacity-90 font-bold font-manrope shadow-sm">
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
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
                          await rejectBalanceRequest(req.id, note);
                          toast.success("Request rejected");
                        }}>
                        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-xs rounded-xl hover:bg-red-50 font-bold font-manrope">
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </ConfirmDialog>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!loading && requests.length === 0 && (
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

function HistoryTab({ usersMap }: { usersMap: Record<string, any> }) {
  const { requests, loading } = useBalanceRequests("processed");
  return (
    <div className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-[11px] font-extrabold text-on-surface-variant/60 uppercase tracking-[0.2em] bg-surface-container/30 font-manrope">
              <th className="px-8 py-4">User</th>
              <th className="px-8 py-4">Amount</th>
              <th className="px-8 py-4">Medium</th>
              <th className="px-8 py-4">Status</th>
              <th className="px-8 py-4">Admin Note</th>
              <th className="px-8 py-4">Processed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.03]">
            {loading && Array(3).fill(0).map((_, i) => (
              <tr key={i}><td colSpan={6} className="px-8 py-4">
                <div className="h-4 bg-surface-container rounded-lg animate-pulse" />
              </td></tr>
            ))}
            {!loading && requests.map((req) => {
              const user = usersMap[req.userId];
              return (
                <tr key={req.id} className="group hover:bg-surface-container/20 transition-colors">
                  <td className="px-8 py-5">
                    <p className="font-bold text-on-surface font-manrope">{user?.displayName || "Unknown User"}</p>
                    <p className="font-mono text-[11px] text-on-surface-variant">{user?.phone || req.userId.slice(0, 8)}</p>
                  </td>
                  <td className="px-8 py-5 font-bold text-[#134235] font-inter"><WalletAmount amount={req.amount} /></td>
                  <td className="px-8 py-5 text-on-surface-variant text-xs font-bold uppercase tracking-wider font-manrope">{req.medium || "—"}</td>
                  <td className="px-8 py-5"><StatusBadge status={req.status} /></td>
                  <td className="px-8 py-5 text-on-surface-variant max-w-[200px] truncate text-xs">{req.adminNote || "—"}</td>
                  <td className="px-8 py-5 text-on-surface-variant text-xs">{relativeTime(req.processedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!loading && requests.length === 0 && (
        <p className="text-center text-on-surface-variant py-16 text-sm font-manrope">No processed requests</p>
      )}
    </div>
  );
}

export default function BalanceRequestsPage() {
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [usersMap, setUsersMap] = useState<Record<string, { displayName: string, phone: string }>>({});

  useEffect(() => {
    let mounted = true;
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        if (!mounted || !data.users) return;
        const map: Record<string, { displayName: string, phone: string }> = {};
        data.users.forEach((u: any) => {
          map[u.uid || u._id] = { displayName: u.displayName, phone: u.phoneNumber };
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

      {tab === "pending" ? <PendingTab usersMap={usersMap} /> : <HistoryTab usersMap={usersMap} />}
    </div>
  );
}
