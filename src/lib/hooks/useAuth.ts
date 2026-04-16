"use client";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/stores/auth.store";

export function useAuth() {
  const { user, role, loading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function fetchMe() {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include" });
        if (cancelled) return;
        const data = await res.json();
        if (data?.user) {
          setUser(data.user, data.user.role);
        } else {
          setUser(null, null);
        }
      } catch {
        if (!cancelled) setUser(null, null);
      }
    }

    fetchMe();
    return () => { cancelled = true; };
  }, [setUser]);

  return { user, role, loading };
}
