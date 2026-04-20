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

  useEffect(() => {
    fetch("/api/subscription", { credentials: "include" })
      .then((r) => r.json())
      .then((data: SubscriptionStatus) => setStatus(data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  return { status, loading };
}
