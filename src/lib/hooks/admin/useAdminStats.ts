"use client";
import { useEffect, useState, useCallback } from "react";

interface AdminStats {
  totalUsers: number;
  pendingRequests: number;
  jobsInQueue: number;
  activeDevices: number;
}

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats>({ totalUsers: 0, pendingRequests: 0, jobsInQueue: 0, activeDevices: 0 });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const [usersRes, reqRes, queueRes, devicesRes] = await Promise.all([
        fetch("/api/admin/users", { credentials: "include" }),
        fetch("/api/admin/balance-requests", { credentials: "include" }),
        fetch("/api/admin/queue", { credentials: "include" }),
        fetch("/api/admin/devices/token", { credentials: "include" }),
      ]);

      const [usersData, reqData, queueData, devicesData] = await Promise.all([
        usersRes.json(),
        reqRes.json(),
        queueRes.json(),
        devicesRes.json(),
      ]);

      const pendingReqs = (reqData.requests || []).filter((r: { status: string }) => r.status === "pending").length;
      const queuedJobs = (queueData.jobs || []).filter((j: { status: string }) => j.status === "queued").length;
      const activeDevs = (devicesData.devices || []).filter((d: { status: string }) => ["online", "busy"].includes(d.status)).length;

      setStats({
        totalUsers: (usersData.users || []).length,
        pendingRequests: pendingReqs,
        jobsInQueue: queuedJobs,
        activeDevices: activeDevs,
      });
    } catch (err) {
      console.error("useAdminStats error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading };
}
