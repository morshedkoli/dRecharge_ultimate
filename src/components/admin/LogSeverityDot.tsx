import { cn } from "@/lib/utils";
import { LogSeverity } from "@/types";

const MAP: Record<LogSeverity, string> = {
  info:     "bg-blue-500",
  warn:     "bg-amber-500",
  error:    "bg-red-500",
  critical: "bg-red-600 ring-2 ring-red-200",
};

export function LogSeverityDot({ severity }: { severity: LogSeverity }) {
  return <span className={cn("inline-block w-2 h-2 rounded-full", MAP[severity])} title={severity} />;
}
