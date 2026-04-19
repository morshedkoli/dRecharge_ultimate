"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useAgentDevices } from "@/lib/hooks/admin/useAgentDevices";
import { DeviceStatusDot } from "@/components/admin/DeviceStatusDot";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { revokeDevice, toggleDevicePower, getDeviceInfo, updateDeviceServices } from "@/lib/functions";
import { fullDateTime, relativeTime } from "@/lib/utils";
import { toast } from "sonner";
import { DeviceInfoData, Service } from "@/types";
import { Smartphone, Plus, Copy, Link as LinkIcon, QrCode as QrCodeIcon, Power, ChevronDown, ChevronUp, RefreshCw, Cpu, Battery, Wifi, HardDrive, Layers, Check, Save } from "lucide-react";

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

function DeviceInfoPanel({ deviceId }: { deviceId: string }) {
  const [info, setInfo] = useState<DeviceInfoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchInfo = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getDeviceInfo(deviceId);
      setInfo(result.info);
    } catch {
      toast.error("Failed to load device info");
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [deviceId]);

  useEffect(() => { fetchInfo(); }, [fetchInfo]);

  if (loading) {
    return <div className="h-20 rounded-xl bg-surface-container/50 animate-pulse mt-4" />;
  }

  if (fetched && !info) {
    return (
      <div className="mt-4 px-4 py-3 rounded-xl bg-surface-container text-xs text-on-surface-variant text-center">
        No hardware info synced yet
      </div>
    );
  }

  if (!info) return null;

  const ramUsedPct = info.ramTotalMb > 0
    ? Math.round(((info.ramTotalMb - info.ramAvailableMb) / info.ramTotalMb) * 100)
    : 0;
  const storageUsedPct = info.storageTotalMb > 0
    ? Math.round(((info.storageTotalMb - info.storageAvailableMb) / info.storageTotalMb) * 100)
    : 0;

  return (
    <div className="mt-4 space-y-3 text-xs">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope">
          Device Info
        </span>
        <div className="flex items-center gap-2 text-on-surface-variant">
          <span>{relativeTime(info.syncedAt)}</span>
          <button onClick={fetchInfo} title="Refresh" className="hover:text-on-surface transition-colors">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Hardware */}
      <div className="space-y-1.5 border border-black/[0.04] rounded-xl p-3 bg-surface-container/30">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant font-manrope mb-2">
          <Cpu className="w-3 h-3" /> Hardware
        </div>
        <div className="flex justify-between">
          <span className="text-on-surface-variant">Model</span>
          <span className="text-on-surface font-medium">{info.brand} {info.model}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-on-surface-variant">Manufacturer</span>
          <span className="text-on-surface font-medium">{info.manufacturer}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-on-surface-variant">Android</span>
          <span className="text-on-surface font-medium">{info.androidVersion} (SDK {info.sdkInt})</span>
        </div>
      </div>

      {/* RAM & Storage */}
      <div className="space-y-2 border border-black/[0.04] rounded-xl p-3 bg-surface-container/30">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant font-manrope mb-2">
          <HardDrive className="w-3 h-3" /> Memory & Storage
        </div>
        {info.ramTotalMb > 0 && (
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-on-surface-variant">RAM</span>
              <span className="text-on-surface font-medium">
                {Math.round(info.ramAvailableMb / 1024 * 10) / 10}GB free / {Math.round(info.ramTotalMb / 1024 * 10) / 10}GB
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-container overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${ramUsedPct > 85 ? "bg-red-400" : ramUsedPct > 65 ? "bg-amber-400" : "bg-primary"}`}
                style={{ width: `${ramUsedPct}%` }}
              />
            </div>
          </div>
        )}
        {info.storageTotalMb > 0 && (
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-on-surface-variant">Storage</span>
              <span className="text-on-surface font-medium">
                {Math.round(info.storageAvailableMb / 1024 * 10) / 10}GB free / {Math.round(info.storageTotalMb / 1024 * 10) / 10}GB
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-container overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${storageUsedPct > 85 ? "bg-red-400" : storageUsedPct > 65 ? "bg-amber-400" : "bg-primary"}`}
                style={{ width: `${storageUsedPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Battery & Network */}
      <div className="grid grid-cols-2 gap-2">
        <div className="border border-black/[0.04] rounded-xl p-3 bg-surface-container/30 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant font-manrope mb-1.5">
            <Battery className="w-3 h-3" /> Battery
          </div>
          <div className={`text-lg font-bold font-manrope ${info.batteryLevel <= 20 ? "text-red-500" : info.batteryLevel <= 40 ? "text-amber-500" : "text-primary"}`}>
            {info.batteryLevel}%
          </div>
          <div className="text-on-surface-variant">{info.isCharging ? "Charging" : "On battery"}</div>
        </div>
        <div className="border border-black/[0.04] rounded-xl p-3 bg-surface-container/30 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant font-manrope mb-1.5">
            <Wifi className="w-3 h-3" /> Network
          </div>
          <div className="text-on-surface font-medium capitalize">{info.networkType}</div>
          {info.ipAddress && <div className="text-on-surface-variant font-mono">{info.ipAddress}</div>}
          {info.simCarrier && <div className="text-on-surface-variant">{info.simCarrier}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── ServiceAssignmentPanel ────────────────────────────────────────────────────
function ServiceAssignmentPanel({
  deviceId,
  currentAssigned,
  allServices,
  assignedMap, // serviceId → deviceId (other devices)
  onSaved,
}: {
  deviceId: string;
  currentAssigned: string[];
  allServices: Service[];
  assignedMap: Record<string, string>;
  onSaved: (serviceIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentAssigned));
  const [saving, setSaving] = useState(false);
  const dirty = (
    selected.size !== currentAssigned.length ||
    [...selected].some(id => !currentAssigned.includes(id))
  );

  function toggle(serviceId: string) {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(serviceId) ? s.delete(serviceId) : s.add(serviceId);
      return s;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const result = await updateDeviceServices(deviceId, [...selected]);
      onSaved(result.assignedServices);
      toast.success("Services updated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update services");
    } finally {
      setSaving(false);
    }
  }

  if (allServices.length === 0) {
    return (
      <div className="mt-4 px-4 py-3 rounded-xl bg-surface-container text-xs text-on-surface-variant text-center">
        No services created yet
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">
        Assigned Services
      </div>
      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
        {allServices.map(svc => {
          const takenByOther = !!(assignedMap[svc.id] && assignedMap[svc.id] !== deviceId);
          const takenDeviceName = takenByOther ? assignedMap[`${svc.id}__name`] : null;
          const isChecked = selected.has(svc.id);

          return (
            <label
              key={svc.id}
              className={[
                "flex items-center gap-3 px-3 py-2 rounded-xl border transition-all cursor-pointer text-xs font-manrope",
                takenByOther
                  ? "opacity-50 cursor-not-allowed border-black/[0.04] bg-surface-container/20"
                  : isChecked
                  ? "border-primary/30 bg-[#E8F1EE]"
                  : "border-black/[0.04] bg-surface-container/30 hover:bg-surface-container/60",
              ].join(" ")}
            >
              <input
                type="checkbox"
                className="accent-primary w-3.5 h-3.5 shrink-0"
                checked={isChecked}
                disabled={takenByOther}
                onChange={() => !takenByOther && toggle(svc.id)}
              />
              <span className={`flex-1 font-medium ${isChecked ? "text-primary" : "text-on-surface"}`}>
                {svc.name}
              </span>
              {!svc.isActive && (
                <span className="text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-full">
                  inactive
                </span>
              )}
              {takenByOther && takenDeviceName && (
                <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full shrink-0">
                  {takenDeviceName}
                </span>
              )}
              {isChecked && !takenByOther && (
                <Check className="w-3 h-3 text-primary shrink-0" />
              )}
            </label>
          );
        })}
      </div>
      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary text-xs font-bold font-manrope rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Saving…" : "Save Changes"}
        </button>
      )}
    </div>
  );
}

export default function DevicesPage() {
  const { devices, loading, refetch, silentRefetch } = useAgentDevices();
  const [revokedIds, setRevokedIds] = useState<Set<string>>(new Set());
  const [powerTogglingIds, setPowerTogglingIds] = useState<Set<string>>(new Set());
  const [expandedInfoIds, setExpandedInfoIds] = useState<Set<string>>(new Set());
  const [expandedServiceIds, setExpandedServiceIds] = useState<Set<string>>(new Set());
  const [allServices, setAllServices] = useState<Service[]>([]);
  // Track per-device assigned services locally for optimistic UI after saves
  const [deviceServices, setDeviceServices] = useState<Record<string, string[]>>({});

  // Fetch all services once on mount
  useEffect(() => {
    fetch("/api/admin/services", { credentials: "include" })
      .then(r => r.json())
      .then(d => setAllServices(d.services || []))
      .catch(() => {});
  }, []);

  // Sync deviceServices from fetched devices
  useEffect(() => {
    if (devices.length === 0) return;
    setDeviceServices(prev => {
      const next = { ...prev };
      for (const d of devices) {
        if (!(d.deviceId in next)) {
          next[d.deviceId] = d.assignedServices ?? [];
        }
      }
      return next;
    });
  }, [devices]);

  // Build map: serviceId → { deviceId, deviceName } across all visible devices
  const assignedMap = useCallback((): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const d of devices) {
      const assigned = deviceServices[d.deviceId] ?? d.assignedServices ?? [];
      for (const svcId of assigned) {
        map[svcId] = d.deviceId;
        map[`${svcId}__name`] = d.name;
      }
    }
    return map;
  }, [devices, deviceServices]);
  const visibleDevices = devices.filter(d => d.status !== "revoked" && !revokedIds.has(d.deviceId));
  const [agentBaseUrl, setAgentBaseUrl] = useState<string>("");
  const [bootstrapUrl, setBootstrapUrl] = useState<string>("");
  const [endpointLoading, setEndpointLoading] = useState(true);
  const [copiedEndpoint, setCopiedEndpoint] = useState<"base" | "bootstrap" | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [registrationDetected, setRegistrationDetected] = useState(false);
  const deviceCountAtTokenGenRef = useRef<number>(0);

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

  // Poll for new device registration while a token is active
  useEffect(() => {
    if (!token) {
      setRegistrationDetected(false);
      return;
    }
    const interval = setInterval(async () => {
      await silentRefetch();
    }, 3000);
    return () => clearInterval(interval);
  }, [token, silentRefetch]);

  // Detect when a new device registers (count increases after token was generated)
  useEffect(() => {
    if (!token || registrationDetected) return;
    if (visibleDevices.length > deviceCountAtTokenGenRef.current) {
      setRegistrationDetected(true);
      setToken(null);
      setTokenExpiresAt(null);
      toast.success("Device registered successfully!");
    }
  }, [visibleDevices.length, token, registrationDetected]);

  async function handleGenerateToken() {
    deviceCountAtTokenGenRef.current = visibleDevices.length;
    setRegistrationDetected(false);
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
                <div className="flex items-center gap-3">
                  {/* Power toggle button */}
                  <button
                    id={`power-btn-${device.deviceId}`}
                    disabled={powerTogglingIds.has(device.deviceId) || device.status === "revoked"}
                    title={device.isPoweredOn ? "Turn off agent" : "Turn on agent"}
                    onClick={async () => {
                      setPowerTogglingIds(prev => new Set([...prev, device.deviceId]));
                      try {
                        await toggleDevicePower(device.deviceId, !device.isPoweredOn);
                        toast.success(
                          device.isPoweredOn
                            ? `${device.name} paused`
                            : `${device.name} resumed`
                        );
                        await silentRefetch();
                      } catch (e: unknown) {
                        toast.error(e instanceof Error ? e.message : "Failed to toggle power");
                      } finally {
                        setPowerTogglingIds(prev => { const s = new Set(prev); s.delete(device.deviceId); return s; });
                      }
                    }}
                    className={[
                      "p-2 rounded-xl border transition-all duration-200",
                      device.isPoweredOn
                        ? "border-green-200 bg-green-50 text-green-600 hover:bg-green-100"
                        : "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100",
                      (powerTogglingIds.has(device.deviceId) || device.status === "revoked")
                        ? "opacity-50 cursor-not-allowed"
                        : "",
                    ].join(" ")}
                  >
                    <Power className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                  <DeviceStatusDot status={device.status} />
                </div>
              </div>
              <h3 className="font-headline font-bold text-[#134235] text-xl mb-1">{device.name}</h3>

              {/* Power-off notice */}
              {!device.isPoweredOn && device.status !== "offline" && (
                <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-xs font-manrope font-semibold">
                  <Power className="w-3.5 h-3.5" />
                  Agent is paused — no jobs will be executed
                </div>
              )}

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

              {/* Services toggle */}
              <div className="mt-4 pt-4 border-t border-black/[0.03]">
                <button
                  onClick={() => setExpandedServiceIds(prev => {
                    const s = new Set(prev);
                    s.has(device.deviceId) ? s.delete(device.deviceId) : s.add(device.deviceId);
                    return s;
                  })}
                  className="flex items-center gap-1.5 text-xs font-bold font-manrope text-primary hover:opacity-80 transition-opacity"
                >
                  {expandedServiceIds.has(device.deviceId) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <Layers className="w-3.5 h-3.5" />
                  Services
                  {(deviceServices[device.deviceId] ?? device.assignedServices ?? []).length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-bold">
                      {(deviceServices[device.deviceId] ?? device.assignedServices ?? []).length}
                    </span>
                  )}
                </button>
                {expandedServiceIds.has(device.deviceId) && (
                  <ServiceAssignmentPanel
                    deviceId={device.deviceId}
                    currentAssigned={deviceServices[device.deviceId] ?? device.assignedServices ?? []}
                    allServices={allServices}
                    assignedMap={assignedMap()}
                    onSaved={(ids) => {
                      setDeviceServices(prev => ({ ...prev, [device.deviceId]: ids }));
                      silentRefetch();
                    }}
                  />
                )}
              </div>

              {/* Device Info toggle */}
              <div className="mt-2">
                <button
                  onClick={() => setExpandedInfoIds(prev => {
                    const s = new Set(prev);
                    s.has(device.deviceId) ? s.delete(device.deviceId) : s.add(device.deviceId);
                    return s;
                  })}
                  className="flex items-center gap-1.5 text-xs font-bold font-manrope text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  {expandedInfoIds.has(device.deviceId) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  Device Info
                </button>
                {expandedInfoIds.has(device.deviceId) && (
                  <DeviceInfoPanel deviceId={device.deviceId} />
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-black/[0.03]">
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
          Install the dRecharge Agent APK on an Android device, then scan the QR code below to
          register instantly — no manual token entry needed.
        </p>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6 text-sm text-amber-800 font-manrope">
          <strong>Security notice:</strong> This token grants full execution access. Do not share it. Tokens expire after 10 minutes.
        </div>

        <ol className="space-y-2.5 text-sm text-on-surface-variant mb-6 list-decimal list-inside">
          <li>Install the dRecharge Agent APK on your Android device</li>
          <li>Open the app and tap <span className="font-bold text-on-surface">Scan QR Code</span></li>
          <li>Generate a token using the button below</li>
          <li>Point the camera at the QR code — the app registers automatically</li>
          <li>The device appears in the list above once registered</li>
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
                    <li>Tap <span className="font-bold">Scan QR Code</span> (on any setup step)</li>
                    <li>Point at the QR code above</li>
                    <li>App auto-fills server URL + token and <strong>registers immediately</strong></li>
                  </ol>
                  <p className="text-xs text-[#134235]/60 pt-1">Or enter the Base URL + token manually if camera unavailable.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-on-surface-variant font-manrope">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Waiting for device to scan…
              </div>
              <button onClick={() => { setToken(null); setTokenExpiresAt(null); setRegistrationDetected(false); }}
                className="text-sm text-on-surface-variant hover:text-on-surface font-semibold">
                Cancel / Generate new token
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
