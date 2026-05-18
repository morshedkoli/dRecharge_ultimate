"use client";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, ListOrdered, Inbox,
  Terminal, Smartphone, BarChart3,
  Zap, X, ChevronLeft, ChevronRight, Settings,
  MessageSquare, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminStats } from "@/lib/hooks/admin/useAdminStats";
import { useSiteSettings } from "@/lib/hooks/useSiteSettings";

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarItem,
} from "@/components/ui/Sidebar";

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
      { href: "/admin/recharge",         label: "Recharge",  icon: Send },
      { href: "/admin/balance-requests", label: "Requests",  icon: Inbox,        badge: "pendingRequests" as const },
      { href: "/admin/history",          label: "History",   icon: ListOrdered },
      { href: "/admin/analytics",        label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/admin/users",      label: "Users",      icon: Users,          badge: "totalUsers"    as const },
      { href: "/admin/services",   label: "Services",   icon: Terminal },
      { href: "/admin/devices",    label: "Devices",    icon: Smartphone,     badge: "activeDevices" as const },
      { href: "/admin/sms",        label: "SMS Inbox",  icon: MessageSquare },
      { href: "/admin/settings",   label: "Settings",   icon: Settings },
    ],
  },
] as const;

interface AdminSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

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
  const { settings } = useSiteSettings();

  const badgeMap: Record<string, number> = {
    totalUsers:      stats.totalUsers      ?? 0,
    pendingRequests: stats.pendingRequests  ?? 0,
    jobsInQueue:     stats.jobsInQueue     ?? 0,
    activeDevices:   stats.activeDevices   ?? 0,
  };

  return (
    <Sidebar className={cn("transition-all duration-200", collapsed ? "w-[68px]" : "w-64")}>
      <SidebarHeader>
        <div className={cn("flex w-full items-center", collapsed ? "justify-center" : "justify-between")}>
          <div className="flex items-center gap-3">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Zap className="h-4 w-4" />
              </div>
            )}
            {!collapsed && (
              <span className="font-headline text-lg font-bold text-[#134235]">{settings?.appName || "dRecharge"}</span>
            )}
          </div>
          {onClose && (
            <button onClick={onClose} className="lg:hidden">
              <X className="h-4 w-4 text-on-surface-variant" />
            </button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="mb-2">
            {!collapsed && group.label && (
              <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant/50">
                {group.label}
              </div>
            )}
            {group.label && collapsed && gi > 0 && <div className="mx-2 mb-2 border-t border-outline-variant/30" />}
            
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const count = "badge" in item ? badgeMap[item.badge] : null;
              
              return (
                <SidebarItem
                  key={item.href}
                  href={item.href}
                  active={active}
                  icon={item.icon}
                  className={cn(collapsed && "justify-center")}
                  onClick={onClose}
                >
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && count != null && count > 0 && (
                    <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                  {collapsed && count != null && count > 0 && (
                    <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </SidebarItem>
              );
            })}
          </div>
        ))}
      </SidebarContent>

      <SidebarFooter>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold text-on-surface-variant/50 transition-colors hover:bg-surface-container"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : (
              <><ChevronLeft className="h-4 w-4" /> Collapse</>
            )}
          </button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export function AdminSidebar({
  mobileOpen = false,
  onMobileClose,
  collapsed = false,
  onToggleCollapse,
}: AdminSidebarProps) {
  return (
    <>
      <div className="hidden h-full lg:block">
        <SidebarBody collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onMobileClose} />
          <div className="relative z-10 h-full w-64 bg-surface">
            <SidebarBody collapsed={false} onClose={onMobileClose} />
          </div>
        </div>
      )}
    </>
  );
}
