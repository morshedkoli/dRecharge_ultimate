"use client";
import { useEffect, useState } from "react";

export type SubscriptionState =
  | "active"
  | "expired"
  | "inactive"
  | "untracked"
  | "unknown";

export interface SubscriptionStatus {
  state: SubscriptionState;
  subscribed: boolean;
  tracked: boolean;
  expired: boolean;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  domain: string;
  checkedAt: string;
}

export function useSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);

  const fetchStatus = (opts?: { silent?: boolean; bust?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    else setReloading(true);
    const url = opts?.bust ? "/api/subscription?refresh=1" : "/api/subscription";
    return fetch(url, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data: SubscriptionStatus) => setStatus(data))
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setReloading(false);
      });
  };

  useEffect(() => { fetchStatus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = () => fetchStatus({ silent: true, bust: true });

  return { status, loading, reloading, refetch };
}
