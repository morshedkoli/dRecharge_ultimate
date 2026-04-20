"use client";
import { useEffect, useRef, useState } from "react";
import {
  RefreshCw, Shield, ShieldCheck, ShieldOff, ShieldAlert,
  Globe, Phone, Clock, AlertTriangle,
} from "lucide-react";
import { useLicenseStatus, type LicenseData, type LicenseUiState } from "@/lib/hooks/useLicenseStatus";

// ── Countdown ─────────────────────────────────────────────────────────────────

function useCountdown(expiresAt: string | null, onExpire: () => void) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const cbRef = useRef(onExpire);
  cbRef.current = onExpire;

  useEffect(() => {
    if (!expiresAt) { setRemaining(null); return; }
    const target = new Date(expiresAt).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setRemaining(0); cbRef.current(); return; }
      setRemaining(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

function formatCountdown(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ── State config ──────────────────────────────────────────────────────────────

const STATE_CFG: Record<LicenseUiState, {
  label: string;
  badge: string;
  badgeText: string;
  badgeBorder: string;
  icon: React.ElementType;
  cardBorder: string;
}> = {
  active: {
    label: "Active",
    badge: "bg-emerald-50", badgeText: "text-emerald-700", badgeBorder: "border-emerald-200",
    icon: ShieldCheck,
    cardBorder: "border-emerald-100",
  },
  expired: {
    label: "Expired",
    badge: "bg-red-50", badgeText: "text-red-600", badgeBorder: "border-red-200",
    icon: ShieldOff,
    cardBorder: "border-red-100",
  },
  inactive: {
    label: "Inactive",
    badge: "bg-amber-50", badgeText: "text-amber-700", badgeBorder: "border-amber-200",
    icon: ShieldAlert,
    cardBorder: "border-amber-100",
  },
  not_registered: {
    label: "Not Registered",
    badge: "bg-gray-100", badgeText: "text-gray-500", badgeBorder: "border-gray-200",
    icon: ShieldOff,
    cardBorder: "border-gray-200",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveLogoUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `https://drecharge.com${url}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function relTime(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Dot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1 text-[10px] font-semibold ${on ? "text-emerald-600" : "text-red-500"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${on ? "bg-emerald-500" : "bg-red-400"}`} />
      {label}
    </span>
  );
}

function CountdownRow({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const remaining = useCountdown(expiresAt, onExpire);
  if (!remaining || remaining <= 0) return null;
  return (
    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 mt-4">
      <span className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
        <Clock className="w-3.5 h-3.5" />
        Expires in
      </span>
      <span className="font-mono text-sm font-extrabold text-emerald-700 tabular-nums tracking-tight">
        {formatCountdown(remaining)}
      </span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm animate-pulse">
      <div className="flex items-start gap-4 mb-5">
        <div className="w-14 h-14 rounded-xl bg-gray-100 shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-32 bg-gray-100 rounded" />
          <div className="h-3 w-40 bg-gray-100 rounded" />
          <div className="h-3 w-28 bg-gray-100 rounded" />
        </div>
        <div className="h-6 w-24 bg-gray-100 rounded-full" />
      </div>
      <div className="border-t border-gray-100 mb-4" />
      <div className="space-y-2.5">
        <div className="h-3 w-full bg-gray-100 rounded" />
        <div className="h-3 w-3/4 bg-gray-100 rounded" />
      </div>
      <div className="h-10 w-full bg-gray-100 rounded-xl mt-4" />
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-red-100 p-6 shadow-sm">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm">Failed to load licence</p>
          <p className="text-[11px] text-gray-500 mt-1 font-mono break-all">{message}</p>
        </div>
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    </div>
  );
}

function NotRegisteredCard({ domain, onRefetch }: { domain: string; onRefetch: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-14 h-14 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center">
          <ShieldOff className="w-7 h-7 text-gray-400" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm">Domain Not Registered</p>
          <p className="text-[11px] text-gray-500 mt-1">
            <span className="font-mono">{domain}</span> is not tracked in the licence system.
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            Contact your administrator to register this domain.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          Not Registered
        </div>
        <button
          onClick={onRefetch}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-200 text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-200 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Check Again
        </button>
      </div>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

function CardContent({ data, onRefetch }: { data: LicenseData; onRefetch: () => void }) {
  const cfg = STATE_CFG[data.uiState];
  const BadgeIcon = cfg.icon;
  const logoUrl = resolveLogoUrl(data.logoUrl);
  const showCountdown =
    data.uiState === "active" &&
    !!data.expiresAt &&
    typeof data.daysUntilExpiry === "number" &&
    data.daysUntilExpiry > 0;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-6 ${cfg.cardBorder}`}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4 mb-5">
        {/* Logo */}
        <div className="w-14 h-14 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={data.appName ?? "App logo"}
              className="w-full h-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <Shield className="w-7 h-7 text-gray-300" />
          )}
        </div>

        {/* App name + domain + phone */}
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-gray-900 text-sm leading-tight">
            {data.appName ?? "dRecharge"}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <Globe className="w-3 h-3 text-gray-400 shrink-0" />
            <p className="text-[11px] text-gray-500 font-mono truncate">{data.domain}</p>
          </div>
          {data.phoneNumber && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Phone className="w-3 h-3 text-gray-400 shrink-0" />
              <p className="text-[11px] text-gray-500">{data.phoneNumber}</p>
            </div>
          )}
        </div>

        {/* Badge + refresh */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${cfg.badge} ${cfg.badgeText} ${cfg.badgeBorder}`}>
            <BadgeIcon className="w-3 h-3" />
            {cfg.label}
          </span>
          <button
            onClick={onRefetch}
            title="Refresh licence"
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="border-t border-gray-100 mb-4" />

      {/* ── Details ────────────────────────────────────────────────────── */}
      <div className="space-y-3 text-xs">
        {/* Expiry row */}
        <div className="flex items-center justify-between">
          <span className="text-gray-500">
            {data.uiState === "expired" ? "Expired on" : "Expires on"}
          </span>
          {data.expiresAt ? (
            <span className="flex items-center gap-1.5 font-bold">
              <span className={
                data.uiState === "expired" ? "text-red-600" :
                data.uiState === "active"  ? "text-emerald-700" : "text-gray-700"
              }>
                {fmtDate(data.expiresAt)}
              </span>
              {typeof data.daysUntilExpiry === "number" && (
                <span className={[
                  "px-1.5 py-0.5 rounded-md text-[10px] font-extrabold border tabular-nums",
                  data.daysUntilExpiry <= 0
                    ? "bg-red-50 text-red-600 border-red-200"
                    : data.daysUntilExpiry <= 14
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200",
                ].join(" ")}>
                  {data.daysUntilExpiry <= 0
                    ? `${Math.abs(data.daysUntilExpiry)}d ago`
                    : `${data.daysUntilExpiry}d left`}
                </span>
              )}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>

        {/* Status flags */}
        <div className="flex items-center gap-4">
          <Dot on={data.tracked}    label="Tracked"    />
          <Dot on={data.subscribed} label="Subscribed" />
          <Dot on={!data.expired}   label="Valid"      />
        </div>
      </div>

      {/* ── Countdown (active only) ─────────────────────────────────────── */}
      {showCountdown && (
        <CountdownRow expiresAt={data.expiresAt!} onExpire={onRefetch} />
      )}

      {/* ── Last checked ────────────────────────────────────────────────── */}
      <p className="text-[10px] text-gray-400 text-right mt-3">
        Checked {relTime(data.checkedAt)}
      </p>
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export function LicenseCard({ domain }: { domain?: string }) {
  const { data, isLoading, isError, errorMessage, refetch } = useLicenseStatus(domain);

  if (isLoading) return <LoadingSkeleton />;
  if (isError)   return <ErrorCard message={errorMessage ?? "Unknown error"} onRetry={refetch} />;
  if (!data)     return null;

  if (data.uiState === "not_registered") {
    return <NotRegisteredCard domain={data.domain} onRefetch={refetch} />;
  }

  return <CardContent data={data} onRefetch={refetch} />;
}
