"use client";
import { useAuth } from "@/lib/hooks/useAuth";
import { useAdminStats } from "@/lib/hooks/admin/useAdminStats";
import { Bell, Settings, Menu, Search } from "lucide-react";
import { useState } from "react";

interface AdminTopbarProps {
  onMenuClick?: () => void;
}

export function AdminTopbar({ onMenuClick }: AdminTopbarProps) {
  const { user } = useAuth();
  const { stats } = useAdminStats();
  const [searchFocused, setSearchFocused] = useState(false);

  const notifCount = stats.pendingRequests || 0;

  return (
    <header className="h-16 bg-surface/80 backdrop-blur-xl border-b border-black/[0.04] flex items-center justify-between px-6 lg:px-10 shrink-0 sticky top-0 z-30">
      {/* Left: mobile menu + search */}
      <div className="flex items-center flex-1 gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-xl hover:bg-surface-container text-on-surface-variant transition-colors lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className={`relative hidden sm:flex items-center w-full max-w-sm transition-all duration-200 ${searchFocused ? "max-w-md" : ""}`}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Search system records..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-full bg-surface-container/60 border-none rounded-xl pl-11 pr-4 py-2.5 text-sm font-body text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      {/* Right: actions + profile */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <button className="relative w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-[#134235] hover:bg-white/60 transition-all">
            <Bell className="w-5 h-5" />
            {notifCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-[#134235] hover:bg-white/60 transition-all">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <div className="h-6 w-px bg-outline-variant/30" />

        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-[#134235] font-manrope leading-tight">
              {user?.email?.split("@")[0] ?? "Admin"}
            </p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Administrator</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary font-bold text-sm ring-2 ring-transparent group-hover:ring-primary/20 transition-all shadow-sm">
            {user?.email?.slice(0, 2).toUpperCase() ?? "AD"}
          </div>
        </div>
      </div>
    </header>
  );
}
