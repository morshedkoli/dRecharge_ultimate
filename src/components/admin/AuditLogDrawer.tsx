"use client";

import { AuditLog } from "@/types";
import { fullDateTime } from "@/lib/utils";
import { LogSeverityDot } from "@/components/admin/LogSeverityDot";
import { X, Server, MapPin, Monitor } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  ADMIN_TOPUP:              "Admin added balance to wallet",
  ADMIN_DEDUCT:             "Admin deducted balance from wallet",
  ADMIN_BALANCE_ADJUST:     "Admin adjusted wallet balance",
  USER_SUSPENDED:           "User account suspended",
  USER_ACTIVATED:           "User account activated",
  USER_CREATED:             "New user account created",
  ROLE_CHANGED:             "User role changed",
  BALANCE_REQUEST_APPROVED: "Balance request approved",
  BALANCE_REQUEST_REJECTED: "Balance request rejected",
  TX_INITIATED:             "Transaction initiated",
  TX_WAITING:               "Transaction moved to waiting review",
  TX_COMPLETED:             "Transaction completed",
  TX_FAILED:                "Transaction failed",
  TEMPLATE_UPDATED:         "USSD template updated",
  DEVICE_TOKEN_GENERATED:   "Device token generated",
  DEVICE_REVOKED:           "Device revoked",
  JOB_STALE_LOCK_RELEASED:  "Stale job lock released",
  JOB_MAX_RETRY_EXCEEDED:   "Job max retries exceeded",
};

function MetaRow({ label, value }: { label: string; value: string | number | undefined }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-medium text-gray-900 text-right break-all">{String(value)}</span>
    </div>
  );
}

export function AuditLogDrawer({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const isServerAction = log.ip === "server";
  const hasLocation = !!(log.location?.city && log.location?.country);
  const description = ACTION_LABELS[log.action];

  // Pull useful fields from meta
  const meta = log.meta as Record<string, unknown>;
  const amount       = meta?.amount as number | undefined;
  const note         = meta?.note as string | undefined;
  const targetUid    = meta?.targetUid as string | undefined;
  const newRole      = meta?.newRole as string | undefined;
  const serviceId    = meta?.serviceId as string | undefined;
  const adminNote    = meta?.adminNote as string | undefined;
  const type         = meta?.type as string | undefined;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <LogSeverityDot severity={log.severity} />
            <span className="font-mono text-sm font-medium text-gray-900">{log.action}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close log details">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* Description banner */}
          {description && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 text-sm text-orange-800 font-medium">
              {description}
            </div>
          )}

          {/* Event details */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Event</h3>
            <div className="space-y-2 text-sm">
              <MetaRow label="Action"    value={log.action} />
              <MetaRow label="Severity"  value={log.severity} />
              <MetaRow label="Timestamp" value={fullDateTime(log.timestamp)} />
              {log.entityId && <MetaRow label="Entity ID" value={log.entityId} />}
            </div>
          </section>

          {/* Action-specific details */}
          {(amount !== undefined || note || targetUid || newRole || serviceId || adminNote || type) && (
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Details</h3>
              <div className="space-y-2 text-sm">
                {amount   !== undefined && <MetaRow label="Amount"     value={`৳ ${Number(amount).toFixed(2)}`} />}
                {type     && <MetaRow label="Type"       value={type} />}
                {note     && <MetaRow label="Note / Reason" value={note} />}
                {targetUid && <MetaRow label="Target User" value={targetUid} />}
                {newRole  && <MetaRow label="New Role"   value={newRole} />}
                {serviceId && <MetaRow label="Service ID"   value={serviceId} />}
                {adminNote && <MetaRow label="Admin Note" value={adminNote} />}
              </div>
            </section>
          )}

          {/* Performed by */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Performed By</h3>
            <div className="space-y-2 text-sm">
              <MetaRow label="UID" value={log.uid || "anonymous"} />
            </div>
          </section>

          {/* Network / Location */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Network
            </h3>
            <div className="space-y-2 text-sm">
              <MetaRow label="IP" value={isServerAction ? "Server (internal)" : log.ip} />
              {hasLocation ? (
                <>
                  <MetaRow label="City"    value={log.location.city} />
                  <MetaRow label="Region"  value={log.location.region} />
                  <MetaRow label="Country" value={log.location.country} />
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-gray-500">Location</span>
                  <span className="text-gray-400 italic">{isServerAction ? "Admin Panel (server)" : "Unknown"}</span>
                </div>
              )}
            </div>
          </section>

          {/* Device */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              {isServerAction ? <Server className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />} Device
            </h3>
            <div className="space-y-2 text-sm">
              {isServerAction ? (
                <div className="flex justify-between">
                  <span className="text-gray-500">Source</span>
                  <span className="text-gray-400 italic">Server-side (Next.js API)</span>
                </div>
              ) : (
                <>
                  <MetaRow label="Browser"     value={log.browser} />
                  <MetaRow label="OS"          value={log.os} />
                  <MetaRow label="Device type" value={log.deviceType} />
                  <MetaRow label="User Agent"  value={log.userAgent} />
                </>
              )}
            </div>
          </section>

          {/* Full meta */}
          {log.meta && Object.keys(log.meta).length > 0 && (
            <details className="group">
              <summary className="text-xs font-semibold text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-600">
                Raw Metadata
              </summary>
              <pre className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs font-mono text-gray-800 overflow-auto max-h-64 whitespace-pre-wrap">
                {JSON.stringify(log.meta, null, 2)}
              </pre>
            </details>
          )}

          <details className="group">
            <summary className="text-xs font-semibold text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-600">
              Raw document
            </summary>
            <pre className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs font-mono text-gray-800 overflow-auto max-h-64 whitespace-pre-wrap">
              {JSON.stringify(log, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}
