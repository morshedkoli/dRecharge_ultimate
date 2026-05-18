"use client";
import { Menu, Wallet } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { UserMenu } from "@/components/UserMenu";
import { useProfile } from "@/lib/hooks/user/useProfile";
import { useState } from "react";

export function UserTopbar({ onMenuClick }: { onMenuClick: () => void }) {
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

      {/* Right: wallet balance + notifications + profile */}
      <div className="flex items-center gap-3">
        {/* Wallet Balance */}
        {profile && (
          <div className="hidden sm:flex items-center gap-2 bg-[#E8F1EE] border border-primary/10 px-4 py-2 rounded-xl">
            <Wallet className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-[#134235] font-manrope">
              ৳{profile.walletBalance.toLocaleString()}
            </span>
          </div>
        )}

        <NotificationBell variant="user" />

        <div className="h-6 w-px bg-outline-variant/30" />

        {/* User profile dropdown */}
        <UserMenu profileHref="/user/profile" roleLabel="Member" variant="user">
          {profile && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#E8F1EE]">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-[#134235] font-manrope">
                ৳{profile.walletBalance.toLocaleString()}
              </span>
              <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant ml-auto">Balance</span>
            </div>
          )}
        </UserMenu>
      </div>
    </header>
  );
}
