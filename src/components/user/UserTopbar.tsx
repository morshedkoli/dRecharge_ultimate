"use client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Menu, Wallet, Settings } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { useProfile } from "@/lib/hooks/user/useProfile";
import { useState } from "react";

export function UserTopbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header className="h-16 bg-surface/80 backdrop-blur-xl border-b border-black/[0.04] flex items-center justify-between px-6 lg:px-10 shrink-0 sticky top-0 z-30">
      {/* Left: mobile menu */}
      <div className="flex items-center flex-1 gap-4">
        <button onClick={onMenuClick} className="p-2 -ml-2 rounded-xl hover:bg-surface-container text-on-surface-variant transition-colors lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <div className={`relative hidden sm:flex items-center w-full max-w-sm transition-all duration-200 ${searchFocused ? "max-w-md" : ""}`}>
          <input type="text" placeholder="Search services..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-full bg-surface-container/60 border-none rounded-xl pl-4 pr-4 py-2.5 text-sm font-body text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
        </div>
      </div>

      {/* Right: wallet balance + profile */}
      <div className="flex items-center gap-4">
        {/* Wallet Balance */}
        {profile && (
          <div className="hidden sm:flex items-center gap-2 bg-[#E8F1EE] border border-primary/10 px-4 py-2 rounded-xl">
            <Wallet className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-[#134235] font-manrope">
              ৳{profile.walletBalance.toLocaleString()}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1">
          <NotificationBell variant="user" />
          <button className="w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-[#134235] hover:bg-white/60 transition-all">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <div className="h-6 w-px bg-outline-variant/30" />

        {/* User profile */}
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-[#134235] font-manrope leading-tight">
              {user?.displayName || user?.email?.split("@")[0] || "User"}
            </p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Member</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary font-bold text-sm ring-2 ring-transparent group-hover:ring-primary/20 transition-all shadow-sm font-manrope">
            {(user?.displayName || user?.email || "U").slice(0, 2).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
