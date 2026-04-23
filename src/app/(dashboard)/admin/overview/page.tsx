"use client";

import Link from "next/link";
import { useState } from "react";
import { AuditLogDrawer } from "@/components/admin/AuditLogDrawer";
import { DeviceStatusDot } from "@/components/admin/DeviceStatusDot";
import { useAdminStats } from "@/lib/hooks/admin/useAdminStats";
import { useAuditLogs } from "@/lib/hooks/admin/useAuditLogs";
import { useOverviewQueueStatus } from "@/lib/hooks/admin/useOverviewQueueStatus";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { relativeTime } from "@/lib/utils";
import { AuditLog } from "@/types";
import {
  Users, Inbox, ListOrdered, Smartphone,
  CheckCircle2, AlertTriangle, Cpu, TrendingUp, ShieldCheck, ShieldAlert
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function MetricCard({ label, value, sub, loading }: { label: string; value: string | number; sub?: string; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-wider">{label}</CardDescription>
        {loading ? (
          <div className="h-8 w-16 animate-pulse rounded bg-surface-container" />
        ) : (
          <CardTitle className="text-3xl">{value}</CardTitle>
        )}
      </CardHeader>
      {sub && (
        <CardContent>
          <div className="text-xs text-on-surface-variant/60">{sub}</div>
        </CardContent>
      )}
    </Card>
  );
}

export default function OverviewPage() {
  const { stats, loading: statsLoading } = useAdminStats();
  const { logs, loading: logsLoading } = useAuditLogs();
  const { status, loading: queueLoading } = useOverviewQueueStatus();
  const { status: subStatus } = useSubscription();
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const recentLogs = logs.slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#134235]">Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/analytics"><TrendingUp className="mr-2 h-4 w-4" />Analytics</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/history"><ListOrdered className="mr-2 h-4 w-4" />Open Queue</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Row 1: System & User Stats */}
        <MetricCard label="Total Users" value={stats.totalUsers} sub="Registered accounts" loading={statsLoading} />
        <MetricCard label="Platform Balance" value={`৳${stats.totalBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} sub="Combined wallet balance" loading={statsLoading} />
        <MetricCard label="Active Devices" value={stats.activeDevices} sub="Online & Ready" loading={statsLoading} />
        <MetricCard label="Pending Req." value={stats.pendingRequests} sub="Balance requests" loading={statsLoading} />

        {/* Row 2: Queue Stats */}
        <MetricCard label="Queued" value={status.queued} sub="Waiting in line" loading={queueLoading} />
        <MetricCard label="Processing" value={status.processing} sub="Currently running" loading={queueLoading} />
        <MetricCard label="Completed" value={status.completedToday} sub="Today" loading={queueLoading} />
        <MetricCard label="Failed" value={status.failedToday} sub="Today" loading={queueLoading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-on-surface-variant">Active Device</span>
              {queueLoading ? (
                <span className="h-4 w-16 animate-pulse bg-surface-container" />
              ) : status.activeDevice ? (
                <div className="flex items-center gap-2 font-medium">
                  <DeviceStatusDot status={status.activeDevice.status} />
                  {status.activeDevice.name}
                </div>
              ) : (
                <span className="text-on-surface-variant/50">None</span>
              )}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-on-surface-variant">Licence</span>
              {subStatus?.state === "active" ? (
                <span className="flex items-center gap-1 text-[#134235] font-medium"><ShieldCheck className="h-4 w-4" /> Valid</span>
              ) : (
                <span className="flex items-center gap-1 text-red-600 font-medium"><ShieldAlert className="h-4 w-4" /> Issue</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Recent Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse rounded bg-surface-container/50" />)}
              </div>
            ) : (
              <div className="space-y-1">
                {recentLogs.map((log) => (
                  <button
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left hover:bg-surface-container"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className={`h-2 w-2 shrink-0 rounded-full ${log.severity === "error" ? "bg-red-500" : log.severity === "warn" ? "bg-amber-500" : "bg-primary"}`} />
                      <span className="truncate text-sm font-medium">{log.action}</span>
                    </div>
                    <span className="shrink-0 text-xs text-on-surface-variant/50">{relativeTime(log.timestamp)}</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedLog && <AuditLogDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
}
