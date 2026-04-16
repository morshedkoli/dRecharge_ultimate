"use client";
import { useEffect, useState, useCallback } from "react";
import { BalanceRequest } from "@/types";

export function useBalanceRequests(statusFilter: "pending" | "processed" = "pending") {
  const [requests, setRequests] = useState<BalanceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/balance-requests", { credentials: "include" });
      const data = await res.json();
      let list: BalanceRequest[] = data.requests || [];

      if (statusFilter === "pending") {
        list = list.filter(r => r.status === "pending");
      } else {
        list = list.filter(r => r.status !== "pending");
      }
      setRequests(list);
    } catch (err) {
      console.error("useBalanceRequests fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  return { requests, loading, refetch: fetchRequests };
}
