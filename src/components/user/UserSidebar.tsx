"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSiteSettings } from "@/lib/hooks/useSiteSettings";
import { LayoutDashboard, Zap, History, X, Users, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/user/dashboard", icon: LayoutDashboard },
  { name: "Services",  href: "/user/services",  icon: Zap },
  { name: "History",   href: "/user/history",   icon: History },
  { name: "My Users",  href: "/user/subusers",  icon: Users },
];

export function UserSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { settings } = useSiteSettings();

  const SidebarContent = (
    <aside className="w-64 shrink-0 bg-surface-container h-full flex flex-col py-8 px-6">
      {/* Logo */}
      <div className="mb-10 flex items-center gap-3">
        {settings?.logoUrl ? (
          <img src={settings.logoUrl} alt="Logo" className="w-10 h-10 object-contain" />
        ) : (
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-on-primary shadow-sm">
            <Zap className="w-5 h-5" />
          </div>
        )}
        <div>
          <h1 className="font-manrope font-bold text-lg text-[#134235] leading-tight truncate max-w-[150px]">{settings?.appName || "dRecharge"}</h1>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">User Portal</p>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link key={item.name} href={item.href} onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-manrope font-semibold transition-all duration-200",
                isActive
                  ? "bg-white text-[#134235] shadow-sm"
                  : "text-on-surface-variant hover:bg-white/50"
              )}>
              <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive ? "text-primary" : "text-on-surface-variant")} />
              <span className="tracking-tight">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer — support link only; profile & sign-out now live in the topbar */}
      <div className="mt-auto pt-6 border-t border-black/5">
        <Link href="#" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-[#134235] transition-colors">
          <HelpCircle className="w-4 h-4" />
          <span className="font-manrope text-xs font-semibold">Support</span>
        </Link>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      {/* Mobile Drawer */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:hidden",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full">
          {SidebarContent}
          <button onClick={onClose} className="absolute right-4 top-5 p-2 rounded-lg text-on-surface-variant hover:bg-white/50 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex h-full relative">
        {SidebarContent}
      </div>
    </>
  );
}
