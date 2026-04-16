"use client";
import { useEffect, useState, useCallback } from "react";
import { AppUser, UserRole, UserStatus } from "@/types";

interface UserFilters {
  role?: UserRole | "all";
  status?: UserStatus | "all";
  search?: string;
}

export function useUsers(filters: UserFilters = {}) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      const data = await res.json();
      let list: AppUser[] = data.users || [];

      if (filters.role && filters.role !== "all") list = list.filter(u => u.role === filters.role);
      if (filters.status && filters.status !== "all") list = list.filter(u => u.status === filters.status);
      if (filters.search) {
        const s = filters.search.toLowerCase();
        list = list.filter(u => u.displayName?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s));
      }
      setUsers(list);
    } catch (err) {
      console.error("useUsers fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [filters.role, filters.status, filters.search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  return { users, loading, refetch: fetchUsers };
}
