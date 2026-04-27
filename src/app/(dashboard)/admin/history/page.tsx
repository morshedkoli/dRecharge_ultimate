"use client";
import { useState, useEffect } from "react";
import { useModalEffect } from "@/lib/hooks/useModalEffect";
import { useExecutionQueue } from "@/lib/hooks/admin/useExecutionQueue";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { WalletAmount } from "@/components/admin/WalletAmount";
import { relativeTime } from "@/lib/utils";
import { JobStatus } from "@/types";
import Link from "next/link";
import { ListOrdered, ArrowRight, ListChecks } from "lucide-react";

import { toast } from "sonner";
import { ExecutionJob } from "@/types";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Clock, Activity, RefreshCw, CheckCheck, X, Undo2 } from "lucide-react";

function StatCard({ title, value, amount, icon: Icon, bg, text, border }: any) {
  return (
    <div className={`p-5 rounded-2xl border ${bg} ${border} flex items-center justify-between premium-shadow`}>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-1">{title}</p>
        <p className={`text-2xl font-extrabold font-headline ${text}`}>{value}</p>
        {amount !== undefined && (
          <p className="text-xs font-bold font-manrope text-on-surface-variant mt-1 opacity-80">
            ৳ {amount.toLocaleString()}
          </p>
        )}
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white/50 border ${border}`}>
        <Icon className={`w-6 h-6 ${text}`} />
      </div>
    </div>
  );
}

// ── Modern Confirm Dialog ─────────────────────────────────────────────────────
type ConfirmVariant = "amber" | "emerald" | "red";
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: ConfirmVariant;
  icon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

const variantStyles: Record<ConfirmVariant, { icon: string; btn: string; ring: string }> = {
  amber:   { icon: "bg-amber-100 text-amber-600",   btn: "bg-amber-500 hover:bg-amber-600 shadow-amber-200",   ring: "ring-amber-200" },
  emerald: { icon: "bg-emerald-100 text-emerald-600", btn: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200", ring: "ring-emerald-200" },
  red:     { icon: "bg-red-100 text-red-600",     btn: "bg-red-500 hover:bg-red-600 shadow-red-200",     ring: "ring-red-200" },
};

function ConfirmDialog({ open, title, description, confirmLabel, variant = "amber", icon, onConfirm, onCancel }: ConfirmDialogProps) {
  const containerRef = useModalEffect(open);
  if (!open) return null;
  const s = variantStyles[variant];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)" }}
      onClick={onCancel}
    >
      <div
        ref={containerRef}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 flex flex-col gap-5 animate-scale-in"
        style={{ boxShadow: "0 8px 48px rgba(0,0,0,0.18)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Icon + close */}
        <div className="flex items-start justify-between">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${s.icon}`}>
            {icon}
          </div>
          <button onClick={onCancel} className="w-8 h-8 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Text */}
        <div>
          <h3 className="font-headline text-lg font-extrabold text-on-surface mb-1">{title}</h3>
          <p className="text-sm font-manrope text-on-surface-variant leading-relaxed">{description}</p>
        </div>
        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold font-manrope border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold font-manrope text-white shadow-md transition-all ${s.btn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Complete Job Form Dialog ───────────────────────────────────────────────────
interface CompleteFormData {
  txRef: string;
  transactionNumber: string;
  senderNumber: string;
  note: string;
}

function CompleteJobDialog({
  open,
  job,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  job: ExecutionJob;
  onConfirm: (data: CompleteFormData) => void;
  onCancel: () => void;
}) {
  const containerRef = useModalEffect(open);
  const [form, setForm] = useState<CompleteFormData>({
    txRef: "",
    transactionNumber: "",
    senderNumber: "",
    note: "",
  });

  if (!open) return null;

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.40)", backdropFilter: "blur(8px)" }}
      onClick={onCancel}
    >
      <div
        ref={containerRef}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
        style={{ boxShadow: "0 12px 56px rgba(0,0,0,0.20)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-emerald-50 border-b border-emerald-100 px-7 pt-7 pb-5 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-headline text-lg font-extrabold text-on-surface">Complete Job</h3>
              <p className="text-xs font-manrope text-on-surface-variant mt-0.5">Fill in the completion details below</p>
            </div>
          </div>
          <button onClick={onCancel} className="w-8 h-8 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-emerald-100 transition-colors mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Job summary strip */}
        <div className="px-7 py-4 bg-surface-container/30 border-b border-black/5 flex items-center gap-3">
          <div className="text-xs font-manrope text-on-surface-variant">
            <span className="font-bold text-on-surface font-mono">{job.recipientNumber}</span>
            <span className="mx-2 opacity-40">·</span>
            <span>{job.serviceName || job.serviceId}</span>
            <span className="mx-2 opacity-40">·</span>
            <span className="font-bold text-[#134235]">৳ {job.amount?.toLocaleString()}</span>
          </div>
        </div>

        {/* Form */}
        <div className="px-7 py-6 space-y-5">
          {/* Transaction Number */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">
              Transaction Number <span className="text-red-500">*</span>
            </label>
            <input
              name="transactionNumber"
              value={form.transactionNumber}
              onChange={handleChange}
              placeholder="e.g. TXN123456789"
              className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container/30 text-sm font-mono text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-all"
            />
          </div>

          {/* Sender Number */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">
              Sender Number <span className="text-red-500">*</span>
            </label>
            <input
              name="senderNumber"
              value={form.senderNumber}
              onChange={handleChange}
              placeholder="e.g. 01XXXXXXXXX"
              className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container/30 text-sm font-mono text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-all"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">
              Admin Note <span className="text-on-surface-variant/50 normal-case tracking-normal font-normal">(optional)</span>
            </label>
            <textarea
              name="note"
              value={form.note}
              onChange={handleChange}
              rows={2}
              placeholder="e.g. Verified via agent SMS..."
              className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container/30 text-sm font-manrope text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-all resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-7 pb-7 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl text-sm font-bold font-manrope border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!form.transactionNumber.trim() || !form.senderNumber.trim()) return;
              onConfirm(form);
            }}
            disabled={!form.transactionNumber.trim() || !form.senderNumber.trim()}
            className="flex-1 py-3 rounded-xl text-sm font-bold font-manrope text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Mark as Complete
          </button>
        </div>
      </div>
    </div>
  );
}
function JobCard({ 
  job, 
  refetch, 
  isSelected, 
  onToggleSelect, 
  selectable 
}: { 
  job: ExecutionJob; 
  refetch: () => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string, checked: boolean) => void;
  selectable?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [resending, setResending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [dialog, setDialog] = useState<null | "resend" | "complete" | "refund">(null);

  async function doResend() {
    setDialog(null);
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

  async function doComplete(formData?: CompleteFormData) {
    setDialog(null);
    setCompleting(true);
    try {
      const res = await fetch(`/api/admin/history/${job.jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txId: job.txId,
          isSuccess: true,
          txRef: formData?.transactionNumber || undefined,
          senderNumber: formData?.senderNumber || undefined,
          note: formData?.note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to complete job");
      toast.success("Job marked as completed");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to complete job");
    } finally {
      setCompleting(false);
    }
  }

  async function doRefund() {
    setDialog(null);
    setRefunding(true);
    try {
      const res = await fetch(`/api/admin/history/${job.jobId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Admin refund" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to refund job");
      toast.success("Job cancelled and amount refunded to user");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to refund");
    } finally {
      setRefunding(false);
    }
  }

  return (
    <>
    <ConfirmDialog
      open={dialog === "resend"}
      title="Resend Job?"
      description="This will push the job back to the processing queue. The user's wallet will remain locked until it completes."
      confirmLabel="Yes, Resend"
      variant="amber"
      icon={<RefreshCw className="w-5 h-5" />}
      onConfirm={doResend}
      onCancel={() => setDialog(null)}
    />
    <ConfirmDialog
      open={dialog === "refund"}
      title="Refund & Cancel Job?"
      description={`This will cancel the job and refund ৳${job.amount?.toLocaleString()} back to the user's wallet immediately. This cannot be undone.`}
      confirmLabel="Yes, Refund"
      variant="red"
      icon={<Undo2 className="w-5 h-5" />}
      onConfirm={doRefund}
      onCancel={() => setDialog(null)}
    />
    <CompleteJobDialog
      open={dialog === "complete"}
      job={job}
      onConfirm={(formData) => doComplete(formData)}
      onCancel={() => setDialog(null)}
    />
    <div 
      className={`bg-white border ${isSelected ? 'border-primary shadow-md shadow-primary/10' : 'border-black/5'} rounded-2xl p-5 premium-shadow cursor-pointer hover:border-primary/30 hover:shadow-lg transition-all group`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Logo, Service Name, Recipient */}
        <div className="flex items-center gap-4">
          {selectable && (
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <input 
                type="checkbox" 
                checked={isSelected || false}
                onChange={(e) => onToggleSelect && onToggleSelect(job.jobId!, e.target.checked)}
                className="w-5 h-5 rounded-md border-outline-variant text-primary focus:ring-primary/20 transition-all cursor-pointer"
              />
            </div>
          )}
          {job.serviceIcon ? (
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-surface-container/50 border border-black/5 flex items-center justify-center p-1.5">
              <img src={job.serviceIcon} alt={job.serviceName || "Service"} className="w-full h-full object-contain rounded-lg" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl flex-shrink-0 bg-surface-container flex items-center justify-center border border-black/5">
              <span className="text-base font-bold text-on-surface-variant uppercase">
                {job.serviceName?.charAt(0) || job.serviceId?.charAt(0) || "?"}
              </span>
            </div>
          )}
          
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-on-surface font-mono text-lg tracking-tight">
                {job.recipientNumber || "—"}
              </p>
              <StatusBadge status={job.status} />
            </div>
            <p className="text-[11px] font-manrope text-on-surface-variant mt-0.5 font-bold uppercase tracking-wider">
              {job.serviceName || job.serviceId}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-2 sm:mt-0 pl-16 sm:pl-0">
          {/* Middle: Agent TXID (if done) */}
          {job.status === "done" && job.parsedResult?.txRef && (
            <div className="hidden md:block mr-4 text-right sm:text-left">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 font-manrope">Agent TXID</p>
              <p className="font-mono text-[11px] text-on-surface bg-surface-container/50 px-2 py-1 rounded border border-black/5">
                {job.parsedResult.txRef}
              </p>
            </div>
          )}

          {/* Right: Amount and Expand */}
          <div className="text-right">
            <p className="font-bold text-[#134235] font-inter text-base">
              <WalletAmount amount={job.amount} />
            </p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-manrope mt-1.5">
              {relativeTime(job.createdAt)}
            </p>
          </div>
          <div className="w-6 flex justify-center text-on-surface-variant/40 group-hover:text-primary transition-colors">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-5 pt-5 border-t border-black/[0.04] animate-fade-in space-y-4 cursor-default" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#F4F6F5]/50 p-4 rounded-xl border border-black/[0.02]">
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 font-manrope">Full Job ID</p>
              <p className="font-mono text-xs text-on-surface bg-white px-2 py-1 rounded-md border border-black/5 truncate" title={job.jobId}>{job.jobId}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 font-manrope">Recipient</p>
              <p className="font-mono text-sm font-bold text-primary">{job.recipientNumber || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 font-manrope">Device / App</p>
              <p className="text-xs font-semibold text-on-surface">{job.lockedByDevice ?? "Unassigned"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 font-manrope">SIM Slot</p>
              <p className="text-xs font-semibold text-on-surface">SIM {job.simSlot}</p>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-2 flex-wrap">
            {job.status === "waiting" && (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); setDialog("complete"); }}
                  disabled={completing || resending || refunding}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-100 text-emerald-700 text-xs font-bold font-manrope rounded-xl hover:bg-emerald-200 transition-all disabled:opacity-50"
                >
                  <CheckCheck className={`w-3.5 h-3.5 ${completing ? "animate-pulse" : ""}`} />
                  {completing ? "Completing..." : "Complete Job"}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setDialog("resend"); }}
                  disabled={resending || completing || refunding}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-100 text-amber-700 text-xs font-bold font-manrope rounded-xl hover:bg-amber-200 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} /> 
                  {resending ? "Resending..." : "Resend Job"}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setDialog("refund"); }}
                  disabled={refunding || completing || resending}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-100 text-red-700 text-xs font-bold font-manrope rounded-xl hover:bg-red-200 transition-all disabled:opacity-50"
                >
                  <Undo2 className={`w-3.5 h-3.5 ${refunding ? "animate-spin" : ""}`} /> 
                  {refunding ? "Refunding..." : "Refund & Cancel"}
                </button>
              </>
            )}
            <Link href={`/admin/history/${job.jobId ?? ""}`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary/10 text-primary text-xs font-bold font-manrope rounded-xl hover:bg-primary hover:text-white transition-all">
              View Full Details <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

const STATUS_TABS: { key: JobStatus | "all"; label: string; dotColor: string }[] = [
  { key: "all",        label: "All",        dotColor: "bg-outline-variant" },
  { key: "queued",     label: "Pending",     dotColor: "bg-outline-variant" },
  { key: "processing", label: "Processing", dotColor: "bg-blue-500" },
  { key: "waiting",    label: "Waiting",    dotColor: "bg-amber-500" },
  { key: "done",       label: "Completed",       dotColor: "bg-primary" },
  { key: "failed",     label: "Refund",     dotColor: "bg-red-500" },
];

export default function HistoryPage() {
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [resendingBulk, setResendingBulk] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [refundingBulk, setRefundingBulk] = useState(false);
  const [showBulkRefundDialog, setShowBulkRefundDialog] = useState(false);

  const { jobs, pagination, stats, loading, refetch } = useExecutionQueue({ 
    status: statusFilter,
    page,
    limit: 20
  });

  // ── No auto-refresh: manual only ──────────────────────────────────────────

  // Reset page and selection when filter changes
  useEffect(() => {
    setPage(1);
    setSelectedJobs(new Set());
  }, [statusFilter]);

  function handleToggleSelect(jobId: string, checked: boolean) {
    setSelectedJobs(prev => {
      const next = new Set(prev);
      if (checked) next.add(jobId);
      else next.delete(jobId);
      return next;
    });
  }

  function handleSelectAll() {
    if (selectedJobs.size === validJobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(validJobs.filter(j => j.status === "waiting" && j.jobId).map(j => j.jobId!)));
    }
  }

  async function handleBulkResend() {
    if (!selectedJobs.size) return;
    setResendingBulk(true);
    try {
      const res = await fetch(`/api/admin/history/resend-bulk`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds: Array.from(selectedJobs) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend jobs");
      
      toast.success(`Successfully resent ${selectedJobs.size} jobs to queue`);
      setSelectedJobs(new Set());
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to resend jobs");
    } finally {
      setResendingBulk(false);
    }
  }

  async function handleBulkRefund() {
    if (!selectedJobs.size) return;
    setRefundingBulk(true);
    try {
      const res = await fetch(`/api/admin/history/refund-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds: Array.from(selectedJobs) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to refund jobs");
      toast.success(`Refunded ${data.refundedCount ?? selectedJobs.size} job(s) — amounts returned to users`);
      setSelectedJobs(new Set());
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to refund jobs");
    } finally {
      setRefundingBulk(false);
    }
  }

  const counts = STATUS_TABS.map((s) => ({
    ...s,
    count: stats?.[s.key]?.count || 0,
  }));

  const validJobs = jobs.filter((j) => !!j.jobId);
  const waitingJobsCount = validJobs.filter(j => j.status === "waiting").length;

  return (
    <>
    <ConfirmDialog
      open={showBulkDialog}
      title={`Resend ${selectedJobs.size} Job${selectedJobs.size > 1 ? "s" : ""}?`}
      description={`This will push ${selectedJobs.size} waiting job${selectedJobs.size > 1 ? "s" : ""} back to the processing queue. Users' wallet locks will remain active until each job completes.`}
      confirmLabel="Yes, Resend All"
      variant="amber"
      icon={<RefreshCw className="w-5 h-5" />}
      onConfirm={() => { setShowBulkDialog(false); handleBulkResend(); }}
      onCancel={() => setShowBulkDialog(false)}
    />
    <ConfirmDialog
      open={showBulkRefundDialog}
      title={`Refund ${selectedJobs.size} Job${selectedJobs.size > 1 ? "s" : ""}?`}
      description={`This will cancel ${selectedJobs.size} waiting job${selectedJobs.size > 1 ? "s" : ""} and refund each user's amount back to their wallet immediately. This cannot be undone.`}
      confirmLabel="Yes, Refund All"
      variant="red"
      icon={<Undo2 className="w-5 h-5" />}
      onConfirm={() => { setShowBulkRefundDialog(false); handleBulkRefund(); }}
      onCancel={() => setShowBulkRefundDialog(false)}
    />
    <div className="p-6 sm:p-10 max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">History</h1>
          <p className="text-on-surface-variant font-body text-lg">Full job log — refresh manually when needed.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refetch}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-outline-variant text-on-surface-variant text-xs font-bold font-manrope rounded-xl hover:bg-surface-container transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <Link
            href="/admin/queue"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-xs font-bold font-manrope rounded-xl hover:opacity-90 transition-all shadow-sm shadow-primary/20"
          >
            <ListChecks className="w-3.5 h-3.5" />
            Live Queue
          </Link>
        </div>
      </section>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          title="Total Jobs" 
          value={stats?.all?.count || 0} 
          amount={stats?.all?.amount || 0}
          icon={Activity} 
          bg="bg-surface-container/30" 
          border="border-black/5" 
          text="text-[#134235]" 
        />
        <StatCard 
          title="Completed" 
          value={stats?.done?.count || 0} 
          amount={stats?.done?.amount || 0}
          icon={CheckCircle2} 
          bg="bg-[#E8F1EE]/50" 
          border="border-primary/20" 
          text="text-primary" 
        />
        <StatCard 
          title="Pending" 
          value={(stats?.queued?.count || 0) + (stats?.processing?.count || 0) + (stats?.waiting?.count || 0)} 
          amount={(stats?.queued?.amount || 0) + (stats?.processing?.amount || 0) + (stats?.waiting?.amount || 0)}
          icon={Clock} 
          bg="bg-amber-50/50" 
          border="border-amber-200" 
          text="text-amber-600" 
        />
        <StatCard 
          title="Refunded" 
          value={stats?.failed?.count || 0} 
          amount={stats?.failed?.amount || 0}
          icon={AlertCircle} 
          bg="bg-red-50/50" 
          border="border-red-200" 
          text="text-red-600" 
        />
      </div>

      {/* Status filter tabs & Select All */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
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
        
        {waitingJobsCount > 0 && (
          <button 
            onClick={handleSelectAll}
            className="text-xs font-bold font-manrope text-primary hover:bg-primary/5 px-3 py-2 rounded-xl transition-colors border border-primary/20"
          >
            {selectedJobs.size === waitingJobsCount ? "Deselect All" : "Select All Waiting"}
          </button>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedJobs.size > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between sticky top-4 z-10 premium-shadow backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">
              {selectedJobs.size}
            </span>
            <span className="text-sm font-bold text-[#134235] font-manrope">jobs selected</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={() => setSelectedJobs(new Set())}
              className="px-3 py-1.5 text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors font-manrope"
            >
              Cancel
            </button>
            <button 
              onClick={() => setShowBulkRefundDialog(true)}
              disabled={refundingBulk || resendingBulk}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-xs font-bold font-manrope rounded-xl hover:bg-red-700 transition-all disabled:opacity-50 shadow-sm shadow-red-200"
            >
              <Undo2 className={`w-3.5 h-3.5 ${refundingBulk ? "animate-spin" : ""}`} /> 
              {refundingBulk ? "Refunding..." : "Refund Selected"}
            </button>
            <button 
              onClick={() => setShowBulkDialog(true)}
              disabled={resendingBulk || refundingBulk}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold font-manrope rounded-xl hover:opacity-90 transition-all disabled:opacity-50 shadow-sm shadow-primary/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${resendingBulk ? "animate-spin" : ""}`} /> 
              {resendingBulk ? "Resending..." : "Resend Selected"}
            </button>
          </div>
        </div>
      )}

      {/* Cards List */}
      <div className="flex flex-col gap-4">
        {loading && Array(3).fill(0).map((_, i) => (
          <div key={i} className="h-24 bg-surface-container/50 rounded-2xl animate-pulse border border-black/5" />
        ))}
        {!loading && validJobs.length === 0 && (
          <div className="text-center py-16 bg-white border border-black/5 rounded-2xl premium-shadow">
            <div className="w-14 h-14 rounded-2xl bg-surface-container mx-auto flex items-center justify-center mb-4">
              <ListOrdered className="w-7 h-7 text-on-surface-variant" />
            </div>
            <p className="text-on-surface-variant text-sm font-manrope font-semibold">No jobs found</p>
          </div>
        )}
        {!loading && validJobs.map((job) => (
          <JobCard 
            key={job.jobId} 
            job={job} 
            refetch={refetch} 
            isSelected={selectedJobs.has(job.jobId!)}
            onToggleSelect={handleToggleSelect}
            selectable={job.status === "waiting"}
          />
        ))}
      </div>

      {/* Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-6 border-t border-black/[0.04]">
          <p className="text-xs font-bold font-manrope text-on-surface-variant uppercase tracking-widest">
            Page {pagination.page} of {pagination.totalPages} <span className="lowercase normal-case tracking-normal opacity-60 ml-1">({pagination.total} total)</span>
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={pagination.page <= 1 || loading}
              className="p-2 rounded-xl border border-outline-variant bg-white text-on-surface-variant hover:text-primary hover:border-primary/30 disabled:opacity-50 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="p-2 rounded-xl border border-outline-variant bg-white text-on-surface-variant hover:text-primary hover:border-primary/30 disabled:opacity-50 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
