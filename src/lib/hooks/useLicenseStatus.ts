"use client";
import { useCallback, useEffect, useState } from "react";
import type { LicenseUiState } from "@/app/api/subscription/route";

export type { LicenseUiState };

export interface LicenseData {
  domain: string;
  tracked: boolean;
  available: boolean;
  status: string;
  subscribed: boolean;
  expired: boolean;
  appName: string | null;
  logoUrl: string | null;
  phoneNumber: string | null;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  checkedAt: string;
  uiState: LicenseUiState;
}

function getClientDomain(): string {
  if (typeof window === "undefined") return "";
  // Allow env override for local dev (NEXT_PUBLIC_LICENSE_DOMAIN)
  const override = process.env.NEXT_PUBLIC_LICENSE_DOMAIN;
  if (override) return override;
  return window.location.hostname;
}

export function useLicenseStatus(domain?: string) {
  const [data, setData] = useState<LicenseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resolvedDomain = domain ?? getClientDomain();

  const refetch = useCallback(async () => {
    if (!resolvedDomain) return;
    setIsLoading(true);
    setIsError(false);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/subscription?domain=${encodeURIComponent(resolvedDomain)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok || json?.error) {
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
      setData(json as LicenseData);
    } catch (err) {
      setIsError(true);
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [resolvedDomain]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, isLoading, isError, errorMessage, refetch };
}
