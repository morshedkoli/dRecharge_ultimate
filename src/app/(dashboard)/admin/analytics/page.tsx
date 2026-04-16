"use client";
import { useAnalyticsData } from "@/lib/hooks/admin/useAnalyticsData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#2D5A4C", "#BFC9C3", "#1E3D33", "#707974", "#404945"];

function Spinner() {
  return (
    <div className="h-64 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function AnalyticsPage() {
  const { dailyData, serviceData, loading, error } = useAnalyticsData(30);

  if (error) {
    return (
      <div className="m-10 bg-red-50 border border-red-100 text-red-700 p-6 rounded-2xl">
        <h3 className="font-headline font-bold text-red-900 mb-1">Error loading analytics</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-10 pb-12">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">Analytics</h1>
          <p className="text-on-surface-variant font-body text-lg">System performance overview · last 30 days</p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Daily Volume */}
        <div className="bg-white border border-black/5 rounded-2xl p-8 premium-shadow">
          <div className="mb-8">
            <h2 className="font-headline text-2xl font-bold text-[#134235]">Daily Volume</h2>
            <p className="text-on-surface-variant text-sm mt-1">Successful transaction totals in BDT</p>
          </div>
          {loading ? <Spinner /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDEEED" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#707974", fontWeight: 800, fontFamily: "var(--font-manrope)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#707974", fontWeight: 800 }} axisLine={false} tickLine={false} tickFormatter={(v) => `৳${v}`} />
                  <Tooltip
                    formatter={(value: number) => [`৳${value.toLocaleString()}`, "Volume"]}
                    contentStyle={{ borderRadius: "12px", border: "none", fontSize: 12, boxShadow: "0 10px 30px -5px rgba(45,90,76,0.12)", fontWeight: "bold" }}
                    cursor={{ fill: "#F9F9F8" }}
                  />
                  <Bar dataKey="totalVolume" name="Daily Volume" fill="#2D5A4C" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 2: Success vs Failed */}
        <div className="bg-white border border-black/5 rounded-2xl p-8 premium-shadow">
          <div className="mb-8">
            <h2 className="font-headline text-2xl font-bold text-[#134235]">Execution Health</h2>
            <p className="text-on-surface-variant text-sm mt-1">Successful vs Failed transactions</p>
          </div>
          {loading ? <Spinner /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2D5A4C" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2D5A4C" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDEEED" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#707974", fontWeight: 800 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#707974", fontWeight: 800 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "none", fontSize: 12, boxShadow: "0 10px 30px -5px rgba(45,90,76,0.12)", fontWeight: "bold" }}
                    cursor={{ fill: "#F9F9F8" }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="successCount" name="Successful"
                    stroke="#2D5A4C" fill="url(#colorSuccess)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="failedCount" name="Failed"
                    stroke="#ef4444" fill="url(#colorFailed)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 3: Service Usage */}
        <div className="bg-white border border-black/5 rounded-2xl p-8 premium-shadow lg:col-span-2">
          <div className="mb-8">
            <h2 className="font-headline text-2xl font-bold text-[#134235]">Service Usage</h2>
            <p className="text-on-surface-variant text-sm mt-1">Distribution of jobs processed by service type</p>
          </div>
          {loading ? <Spinner /> : serviceData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-on-surface-variant">No data available</div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={serviceData} cx="50%" cy="50%" innerRadius={75} outerRadius={105}
                    paddingAngle={4} dataKey="count" nameKey="serviceId"
                    label={({ serviceId, percent }) => `${serviceId.slice(0, 8)} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {serviceData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [v, "Jobs"]}
                    contentStyle={{ borderRadius: "12px", border: "none", fontSize: 12, boxShadow: "0 10px 30px -5px rgba(45,90,76,0.12)" }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
