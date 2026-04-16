"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAgentDevices } from "@/lib/hooks/admin/useAgentDevices";
import { DeviceStatusDot } from "@/components/admin/DeviceStatusDot";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { revokeDevice } from "@/lib/functions";
import { fullDateTime, relativeTime } from "@/lib/utils";
import { toast } from "sonner";
import { Smartphone, Plus, Copy, Link as LinkIcon, QrCode as QrCodeIcon } from "lucide-react";

function AgentQrCode({ payload, size = 220 }: { payload: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    setReady(false);
    import("qrcode").then((QRCode) => {
      QRCode.toCanvas(canvasRef.current!, payload, {
        width: size,
        margin: 2,
        color: { dark: "#134235", light: "#ffffff" },
      }, () => setReady(true));
    });
  }, [payload, size]);

  return (
    <div className="relative inline-block">
      {!ready && (
        <div
          className="absolute inset-0 rounded-xl bg-surface-container animate-pulse"
          style={{ width: size, height: size }}
        />
      )}
      <canvas ref={canvasRef} className="rounded-xl block" />
    </div>
  );
}

export default function DevicesPage() {
  const { devices, loading, refetch } = useAgentDevices();
  const [revokedIds, setRevokedIds] = useState<Set<string>>(new Set());
  const visibleDevices = devices.filter(d => d.status !== "revoked" && !revokedIds.has(d.deviceId));
  const [agentBaseUrl, setAgentBaseUrl] = useState<string>("");
  const [bootstrapUrl, setBootstrapUrl] = useState<string>("");
  const [endpointLoading, setEndpointLoading] = useState(true);
  const [copiedEndpoint, setCopiedEndpoint] = useState<"base" | "bootstrap" | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchEndpoint() {
      setEndpointLoading(true);
      try {
        const res = await fetch("/api/admin/devices/endpoint", { credentials: "include" });
        const data = await res.json().catch(() => null) as
          | { baseUrl?: string; bootstrapUrl?: string; error?: string }
          | null;
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load agent endpoint");
        }
        if (!cancelled) {
          setAgentBaseUrl(data?.baseUrl || "");
          setBootstrapUrl(data?.bootstrapUrl || "");
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to load agent endpoint");
      } finally {
        if (!cancelled) {
          setEndpointLoading(false);
        }
      }
    }

    fetchEndpoint();
    return () => { cancelled = true; };
  }, []);

  async function handleGenerateToken() {
    setTokenLoading(true);
    try {
      const res = await fetch("/api/admin/devices/token", { method: "POST" });
      const result = await res.json().catch(() => null) as
        | { token?: string; expiresAt?: number; error?: string }
        | null;
      if (!res.ok) {
        throw new Error(result?.error || "Failed to generate token");
      }
      if (!result?.token) {
        throw new Error("Token was not returned by the server");
      }
      setToken(result.token);
      setTokenExpiresAt(typeof result.expiresAt === "number" ? result.expiresAt : null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to generate token");
    } finally {
      setTokenLoading(false);
    }
  }

  function copyToken() {
    if (!token) return;
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyEndpoint(kind: "base" | "bootstrap") {
    const value = kind == "base" ? agentBaseUrl : bootstrapUrl;
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopiedEndpoint(kind);
      setTimeout(() => setCopiedEndpoint(null), 2000);
    });
  }

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">Android Devices</h1>
          <p className="text-on-surface-variant font-body text-lg">Manage USSD execution agent devices.</p>
        </div>
      </section>

      <div className="bg-white border border-black/5 rounded-2xl p-8 premium-shadow space-y-5">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-[#E8F1EE] rounded-xl">
            <LinkIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-headline text-2xl font-bold text-[#134235] mb-1">Agent Endpoint</h2>
            <p className="text-on-surface-variant">
              Every deployed admin server exposes its own agent API endpoint. Install the Android app, enter this base URL first, then register with a token.
            </p>
          </div>
        </div>

        {endpointLoading ? (
          <div className="h-24 rounded-xl bg-surface-container/50 animate-pulse" />
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">
                Base URL — enter this in the Android app
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 font-mono text-sm bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-on-surface break-all">
                  {agentBaseUrl}
                </div>
                <button onClick={() => copyEndpoint("base")}
                  className="flex items-center gap-2 px-4 py-3 border border-outline-variant rounded-xl text-sm font-bold font-manrope hover:bg-surface-container text-on-surface transition-all">
                  <Copy className="w-4 h-4" />
                  {copiedEndpoint == "base" ? "Copied!" : "Copy"}
                </button>
              </div>
              {agentBaseUrl.includes("localhost") && (
                <p className="mt-2 text-xs text-amber-700 font-manrope">
                  <strong>Local dev:</strong> Android emulators cannot reach <code className="font-mono">localhost</code> — use <code className="font-mono">http://10.0.2.2:3000</code> in the emulator, or your machine&apos;s LAN IP for a real device.
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">
                Connection test URL
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 font-mono text-sm bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-on-surface break-all">
                  {bootstrapUrl}
                </div>
                <button onClick={() => copyEndpoint("bootstrap")}
                  className="flex items-center gap-2 px-4 py-3 border border-outline-variant rounded-xl text-sm font-bold font-manrope hover:bg-surface-container text-on-surface transition-all">
                  <Copy className="w-4 h-4" />
                  {copiedEndpoint == "bootstrap" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Device cards */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(2).fill(0).map((_, i) => (
            <div key={i} className="bg-white border border-black/5 rounded-2xl p-8 h-52 animate-pulse premium-shadow" />
          ))}
        </div>
      )}

      {!loading && visibleDevices.length === 0 && (
        <div className="bg-white border border-black/5 rounded-2xl p-16 text-center premium-shadow">
          <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-8 h-8 text-on-surface-variant" />
          </div>
          <p className="text-on-surface font-bold font-manrope text-lg">No devices registered</p>
          <p className="text-sm text-on-surface-variant mt-2">Generate a token below to register your first Android device</p>
        </div>
      )}

      {!loading && visibleDevices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleDevices.map((device) => (
            <div key={device.deviceId} className="bg-white border border-black/5 rounded-2xl p-8 card-hover transition-all duration-300 premium-shadow">
              <div className="flex items-start justify-between mb-6">
                <div className="p-3 bg-[#E8F1EE] rounded-xl">
                  <Smartphone className="w-6 h-6 text-primary" />
                </div>
                <DeviceStatusDot status={device.status} />
              </div>
              <h3 className="font-headline font-bold text-[#134235] text-xl mb-1">{device.name}</h3>
              <p className="text-xs text-on-surface-variant mb-6 font-manrope font-semibold uppercase tracking-wider">SIM: {device.simProvider}</p>

              <div className="space-y-2.5 text-xs text-on-surface-variant border-t border-black/[0.03] pt-4">
                <div className="flex justify-between">
                  <span>Last heartbeat</span>
                  <span className="text-on-surface font-bold">{relativeTime(device.lastHeartbeat)}</span>
                </div>
                {device.currentJob && (
                  <div className="flex justify-between">
                    <span>Current job</span>
                    <Link href={`/admin/queue/${device.currentJob}`}
                      className="text-primary hover:underline font-mono font-bold">
                      {device.currentJob.slice(0, 10)}…
                    </Link>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Registered</span>
                  <span className="text-on-surface">{fullDateTime(device.registeredAt)}</span>
                </div>
                <div>
                  <span>ID: </span>
                  <span className="font-mono text-on-surface">{device.deviceId.slice(0, 16)}…</span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-black/[0.03]">
                <ConfirmDialog
                  title="Revoke device access?"
                  description="This device will immediately lose access to the execution queue."
                  confirmLabel="Revoke Access"
                  confirmVariant="destructive"
                  onConfirm={async () => {
                    try {
                      setRevokedIds(prev => new Set([...prev, device.deviceId]));
                      await revokeDevice(device.deviceId);
                      toast.success("Device access revoked");
                      await refetch();
                    } catch (e: unknown) {
                      setRevokedIds(prev => { const s = new Set(prev); s.delete(device.deviceId); return s; });
                      const msg = e instanceof Error ? e.message : "Failed to revoke device";
                      toast.error(msg);
                      throw e; // re-throw so ConfirmDialog shows the error too
                    }
                  }}>
                  <button className="text-xs text-red-600 hover:text-red-800 font-bold font-manrope">
                    Revoke access
                  </button>
                </ConfirmDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register new device */}
      <div className="bg-white border border-black/5 rounded-2xl p-8 premium-shadow">
        <h2 className="font-headline text-2xl font-bold text-[#134235] mb-2">Register New Device</h2>
        <p className="text-on-surface-variant mb-6">
          Install the dRecharge Agent APK on an Android device, then enter the token on first launch.
        </p>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6 text-sm text-amber-800 font-manrope">
          <strong>Security notice:</strong> This token grants full execution access. Do not share it. Tokens expire after 10 minutes.
        </div>

        <ol className="space-y-2.5 text-sm text-on-surface-variant mb-6 list-decimal list-inside">
          <li>Install the dRecharge Agent APK on your Android device</li>
          <li>Open the app and enter the <span className="font-bold text-on-surface">Base URL</span> shown above</li>
          <li>Generate a token using the button below</li>
          <li>Enter the token in the app within 10 minutes</li>
          <li>The device will appear in the list above once registered to this server</li>
        </ol>

        {!token ? (
          <button onClick={handleGenerateToken} disabled={tokenLoading}
            className="flex items-center gap-2 px-6 py-3.5 bg-primary text-on-primary text-sm font-bold font-manrope rounded-xl hover:opacity-90 disabled:opacity-50 shadow-lg shadow-primary/20 transition-all">
            <Plus className="w-4 h-4" />
            {tokenLoading ? "Generating…" : "Generate Registration Token"}
          </button>
        ) : (
          <div className="space-y-6">
            {/* QR Code — scan once to connect */}
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="flex flex-col items-center gap-3">
                <AgentQrCode
                  payload={JSON.stringify({ url: agentBaseUrl, token })}
                  size={220}
                />
                <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-manrope">
                  <QrCodeIcon className="w-3.5 h-3.5" />
                  Scan with Android app to connect
                </div>
              </div>

              <div className="flex-1 space-y-3 min-w-0">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope">
                    Registration Token
                    <span className="ml-2 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full normal-case tracking-normal">valid 10 min</span>
                  </label>
                  {tokenExpiresAt && (
                    <p className="text-xs text-on-surface-variant mt-1">
                      Expires {new Date(tokenExpiresAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 font-mono text-sm bg-surface-container border border-outline-variant rounded-xl px-4 py-3 tracking-widest text-on-surface select-all break-all">
                    {token}
                  </div>
                  <button onClick={copyToken}
                    className="flex items-center gap-2 px-4 py-3 border border-outline-variant rounded-xl text-sm font-bold font-manrope hover:bg-surface-container text-on-surface transition-all shrink-0">
                    <Copy className="w-4 h-4" />
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="bg-[#E8F1EE] border border-[#134235]/10 rounded-xl p-4 text-sm text-[#134235] space-y-1.5">
                  <p className="font-bold font-manrope">How to connect:</p>
                  <ol className="list-decimal list-inside space-y-1 text-[#134235]/80">
                    <li>Open the dRecharge Agent app</li>
                    <li>Tap <span className="font-bold">Scan QR</span> — camera opens</li>
                    <li>Point at the QR code above</li>
                    <li>App auto-fills endpoint + token and connects</li>
                  </ol>
                  <p className="text-xs text-[#134235]/60 pt-1">Or enter the Base URL + token manually if camera unavailable.</p>
                </div>
              </div>
            </div>

            <button onClick={() => { setToken(null); setTokenExpiresAt(null); }}
              className="text-sm text-on-surface-variant hover:text-on-surface font-semibold">
              Generate new token
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
