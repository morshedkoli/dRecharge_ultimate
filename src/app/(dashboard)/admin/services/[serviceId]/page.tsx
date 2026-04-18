"use client";
import { use, useEffect, useState, useCallback, useRef } from "react";
import { Service, ServiceCategory, UssdStep, UssdStepType, SmsFailureTemplate } from "@/types";
import { saveService } from "@/lib/functions";
import { relativeTime } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, XCircle, ToggleLeft, ToggleRight, Save, Copy,
  Tag, Smartphone, MessageSquare, Zap, Settings, Loader2,
  CheckCircle2, AlertCircle, Info, Lock, Plus, Trash2,
  PhoneCall, Hash, Keyboard, Timer, GripVertical, Eye,
  ChevronRight, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { ImageUpload } from "@/components/admin/ImageUpload";

// ── Helpers ─────────────────────────────────────────────────────────────────

const inputCls = "w-full border border-outline-variant bg-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-on-surface-variant/50";
const monoCls  = `${inputCls} font-mono`;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">
      {children}
    </label>
  );
}

function Section({ icon: Icon, title, subtitle, children }: {
  icon: typeof Zap; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow">
      <div className="px-8 py-5 border-b border-black/[0.04] flex items-center gap-4">
        <div className="p-2.5 bg-[#E8F1EE] rounded-xl shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-manrope font-bold text-[#134235] text-lg leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-8">{children}</div>
    </div>
  );
}

function VarChip({ v, onInsert, color = "violet" }: { v: string; onInsert?: (v: string) => void; color?: "violet" | "blue" | "green" }) {
  const colors = {
    violet: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",
    blue:   "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
    green:  "bg-[#E8F1EE] text-primary border-primary/20 hover:bg-primary/15",
  };
  return (
    <button type="button"
      onClick={() => {
        if (onInsert) { onInsert(v); }
        else { navigator.clipboard.writeText(v).then(() => toast.success("Copied!")); }
      }}
      className={`flex items-center gap-1.5 font-mono text-[10px] border px-2.5 py-1 rounded-lg transition-colors ${colors[color]}`}>
      <Copy className="w-2.5 h-2.5 shrink-0" />
      {v}
    </button>
  );
}

// ── Step type metadata ───────────────────────────────────────────────────────
const STEP_TYPES: { type: UssdStepType; label: string; icon: typeof PhoneCall; description: string; color: string; bg: string }[] = [
  { type: "dial",   label: "Dial",   icon: PhoneCall, description: "Dial the initial USSD code (e.g. *247#)", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  { type: "select", label: "Select", icon: Hash,      description: "Choose a menu option (press a number)",   color: "text-blue-700",   bg: "bg-blue-50 border-blue-200"     },
  { type: "input",  label: "Input",  icon: Keyboard,  description: "Type text / fill in a field",             color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
  { type: "wait",   label: "Wait",   icon: Timer,     description: "Pause for a menu to load (milliseconds)", color: "text-amber-700",  bg: "bg-amber-50 border-amber-200"   },
];

function stepMeta(type: UssdStepType) {
  return STEP_TYPES.find((t) => t.type === type) ?? STEP_TYPES[0];
}

// ── Single Step Card ─────────────────────────────────────────────────────────
function StepCard({
  step, index, total,
  onChange, onDelete, onInsertVar,
  dragHandleProps,
}: {
  step: UssdStep;
  index: number;
  total: number;
  onChange: (updated: UssdStep) => void;
  onDelete: () => void;
  onInsertVar: (field: "value", v: string) => void;
  dragHandleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
  };
}) {
  const meta = stepMeta(step.type);
  const Icon = meta.icon;
  const isWait = step.type === "wait";

  return (
    <div className={`group relative flex gap-3 p-4 rounded-2xl border-2 transition-all ${meta.bg} hover:shadow-md`}>
      {/* Drag handle */}
      <button
        type="button"
        {...dragHandleProps}
        className="cursor-grab active:cursor-grabbing text-on-surface-variant/40 hover:text-on-surface-variant mt-1 shrink-0 touch-none"
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Step number badge */}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold font-manrope shrink-0 mt-0.5 ${meta.bg} border ${meta.bg.split(" ")[1]} ${meta.color}`}>
        {index + 1}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3 min-w-0">
        {/* Type selector + label */}
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={step.type}
            onChange={(e) => {
              const t = e.target.value as UssdStepType;
              const newLabel = stepMeta(t).label + (step.label.match(/^\w+/) ? step.label.replace(/^\w+/, "") : "");
              onChange({ ...step, type: t, label: newLabel || stepMeta(t).label });
            }}
            className={`text-xs font-bold border rounded-lg px-2.5 py-1.5 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 ${meta.bg} ${meta.color}`}
          >
            {STEP_TYPES.map((t) => (
              <option key={t.type} value={t.type}>{t.label}</option>
            ))}
          </select>
          <div className={`flex items-center gap-1.5 text-xs ${meta.color}`}>
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold font-manrope">{meta.description}</span>
          </div>
        </div>

        {/* Label field */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-1">Label (for your reference)</p>
          <input
            value={step.label}
            onChange={(e) => onChange({ ...step, label: e.target.value })}
            placeholder={`e.g. ${meta.label} step`}
            className="w-full border border-black/10 bg-white/80 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-manrope"
          />
        </div>

        {/* Value field */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-1">
            {isWait ? "Wait (milliseconds)" : "Value"}
          </p>
          <input
            value={step.value}
            onChange={(e) => onChange({ ...step, value: e.target.value })}
            placeholder={
              step.type === "dial"   ? "e.g. *247#" :
              step.type === "select" ? "e.g. 1" :
              step.type === "input"  ? "e.g. {recipientNumber}" :
              "e.g. 1500"
            }
            className="w-full border border-black/10 bg-white/80 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {!isWait && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest font-manrope">Insert:</span>
              {["{recipientNumber}", "{amount}", "{pin}"].map((v) => (
                <button key={v} type="button"
                  onClick={() => onInsertVar("value", v)}
                  className="font-mono text-[10px] border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 px-2 py-0.5 rounded-md transition-colors">
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        disabled={total === 1}
        className="self-start p-1.5 rounded-lg text-on-surface-variant hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 shrink-0"
        title="Remove step"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Flow Preview ─────────────────────────────────────────────────────────────
function FlowPreview({ steps }: { steps: UssdStep[] }) {
  const visible = steps.filter((s) => s.type !== "wait");
  if (visible.length === 0) return null;
  return (
    <div className="rounded-xl border border-primary/15 bg-[#E8F1EE]/60 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary font-manrope mb-2 flex items-center gap-1.5">
        <Eye className="w-3 h-3" /> Live Preview
      </p>
      <div className="flex items-center gap-1 flex-wrap">
        {visible.map((s, i) => (
          <span key={s.order} className="flex items-center gap-1">
            <code className="text-[11px] bg-white border border-primary/15 px-2 py-0.5 rounded-lg font-mono text-primary font-bold">
              {s.value || "…"}
            </code>
            {i < visible.length - 1 && <ArrowRight className="w-3 h-3 text-primary/40 shrink-0" />}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── USSD Step Builder ────────────────────────────────────────────────────────
function UssdStepBuilder({
  steps, onChange,
}: {
  steps: UssdStep[];
  onChange: (steps: UssdStep[]) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  function addStep(type: UssdStepType) {
    const newStep: UssdStep = {
      order: steps.length + 1,
      type,
      label: stepMeta(type).label,
      value: "",
    };
    onChange([...steps, newStep]);
  }

  function updateStep(index: number, updated: UssdStep) {
    const next = [...steps];
    next[index] = updated;
    onChange(next);
  }

  function deleteStep(index: number) {
    onChange(steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 })));
  }

  function insertVar(index: number, field: "value", v: string) {
    const step = steps[index];
    updateStep(index, { ...step, [field]: step[field] + v });
  }

  // Drag reorder
  function onDragStart(index: number) {
    setDragIdx(index);
  }
  function onDragOver(index: number) {
    if (dragIdx === null || dragIdx === index) return;
    setOverIdx(index);
  }
  function onDrop() {
    if (dragIdx === null || overIdx === null || dragIdx === overIdx) {
      setDragIdx(null); setOverIdx(null); return;
    }
    const next = [...steps];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(overIdx, 0, moved);
    onChange(next.map((s, i) => ({ ...s, order: i + 1 })));
    setDragIdx(null); setOverIdx(null);
  }

  return (
    <div className="space-y-4">
      {/* Steps list */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            key={index}
            onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
            onDrop={onDrop}
            className={overIdx === index && dragIdx !== index ? "ring-2 ring-primary/40 rounded-2xl" : ""}
          >
            <StepCard
              step={step}
              index={index}
              total={steps.length}
              onChange={(updated) => updateStep(index, updated)}
              onDelete={() => deleteStep(index)}
              onInsertVar={(field, v) => insertVar(index, field, v)}
              dragHandleProps={{
                onMouseDown: () => onDragStart(index),
              }}
            />
          </div>
        ))}
      </div>

      {/* Add step buttons */}
      <div className="border-2 border-dashed border-outline-variant rounded-2xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-3">Add Step</p>
        <div className="flex flex-wrap gap-2">
          {STEP_TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.type} type="button" onClick={() => addStep(t.type)}
                className={`flex items-center gap-2 text-xs font-bold font-manrope border rounded-xl px-3.5 py-2 transition-all hover:scale-[1.02] active:scale-[0.97] ${t.bg} ${t.color}`}>
                <Icon className="w-3.5 h-3.5" />
                + {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live preview */}
      {steps.length > 0 && <FlowPreview steps={steps} />}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
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
  const [ussdSteps, setUssdSteps] = useState<UssdStep[]>([]);
  const [pin, setPin] = useState("");
  const [simSlot, setSimSlot] = useState(1);
  const [smsTimeout, setSmsTimeout] = useState(30);
  const [successSmsFormat, setSuccessSmsFormat] = useState("");
  const [failureSmsTemplates, setFailureSmsTemplates] = useState<SmsFailureTemplate[]>([]);

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  /** Parse a legacy hyphen-delimited ussdFlow string into UssdStep array */
  function parseFlowToSteps(flow: string): UssdStep[] {
    if (!flow) return [];
    const parts = flow.split("-");
    return parts.map((value, i) => {
      let type: UssdStepType = "input";
      let label = `Step ${i + 1}`;
      if (i === 0 && value.startsWith("*")) { type = "dial"; label = "Dial USSD code"; }
      else if (/^\d+$/.test(value) && !value.includes("{")) { type = "select"; label = `Select option`; }
      else if (value.includes("{pin}")) { type = "input"; label = "Enter PIN"; }
      else if (value.includes("{amount}")) { type = "input"; label = "Enter amount"; }
      else if (value.includes("{recipientNumber}")) { type = "input"; label = "Enter recipient"; }
      return { order: i + 1, type, label, value };
    });
  }

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch(`/api/admin/services/${serviceId}`).then(r => r.json()),
      fetch("/api/admin/categories").then(r => r.json()),
    ]).then(([svcData, catData]) => {
      if (!mounted) return;
      if (catData.categories) setCategories(catData.categories);
      if (svcData.service) {
        const s = svcData.service;
        setSvc(s);
        setName(s.name || "");
        setIcon(s.icon || "");
        setDescription(s.description || "");
        setIsActive(s.isActive ?? true);
        setCategoryId(s.categoryId || "");
        // Use structured steps if present, otherwise auto-parse legacy flow
        const steps = s.ussdSteps && s.ussdSteps.length > 0
          ? s.ussdSteps
          : parseFlowToSteps(s.ussdFlow || "");
        setUssdSteps(steps);
        setPin(s.pin || "");
        setSimSlot(s.simSlot || 1);
        setSmsTimeout(s.smsTimeout || 30);
        setSuccessSmsFormat(s.successSmsFormat || "");
        // Migrate: if failureSmsTemplates exists use it; else wrap legacy string
        if (s.failureSmsTemplates && s.failureSmsTemplates.length > 0) {
          setFailureSmsTemplates(s.failureSmsTemplates);
        } else if (s.failureSmsFormat) {
          setFailureSmsTemplates([{ template: s.failureSmsFormat, message: "Transaction failed. Your amount has been refunded." }]);
        } else {
          setFailureSmsTemplates([]);
        }
      } else {
        setNotFound(true);
      }
    }).catch(console.error);
    return () => { mounted = false; };
  }, [serviceId]);

  const mark = useCallback(() => setDirty(true), []);

  // ── Readiness checks ────────────────────────────────────────────────────────
  const hasValidSteps = ussdSteps.length > 0 && ussdSteps[0]?.type === "dial" && ussdSteps[0]?.value?.startsWith("*");
  const readinessChecks = [
    { key: "ussd",     label: "USSD steps",            ok: hasValidSteps },
    { key: "pin",      label: "Service PIN",            ok: pin.trim().length > 0 },
    { key: "success",  label: "Success SMS Template",   ok: successSmsFormat.trim().length > 0 },
    { key: "failure",  label: "Failure SMS Templates",  ok: failureSmsTemplates.length > 0 && failureSmsTemplates[0].template.trim().length > 0 },
    { key: "category", label: "Category",               ok: categoryId.trim().length > 0 },
  ];
  const isReady       = readinessChecks.every((c) => c.ok);
  const missingLabels = readinessChecks.filter((c) => !c.ok).map((c) => c.label);

  async function handleSave() {
    if (!name.trim()) { toast.error("Service name is required"); return; }
    if (ussdSteps.length > 0 && ussdSteps[0]?.type !== "dial") {
      toast.error("First step must be a Dial step (e.g. *247#)");
      return;
    }
    if (isActive && !isReady) {
      toast.error(`Cannot activate: missing ${missingLabels.join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      await saveService({
        serviceId, name: name.trim(), icon: icon.trim(), description: description.trim(),
        isActive, categoryId: categoryId || undefined,
        ussdFlow: "",            // will be derived server-side
        ussdSteps,
        pin: pin.trim(), simSlot,
        successSmsFormat: successSmsFormat.trim(),
        failureSmsTemplates: failureSmsTemplates.filter(ft => ft.template.trim()),
        smsTimeout,
      });
      toast.success("Service saved successfully");
      setDirty(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  }

  // ── Loading / not found ─────────────────────────────────────────────────────
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

          <div>
            <FieldLabel>Service Name <span className="text-red-500 normal-case tracking-normal font-normal">*</span></FieldLabel>
            <input value={name} onChange={(e) => { setName(e.target.value); mark(); }}
              placeholder="e.g. bKash Send Money" className={inputCls} />
          </div>

          <div>
            <ImageUpload value={icon} onChange={(url) => { setIcon(url); mark(); }}
              storagePath="services" label="Service Icon" hint="(upload or paste URL)" />
          </div>

          <div className="sm:col-span-2">
            <FieldLabel>Description <span className="normal-case tracking-normal font-normal text-on-surface-variant/60">optional</span></FieldLabel>
            <input value={description} onChange={(e) => { setDescription(e.target.value); mark(); }}
              placeholder="Short description shown to users" className={inputCls} />
          </div>

          <div className="sm:col-span-2">
            <FieldLabel>Category <span className="normal-case tracking-normal font-normal text-on-surface-variant/60">optional</span></FieldLabel>
            {categories.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 font-manrope font-semibold">
                <Tag className="w-3.5 h-3.5 shrink-0" />
                No categories yet — <Link href="/admin/categories" className="underline font-bold">create one first</Link>
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
              {isActive ? <ToggleRight className="w-6 h-6 shrink-0" /> : <ToggleLeft  className="w-6 h-6 shrink-0" />}
              <span className="text-sm font-bold font-manrope">
                {isActive ? "Active — visible to users" : "Inactive — hidden from users"}
              </span>
              {!isReady && !isActive && (
                <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-lg font-manrope">
                  <Lock className="w-3 h-3" /> {missingLabels.length} required
                </span>
              )}
            </button>

            <div className={`rounded-xl border px-4 py-3 ${isReady ? "bg-[#E8F1EE] border-primary/15" : "bg-amber-50/60 border-amber-200/50"}`}>
              <p className={`text-[10px] font-bold uppercase tracking-widest font-manrope mb-2 ${isReady ? "text-primary" : "text-amber-700"}`}>
                {isReady ? "✓ Ready to activate" : "Required before activation"}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                {readinessChecks.map((chk) => (
                  <span key={chk.key} className={`flex items-center gap-2 text-xs font-manrope font-semibold ${chk.ok ? "text-primary" : "text-amber-700"}`}>
                    {chk.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                    {chk.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── 2. USSD Step Builder ─────────────────────────────────────────── */}
      <Section
        icon={Smartphone}
        title="USSD Flow — Step Builder"
        subtitle="Build each step the Android agent will execute in order"
      >
        <div className="space-y-5">
          {/* How it works banner */}
          <div className="flex gap-3 bg-primary/5 border border-primary/10 rounded-xl p-4">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-primary/80 space-y-1">
              <p className="font-bold font-manrope text-primary">How the Android agent follows these steps</p>
              <ol className="list-decimal list-inside space-y-0.5 text-xs text-primary/70">
                <li><strong>Dial</strong> — opens the USSD session by dialling the code (e.g. <code className="bg-primary/10 px-1 rounded font-mono">*247#</code>)</li>
                <li><strong>Select</strong> — waits for a menu and taps the numbered option</li>
                <li><strong>Input</strong> — types the specified text into a freeform field</li>
                <li><strong>Wait</strong> — pauses N milliseconds before the next step</li>
              </ol>
              <p className="text-xs mt-1">Variables like <code className="bg-primary/10 px-1 rounded font-mono">{"{recipientNumber}"}</code> are replaced with real transaction values at runtime.</p>
            </div>
          </div>

          {/* Step builder */}
          <UssdStepBuilder
            steps={ussdSteps}
            onChange={(steps) => { setUssdSteps(steps); mark(); }}
          />

          {/* PIN / SIM / Timeout row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2 border-t border-black/[0.04]">
            <div>
              <FieldLabel>Service PIN</FieldLabel>
              <input value={pin} onChange={(e) => { setPin(e.target.value); mark(); }}
                type="password" placeholder="e.g. 12345" className={monoCls} />
            </div>
            <div>
              <FieldLabel>SIM Slot</FieldLabel>
              <select value={simSlot} onChange={(e) => { setSimSlot(parseInt(e.target.value) || 1); mark(); }}
                className={`${inputCls} appearance-none`}>
                <option value={1}>SIM 1</option>
                <option value={2}>SIM 2</option>
              </select>
            </div>
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
          <div className="flex gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 space-y-1">
              <p className="font-bold font-manrope">How SMS parsing works</p>
              <p>Paste the full confirmation SMS from the operator. Replace dynamic parts with variables. The agent matches incoming SMS against this template.</p>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-widest font-manrope">Variables:</span>
                {["{recipientNumber}", "{amount}", "{trxId}", "{balance}"].map((v) => (
                  <VarChip key={v} v={v} color="blue" />
                ))}
              </div>
            </div>
          </div>

          <div>
            <FieldLabel>
              Success Template <span className="normal-case tracking-normal font-normal text-primary">(approves job &amp; confirms to user)</span>
            </FieldLabel>
            <textarea value={successSmsFormat}
              onChange={(e) => { setSuccessSmsFormat(e.target.value); mark(); }} rows={3}
              placeholder={`e.g. Send money to {recipientNumber} successful. Amount: {amount}. TrxID: {trxId} Balance: {balance}`}
              className={`${monoCls} resize-y leading-relaxed`} />
            {successSmsFormat && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-primary font-manrope font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Template configured
              </div>
            )}
          </div>

          {/* ── Failure Templates Builder ──────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <FieldLabel>
                Failure Templates <span className="normal-case tracking-normal font-normal text-red-500">(each maps an SMS pattern to a user-facing reason)</span>
              </FieldLabel>
              <button
                type="button"
                onClick={() => { setFailureSmsTemplates(prev => [...prev, { template: "", message: "" }]); mark(); }}
                className="flex items-center gap-1.5 text-xs font-bold font-manrope text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Failure Pattern
              </button>
            </div>

            {failureSmsTemplates.length === 0 && (
              <div className="rounded-xl border-2 border-dashed border-red-200 bg-red-50/40 px-4 py-5 text-center">
                <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-red-600 font-manrope">No failure templates yet</p>
                <p className="text-xs text-red-500/70 mt-1">Add at least one failure SMS pattern so the agent can detect and report failures with a specific reason.</p>
              </div>
            )}

            <div className="space-y-3">
              {failureSmsTemplates.map((ft, idx) => (
                <div key={idx} className="rounded-xl border border-red-200/70 bg-red-50/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-500 font-manrope flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" /> Failure Pattern #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setFailureSmsTemplates(prev => prev.filter((_, i) => i !== idx)); mark(); }}
                      className="p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-100 transition-colors"
                      title="Remove this failure template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-1.5">
                      SMS Pattern <span className="normal-case font-normal">— paste the exact failure SMS, replace dynamic parts with variables</span>
                    </label>
                    <textarea
                      value={ft.template}
                      onChange={(e) => {
                        const next = [...failureSmsTemplates];
                        next[idx] = { ...next[idx], template: e.target.value };
                        setFailureSmsTemplates(next); mark();
                      }}
                      rows={2}
                      placeholder="e.g. Insufficient balance. Transaction failed."
                      className={`${monoCls} resize-y leading-relaxed`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-1.5">
                      User Message <span className="normal-case font-normal">— what the user sees when this failure occurs</span>
                    </label>
                    <input
                      type="text"
                      value={ft.message}
                      onChange={(e) => {
                        const next = [...failureSmsTemplates];
                        next[idx] = { ...next[idx], message: e.target.value };
                        setFailureSmsTemplates(next); mark();
                      }}
                      placeholder="e.g. Insufficient balance — please top up and try again."
                      className={inputCls}
                    />
                    {ft.message && (
                      <p className="mt-1.5 text-xs text-on-surface-variant">
                        <span className="font-semibold text-red-600">User will see: </span>
                        <span className="italic">"{ft.message}"</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {failureSmsTemplates.length > 0 && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-red-600 font-manrope font-semibold">
                <AlertCircle className="w-3.5 h-3.5" />
                {failureSmsTemplates.filter(ft => ft.template.trim()).length} failure template{failureSmsTemplates.filter(ft => ft.template.trim()).length !== 1 ? "s" : ""} configured
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── 4. Metadata card ────────────────────────────────────────────── */}
      <div className="bg-surface-container/40 border border-black/[0.04] rounded-2xl px-8 py-5 flex flex-wrap gap-6 text-xs text-on-surface-variant font-manrope">
        <span className="flex items-center gap-1.5"><Settings className="w-3.5 h-3.5" /> ID: <code className="font-mono">{serviceId}</code></span>
        {svc.updatedAt && <span>Last saved: {relativeTime(svc.updatedAt)}</span>}
        <span>{ussdSteps.length} step{ussdSteps.length !== 1 ? "s" : ""} configured</span>
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
