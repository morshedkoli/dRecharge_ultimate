"use client";
import { useEffect, useState, useCallback } from "react";
import { useModalEffect } from "@/lib/hooks/useModalEffect";
import { ServiceProvider } from "@/types";
import { createProvider, updateProvider, deleteProvider } from "@/lib/functions";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { toast } from "sonner";
import { Signal, Plus, Pencil, Trash2, X, Check, Network } from "lucide-react";

function ProviderModal({
  mode, initial, onClose, onCreated, onUpdated,
}: {
  mode: "create" | "edit";
  initial?: ServiceProvider;
  onClose: () => void;
  onCreated: (p: ServiceProvider) => void;
  onUpdated: (p: ServiceProvider) => void;
}) {
  const containerRef = useModalEffect(true);
  const [name, setName] = useState(initial?.name ?? "");
  const [logo, setLogo] = useState(initial?.logo ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) { toast.error("Provider name is required"); return; }
    setSaving(true);
    try {
      if (mode === "create") {
        const result = await createProvider({ name: name.trim(), logo: logo.trim() });
        toast.success("Provider created");
        onCreated({ id: result.providerId, name: name.trim(), logo: logo.trim(), createdAt: new Date().toISOString() });
      } else if (initial) {
        await updateProvider({ providerId: initial.id, name: name.trim(), logo: logo.trim() });
        toast.success("Provider updated");
        onUpdated({ ...initial, name: name.trim(), logo: logo.trim() });
      }
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div ref={containerRef} className="relative w-full max-w-lg bg-white rounded-2xl border border-black/5 premium-shadow p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-[#E8F1EE] rounded-xl">
            <Signal className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-headline font-bold text-[#134235] text-xl">{mode === "create" ? "New Provider" : "Edit Provider"}</h2>
            <p className="text-xs text-on-surface-variant">Mobile operators or service providers (e.g. Robi, Grameenphone)</p>
          </div>
          <button onClick={onClose} disabled={saving} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ImageUpload value={logo} onChange={setLogo} storagePath="providers" label="Provider Logo" hint="(upload or paste URL / emoji — optional)" />
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope block mb-1.5">
              Provider Name <span className="text-red-500">*</span>
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              placeholder="e.g. Grameenphone"
              className="w-full border border-outline-variant bg-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="px-5 py-2.5 text-sm border border-outline-variant rounded-xl hover:bg-surface-container disabled:opacity-50 font-semibold transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 text-sm bg-primary text-on-primary rounded-xl hover:opacity-90 disabled:opacity-50 font-bold font-manrope flex items-center gap-2 shadow-lg shadow-primary/20">
              <Check className="w-4 h-4" />
              {saving ? "Saving…" : mode === "create" ? "Create Provider" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<ServiceProvider | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [svcCount, setSvcCount] = useState<Record<string, number>>({});

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/providers");
      const d = await res.json();
      if (d.providers) setProviders(d.providers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  useEffect(() => {
    let mounted = true;
    fetch("/api/admin/services")
      .then(res => res.json())
      .then(d => {
        if (!mounted || !d.services) return;
        const counts: Record<string, number> = {};
        d.services.forEach((s: { providerId?: string }) => {
          const pid = s.providerId;
          if (pid) counts[pid] = (counts[pid] ?? 0) + 1;
        });
        setSvcCount(counts);
      })
      .catch(console.error);
    return () => { mounted = false; };
  }, []);

  function handleCreated(p: ServiceProvider) { setProviders(prev => [...prev, p]); }
  function handleUpdated(p: ServiceProvider) { setProviders(prev => prev.map(c => c.id === p.id ? p : c)); }

  async function handleDelete(p: ServiceProvider) {
    setDeletingId(p.id);
    const previous = providers;
    setProviders(prev => prev.filter(c => c.id !== p.id));
    try {
      await deleteProvider(p.id);
      toast.success("Provider deleted");
    } catch (e: unknown) {
      setProviders(previous);
      toast.error(e instanceof Error ? e.message : "Failed");
      throw e;
    } finally {
      setDeletingId(null);
    }
  }

  function openCreate() { setEditing(undefined); setModalMode("create"); }
  function openEdit(p: ServiceProvider) { setEditing(p); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(undefined); }

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-8 pb-12">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">Providers</h1>
          <p className="text-on-surface-variant font-body text-lg">Mobile operators or service providers a service belongs to.</p>
        </div>
        <button onClick={openCreate}
          className="bg-primary text-on-primary px-6 py-3.5 rounded-xl font-bold font-manrope flex items-center gap-2 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
          <Plus className="w-5 h-5" /> New Provider
        </button>
      </section>

      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 flex items-start gap-4">
        <Network className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-primary/80">
          <p className="font-bold text-primary">Providers vs. Categories</p>
          <p>
            A <strong>category</strong> groups services by type (e.g. &ldquo;Mobile Banking&rdquo;).
            A <strong>provider</strong> groups them by operator (e.g. &ldquo;Robi&rdquo;, &ldquo;bKash&rdquo;).
            Users can switch between the two groupings on the services page.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-white rounded-2xl border border-black/5 animate-pulse" />
          ))}
        </div>
      ) : providers.length === 0 ? (
        <div className="border-2 border-dashed border-outline-variant rounded-2xl px-6 py-16 text-center">
          <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Signal className="w-8 h-8 text-on-surface-variant" />
          </div>
          <p className="text-on-surface font-bold font-manrope text-lg mb-2">No providers yet</p>
          <button onClick={openCreate}
            className="mt-2 px-5 py-2.5 bg-primary text-on-primary text-sm font-bold font-manrope rounded-xl hover:opacity-90 shadow-lg shadow-primary/20">
            Create your first provider
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {providers.map((p) => {
            const isUrl = p.logo.startsWith("http://") || p.logo.startsWith("https://");
            return (
              <div key={p.id} className="bg-white border border-black/5 rounded-2xl p-6 flex flex-col premium-shadow card-hover transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 shrink-0 bg-primary/10 rounded-2xl flex items-center justify-center overflow-hidden">
                    {p.logo ? (
                      isUrl ? (
                        <img src={p.logo} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl leading-none">{p.logo}</span>
                      )
                    ) : (
                      <Signal className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(p)}
                      className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <ConfirmDialog
                      title={`Delete "${p.name}"?`}
                      description="Services linked to this provider will become unassigned. This cannot be undone."
                      confirmLabel={deletingId === p.id ? "Deleting…" : "Delete"}
                      confirmVariant="destructive"
                      onConfirm={() => handleDelete(p)}
                    >
                      <button disabled={deletingId === p.id} title="Delete"
                        className="p-2 text-on-surface-variant hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-40">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </ConfirmDialog>
                  </div>
                </div>

                <h3 className="font-headline font-bold text-[#134235] text-xl mb-1 truncate">{p.name}</h3>

                <div className="space-y-4 flex-1 mt-3 text-sm">
                  <div className="flex justify-between items-center pt-1 border-b border-black/[0.03] pb-3">
                    <span className="text-on-surface-variant text-xs font-bold uppercase tracking-widest font-manrope">Linked Services</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#E8F1EE] text-primary px-3 py-1 rounded-full font-manrope uppercase tracking-wider">
                      {svcCount[p.id] ?? 0} service{(svcCount[p.id] ?? 0) !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalMode && (
        <ProviderModal
          mode={modalMode}
          initial={editing}
          onClose={closeModal}
          onCreated={handleCreated}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
