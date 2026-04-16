// ─── User ───────────────────────────────────────────────────────────────────
export type UserRole = "user" | "admin" | "super_admin" | "support_admin" | "agent";
export type UserStatus = "active" | "suspended";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  walletBalance: number;
  walletLocked: boolean;
  status: UserStatus;
  createdAt: Date | string;
  lastLoginAt: Date | string;
  phoneNumber?: string;
  pin?: string;
}

// ─── Transaction ─────────────────────────────────────────────────────────────
export type TxType = "send" | "topup" | "deduct" | "refund";
export type TxStatus = "pending" | "processing" | "complete" | "failed";

export interface Transaction {
  id: string;
  userId: string;
  type: TxType;
  serviceId?: string;
  recipientNumber?: string;
  amount: number;
  fee: number;
  status: TxStatus;
  note?: string;
  adminId?: string;
  createdAt: Date | string;
  completedAt?: Date | string;
}

// ─── Balance Request ──────────────────────────────────────────────────────────
export type RequestStatus = "pending" | "approved" | "rejected";

export interface BalanceRequest {
  id: string;
  userId: string;
  amount: number;
  status: RequestStatus;
  medium?: string;
  note?: string;
  adminNote?: string;
  approvedBy?: string;
  createdAt: Date | string;
  processedAt?: Date | string;
}

// ─── Execution Queue ──────────────────────────────────────────────────────────
export type JobStatus = "queued" | "processing" | "done" | "failed";

export interface ExecutionJob {
  jobId: string;
  txId: string;
  userId: string;
  serviceId: string;
  recipientNumber: string;
  amount: number;
  status: JobStatus;
  locked: boolean;
  lockedAt?: Date | string;
  lockedByDevice?: string;
  attempt: number;
  rawSms?: string;
  parsedResult?: {
    success: boolean;
    txRef?: string;
    amount?: number;
    reason?: string;
  };
  ussdStepsExecuted?: UssdStepResult[];
  createdAt: Date | string;
  completedAt?: Date | string;
}

export interface UssdStepResult {
  order: number;
  type: "dial" | "select" | "input";
  value: string;
  executedAt: Date | string;
  success: boolean;
}

// ─── Service Category ────────────────────────────────────────────────────────
export interface ServiceCategory {
  id: string;
  name: string;
  logo: string;
  order?: number;
  createdAt: Date | string;
}

// ─── Service ─────────────────────────────────────────────────────────────────
export interface Service {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  isActive: boolean;
  categoryId?: string;
  ussdFlow: string;
  pin: string;
  simSlot: number;
  successSmsFormat: string;
  failureSmsFormat: string;
  smsTimeout: number;
  updatedAt: Date | string;
  updatedBy: string;
}

// ─── Agent Device ─────────────────────────────────────────────────────────────
export type DeviceStatus = "online" | "offline" | "busy" | "revoked";

export interface AgentDevice {
  deviceId: string;
  name: string;
  status: DeviceStatus;
  simProvider: string;
  lastHeartbeat: Date | string;
  currentJob?: string;
  authUid: string;
  registeredAt: Date | string;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
export type LogSeverity = "info" | "warn" | "error" | "critical";

export interface AuditLog {
  id: string;
  uid?: string;
  action: string;
  entityId?: string;
  ip: string;
  location: {
    city: string;
    region: string;
    country: string;
    countryCode?: string;
  };
  userAgent: string;
  deviceType: "mobile" | "desktop" | "tablet" | "server";
  browser: string;
  os: string;
  severity: LogSeverity;
  meta: Record<string, unknown>;
  timestamp: Date | string;
}
