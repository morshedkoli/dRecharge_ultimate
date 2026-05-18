"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AuditLogDrawer } from "@/components/admin/AuditLogDrawer";
import { DeviceStatusDot } from "@/components/admin/DeviceStatusDot";
import { useAdminStats } from "@/lib/hooks/admin/useAdminStats";
import { useAuditLogs } from "@/lib/hooks/admin/useAuditLogs";
import { useOverviewQueueStatus } from "@/lib/hooks/admin/useOverviewQueueStatus";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { relativeTime } from "@/lib/utils";
import { AuditLog } from "@/types";
import {
  Users, ListOrdered, Smartphone, Wallet, TrendingUp,
  ShieldCheck, ShieldAlert, CheckCircle2, XCircle, Loader2,
  Clock, AlertCircle, ArrowRight, Plus, Bell, Tag, Terminal,
  FileText, Activity, Zap, Inbox,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

function todayStr() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function formatBdt(n: number, decimals = 0) {
  return `৳${n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function formatLogAmount(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return null;
  return `৳${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function logRequestSummary(log: AuditLog) {
  const meta = log.meta || {};
  const serviceName = typeof meta.serviceName === "string" ? meta.serviceName : "";
  const recipientNumber = typeof meta.recipientNumber === "string" ? meta.recipientNumber : "";
  const amount = formatLogAmount(meta.amount);
  return [serviceName, recipientNumber, amount].filter(Boolean).join(" · ");
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────

type Tone = "primary" | "amber" | "blue" | "slate" | "emerald" | "rose";

const toneStyles: Record<Tone, { bg: string; text: string; ring: string }> = {
  primary: { bg: "bg-primary/10",  text: "text-primary",       ring: "ring-primary/10" },
  amber:   { bg: "bg-amber-50",    text: "text-amber-700",     ring: "ring-amber-100" },
  blue:    { bg: "bg-sky-50",      text: "text-sky-700",       ring: "ring-sky-100" },
  slate:   { bg: "bg-slate-100",   text: "text-slate-700",     ring: "ring-slate-200" },
  emerald: { bg: "bg-emerald-50",  text: "text-emerald-700",   ring: "ring-emerald-100" },
  rose:    { bg: "bg-rose-50",     text: "text-rose-700",      ring: "ring-rose-100" },
};

function KpiTile({
  icon: Icon, label, value, sub, tone, href, loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  tone: Tone;
  href?: string;
  loading: boolean;
}) {
  const t = toneStyles[tone];
  const inner = (
    <div className="bg-white border border-black/5 rounded-2xl p-5 premium-shadow hover:shadow-md hover:border-primary/20 transition-all h-full flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant font-manrope">{label}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${t.bg}`}>
          <Icon className={`w-4.5 h-4.5 ${t.text}`} />
        </div>
      </div>
      {loading ? (
        <div className="h-9 w-24 animate-pulse rounded-lg bg-surface-container" />
      ) : (
        <p className="font-headline text-3xl font-extrabold text-on-surface leading-none">{value}</p>
      )}
      {sub && <div className="text-xs text-on-surface-variant mt-auto">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

// ─── Quick Action ─────────────────────────────────────────────────────────────

function QuickAction({
  href, icon: Icon, label, hint,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
}) {
  return (
    <Link href={href}
      className="group flex items-center gap-3 p-3 rounded-xl bg-white border border-black/5 hover:border-primary/30 hover:shadow-sm transition-all">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-colors">
        <Icon className="w-4.5 h-4.5 text-primary group-hover:text-on-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-on-surface font-manrope leading-tight truncate">{label}</p>
        {hint && <p className="text-[11px] text-on-surface-variant truncate">{hint}</p>}
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { stats, loading: statsLoading } = useAdminStats();
  const { logs, loading: logsLoading } = useAuditLogs();
  const { status, loading: queueLoading } = useOverviewQueueStatus();
  const { status: subStatus } = useSubscription();
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const recentLogs = useMemo(() => logs.slice(0, 6), [logs]);

  // Success rate (today)
  const todayTotal = status.completedToday + status.failedToday;
  const successRate = todayTotal > 0 ? Math.round((status.completedToday / todayTotal) * 100) : null;
  const failureRate = todayTotal > 0 ? 100 - (successRate ?? 0) : 0;

  // License pill
  const licenseValid = subStatus?.state === "active";

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 pb-12">
      {/* ── Greeting Header ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#134235] via-[#1a5446] to-[#247060] text-white p-6 md:p-8 premium-shadow">
        {/* decorative blob */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -right-4 bottom-0 w-40 h-40 rounded-full bg-white/5 blur-xl" />

        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest font-manrope font-bold text-white/70">{todayStr()}</p>
            <h1 className="font-headline text-3xl md:text-4xl font-extrabold leading-tight">
              {greeting()}, Admin
            </h1>
            <p className="text-white/80 font-body text-sm md:text-base max-w-lg">
              Here&rsquo;s a snapshot of what&rsquo;s happening across the platform right now.
            </p>
            <div className="flex flex-wrap gap-2 pt-3">
              {/* License pill */}
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold font-manrope uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                licenseValid
                  ? "bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-300/30"
                  : "bg-rose-400/20 text-rose-100 ring-1 ring-rose-300/30"
              }`}>
                {licenseValid ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                {licenseValid ? "Licence active" : "Licence issue"}
              </span>
              {/* Active device pill */}
              {!queueLoading && status.activeDevice && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold font-manrope uppercase tracking-wider px-2.5 py-1 rounded-lg bg-white/10 ring-1 ring-white/20 text-white/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-300 animate-pulse" />
                  Live: {status.activeDevice.name}
                </span>
              )}
              {/* Pending balance requests pill */}
              {!statsLoading && stats.pendingRequests > 0 && (
                <Link href="/admin/balance-requests"
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold font-manrope uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-100 ring-1 ring-amber-300/30 hover:bg-amber-400/30 transition-colors">
                  <Inbox className="w-3 h-3" />
                  {stats.pendingRequests} pending request{stats.pendingRequests !== 1 ? "s" : ""}
                  <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/admin/recharge"
              className="inline-flex items-center gap-2 bg-white text-[#134235] px-4 py-2.5 rounded-xl text-sm font-bold font-manrope hover:bg-white/90 transition-all shadow-lg">
              <Plus className="w-4 h-4" /> New Recharge
            </Link>
            <Link href="/admin/analytics"
              className="inline-flex items-center gap-2 bg-white/10 text-white px-4 py-2.5 rounded-xl text-sm font-bold font-manrope hover:bg-white/15 ring-1 ring-white/15 transition-all">
              <TrendingUp className="w-4 h-4" /> Analytics
            </Link>
          </div>
        </div>
      </section>

      {/* ── KPI Row ──────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          icon={Users} tone="primary"
          label="Total users"
          value={statsLoading ? "—" : stats.totalUsers.toLocaleString()}
          sub="All registered accounts"
          href="/admin/users"
          loading={statsLoading}
        />
        <KpiTile
          icon={Wallet} tone="emerald"
          label="Platform balance"
          value={statsLoading ? "—" : formatBdt(stats.totalBalance, 2)}
          sub="Combined wallet holdings"
          loading={statsLoading}
        />
        <KpiTile
          icon={Smartphone} tone="blue"
          label="Active devices"
          value={statsLoading ? "—" : stats.activeDevices}
          sub="Agents online & ready"
          href="/admin/devices"
          loading={statsLoading}
        />
        <KpiTile
          icon={Inbox} tone={stats.pendingRequests > 0 ? "amber" : "slate"}
          label="Pending requests"
          value={statsLoading ? "—" : stats.pendingRequests}
          sub={stats.pendingRequests > 0 ? "Need your review" : "All clear"}
          href="/admin/balance-requests"
          loading={statsLoading}
        />
      </section>

      {/* ── Queue Health + System Status ─────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Queue Health (2/3) */}
        <div className="lg:col-span-2 bg-white border border-black/5 rounded-2xl p-5 md:p-6 premium-shadow">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-headline font-bold text-lg text-[#134235]">Queue health</h2>
                <p className="text-xs text-on-surface-variant">Live • refreshes every 15s</p>
              </div>
            </div>
            <Link href="/admin/queue"
              className="inline-flex items-center gap-1 text-xs font-bold font-manrope text-primary hover:underline">
              View queue <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <QueueStat icon={Clock}        tone="amber"    label="Queued"     value={status.queued}          loading={queueLoading} />
            <QueueStat icon={Loader2}      tone="blue"     label="Processing" value={status.processing}      loading={queueLoading} spin />
            <QueueStat icon={CheckCircle2} tone="emerald"  label="Done today" value={status.completedToday}  loading={queueLoading} />
            <QueueStat icon={XCircle}      tone="rose"     label="Failed today" value={status.failedToday}    loading={queueLoading} />
          </div>

          {/* Success rate bar */}
          <div className="rounded-xl bg-surface-container/40 p-4 ring-1 ring-black/[0.03]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold font-manrope uppercase tracking-wider text-on-surface-variant">
                Today&rsquo;s success rate
              </p>
              {successRate !== null ? (
                <span className={`text-xs font-bold font-manrope ${
                  successRate >= 90 ? "text-emerald-700" : successRate >= 70 ? "text-amber-700" : "text-rose-700"
                }`}>
                  {successRate}%
                </span>
              ) : (
                <span className="text-xs text-on-surface-variant/60 italic">no jobs yet</span>
              )}
            </div>
            {successRate !== null ? (
              <>
                <div className="flex h-2 rounded-full overflow-hidden bg-rose-100">
                  <div
                    className="bg-emerald-500 transition-all duration-500"
                    style={{ width: `${successRate}%` }}
                  />
                  <div
                    className="bg-rose-400 transition-all duration-500"
                    style={{ width: `${failureRate}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] text-on-surface-variant font-manrope">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> {status.completedToday} done
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    {status.failedToday} failed <span className="w-2 h-2 rounded-full bg-rose-400" />
                  </span>
                </div>
              </>
            ) : (
              <div className="h-2 rounded-full bg-surface-container" />
            )}
          </div>
        </div>

        {/* System Status (1/3) */}
        <div className="bg-white border border-black/5 rounded-2xl p-5 md:p-6 premium-shadow">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-headline font-bold text-lg text-[#134235]">System status</h2>
          </div>

          <div className="space-y-3">
            <StatusRow label="Licence">
              {licenseValid ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold font-manrope text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                  <ShieldCheck className="w-3.5 h-3.5" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold font-manrope text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg">
                  <ShieldAlert className="w-3.5 h-3.5" /> Issue
                </span>
              )}
            </StatusRow>

            <StatusRow label="Active device">
              {queueLoading ? (
                <span className="h-4 w-16 animate-pulse rounded bg-surface-container" />
              ) : status.activeDevice ? (
                <div className="flex items-center gap-1.5">
                  <DeviceStatusDot status={status.activeDevice.status} />
                  <span className="text-xs font-bold font-manrope text-on-surface truncate max-w-[140px]">
                    {status.activeDevice.name}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-on-surface-variant/60 italic">None</span>
              )}
            </StatusRow>

            <StatusRow label="Devices online">
              {statsLoading ? (
                <span className="h-4 w-8 animate-pulse rounded bg-surface-container" />
              ) : (
                <span className="text-xs font-bold font-manrope text-on-surface">
                  {stats.activeDevices}
                </span>
              )}
            </StatusRow>

            <StatusRow label="Live throughput">
              {queueLoading ? (
                <span className="h-4 w-12 animate-pulse rounded bg-surface-container" />
              ) : (
                <span className="text-xs font-bold font-manrope text-on-surface">
                  {status.queued + status.processing} in pipeline
                </span>
              )}
            </StatusRow>
          </div>

          <Link href="/admin/devices"
            className="mt-5 w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-surface-container hover:bg-surface-container/60 text-xs font-bold font-manrope text-on-surface transition-colors">
            Manage devices <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* ── Recent Activity + Quick Actions ──────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white border border-black/5 rounded-2xl p-5 md:p-6 premium-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-headline font-bold text-lg text-[#134235]">Recent activity</h2>
                <p className="text-xs text-on-surface-variant">Click an entry to see full audit details</p>
              </div>
            </div>
            <Link href="/admin/logs"
              className="inline-flex items-center gap-1 text-xs font-bold font-manrope text-primary hover:underline">
              All logs <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {logsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-container/50" />
              ))}
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-outline-variant rounded-xl">
              <FileText className="w-7 h-7 text-on-surface-variant mx-auto mb-2" />
              <p className="text-sm text-on-surface-variant">No activity yet</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentLogs.map((log) => {
                const severityTone =
                  log.severity === "error" ? "bg-rose-500"
                  : log.severity === "warn" ? "bg-amber-500"
                  : "bg-primary";
                return (
                  <button
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-container/60 transition-colors group">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`w-2 h-2 shrink-0 rounded-full ${severityTone}`} />
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-bold font-manrope text-on-surface">
                          {log.action}
                        </span>
                        {logRequestSummary(log) && (
                          <span className="block truncate text-xs text-on-surface-variant">
                            {logRequestSummary(log)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-on-surface-variant font-manrope whitespace-nowrap">
                      {relativeTime(log.timestamp)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white border border-black/5 rounded-2xl p-5 md:p-6 premium-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ListOrdered className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-[#134235]">Quick actions</h2>
              <p className="text-xs text-on-surface-variant">Common admin tasks</p>
            </div>
          </div>
          <div className="space-y-2">
            <QuickAction href="/admin/users"            icon={Users}      label="Users"          hint="View & manage accounts" />
            <QuickAction href="/admin/services"         icon={Terminal}   label="Services"       hint="USSD flows & SMS rules" />
            <QuickAction href="/admin/categories"       icon={Tag}        label="Categories"     hint="Organise services" />
            <QuickAction href="/admin/balance-requests" icon={Inbox}      label="Balance requests" hint={stats.pendingRequests > 0 ? `${stats.pendingRequests} pending` : "All resolved"} />
            <QuickAction href="/admin/notice"           icon={Bell}       label="Notices"        hint="Push announcements" />
          </div>
        </div>
      </section>

      {selectedLog && <AuditLogDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
}

// ─── Sub components ───────────────────────────────────────────────────────────

function QueueStat({
  icon: Icon, label, value, tone, loading, spin,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: Tone;
  loading: boolean;
  spin?: boolean;
}) {
  const t = toneStyles[tone];
  return (
    <div className={`rounded-xl p-3.5 ring-1 ${t.bg} ${t.ring}`}>
      <div className="flex items-center justify-between mb-1.5">
        <Icon className={`w-4 h-4 ${t.text} ${spin && value > 0 ? "animate-spin" : ""}`} />
        <p className={`text-[10px] font-bold font-manrope uppercase tracking-wider ${t.text}`}>{label}</p>
      </div>
      {loading ? (
        <div className="h-7 w-12 animate-pulse rounded bg-white/40" />
      ) : (
        <p className={`font-headline text-2xl font-extrabold ${t.text} leading-none`}>{value}</p>
      )}
    </div>
  );
}

function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-black/[0.04] last:border-0 last:pb-0">
      <span className="text-xs font-manrope text-on-surface-variant">{label}</span>
      {children}
    </div>
  );
}
