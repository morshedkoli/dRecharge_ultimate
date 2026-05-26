/**
 * One-time backfill: create an `opening_balance` WalletEntry for every user
 * who has a non-zero walletBalance but no ledger entries yet.
 *
 * Idempotent: re-running skips users that already have any WalletEntry.
 *
 * Usage:  node scripts/backfill-wallet-ledger.mjs
 *
 * Reads MONGODB_URI from .env.local.
 */

import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

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

// Minimal inline schemas — script-only, decoupled from app models.
const UserSchema = new mongoose.Schema(
  { _id: String, walletBalance: { type: Number, default: 0 } },
  { strict: false, collection: "users" }
);
const WalletEntrySchema = new mongoose.Schema(
  {
    _id: String,
    userId: { type: String, index: true },
    kind: String,
    amount: Number,
    balanceAfter: Number,
    note: String,
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false }, collection: "walletentries" }
);

const User = mongoose.model("User", UserSchema);
const WalletEntry = mongoose.model("WalletEntry", WalletEntrySchema);

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  const users = await User.find({ walletBalance: { $ne: 0 } }, { _id: 1, walletBalance: 1 }).lean();
  console.log(`Found ${users.length} user(s) with non-zero balance.`);

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    const existing = await WalletEntry.findOne({ userId: user._id }).lean();
    if (existing) {
      skipped++;
      continue;
    }
    await WalletEntry.create({
      _id: "WE_OPEN_" + user._id,
      userId: user._id,
      kind: "opening_balance",
      amount: user.walletBalance,
      balanceAfter: user.walletBalance,
      note: "Backfilled opening balance",
    });
    created++;
  }

  console.log(`Done. Created ${created} opening-balance entries, skipped ${skipped} users with existing journal.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
