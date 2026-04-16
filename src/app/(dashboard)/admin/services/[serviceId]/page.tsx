"use client";
import { use, useEffect, useState, useCallback } from "react";
import { Service, ServiceCategory } from "@/types";
import { saveService } from "@/lib/functions";
import { relativeTime } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, XCircle, ToggleLeft, ToggleRight, Save, Copy,
  Tag, Smartphone, MessageSquare, Zap, Settings, Loader2,
  CheckCircle2, AlertCircle, Info, Lock,
} from "lucide-react";
import Link from "next/link";
import { ImageUpload } from "@/components/admin/ImageUpload";

// ── Reusable field label ────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">
      {children}
    </label>
  );
}

// ── Input base classes ──────────────────────────────────────────────────────
const inputCls = "w-full border border-outline-variant bg-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-on-surface-variant/50";
const monoCls  = `${inputCls} font-mono`;

// ── Section card ───────────────────────────────────────────────────────────
function Section({ icon: Icon, title, subtitle, children, accent }: {
  icon: typeof Zap; title: string; subtitle?: string; children: React.ReactNode; accent?: string;
}) {
  return (
    <div className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow">
      <div className={`px-8 py-5 border-b border-black/[0.04] flex items-center gap-4 ${accent ?? ""}`}>
        <div className="p-2.5 bg-[#E8F1EE] rounded-xl shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-manrope font-bold text-[#134235] text-lg leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-8">
        {children}
      </div>
    </div>
  );
}

// ── Variable chip ──────────────────────────────────────────────────────────
function VarChip({ v, color = "violet" }: { v: string; color?: "violet" | "blue" | "green" }) {
  const colors = {
    violet: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",
    blue:   "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
    green:  "bg-[#E8F1EE] text-primary border-primary/20 hover:bg-primary/15",
  };
  return (
    <button type="button"
      onClick={() => navigator.clipboard.writeText(v).then(() => toast.success("Copied!"))}
      className={`flex items-center gap-1.5 font-mono text-[10px] border px-2.5 py-1 rounded-lg transition-colors ${colors[color]}`}>
      <Copy className="w-2.5 h-2.5 shrink-0" />
      {v}
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function ServiceEditorPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = use(params);
  const [svc, setSvc] = useState<Service | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [categoryId, setCategoryId] = useState("");
  const [ussdFlow, setUssdFlow] = useState("");
  const [pin, setPin] = useState("");
  const [simSlot, setSimSlot] = useState(1);
  const [smsTimeout, setSmsTimeout] = useState(30);
  const [successSmsFormat, setSuccessSmsFormat] = useState("");
  const [failureSmsFormat, setFailureSmsFormat] = useState("");

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch(`/api/admin/services/${serviceId}`).then(r => r.json()),
      fetch("/api/admin/categories").then(r => r.json())
    ]).then(([svcData, catData]) => {
      if (!mounted) return;
      if (catData.categories) setCategories(catData.categories);
      if (svcData.service) {
        setSvc(svcData.service);
        setName(svcData.service.name || "");
        setIcon(svcData.service.icon || "");
        setDescription(svcData.service.description || "");
        setIsActive(svcData.service.isActive ?? true);
        setCategoryId(svcData.service.categoryId || "");
        setUssdFlow(svcData.service.ussdFlow || "");
        setPin(svcData.service.pin || "");
        setSimSlot(svcData.service.simSlot || 1);
        setSmsTimeout(svcData.service.smsTimeout || 30);
        setSuccessSmsFormat(svcData.service.successSmsFormat || "");
        setFailureSmsFormat(svcData.service.failureSmsFormat || "");
      } else {
        setNotFound(true);
      }
    }).catch(console.error);
    return () => { mounted = false; };
  }, [serviceId]);

  const mark = useCallback(() => setDirty(true), []);

  // ── Readiness checks — all must pass before service can go Active ──────────
  const readinessChecks = [
    { key: "ussd",     label: "USSD Flow",          ok: ussdFlow.trim().length > 0 && ussdFlow.trim().startsWith("*") },
    { key: "pin",      label: "Service PIN",         ok: pin.trim().length > 0 },
    { key: "success",  label: "Success SMS Template", ok: successSmsFormat.trim().length > 0 },
    { key: "failure",  label: "Failure SMS Template", ok: failureSmsFormat.trim().length > 0 },
    { key: "category", label: "Category",             ok: categoryId.trim().length > 0 },
  ];
  const isReady       = readinessChecks.every((c) => c.ok);
  const missingLabels = readinessChecks.filter((c) => !c.ok).map((c) => c.label);

  async function handleSave() {
    if (!name.trim()) { toast.error("Service name is required"); return; }
    if (ussdFlow && !ussdFlow.startsWith("*")) { toast.error("USSD flow must start with *"); return; }
    // Block saving as Active if required fields are incomplete
    if (isActive && !isReady) {
      toast.error(`Cannot activate: missing ${missingLabels.join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      await saveService({
        serviceId, name: name.trim(), icon: icon.trim(), description: description.trim(),
        isActive, categoryId: categoryId || undefined,
        ussdFlow: ussdFlow.trim(), pin: pin.trim(), simSlot,
        successSmsFormat: successSmsFormat.trim(),
        failureSmsFormat: failureSmsFormat.trim(),
        smsTimeout,
      });
      toast.success("Service saved successfully");
      setDirty(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  }

  // ── Loading / not found ──────────────────────────────────────────────────
  if (notFound) return (
    <div className="p-10 flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
        <XCircle className="w-8 h-8 text-red-400" />
      </div>
      <p className="font-manrope font-bold text-on-surface">Service not found</p>
      <Link href="/admin/services" className="text-primary text-sm font-bold hover:underline flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to Services
      </Link>
    </div>
  );

  if (!svc) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );

  // render page
  return (
    <div className="p-6 sm:p-10 max-w-4xl mx-auto pb-24 space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="flex items-center gap-4">
          <Link href="/admin/services"
            className="p-2.5 rounded-xl bg-white border border-black/5 text-on-surface-variant hover:text-[#134235] hover:shadow-sm transition-all premium-shadow">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface leading-tight">
              {name || "Untitled Service"}
            </h1>
            <p className="text-on-surface-variant text-sm mt-0.5">
              SIM {simSlot} · {svc.updatedAt ? `Updated ${relativeTime(svc.updatedAt)}` : "Not yet saved"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Dirty indicator */}
          {dirty && !saving && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200/60 px-3 py-2 rounded-xl font-manrope">
              <AlertCircle className="w-3.5 h-3.5" /> Unsaved changes
            </span>
          )}
          {!dirty && svc && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-primary bg-[#E8F1EE] px-3 py-2 rounded-xl font-manrope">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          <button onClick={handleSave} disabled={!dirty || saving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary text-sm font-bold font-manrope rounded-xl hover:opacity-90 active:scale-[0.98] disabled:opacity-40 transition-all shadow-xl shadow-primary/20">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      </div>

      {/* ── 1. Service Identity ─────────────────────────────────────────── */}
      <Section icon={Zap} title="Service Identity" subtitle="Basic info displayed to users">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* Name */}
          <div>
            <FieldLabel>Service Name <span className="text-red-500 normal-case tracking-normal font-normal">*</span></FieldLabel>
            <input value={name} onChange={(e) => { setName(e.target.value); mark(); }}
              placeholder="e.g. bKash Send Money"
              className={inputCls} />
          </div>

          {/* Icon */}
          <div>
            <ImageUpload value={icon} onChange={(url) => { setIcon(url); mark(); }}
              storagePath="services" label="Service Icon" hint="(upload or paste URL)" />
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <FieldLabel>Description <span className="normal-case tracking-normal font-normal text-on-surface-variant/60">optional</span></FieldLabel>
            <input value={description} onChange={(e) => { setDescription(e.target.value); mark(); }}
              placeholder="Short description shown to users"
              className={inputCls} />
          </div>

          {/* Category */}
          <div className="sm:col-span-2">
            <FieldLabel>Category <span className="normal-case tracking-normal font-normal text-on-surface-variant/60">optional</span></FieldLabel>
            {categories.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 font-manrope font-semibold">
                <Tag className="w-3.5 h-3.5 shrink-0" />
                No categories yet —{" "}
                <Link href="/admin/categories" className="underline font-bold">create one first</Link>
              </div>
            ) : (
              <div className="relative">
                <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); mark(); }}
                  className={`${inputCls} appearance-none pr-10`}>
                  <option value="">— Uncategorised —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.logo && !c.logo.startsWith("http") ? `${c.logo} ` : ""}{c.name}
                    </option>
                  ))}
                </select>
                <Tag className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
              </div>
            )}
          </div>

          {/* Active toggle */}
          <div className="sm:col-span-2 space-y-3">
            <button
              type="button"
              onClick={() => {
                if (!isActive && !isReady) {
                  toast.error(`Complete the following first: ${missingLabels.join(", ")}`);
                  return;
                }
                setIsActive((v) => !v);
                mark();
              }}
              className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border transition-all w-full sm:w-auto ${
                isActive
                  ? "border-primary/20 bg-[#E8F1EE] text-primary"
                  : !isReady
                    ? "border-outline-variant bg-surface-container text-on-surface-variant opacity-60 cursor-not-allowed"
                    : "border-outline-variant bg-surface-container text-on-surface-variant hover:border-primary/20"
              }`}>
              {isActive
                ? <ToggleRight className="w-6 h-6 shrink-0" />
                : <ToggleLeft  className="w-6 h-6 shrink-0" />}
              <span className="text-sm font-bold font-manrope">
                {isActive ? "Active — visible to users" : "Inactive — hidden from users"}
              </span>
              {!isReady && !isActive && (
                <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-lg font-manrope">
                  <Lock className="w-3 h-3" /> {missingLabels.length} required
                </span>
              )}
            </button>

            {/* Readiness checklist */}
            <div className={`rounded-xl border px-4 py-3 ${
              isReady ? "bg-[#E8F1EE] border-primary/15" : "bg-amber-50/60 border-amber-200/50"
            }`}>
              <p className={`text-[10px] font-bold uppercase tracking-widest font-manrope mb-2 ${
                isReady ? "text-primary" : "text-amber-700"
              }`}>
                {isReady ? "✓ Ready to activate" : "Required before activation"}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                {readinessChecks.map((chk) => (
                  <span key={chk.key} className={`flex items-center gap-2 text-xs font-manrope font-semibold ${
                    chk.ok ? "text-primary" : "text-amber-700"
                  }`}>
                    {chk.ok
                      ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      : <AlertCircle  className="w-3.5 h-3.5 shrink-0" />}
                    {chk.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── 2. USSD Flow ────────────────────────────────────────────────── */}
      <Section icon={Smartphone} title="USSD Flow & Authentication" subtitle="How the Android agent dials and navigates menus">
        <div className="space-y-6">
          {/* USSD sequence */}
          <div>
            <FieldLabel>USSD Flow Sequence</FieldLabel>
            <p className="text-xs text-on-surface-variant mb-3">
              Use hyphens to separate each menu step.{" "}
              <code className="bg-surface-container px-1.5 py-0.5 rounded font-mono text-[11px]">*247#-1-{"{recipientNumber}"}-{"{amount}"}-{"{pin}"}</code>
            </p>
            <input value={ussdFlow} onChange={(e) => { setUssdFlow(e.target.value); mark(); }}
              placeholder="e.g. *247#-1-{recipientNumber}-{amount}-{pin}"
              className={monoCls} />
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest font-manrope">Variables:</span>
              {["{recipientNumber}", "{amount}", "{pin}"].map((v) => (
                <VarChip key={v} v={v} color="violet" />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* PIN */}
            <div>
              <FieldLabel>Service PIN</FieldLabel>
              <input value={pin} onChange={(e) => { setPin(e.target.value); mark(); }}
                type="password" placeholder="e.g. 12345"
                className={monoCls} />
            </div>

            {/* SIM slot */}
            <div>
              <FieldLabel>SIM Slot</FieldLabel>
              <select value={simSlot} onChange={(e) => { setSimSlot(parseInt(e.target.value) || 1); mark(); }}
                className={`${inputCls} appearance-none`}>
                <option value={1}>SIM 1</option>
                <option value={2}>SIM 2</option>
              </select>
            </div>

            {/* SMS timeout */}
            <div>
              <FieldLabel>SMS Timeout (sec)</FieldLabel>
              <input type="number" min={10} max={120} value={smsTimeout}
                onChange={(e) => { setSmsTimeout(parseInt(e.target.value) || 30); mark(); }}
                className={inputCls} />
            </div>
          </div>
        </div>
      </Section>

      {/* ── 3. SMS Validation ───────────────────────────────────────────── */}
      <Section icon={MessageSquare} title="SMS Validation Templates" subtitle="Patterns used to confirm or reject a completed transaction">
        <div className="space-y-6">
          {/* Info banner */}
          <div className="flex gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 space-y-1">
              <p className="font-bold font-manrope">How SMS parsing works</p>
              <p>Paste the full confirmation SMS you receive from the operator. Replace dynamic parts with variables. The server wildcards these and validates incoming messages against the template exactly.</p>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-widest font-manrope">Variables:</span>
                {["{recipientNumber}", "{amount}", "{trxId}", "{balance}"].map((v) => (
                  <VarChip key={v} v={v} color="blue" />
                ))}
              </div>
            </div>
          </div>

          {/* Success template */}
          <div>
            <FieldLabel>
              Success Template{" "}
              <span className="normal-case tracking-normal font-normal text-primary">(approves job)</span>
            </FieldLabel>
            <textarea value={successSmsFormat}
              onChange={(e) => { setSuccessSmsFormat(e.target.value); mark(); }} rows={3}
              placeholder={`e.g. Send money to {recipientNumber} successful. Amount: {amount}. TrxID: {trxId} Balance: {balance}`}
              className={`${monoCls} resize-y leading-relaxed focus:ring-primary/20`} />
            {successSmsFormat && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-primary font-manrope font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Template configured
              </div>
            )}
          </div>

          {/* Failure template */}
          <div>
            <FieldLabel>
              Failure Template{" "}
              <span className="normal-case tracking-normal font-normal text-red-500">(fails job & refunds user)</span>
            </FieldLabel>
            <textarea value={failureSmsFormat}
              onChange={(e) => { setFailureSmsFormat(e.target.value); mark(); }} rows={3}
              placeholder="e.g. Transaction failed. Insufficient balance."
              className={`${monoCls} resize-y leading-relaxed focus:ring-red-300`} />
            {failureSmsFormat && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 font-manrope font-semibold">
                <AlertCircle className="w-3.5 h-3.5" /> Template configured
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── 4. Metadata card ────────────────────────────────────────────── */}
      <div className="bg-surface-container/40 border border-black/[0.04] rounded-2xl px-8 py-5 flex flex-wrap gap-6 text-xs text-on-surface-variant font-manrope">
        <span className="flex items-center gap-1.5"><Settings className="w-3.5 h-3.5" /> ID: <code className="font-mono">{serviceId}</code></span>
        {/* removed createdAt */}
        {svc.updatedAt && <span>Last saved: {relativeTime(svc.updatedAt)}</span>}
      </div>

      {/* ── Sticky save bar ─────────────────────────────────────────────── */}
      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-end px-6 sm:px-10 pb-6 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-4 bg-white/80 backdrop-blur-xl border border-black/[0.06] rounded-2xl px-6 py-4 premium-shadow">
            <p className="text-sm font-bold text-amber-600 font-manrope flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> You have unsaved changes
            </p>
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary text-sm font-bold font-manrope rounded-xl hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all shadow-lg shadow-primary/20">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save All Changes</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
