"use client";
import { useState } from "react";
import { AuditLogDrawer } from "@/components/admin/AuditLogDrawer";
import { useAuditLogs } from "@/lib/hooks/admin/useAuditLogs";
import { LogSeverityDot } from "@/components/admin/LogSeverityDot";
import { AuditLog, LogSeverity } from "@/types";
import { fullDateTime, relativeTime } from "@/lib/utils";
import { Download, X, ScrollText, MapPin, Monitor, Clock } from "lucide-react";

const SEVERITIES: (LogSeverity | "all")[] = ["all", "info", "warn", "error", "critical"];

const SEVERITY_STYLES: Record<string, string> = {
  all:      "bg-[#134235] text-white",
  info:     "bg-blue-50 text-blue-700",
  warn:     "bg-amber-50 text-amber-700",
  error:    "bg-red-50 text-red-700",
  critical: "bg-red-600 text-white",
};

const SEVERITY_CARD_ACCENT: Record<string, string> = {
  info:     "border-l-blue-400",
  warn:     "border-l-amber-400",
  error:    "border-l-red-500",
  critical: "border-l-red-700",
};

function formatAmount(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return null;
  return `৳ ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function logRequestSummary(log: AuditLog) {
  const meta = log.meta || {};
  const serviceName = typeof meta.serviceName === "string" ? meta.serviceName : "";
  const recipientNumber = typeof meta.recipientNumber === "string" ? meta.recipientNumber : "";
  const amount = formatAmount(meta.amount);
  return [serviceName, recipientNumber, amount].filter(Boolean).join(" · ");
}

export default function LogsPage() {
  const [severity, setSeverity] = useState<LogSeverity | "all">("all");
  const [uidFilter, setUidFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { logs, loading } = useAuditLogs({
    severity: severity === "all" ? undefined : severity,
    uid: uidFilter || undefined,
  });

  function exportCsv() {
    const headers = ["timestamp", "action", "severity", "uid", "serviceName", "recipientNumber", "amount", "city", "country", "browser", "os", "deviceType", "entityId"];
    const rows = logs.map((l) => [
      fullDateTime(l.timestamp), l.action, l.severity, l.uid || "",
      l.meta?.serviceName || "", l.meta?.recipientNumber || "", l.meta?.amount || "",
      l.location?.city || "", l.location?.country || "",
      l.browser, l.os, l.deviceType, l.entityId || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit-logs.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 sm:p-10 max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">Audit Logs</h1>
          <p className="text-on-surface-variant font-body text-lg">Complete activity trail across the platform.</p>
        </div>
        <button onClick={exportCsv}
          className="inline-flex items-center gap-2 px-6 py-3.5 border border-outline-variant bg-white rounded-xl hover:bg-surface-container font-bold font-manrope text-sm text-on-surface shadow-sm transition-all">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </section>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-1 bg-surface-container p-1 rounded-xl">
          {SEVERITIES.map((s) => (
            <button key={s} onClick={() => setSeverity(s)}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-manrope capitalize transition-all ${
                severity === s ? SEVERITY_STYLES[s] : "text-on-surface-variant hover:text-on-surface"
              }`}>
              {s}
            </button>
          ))}
        </div>
        <input value={uidFilter} onChange={(e) => setUidFilter(e.target.value)}
          placeholder="Filter by User UID…"
          className="border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[220px] bg-white" />
        {(severity !== "all" || uidFilter) && (
          <button onClick={() => { setSeverity("all"); setUidFilter(""); }}
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface font-medium">
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope">
          {logs.length} log{logs.length !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Cards */}
      <div className="space-y-2">
        {loading && Array(8).fill(0).map((_, i) => (
          <div key={i} className="bg-white border border-black/5 rounded-2xl p-4 animate-pulse premium-shadow">
            <div className="flex items-center gap-4">
              <div className="w-3 h-10 rounded-full bg-surface-container shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface-container rounded w-1/4" />
                <div className="h-3 bg-surface-container rounded w-1/3" />
              </div>
              <div className="h-3 bg-surface-container rounded w-20" />
            </div>
          </div>
        ))}

        {!loading && logs.map((log) => (
          <div key={log.id} onClick={() => setSelectedLog(log)}
            className={`bg-white border border-black/5 border-l-4 ${SEVERITY_CARD_ACCENT[log.severity] || "border-l-gray-300"} rounded-2xl p-4 premium-shadow hover:shadow-md cursor-pointer transition-all group`}>
            <div className="flex items-start gap-3">
              {/* Severity dot */}
              <div className="mt-1 shrink-0">
                <LogSeverityDot severity={log.severity} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono text-xs bg-surface-container px-2.5 py-1 rounded-lg text-on-surface font-bold">
                    {log.action}
                  </span>
                  {logRequestSummary(log) && (
                    <span className="text-xs text-on-surface-variant font-manrope truncate">
                      {logRequestSummary(log)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-wrap text-[10px] text-on-surface-variant font-medium">
                  <span className="font-mono">
                    {log.uid ? log.uid.slice(0, 14) + "…" : "anon"}
                  </span>
                  {(log.location?.city || log.location?.country) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {log.location.city && log.location.country
                        ? `${log.location.city}, ${log.location.country}`
                        : log.ip === "server" ? "Admin Panel" : "—"}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Monitor className="w-3 h-3" />
                    {log.browser === "server" ? "Server" : `${log.browser} · ${log.deviceType}`}
                  </span>
                </div>
              </div>

              {/* Time */}
              <div className="shrink-0 flex items-center gap-1 text-[10px] text-on-surface-variant font-medium" title={fullDateTime(log.timestamp)}>
                <Clock className="w-3 h-3" />
                {relativeTime(log.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {!loading && logs.length === 0 && (
          <div className="text-center py-16 bg-white border border-black/5 rounded-2xl premium-shadow">
            <div className="w-14 h-14 rounded-2xl bg-surface-container mx-auto flex items-center justify-center mb-4">
              <ScrollText className="w-7 h-7 text-on-surface-variant" />
            </div>
            <p className="text-on-surface-variant text-sm font-manrope font-semibold">No logs found</p>
          </div>
        )}
      </div>

      {selectedLog && <AuditLogDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
}
