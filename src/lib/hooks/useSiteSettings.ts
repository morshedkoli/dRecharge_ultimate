"use client";
import { useEffect, useState } from "react";

export interface PublicSettings {
  appName: string;
  logoUrl: string;
  primaryColor: string;
  noticeText: string;
  isNoticeEnabled: boolean;
  bannerUrls: string[];
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings(data))
      .catch((err) => console.error("Failed to fetch site settings", err))
      .finally(() => setLoading(false));
  }, []);

  return { settings, loading };
}
