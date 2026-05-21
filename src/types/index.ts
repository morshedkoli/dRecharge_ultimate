// ─── User ───────────────────────────────────────────────────────────────────
export type UserRole = "user" | "admin" | "super_admin" | "support_admin" | "agent";
export type UserStatus = "active" | "suspended";

export interface AppUser {
  uid: string;
  username: string;
  email?: string;
  displayName: string;
  role: UserRole;
  walletBalance: number;
  creditLimit: number;
  walletLocked: boolean;
  status: UserStatus;
  createdAt: Date | string;
  lastLoginAt: Date | string;
  phoneNumber?: string;
  hasPin?: boolean;
  parentId?: string;
  canManuallyCompleteJobs?: boolean;
}

// ─── Transaction ─────────────────────────────────────────────────────────────
export type TxType = "send" | "topup" | "deduct" | "refund" | "credit";
export type TxStatus = "pending" | "processing" | "waiting" | "complete" | "failed" | "cancelled";

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
  failureReason?: string;   // user-facing failure reason from matched SMS template
  // Captured from the final USSD result dialog on success
  providerTxId?: string;       // operator-side transaction reference
  providerBalance?: string;    // remaining agent balance reported by provider
  providerAmount?: string;     // amount as reported in provider response
  providerRecipient?: string;  // recipient (often masked) as reported in provider response
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
export type JobStatus = "queued" | "processing" | "waiting" | "done" | "failed" | "cancelled";

export interface ExecutionJob {
  jobId: string;
  txId: string;
  userId: string;
  serviceId: string;
  serviceName?: string;
  serviceIcon?: string;
  recipientNumber: string;
  amount: number;
  ussdSteps?: UssdStep[];      // structured steps with placeholders resolved
  successSmsFormat?: string;
  failureSmsTemplates?: SmsFailureTemplate[];
  status: JobStatus;
  locked: boolean;
  lockedAt?: Date | string;
  lockedByDevice?: string;
  attempt: number;
  rawSms?: string;            // matched SMS body
  ussdResponse?: string;      // verbatim USSD dialog text from the device
  smsSenderNumber?: string;
  smsReceivedAt?: Date | string;
  parsedResult?: {
    success: boolean;
    txRef?: string;
    amount?: number;
    smsAmount?: string;
    smsRecipient?: string;
    balance?: string;
    matchSource?: "ussd" | "sms";
    reason?: string;
  };
  ussdStepsExecuted?: UssdStepResult[];
  executionLogs?: ExecutionLog[];
  simSlot?: number;
  smsTimeout?: number;
  createdAt: Date | string;
  completedAt?: Date | string;
  // Joined onto the job by the admin detail endpoint — captured from the
  // final USSD result dialog and persisted on the linked Transaction.
  providerTxId?: string;
  providerAmount?: string;
  providerRecipient?: string;
  providerBalance?: string;
  txFailureReason?: string;
}

// ─── USSD Step (structured flow) ─────────────────────────────────────────────
export type UssdStepType = "dial" | "select" | "input" | "wait";

export interface UssdStep {
  order: number;       // 1-indexed execution order
  type: UssdStepType;
  label: string;       // human-friendly label shown in admin
  value: string;       // value/text; may include {recipientNumber}, {amount}, {pin}
  waitMs?: number;     // only for "wait" steps — milliseconds to pause
}

// ─── SMS Failure Template ──────────────────────────────────────────────────────
export interface SmsFailureTemplate {
  template: string;    // SMS pattern to match (same placeholder syntax as success)
  message: string;     // user-facing failure reason shown in notification + history
}

export interface UssdStepResult {
  order: number;
  type: "dial" | "select" | "input" | "wait" | "response";
  value: string;
  executedAt: Date | string;
  success: boolean;
}

// ─── Execution Log (per-attempt history) ─────────────────────────────────────
export interface ExecutionLog {
  attempt: number;
  ussdResponse: string;        // raw USSD dialog text from device
  smsBody?: string;            // raw SMS body received (if any)
  outcome: string;             // "done" | "failed" | "waiting" | "queued"
  failureReason?: string;
  deviceId?: string;
  responseSource?: "ussd" | "sms";
  senderNumber?: string;
  smsReceivedAt?: Date | string;
  stepsExecuted?: UssdStepResult[];
  executedAt: Date | string;
}

// ─── Service Category ────────────────────────────────────────────────────────
export interface ServiceCategory {
  id: string;
  name: string;
  logo: string;
  order?: number;
  createdAt: Date | string;
}

// ─── Service Provider ────────────────────────────────────────────────────────
export interface ServiceProvider {
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
  providerId?: string;
  ussdSteps: UssdStep[];               // structured step array (source of truth)
  pin: string;
  simSlot: number;
  recipientLength?: number;
  successSmsFormat: string;
  failureSmsTemplates: SmsFailureTemplate[]; // multi-failure templates (source of truth)
  smsTimeout: number;
  updatedAt: Date | string;
  updatedBy: string;
}

// ─── Agent Device ─────────────────────────────────────────────────────────────
export type DeviceStatus = "online" | "offline" | "busy" | "revoked" | "paused";

export interface AgentDevice {
  deviceId: string;
  name: string;
  status: DeviceStatus;
  simProvider: string;
  lastHeartbeat: Date | string;
  currentJob?: string;
  isPoweredOn: boolean;
  batteryLevel?: number | null;
  isCharging?: boolean | null;
  authUid: string;
  assignedServices: string[];
  registeredAt: Date | string;
}

// ─── Device Info ──────────────────────────────────────────────────────────────
export interface DeviceInfoData {
  deviceId: string;
  deviceName: string;
  model: string;
  brand: string;
  manufacturer: string;
  androidVersion: string;
  sdkInt: number;
  ramTotalMb: number;
  ramAvailableMb: number;
  storageTotalMb: number;
  storageAvailableMb: number;
  batteryLevel: number;
  isCharging: boolean;
  networkType: string;
  ipAddress: string;
  simCarrier: string;
  syncedAt: Date | string;
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
