"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserCreated = exports.revokeDevice = exports.deviceHeartbeat = exports.registerAgentDevice = exports.generateDeviceToken = exports.saveUssdTemplate = exports.deleteService = exports.saveService = exports.createService = exports.cleanStaleLocks = exports.reportJobResult = exports.acquireJobLock = exports.failTransaction = exports.initiateTransaction = exports.rejectBalanceRequest = exports.approveBalanceRequest = exports.submitBalanceRequest = exports.adminAddBalance = exports.createUserAccount = exports.setUserRole = exports.activateUser = exports.suspendUser = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const crypto_1 = require("crypto");
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
const REGISTRATION_TOKEN_TTL_MS = 10 * 60 * 1000;
function buildRegistrationToken() {
    return `DRA-${(0, crypto_1.randomBytes)(18).toString("hex").toUpperCase()}`;
}
function hashRegistrationToken(token) {
    return (0, crypto_1.createHash)("sha256").update(token).digest("hex");
}
function buildAgentEmail(deviceId) {
    return `agent.${deviceId}@drecharge.local`;
}
function buildAgentPassword() {
    return `${(0, crypto_1.randomBytes)(18).toString("base64url")}Aa1!`;
}
// ─── Helper: verify caller is admin ──────────────────────────────────────────
async function assertAdmin(context) {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Not authenticated");
    const token = context.auth.token;
    if (!["admin", "super_admin", "support_admin"].includes(token.role))
        throw new functions.https.HttpsError("permission-denied", "Admin only");
}
// ─── Helper: write audit log ──────────────────────────────────────────────────
async function writeLog(data) {
    await db.collection("auditLogs").add(Object.assign(Object.assign({}, data), { severity: data.severity || "info", meta: data.meta || {}, ip: data.ip || "server", location: data.location || {}, userAgent: data.userAgent || "server", deviceType: data.deviceType || "server", browser: data.browser || "server", os: data.os || "server", timestamp: admin.firestore.FieldValue.serverTimestamp() }));
}
// ═══════════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════
exports.suspendUser = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);
    const { uid } = data;
    if (!uid)
        throw new functions.https.HttpsError("invalid-argument", "uid required");
    await db.doc(`users/${uid}`).update({ status: "suspended" });
    await auth.updateUser(uid, { disabled: true });
    await writeLog({ uid: context.auth.uid, action: "USER_SUSPENDED", entityId: uid, severity: "warn", meta: { targetUid: uid } });
    return { success: true };
});
exports.activateUser = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);
    const { uid } = data;
    await db.doc(`users/${uid}`).update({ status: "active" });
    await auth.updateUser(uid, { disabled: false });
    await writeLog({ uid: context.auth.uid, action: "USER_ACTIVATED", entityId: uid, meta: { targetUid: uid } });
    return { success: true };
});
exports.setUserRole = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);
    const { uid, role } = data;
    if (!["user", "admin", "super_admin", "support_admin"].includes(role))
        throw new functions.https.HttpsError("invalid-argument", "Invalid role");
    await auth.setCustomUserClaims(uid, { role });
    await db.doc(`users/${uid}`).update({ role });
    await writeLog({ uid: context.auth.uid, action: "ROLE_CHANGED", entityId: uid, severity: "warn", meta: { targetUid: uid, newRole: role } });
    return { success: true };
});
exports.createUserAccount = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);
    const email = String((data === null || data === void 0 ? void 0 : data.email) || "").trim().toLowerCase();
    const password = String((data === null || data === void 0 ? void 0 : data.password) || "");
    const displayName = String((data === null || data === void 0 ? void 0 : data.displayName) || "").trim();
    const phoneNumber = String((data === null || data === void 0 ? void 0 : data.phoneNumber) || "").trim();
    if (!email || !password || !displayName) {
        throw new functions.https.HttpsError("invalid-argument", "email, password, and displayName are required");
    }
    if (password.length < 6) {
        throw new functions.https.HttpsError("invalid-argument", "Password must be at least 6 characters");
    }
    const userRecord = await auth.createUser(Object.assign({ email,
        password,
        displayName }, (phoneNumber ? { phoneNumber } : {})));
    await auth.setCustomUserClaims(userRecord.uid, { role: "user" });
    await db.doc(`users/${userRecord.uid}`).set({
        uid: userRecord.uid,
        email,
        displayName,
        role: "user",
        walletBalance: 0,
        walletLocked: false,
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
        phoneNumber: phoneNumber || null,
    }, { merge: true });
    await writeLog({
        uid: context.auth.uid,
        action: "USER_CREATED",
        entityId: userRecord.uid,
        meta: { targetUid: userRecord.uid, email, role: "user" },
    });
    return { success: true, uid: userRecord.uid };
});
exports.adminAddBalance = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);
    const { uid, amount, note } = data;
    if (!uid || !amount || amount <= 0)
        throw new functions.https.HttpsError("invalid-argument", "uid and positive amount required");
    await db.runTransaction(async (tx) => {
        const userRef = db.doc(`users/${uid}`);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists)
            throw new functions.https.HttpsError("not-found", "User not found");
        const currentBalance = userSnap.data().walletBalance || 0;
        tx.update(userRef, { walletBalance: currentBalance + amount });
    });
    await writeLog({ uid: context.auth.uid, action: "ADMIN_TOPUP", entityId: uid, meta: { targetUid: uid, amount, note } });
    return { success: true };
});
// ═══════════════════════════════════════════════════════════════════════════════
// BALANCE REQUESTS
// ═══════════════════════════════════════════════════════════════════════════════
exports.submitBalanceRequest = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Not authenticated");
    const { amount, medium, note } = data;
    if (!amount || amount <= 0)
        throw new functions.https.HttpsError("invalid-argument", "Positive amount required");
    const reqRef = db.collection("balanceRequests").doc();
    await reqRef.set({
        id: reqRef.id,
        userId: context.auth.uid,
        amount: amount,
        medium: medium || "",
        note: note || "",
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await writeLog({ uid: context.auth.uid, action: "BALANCE_REQUEST_CREATED", entityId: reqRef.id, meta: { amount, medium, note } });
    return { success: true, requestId: reqRef.id };
});
exports.approveBalanceRequest = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);
    const { reqId, adminNote } = data;
    await db.runTransaction(async (tx) => {
        var _a;
        const reqRef = db.doc(`balanceRequests/${reqId}`);
        const reqSnap = await tx.get(reqRef);
        if (!reqSnap.exists)
            throw new Error("Request not found");
        const req = reqSnap.data();
        if (req.status !== "pending")
            throw new Error("Request already processed");
        const userRef = db.doc(`users/${req.userId}`);
        const userSnap = await tx.get(userRef);
        const currentBalance = ((_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.walletBalance) || 0;
        tx.update(userRef, { walletBalance: currentBalance + req.amount });
        tx.update(reqRef, {
            status: "approved", adminNote: adminNote || "", approvedBy: context.auth.uid,
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    await writeLog({ uid: context.auth.uid, action: "BALANCE_REQUEST_APPROVED", entityId: reqId });
    return { success: true };
});
exports.rejectBalanceRequest = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);
    const { reqId, adminNote } = data;
    if (!adminNote || adminNote.trim().length < 5)
        throw new functions.https.HttpsError("invalid-argument", "adminNote required");
    await db.doc(`balanceRequests/${reqId}`).update({
        status: "rejected", adminNote, approvedBy: context.auth.uid,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await writeLog({ uid: context.auth.uid, action: "BALANCE_REQUEST_REJECTED", entityId: reqId, meta: { adminNote } });
    return { success: true };
});
// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS / QUEUE
// ═══════════════════════════════════════════════════════════════════════════════
exports.initiateTransaction = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Not authenticated");
    const { serviceId, recipientNumber, amount } = data;
    if (!serviceId || !recipientNumber || !amount || amount <= 0) {
        throw new functions.https.HttpsError("invalid-argument", "serviceId, recipientNumber, amount required");
    }
    const uid = context.auth.uid;
    // Validate service exists and is active
    const serviceSnap = await db.doc(`services/${serviceId}`).get();
    if (!serviceSnap.exists)
        throw new functions.https.HttpsError("not-found", "Service not found");
    const service = serviceSnap.data();
    if (!service.isActive)
        throw new functions.https.HttpsError("failed-precondition", "This service is currently inactive");
    let txId;
    let jobId;
    await db.runTransaction(async (tx) => {
        const userRef = db.doc(`users/${uid}`);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists)
            throw new functions.https.HttpsError("not-found", "User not found");
        const user = userSnap.data();
        if (user.walletLocked)
            throw new functions.https.HttpsError("failed-precondition", "Wallet is currently locked by another transaction");
        if (user.walletBalance < amount)
            throw new functions.https.HttpsError("failed-precondition", "Insufficient balance");
        // Create transaction doc
        const txRef = db.collection("transactions").doc();
        txId = txRef.id;
        tx.set(txRef, {
            userId: uid, type: "send", serviceId, recipientNumber, amount, fee: 0,
            status: "pending", createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Create queue job (includes serviceId so agent can look up the right template)
        const jobRef = db.collection("executionQueue").doc();
        jobId = jobRef.id;
        tx.set(jobRef, {
            txId, userId: uid, serviceId, recipientNumber, amount,
            status: "queued", locked: false, attempt: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Deduct balance and lock wallet
        tx.update(userRef, {
            walletBalance: user.walletBalance - amount,
            walletLocked: true,
        });
    });
    await writeLog({ uid, action: "TX_INITIATED", entityId: txId, meta: { serviceId, amount } });
    return { success: true, txId: txId, jobId: jobId };
});
exports.failTransaction = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);
    const { txId, jobId, reason } = data;
    await db.runTransaction(async (tx) => {
        var _a;
        const txRef = db.doc(`transactions/${txId}`);
        const txSnap = await tx.get(txRef);
        if (!txSnap.exists)
            throw new Error("Transaction not found");
        const txData = txSnap.data();
        const userRef = db.doc(`users/${txData.userId}`);
        const userSnap = await tx.get(userRef);
        const currentBalance = ((_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.walletBalance) || 0;
        tx.update(txRef, { status: "failed", completedAt: admin.firestore.FieldValue.serverTimestamp() });
        tx.update(userRef, { walletBalance: currentBalance + txData.amount, walletLocked: false });
        if (jobId) {
            tx.update(db.doc(`executionQueue/${jobId}`), {
                status: "failed", locked: false, completedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    });
    await writeLog({ uid: context.auth.uid, action: "TX_FAILED", entityId: txId, severity: "warn", meta: { reason } });
    return { success: true };
});
// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE EXECUTION (called by Android agent)
// ═══════════════════════════════════════════════════════════════════════════════
exports.acquireJobLock = functions.https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.role !== "agent") {
        throw new functions.https.HttpsError("permission-denied", "Agent only");
    }
    const { jobId, deviceId } = data;
    let acquired = false;
    await db.runTransaction(async (tx) => {
        const jobRef = db.doc(`executionQueue/${jobId}`);
        const deviceRef = db.doc(`agentDevices/${deviceId}`);
        const jobSnap = await tx.get(jobRef);
        const deviceSnap = await tx.get(deviceRef);
        if (!jobSnap.exists)
            throw new Error("Job not found");
        if (!deviceSnap.exists)
            throw new functions.https.HttpsError("not-found", "Device not found");
        const deviceData = deviceSnap.data();
        if (deviceData.authUid !== context.auth.uid) {
            throw new functions.https.HttpsError("permission-denied", "Device ownership mismatch");
        }
        const job = jobSnap.data();
        if (job.locked || job.status !== "queued") {
            acquired = false;
            return;
        }
        tx.update(jobRef, {
            locked: true, lockedAt: admin.firestore.FieldValue.serverTimestamp(),
            lockedByDevice: deviceId, status: "processing",
        });
        tx.update(deviceRef, {
            currentJob: jobId,
            lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
            status: "busy",
        });
        acquired = true;
    });
    return { acquired };
});
exports.reportJobResult = functions.https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.role !== "agent") {
        throw new functions.https.HttpsError("permission-denied", "Agent only");
    }
    const { jobId, txId, rawSms, parsedResult, ussdStepsExecuted, deviceId } = data;
    let isSuccess = (parsedResult === null || parsedResult === void 0 ? void 0 : parsedResult.success) === true;
    let finalParsedResult = parsedResult || { success: isSuccess };
    await db.runTransaction(async (tx) => {
        var _a, _b, _c;
        const jobRef = db.doc(`executionQueue/${jobId}`);
        const txRef = db.doc(`transactions/${txId}`);
        const jobSnap = await tx.get(jobRef);
        const txSnap = await tx.get(txRef);
        if (!jobSnap.exists || !txSnap.exists)
            throw new Error("Job or transaction not found");
        const jobData = jobSnap.data();
        const txData = txSnap.data();
        const resolvedDeviceId = deviceId || jobData.lockedByDevice;
        if (resolvedDeviceId) {
            const deviceRef = db.doc(`agentDevices/${resolvedDeviceId}`);
            const deviceSnap = await tx.get(deviceRef);
            if (deviceSnap.exists && ((_a = deviceSnap.data()) === null || _a === void 0 ? void 0 : _a.authUid) !== context.auth.uid) {
                throw new functions.https.HttpsError("permission-denied", "Device ownership mismatch");
            }
        }
        isSuccess = (parsedResult === null || parsedResult === void 0 ? void 0 : parsedResult.success) === true;
        finalParsedResult = parsedResult || { success: isSuccess };
        if (rawSms && jobData.serviceId) {
            const svcSnap = await tx.get(db.doc(`services/${jobData.serviceId}`));
            if (svcSnap.exists) {
                const svc = svcSnap.data();
                const buildRegex = (format) => {
                    if (!format)
                        return null;
                    let escaped = format.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // Escape regex chars
                    escaped = escaped.replace(/ /g, "\\s+"); // Flexible whitespace
                    escaped = escaped
                        .replace(/\\\{recipientNumber\\\}/g, jobData.recipientNumber || "")
                        .replace(/\\\{amount\\\}/g, `(?:${jobData.amount}\\.?0*|${jobData.amount})`)
                        .replace(/\\\{trxId\\\}/g, "(?<trxId>\\w+)")
                        .replace(/\\\{balance\\\}/g, "(?<balance>[0-9,.]+)");
                    return new RegExp(escaped, "i");
                };
                const sRegex = buildRegex(svc.successSmsFormat);
                const fRegex = buildRegex(svc.failureSmsFormat);
                if (sRegex) {
                    const m = rawSms.match(sRegex);
                    if (m) {
                        isSuccess = true;
                        finalParsedResult.success = true;
                        if ((_b = m.groups) === null || _b === void 0 ? void 0 : _b.trxId)
                            finalParsedResult.txRef = m.groups.trxId;
                    }
                    else if (fRegex && fRegex.test(rawSms)) {
                        isSuccess = false;
                        finalParsedResult.success = false;
                        finalParsedResult.reason = "Matched failure format";
                    }
                    else {
                        isSuccess = false;
                        finalParsedResult.success = false;
                        finalParsedResult.reason = "Unrecognized SMS format";
                    }
                }
            }
        }
        const newJobStatus = isSuccess ? "done" : "failed";
        const newTxStatus = isSuccess ? "complete" : "failed";
        tx.update(jobRef, {
            status: newJobStatus, locked: false, rawSms, parsedResult: finalParsedResult,
            ussdStepsExecuted: ussdStepsExecuted || [],
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.update(txRef, { status: newTxStatus, completedAt: admin.firestore.FieldValue.serverTimestamp() });
        if (resolvedDeviceId) {
            tx.update(db.doc(`agentDevices/${resolvedDeviceId}`), {
                currentJob: admin.firestore.FieldValue.delete(),
                lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
                status: "online",
            });
        }
        // Refund on failure
        if (!isSuccess) {
            const userRef = db.doc(`users/${txData.userId}`);
            const userSnap = await tx.get(userRef);
            const currentBalance = ((_c = userSnap.data()) === null || _c === void 0 ? void 0 : _c.walletBalance) || 0;
            tx.update(userRef, { walletBalance: currentBalance + txData.amount, walletLocked: false });
        }
        else {
            tx.update(db.doc(`users/${txData.userId}`), { walletLocked: false });
        }
    });
    const action = isSuccess ? "TX_COMPLETED" : "TX_FAILED";
    await writeLog({ action, entityId: txId, severity: isSuccess ? "info" : "warn", meta: { jobId, parsedResult: finalParsedResult } });
    return { success: true };
});
exports.cleanStaleLocks = functions.pubsub.schedule("every 5 minutes").onRun(async () => {
    const cutoff = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago
    const stale = await db.collection("executionQueue")
        .where("locked", "==", true)
        .where("status", "==", "processing")
        .where("lockedAt", "<", cutoff)
        .get();
    for (const doc of stale.docs) {
        const job = doc.data();
        const newAttempt = (job.attempt || 0) + 1;
        if (newAttempt >= 2) {
            // Max retries exceeded — fail and refund
            await db.runTransaction(async (tx) => {
                var _a;
                const txRef = db.doc(`transactions/${job.txId}`);
                const txSnap = await tx.get(txRef);
                const txData = txSnap.data();
                if (txData) {
                    const userRef = db.doc(`users/${txData.userId}`);
                    const userSnap = await tx.get(userRef);
                    const currentBalance = ((_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.walletBalance) || 0;
                    tx.update(userRef, { walletBalance: currentBalance + txData.amount, walletLocked: false });
                    tx.update(txRef, { status: "failed" });
                }
                tx.update(doc.ref, { status: "failed", locked: false, attempt: newAttempt });
                if (job.lockedByDevice) {
                    tx.update(db.doc(`agentDevices/${job.lockedByDevice}`), {
                        currentJob: admin.firestore.FieldValue.delete(),
                        status: "online",
                    });
                }
            });
            await writeLog({ action: "JOB_MAX_RETRY_EXCEEDED", entityId: doc.id, severity: "error", meta: { jobId: doc.id } });
        }
        else {
            await doc.ref.update({ locked: false, status: "queued", attempt: newAttempt, lockedAt: null, lockedByDevice: null });
            if (job.lockedByDevice) {
                await db.doc(`agentDevices/${job.lockedByDevice}`).update({
                    currentJob: admin.firestore.FieldValue.delete(),
                    status: "online",
                }).catch(() => undefined);
            }
            await writeLog({ action: "JOB_STALE_LOCK_RELEASED", entityId: doc.id, severity: "warn", meta: { jobId: doc.id, attempt: newAttempt } });
        }
    }
});
// ═══════════════════════════════════════════════════════════════════════════════
// SERVICES (replaces per-provider USSD templates)
// ═══════════════════════════════════════════════════════════════════════════════
exports.createService = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);
    const { name, icon, description, isActive, categoryId, ussdFlow, pin, simSlot, successSmsFormat, failureSmsFormat, smsTimeout } = data;
    if (!name) {
        throw new functions.https.HttpsError("invalid-argument", "name required");
    }
    const ref = db.collection("services").doc();
    await ref.set({
        name, icon: icon || "", description: description || "",
        isActive: isActive !== false,
        categoryId: categoryId || null,
        ussdFlow: ussdFlow || "", pin: pin || "", simSlot: simSlot || 1,
        successSmsFormat: successSmsFormat || "", failureSmsFormat: failureSmsFormat || "",
        smsTimeout: smsTimeout || 30,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: context.auth.uid,
    });
    await writeLog({ uid: context.auth.uid, action: "SERVICE_CREATED", entityId: ref.id, meta: { name } });
    return { success: true, serviceId: ref.id };
});
exports.saveService = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);
    const { serviceId, name, icon, description, isActive, categoryId, ussdFlow, pin, simSlot, successSmsFormat, failureSmsFormat, smsTimeout } = data;
    if (!serviceId)
        throw new functions.https.HttpsError("invalid-argument", "serviceId required");
    await db.doc(`services/${serviceId}`).update({
        name, icon: icon || "", description: description || "",
        isActive: isActive !== false,
        categoryId: categoryId || null,
        ussdFlow, pin, simSlot, successSmsFormat, failureSmsFormat, smsTimeout,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: context.auth.uid,
    });
    await writeLog({ uid: context.auth.uid, action: "SERVICE_UPDATED", entityId: serviceId, meta: { name } });
    return { success: true };
});
exports.deleteService = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);
    const { serviceId } = data;
    if (!serviceId)
        throw new functions.https.HttpsError("invalid-argument", "serviceId required");
    const snap = await db.doc(`services/${serviceId}`).get();
    if (!snap.exists)
        throw new functions.https.HttpsError("not-found", "Service not found");
    await db.doc(`services/${serviceId}`).delete();
    await writeLog({ uid: context.auth.uid, action: "SERVICE_DELETED", entityId: serviceId, severity: "warn", meta: { serviceId } });
    return { success: true };
});
/** @deprecated Use createService / saveService instead */
exports.saveUssdTemplate = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);
    const { provider, ussdCode, steps, smsPatterns, smsTimeout } = data;
    if (!["bkash", "nagad", "rocket"].includes(provider)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid provider");
    }
    await db.doc(`ussdTemplates/${provider}`).set({
        provider, ussdCode, steps, smsPatterns, smsTimeout,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: context.auth.uid,
    }, { merge: true });
    await writeLog({ uid: context.auth.uid, action: "TEMPLATE_UPDATED", entityId: provider, meta: { provider, stepCount: steps === null || steps === void 0 ? void 0 : steps.length } });
    return { success: true };
});
// ═══════════════════════════════════════════════════════════════════════════════
// DEVICE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════
exports.generateDeviceToken = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);
    const token = buildRegistrationToken();
    const tokenHash = hashRegistrationToken(token);
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + REGISTRATION_TOKEN_TTL_MS));
    await db.doc(`agentRegistrationTokens/${tokenHash}`).set({
        tokenHash,
        createdBy: context.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt,
    });
    await writeLog({ uid: context.auth.uid, action: "DEVICE_TOKEN_GENERATED", severity: "warn" });
    return { token, expiresAt: expiresAt.toMillis() };
});
exports.registerAgentDevice = functions.https.onCall(async (data) => {
    const token = String((data === null || data === void 0 ? void 0 : data.token) || "").trim();
    const name = String((data === null || data === void 0 ? void 0 : data.name) || "").trim();
    const simProvider = String((data === null || data === void 0 ? void 0 : data.simProvider) || "").trim();
    const deviceFingerprint = String((data === null || data === void 0 ? void 0 : data.deviceFingerprint) || "").trim();
    const appVersion = String((data === null || data === void 0 ? void 0 : data.appVersion) || "").trim();
    if (!token || !name) {
        throw new functions.https.HttpsError("invalid-argument", "token and name are required");
    }
    const tokenHash = hashRegistrationToken(token);
    const tokenRef = db.doc(`agentRegistrationTokens/${tokenHash}`);
    const deviceRef = db.collection("agentDevices").doc();
    const deviceId = deviceRef.id;
    const authUid = `agent_${deviceId}`;
    const authEmail = buildAgentEmail(deviceId);
    const authPassword = buildAgentPassword();
    await db.runTransaction(async (tx) => {
        var _a, _b;
        const tokenSnap = await tx.get(tokenRef);
        if (!tokenSnap.exists) {
            throw new functions.https.HttpsError("not-found", "Registration token not found");
        }
        const tokenData = tokenSnap.data();
        const expiresAt = (_b = (_a = tokenData.expiresAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a);
        if (tokenData.usedAt) {
            throw new functions.https.HttpsError("already-exists", "Registration token already used");
        }
        if (!expiresAt || expiresAt.getTime() < Date.now()) {
            throw new functions.https.HttpsError("deadline-exceeded", "Registration token expired");
        }
        tx.update(tokenRef, {
            usedAt: admin.firestore.FieldValue.serverTimestamp(),
            usedByDeviceId: deviceId,
            authUid,
            authEmail,
        });
        tx.set(deviceRef, {
            deviceId,
            name,
            simProvider: simProvider || "Unknown",
            authUid,
            authEmail,
            currentJob: null,
            status: "online",
            appVersion: appVersion || "",
            deviceFingerprint: deviceFingerprint || "",
            registeredAt: admin.firestore.FieldValue.serverTimestamp(),
            lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    try {
        await auth.createUser({
            uid: authUid,
            email: authEmail,
            password: authPassword,
            displayName: name,
            disabled: false,
        });
        await auth.setCustomUserClaims(authUid, { role: "agent", deviceId });
        await writeLog({
            action: "DEVICE_REGISTERED",
            entityId: deviceId,
            meta: { deviceId, authUid, authEmail, simProvider, appVersion },
        });
        return { success: true, deviceId, email: authEmail, password: authPassword };
    }
    catch (error) {
        await deviceRef.delete().catch(() => undefined);
        await tokenRef.update({
            usedAt: admin.firestore.FieldValue.delete(),
            usedByDeviceId: admin.firestore.FieldValue.delete(),
            authUid: admin.firestore.FieldValue.delete(),
            authEmail: admin.firestore.FieldValue.delete(),
            registrationFailedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => undefined);
        throw new functions.https.HttpsError("internal", error instanceof Error ? error.message : "Device registration failed");
    }
});
exports.deviceHeartbeat = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth || context.auth.token.role !== "agent") {
        throw new functions.https.HttpsError("permission-denied", "Agent only");
    }
    const deviceId = String((data === null || data === void 0 ? void 0 : data.deviceId) || "").trim();
    const currentJob = String((data === null || data === void 0 ? void 0 : data.currentJob) || "").trim();
    const simProvider = String((data === null || data === void 0 ? void 0 : data.simProvider) || "").trim();
    const name = String((data === null || data === void 0 ? void 0 : data.name) || "").trim();
    const appVersion = String((data === null || data === void 0 ? void 0 : data.appVersion) || "").trim();
    if (!deviceId) {
        throw new functions.https.HttpsError("invalid-argument", "deviceId is required");
    }
    const deviceRef = db.doc(`agentDevices/${deviceId}`);
    const deviceSnap = await deviceRef.get();
    if (!deviceSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Device not found");
    }
    if (((_a = deviceSnap.data()) === null || _a === void 0 ? void 0 : _a.authUid) !== context.auth.uid) {
        throw new functions.https.HttpsError("permission-denied", "Device ownership mismatch");
    }
    await deviceRef.update(Object.assign(Object.assign(Object.assign({ lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(), currentJob: currentJob ? currentJob : admin.firestore.FieldValue.delete(), status: currentJob ? "busy" : "online" }, (simProvider ? { simProvider } : {})), (name ? { name } : {})), (appVersion ? { appVersion } : {})));
    return { success: true };
});
exports.revokeDevice = functions.https.onCall(async (data, context) => {
    await assertAdmin(context);
    const { deviceId } = data;
    if (!deviceId)
        throw new functions.https.HttpsError("invalid-argument", "deviceId required");
    const deviceSnap = await db.doc(`agentDevices/${deviceId}`).get();
    if (!deviceSnap.exists)
        throw new functions.https.HttpsError("not-found", "Device not found");
    const deviceData = deviceSnap.data();
    if (deviceData.authUid) {
        // Revoke tokens and disable account — ignore errors if auth user doesn't exist
        await auth.revokeRefreshTokens(deviceData.authUid).catch(() => undefined);
        await auth.updateUser(deviceData.authUid, { disabled: true }).catch(() => undefined);
    }
    await db.doc(`agentDevices/${deviceId}`).update({
        status: "revoked",
        revokedAt: admin.firestore.FieldValue.serverTimestamp(),
        revokedBy: context.auth.uid,
        currentJob: admin.firestore.FieldValue.delete(),
    });
    await writeLog({
        uid: context.auth.uid,
        action: "DEVICE_REVOKED",
        entityId: deviceId,
        severity: "warn",
        meta: { deviceId, authUid: deviceData.authUid || null },
    });
    return { success: true };
});
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
    // Skip agent device accounts — their claims are set by registerAgentDevice
    if (user.uid.startsWith("agent_"))
        return;
    await db.doc(`users/${user.uid}`).set({
        uid: user.uid, email: user.email || "", displayName: user.displayName || "",
        role: "user", walletBalance: 0, walletLocked: false, status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
        phoneNumber: user.phoneNumber || null,
    });
    await auth.setCustomUserClaims(user.uid, { role: "user" });
});
//# sourceMappingURL=index.js.map