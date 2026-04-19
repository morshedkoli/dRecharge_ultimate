"use client";
import { use, useEffect, useState } from "react";
import { ExecutionJob } from "@/types";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { WalletAmount } from "@/components/admin/WalletAmount";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { failTransaction, simulateJobResult, cancelJob } from "@/lib/functions";
import { fullDateTime, maskNumber } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle, XCircle, SmartphoneNfc,
  Hash, CreditCard, Phone, Calendar, Lock, Cpu,
  MessageSquare, Activity, AlertTriangle, Zap, Ban,
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
  dial:   "bg-blue-50 text-blue-700 border border-blue-100",
  select: "bg-amber-50 text-amber-700 border border-amber-100",
  input:  "bg-violet-50 text-violet-700 border border-violet-100",
};

// ── Main page ────────────────────────────────────────────────────────────────

export default function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const [job, setJob] = useState<ExecutionJob | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/admin/queue/${jobId}`)
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
        href="/admin/queue"
        className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface font-manrope font-semibold transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Queue
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
              try {
                await simulateJobResult(job.jobId, job.txId || "", true);
                toast.success("Job marked as Done automatically");
              } catch (err: any) {
                toast.error(err.message || "Failed to simulate processing. Ensure job structure is valid.");
              }
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
              try {
                await failTransaction(job.txId || "", job.jobId || "", "Admin force-failed");
                toast.success("Job force-failed — wallet refunded");
              } catch (err: any) {
                toast.error(err.message || "Failed to force fail.");
              }
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
                <span className="font-mono text-sm text-on-surface flex-1 min-w-0 truncate">
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

      {/* ── SMS result ────────────────────────────────────────────────────── */}
      {(job.rawSms || job.parsedResult) && (
        <Card title="SMS Result" icon={MessageSquare} iconBg="bg-violet-50">
          {job.rawSms && (
            <div className="py-3 border-b border-black/[0.04]">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-on-surface-variant/60 font-manrope mb-2">
                Raw SMS
              </p>
              <pre className="bg-surface-container/50 border border-black/[0.04] rounded-xl px-4 py-3.5 text-xs font-mono text-on-surface whitespace-pre-wrap break-all leading-relaxed">
                {job.rawSms}
              </pre>
            </div>
          )}

          {job.parsedResult && (
            <div className="py-2">
              {/* Parse outcome banner */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mt-2 mb-4 ${
                job.status === "waiting"
                  ? "bg-amber-50 border border-amber-100"
                  : job.parsedResult.success
                  ? "bg-[#E8F1EE] border border-[#134235]/10"
                  : "bg-red-50 border border-red-100"
              }`}>
                {job.status === "waiting"
                  ? <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  : job.parsedResult.success
                  ? <CheckCircle className="w-5 h-5 text-[#134235] shrink-0" />
                  : <XCircle    className="w-5 h-5 text-red-600 shrink-0" />
                }
                <span className={`font-manrope font-bold text-sm ${
                  job.status === "waiting"
                    ? "text-amber-700"
                    : job.parsedResult.success ? "text-[#134235]" : "text-red-700"
                }`}>
                  {job.status === "waiting"
                    ? "Waiting For Manual Review"
                    : job.parsedResult.success ? "Transaction Confirmed" : "Transaction Failed"}
                </span>
              </div>

              {job.parsedResult.txRef && (
                <Field icon={Hash} label="Transaction Ref" value={<span className="font-mono text-xs">{job.parsedResult.txRef}</span>} />
              )}
              {job.parsedResult.amount != null && (
                <Field icon={CreditCard} label="Confirmed Amount" value={<WalletAmount amount={job.parsedResult.amount} />} />
              )}
              {job.parsedResult.reason && (
                <Field
                  icon={AlertTriangle}
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
