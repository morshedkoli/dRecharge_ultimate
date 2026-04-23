import { useState, useEffect } from "react";
import { AppUser } from "@/types";
import { apiFetch } from "@/lib/functions";

export function useSubUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchUsers() {
    setLoading(true);
    try {
      const data = await apiFetch<{ users: AppUser[] }>("/api/user/subusers");
      setUsers(data.users);
    } catch (error) {
      console.error(error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  return { users, loading, refetch: fetchUsers };
}
