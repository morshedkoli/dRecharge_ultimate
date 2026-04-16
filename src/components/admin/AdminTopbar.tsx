"use client";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useAdminStats } from "@/lib/hooks/admin/useAdminStats";
import { Bell, Menu, ChevronRight } from "lucide-react";

/* ── Route metadata ─────────────────────────────────────────────────────── */
const ROUTE_META: Record<string, { title: string; crumb?: string }> = {
  "/admin/overview":         { title: "Dashboard" },
  "/admin/users":            { title: "Users",            crumb: "Management" },
  "/admin/balance-requests": { title: "Balance Requests", crumb: "Operations" },
  "/admin/queue":            { title: "Execution Queue",  crumb: "Operations" },
  "/admin/analytics":        { title: "Analytics",        crumb: "Operations" },
  "/admin/categories":       { title: "Categories",       crumb: "Management" },
  "/admin/services":         { title: "Services",         crumb: "Management" },
  "/admin/devices":          { title: "Devices",          crumb: "Management" },
  "/admin/logs":             { title: "Audit Logs",       crumb: "System" },
  "/admin/admins":           { title: "Staff & Roles",    crumb: "System" },
};

function resolveRoute(pathname: string) {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];
  // Dynamic sub-routes (e.g. /admin/users/uid)
  for (const [key, meta] of Object.entries(ROUTE_META)) {
    if (pathname.startsWith(key + "/")) {
      return { title: meta.title, crumb: meta.crumb, sub: true };
    }
  }
  return { title: "Admin" };
}

/* ── Component ──────────────────────────────────────────────────────────── */
interface AdminTopbarProps {
  onMenuClick?: () => void;
  collapsed?: boolean;
}

export function AdminTopbar({ onMenuClick, collapsed }: AdminTopbarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { stats } = useAdminStats();

  const route = resolveRoute(pathname);
  const notifCount = (stats.pendingRequests ?? 0) + (stats.jobsInQueue ?? 0);
  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? "AD";
  const userName = user?.email?.split("@")[0] ?? "Admin";

  return (
    <header className="h-16 bg-white border-b border-black/[0.05] flex items-center justify-between px-5 lg:px-8 shrink-0 sticky top-0 z-30 gap-4">

      {/* ── Left: mobile menu + breadcrumb ─────────────────────────────── */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-xl hover:bg-[#F4F6F5] text-on-surface-variant transition-colors lg:hidden shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 min-w-0">
          {route.crumb && (
            <>
              <span className="text-xs font-semibold text-on-surface-variant/50 font-manrope hidden sm:block truncate">
                {route.crumb}
              </span>
              <ChevronRight className="w-3 h-3 text-on-surface-variant/30 shrink-0 hidden sm:block" />
            </>
          )}
          <h2 className="text-sm font-extrabold text-[#134235] font-manrope truncate tracking-tight">
            {route.title}
          </h2>
        </div>
      </div>

      {/* ── Right: notifications + user ────────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0">

        {/* Notification bell */}
        <button className="relative w-9 h-9 flex items-center justify-center rounded-xl text-on-surface-variant hover:bg-[#F4F6F5] transition-colors">
          <Bell className="w-4.5 h-4.5" />
          {notifCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center leading-none tabular-nums">
              {notifCount > 99 ? "99+" : notifCount}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-black/[0.06] mx-1" />

        {/* User avatar + name */}
        <div className="flex items-center gap-2.5 cursor-pointer group">
          <div className="text-right hidden sm:block">
            <p className="text-[13px] font-bold text-[#134235] font-manrope leading-tight">{userName}</p>
            <p className="text-[9px] text-on-surface-variant/50 uppercase tracking-[0.18em] font-bold">Administrator</p>
          </div>
          <div className="w-8 h-8 rounded-[10px] bg-[#134235] flex items-center justify-center text-white font-bold text-[11px] shadow-sm ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
            {userInitials}
          </div>
        </div>
      </div>
    </header>
  );
}
