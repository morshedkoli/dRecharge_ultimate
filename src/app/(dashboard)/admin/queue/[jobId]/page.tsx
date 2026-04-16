"use client";
import { use, useEffect, useState } from "react";
import { ExecutionJob } from "@/types";
import { StatusBadge } from "@/components/admin/StatusBadge";

import { WalletAmount } from "@/components/admin/WalletAmount";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { failTransaction, simulateJobResult } from "@/lib/functions";
import { fullDateTime, maskNumber } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, XCircle, SmartphoneNfc } from "lucide-react";
import Link from "next/link";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900 font-medium">{value}</span>
    </div>
  );
}

export default function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const [job, setJob] = useState<ExecutionJob | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/admin/queue/${jobId}`)
      .then(r => r.json())
      .then(d => {
        if (!mounted) return;
        if (d.job) setJob(d.job);
      }).catch(console.error);
    return () => { mounted = false; };
  }, [jobId]);

  if (!job) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const canForceF = job.status === "queued" || job.status === "processing";

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/queue" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Job Detail</h1>
          <StatusBadge status={job.status} />
        </div>
        {canForceF && (
          <div className="flex items-center gap-3">
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
              <button className="flex items-center gap-2 text-sm px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-semibold transition-colors">
                <SmartphoneNfc className="w-4 h-4" /> Simulate Execution
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
                  toast.error(err.message || "Failed to force fail. The backend may not support forcing this particular job format.");
                }
              }}
            >
              <button className="text-sm px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-medium">
                Force Fail
              </button>
            </ConfirmDialog>
          </div>
        )}
      </div>

      {/* Job summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-medium text-gray-900 mb-4">Job Summary</h2>
        <Row label="Job ID" value={<span className="font-mono text-xs">{job.jobId}</span>} />
        <Row label="Transaction ID" value={<span className="font-mono text-xs">{job.txId}</span>} />
        <Row label="Service ID" value={<span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">{job.serviceId}</span>} />
        <Row label="Recipient" value={<span className="font-mono">{maskNumber(job.recipientNumber)}</span>} />
        <Row label="Amount" value={<WalletAmount amount={job.amount} />} />
        <Row label="Attempt #" value={job.attempt} />
        <Row label="Locked" value={job.locked ? "Yes" : "No"} />
        {job.lockedByDevice && <Row label="Locked by device" value={<span className="font-mono text-xs">{job.lockedByDevice}</span>} />}
        {job.lockedAt && <Row label="Locked at" value={fullDateTime(job.lockedAt)} />}
        <Row label="Created" value={fullDateTime(job.createdAt)} />
        {job.completedAt && <Row label="Completed" value={fullDateTime(job.completedAt)} />}
      </div>

      {/* USSD steps executed */}
      {job.ussdStepsExecuted && job.ussdStepsExecuted.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-medium text-gray-900 mb-4">USSD Steps Executed</h2>
          <div className="space-y-2">
            {job.ussdStepsExecuted.map((step) => (
              <div key={step.order} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-medium flex items-center justify-center shrink-0">
                  {step.order}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                  step.type === "dial" ? "bg-blue-50 text-blue-700" :
                  step.type === "select" ? "bg-amber-50 text-amber-700" : "bg-violet-50 text-violet-700"
                }`}>{step.type}</span>
                <span className="font-mono text-sm text-gray-800 flex-1">{step.value}</span>
                {step.success
                  ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SMS Result */}
      {(job.rawSms || job.parsedResult) && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-medium text-gray-900 mb-4">SMS Result</h2>
          {job.rawSms && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">Raw SMS received</p>
              <pre className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm font-mono text-gray-800 whitespace-pre-wrap break-all">
                {job.rawSms}
              </pre>
            </div>
          )}
          {job.parsedResult && (
            <div className="space-y-2">
              <Row label="Parse result" value={
                job.parsedResult.success
                  ? <span className="flex items-center gap-1.5 text-green-700"><CheckCircle className="w-4 h-4" /> Success</span>
                  : <span className="flex items-center gap-1.5 text-red-700"><XCircle className="w-4 h-4" /> Failure</span>
              } />
              {job.parsedResult.txRef && <Row label="Transaction ref" value={<span className="font-mono text-xs">{job.parsedResult.txRef}</span>} />}
              {job.parsedResult.amount != null && <Row label="Confirmed amount" value={<WalletAmount amount={job.parsedResult.amount} />} />}
              {job.parsedResult.reason && <Row label="Failure reason" value={<span className="text-red-600">{job.parsedResult.reason}</span>} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
