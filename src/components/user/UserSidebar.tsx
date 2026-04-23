"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useSiteSettings } from "@/lib/hooks/useSiteSettings";
import { useAuth } from "@/lib/hooks/useAuth";
import { toast } from "sonner";
import { LayoutDashboard, Zap, History, X, User, Users, HelpCircle, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/user/dashboard", icon: LayoutDashboard },
  { name: "Services", href: "/user/services", icon: Zap },
  { name: "History", href: "/user/history", icon: History },
  { name: "My Users", href: "/user/subusers", icon: Users },
  { name: "Profile", href: "/user/profile", icon: User },
];

export function UserSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const router = useRouter();

  async function handleLogout() {
    
    await fetch("/api/auth/session", { method: "DELETE" });
    toast.success("Signed out");
    router.push("/login");
  }

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

      {/* Footer */}
      <div className="mt-auto pt-6 flex flex-col gap-1 border-t border-black/5">
        <div className="mb-4 px-4 py-3 rounded-xl bg-white/50 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-xs">
            {user?.email?.slice(0, 2).toUpperCase() ?? "US"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#134235] font-manrope truncate">{user?.displayName || user?.email?.split("@")[0] || "User"}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Member</p>
          </div>
        </div>

        <Link href="#" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-[#134235] transition-colors">
          <HelpCircle className="w-4 h-4" />
          <span className="font-manrope text-xs font-semibold">Support</span>
        </Link>
        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-red-600 transition-colors text-left w-full">
          <LogOut className="w-4 h-4" />
          <span className="font-manrope text-xs font-semibold">Sign Out</span>
        </button>
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
