"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { toast } from "sonner";
import { UserCircle, LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  /** Where the "Profile" item should navigate. */
  profileHref: string;
  /** Label shown under the name (e.g. "Administrator", "Member"). */
  roleLabel?: string;
  /** Variant tweaks paddings / sizes for compact admin topbar vs roomy user topbar. */
  variant?: "admin" | "user";
  /** Optional extra slot rendered above the divider inside the dropdown (e.g. wallet balance). */
  children?: React.ReactNode;
}

export function UserMenu({
  profileHref,
  roleLabel,
  variant = "admin",
  children,
}: UserMenuProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await fetch("/api/auth/session", { method: "DELETE" });
    toast.success("Signed out");
    router.push("/login");
  }

  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";
  const email = user?.email ?? "";
  const initials = (user?.displayName || user?.email || "U").slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "group flex items-center gap-2 rounded-xl transition-all",
          variant === "user"
            ? "p-1 pr-2 hover:bg-white/60 ring-2 ring-transparent hover:ring-primary/10"
            : "p-1 hover:bg-surface-container"
        )}
      >
        {variant === "user" && (
          <div className="text-right hidden sm:block pl-1">
            <p className="text-sm font-bold text-[#134235] font-manrope leading-tight">
              {displayName}
            </p>
            {roleLabel && (
              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">{roleLabel}</p>
            )}
          </div>
        )}
        <div
          className={cn(
            "flex items-center justify-center rounded-lg bg-primary text-on-primary font-bold font-manrope shadow-sm",
            variant === "user" ? "w-10 h-10 text-sm rounded-xl" : "w-8 h-8 text-xs"
          )}
        >
          {initials}
        </div>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-on-surface-variant transition-transform shrink-0",
            open && "rotate-180",
            variant === "user" ? "hidden sm:block" : "block"
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl bg-white border border-black/5 shadow-xl overflow-hidden z-50"
        >
          {/* User identity header */}
          <div className="px-4 py-3 bg-surface-container/40 border-b border-black/[0.04]">
            <p className="font-bold text-sm text-[#134235] font-manrope truncate">{displayName}</p>
            {email && (
              <p className="text-xs text-on-surface-variant truncate mt-0.5">{email}</p>
            )}
            {roleLabel && (
              <p className="text-[10px] uppercase tracking-widest font-bold text-primary/70 mt-1">{roleLabel}</p>
            )}
          </div>

          {/* Optional extras (wallet etc.) */}
          {children && (
            <div className="px-2 py-2 border-b border-black/[0.04]">
              {children}
            </div>
          )}

          {/* Menu items */}
          <div className="py-1">
            <Link
              href={profileHref}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold font-manrope text-on-surface hover:bg-surface-container/60 transition-colors"
            >
              <UserCircle className="w-4 h-4 text-on-surface-variant" /> Profile
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold font-manrope text-red-600 hover:bg-red-50 transition-colors text-left"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
