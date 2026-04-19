import { cn } from "@/lib/utils";
import { DeviceStatus } from "@/types";

const MAP: Record<DeviceStatus, { color: string; animate: boolean; label: string }> = {
  online:  { color: "bg-green-500",   animate: true,  label: "Online" },
  busy:    { color: "bg-blue-500",    animate: true,  label: "Busy" },
  offline: { color: "bg-on-surface-variant", animate: false, label: "Offline" },
  revoked: { color: "bg-red-500",     animate: false, label: "Revoked" },
  paused:  { color: "bg-amber-400",   animate: false, label: "Paused" },
};

export function DeviceStatusDot({ status }: { status: DeviceStatus }) {
  const cfg = MAP[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("w-2 h-2 rounded-full", cfg.color, cfg.animate && "animate-pulse")} />
      <span className="text-xs text-gray-600">{cfg.label}</span>
    </span>
  );
}
