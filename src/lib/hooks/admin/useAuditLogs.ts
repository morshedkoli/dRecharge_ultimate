"use client";
import { useEffect, useState, useCallback } from "react";
import { AuditLog, LogSeverity } from "@/types";

interface LogFilters {
  severity?: LogSeverity | "all";
  uid?: string;
}

export function useAuditLogs(filters: LogFilters = {}) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.severity && filters.severity !== "all") params.set("severity", filters.severity);
      const res = await fetch(`/api/admin/logs?${params}`, { credentials: "include" });
      const data = await res.json();
      let list: AuditLog[] = data.logs || [];
      if (filters.uid) list = list.filter(l => l.uid === filters.uid);
      setLogs(list);
    } catch (err) {
      console.error("useAuditLogs fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [filters.severity, filters.uid]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return { logs, loading, refetch: fetchLogs };
}
