"use client";
import { useEffect, useMemo, useState } from "react";
import { Service, ServiceCategory, ServiceProvider } from "@/types";
import { createService, deleteService, saveService } from "@/lib/functions";
import { relativeTime } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  Terminal, Plus, Trash2, Pencil, Power, PowerOff,
  Zap, Tag, ImageOff, Search, Filter, AlertCircle,
  CheckCircle2, Clock, Layers, X, Signal,
  ChevronDown, ChevronsDownUp, ChevronsUpDown,
} from "lucide-react";

type GroupBy = "category" | "provider";

const COLLAPSED_STORAGE_KEY = "admin.services.collapsedGroups";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CatLogo({ logo, size = "sm" }: { logo: string; size?: "sm" | "md" }) {
  const [err, setErr] = useState(false);
  const isUrl = logo.startsWith("http://") || logo.startsWith("https://");
  const dim = size === "sm" ? "w-7 h-7 text-base" : "w-9 h-9 text-lg";
  return (
    <div className={`${dim} shrink-0 flex items-center justify-center rounded-xl bg-primary/10 overflow-hidden`}>
      {isUrl && !err ? (
        <img src={logo} alt="" className="w-full h-full object-cover" onError={() => setErr(true)} />
      ) : !isUrl && logo ? (
        <span className="leading-none">{logo}</span>
      ) : (
        <ImageOff className="w-3 h-3 text-on-surface-variant" />
      )}
    </div>
  );
}

type ConfigState = "ready" | "incomplete" | "draft";

function getConfigState(svc: Service): { state: ConfigState; missing: string[] } {
  const missing: string[] = [];
  if (!svc.ussdSteps || svc.ussdSteps.length === 0) missing.push("USSD steps");
  if (!svc.successSmsFormat?.trim()) missing.push("Success SMS");
  if (!svc.failureSmsTemplates || svc.failureSmsTemplates.filter(t => t.template?.trim()).length === 0) missing.push("Failure SMS");
  if (missing.length === 0) return { state: "ready", missing };
  if (missing.length >= 3) return { state: "draft", missing };
  return { state: "incomplete", missing };
}

// ─── New Service Modal ────────────────────────────────────────────────────────

function NewServiceModal({ open, onClose, categories, providers }: {
  open: boolean;
  onClose: () => void;
  categories: ServiceCategory[];
  providers: ServiceProvider[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [icon, setIcon] = useState("");
  const [recipientLength, setRecipientLength] = useState(11);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) { toast.error("Service name is required"); return; }
    setSaving(true);
    try {
      const result = await createService({
        name: name.trim(), description: description.trim(),
        categoryId: categoryId || undefined,
        providerId: providerId || undefined,
        isActive: false,
        pin: "", simSlot: 1, recipientLength,
        successSmsFormat: "", smsTimeout: 30, icon: icon.trim(),
      });
      toast.success("Service created — now configure its USSD template");
      onClose();
      router.push(`/admin/services/${result.serviceId}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-black/5 premium-shadow p-8 max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={() => !saving && onClose()} disabled={saving}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-surface-container disabled:opacity-40 transition-colors">
          <X className="w-4 h-4 text-on-surface-variant" />
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-[#E8F1EE] rounded-xl">
            <Terminal className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-headline font-bold text-[#134235] text-xl">New Service</h2>
            <p className="text-xs text-on-surface-variant">Configure the USSD steps after creation</p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-1.5">
              Service Name <span className="text-red-500">*</span>
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              placeholder="e.g. bKash Send Money"
              className="w-full border border-outline-variant bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-1.5">
              Recipient Number Length <span className="text-red-500">*</span>
            </label>
            <input type="number" min={1} value={recipientLength} onChange={(e) => setRecipientLength(Number(e.target.value))} required
              className="w-full border border-outline-variant bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          <ImageUpload value={icon} onChange={setIcon} storagePath="services" label="Service Icon" hint="(optional — upload or paste URL)" />

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-1.5">
              Category <span className="text-outline font-normal normal-case tracking-normal">optional</span>
            </label>
            {categories.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <Tag className="w-3.5 h-3.5 shrink-0" />
                No categories yet — <Link href="/admin/categories" className="underline font-bold">create one first</Link>
              </div>
            ) : (
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                className="w-full border border-outline-variant bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                <option value="">— Uncategorised —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.logo && !c.logo.startsWith("http") ? `${c.logo} ` : ""}{c.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-1.5">
              Provider <span className="text-outline font-normal normal-case tracking-normal">optional</span>
            </label>
            {providers.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <Signal className="w-3.5 h-3.5 shrink-0" />
                No providers yet — <Link href="/admin/providers" className="underline font-bold">create one first</Link>
              </div>
            ) : (
              <select value={providerId} onChange={(e) => setProviderId(e.target.value)}
                className="w-full border border-outline-variant bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                <option value="">— No provider —</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.logo && !p.logo.startsWith("http") ? `${p.logo} ` : ""}{p.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-1.5">
              Description <span className="text-outline font-normal normal-case tracking-normal">optional</span>
            </label>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of what this service does"
              className="w-full border border-outline-variant bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          <div className="flex gap-3 pt-2 justify-end">
            <button type="button" onClick={onClose} disabled={saving}
              className="px-5 py-2.5 text-sm border border-outline-variant rounded-xl hover:bg-surface-container disabled:opacity-50 font-semibold transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 text-sm bg-primary text-on-primary rounded-xl hover:opacity-90 disabled:opacity-50 font-bold font-manrope flex items-center gap-2 shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4" />
              {saving ? "Creating…" : "Create & Configure"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "primary" | "amber" | "slate" | "red";
}) {
  const tones = {
    primary: { bg: "bg-primary/10", text: "text-primary" },
    amber:   { bg: "bg-amber-50",   text: "text-amber-700" },
    slate:   { bg: "bg-slate-100",  text: "text-slate-700" },
    red:     { bg: "bg-red-50",     text: "text-red-700" },
  }[tone];
  return (
    <div className="bg-white border border-black/5 rounded-2xl p-4 flex items-center gap-3 premium-shadow">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones.bg}`}>
        <Icon className={`w-5 h-5 ${tones.text}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-on-surface-variant font-manrope uppercase tracking-wider font-bold">{label}</p>
        <p className="font-headline text-2xl font-extrabold text-on-surface leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({ svc, onToggle, onDelete, toggling, deleting }: {
  svc: Service;
  onToggle: (s: Service) => void;
  onDelete: (s: Service) => Promise<void>;
  toggling: boolean;
  deleting: boolean;
}) {
  const cfg = getConfigState(svc);

  const stateBadge = cfg.state === "ready" ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider font-manrope text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
      <CheckCircle2 className="w-3 h-3" /> Ready
    </span>
  ) : cfg.state === "incomplete" ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider font-manrope text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
      <AlertCircle className="w-3 h-3" /> Incomplete
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider font-manrope text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
      <Clock className="w-3 h-3" /> Draft
    </span>
  );

  return (
    <div className="group bg-white border border-black/5 rounded-2xl p-5 premium-shadow hover:border-primary/30 hover:shadow-md transition-all flex flex-col gap-3.5 relative">
      {/* Top: icon + name + status pill */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 shrink-0 bg-surface-container rounded-xl flex items-center justify-center overflow-hidden">
          {svc.icon ? (
            <img src={svc.icon} alt={svc.name} className="w-full h-full object-cover" />
          ) : (
            <Terminal className="w-5 h-5 text-on-surface-variant" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-on-surface font-manrope leading-tight truncate">{svc.name}</p>
            <span
              title={svc.isActive ? "Active" : "Inactive"}
              className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider font-manrope px-2 py-1 rounded-md ${
                svc.isActive ? "text-emerald-700 bg-emerald-50" : "text-slate-500 bg-slate-100"
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${svc.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
              {svc.isActive ? "On" : "Off"}
            </span>
          </div>
          {svc.description ? (
            <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{svc.description}</p>
          ) : (
            <p className="text-xs text-on-surface-variant/60 italic mt-0.5">No description</p>
          )}
        </div>
      </div>

      {/* Config + meta badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {stateBadge}
        <span className="text-[10px] font-bold bg-surface-container px-2 py-1 rounded-md font-manrope text-on-surface uppercase tracking-wider">
          {svc.ussdSteps?.length || 0} steps
        </span>
        <span className="text-[10px] font-bold bg-surface-container px-2 py-1 rounded-md text-on-surface-variant font-manrope uppercase tracking-wider">
          SIM {svc.simSlot || 1}
        </span>
        <span className="text-[10px] font-bold bg-surface-container px-2 py-1 rounded-md text-on-surface-variant font-manrope uppercase tracking-wider">
          {svc.pin ? "PIN set" : "No PIN"}
        </span>
      </div>

      {/* Missing checklist */}
      {cfg.missing.length > 0 && (
        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="font-manrope">
            <strong className="font-bold">Missing:</strong> {cfg.missing.join(" · ")}
          </span>
        </div>
      )}

      {/* Footer: toggle + edit + delete */}
      <div className="flex items-center justify-between pt-3 mt-auto border-t border-black/[0.04]">
        <button
          disabled={toggling}
          onClick={() => onToggle(svc)}
          title={svc.isActive ? "Deactivate" : "Activate"}
          className={`inline-flex items-center gap-1.5 text-xs font-bold font-manrope px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
            svc.isActive
              ? "text-emerald-700 hover:bg-emerald-50"
              : "text-on-surface-variant hover:bg-surface-container"
          }`}>
          {svc.isActive ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
          {toggling ? "…" : svc.isActive ? "Deactivate" : "Activate"}
        </button>

        <div className="flex items-center gap-1">
          <Link href={`/admin/services/${svc.id}`}
            className="inline-flex items-center gap-1 text-primary text-xs font-bold font-manrope px-2.5 py-1.5 rounded-lg hover:bg-primary/5 transition-colors">
            <Pencil className="w-3 h-3" /> Edit
          </Link>
          <ConfirmDialog
            title={`Delete "${svc.name}"?`}
            description="This service will be permanently removed. Existing transactions are kept, but no new jobs can use this service."
            confirmLabel={deleting ? "Deleting…" : "Delete"}
            confirmVariant="destructive"
            onConfirm={() => onDelete(svc)}
          >
            <button
              disabled={deleting}
              title="Delete service"
              className="p-1.5 text-on-surface-variant hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </ConfirmDialog>
        </div>
      </div>

      {svc.updatedAt && (
        <p className="text-[10px] text-on-surface-variant/60 font-manrope -mt-1">
          Updated {relativeTime(svc.updatedAt)}
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FilterMode = "all" | "active" | "inactive" | "incomplete";

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("category");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // ── Persist collapsed state per groupBy mode ───────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(`${COLLAPSED_STORAGE_KEY}.${groupBy}`);
      setCollapsed(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch {
      setCollapsed(new Set());
    }
  }, [groupBy]);

  const persistCollapsed = (next: Set<string>) => {
    setCollapsed(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`${COLLAPSED_STORAGE_KEY}.${groupBy}`, JSON.stringify([...next]));
      } catch {/* ignore */}
    }
  };

  const toggleCollapsed = (key: string) => {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key); else next.add(key);
    persistCollapsed(next);
  };

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const provMap = useMemo(() => Object.fromEntries(providers.map((p) => [p.id, p])), [providers]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch("/api/admin/categories").then(r => r.json()),
      fetch("/api/admin/providers").then(r => r.json()),
      fetch("/api/admin/services").then(r => r.json()),
    ]).then(([catData, provData, svcData]) => {
      if (!mounted) return;
      if (catData.categories) setCategories(catData.categories);
      if (provData.providers) setProviders(provData.providers);
      if (svcData.services) setServices(svcData.services);
    }).catch(console.error).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  async function handleToggle(svc: Service) {
    setTogglingId(svc.id);
    try {
      await saveService({
        serviceId: svc.id, name: svc.name, icon: svc.icon, description: svc.description,
        isActive: !svc.isActive, categoryId: svc.categoryId, providerId: svc.providerId,
        ussdSteps: svc.ussdSteps, pin: svc.pin,
        simSlot: svc.simSlot, successSmsFormat: svc.successSmsFormat,
        failureSmsTemplates: svc.failureSmsTemplates, smsTimeout: svc.smsTimeout,
      });
      setServices((prev) => prev.map((item) => item.id === svc.id ? { ...item, isActive: !svc.isActive } : item));
      toast.success(svc.isActive ? "Service deactivated" : "Service activated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setTogglingId(null); }
  }

  async function handleDelete(svc: Service) {
    setDeletingId(svc.id);
    try {
      await deleteService(svc.id);
      setServices((prev) => prev.filter((item) => item.id !== svc.id));
      toast.success("Service deleted");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
      throw e;
    } finally {
      setDeletingId(null);
    }
  }

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let active = 0, inactive = 0, incomplete = 0;
    for (const s of services) {
      if (s.isActive) active++; else inactive++;
      if (getConfigState(s).state !== "ready") incomplete++;
    }
    return { total: services.length, active, inactive, incomplete };
  }, [services]);

  // ── Filtering + search ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => {
      if (filter === "active" && !s.isActive) return false;
      if (filter === "inactive" && s.isActive) return false;
      if (filter === "incomplete" && getConfigState(s).state === "ready") return false;
      if (!q) return true;
      const hay = [
        s.name, s.description,
        s.categoryId ? catMap[s.categoryId]?.name : "",
        s.providerId ? provMap[s.providerId]?.name : "",
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [services, query, filter, catMap, provMap]);

  // ── Grouping (category or provider) ─────────────────────────────────────────
  const grouped = useMemo(() => {
    const out: { key: string; label: string; logo: string | null; items: Service[] }[] = [];

    if (groupBy === "category") {
      const ids = [...categories.map((c) => c.id), "__none__"];
      for (const cid of ids) {
        const items = cid === "__none__"
          ? filtered.filter((s) => !s.categoryId || !catMap[s.categoryId])
          : filtered.filter((s) => s.categoryId === cid);
        if (items.length === 0) continue;
        const cat = cid !== "__none__" ? catMap[cid] : null;
        out.push({ key: cid, label: cat ? cat.name : "Uncategorised", logo: cat ? cat.logo : null, items });
      }
    } else {
      const ids = [...providers.map((p) => p.id), "__none__"];
      for (const pid of ids) {
        const items = pid === "__none__"
          ? filtered.filter((s) => !s.providerId || !provMap[s.providerId])
          : filtered.filter((s) => s.providerId === pid);
        if (items.length === 0) continue;
        const prov = pid !== "__none__" ? provMap[pid] : null;
        out.push({ key: pid, label: prov ? prov.name : "No provider", logo: prov ? prov.logo : null, items });
      }
    }
    return out;
  }, [filtered, groupBy, categories, providers, catMap, provMap]);

  const filters: { key: FilterMode; label: string; count: number }[] = [
    { key: "all",        label: "All",        count: stats.total },
    { key: "active",     label: "Active",     count: stats.active },
    { key: "inactive",   label: "Inactive",   count: stats.inactive },
    { key: "incomplete", label: "Needs setup", count: stats.incomplete },
  ];

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">Services</h1>
          <p className="text-on-surface-variant font-body text-base">
            Configure the USSD flows and SMS templates that power every recharge.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin/categories"
            className="bg-white text-[#134235] border border-black/5 px-5 py-3.5 rounded-xl font-bold font-manrope flex items-center gap-2 premium-shadow hover:border-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap">
            <Tag className="w-5 h-5 text-primary" /> Categories
          </Link>
          <Link href="/admin/providers"
            className="bg-white text-[#134235] border border-black/5 px-5 py-3.5 rounded-xl font-bold font-manrope flex items-center gap-2 premium-shadow hover:border-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap">
            <Signal className="w-5 h-5 text-primary" /> Providers
          </Link>
          <button onClick={() => setNewOpen(true)}
            className="bg-primary text-on-primary px-6 py-3.5 rounded-xl font-bold font-manrope flex items-center gap-2 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap">
            <Plus className="w-5 h-5" /> New Service
          </button>
        </div>
      </section>

      {/* Stats */}
      {!loading && services.length > 0 && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Layers}     label="Total"        value={stats.total}      tone="slate" />
          <StatCard icon={Power}      label="Active"       value={stats.active}     tone="primary" />
          <StatCard icon={PowerOff}   label="Inactive"     value={stats.inactive}   tone="slate" />
          <StatCard icon={AlertCircle} label="Needs setup" value={stats.incomplete} tone="amber" />
        </section>
      )}

      {/* Info banner (only when no services yet, gives clarity) */}
      {!loading && services.length === 0 && (
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 flex items-start gap-4">
          <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-primary/80 space-y-0.5">
            <p className="font-bold text-primary">How services work</p>
            <p>
              Create one service per recharge type (bKash, Nagad, etc.). Each service has its own USSD flow and
              SMS templates. The Android agent pulls the configuration when running a job.
            </p>
          </div>
        </div>
      )}

      {/* Toolbar — sticky for easy access while scrolling long lists */}
      {!loading && services.length > 0 && (
        <section className="sticky top-2 z-30 bg-white/95 backdrop-blur border border-black/5 rounded-2xl p-3 sm:p-4 premium-shadow space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, description, category, or provider…"
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {query && (
                <button onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-surface-container">
                  <X className="w-3.5 h-3.5 text-on-surface-variant" />
                </button>
              )}
            </div>

            {/* Filter chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1">
              <Filter className="w-4 h-4 text-on-surface-variant shrink-0" />
              {filters.map((f) => {
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-manrope whitespace-nowrap transition-colors ${
                      active
                        ? "bg-primary text-on-primary shadow-sm shadow-primary/20"
                        : "bg-surface text-on-surface-variant hover:bg-surface-container border border-outline-variant"
                    }`}>
                    {f.label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${active ? "bg-white/20" : "bg-surface-container"}`}>
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom row: group-by toggle + expand/collapse all */}
          <div className="flex items-center justify-between gap-3 flex-wrap border-t border-black/[0.04] pt-3">
            <div className="inline-flex items-center gap-2">
              <span className="text-xs font-bold font-manrope uppercase tracking-wider text-on-surface-variant">
                Group by
              </span>
              <div className="inline-flex p-1 bg-surface-container rounded-xl">
                <button
                  onClick={() => setGroupBy("category")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-manrope transition-all ${
                    groupBy === "category"
                      ? "bg-white text-primary shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}>
                  <Tag className="w-3.5 h-3.5" /> Category
                </button>
                <button
                  onClick={() => setGroupBy("provider")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-manrope transition-all ${
                    groupBy === "provider"
                      ? "bg-white text-primary shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}>
                  <Signal className="w-3.5 h-3.5" /> Provider
                </button>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5">
              <button
                onClick={() => persistCollapsed(new Set())}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-manrope text-on-surface-variant bg-surface hover:bg-surface-container border border-outline-variant transition-colors">
                <ChevronsUpDown className="w-3.5 h-3.5" /> Expand all
              </button>
              <button
                onClick={() => persistCollapsed(new Set(grouped.map((g) => g.key)))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-manrope text-on-surface-variant bg-surface hover:bg-surface-container border border-outline-variant transition-colors">
                <ChevronsDownUp className="w-3.5 h-3.5" /> Collapse all
              </button>
            </div>
          </div>
        </section>
      )}

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-52 bg-white rounded-2xl border border-black/5 animate-pulse" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="border-2 border-dashed border-outline-variant rounded-2xl px-6 py-16 text-center bg-white">
          <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Terminal className="w-8 h-8 text-on-surface-variant" />
          </div>
          <p className="text-on-surface font-bold font-manrope text-lg mb-1">No services yet</p>
          <p className="text-sm text-on-surface-variant mb-4">Add your first service to start automating recharges.</p>
          <button onClick={() => setNewOpen(true)}
            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-sm font-bold font-manrope rounded-xl hover:opacity-90 shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4" /> Create your first service
          </button>
        </div>
      ) : grouped.length === 0 ? (
        <div className="border-2 border-dashed border-outline-variant rounded-2xl px-6 py-14 text-center bg-white">
          <Search className="w-8 h-8 text-on-surface-variant mx-auto mb-3" />
          <p className="text-on-surface font-bold font-manrope mb-1">No matches</p>
          <p className="text-sm text-on-surface-variant mb-3">
            {query
              ? <>Nothing matches <strong className="text-on-surface">&ldquo;{query}&rdquo;</strong>.</>
              : "No services match the selected filter."}
          </p>
          <button onClick={() => { setQuery(""); setFilter("all"); }}
            className="px-4 py-2 text-xs font-bold font-manrope border border-outline-variant rounded-lg hover:bg-surface-container">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => {
            const isCollapsed = collapsed.has(group.key);
            const activeCount = group.items.filter((s) => s.isActive).length;
            const needsSetupCount = group.items.filter((s) => getConfigState(s).state !== "ready").length;
            return (
              <section
                key={group.key}
                className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow"
              >
                <button
                  type="button"
                  onClick={() => toggleCollapsed(group.key)}
                  aria-expanded={!isCollapsed}
                  className="w-full flex items-center gap-3 p-4 hover:bg-surface-container/40 transition-colors text-left">
                  <ChevronDown
                    className={`w-4 h-4 text-on-surface-variant shrink-0 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                  />
                  {group.logo ? (
                    <CatLogo logo={group.logo} size="md" />
                  ) : (
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-surface-container">
                      {groupBy === "provider"
                        ? <Signal className="w-4 h-4 text-on-surface-variant" />
                        : <Tag className="w-4 h-4 text-on-surface-variant" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-headline font-bold text-[#134235] text-lg leading-tight truncate">{group.label}</h2>
                    <p className="text-[11px] text-on-surface-variant font-manrope mt-0.5">
                      {group.items.length} service{group.items.length !== 1 ? "s" : ""}
                      {activeCount > 0 && <> · {activeCount} active</>}
                      {needsSetupCount > 0 && <> · {needsSetupCount} need setup</>}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold font-manrope uppercase tracking-wider px-2 py-1 rounded-md bg-emerald-50 text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {activeCount}
                    </span>
                    {needsSetupCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold font-manrope uppercase tracking-wider px-2 py-1 rounded-md bg-amber-50 text-amber-700">
                        <AlertCircle className="w-3 h-3" /> {needsSetupCount}
                      </span>
                    )}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="border-t border-black/[0.04] p-3 sm:p-4 bg-surface-container/20">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {group.items.map((svc) => (
                        <ServiceCard
                          key={svc.id}
                          svc={svc}
                          onToggle={handleToggle}
                          onDelete={handleDelete}
                          toggling={togglingId === svc.id}
                          deleting={deletingId === svc.id}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <NewServiceModal open={newOpen} onClose={() => setNewOpen(false)} categories={categories} providers={providers} />
    </div>
  );
}
