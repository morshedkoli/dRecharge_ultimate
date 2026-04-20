"use client";
import { useSubscription, type SubscriptionStatus } from "@/lib/hooks/useSubscription";
import { AlertTriangle, ExternalLink, RefreshCw, ShieldOff } from "lucide-react";

// ── Warning banner — rendered inside <main> ───────────────────────────────────
export function SubscriptionWarningBanner() {
  const { status, loading } = useSubscription();
  if (loading || !status) return null;
  // Only show warning when active but close to expiry
  if (status.state !== "active") return null;

  const warnExpiry =
    status.daysUntilExpiry !== null && status.daysUntilExpiry <= 14;
  if (!warnExpiry) return null;

  return (
    <div className="flex items-center justify-center gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-semibold font-manrope">
      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
      <span>
        Subscription expires in{" "}
        <strong>
          {status.daysUntilExpiry} day{status.daysUntilExpiry === 1 ? "" : "s"}
        </strong>
        {status.expiresAt && (
          <>
            {" "}(
            {new Date(status.expiresAt).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })}
            )
          </>
        )}
        .
      </span>
      <a
        href="https://drecharge.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 underline underline-offset-2 hover:text-amber-900 transition-colors"
      >
        Renew now <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

// ── Blocked screen ─────────────────────────────────────────────────────────────
function BlockedScreen({ status }: { status: SubscriptionStatus }) {
  const config: Record<string, { title: string; description: string; cta: string }> = {
    expired: {
      title: "Subscription Expired",
      description: `Your dRecharge licence for {domain} has expired. All transaction processing is suspended until renewed.`,
      cta: "Renew Subscription",
    },
    inactive: {
      title: "No Active Subscription",
      description: `Domain {domain} is registered but has no active subscription. Purchase a licence to use dRecharge.`,
      cta: "Get Subscription",
    },
    untracked: {
      title: "Domain Not Registered",
      description: `Domain {domain} is not registered in the dRecharge licence system. Contact support or purchase a licence.`,
      cta: "Register Domain",
    },
  };

  const cfg = config[status.state] ?? config.expired;
  const description = cfg.description.replace("{domain}", status.domain || "this domain");

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F6F5] p-6">
      <div className="w-full max-w-md">
        <div className="bg-white border border-red-100 rounded-2xl p-10 shadow-xl text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
              <ShieldOff className="w-10 h-10 text-red-500" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-gray-900 font-headline tracking-tight">
              {cfg.title}
            </h1>
            <p className="text-sm text-gray-500 font-manrope">{description}</p>
          </div>

          {/* Detail rows */}
          <div className="border-t border-gray-100" />
          <div className="text-xs text-gray-500 space-y-1.5 font-manrope text-left bg-gray-50 rounded-xl px-4 py-3">
            <div className="flex justify-between">
              <span>Domain</span>
              <span className="font-mono font-semibold text-gray-700">{status.domain || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span>State</span>
              <span className={`font-semibold capitalize ${
                status.state === "expired"   ? "text-red-600"   :
                status.state === "inactive"  ? "text-orange-600":
                                               "text-gray-500"
              }`}>{status.state}</span>
            </div>
            <div className="flex justify-between">
              <span>Tracked</span>
              <span className={`font-semibold ${status.tracked ? "text-green-600" : "text-red-600"}`}>
                {status.tracked ? "Yes" : "No"}
              </span>
            </div>
            {status.expiresAt && (
              <div className="flex justify-between">
                <span>Expired at</span>
                <span className="font-semibold text-red-600">
                  {new Date(status.expiresAt).toLocaleDateString("en-US", {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Checked</span>
              <span className="text-gray-400">{new Date(status.checkedAt).toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="space-y-3">
            <a
              href="https://drecharge.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-[#134235] text-white text-sm font-bold font-manrope rounded-xl hover:bg-[#1B6B4D] transition-all shadow-lg shadow-[#134235]/20"
            >
              <ExternalLink className="w-4 h-4" />
              {cfg.cta}
            </a>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 w-full px-6 py-3 border border-gray-200 text-gray-600 text-sm font-bold font-manrope rounded-xl hover:bg-gray-50 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Check Again
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4 font-manrope">
          Contact support if you believe this is an error.
        </p>
      </div>
    </div>
  );
}

// ── Gate — wraps full layout ───────────────────────────────────────────────────
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { status, loading } = useSubscription();

  // Loading — render children (avoids flash)
  if (loading || !status) return <>{children}</>;

  // Block if not active — but "unknown" is grace (API down), let through
  if (!status.subscribed && status.state !== "unknown") {
    return <BlockedScreen status={status} />;
  }

  return <>{children}</>;
}
