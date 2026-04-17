import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function maskNumber(number: string): string {
  if (number.length <= 4) return number;
  return "****" + number.slice(-4);
}

export function relativeTime(timestamp: Date | string | number | null | undefined): string {
  if (!timestamp) return "—";
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return "—";
  }
}

export function fullDateTime(timestamp: Date | string | number | null | undefined): string {
  if (!timestamp) return "—";
  try {
    return format(new Date(timestamp), "dd MMM yyyy, HH:mm:ss");
  } catch {
    return "—";
  }
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function isDeviceOnline(lastHeartbeat: Date | string | number | undefined): boolean {
  if (!lastHeartbeat) return false;
  const diff = Date.now() - new Date(lastHeartbeat).getTime();
  return diff < 60 * 1000; // 60 seconds
}

export function computeDeviceStatus(device: {
  status?: string;
  lastHeartbeat?: Date | string | number;
  currentJob?: string;
}): "online" | "busy" | "offline" | "revoked" {
  // Always preserve the DB-authoritative revoked status
  if (device.status === "revoked") return "revoked";
  if (!isDeviceOnline(device.lastHeartbeat)) return "offline";
  return device.currentJob ? "busy" : "online";
}
