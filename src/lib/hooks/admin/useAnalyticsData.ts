"use client";
import { useEffect, useState, useCallback } from "react";
import { ExecutionJob } from "@/types";

export interface DailyAggregatedData {
  date: string;
  successCount: number;
  failedCount: number;
  totalVolume: number;
}

export interface ServiceAggregatedData {
  serviceId: string;
  count: number;
}

export function useAnalyticsData(daysToFetch = 30) {
  const [dailyData, setDailyData] = useState<DailyAggregatedData[]>([]);
  const [serviceData, setServiceData] = useState<ServiceAggregatedData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/queue", { credentials: "include" });
      const data = await res.json();
      const jobs: ExecutionJob[] = data.jobs || [];

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToFetch);

      const dailyMap: Record<string, DailyAggregatedData> = {};
      const serviceMap: Record<string, number> = {};

      jobs.forEach((job) => {
        const dateObj = new Date(job.createdAt);
        if (dateObj < cutoffDate) return;

        const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;

        if (!dailyMap[dateStr]) {
          dailyMap[dateStr] = { date: dateStr, successCount: 0, failedCount: 0, totalVolume: 0 };
        }

        if (job.status === "done") {
          dailyMap[dateStr].successCount += 1;
          dailyMap[dateStr].totalVolume += job.amount || 0;
        } else if (job.status === "failed") {
          dailyMap[dateStr].failedCount += 1;
        }

        const svc = job.serviceId || "unknown";
        serviceMap[svc] = (serviceMap[svc] || 0) + 1;
      });

      setDailyData(Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)));
      setServiceData(Object.entries(serviceMap).map(([id, count]) => ({ serviceId: id, count })));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load analytics";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [daysToFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { dailyData, serviceData, loading, error };
}
