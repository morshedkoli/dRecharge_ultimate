"use client";
import { useEffect, useState } from "react";
import { useModalEffect } from "@/lib/hooks/useModalEffect";
import {
  Globe, Phone, ArrowRight, CheckCircle2, Loader2, ShieldCheck, X
} from "lucide-react";

interface SiteSettings {
  setupComplete: boolean;
  domain: string;
  phoneNumber: string;
  appName?: string;
}

export function SetupWizard() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const containerRef = useModalEffect(open);
  const [domain, setDomain] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch current settings on mount
  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: SiteSettings) => {
        setSettings(data);
        // Open wizard if setup is not complete
        if (!data.setupComplete) {
          setOpen(true);
        } else {
          setDomain(data.domain || "");
          setPhoneNumber(data.phoneNumber || "");
        }
      })
      .catch(() => {
        // Can't load settings — show wizard anyway
        setOpen(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, phoneNumber }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setSuccess(true);
      setSettings({ setupComplete: true, domain: json.domain, phoneNumber: json.phoneNumber });
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        // Refresh page so subscription check uses new domain
        window.location.reload();
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  // Don't render anything while loading
  if (loading) return null;
  // Don't show if setup is complete and wizard is closed
  if (!open) return null;

  const isFirstSetup = !settings?.setupComplete;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div ref={containerRef} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-br from-[#134235] to-[#1B6B4D] px-8 pt-8 pb-10 text-white">
          {!isFirstSetup && (
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">
                {isFirstSetup ? `Welcome to ${settings?.appName || "dRecharge"}` : "Site Settings"}
              </h2>
              <p className="text-white/70 text-xs mt-0.5">
                {isFirstSetup
                  ? "Complete setup to activate your licence"
                  : "Update your domain and contact info"}
              </p>
            </div>
          </div>
          {isFirstSetup && (
            <div className="flex gap-2">
              {[1, 2].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full flex-1 transition-all ${
                    s === 1 ? "bg-white" : "bg-white/30"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-8 py-6 -mt-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
            {success ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                <div>
                  <p className="font-bold text-gray-900">Setup Complete!</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Activating your licence for <span className="font-mono font-semibold">{domain}</span>…
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                    {isFirstSetup ? "Step 1 — Configure Your Site" : "Configuration"}
                  </p>

                  {/* Domain field */}
                  <div className="space-y-1.5 mb-4">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                      <Globe className="w-3.5 h-3.5 text-gray-400" />
                      Subscription Domain
                    </label>
                    <input
                      type="text"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="e.g. mysite.vercel.app"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1B6B4D]/30 focus:border-[#1B6B4D] transition-all bg-gray-50 placeholder:text-gray-400"
                    />
                    <p className="text-[10px] text-gray-400">
                      The domain you registered at drecharge.com for licence verification
                    </p>
                  </div>

                  {/* Phone field */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      Admin Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. +8801XXXXXXXXX"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B6B4D]/30 focus:border-[#1B6B4D] transition-all bg-gray-50 placeholder:text-gray-400"
                    />
                    <p className="text-[10px] text-gray-400">
                      Used for admin contact and notifications
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600 font-semibold">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSave}
                  disabled={saving || !domain.trim() || !phoneNumber.trim()}
                  className="flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-[#134235] disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-bold rounded-xl hover:bg-[#1B6B4D] transition-all shadow-lg shadow-[#134235]/20 disabled:shadow-none"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      {isFirstSetup ? "Activate Licence" : "Save Changes"}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {isFirstSetup && (
            <p className="text-center text-[10px] text-gray-400 mt-4">
              You can update these settings later in the admin panel.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Compact settings trigger button (for use in sidebar/settings page) ────────
export function SetupSettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
      >
        <Globe className="w-4 h-4" />
        Site Settings
      </button>
      {open && <SetupWizard />}
    </>
  );
}
