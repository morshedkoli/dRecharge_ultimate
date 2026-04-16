"use client";
import Link from "next/link";
import { useState, type ElementType } from "react";
import { AuditLogDrawer } from "@/components/admin/AuditLogDrawer";
import { DeviceStatusDot } from "@/components/admin/DeviceStatusDot";
import { useAdminStats } from "@/lib/hooks/admin/useAdminStats";
import { useAuditLogs } from "@/lib/hooks/admin/useAuditLogs";
import { useOverviewQueueStatus } from "@/lib/hooks/admin/useOverviewQueueStatus";
import { useAnalyticsData } from "@/lib/hooks/admin/useAnalyticsData";
import { LogSeverityDot } from "@/components/admin/LogSeverityDot";
import { relativeTime } from "@/lib/utils";
import { AuditLog } from "@/types";
import {
  Users, Inbox, ListOrdered, Smartphone,
  TrendingUp, TrendingDown, CircleCheckBig, TriangleAlert, Cpu, Download
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function MetricCard({
  label,
  value,
  trendBadge,
  trendColorClass,
  icon: Icon,
  iconBg,
  iconColor,
  loading,
}: {
  label: string;
  value: string | number;
  trendBadge: string;
  trendColorClass: string;
  icon: ElementType;
  iconBg: string;
  iconColor: string;
  loading: boolean;
}) {
  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl border border-black/5 premium-shadow card-hover transition-all duration-300 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-6">
        <div className={`p-3 rounded-xl ${iconBg}`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <span className={`text-[11px] font-bold px-3 py-1 rounded-full tracking-tight font-manrope ${trendColorClass}`}>
          {trendBadge}
        </span>
      </div>
      <div>
        <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1">{label}</p>
        <h3 className="font-headline text-3xl font-extrabold text-[#134235]">{loading ? "—" : value}</h3>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { stats, loading: statsLoading } = useAdminStats();
  const { logs, loading: logsLoading } = useAuditLogs();
  const { status, loading: queueLoading } = useOverviewQueueStatus();
  const { dailyData, loading: analyticsLoading } = useAnalyticsData(7);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const recentLogs = logs.slice(0, 10);

  return (
    <div className="p-4 sm:p-10 max-w-7xl mx-auto space-y-12">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">Dashboard Overview</h2>
          <p className="text-on-surface-variant font-body text-lg">Live operational snapshot · dRecharge Admin</p>
        </div>
        <Link 
          href="/admin/queue"
          className="bg-primary text-on-primary px-8 py-4 rounded-xl font-bold font-manrope flex items-center gap-2 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all justify-center">
          <ListOrdered className="w-5 h-5" />
          Open Queue
        </Link>
      </section>

      {/* Metric Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Total Users"
          value={stats.totalUsers}
          trendBadge="ACTIVE"
          trendColorClass="bg-surface-container text-on-surface-variant"
          icon={Users}
          iconBg="bg-[#E8F1EE]"
          iconColor="text-primary"
          loading={statsLoading}
        />
        <MetricCard
          label="Jobs in Queue"
          value={stats.jobsInQueue}
          trendBadge="PROCESSING"
          trendColorClass="bg-blue-50 text-blue-700"
          icon={Inbox}
          iconBg="bg-blue-50"
          iconColor="text-blue-700"
          loading={statsLoading}
        />
        <MetricCard
          label="Completed Today"
          value={status.completedToday}
          trendBadge={`+${status.completedToday > 0 ? 12 : 0}%`}
          trendColorClass="bg-primary/10 text-primary"
          icon={CircleCheckBig}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          loading={queueLoading}
        />
        <MetricCard
          label="Failed Today"
          value={status.failedToday}
          trendBadge={`${status.failedToday} ALERT`}
          trendColorClass={status.failedToday > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}
          icon={TriangleAlert}
          iconBg={status.failedToday > 0 ? "bg-red-50" : "bg-emerald-50"}
          iconColor={status.failedToday > 0 ? "text-red-700" : "text-emerald-700"}
          loading={queueLoading}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Chart Area */}
        <div className="lg:col-span-2 bg-white p-8 sm:p-10 rounded-2xl border border-black/5 premium-shadow">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-12 gap-4">
            <div>
              <h4 className="font-headline text-2xl font-bold text-[#134235]">Job Volume</h4>
              <p className="text-on-surface-variant text-sm mt-1">Successful vs Failed across last 7 days</p>
            </div>
            <div className="flex bg-surface-container p-1 rounded-xl">
              <button className="px-4 py-1.5 text-xs font-bold rounded-lg bg-white shadow-sm text-primary">7D</button>
              <button className="px-4 py-1.5 text-xs font-bold rounded-lg text-on-surface-variant hover:text-primary transition-colors">1M</button>
            </div>
          </div>
          
          <div className="h-72 w-full">
            {analyticsLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDEEED" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#707974", fontWeight: 800, fontFamily: "var(--font-manrope)" }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 11, fill: "#707974", fontWeight: 800, fontFamily: "var(--font-manrope)" }} axisLine={false} tickLine={false} dx={-10} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "none", fontSize: 12, boxShadow: "0 10px 30px -5px rgba(45, 90, 76, 0.15)", fontWeight: "bold", fontFamily: "var(--font-inter)" }}
                    cursor={{ fill: "#F9F9F8" }}
                  />
                  <Bar dataKey="successCount" name="Completed" fill="#2D5A4C" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failedCount" name="Failed" fill="#BFC9C3" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-surface-container rounded-2xl p-8 sm:p-10 flex flex-col premium-shadow">
          <h4 className="font-headline text-2xl font-bold text-[#134235] mb-8">Recent Activity</h4>
          <div className="space-y-8 flex-1 overflow-y-auto pr-2">
            {logsLoading && Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-2.5 h-2.5 rounded-full bg-outline-variant mt-1.5 flex-shrink-0"></div>
                <div className="space-y-2 w-full">
                   <div className="h-4 bg-outline-variant/30 rounded w-1/2"></div>
                   <div className="h-3 bg-outline-variant/30 rounded w-full"></div>
                </div>
              </div>
            ))}
            {!logsLoading && recentLogs.length === 0 && (
              <p className="text-sm text-on-surface-variant text-center">No recent activity found.</p>
            )}
            {!logsLoading && recentLogs.slice(0, 4).map((log) => {
              const DotColor = log.severity === 'error' ? 'bg-red-600' : (log.severity === 'warn' ? 'bg-amber-500' : 'bg-primary');
              return (
                <div key={log.id} className="flex gap-4 group cursor-pointer" onClick={() => setSelectedLog(log)}>
                  <div className={`w-2.5 h-2.5 rounded-full ${DotColor} mt-1.5 flex-shrink-0 group-hover:scale-125 transition-all`}></div>
                  <div>
                    <p className="text-sm font-bold text-on-surface font-manrope">{log.action}</p>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed truncate max-w-[200px] xl:max-w-[240px]">
                      {log.uid?.slice(0,12) ?? "System"} — {log.ip === "server" ? "Admin" : log.location?.city || "Unknown"}
                    </p>
                    <span className="text-[10px] font-bold text-primary mt-2 block tracking-widest uppercase">{relativeTime(log.timestamp)}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <Link href="/admin/logs" className="block text-center w-full mt-10 py-4 bg-white rounded-xl text-xs font-bold text-primary hover:bg-[#134235] hover:text-white transition-all shadow-sm font-manrope uppercase tracking-widest">
              View All Activity
          </Link>
        </div>
      </section>

      {/* Active Device */}
      {!queueLoading && status.activeDevice && (
        <section className="bg-white rounded-2xl border border-black/5 overflow-hidden premium-shadow p-8 flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="flex items-center gap-6">
             <div className="p-4 bg-amber-50 rounded-2xl text-amber-500">
               <Cpu className="w-8 h-8" />
             </div>
             <div>
               <h4 className="font-headline text-2xl font-bold text-[#134235] mb-1">Active Execution Device</h4>
               <p className="text-sm text-on-surface-variant font-medium">{status.activeDevice.name} • Provider: {status.activeDevice.simProvider}</p>
             </div>
           </div>
           <div className="flex flex-col items-end gap-3">
             <DeviceStatusDot status={status.activeDevice.status} />
             {status.activeJobId && (
               <div className="bg-surface-container px-4 py-2 rounded-lg text-xs font-manrope font-bold text-[#134235] tracking-wider uppercase">
                 Working on: <Link href={`/admin/queue/${status.activeJobId}`} className="text-primary hover:underline">{status.activeJobId.slice(0, 10)}</Link>
               </div>
             )}
           </div>
        </section>
      )}

      {selectedLog && <AuditLogDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
}
