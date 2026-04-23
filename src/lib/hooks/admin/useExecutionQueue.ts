"use client";
import { useEffect, useState, useCallback } from "react";
import { ExecutionJob, JobStatus } from "@/types";

interface QueueFilters {
  status?: JobStatus | "all";
  page?: number;
  limit?: number;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useExecutionQueue(filters: QueueFilters = {}) {
  const [jobs, setJobs] = useState<ExecutionJob[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [stats, setStats] = useState<Record<string, { count: number; amount: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (filters.status) query.set("status", filters.status);
      if (filters.page) query.set("page", filters.page.toString());
      if (filters.limit) query.set("limit", filters.limit.toString());

      const res = await fetch(`/api/admin/history?${query.toString()}`, { credentials: "include" });
      const data = await res.json();
      
      setJobs(data.jobs || []);
      setPagination(data.pagination || null);
      setStats(data.stats || {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load queue";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.page, filters.limit]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  return { jobs, pagination, stats, loading, error, refetch: fetchJobs };
}
