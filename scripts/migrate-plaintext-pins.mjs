/**
 * One-time migration: hash any remaining plaintext `pin` field into `pinHash`,
 * then unset the plaintext field. Safe to re-run.
 *
 * Usage:  node scripts/migrate-plaintext-pins.mjs
 */

import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Load .env.local if present — in CI/prod, env vars are usually injected
// directly, so missing .env.local must not be fatal.
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI missing from .env.local");
  process.exit(1);
}

const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$/;

async function main() {
  await mongoose.connect(MONGODB_URI);
  const Users = mongoose.connection.collection("users");

  const cursor = Users.find({ pin: { $exists: true, $ne: null } });
  let hashed = 0;
  let unsetOnly = 0;

  for await (const doc of cursor) {
    const raw = String(doc.pin);
    const update = { $unset: { pin: "" } };

    if (!doc.pinHash) {
      // No hash yet → hash the legacy plaintext (or store it as-is if already bcrypt).
      const newHash = BCRYPT_PATTERN.test(raw) ? raw : await bcrypt.hash(raw, 12);
      update.$set = { pinHash: newHash };
      hashed++;
    } else {
      unsetOnly++;
    }
    await Users.updateOne({ _id: doc._id }, update);
  }

  console.log(`Done. Hashed: ${hashed}, plaintext-unset-only: ${unsetOnly}.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
