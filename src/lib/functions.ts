import { UserRole, UssdStep, SmsFailureTemplate, DeviceInfoData } from "@/types";

// ─── Helper ───────────────────────────────────────────────────────────────────
export async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
  return payload as T;
}

// ─── User Management ──────────────────────────────────────────────────────────
export const suspendUser = (uid: string) =>
  apiFetch(`/api/admin/users/${uid}`, { method: "PATCH", body: JSON.stringify({ action: "suspend" }) });

export const activateUser = (uid: string) =>
  apiFetch(`/api/admin/users/${uid}`, { method: "PATCH", body: JSON.stringify({ action: "activate" }) });

export const setUserRole = (uid: string, role: UserRole) =>
  apiFetch(`/api/admin/users/${uid}`, { method: "PATCH", body: JSON.stringify({ action: "setRole", role }) });

export const adminAddBalance = (uid: string, amount: number, note?: string) =>
  apiFetch(`/api/admin/users/${uid}`, { method: "PATCH", body: JSON.stringify({ action: "addBalance", amount, note }) });

export const adminSetCreditLimit = (uid: string, limit: number) =>
  apiFetch(`/api/admin/users/${uid}`, { method: "PATCH", body: JSON.stringify({ action: "setCreditLimit", limit }) });

export const adminChangeName = (uid: string, displayName: string) =>
  apiFetch<{ success: boolean; displayName: string }>(`/api/admin/users/${uid}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "changeName", displayName }),
  });

export const adminChangeUsername = (uid: string, username: string) =>
  apiFetch<{ success: boolean; username: string }>(`/api/admin/users/${uid}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "adminChangeUsername", username }),
  });

export const adminChangeEmail = (uid: string, email: string) =>
  apiFetch<{ success: boolean; email: string }>(`/api/admin/users/${uid}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "changeEmail", email }),
  });

export const adminChangePassword = (uid: string, newPassword: string) =>
  apiFetch(`/api/admin/users/${uid}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "adminChangePassword", newPassword }),
  });

export const adminChangePin = (uid: string, pin: string) =>
  apiFetch(`/api/admin/users/${uid}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "adminChangePin", pin }),
  });

export async function createUserAccount(data: {
  username: string;
  email?: string;
  password: string;
  pin: string;
  displayName: string;
  phoneNumber?: string;
}): Promise<{ success: boolean; uid: string }> {
  return apiFetch("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ─── Balance Requests ─────────────────────────────────────────────────────────
export const submitBalanceRequest = (amount: number, medium?: string, note?: string) =>
  apiFetch("/api/admin/balance-requests", {
    method: "POST",
    body: JSON.stringify({ amount, medium, note }),
  });

export const approveBalanceRequest = (reqId: string, adminNote?: string) =>
  apiFetch(`/api/admin/balance-requests/${reqId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "approve", adminNote }),
  });

export const rejectBalanceRequest = (reqId: string, adminNote: string) =>
  apiFetch(`/api/admin/balance-requests/${reqId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "reject", adminNote }),
  });

// ─── Transactions ─────────────────────────────────────────────────────────────
export const initiateTransaction = (data: {
  serviceId: string;
  recipientNumber: string;
  amount: number;
}) =>
  apiFetch<{ success: boolean; txId: string; jobId: string }>("/api/admin/transactions", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const failTransaction = (txId: string, jobId: string, reason: string) =>
  apiFetch("/api/admin/history", {
    method: "PATCH",
    body: JSON.stringify({ jobId, txId, reason }),
  });

export const simulateJobResult = (jobId: string, txId: string, isSuccess: boolean) =>
  apiFetch(`/api/admin/history/${jobId}`, {
    method: "PATCH",
    body: JSON.stringify({ txId, isSuccess }),
  });

export const cancelJob = (jobId: string, reason?: string) =>
  apiFetch(`/api/admin/history/${jobId}`, {
    method: "DELETE",
    body: JSON.stringify({ reason: reason || "Admin cancelled" }),
  });

// ─── Services ─────────────────────────────────────────────────────────────────
export const createService = (data: {
  name: string;
  icon?: string;
  description?: string;
  isActive?: boolean;
  categoryId?: string;
  ussdSteps?: UssdStep[];
  pin: string;
  simSlot: number;
  recipientLength?: number;
  successSmsFormat: string;
  failureSmsTemplates?: SmsFailureTemplate[];
  smsTimeout: number;
}) =>
  apiFetch<{ success: boolean; serviceId: string }>("/api/admin/services", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const saveService = (data: {
  serviceId: string;
  name: string;
  icon?: string;
  description?: string;
  isActive?: boolean;
  categoryId?: string;
  ussdSteps?: UssdStep[];
  pin: string;
  simSlot: number;
  recipientLength?: number;
  successSmsFormat: string;
  failureSmsTemplates?: SmsFailureTemplate[];
  smsTimeout: number;
}) =>
  apiFetch(`/api/admin/services/${data.serviceId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteService = (serviceId: string) =>
  apiFetch(`/api/admin/services/${serviceId}`, { method: "DELETE" });

// ─── Service Categories ───────────────────────────────────────────────────────
export async function createCategory(data: { name: string; logo: string }) {
  return apiFetch<{ success: boolean; categoryId: string }>("/api/admin/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCategory(data: { categoryId: string; name: string; logo: string }) {
  return apiFetch(`/api/admin/categories/${data.categoryId}`, {
    method: "PATCH",
    body: JSON.stringify({ name: data.name, logo: data.logo }),
  });
}

export async function deleteCategory(categoryId: string) {
  return apiFetch(`/api/admin/categories/${categoryId}`, { method: "DELETE" });
}

// ─── Device Management ─────────────────────────────────────────────────────────
export const generateDeviceToken = () =>
  apiFetch<{ success: boolean; token: string; expiresAt: number }>("/api/admin/devices/token", { method: "POST" });

export async function revokeDevice(deviceId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/admin/devices/${deviceId}/revoke`, { method: "POST" });
}

export async function toggleDevicePower(
  deviceId: string,
  isPoweredOn: boolean
): Promise<{ success: boolean; isPoweredOn: boolean }> {
  return apiFetch(`/api/admin/devices/${deviceId}/power`, {
    method: "POST",
    body: JSON.stringify({ isPoweredOn }),
  });
}

export const getDeviceInfo = (deviceId: string) =>
  apiFetch<{ info: DeviceInfoData | null }>(`/api/admin/devices/${deviceId}/info`);

export const updateDeviceServices = (deviceId: string, serviceIds: string[]) =>
  apiFetch<{ success: boolean; assignedServices: string[] }>(
    `/api/admin/devices/${deviceId}/services`,
    { method: "PATCH", body: JSON.stringify({ serviceIds }) }
  );
