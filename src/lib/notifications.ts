/**
 * Notification helpers — called server-side from API routes.
 *
 * recipientUid = specific user UID        → user notification
 * recipientUid = "admin"                  → broadcast to all admins
 */
import connectDB from "@/lib/db/mongoose";
import Notification from "@/lib/db/models/Notification";

interface CreateNotificationInput {
  recipientUid: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await connectDB();
    await Notification.create({
      recipientUid: input.recipientUid,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    });
  } catch (err) {
    // Never let notification failures break the main request
    console.error("[notification] create failed:", err);
  }
}

// ─── Per-event helpers ────────────────────────────────────────────────────────

function fmt(n: number) {
  return `৳${n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function mask(num: string) {
  if (num.length <= 4) return num;
  return num.slice(0, -4).replace(/./g, "*") + num.slice(-4);
}

// ── Balance requests ──────────────────────────────────────────────────────────

export async function notifyBalanceRequestSubmitted(userId: string, requestId: string, amount: number) {
  await Promise.all([
    // User: confirmation
    createNotification({
      recipientUid: userId,
      type: "balance_request_submitted",
      title: "Balance request submitted",
      body: `Your ${fmt(amount)} top-up request is under review.`,
      link: "/user/dashboard",
    }),
    // Admin: action needed
    createNotification({
      recipientUid: "admin",
      type: "new_balance_request",
      title: "New balance request",
      body: `A user submitted a ${fmt(amount)} top-up request.`,
      link: "/admin/balance-requests",
    }),
  ]);
}

export async function notifyBalanceRequestApproved(userId: string, amount: number) {
  await createNotification({
    recipientUid: userId,
    type: "balance_request_approved",
    title: "Balance request approved!",
    body: `${fmt(amount)} has been added to your wallet.`,
    link: "/user/dashboard",
  });
}

export async function notifyBalanceRequestRejected(userId: string, amount: number, reason: string) {
  await createNotification({
    recipientUid: userId,
    type: "balance_request_rejected",
    title: "Balance request rejected",
    body: `Your ${fmt(amount)} request was rejected. Reason: ${reason}`,
    link: "/user/dashboard",
  });
}

// ── Transactions ──────────────────────────────────────────────────────────────

export async function notifyTransactionInitiated(userId: string, amount: number, recipientNumber: string) {
  await createNotification({
    recipientUid: userId,
    type: "tx_initiated",
    title: "Recharge started",
    body: `Recharging ${fmt(amount)} to ${mask(recipientNumber)} — processing now.`,
    link: "/user/history",
  });
}

export async function notifyTransactionCompleted(userId: string, amount: number, recipientNumber: string) {
  await createNotification({
    recipientUid: userId,
    type: "tx_completed",
    title: "Recharge successful!",
    body: `${fmt(amount)} recharge to ${mask(recipientNumber)} completed successfully.`,
    link: "/user/history",
  });
}

export async function notifyTransactionFailed(userId: string, amount: number, recipientNumber: string) {
  await createNotification({
    recipientUid: userId,
    type: "tx_failed",
    title: "Recharge failed",
    body: `${fmt(amount)} recharge to ${mask(recipientNumber)} failed. Amount has been refunded.`,
    link: "/user/history",
  });
}

export async function notifyTransactionCancelled(userId: string, amount: number) {
  await createNotification({
    recipientUid: userId,
    type: "tx_cancelled",
    title: "Request cancelled",
    body: `Your ${fmt(amount)} recharge request was cancelled by admin. Amount refunded.`,
    link: "/user/history",
  });
}

// ── Wallet ────────────────────────────────────────────────────────────────────

export async function notifyWalletCredited(userId: string, amount: number, note?: string) {
  await createNotification({
    recipientUid: userId,
    type: "wallet_credited",
    title: "Wallet credited",
    body: note
      ? `Admin added ${fmt(amount)} to your wallet. Note: ${note}`
      : `Admin added ${fmt(amount)} to your wallet.`,
    link: "/user/dashboard",
  });
}

export async function notifyWalletDebited(userId: string, amount: number, note?: string) {
  await createNotification({
    recipientUid: userId,
    type: "wallet_debited",
    title: "Wallet adjustment",
    body: note
      ? `Admin deducted ${fmt(amount)} from your wallet. Note: ${note}`
      : `Admin deducted ${fmt(amount)} from your wallet.`,
    link: "/user/dashboard",
  });
}

// ── Account ───────────────────────────────────────────────────────────────────

export async function notifyAccountSuspended(userId: string) {
  await createNotification({
    recipientUid: userId,
    type: "account_suspended",
    title: "Account suspended",
    body: "Your account has been suspended. Please contact support for assistance.",
    link: "/user/dashboard",
  });
}

export async function notifyAccountActivated(userId: string) {
  await createNotification({
    recipientUid: userId,
    type: "account_activated",
    title: "Account reactivated",
    body: "Your account has been reactivated. Welcome back!",
    link: "/user/dashboard",
  });
}

export async function notifyRoleChanged(userId: string, newRole: string) {
  await createNotification({
    recipientUid: userId,
    type: "role_changed",
    title: "Role updated",
    body: `Your account role has been updated to ${newRole}.`,
    link: "/user/dashboard",
  });
}

// ── Devices ───────────────────────────────────────────────────────────────────

export async function notifyDeviceRegistered(deviceName: string) {
  await createNotification({
    recipientUid: "admin",
    type: "device_registered",
    title: "Device registered",
    body: `New agent device "${deviceName}" has been registered and is online.`,
    link: "/admin/devices",
  });
}

export async function notifyDeviceRevoked(deviceName: string) {
  await createNotification({
    recipientUid: "admin",
    type: "device_revoked",
    title: "Device revoked",
    body: `Agent device "${deviceName}" has been revoked.`,
    link: "/admin/devices",
  });
}
