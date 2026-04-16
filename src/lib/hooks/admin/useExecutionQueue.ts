"use client";
import { useEffect, useState, useCallback } from "react";
import { ExecutionJob, JobStatus } from "@/types";

interface QueueFilters {
  status?: JobStatus | "all";
}

export function useExecutionQueue(filters: QueueFilters = {}) {
  const [jobs, setJobs] = useState<ExecutionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/queue", { credentials: "include" });
      const data = await res.json();
      let list: ExecutionJob[] = data.jobs || [];

      if (filters.status && filters.status !== "all") {
        list = list.filter(j => j.status === filters.status);
      }
      setJobs(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load queue";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filters.status]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  return { jobs, loading, error, refetch: fetchJobs };
}
