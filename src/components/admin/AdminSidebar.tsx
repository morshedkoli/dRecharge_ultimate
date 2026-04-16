"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, ListOrdered, Inbox,
  Terminal, Smartphone, ScrollText, BarChart3, ShieldAlert, Tag,
  Zap, X, HelpCircle, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminStats } from "@/lib/hooks/admin/useAdminStats";

const MAIN_NAV = [
  { href: "/admin/overview",         label: "Dashboard",        icon: LayoutDashboard },
  { href: "/admin/users",            label: "Users",            icon: Users,           badge: "totalUsers" },
  { href: "/admin/balance-requests", label: "Balance Requests", icon: Inbox,           badge: "pendingRequests" },
  { href: "/admin/queue",            label: "Execution Queue",  icon: ListOrdered,     badge: "jobsInQueue" },
  { href: "/admin/analytics",        label: "Analytics",        icon: BarChart3 },
  { href: "/admin/categories",       label: "Categories",       icon: Tag },
  { href: "/admin/services",         label: "Services",         icon: Terminal },
  { href: "/admin/devices",          label: "Devices",          icon: Smartphone },
  { href: "/admin/logs",             label: "Audit Logs",       icon: ScrollText },
  { href: "/admin/admins",           label: "Staff & Roles",    icon: ShieldAlert },
] as const;

interface AdminSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ open = true, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { stats } = useAdminStats();
  const { user } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    
    await fetch("/api/auth/session", { method: "DELETE" });
    toast.success("Signed out");
    router.push("/login");
  }

  const sidebarContent = (
    <aside className="w-64 shrink-0 bg-surface-container h-full flex flex-col py-8 px-6">
      {/* Logo */}
      <div className="mb-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-on-primary shadow-sm">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-manrope font-bold text-lg text-[#134235] leading-tight">dRecharge</h1>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Admin Panel</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="absolute right-4 top-5 p-2 rounded-lg text-on-surface-variant hover:bg-white/50 lg:hidden">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
        {MAIN_NAV.map(({ href, label, icon: Icon, ...rest }) => {
          const badge = "badge" in rest ? rest.badge : undefined;
          const active = pathname === href || pathname.startsWith(href + "/");
          const count = badge ? (stats as unknown as Record<string, number>)[badge] : null;

          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-manrope font-semibold transition-all duration-200",
                active
                  ? "bg-white text-[#134235] shadow-sm"
                  : "text-on-surface-variant hover:bg-white/50"
              )}
            >
              <Icon className={cn("w-[18px] h-[18px] shrink-0", active ? "text-primary" : "text-on-surface-variant")} />
              <span className="flex-1 leading-none tracking-tight">{label}</span>
              {count !== null && count > 0 && (
                <span className="text-[10px] bg-primary text-on-primary px-1.5 py-0.5 rounded-full min-w-[20px] text-center font-bold">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-6 flex flex-col gap-1 border-t border-black/5">
        <div className="mb-4 px-4 py-3 rounded-xl bg-white/50 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-xs">
            {user?.email?.slice(0, 2).toUpperCase() ?? "AD"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#134235] font-manrope truncate">{user?.email?.split("@")[0] ?? "Admin"}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Administrator</p>
          </div>
        </div>

        <Link href="#" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-[#134235] transition-colors">
          <HelpCircle className="w-4 h-4" />
          <span className="font-manrope text-xs font-semibold">Support</span>
        </Link>
        <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-red-600 transition-colors text-left w-full">
          <LogOut className="w-4 h-4" />
          <span className="font-manrope text-xs font-semibold">Sign Out</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="hidden lg:flex h-full relative">{sidebarContent}</div>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <div className="relative z-50 flex h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
