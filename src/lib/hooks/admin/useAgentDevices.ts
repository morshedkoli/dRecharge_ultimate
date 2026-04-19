"use client";
import { useEffect, useState, useCallback } from "react";
import { AgentDevice } from "@/types";
import { computeDeviceStatus } from "@/lib/utils";

export function useAgentDevices() {
  const [devices, setDevices] = useState<AgentDevice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/devices/token", { credentials: "include" });
      const data = await res.json();
      const list: AgentDevice[] = (data.devices || []).map((d: AgentDevice) => ({
        ...d,
        status: computeDeviceStatus(d),
      }));
      setDevices(list);
    } catch (err) {
      console.error("useAgentDevices fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const silentRefetch = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/devices/token", { credentials: "include" });
      const data = await res.json();
      const list: AgentDevice[] = (data.devices || []).map((d: AgentDevice) => ({
        ...d,
        status: computeDeviceStatus(d),
      }));
      setDevices(list);
    } catch (err) {
      console.error("useAgentDevices fetch error:", err);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  return { devices, loading, refetch: fetchDevices, silentRefetch };
}
