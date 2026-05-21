"use client";
import { use, useEffect, useState } from "react";
import { ExecutionJob, ExecutionLog } from "@/types";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { WalletAmount } from "@/components/admin/WalletAmount";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { failTransaction, simulateJobResult, cancelJob } from "@/lib/functions";
import { fullDateTime, maskNumber } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle, XCircle, SmartphoneNfc,
  Hash, CreditCard, Phone, Calendar, Lock, Cpu,
  MessageSquare, Activity, AlertTriangle, Zap, Ban, RefreshCw, Terminal,
  Smartphone, Radio,
} from "lucide-react";
import Link from "next/link";

// ── Field row used in detail cards ──────────────────────────────────────────

function Field({ label, icon: Icon, value }: {
  label: string;
  icon?: typeof Hash;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-black/[0.04] last:border-0">
      {Icon && (
        <div className="mt-0.5 p-1.5 rounded-lg bg-surface-container shrink-0">
          <Icon className="w-3.5 h-3.5 text-on-surface-variant" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-on-surface-variant/60 font-manrope mb-0.5">
          {label}
        </p>
        <div className="text-sm font-semibold text-on-surface font-inter break-all">
          {value}
        </div>
      </div>
    </div>
  );
}

// ── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ title, icon: Icon, iconBg, children }: {
  title: string;
  icon: typeof Hash;
  iconBg: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-black/[0.04] bg-surface-container/20">
        <div className={`p-2 rounded-xl ${iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
        <h2 className="font-manrope font-bold text-on-surface text-sm tracking-tight">{title}</h2>
      </div>
      <div className="px-6 py-2">
        {children}
      </div>
    </div>
  );
}

// ── Step type badge ──────────────────────────────────────────────────────────

const stepTypeStyle: Record<string, string> = {
  dial:     "bg-blue-50 text-blue-700 border border-blue-100",
  select:   "bg-amber-50 text-amber-700 border border-amber-100",
  input:    "bg-violet-50 text-violet-700 border border-violet-100",
  response: "bg-emerald-50 text-emerald-700 border border-emerald-100",
};

// ── Outcome pill for execution log entries ─────────────────────────────

function OutcomePill({ outcome }: { outcome: string }) {
  const styles: Record<string, { cls: string; label: string }> = {
    done:    { cls: "bg-[#E8F1EE] text-[#134235] border border-[#134235]/10", label: "Success" },
    failed:  { cls: "bg-red-50 text-red-700 border border-red-100", label: "Failed" },
    waiting: { cls: "bg-amber-50 text-amber-700 border border-amber-100", label: "Waiting" },
    queued:  { cls: "bg-blue-50 text-blue-700 border border-blue-100", label: "Requeued" },
  };
  const s = styles[outcome] ?? { cls: "bg-surface-container text-on-surface-variant", label: outcome };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-manrope ${s.cls}`}>
      {outcome === "done"    && <CheckCircle    className="w-3 h-3" />}
      {outcome === "failed"  && <XCircle        className="w-3 h-3" />}
      {outcome === "waiting" && <AlertTriangle  className="w-3 h-3" />}
      {outcome === "queued"  && <RefreshCw      className="w-3 h-3" />}
      {s.label}
    </span>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const [job, setJob] = useState<ExecutionJob | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/admin/history/${jobId}`)
      .then(r => r.json())
      .then(d => { if (mounted && d.job) setJob(d.job); })
      .catch(console.error);
    return () => { mounted = false; };
  }, [jobId]);

  if (!job) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const canAct    = job.status === "queued" || job.status === "processing" || job.status === "waiting";
  const canForceF = canAct;
  const isSuccess = job.status === "done" || job.parsedResult?.success === true;
  const isWaiting    = job.status === "waiting";
  const isFailed     = job.status === "failed";
  const isCancelled  = job.status === "cancelled";

  return (
    <div className="p-6 sm:p-10 max-w-4xl mx-auto space-y-6 pb-12">

      {/* ── Back nav ─────────────────────────────────────────────────────── */}
      <Link
        href="/admin/history"
        className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface font-manrope font-semibold transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to History
      </Link>

      {/* ── Hero card ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow">
        {/* Status stripe */}
        <div className={`h-1 w-full ${
          isSuccess    ? "bg-[#134235]" :
          isWaiting    ? "bg-amber-400" :
          isFailed     ? "bg-red-500" :
          isCancelled  ? "bg-orange-400" :
          job.status === "processing" ? "bg-amber-400" :
          "bg-surface-container"
        }`} />

        <div className="px-6 sm:px-8 py-6 flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Icon */}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
            isSuccess   ? "bg-[#E8F1EE]" :
            isWaiting   ? "bg-amber-50" :
            isFailed    ? "bg-red-50" :
            isCancelled ? "bg-orange-50" :
            "bg-surface-container"
          }`}>
            {isSuccess ? (
              <CheckCircle className="w-7 h-7 text-[#134235]" />
            ) : isWaiting ? (
              <AlertTriangle className="w-7 h-7 text-amber-600" />
            ) : isFailed ? (
              <XCircle className="w-7 h-7 text-red-500" />
            ) : isCancelled ? (
              <Ban className="w-7 h-7 text-orange-500" />
            ) : (
              <Activity className="w-7 h-7 text-on-surface-variant" />
            )}
          </div>

          {/* Title block */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
              <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">
                Job Detail
              </h1>
              <StatusBadge status={job.status} />
            </div>
            <p className="font-mono text-xs text-on-surface-variant break-all">{job.jobId}</p>
          </div>

          {/* Key metric */}
          <div className="sm:text-right shrink-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-on-surface-variant/60 font-manrope mb-0.5">Amount</p>
            <div className="text-2xl font-extrabold text-[#134235] font-inter">
              <WalletAmount amount={job.amount} />
            </div>
          </div>
        </div>

        {/* Mini stats strip */}
        <div className="grid grid-cols-3 divide-x divide-black/[0.04] border-t border-black/[0.04] bg-surface-container/20">
          {[
            { label: "Recipient", value: <span className="font-mono">{maskNumber(job.recipientNumber)}</span> },
            { label: "Service",   value: <span className="font-mono text-xs bg-surface-container px-2 py-0.5 rounded-lg">{job.serviceId}</span> },
            { label: "Attempt",   value: `#${job.attempt}` },
          ].map(({ label, value }) => (
            <div key={label} className="px-5 py-3.5 text-center">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-on-surface-variant/60 font-manrope mb-0.5">{label}</p>
              <div className="text-sm font-bold text-on-surface font-inter">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Failure reason banner (prominent for failed/cancelled jobs) ──── */}
      {(isFailed || isCancelled) && (() => {
        const latestLog = job.executionLogs && job.executionLogs.length > 0
          ? [...job.executionLogs].reverse()[0]
          : null;
        const reason =
          (job.parsedResult as { reason?: string } | undefined)?.reason ||
          latestLog?.failureReason ||
          (isCancelled ? "Job cancelled by admin." : "Transaction could not be confirmed.");
        return (
          <div className="bg-red-50/60 border-2 border-red-200/80 rounded-2xl px-5 py-4 flex items-start gap-3 premium-shadow">
            <div className="p-2 rounded-xl bg-red-100 shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-red-700/70 font-manrope mb-1">
                Reason for failure
              </p>
              <p className="text-sm font-bold text-red-900 font-inter leading-snug break-words">
                {reason}
              </p>
            </div>
          </div>
        );
      })()}

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      {canAct && (
        <div className="flex flex-wrap gap-3">
          <ConfirmDialog
            title="Cancel this request?"
            description="The job will be marked as cancelled and the user's wallet will be refunded immediately. This cannot be undone."
            confirmLabel="Cancel Request"
            confirmVariant="destructive"
            onConfirm={async () => {
              try {
                await cancelJob(job.jobId, "Admin cancelled");
                toast.success("Request cancelled — wallet refunded");
                setJob((j) => j ? { ...j, status: "cancelled" } : j);
              } catch (err: any) {
                toast.error(err.message || "Failed to cancel request.");
              }
            }}
          >
            <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-50 text-orange-700 border border-orange-200 text-sm rounded-xl hover:bg-orange-100 font-manrope font-bold transition-colors">
              <Ban className="w-4 h-4" /> Cancel Request
            </button>
          </ConfirmDialog>

          <ConfirmDialog
            title="Simulate Agent Execution Success?"
            description="This will lock the transaction as complete, representing a successful mobile execution for testing purposes."
            confirmLabel="Simulate Done"
            onConfirm={async () => {
              await simulateJobResult(job.jobId, job.txId || "", true);
              setJob(j => j ? { ...j, status: "done", parsedResult: { ...(j.parsedResult ?? {}), success: true } } : j);
              toast.success("Job marked as Done automatically");
            }}
          >
            <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#E8F1EE] text-[#134235] text-sm rounded-xl hover:bg-[#d4e8e0] font-manrope font-bold transition-colors">
              <SmartphoneNfc className="w-4 h-4" /> Mark Success
            </button>
          </ConfirmDialog>

          <ConfirmDialog
            title="Force fail this job?"
            description="The user's wallet will be refunded immediately. This cannot be undone."
            confirmLabel="Force Fail"
            confirmVariant="destructive"
            onConfirm={async () => {
              await failTransaction(job.txId || "", job.jobId || "", "Admin force-failed");
              setJob(j => j ? { ...j, status: "failed", locked: false, parsedResult: { ...(j.parsedResult ?? {}), success: false, reason: "Admin force-failed" } } : j);
              toast.success("Job force-failed — wallet refunded");
            }}
          >
            <button className="inline-flex items-center gap-2 px-5 py-2.5 border border-red-200 text-red-600 text-sm rounded-xl hover:bg-red-50 font-manrope font-bold transition-colors">
              <AlertTriangle className="w-4 h-4" /> Force Fail
            </button>
          </ConfirmDialog>
        </div>
      )}

      {/* ── Two-col layout on desktop ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Job Info */}
        <Card title="Job Information" icon={Hash} iconBg="bg-surface-container">
          <Field icon={Hash}     label="Job ID"          value={<span className="font-mono text-xs">{job.jobId}</span>} />
          <Field icon={CreditCard} label="Transaction ID" value={<span className="font-mono text-xs">{job.txId}</span>} />
          <Field icon={Cpu}      label="Service ID"       value={<span className="font-mono text-xs bg-surface-container px-2 py-0.5 rounded-md">{job.serviceId}</span>} />
          <Field icon={Phone}    label="Recipient"        value={<span className="font-mono">{maskNumber(job.recipientNumber)}</span>} />
        </Card>

        {/* Execution Info */}
        <Card title="Execution Details" icon={Activity} iconBg="bg-amber-50">
          <Field icon={Zap}      label="Attempt"          value={`#${job.attempt}`} />
          <Field icon={Lock}     label="Locked"           value={job.locked ? "Yes" : "No"} />
          {job.lockedByDevice && (
            <Field icon={Cpu}    label="Locked by Device" value={<span className="font-mono text-xs">{job.lockedByDevice}</span>} />
          )}
          {job.lockedAt && (
            <Field icon={Calendar} label="Locked At"      value={fullDateTime(job.lockedAt)} />
          )}
          <Field icon={Calendar} label="Created"          value={fullDateTime(job.createdAt)} />
          {job.completedAt && (
            <Field icon={CheckCircle} label="Completed"   value={fullDateTime(job.completedAt)} />
          )}
        </Card>
      </div>

      {/* ── USSD execution timeline ───────────────────────────────────────── */}
      {job.ussdStepsExecuted && job.ussdStepsExecuted.length > 0 && (
        <Card title="USSD Steps Executed" icon={Cpu} iconBg="bg-blue-50">
          <div className="py-2 space-y-0">
            {job.ussdStepsExecuted.map((step, idx) => (
              <div
                key={step.order}
                className="flex items-center gap-4 py-3 border-b border-black/[0.04] last:border-0"
              >
                {/* Step number */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-extrabold font-manrope ${
                  step.success
                    ? "bg-[#E8F1EE] text-[#134235]"
                    : "bg-red-50 text-red-600"
                }`}>
                  {step.order}
                </div>

                {/* Type badge */}
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold shrink-0 ${stepTypeStyle[step.type] ?? "bg-surface-container text-on-surface-variant"}`}>
                  {step.type}
                </span>

                {/* Value */}
                <span className={`font-mono text-sm text-on-surface flex-1 min-w-0 ${step.type === 'response' ? 'whitespace-pre-wrap leading-relaxed' : 'truncate'}`}>
                  {step.value}
                </span>

                {/* Result icon */}
                {step.success
                  ? <CheckCircle className="w-4 h-4 text-[#134235] shrink-0" />
                  : <XCircle    className="w-4 h-4 text-red-500 shrink-0" />
                }
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── USSD Response (Phone Dialog Preview) ─────────────────────────── */}
      {(() => {
        // Prefer the dedicated ussdResponse field, then the latest log,
        // then fall back to job.rawSms for legacy data.
        const latestLog = job.executionLogs && job.executionLogs.length > 0
          ? [...job.executionLogs].reverse()[0]
          : null;
        const ussdText =
          (job as any).ussdResponse ||
          latestLog?.ussdResponse ||
          (!latestLog?.smsBody ? job.rawSms : "") ||
          "";
        if (!ussdText.trim()) return null;

        // Detect success/failure from parsedResult or status
        const responseIsSuccess = job.parsedResult?.success === true || job.status === "done";
        const responseIsFailed  = job.status === "failed" || (job.parsedResult?.success === false && job.status !== "waiting");
        const responseIsWaiting = job.status === "waiting";

        const dialogBorderColor = responseIsSuccess
          ? "border-[#134235]/20"
          : responseIsFailed
          ? "border-red-200"
          : responseIsWaiting
          ? "border-amber-200"
          : "border-black/10";

        const headerBg = responseIsSuccess
          ? "bg-[#E8F1EE] border-b border-[#134235]/10"
          : responseIsFailed
          ? "bg-red-50 border-b border-red-100"
          : responseIsWaiting
          ? "bg-amber-50 border-b border-amber-100"
          : "bg-surface-container border-b border-black/[0.04]";

        const iconColor = responseIsSuccess ? "text-[#134235]" : responseIsFailed ? "text-red-500" : responseIsWaiting ? "text-amber-600" : "text-on-surface-variant";

        return (
          <div className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow">
            {/* Card header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-black/[0.04] bg-surface-container/20">
              <div className="p-2 rounded-xl bg-violet-100">
                <Smartphone className="w-4 h-4 text-violet-600" />
              </div>
              <h2 className="font-manrope font-bold text-on-surface text-sm tracking-tight">USSD Response from Device</h2>
              <div className="ml-auto flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-on-surface-variant/40" />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-on-surface-variant/40 font-manrope">
                  {latestLog?.deviceId ? latestLog.deviceId.slice(-8) : "Device"}
                </span>
              </div>
            </div>

            <div className="px-6 py-5">
              {/* Phone frame mockup */}
              <div className="max-w-xs mx-auto">
                {/* Phone chrome top bar */}
                <div className="bg-[#d4d0c8] rounded-t-2xl px-3 py-1.5 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#9e9b93]" />
                  <div className="flex-1 bg-[#c8c5bd] rounded-full px-3 py-0.5 text-[9px] font-mono text-[#5a5752] truncate">
                    {job.serviceName || "USSD Dialog"}
                  </div>
                </div>

                {/* Dialog popup */}
                <div className="bg-[#f0ede8] pb-3 rounded-b-2xl shadow-md border border-[#c8c5bd]">
                  {/* Dialog card */}
                  <div className={`mx-4 mt-8 mb-4 bg-white rounded-2xl shadow-lg border-2 ${dialogBorderColor} overflow-hidden`}>
                    {/* Dialog header */}
                    <div className={`px-5 py-3.5 ${headerBg}`}>
                      <div className="flex items-center gap-2">
                        {responseIsSuccess && <CheckCircle className={`w-4 h-4 ${iconColor} shrink-0`} />}
                        {responseIsFailed  && <XCircle    className={`w-4 h-4 ${iconColor} shrink-0`} />}
                        {responseIsWaiting && <AlertTriangle className={`w-4 h-4 ${iconColor} shrink-0`} />}
                        {!responseIsSuccess && !responseIsFailed && !responseIsWaiting && (
                          <Smartphone className={`w-4 h-4 ${iconColor} shrink-0`} />
                        )}
                        <p className="font-bold text-[13px] text-on-surface font-manrope">
                          {job.serviceName || "Carrier Message"}
                        </p>
                      </div>
                    </div>

                    {/* Dialog body */}
                    <div className="px-5 py-4">
                      <p className="text-[13px] text-on-surface font-inter leading-relaxed whitespace-pre-wrap break-words">
                        {ussdText}
                      </p>
                    </div>

                    {/* OK button */}
                    <div className="border-t border-black/[0.06] px-5 py-3 text-center">
                      <span className={`text-[13px] font-bold font-manrope ${
                        responseIsSuccess ? "text-[#134235]" : responseIsFailed ? "text-red-600" : "text-[#134235]"
                      }`}>OK</span>
                    </div>
                  </div>

                  {/* Phone bottom bar */}
                  <div className="flex items-center justify-around px-8 pt-1">
                    <div className="w-6 h-1 rounded-full bg-[#9e9b93]" />
                    <div className="w-6 h-6 rounded-full border-2 border-[#9e9b93]" />
                    <div className="w-6 h-1 rounded-full bg-[#9e9b93]" />
                  </div>
                </div>
              </div>

              {/* Raw text (expandable) */}
              <details className="group mt-4">
                <summary className="cursor-pointer select-none list-none flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-on-surface-variant/40 font-manrope hover:text-on-surface-variant transition-colors justify-center">
                  <Terminal className="w-3 h-3" />
                  View raw response text
                  <span className="ml-1 text-[8px] group-open:rotate-90 transition-transform inline-block">▶</span>
                </summary>
                <pre className="mt-2 bg-surface-container/60 border border-black/[0.04] rounded-xl px-4 py-3 text-xs font-mono text-on-surface whitespace-pre-wrap break-all leading-relaxed">
                  {ussdText}
                </pre>
              </details>
            </div>
          </div>
        );
      })()}

      {/* ── Matched SMS ──────────────────────────────────────────────────── */}
      {(() => {
        const latestLog = job.executionLogs && job.executionLogs.length > 0
          ? [...job.executionLogs].reverse()[0]
          : null;
        const smsText =
          latestLog?.smsBody ||
          // Legacy: rawSms was used as the matched evidence; if responseSource is "sms" or matchSource is "sms", show it here
          (latestLog?.responseSource === "sms" || job.parsedResult?.matchSource === "sms"
            ? job.rawSms
            : "") ||
          "";
        if (!smsText.trim()) return null;

        const sender = (job as any).smsSenderNumber || latestLog?.senderNumber || "";
        const isSuccess = job.parsedResult?.success === true || job.status === "done";
        const isFailed  = job.status === "failed" || (job.parsedResult?.success === false && job.status !== "waiting");

        return (
          <Card title="Matched SMS" icon={MessageSquare} iconBg={isSuccess ? "bg-[#E8F1EE]" : isFailed ? "bg-red-50" : "bg-amber-50"}>
            {sender && (
              <Field icon={Phone} label="From" value={<span className="font-mono">{sender}</span>} />
            )}
            <div className="py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-on-surface-variant/60 font-manrope mb-2">SMS Body</p>
              <pre className="bg-surface-container/50 border border-black/[0.04] rounded-xl px-4 py-3.5 text-xs font-mono text-on-surface whitespace-pre-wrap break-all leading-relaxed">
                {smsText}
              </pre>
            </div>
            {job.parsedResult && (job.parsedResult.txRef || (job.parsedResult as any).smsAmount || (job.parsedResult as any).smsRecipient || (job.parsedResult as any).balance) && (
              <div className="py-2 grid grid-cols-2 gap-x-4">
                {job.parsedResult.txRef && (
                  <Field icon={Hash} label="Transaction ID" value={<span className="font-mono">{job.parsedResult.txRef}</span>} />
                )}
                {(job.parsedResult as any).smsAmount && (
                  <Field icon={CreditCard} label="Amount (from SMS)" value={<span className="font-mono">{(job.parsedResult as any).smsAmount}</span>} />
                )}
                {(job.parsedResult as any).smsRecipient && (
                  <Field icon={Phone} label="Recipient (from SMS)" value={<span className="font-mono">{(job.parsedResult as any).smsRecipient}</span>} />
                )}
                {(job.parsedResult as any).balance && (
                  <Field icon={CreditCard} label="Balance" value={<span className="font-mono">{(job.parsedResult as any).balance}</span>} />
                )}
              </div>
            )}
          </Card>
        );
      })()}

      {/* ── Execution History ─────────────────────────────────────────────── */}
      {job.executionLogs && job.executionLogs.length > 0 ? (
        <Card title={`Execution History (${job.executionLogs.length} attempt${job.executionLogs.length !== 1 ? "s" : ""})`} icon={Terminal} iconBg="bg-violet-50">
          <div className="py-1">
            {[...job.executionLogs].reverse().map((log: ExecutionLog, idx: number) => (
              <div key={idx} className="py-4 border-b border-black/[0.04] last:border-0">

                {/* Header row */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-extrabold font-manrope text-on-surface-variant">#{log.attempt}</span>
                  </div>
                  <OutcomePill outcome={log.outcome} />
                  {log.deviceId && (
                    <span className="font-mono text-[10px] text-on-surface-variant/50 bg-surface-container px-2 py-0.5 rounded-md truncate max-w-[140px]">
                      {log.deviceId}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-on-surface-variant/40 font-manrope shrink-0">
                    {fullDateTime(log.executedAt)}
                  </span>
                </div>

                {/* USSD response */}
                <div className="mb-3">
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-on-surface-variant/40 font-manrope mb-1.5">USSD Response</p>
                  {log.ussdResponse ? (
                    <pre className="bg-surface-container/60 border border-black/[0.04] rounded-xl px-4 py-3 text-xs font-mono text-on-surface whitespace-pre-wrap break-all leading-relaxed">
                      {log.ussdResponse}
                    </pre>
                  ) : (
                    <pre className="bg-surface-container/30 border border-dashed border-black/[0.06] rounded-xl px-4 py-2.5 text-[11px] font-mono text-on-surface-variant/40 italic">
                      (no response text captured)
                    </pre>
                  )}
                </div>

                {/* Matched SMS body (when present) */}
                {log.smsBody && (
                  <div className="mb-3">
                    <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-on-surface-variant/40 font-manrope mb-1.5 flex items-center gap-1.5">
                      <MessageSquare className="w-2.5 h-2.5" />
                      SMS Received
                      {log.senderNumber && (
                        <span className="font-mono text-[10px] text-on-surface-variant/60 normal-case tracking-normal">from {log.senderNumber}</span>
                      )}
                    </p>
                    <pre className="bg-blue-50/40 border border-blue-100/60 rounded-xl px-4 py-3 text-xs font-mono text-on-surface whitespace-pre-wrap break-all leading-relaxed">
                      {log.smsBody}
                    </pre>
                  </div>
                )}

                {/* Failure/waiting reason */}
                {log.failureReason && (
                  <div className="flex items-start gap-2 px-3 py-2 bg-amber-50/60 border border-amber-100/60 rounded-lg mb-3">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-800 font-manrope leading-snug">{log.failureReason}</p>
                  </div>
                )}

                {/* Collapsible steps */}
                {log.stepsExecuted && log.stepsExecuted.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer select-none list-none flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-on-surface-variant/40 font-manrope hover:text-on-surface-variant transition-colors">
                      <Cpu className="w-3 h-3" />
                      {log.stepsExecuted.length} step{log.stepsExecuted.length !== 1 ? "s" : ""} executed
                      <span className="ml-1 text-[8px] group-open:rotate-90 transition-transform inline-block">▶</span>
                    </summary>
                    <div className="mt-2 space-y-1">
                      {(log.stepsExecuted as any[]).map((step: any, sIdx: number) => (
                        <div key={sIdx} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-container/40">
                          <span className="w-5 h-5 rounded-full bg-white border border-black/5 flex items-center justify-center text-[9px] font-extrabold font-manrope text-on-surface-variant shrink-0">
                            {step.order ?? sIdx + 1}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${stepTypeStyle[step.type] ?? "bg-surface-container text-on-surface-variant"}`}>
                            {step.type}
                          </span>
                          <span className="font-mono text-xs text-on-surface truncate flex-1">{step.value}</span>
                          {step.success
                            ? <CheckCircle className="w-3 h-3 text-[#134235] shrink-0" />
                            : <XCircle    className="w-3 h-3 text-red-400 shrink-0" />
                          }
                        </div>
                      ))}
                    </div>
                  </details>
                )}

              </div>
            ))}
          </div>
        </Card>
      ) : (job.rawSms || job.parsedResult) && (
        /* Fallback for older jobs that pre-date executionLogs */
        <Card title="Execution Result" icon={MessageSquare} iconBg="bg-violet-50">
          {job.rawSms && (
            <div className="py-3 border-b border-black/[0.04]">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-on-surface-variant/60 font-manrope mb-2">Raw USSD Response</p>
              <pre className="bg-surface-container/50 border border-black/[0.04] rounded-xl px-4 py-3.5 text-xs font-mono text-on-surface whitespace-pre-wrap break-all leading-relaxed">
                {job.rawSms}
              </pre>
            </div>
          )}
          {job.parsedResult && (
            <div className="py-2">
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mt-2 mb-4 ${
                job.status === "waiting" ? "bg-amber-50 border border-amber-100"
                : job.parsedResult.success ? "bg-[#E8F1EE] border border-[#134235]/10"
                : "bg-red-50 border border-red-100"
              }`}>
                {job.status === "waiting" ? <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  : job.parsedResult.success ? <CheckCircle className="w-5 h-5 text-[#134235] shrink-0" />
                  : <XCircle className="w-5 h-5 text-red-600 shrink-0" />}
                <span className={`font-manrope font-bold text-sm ${
                  job.status === "waiting" ? "text-amber-700"
                  : job.parsedResult.success ? "text-[#134235]" : "text-red-700"
                }`}>
                  {job.status === "waiting" ? "Waiting For Manual Review"
                    : job.parsedResult.success ? "Transaction Confirmed" : "Transaction Failed"}
                </span>
              </div>
              {job.parsedResult.txRef && (
                <Field icon={Hash} label="Transaction Ref" value={<span className="font-mono text-xs">{job.parsedResult.txRef}</span>} />
              )}
              {job.parsedResult.reason && (
                <Field icon={AlertTriangle}
                  label={job.status === "waiting" ? "Waiting Reason" : "Failure Reason"}
                  value={<span className={job.status === "waiting" ? "text-amber-700" : "text-red-600"}>{job.parsedResult.reason}</span>}
                />
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}


