"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { AgentDevice, ExecutionJob } from "@/types";
import { computeDeviceStatus } from "@/lib/utils";

interface OverviewQueueStatus {
  queued: number;
  processing: number;
  completedToday: number;
  failedToday: number;
  activeDevice: AgentDevice | null;
  activeJobId: string | null;
}

export function useOverviewQueueStatus() {
  const [jobs, setJobs] = useState<ExecutionJob[]>([]);
  const [devices, setDevices] = useState<AgentDevice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [queueRes, devicesRes] = await Promise.all([
        fetch("/api/admin/queue", { credentials: "include" }),
        fetch("/api/admin/devices/token", { credentials: "include" }),
      ]);
      const [queueData, devicesData] = await Promise.all([queueRes.json(), devicesRes.json()]);

      setJobs(queueData.jobs || []);
      setDevices((devicesData.devices || []).map((d: AgentDevice) => ({
        ...d,
        status: computeDeviceStatus(d),
      })));
    } catch (err) {
      console.error("useOverviewQueueStatus error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [fetchData]);

  const status = useMemo<OverviewQueueStatus>(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const queuedCount = jobs.filter(j => j.status === "queued").length;
    const processingJobs = jobs.filter(j => j.status === "processing");
    const completedToday = jobs.filter(j => j.status === "done" && new Date(j.createdAt) >= startOfDay).length;
    const failedToday = jobs.filter(j => j.status === "failed" && new Date(j.createdAt) >= startOfDay).length;

    const busyDevice = devices.find(d => d.status === "busy") ?? null;
    const fallbackJob = processingJobs[0] ?? null;
    const fallbackDevice = fallbackJob
      ? devices.find(d => d.deviceId === fallbackJob.lockedByDevice) ?? null
      : null;

    const activeDevice = busyDevice ?? fallbackDevice;
    const activeJobId = activeDevice?.currentJob ?? fallbackJob?.jobId ?? null;

    return { queued: queuedCount, processing: processingJobs.length, completedToday, failedToday, activeDevice, activeJobId };
  }, [jobs, devices]);

  return { status, loading };
}
