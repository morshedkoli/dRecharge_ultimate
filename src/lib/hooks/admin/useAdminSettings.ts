"use client";
import { useEffect, useState } from "react";

export interface AdminSettings {
  setupComplete: boolean;
  domain: string;
  phoneNumber: string;
  noticeText: string;
  isNoticeEnabled: boolean;
  bannerUrls: string[];
  appName: string;
  logoUrl: string;
  primaryColor: string;
  updatedAt?: Date;
}

export function useAdminSettings() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings", { credentials: "include" });
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<AdminSettings>) => {
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, ...updates }),
      });
      if (res.ok) {
        await fetchSettings();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to update settings:", err);
      return false;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return { settings, loading, updateSettings, refetch: fetchSettings };
}
