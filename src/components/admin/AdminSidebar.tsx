"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, ListOrdered, Inbox,
  Terminal, Smartphone, ScrollText, BarChart3, ShieldAlert, Tag,
  Zap, X, LogOut, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminStats } from "@/lib/hooks/admin/useAdminStats";

/* ── Navigation groups ─────────────────────────────────────────────────── */
const NAV_GROUPS = [
  {
    label: null,
    items: [
      { href: "/admin/overview", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/balance-requests", label: "Balance Requests", icon: Inbox,       badge: "pendingRequests" as const },
      { href: "/admin/queue",            label: "Exec Queue",       icon: ListOrdered, badge: "jobsInQueue"      as const },
      { href: "/admin/analytics",        label: "Analytics",        icon: BarChart3 },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/admin/users",      label: "Users",      icon: Users,       badge: "totalUsers"    as const },
      { href: "/admin/categories", label: "Categories", icon: Tag },
      { href: "/admin/services",   label: "Services",   icon: Terminal },
      { href: "/admin/devices",    label: "Devices",    icon: Smartphone,  badge: "activeDevices" as const },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/logs",   label: "Audit Logs",  icon: ScrollText },
      { href: "/admin/admins", label: "Staff Roles", icon: ShieldAlert },
    ],
  },
] as const;

/* ── Types ─────────────────────────────────────────────────────────────── */
interface AdminSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

/* ── Single nav item ────────────────────────────────────────────────────── */
function NavItem({
  href, label, icon: Icon, count, collapsed, active, onClick,
}: {
  href: string; label: string; icon: React.ElementType;
  count?: number | null; collapsed: boolean;
  active: boolean; onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-manrope font-semibold transition-all duration-150",
        active
          ? "bg-white text-[#134235] shadow-card"
          : "text-on-surface-variant hover:bg-white/70 hover:text-[#134235]",
        collapsed && "justify-center px-2.5",
      )}
    >
      {/* Active indicator bar */}
      {active && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
      )}

      <Icon
        className={cn(
          "w-[18px] h-[18px] shrink-0 transition-colors",
          active ? "text-primary" : "text-on-surface-variant group-hover:text-[#134235]",
        )}
      />

      {!collapsed && (
        <>
          <span className="flex-1 leading-none tracking-tight truncate">{label}</span>
          {count != null && count > 0 && (
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center tabular-nums",
              active ? "bg-primary/10 text-primary" : "bg-outline-variant/40 text-on-surface-variant",
            )}>
              {count > 99 ? "99+" : count}
            </span>
          )}
        </>
      )}

      {/* Collapsed tooltip */}
      {collapsed && (
        <span className="sidebar-collapsed-tooltip">
          {label}{count != null && count > 0 ? ` (${count})` : ""}
        </span>
      )}

      {/* Collapsed badge dot */}
      {collapsed && count != null && count > 0 && (
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
      )}
    </Link>
  );
}

/* ── Sidebar body ────────────────────────────────────────────────────────── */
function SidebarBody({
  collapsed,
  onToggleCollapse,
  onClose,
}: {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
}) {
  const pathname   = usePathname();
  const { stats }  = useAdminStats();
  const { user }   = useAuth();
  const router     = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    toast.success("Signed out");
    router.push("/login");
  }

  const badgeMap: Record<string, number> = {
    totalUsers:      stats.totalUsers      ?? 0,
    pendingRequests: stats.pendingRequests  ?? 0,
    jobsInQueue:     stats.jobsInQueue     ?? 0,
    activeDevices:   stats.activeDevices   ?? 0,
  };

  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? "AD";
  const userName     = user?.email?.split("@")[0] ?? "Admin";

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-white transition-[width] duration-200 ease-in-out overflow-hidden shrink-0",
        "shadow-[1px_0_0_rgba(0,0,0,0.06),4px_0_20px_rgba(0,0,0,0.04)]",
        collapsed ? "w-[68px]" : "w-64",
      )}
    >
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div className={cn(
        "flex items-center shrink-0 border-b border-black/[0.05] h-16",
        collapsed ? "justify-center px-3" : "px-5 gap-3",
      )}>
        <div className="w-8 h-8 bg-[#134235] rounded-[10px] flex items-center justify-center shrink-0 shadow-sm">
          <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <h1 className="font-manrope font-extrabold text-[#134235] text-[15px] leading-tight truncate">
              dRecharge
            </h1>
            <p className="text-[9px] uppercase tracking-[0.22em] text-on-surface-variant/50 font-bold">
              Admin Panel
            </p>
          </div>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg text-on-surface-variant hover:bg-[#F4F6F5] transition-colors lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2.5 py-4 space-y-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {/* Section label */}
            {group.label && !collapsed && (
              <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-on-surface-variant/40 px-3 mb-2 font-manrope">
                {group.label}
              </p>
            )}
            {group.label && collapsed && gi > 0 && (
              <div className="border-t border-black/[0.05] mx-1 mb-3" />
            )}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const count  = "badge" in item ? (badgeMap[item.badge] ?? null) : null;
                return (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    count={count}
                    collapsed={collapsed}
                    active={active}
                    onClick={onClose}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-black/[0.05] px-2.5 py-3 space-y-0.5">
        {/* User profile */}
        {!collapsed ? (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 bg-[#F4F6F5]">
            <div className="w-8 h-8 rounded-[8px] bg-[#134235] flex items-center justify-center text-white text-[11px] font-bold font-manrope shrink-0">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[#134235] font-manrope truncate leading-tight">{userName}</p>
              <p className="text-[9px] text-on-surface-variant/50 uppercase tracking-[0.18em] font-bold mt-0.5">Administrator</p>
            </div>
          </div>
        ) : (
          <div className="group relative flex justify-center py-1.5 mb-1">
            <div className="w-8 h-8 rounded-[8px] bg-[#134235] flex items-center justify-center text-white text-[11px] font-bold font-manrope">
              {userInitials}
            </div>
            <span className="sidebar-collapsed-tooltip">{userName} — Admin</span>
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className={cn(
            "group relative flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-manrope font-semibold",
            "text-on-surface-variant hover:bg-red-50 hover:text-red-600 transition-all",
            collapsed && "justify-center px-2.5",
          )}
        >
          <LogOut className="w-[17px] h-[17px] shrink-0" />
          {!collapsed && <span>Sign Out</span>}
          {collapsed && <span className="sidebar-collapsed-tooltip">Sign Out</span>}
        </button>
      </div>

      {/* ── Collapse toggle ───────────────────────────────────────────────── */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className={cn(
            "hidden lg:flex shrink-0 items-center justify-center gap-1.5 w-full py-2.5 border-t border-black/[0.05]",
            "text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 font-manrope",
            "hover:bg-[#F4F6F5] hover:text-on-surface-variant/70 transition-all",
          )}
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5" />
            : <><ChevronLeft className="w-3.5 h-3.5" /><span>Collapse</span></>
          }
        </button>
      )}
    </aside>
  );
}

/* ── Export ─────────────────────────────────────────────────────────────── */
export function AdminSidebar({
  mobileOpen = false,
  onMobileClose,
  collapsed = false,
  onToggleCollapse,
}: AdminSidebarProps) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:flex h-full">
        <SidebarBody collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={onMobileClose}
          />
          <div className="relative z-10 h-full animate-slide-in-left">
            <SidebarBody collapsed={false} onClose={onMobileClose} />
          </div>
        </div>
      )}
    </>
  );
}
