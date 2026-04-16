"use client";
import { useState } from "react";
import { AuditLogDrawer } from "@/components/admin/AuditLogDrawer";
import { useAuditLogs } from "@/lib/hooks/admin/useAuditLogs";
import { LogSeverityDot } from "@/components/admin/LogSeverityDot";
import { AuditLog, LogSeverity } from "@/types";
import { fullDateTime, relativeTime } from "@/lib/utils";
import { Download, X, ScrollText } from "lucide-react";

const SEVERITIES: (LogSeverity | "all")[] = ["all", "info", "warn", "error", "critical"];

const SEVERITY_STYLES: Record<string, string> = {
  all:      "bg-[#134235] text-white",
  info:     "bg-blue-50 text-blue-700",
  warn:     "bg-amber-50 text-amber-700",
  error:    "bg-red-50 text-red-700",
  critical: "bg-red-600 text-white",
};

export default function LogsPage() {
  const [severity, setSeverity] = useState<LogSeverity | "all">("all");
  const [uidFilter, setUidFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { logs, loading } = useAuditLogs({
    severity: severity === "all" ? undefined : severity,
    uid: uidFilter || undefined,
  });

  function exportCsv() {
    const headers = ["timestamp", "action", "severity", "uid", "city", "country", "browser", "os", "deviceType", "entityId"];
    const rows = logs.map((l) => [
      fullDateTime(l.timestamp), l.action, l.severity, l.uid || "",
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
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">Audit Logs</h1>
          <p className="text-on-surface-variant font-body text-lg">Complete activity trail across the platform.</p>
        </div>
        <button onClick={exportCsv}
          className="inline-flex items-center gap-2 px-6 py-3.5 border border-outline-variant bg-white rounded-xl hover:bg-surface-container font-bold font-manrope text-sm text-on-surface shadow-sm transition-all">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </section>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-1 bg-surface-container p-1 rounded-xl">
          {SEVERITIES.map((s) => (
            <button key={s} onClick={() => setSeverity(s)}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-manrope capitalize transition-all ${
                severity === s
                  ? SEVERITY_STYLES[s]
                  : "text-on-surface-variant hover:text-on-surface"
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

      {/* Table */}
      <div className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] font-extrabold text-on-surface-variant/60 uppercase tracking-[0.2em] bg-surface-container/30 font-manrope">
                <th className="px-8 py-4 w-8" />
                <th className="px-8 py-4">Action</th>
                <th className="px-8 py-4">User</th>
                <th className="px-8 py-4">Location</th>
                <th className="px-8 py-4">Device</th>
                <th className="px-8 py-4">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {loading && Array(8).fill(0).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-8 py-4">
                  <div className="h-4 bg-surface-container rounded-lg animate-pulse" />
                </td></tr>
              ))}
              {!loading && logs.map((log) => (
                <tr key={log.id} onClick={() => setSelectedLog(log)}
                  className="group hover:bg-surface-container/20 transition-colors cursor-pointer">
                  <td className="px-8 py-4"><LogSeverityDot severity={log.severity} /></td>
                  <td className="px-8 py-4">
                    <span className="font-mono text-xs bg-surface-container px-2.5 py-1 rounded-lg text-on-surface font-bold">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-on-surface-variant font-mono text-xs">
                    {log.uid ? log.uid.slice(0, 12) + "…" : "anon"}
                  </td>
                  <td className="px-8 py-4 text-on-surface-variant text-xs">
                    {log.location?.city && log.location?.country
                      ? `${log.location.city}, ${log.location.country}`
                      : log.ip === "server" ? "Admin Panel" : "—"}
                  </td>
                  <td className="px-8 py-4 text-on-surface-variant text-xs">
                    {log.browser === "server" ? "Server" : `${log.browser} · ${log.deviceType}`}
                  </td>
                  <td className="px-8 py-4 text-on-surface-variant text-xs" title={fullDateTime(log.timestamp)}>
                    {relativeTime(log.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && logs.length === 0 && (
          <div className="text-center py-16">
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
