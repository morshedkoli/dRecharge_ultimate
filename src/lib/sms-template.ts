import Service from "@/lib/db/models/Service";

export type TemplateOutcome = "done" | "failed";

export interface SmsTemplateResult {
  outcome: TemplateOutcome;
  parsedResult: {
    success: boolean;
    txRef?: string;       // transaction ID captured from SMS via {trxId}
    balance?: string;     // balance captured from SMS via {balance}
    smsAmount?: string;   // amount captured from SMS via {amount}
    smsRecipient?: string;// recipient captured from SMS via {recipientNumber} (may be masked)
    reason?: string;
  };
  failureReason?: string;
}

/**
 * Converts a service SMS template into a regex that works for ANY user/amount/recipient.
 *
 * Design: templates are FORMAT patterns, not value validators. The agent already
 * associates the SMS with the correct job (temporal binding — the SMS arrives
 * while executing that specific USSD). The server's job is to recognise the
 * shape of the message ("this looks like a bKash success") and capture the
 * dynamic values from it.
 *
 * Placeholder resolution:
 *   {amount}          → (?<smsAmount>[0-9,]+(?:\.[0-9]+)?)   captures any amount
 *   {recipientNumber} → (?<smsRecipient>[0-9Xx+]{6,20})      captures any masked phone
 *   {trxId}           → (?<txRef>\w+)                        captures transaction ID
 *   {balance}         → (?<balance>[0-9,.]+)                 captures account balance
 *   {anything_else}   → .*?                                  wildcard
 *
 * Literal text is regex-escaped and whitespace is normalised to \s+.
 */
export function buildSmsTemplateRegex(format: string): RegExp | null {
  if (!format?.trim()) return null;

  let escaped = format.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  escaped = escaped.replace(/\s+/g, "\\s+");

  escaped = escaped
    .replace(/\\\{amount\\\}/g,          "(?<smsAmount>[0-9,]+(?:\\.[0-9]+)?)")
    .replace(/\\\{recipientNumber\\\}/g, "(?<smsRecipient>[0-9Xx+]{6,20})")
    .replace(/\\\{trxId\\\}/g,           "(?<txRef>\\w+)")
    .replace(/\\\{balance\\\}/g,         "(?<balance>[0-9,.]+)")
    .replace(/\\\{[^\\}]+\\\}/g,         ".*?");

  try {
    return new RegExp(escaped, "is");
  } catch {
    return null;
  }
}

/**
 * Permissive variant of [buildSmsTemplateRegex] for failure-template matching.
 *
 * Failure templates don't need field capture — only match/no-match. Real failure
 * SMS bodies often omit fields like `{amount}` or `{trxId}` that appear in
 * success messages, so the strict numeric/word patterns reject them. This
 * builder mirrors the Flutter agent's `_templateRegex`: every `{placeholder}`
 * becomes a wildcard `.*?`, whitespace is normalised, and both `i` and `s`
 * (dotAll) flags are set so newlines in multi-line SMS bodies don't break the
 * match.
 */
export function buildPermissiveTemplateRegex(format: string): RegExp | null {
  if (!format?.trim()) return null;

  let escaped = format.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  escaped = escaped.replace(/\s+/g, "\\s+");
  escaped = escaped.replace(/\\\{[^\\}]+\\\}/g, ".*?");

  try {
    return new RegExp(escaped, "is");
  } catch {
    return null;
  }
}

/**
 * Load successSmsFormat from the service as a fallback when the job's own
 * field is blank (template configured after the job was created).
 */
export async function loadSuccessFormat(
  job: { serviceId: string; successSmsFormat?: string }
): Promise<string> {
  if (job.successSmsFormat?.trim()) return job.successSmsFormat;
  const service = await Service.findById(job.serviceId).lean();
  return service?.successSmsFormat ?? "";
}

/**
 * Load failure templates from the service when the job has none of its own.
 */
export async function loadFailureTemplates(
  job: {
    serviceId: string;
    failureSmsTemplates?: { template: string; message: string }[];
  }
): Promise<{ template: string; message: string }[]> {
  const jobTemplates = job.failureSmsTemplates ?? [];
  if (jobTemplates.length > 0) return jobTemplates;
  const service = await Service.findById(job.serviceId).lean();
  return (service?.failureSmsTemplates ?? []) as { template: string; message: string }[];
}

/**
 * Evaluate an incoming SMS against the configured success and failure templates.
 *
 * Returns:
 *   done    → SMS matched success template (job complete)
 *   failed  → either SMS matched a failure template (specific reason), or
 *             nothing matched (generic reason). Caller always refunds on failed.
 *
 * `recipientNumber` and `amount` are accepted for call-site compatibility but
 * are NOT used for matching — the templates are format-based and work for any
 * user, any amount, any recipient without hardcoding specific values.
 */
export function evaluateSmsAgainstTemplates(args: {
  rawSms: string;
  successSmsFormat?: string;
  failureSmsTemplates?: { template: string; message: string }[];
  // kept for backward-compat; not used in regex matching
  recipientNumber?: string;
  amount?: number;
}): SmsTemplateResult {
  const rawSms = args.rawSms.trim();
  const successSmsFormat = args.successSmsFormat ?? "";

  const successRegex = buildSmsTemplateRegex(successSmsFormat);
  const successMatch = successRegex ? rawSms.match(successRegex) : null;

  if (successMatch) {
    const parsedResult: SmsTemplateResult["parsedResult"] = { success: true };
    const { txRef, balance, smsAmount, smsRecipient } = successMatch.groups ?? {};

    // If template requires a transaction ID but regex couldn't capture one,
    // treat the transaction as failed — the SMS structure is unexpected and we
    // can't confidently confirm success without the txRef.
    if (successSmsFormat.includes("{trxId}") && !txRef) {
      const reason = "Transaction could not be confirmed.";
      return { outcome: "failed", parsedResult: { success: false, reason }, failureReason: reason };
    }

    if (txRef)        parsedResult.txRef        = txRef;
    if (balance)      parsedResult.balance       = balance;
    if (smsAmount)    parsedResult.smsAmount     = smsAmount.trim();
    if (smsRecipient) parsedResult.smsRecipient  = smsRecipient.trim();

    return { outcome: "done", parsedResult };
  }

  // Failure path. Whether or not a configured failure template matches, the
  // user-facing reason is the operator's verbatim response text — that's the
  // most diagnostic message for both the user and the admin. Template
  // matching is no longer surfaced; the `message` field on the failure
  // templates is kept in the DB but ignored at runtime.
  return {
    outcome: "failed",
    parsedResult: { success: false, reason: rawSms },
    failureReason: rawSms,
  };
}
