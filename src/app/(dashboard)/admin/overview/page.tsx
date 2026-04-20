"use client";
import Link from "next/link";
import { useState, type ElementType } from "react";
import { AuditLogDrawer } from "@/components/admin/AuditLogDrawer";
import { DeviceStatusDot } from "@/components/admin/DeviceStatusDot";
import { useAdminStats } from "@/lib/hooks/admin/useAdminStats";
import { useAuditLogs } from "@/lib/hooks/admin/useAuditLogs";
import { useOverviewQueueStatus } from "@/lib/hooks/admin/useOverviewQueueStatus";
import { useAnalyticsData } from "@/lib/hooks/admin/useAnalyticsData";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { relativeTime } from "@/lib/utils";
import { AuditLog } from "@/types";
import {
  Users, Inbox, ListOrdered, Smartphone,
  CircleCheckBig, TriangleAlert, AlertTriangle, Cpu, ArrowUpRight,
  Activity, Clock, TrendingUp, ExternalLink,
  ShieldCheck, ShieldOff, ShieldAlert, Globe, RefreshCw,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

/* ─────────────────────────────────────────────────────────────── */
/* Metric Card                                                     */
/* ─────────────────────────────────────────────────────────────── */
function MetricCard({
  label, value, sub, icon: Icon, accent, loading, href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ElementType;
  accent: "green" | "blue" | "emerald" | "red";
  loading: boolean;
  href?: string;
}) {
  const accents = {
    green:   { bg: "bg-[#EBF3EE]", icon: "text-[#2D5A4C]",  ring: "ring-[#2D5A4C]/10" },
    blue:    { bg: "bg-blue-50",   icon: "text-blue-600",    ring: "ring-blue-500/10" },
    emerald: { bg: "bg-emerald-50",icon: "text-emerald-600", ring: "ring-emerald-500/10" },
    red:     { bg: "bg-red-50",    icon: "text-red-500",     ring: "ring-red-500/10" },
  };
  const a = accents[accent];

  const inner = (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-black/[0.05] premium-shadow card-hover flex flex-col gap-4 h-full">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${a.bg} ring-1 ${a.ring}`}>
          <Icon className={`w-5 h-5 ${a.icon}`} />
        </div>
        {href && (
          <ArrowUpRight className="w-4 h-4 text-on-surface-variant/30 group-hover:text-on-surface-variant/70 transition-colors" />
        )}
      </div>
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-on-surface-variant/50 font-manrope mb-1">
          {label}
        </p>
        {loading ? (
          <div className="h-8 w-20 bg-[#F4F6F5] rounded-lg shimmer" />
        ) : (
          <p className="font-manrope text-3xl font-extrabold text-[#134235] leading-none tabular-nums">
            {value}
          </p>
        )}
        {sub && !loading && (
          <p className="text-xs text-on-surface-variant/60 mt-1.5 font-manrope">{sub}</p>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="group block h-full">{inner}</Link>;
  }
  return <div className="h-full">{inner}</div>;
}

/* ─────────────────────────────────────────────────────────────── */
/* Activity timeline item                                         */
/* ─────────────────────────────────────────────────────────────── */
function ActivityItem({ log, onClick }: { log: AuditLog; onClick: () => void }) {
  const dotColor =
    log.severity === "error" ? "bg-red-500"
    : log.severity === "warn" ? "bg-amber-500"
    : "bg-[#2D5A4C]";
  const pillColor =
    log.severity === "error" ? "bg-red-50 text-red-600"
    : log.severity === "warn" ? "bg-amber-50 text-amber-700"
    : "bg-[#EBF3EE] text-[#2D5A4C]";

  return (
    <button
      onClick={onClick}
      className="flex gap-3.5 text-left group w-full hover:bg-[#F4F6F5] rounded-xl px-3 py-2.5 -mx-3 transition-colors"
    >
      <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
        <div className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
        <div className="w-px flex-1 bg-black/[0.06] min-h-[12px]" />
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-start gap-2 flex-wrap">
          <p className="text-[13px] font-bold text-[#134235] font-manrope leading-tight flex-1 truncate">
            {log.action}
          </p>
          <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full font-manrope shrink-0 ${pillColor}`}>
            {log.severity}
          </span>
        </div>
        <p className="text-xs text-on-surface-variant/60 mt-0.5 truncate">
          {log.uid?.slice(0, 12) ?? "System"} · {log.ip === "server" ? "Admin" : log.location?.city || "Unknown"}
        </p>
        <p className="text-[10px] font-bold text-on-surface-variant/40 mt-1 uppercase tracking-widest font-manrope">
          {relativeTime(log.timestamp)}
        </p>
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Custom chart tooltip                                           */
/* ─────────────────────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl border border-black/[0.06] shadow-card px-4 py-3 text-xs font-manrope min-w-[130px]">
      <p className="font-extrabold text-[#134235] mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="text-on-surface-variant/70">{p.name}</span>
          <span className="font-bold tabular-nums" style={{ color: p.color }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Skeleton loader                                                */
/* ─────────────────────────────────────────────────────────────── */
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-[#F4F6F5] rounded-lg shimmer ${className}`} />;
}

/* ─────────────────────────────────────────────────────────────── */
/* Subscription status card                                       */
/* ─────────────────────────────────────────────────────────────── */
function SubscriptionCard() {
  const { status, loading, reloading, refetch } = useSubscription();

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-black/[0.05] premium-shadow p-5 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#F4F6F5]" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3.5 w-28 bg-[#F4F6F5] rounded" />
            <div className="h-2.5 w-20 bg-[#F4F6F5] rounded" />
          </div>
          <div className="h-6 w-20 bg-[#F4F6F5] rounded-full" />
        </div>
        <div className="h-1.5 w-full bg-[#F4F6F5] rounded-full" />
      </div>
    );
  }

  if (!status) return null;

  const state = status.state;

  // ── Visual config per state ──────────────────────────────────
  const stateConfig = {
    active: {
      badge: { label: "Active",     bg: "bg-[#EBF3EE]", text: "text-[#2D5A4C]", border: "border-[#C3D9CE]" },
      icon: ShieldCheck, iconBg: "bg-[#EBF3EE]", iconColor: "text-[#2D5A4C]",
      cardBorder: "border-black/[0.05]", barColor: "bg-[#2D5A4C]",
      expiryLabel: "Expires", expiryColor: "text-[#134235]",
      cta: null,
    },
    expired: {
      badge: { label: "Expired",    bg: "bg-red-50",    text: "text-red-600",   border: "border-red-200" },
      icon: ShieldOff, iconBg: "bg-red-50", iconColor: "text-red-500",
      cardBorder: "border-red-100", barColor: "bg-red-400",
      expiryLabel: "Expired on", expiryColor: "text-red-600",
      cta: { label: "Renew Subscription — Transactions Suspended", style: "bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-200" },
    },
    inactive: {
      badge: { label: "Inactive",   bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200" },
      icon: ShieldAlert, iconBg: "bg-orange-50", iconColor: "text-orange-500",
      cardBorder: "border-orange-100", barColor: "bg-orange-400",
      expiryLabel: "Expires", expiryColor: "text-orange-600",
      cta: { label: "Get Subscription", style: "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100" },
    },
    untracked: {
      badge: { label: "Unregistered", bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-200" },
      icon: ShieldOff, iconBg: "bg-gray-100", iconColor: "text-gray-500",
      cardBorder: "border-gray-200", barColor: "bg-gray-300",
      expiryLabel: "Expires", expiryColor: "text-gray-500",
      cta: null,
    },
    unknown: {
      badge: { label: "Unknown",    bg: "bg-gray-100",  text: "text-gray-500",  border: "border-gray-200" },
      icon: ShieldCheck, iconBg: "bg-gray-100", iconColor: "text-gray-400",
      cardBorder: "border-black/[0.05]", barColor: "bg-gray-300",
      expiryLabel: "Expires", expiryColor: "text-gray-500",
      cta: null,
    },
  } as const;

  const cfg = stateConfig[state] ?? stateConfig.unknown;
  const BadgeIcon = cfg.icon;

  // Progress bar — 0-365d
  const barPct = status.daysUntilExpiry !== null && state === "active"
    ? Math.max(0, Math.min(100, (status.daysUntilExpiry / 365) * 100))
    : 0;

  const isWarning = state === "active" && status.daysUntilExpiry !== null && status.daysUntilExpiry <= 14;

  return (
    <div className={`bg-white rounded-2xl border premium-shadow p-5 ${cfg.cardBorder}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-xl shrink-0 ${cfg.iconBg}`}>
            <BadgeIcon className={`w-5 h-5 ${cfg.iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-on-surface-variant/50 font-manrope">
              Licence
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Globe className="w-3 h-3 text-on-surface-variant/40 shrink-0" />
              <p className="text-sm font-bold text-[#134235] font-manrope font-mono truncate">
                {status.domain || "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* State badge */}
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold font-manrope border ${cfg.badge.bg} ${cfg.badge.text} ${cfg.badge.border}`}>
            <BadgeIcon className="w-3 h-3" />
            {cfg.badge.label}
          </span>
          {/* Reload button */}
          <button
            onClick={refetch}
            disabled={reloading}
            title="Check subscription now"
            className="p-1.5 rounded-lg text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-[#F4F6F5] transition-all disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reloading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Sub-details: tracked + subscribed flags */}
      <div className="flex items-center gap-4 mb-3 text-[10px] font-bold font-manrope uppercase tracking-widest">
        <span className={status.tracked ? "text-[#2D5A4C]" : "text-red-500"}>
          {status.tracked ? "✓ Tracked" : "✗ Not tracked"}
        </span>
        <span className={status.subscribed ? "text-[#2D5A4C]" : "text-red-500"}>
          {status.subscribed ? "✓ Subscribed" : "✗ Not subscribed"}
        </span>
        <span className={!status.expired ? "text-[#2D5A4C]" : "text-red-500"}>
          {status.expired ? "✗ Expired" : "✓ Not expired"}
        </span>
      </div>

      {/* Expiry info */}
      <div className="flex items-center justify-between text-xs font-manrope mb-2.5">
        {status.expiresAt ? (
          <>
            <span className="text-on-surface-variant/60">{cfg.expiryLabel}</span>
            <div className="flex items-center gap-2">
              <span className={`font-bold ${isWarning ? "text-amber-700" : cfg.expiryColor}`}>
                {new Date(status.expiresAt).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </span>
              {status.daysUntilExpiry !== null && (
                <span className={[
                  "px-1.5 py-0.5 rounded-md text-[10px] font-extrabold font-manrope tabular-nums",
                  status.daysUntilExpiry <= 0 || state === "expired"
                    ? "bg-red-50 text-red-600 border border-red-200"
                    : isWarning
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-[#EBF3EE] text-[#2D5A4C] border border-[#C3D9CE]",
                ].join(" ")}>
                  {status.daysUntilExpiry <= 0
                    ? `${Math.abs(status.daysUntilExpiry)}d ago`
                    : `${status.daysUntilExpiry}d left`}
                </span>
              )}
            </div>
          </>
        ) : (
          <span className="text-on-surface-variant/40 italic">No expiry data</span>
        )}
      </div>

      {/* Progress bar */}
      {status.expiresAt && (
        <div className="h-1.5 w-full rounded-full bg-[#F4F6F5] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${isWarning ? "bg-amber-400" : cfg.barColor}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      )}

      {/* CTA */}
      {state === "untracked" ? (
        <div className="mt-3 flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-left">
          <AlertTriangle className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-gray-500 font-manrope leading-relaxed">
            Contact your <strong className="text-gray-700">dRecharge administrator</strong> to register this domain and activate a subscription.
          </p>
        </div>
      ) : (cfg.cta || isWarning) ? (
        <a
          href="https://drecharge.com"
          target="_blank"
          rel="noopener noreferrer"
          className={[
            "mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-bold font-manrope transition-all",
            isWarning && state === "active"
              ? "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
              : cfg.cta?.style ?? "",
          ].join(" ")}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {isWarning && state === "active" ? "Renew Subscription" : cfg.cta?.label}
        </a>
      ) : null}

      {/* Last checked */}
      <p className="text-[10px] text-on-surface-variant/30 font-manrope mt-2.5 text-right">
        Checked {relativeTime(status.checkedAt)}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Page                                                           */
/* ─────────────────────────────────────────────────────────────── */
export default function OverviewPage() {
  const { stats, loading: statsLoading }           = useAdminStats();
  const { logs, loading: logsLoading }             = useAuditLogs();
  const { status, loading: queueLoading }          = useOverviewQueueStatus();
  const { dailyData, loading: analyticsLoading }   = useAnalyticsData(7);
  const [selectedLog, setSelectedLog]              = useState<AuditLog | null>(null);

  const today    = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const recentLogs = logs.slice(0, 6);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50 font-manrope mb-0.5">
            {today}
          </p>
          <h1 className="font-manrope text-2xl font-extrabold tracking-tight text-[#134235]">
            Good day, overview is ready
          </h1>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/admin/analytics"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-black/[0.08] bg-white text-sm font-bold font-manrope text-[#134235] hover:bg-[#F4F6F5] transition-all shadow-sm"
          >
            <TrendingUp className="w-4 h-4" />
            Analytics
          </Link>
          <Link
            href="/admin/queue"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#134235] text-white text-sm font-bold font-manrope hover:bg-[#0D2B21] transition-all shadow-md shadow-[#134235]/20"
          >
            <ListOrdered className="w-4 h-4" />
            Open Queue
          </Link>
        </div>
      </div>

      {/* ── Metric cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label="Total Users"
          value={stats.totalUsers}
          sub="Registered accounts"
          icon={Users}
          accent="green"
          loading={statsLoading}
          href="/admin/users"
        />
        <MetricCard
          label="Jobs in Queue"
          value={stats.jobsInQueue}
          sub={`${status.processing} processing now`}
          icon={Inbox}
          accent="blue"
          loading={statsLoading || queueLoading}
          href="/admin/queue"
        />
        <MetricCard
          label="Completed Today"
          value={status.completedToday}
          sub="Successful executions"
          icon={CircleCheckBig}
          accent="emerald"
          loading={queueLoading}
        />
        <MetricCard
          label="Failed Today"
          value={status.failedToday}
          sub={status.failedToday > 0 ? "Requires attention" : "No failures"}
          icon={TriangleAlert}
          accent={status.failedToday > 0 ? "red" : "emerald"}
          loading={queueLoading}
        />
      </div>

      {/* ── Subscription ────────────────────────────────────────────── */}
      <SubscriptionCard />

      {/* ── Middle row: Chart + Sidebar ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-black/[0.05] premium-shadow p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="font-manrope text-[15px] font-extrabold text-[#134235]">Job Volume</h3>
              <p className="text-xs text-on-surface-variant/60 mt-0.5">Completed vs failed — last 7 days</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-manrope font-bold">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#2D5A4C] inline-block" />
                <span className="text-on-surface-variant/60">Completed</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#BFC9C3] inline-block" />
                <span className="text-on-surface-variant/60">Failed</span>
              </span>
            </div>
          </div>
          <div className="h-56 w-full">
            {analyticsLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-7 h-7 border-[3px] border-[#2D5A4C] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barGap={4} barCategoryGap="32%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#9AADA7", fontWeight: 800, fontFamily: "var(--font-manrope)" }}
                    axisLine={false} tickLine={false} dy={8}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9AADA7", fontWeight: 800, fontFamily: "var(--font-manrope)" }}
                    axisLine={false} tickLine={false} dx={-4}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.025)", radius: 8 }} />
                  <Bar dataKey="successCount" name="Completed" fill="#2D5A4C" radius={[5, 5, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="failedCount"  name="Failed"    fill="#D1DBD7" radius={[5, 5, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right panel: Queue status + Active device */}
        <div className="flex flex-col gap-4">

          {/* Queue status */}
          <div className="bg-white rounded-2xl border border-black/[0.05] premium-shadow p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-manrope text-[14px] font-extrabold text-[#134235]">Queue Status</h3>
              <Link href="/admin/queue" className="text-[10px] font-bold text-primary hover:underline font-manrope uppercase tracking-widest flex items-center gap-1">
                View <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {[
                { label: "Queued",     value: status.queued,     color: "bg-outline-variant" },
                { label: "Processing", value: status.processing,  color: "bg-blue-400" },
                { label: "Completed",  value: status.completedToday, color: "bg-[#2D5A4C]" },
                { label: "Failed",     value: status.failedToday,   color: "bg-red-400" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${row.color} shrink-0`} />
                  <span className="text-xs text-on-surface-variant font-manrope font-semibold flex-1">{row.label}</span>
                  {queueLoading
                    ? <Skeleton className="w-6 h-4" />
                    : <span className="text-sm font-extrabold text-[#134235] font-manrope tabular-nums">{row.value}</span>
                  }
                </div>
              ))}
            </div>
          </div>

          {/* Active device */}
          <div className={`bg-white rounded-2xl border border-black/[0.05] premium-shadow p-5 flex-1 flex flex-col justify-between gap-4 ${!status.activeDevice && !queueLoading ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-manrope text-[14px] font-extrabold text-[#134235]">Active Device</h3>
              <div className="p-2 bg-amber-50 rounded-xl">
                <Cpu className="w-4 h-4 text-amber-500" />
              </div>
            </div>
            {queueLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ) : status.activeDevice ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <DeviceStatusDot status={status.activeDevice.status} />
                  <p className="text-sm font-bold text-[#134235] font-manrope">{status.activeDevice.name}</p>
                </div>
                <p className="text-xs text-on-surface-variant/60">SIM: {status.activeDevice.simProvider}</p>
                {status.activeJobId && (
                  <Link
                    href={`/admin/queue/${status.activeJobId}`}
                    className="inline-flex items-center gap-1.5 mt-3 text-[10px] font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg font-manrope hover:bg-primary/15 transition-colors"
                  >
                    <Activity className="w-3 h-3" />
                    Job: {status.activeJobId.slice(0, 12)}…
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-on-surface-variant/50 font-manrope">
                <Smartphone className="w-4 h-4" />
                No active device
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Activity feed ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-black/[0.05] premium-shadow">
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-black/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#EBF3EE] rounded-xl">
              <Clock className="w-4 h-4 text-[#2D5A4C]" />
            </div>
            <div>
              <h3 className="font-manrope text-[14px] font-extrabold text-[#134235]">Recent Activity</h3>
              <p className="text-[10px] text-on-surface-variant/50 font-manrope">Latest system audit events</p>
            </div>
          </div>
          <Link
            href="/admin/logs"
            className="text-[10px] font-bold text-primary hover:underline font-manrope uppercase tracking-widest flex items-center gap-1"
          >
            All logs <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="px-5 sm:px-7 py-4">
          {logsLoading && (
            <div className="space-y-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3 px-3 py-2.5 animate-pulse">
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <div className="w-2 h-2 rounded-full bg-[#F4F6F5] shrink-0" />
                    <div className="w-px h-8 bg-[#F4F6F5]" />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!logsLoading && recentLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-on-surface-variant/40">
              <Activity className="w-8 h-8 mb-2" />
              <p className="text-sm font-manrope font-semibold">No activity yet</p>
            </div>
          )}
          {!logsLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
              {recentLogs.map((log) => (
                <ActivityItem key={log.id} log={log} onClick={() => setSelectedLog(log)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedLog && (
        <AuditLogDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
