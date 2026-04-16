"use client";
import { useState } from "react";
import { useExecutionQueue } from "@/lib/hooks/admin/useExecutionQueue";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { WalletAmount } from "@/components/admin/WalletAmount";
import { relativeTime, maskNumber } from "@/lib/utils";
import { JobStatus } from "@/types";
import Link from "next/link";
import { ListOrdered, ArrowRight } from "lucide-react";

const STATUS_TABS: { key: JobStatus | "all"; label: string; dotColor: string }[] = [
  { key: "all",        label: "All",        dotColor: "bg-outline-variant" },
  { key: "queued",     label: "Queued",     dotColor: "bg-outline-variant" },
  { key: "processing", label: "Processing", dotColor: "bg-blue-500" },
  { key: "done",       label: "Done",       dotColor: "bg-primary" },
  { key: "failed",     label: "Failed",     dotColor: "bg-red-500" },
];

export default function QueuePage() {
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const { jobs, loading } = useExecutionQueue({ status: statusFilter });

  const counts = STATUS_TABS.map((s) => ({
    ...s,
    count: s.key === "all" ? jobs.length : jobs.filter((j) => j.status === s.key).length,
  }));

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">Execution Queue</h1>
          <p className="text-on-surface-variant font-body text-lg">Monitor and manage USSD job processing.</p>
        </div>
      </section>

      {/* Status filter tabs */}
      <div className="flex gap-1 bg-surface-container p-1 rounded-xl w-fit flex-wrap">
        {counts.map((c) => (
          <button key={c.key} onClick={() => setStatusFilter(c.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold font-manrope transition-all ${
              statusFilter === c.key
                ? "bg-white text-[#134235] shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dotColor}`} />
            {c.label}
            <span className={`${statusFilter === c.key ? "text-primary" : "text-on-surface-variant"}`}>
              {c.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow">
        <div className="px-8 py-5 border-b border-black/[0.03] flex items-center justify-between">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <ListOrdered className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest font-manrope">Queue</span>
          </div>
          <span className="text-xs font-bold font-manrope text-on-surface-variant">
            {loading ? "..." : `${jobs.length} job${jobs.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] font-extrabold text-on-surface-variant/60 uppercase tracking-[0.2em] bg-surface-container/30 font-manrope">
                <th className="px-8 py-4">Job ID</th>
                <th className="px-8 py-4">Service</th>
                <th className="px-8 py-4">Recipient</th>
                <th className="px-8 py-4">Amount</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Device</th>
                <th className="px-8 py-4">Created</th>
                <th className="px-8 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {loading && Array(5).fill(0).map((_, i) => (
                <tr key={i}><td colSpan={8} className="px-8 py-4">
                  <div className="h-4 bg-surface-container rounded-lg animate-pulse" />
                </td></tr>
              ))}
              {!loading && jobs.map((job) => (
                <tr key={job.jobId} className="group hover:bg-surface-container/20 transition-colors">
                  <td className="px-8 py-5 font-mono text-xs text-on-surface-variant">{job.jobId.slice(0, 10)}…</td>
                  <td className="px-8 py-5">
                    <span className="text-[10px] font-bold uppercase tracking-wider font-manrope text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-full">
                      {job.serviceId?.slice(0, 8) || "—"}
                    </span>
                  </td>
                  <td className="px-8 py-5 font-mono text-on-surface text-sm">{maskNumber(job.recipientNumber)}</td>
                  <td className="px-8 py-5 font-bold text-[#134235] font-inter"><WalletAmount amount={job.amount} /></td>
                  <td className="px-8 py-5"><StatusBadge status={job.status} /></td>
                  <td className="px-8 py-5 text-on-surface-variant text-xs">{job.lockedByDevice ?? "—"}</td>
                  <td className="px-8 py-5 text-on-surface-variant text-xs">{relativeTime(job.createdAt)}</td>
                  <td className="px-8 py-5">
                    <Link href={`/admin/queue/${job.jobId}`}
                      className="inline-flex items-center gap-1 text-primary text-xs font-bold font-manrope hover:underline">
                      View <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && jobs.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-surface-container mx-auto flex items-center justify-center mb-4">
              <ListOrdered className="w-7 h-7 text-on-surface-variant" />
            </div>
            <p className="text-on-surface-variant text-sm font-manrope font-semibold">No jobs found</p>
          </div>
        )}
      </div>
    </div>
  );
}
