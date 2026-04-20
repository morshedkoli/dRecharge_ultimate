"use client";
import { useEffect, useState } from "react";
import { Service, ServiceCategory } from "@/types";
import { createService, deleteService, saveService } from "@/lib/functions";
import { relativeTime } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageUpload } from "@/components/admin/ImageUpload";
import {
  Terminal, Plus, Trash2, Pencil, ToggleLeft, ToggleRight,
  Zap, Tag, ImageOff, ArrowRight,
} from "lucide-react";

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

function NewServiceModal({ open, onClose, categories }: { open: boolean; onClose: () => void; categories: ServiceCategory[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [icon, setIcon] = useState("");
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
        categoryId: categoryId || undefined, isActive: false,
        pin: "", simSlot: 1,
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

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch("/api/admin/categories").then(r => r.json()),
      fetch("/api/admin/services").then(r => r.json())
    ]).then(([catData, svcData]) => {
      if (!mounted) return;
      if (catData.categories) setCategories(catData.categories);
      if (svcData.services) setServices(svcData.services);
    }).catch(console.error).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  async function handleToggle(svc: Service) {
    setTogglingId(svc.id);
    try {
      await saveService({ serviceId: svc.id, name: svc.name, icon: svc.icon, description: svc.description,
        isActive: !svc.isActive, categoryId: svc.categoryId,
        ussdSteps: svc.ussdSteps, pin: svc.pin,
        simSlot: svc.simSlot, successSmsFormat: svc.successSmsFormat,
        failureSmsTemplates: svc.failureSmsTemplates, smsTimeout: svc.smsTimeout });
      setServices((prev) => prev.map((item) => item.id === svc.id ? { ...item, isActive: !svc.isActive } : item));
      toast.success(svc.isActive ? "Service deactivated" : "Service activated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setTogglingId(null); }
  }

  async function handleDelete(svc: Service) {
    if (!confirm(`Delete "${svc.name}"? This cannot be undone.`)) return;
    setDeletingId(svc.id);
    try {
      await deleteService(svc.id);
      setServices((prev) => prev.filter((item) => item.id !== svc.id));
      toast.success("Service deleted");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setDeletingId(null);
    }
  }

  const grouped: { catId: string; label: string; logo: string | null; items: Service[] }[] = [];
  const catIds = [...categories.map((c) => c.id), "__none__"];
  for (const cid of catIds) {
    const items = cid === "__none__" ? services.filter((s) => !s.categoryId || !catMap[s.categoryId]) : services.filter((s) => s.categoryId === cid);
    if (items.length === 0) continue;
    const cat = cid !== "__none__" ? catMap[cid] : null;
    grouped.push({ catId: cid, label: cat ? cat.name : "Uncategorised", logo: cat ? cat.logo : null, items });
  }

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">Services</h1>
          <p className="text-on-surface-variant font-body text-lg">Each service has its own USSD template and configuration.</p>
        </div>
        <button onClick={() => setNewOpen(true)}
          className="bg-primary text-on-primary px-6 py-3.5 rounded-xl font-bold font-manrope flex items-center gap-2 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
          <Plus className="w-5 h-5" /> New Service
        </button>
      </section>

      {/* Info banner */}
      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 flex items-start gap-4">
        <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-primary/80 space-y-0.5">
          <p className="font-bold text-primary">How it works</p>
          <p>When a user submits a &ldquo;Send Money&rdquo; request, they select a <strong>service</strong>. The Android agent fetches
            <code className="mx-1 bg-primary/10 px-1.5 py-0.5 rounded text-xs font-mono">services/{"{serviceId}"}</code>
            to get the USSD flow and SMS patterns.</p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-white rounded-2xl border border-black/5 animate-pulse" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="border-2 border-dashed border-outline-variant rounded-2xl px-6 py-16 text-center">
          <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Terminal className="w-8 h-8 text-on-surface-variant" />
          </div>
          <p className="text-on-surface font-bold font-manrope text-lg mb-2">No services configured yet</p>
          <button onClick={() => setNewOpen(true)}
            className="mt-2 px-5 py-2.5 bg-primary text-on-primary text-sm font-bold font-manrope rounded-xl hover:opacity-90 shadow-lg shadow-primary/20">
            Create your first service
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.catId}>
              <div className="flex items-center gap-3 mb-3 px-1">
                {group.logo ? (
                  <CatLogo logo={group.logo} size="md" />
                ) : (
                  <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-surface-container">
                    <Tag className="w-4 h-4 text-on-surface-variant" />
                  </div>
                )}
                <span className="font-headline font-bold text-[#134235] text-lg">{group.label}</span>
                <span className="text-xs text-on-surface-variant font-manrope font-bold">
                  ({group.items.length} service{group.items.length !== 1 ? "s" : ""})
                </span>
              </div>

              <div className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[600px]">
                    <thead>
                      <tr className="text-[11px] font-extrabold text-on-surface-variant/60 uppercase tracking-[0.2em] bg-surface-container/30 font-manrope">
                        <th className="px-8 py-4">Service</th>
                        <th className="px-8 py-4">USSD Flow</th>
                        <th className="px-8 py-4">SIM & PIN</th>
                        <th className="px-8 py-4">Status</th>
                        <th className="px-8 py-4">Updated</th>
                        <th className="px-8 py-4" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.03]">
                      {group.items.map((svc) => (
                        <tr key={svc.id} className="group hover:bg-surface-container/20 transition-colors">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 shrink-0 bg-surface-container rounded-xl flex items-center justify-center overflow-hidden">
                                {svc.icon ? (
                                  <img src={svc.icon} alt={svc.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Terminal className="w-5 h-5 text-on-surface-variant" />
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-on-surface font-manrope">{svc.name}</p>
                                {svc.description && (
                                  <p className="text-xs text-on-surface-variant mt-0.5 truncate max-w-[200px]">{svc.description}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            {svc.ussdSteps && svc.ussdSteps.length > 0
                              ? <span className="text-xs font-bold bg-surface-container px-2.5 py-1 rounded-lg font-manrope text-on-surface">{svc.ussdSteps.length} step{svc.ussdSteps.length !== 1 ? 's' : ''}</span>
                              : <span className="text-xs text-amber-600 italic font-manrope">Not configured</span>}
                          </td>
                          <td className="px-8 py-5 text-on-surface-variant">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold bg-surface-container px-2.5 py-1 rounded-full text-on-surface-variant font-manrope uppercase tracking-wider w-fit">SIM {svc.simSlot || 1}</span>
                              <span className="text-xs font-mono">{svc.pin ? "••••" : <span className="text-outline">none</span>}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <button disabled={togglingId === svc.id} onClick={() => handleToggle(svc)}
                              className="flex items-center gap-1.5 disabled:opacity-50 transition-opacity">
                              {svc.isActive
                                ? <><ToggleRight className="w-5 h-5 text-primary" /><span className="text-xs font-bold text-primary font-manrope">Active</span></>
                                : <><ToggleLeft className="w-5 h-5 text-on-surface-variant" /><span className="text-xs font-bold text-on-surface-variant font-manrope">Inactive</span></>
                              }
                            </button>
                          </td>
                          <td className="px-8 py-5 text-xs text-on-surface-variant">
                            {svc.updatedAt ? relativeTime(svc.updatedAt) : "—"}
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-2 justify-end">
                              <Link href={`/admin/services/${svc.id}`}
                                className="inline-flex items-center gap-1 text-primary text-xs font-bold font-manrope hover:underline">
                                <Pencil className="w-3 h-3" /> Edit <ArrowRight className="w-3 h-3" />
                              </Link>
                              <button disabled={deletingId === svc.id} onClick={() => handleDelete(svc)}
                                className="p-1.5 text-on-surface-variant hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NewServiceModal open={newOpen} onClose={() => setNewOpen(false)} categories={categories} />
    </div>
  );
}
