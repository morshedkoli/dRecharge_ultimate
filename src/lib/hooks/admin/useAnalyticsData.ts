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

export interface SummaryStats {
  addBalance: { count: number; amount: number };
  deductBalance: { count: number; amount: number };
  requestBalance: { count: number; amount: number };
  totalTransactions: { count: number; amount: number };
}

export function useAnalyticsData(daysToFetch = 30) {
  const [dailyData, setDailyData] = useState<DailyAggregatedData[]>([]);
  const [serviceData, setServiceData] = useState<ServiceAggregatedData[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?days=${daysToFetch}`, { credentials: "include" });
      const data = await res.json();
      
      setDailyData(data.dailyData || []);
      setServiceData(data.serviceData || []);
      setSummary(data.summary || null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load analytics";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [daysToFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { dailyData, serviceData, loading, error, refetch: fetchData };
}
