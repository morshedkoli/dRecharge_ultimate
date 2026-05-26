import { nanoid } from "nanoid";
import type { ClientSession } from "mongoose";
import User from "@/lib/db/models/User";
import WalletEntry, { WalletEntryKind } from "@/lib/db/models/WalletEntry";

export interface LedgerWriteInput {
  userId: string;
  kind: WalletEntryKind;
  amount: number;          // signed: positive=credit, negative=debit
  txId?: string;
  jobId?: string;
  balanceRequestId?: string;
  actorUid?: string;
  note?: string;
  session?: ClientSession; // optional Mongo session for transactions
  /**
   * When true, also mutates User.walletBalance by `amount`. Default true.
   * Set to false when the caller has already updated the balance (e.g.
   * inside an existing tx flow) and only needs the journal entry.
   */
  updateUserBalance?: boolean;
}

export interface LedgerWriteResult {
  entryId: string;
  balanceAfter: number;
}

/**
 * Append a wallet ledger entry. Optionally adjusts the user's denormalized
 * walletBalance in the same Mongo session.
 *
 * Use inside a withTransaction() block alongside the other writes that
 * caused the balance change to keep the journal consistent with state.
 */
export async function writeLedger(input: LedgerWriteInput): Promise<LedgerWriteResult> {
  const { userId, kind, amount, session, updateUserBalance = true } = input;

  let balanceAfter: number;
  if (updateUserBalance) {
    const updated = await User.findByIdAndUpdate(
      userId,
      { $inc: { walletBalance: amount } },
      { new: true, session }
    );
    if (!updated) throw new Error(`User ${userId} not found`);
    balanceAfter = updated.walletBalance;
  } else {
    const user = await User.findById(userId).session(session ?? null);
    if (!user) throw new Error(`User ${userId} not found`);
    balanceAfter = user.walletBalance;
  }

  const entryId = "WE_" + nanoid(20);
  await WalletEntry.create(
    [
      {
        _id: entryId,
        userId,
        kind,
        amount,
        balanceAfter,
        txId: input.txId,
        jobId: input.jobId,
        balanceRequestId: input.balanceRequestId,
        actorUid: input.actorUid,
        note: input.note,
      },
    ],
    session ? { session } : undefined
  );

  return { entryId, balanceAfter };
}
