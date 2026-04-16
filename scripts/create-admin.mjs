/**
 * One-time script to create a new admin user in Firebase Auth + Firestore.
 * Usage: node scripts/create-admin.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// ── Load .env.local ──────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");

for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

// ── Init Admin SDK ───────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();
const db = getFirestore();

// ── Admin Credentials ────────────────────────────────────────────────────────
const ADMIN_EMAIL = "admin@drecharge.com";
const ADMIN_PASSWORD = "Admin@12345";
const ADMIN_NAME = "Super Admin";
const ADMIN_ROLE = "super_admin";

try {
  let uid;

  // Try to get existing user first
  try {
    const existing = await auth.getUserByEmail(ADMIN_EMAIL);
    uid = existing.uid;
    console.log(`ℹ  User already exists (uid: ${uid}), updating role...`);
    await auth.updateUser(uid, { password: ADMIN_PASSWORD, displayName: ADMIN_NAME });
  } catch {
    // Create new user
    const userRecord = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: ADMIN_NAME,
      emailVerified: true,
    });
    uid = userRecord.uid;
    console.log(`✓  Created new user (uid: ${uid})`);
  }

  // Set custom claims
  await auth.setCustomUserClaims(uid, { role: ADMIN_ROLE });

  // Write Firestore user doc
  await db.doc(`users/${uid}`).set({
    uid,
    email: ADMIN_EMAIL,
    displayName: ADMIN_NAME,
    role: ADMIN_ROLE,
    walletBalance: 0,
    walletLocked: false,
    status: "active",
    createdAt: new Date(),
    lastLoginAt: new Date(),
    phoneNumber: null,
  }, { merge: true });

  console.log("");
  console.log("════════════════════════════════════════");
  console.log("  ✅ Admin account ready!");
  console.log("════════════════════════════════════════");
  console.log(`  Email    : ${ADMIN_EMAIL}`);
  console.log(`  Password : ${ADMIN_PASSWORD}`);
  console.log(`  Role     : ${ADMIN_ROLE}`);
  console.log(`  UID      : ${uid}`);
  console.log("════════════════════════════════════════");
  console.log("  Sign in at: http://localhost:3000/login");
  console.log("");

} catch (err) {
  console.error("✗ Failed:", err.message);
  process.exit(1);
}
