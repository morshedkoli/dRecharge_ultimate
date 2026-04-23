"use client";
import { useState, useEffect, useRef } from "react";
import { useExecutionQueue } from "@/lib/hooks/admin/useExecutionQueue";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { WalletAmount } from "@/components/admin/WalletAmount";
import { relativeTime } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import { ExecutionJob, JobStatus } from "@/types";
import {
  ArrowRight, RefreshCw, History, Wifi, WifiOff,
  Clock, Activity, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";

const REFRESH_INTERVAL = 8000; // 8 seconds

// ── Live indicator dot ────────────────────────────────────────────────────────
function LiveDot({ active }: { active: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {active && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${active ? "bg-emerald-500" : "bg-outline-variant"}`} />
    </span>
  );
}

// ── Queue job card ─────────────────────────────────────────────────────────────
function QueueCard({ job, refetch }: { job: ExecutionJob; refetch: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [resending, setResending] = useState(false);

  const statusConfig: Record<string, { bg: string; border: string; dot: string }> = {
    queued:     { bg: "bg-slate-50",   border: "border-slate-200",  dot: "bg-slate-400" },
    processing: { bg: "bg-blue-50",    border: "border-blue-200",   dot: "bg-blue-500" },
    waiting:    { bg: "bg-amber-50",   border: "border-amber-200",  dot: "bg-amber-500" },
  };
  const sc = statusConfig[job.status] ?? statusConfig.queued;

  async function handleResend(e: React.MouseEvent) {
    e.stopPropagation();
    setResending(true);
    try {
      const res = await fetch(`/api/admin/history/${job.jobId}/resend`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend");
      toast.success("Job resent to queue");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to resend");
    } finally {
      setResending(false);
    }
  }

  return (
    <div
      className={`border ${sc.border} ${sc.bg} rounded-2xl p-5 cursor-pointer hover:shadow-md transition-all group`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left */}
        <div className="flex items-center gap-4">
          {job.serviceIcon ? (
            <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-white border border-black/5 flex items-center justify-center p-1.5">
              <img src={job.serviceIcon} alt={job.serviceName || "Service"} className="w-full h-full object-contain rounded-lg" />
            </div>
          ) : (
            <div className="w-11 h-11 rounded-xl flex-shrink-0 bg-white flex items-center justify-center border border-black/5">
              <span className="text-sm font-bold text-on-surface-variant uppercase">
                {job.serviceName?.charAt(0) || job.serviceId?.charAt(0) || "?"}
              </span>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-on-surface font-mono text-base tracking-tight">{job.recipientNumber || "—"}</p>
              <StatusBadge status={job.status} />
            </div>
            <p className="text-[11px] font-manrope text-on-surface-variant mt-0.5 font-bold uppercase tracking-wider">
              {job.serviceName || job.serviceId}
            </p>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-6 pl-14 sm:pl-0">
          <div className="text-right">
            <p className="font-bold text-[#134235] font-inter text-base">
              <WalletAmount amount={job.amount} />
            </p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-manrope mt-1">
              {relativeTime(job.createdAt)}
            </p>
          </div>
          {job.status === "waiting" && (
            <button
              onClick={handleResend}
              disabled={resending}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-100 text-amber-700 text-xs font-bold font-manrope rounded-xl hover:bg-amber-200 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${resending ? "animate-spin" : ""}`} />
              {resending ? "..." : "Resend"}
            </button>
          )}
          <div className="w-5 flex justify-center text-on-surface-variant/40 group-hover:text-primary transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-black/[0.05] grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/60 p-3 rounded-xl cursor-default" onClick={e => e.stopPropagation()}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-1">Device</p>
            <p className="text-xs font-semibold text-on-surface">{job.lockedByDevice ?? "Unassigned"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-1">SIM Slot</p>
            <p className="text-xs font-semibold text-on-surface">SIM {job.simSlot ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-1">Attempt</p>
            <p className="text-xs font-semibold text-on-surface">#{job.attempt ?? 0}</p>
          </div>
          <div className="flex items-end justify-end">
            <Link
              href={`/admin/history/${job.jobId ?? ""}`}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold font-manrope rounded-xl hover:bg-primary hover:text-white transition-all"
              onClick={e => e.stopPropagation()}
            >
              Details <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Countdown bar ─────────────────────────────────────────────────────────────
function RefreshCountdown({ intervalMs, lastRefresh }: { intervalMs: number; lastRefresh: number }) {
  const [pct, setPct] = useState(100);

  useEffect(() => {
    const tick = setInterval(() => {
      const elapsed = Date.now() - lastRefresh;
      setPct(Math.max(0, 100 - (elapsed / intervalMs) * 100));
    }, 100);
    return () => clearInterval(tick);
  }, [intervalMs, lastRefresh]);

  return (
    <div className="h-0.5 w-full bg-outline-variant/20 rounded-full overflow-hidden">
      <div
        className="h-full bg-primary/40 transition-none rounded-full"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const QUEUE_STATUSES: (JobStatus | "all")[] = ["queued", "processing", "waiting"];

export default function QueuePage() {
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const { jobs, stats, loading, refetch } = useExecutionQueue({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 50,
  });

  // ── Auto-refresh every 8 s ──────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      refetch();
      setLastRefresh(Date.now());
    }, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [refetch]);

  function handleManualRefresh() {
    refetch();
    setLastRefresh(Date.now());
  }

  // Filter to only active statuses
  const activeJobs = jobs.filter(j =>
    !!j.jobId && (QUEUE_STATUSES as string[]).includes(j.status)
  );

  const queuedCount    = stats?.queued?.count    ?? 0;
  const processingCount = stats?.processing?.count ?? 0;
  const waitingCount   = stats?.waiting?.count    ?? 0;
  const totalActive    = queuedCount + processingCount + waitingCount;

  const tabs = [
    { key: "all" as const,        label: "All Active", count: totalActive,       dot: "bg-primary" },
    { key: "queued" as const,     label: "Pending",    count: queuedCount,       dot: "bg-slate-400" },
    { key: "processing" as const, label: "Processing", count: processingCount,   dot: "bg-blue-500" },
    { key: "waiting" as const,    label: "Waiting",    count: waitingCount,      dot: "bg-amber-500" },
  ];

  return (
    <div className="p-6 sm:p-10 max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">Live Queue</h1>
            <LiveDot active={!loading} />
          </div>
          <p className="text-on-surface-variant font-body text-lg">Auto-refreshes every 8 seconds.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-outline-variant text-on-surface-variant text-xs font-bold font-manrope rounded-xl hover:bg-surface-container transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Now
          </button>
          <Link
            href="/admin/history"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-outline-variant text-on-surface-variant text-xs font-bold font-manrope rounded-xl hover:bg-surface-container transition-all"
          >
            <History className="w-3.5 h-3.5" />
            Full History
          </Link>
        </div>
      </section>

      {/* Refresh progress bar */}
      <RefreshCountdown intervalMs={REFRESH_INTERVAL} lastRefresh={lastRefresh} />

      {/* Stat chips */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-black/5 rounded-xl premium-shadow">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold font-manrope text-on-surface">{totalActive} active</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl">
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          <span className="text-xs font-bold font-manrope text-blue-700">{processingCount} processing</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
          <Clock className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold font-manrope text-amber-700">{waitingCount} waiting</span>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 bg-surface-container p-1 rounded-xl w-fit flex-wrap">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold font-manrope transition-all ${
              statusFilter === t.key
                ? "bg-white text-[#134235] shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
            {t.label}
            <span className={statusFilter === t.key ? "text-primary" : "text-on-surface-variant"}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Job list */}
      <div className="flex flex-col gap-4">
        {loading && activeJobs.length === 0 && Array(3).fill(0).map((_, i) => (
          <div key={i} className="h-20 bg-surface-container/50 rounded-2xl animate-pulse border border-black/5" />
        ))}

        {!loading && activeJobs.length === 0 && (
          <div className="text-center py-20 bg-white border border-black/5 rounded-2xl premium-shadow">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 mx-auto flex items-center justify-center mb-4">
              <Wifi className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="text-on-surface font-headline font-bold text-lg mb-1">Queue is clear</p>
            <p className="text-on-surface-variant text-sm font-manrope">No active jobs right now.</p>
          </div>
        )}

        {activeJobs.map(job => (
          <QueueCard key={job.jobId} job={job} refetch={handleManualRefresh} />
        ))}
      </div>
    </div>
  );
}
