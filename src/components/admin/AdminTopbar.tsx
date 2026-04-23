"use client";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { Menu, ChevronRight, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { useSubscription } from "@/lib/hooks/useSubscription";

import { Topbar, TopbarLeft, TopbarRight } from "@/components/ui/Topbar";

/* ── Route metadata ─────────────────────────────────────────────────────── */
const ROUTE_META: Record<string, { title: string }> = {
  "/admin/overview":         { title: "Dashboard" },
  "/admin/users":            { title: "Users" },
  "/admin/balance-requests": { title: "Requests" },
  "/admin/queue":            { title: "Live Queue" },
  "/admin/history":          { title: "History" },
  "/admin/analytics":        { title: "Analytics" },
  "/admin/categories":       { title: "Categories" },
  "/admin/services":         { title: "Services" },
  "/admin/devices":          { title: "Devices" },
  "/admin/logs":             { title: "Audit Logs" },
};

function resolveRoute(pathname: string) {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];
  for (const [key, meta] of Object.entries(ROUTE_META)) {
    if (pathname.startsWith(key + "/")) {
      return { title: meta.title };
    }
  }
  return { title: "Admin" };
}

/* ── Component ──────────────────────────────────────────────────────────── */
interface AdminTopbarProps {
  onMenuClick?: () => void;
  collapsed?: boolean;
}

export function AdminTopbar({ onMenuClick }: AdminTopbarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { status: subStatus, loading: subLoading } = useSubscription();
  const route = resolveRoute(pathname);
  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? "AD";

  return (
    <Topbar>
      <TopbarLeft>
        <button
          onClick={onMenuClick}
          className="rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="font-headline text-lg font-bold tracking-tight text-[#134235]">
          {route.title}
        </h2>
      </TopbarLeft>

      <TopbarRight>
        <div className="hidden sm:flex items-center mr-2 bg-surface-container/50 px-3 py-1.5 rounded-full border border-black/5">
          {subLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-on-surface-variant" />
          ) : subStatus?.state === "active" ? (
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-[#134235]">
              <ShieldCheck className="w-3.5 h-3.5" /> License Active
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-red-600">
              <ShieldAlert className="w-3.5 h-3.5" /> License Issue
            </div>
          )}
        </div>
        <NotificationBell variant="admin" />
        <div className="h-5 w-px bg-outline-variant/30" />
        <div className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground hover:bg-primary-dim transition-colors">
          {userInitials}
        </div>
      </TopbarRight>
    </Topbar>
  );
}
