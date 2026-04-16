import { create } from "zustand";
import { AppUser } from "@/types";

interface AuthState {
  user: AppUser | null;
  role: string | null;
  loading: boolean;
  setUser: (user: AppUser | null, role: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  loading: true,
  setUser: (user, role) => set({ user, role, loading: false }),
  setLoading: (loading) => set({ loading }),
}));
