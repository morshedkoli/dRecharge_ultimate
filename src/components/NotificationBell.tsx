"use client";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, ExternalLink, Inbox } from "lucide-react";
import Link from "next/link";
import { useNotifications, AppNotification } from "@/lib/hooks/useNotifications";
import { relativeTime } from "@/lib/utils";

const TYPE_ICON: Record<string, { emoji: string; bg: string }> = {
  balance_request_submitted: { emoji: "📋", bg: "bg-amber-50"  },
  balance_request_approved:  { emoji: "✅", bg: "bg-[#E8F1EE]" },
  balance_request_rejected:  { emoji: "❌", bg: "bg-red-50"    },
  tx_initiated:              { emoji: "⚡", bg: "bg-blue-50"   },
  tx_completed:              { emoji: "✅", bg: "bg-[#E8F1EE]" },
  tx_failed:                 { emoji: "⚠️", bg: "bg-red-50"    },
  tx_cancelled:              { emoji: "🚫", bg: "bg-orange-50" },
  wallet_credited:           { emoji: "💰", bg: "bg-[#E8F1EE]" },
  wallet_debited:            { emoji: "💸", bg: "bg-amber-50"  },
  account_suspended:         { emoji: "🔒", bg: "bg-red-50"    },
  account_activated:         { emoji: "🔓", bg: "bg-[#E8F1EE]" },
  role_changed:              { emoji: "🛡️", bg: "bg-violet-50" },
  new_balance_request:       { emoji: "📥", bg: "bg-amber-50"  },
  device_registered:         { emoji: "📱", bg: "bg-[#E8F1EE]" },
  device_revoked:            { emoji: "📵", bg: "bg-red-50"    },
};

function getIcon(type: string) {
  return TYPE_ICON[type] ?? { emoji: "🔔", bg: "bg-surface-container" };
}

interface Props {
  /** Visual style variant — admin uses a more muted palette */
  variant?: "admin" | "user";
}

export function NotificationBell({ variant = "user" }: Props) {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleItemClick(n: AppNotification) {
    if (!n.isRead) await markRead(n.id);
    setOpen(false);
  }

  const btnBase =
    variant === "admin"
      ? "relative w-9 h-9 flex items-center justify-center rounded-xl text-on-surface-variant hover:bg-[#F4F6F5] transition-colors"
      : "relative w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-[#134235] hover:bg-white/60 transition-all";

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={btnBase}
        aria-label="Notifications"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-[3px] bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center leading-none tabular-nums">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-black/[0.06] rounded-2xl shadow-xl shadow-black/10 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.04]">
            <div className="flex items-center gap-2">
              <h3 className="font-manrope font-extrabold text-[#134235] text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-full font-manrope">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-[11px] text-on-surface-variant hover:text-[#134235] font-manrope font-semibold transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-black/[0.03]">
            {loading && (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center">
                  <Inbox className="w-6 h-6 text-on-surface-variant/50" />
                </div>
                <p className="text-sm font-manrope font-semibold text-on-surface-variant">
                  No notifications yet
                </p>
                <p className="text-xs text-on-surface-variant/60 font-manrope">
                  You&apos;ll be notified about important account activity here.
                </p>
              </div>
            )}

            {!loading &&
              notifications.map((n) => {
                const { emoji, bg } = getIcon(n.type);
                const content = (
                  <div
                    className={`flex items-start gap-3 px-4 py-3.5 transition-colors cursor-pointer ${
                      n.isRead
                        ? "hover:bg-surface-container/30"
                        : "bg-primary/[0.03] hover:bg-primary/[0.06]"
                    }`}
                    onClick={() => handleItemClick(n)}
                  >
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base ${bg}`}>
                      {emoji}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-tight font-manrope ${n.isRead ? "font-semibold text-on-surface" : "font-bold text-[#134235]"}`}>
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed line-clamp-2">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-on-surface-variant/50 mt-1 font-manrope">
                        {relativeTime(n.createdAt)}
                      </p>
                    </div>

                    {n.link && (
                      <ExternalLink className="w-3.5 h-3.5 text-on-surface-variant/40 shrink-0 mt-1" />
                    )}
                  </div>
                );

                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => handleItemClick(n)}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                );
              })}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-black/[0.04] bg-surface-container/20">
              <p className="text-[10px] text-on-surface-variant/50 text-center font-manrope">
                Showing last {notifications.length} notifications · updates every 30s
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
