import { cn } from "@/lib/utils";

type Status = "queued" | "processing" | "done" | "failed" | "cancelled" | "pending" | "active" | "suspended" | "approved" | "rejected" | "complete";

const MAP: Record<Status, { label: string; classes: string; dot?: boolean }> = {
  queued:     { label: "Queued",     classes: "bg-surface-container text-on-surface-variant" },
  processing: { label: "Processing", classes: "bg-blue-50 text-blue-700", dot: true },
  done:       { label: "Done",       classes: "bg-[#E8F1EE] text-primary" },
  complete:   { label: "Complete",   classes: "bg-[#E8F1EE] text-primary" },
  failed:     { label: "Failed",     classes: "bg-red-50 text-red-700" },
  cancelled:  { label: "Cancelled",  classes: "bg-orange-50 text-orange-700" },
  pending:    { label: "Pending",    classes: "bg-amber-50 text-amber-700" },
  active:     { label: "Active",     classes: "bg-[#E8F1EE] text-primary" },
  suspended:  { label: "Suspended",  classes: "bg-red-50 text-red-700" },
  approved:   { label: "Approved",   classes: "bg-[#E8F1EE] text-primary" },
  rejected:   { label: "Rejected",   classes: "bg-red-50 text-red-700" },
};

export function StatusBadge({ status }: { status: Status }) {
  const cfg = MAP[status] ?? { label: status, classes: "bg-surface-container text-on-surface-variant" };
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-manrope",
      cfg.classes
    )}>
      {cfg.dot && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse-dot" />}
      {cfg.label}
    </span>
  );
}
