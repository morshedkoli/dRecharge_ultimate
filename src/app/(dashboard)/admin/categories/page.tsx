"use client";
import { useEffect, useState, useCallback } from "react";
import { ServiceCategory } from "@/types";
import { createCategory, updateCategory, deleteCategory } from "@/lib/functions";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { toast } from "sonner";
import { Tag, Plus, Pencil, Trash2, X, Check, Layers } from "lucide-react";

function CategoryModal({
  mode,
  initial,
  onClose,
  onCreated,
  onUpdated,
}: {
  mode: "create" | "edit";
  initial?: ServiceCategory;
  onClose: () => void;
  onCreated: (cat: ServiceCategory) => void;
  onUpdated: (cat: ServiceCategory) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [logo, setLogo] = useState(initial?.logo ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) { toast.error("Category name is required"); return; }
    if (!logo.trim()) { toast.error("Logo (URL or emoji) is required"); return; }
    setSaving(true);
    try {
      if (mode === "create") {
        const result = await createCategory({ name: name.trim(), logo: logo.trim() });
        toast.success("Category created");
        onCreated({ id: result.categoryId, name: name.trim(), logo: logo.trim(), createdAt: new Date().toISOString() });
      } else if (initial) {
        await updateCategory({ categoryId: initial.id, name: name.trim(), logo: logo.trim() });
        toast.success("Category updated");
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
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-black/5 premium-shadow p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-[#E8F1EE] rounded-xl">
            <Tag className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-headline font-bold text-[#134235] text-xl">{mode === "create" ? "New Category" : "Edit Category"}</h2>
            <p className="text-xs text-on-surface-variant">Categories help group services visually</p>
          </div>
          <button onClick={onClose} disabled={saving} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ImageUpload value={logo} onChange={setLogo} storagePath="categories" label="Category Logo" hint="(upload or paste URL / emoji)" />
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope block mb-1.5">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              placeholder="e.g. Mobile Banking"
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
              {saving ? "Saving…" : mode === "create" ? "Create Category" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<ServiceCategory | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [svcCount, setSvcCount] = useState<Record<string, number>>({});

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories");
      const d = await res.json();
      if (d.categories) setCategories(d.categories);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    let mounted = true;
    fetch("/api/admin/services")
      .then(res => res.json())
      .then(d => {
        if (!mounted || !d.services) return;
        const counts: Record<string, number> = {};
        d.services.forEach((s: { categoryId?: string }) => {
          const cid = s.categoryId;
          if (cid) counts[cid] = (counts[cid] ?? 0) + 1;
        });
        setSvcCount(counts);
      })
      .catch(console.error);
    return () => { mounted = false; };
  }, []);

  function handleCreated(cat: ServiceCategory) {
    setCategories(prev => [...prev, cat]);
  }

  function handleUpdated(cat: ServiceCategory) {
    setCategories(prev => prev.map(c => c.id === cat.id ? cat : c));
  }

  async function handleDelete(cat: ServiceCategory) {
    if (!confirm(`Delete category "${cat.name}"? Services in this category will become uncategorised.`)) return;
    setDeletingId(cat.id);
    // Optimistic removal
    setCategories(prev => prev.filter(c => c.id !== cat.id));
    try {
      await deleteCategory(cat.id);
      toast.success("Category deleted");
    } catch (e: unknown) {
      // Rollback on failure
      setCategories(prev => [...prev, cat].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setDeletingId(null);
    }
  }

  function openCreate() { setEditing(undefined); setModalMode("create"); }
  function openEdit(cat: ServiceCategory) { setEditing(cat); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditing(undefined); }

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-8 pb-12">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">Categories</h1>
          <p className="text-on-surface-variant font-body text-lg">Group your services into categories shown to users.</p>
        </div>
        <button onClick={openCreate}
          className="bg-primary text-on-primary px-6 py-3.5 rounded-xl font-bold font-manrope flex items-center gap-2 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
          <Plus className="w-5 h-5" /> New Category
        </button>
      </section>

      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 flex items-start gap-4">
        <Layers className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-primary/80">
          <p className="font-bold text-primary">How categories work</p>
          <p>Each service belongs to one category. Categories appear as visual groups in the user-facing service picker.</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-white rounded-2xl border border-black/5 animate-pulse" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="border-2 border-dashed border-outline-variant rounded-2xl px-6 py-16 text-center">
          <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Tag className="w-8 h-8 text-on-surface-variant" />
          </div>
          <p className="text-on-surface font-bold font-manrope text-lg mb-2">No categories yet</p>
          <button onClick={openCreate}
            className="mt-2 px-5 py-2.5 bg-primary text-on-primary text-sm font-bold font-manrope rounded-xl hover:opacity-90 shadow-lg shadow-primary/20">
            Create your first category
          </button>
        </div>
      ) : (
        <div className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] font-extrabold text-on-surface-variant/60 uppercase tracking-[0.2em] bg-surface-container/30 font-manrope">
                  <th className="px-8 py-4">Category</th>
                  <th className="px-8 py-4">Logo</th>
                  <th className="px-8 py-4">Services</th>
                  <th className="px-8 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03]">
                {categories.map((cat) => {
                  const isUrl = cat.logo.startsWith("http://") || cat.logo.startsWith("https://");
                  return (
                    <tr key={cat.id} className="group hover:bg-surface-container/20 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 shrink-0 bg-primary/10 rounded-xl flex items-center justify-center overflow-hidden">
                            {isUrl ? (
                              <img src={cat.logo} alt={cat.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-2xl leading-none">{cat.logo}</span>
                            )}
                          </div>
                          <p className="font-bold text-on-surface font-manrope text-base">{cat.name}</p>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <code className="text-xs bg-surface-container px-2.5 py-1 rounded-lg text-on-surface font-bold font-mono max-w-[200px] truncate block">
                          {cat.logo}
                        </code>
                      </td>
                      <td className="px-8 py-5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#E8F1EE] text-primary px-3 py-1 rounded-full font-manrope uppercase tracking-wider">
                          {svcCount[cat.id] ?? 0} service{(svcCount[cat.id] ?? 0) !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => openEdit(cat)}
                            className="flex items-center gap-1 text-xs font-bold text-primary hover:underline font-manrope">
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button disabled={deletingId === cat.id} onClick={() => handleDelete(cat)}
                            className="p-1.5 text-on-surface-variant hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalMode && (
        <CategoryModal
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
