import Service from "@/lib/db/models/Service";

export type TemplateOutcome = "done" | "failed" | "waiting";

export interface SmsTemplateResult {
  outcome: TemplateOutcome;
  parsedResult: {
    success: boolean;
    txRef?: string;
    balance?: string;
    reason?: string;
  };
  failureReason?: string;
}

/**
 * Build a regex pattern for {recipientNumber} that allows operator-masked digits.
 * bKash and many BD operators replace middle digits with "X" in confirmation SMS,
 * e.g. stored "01811628121" → SMS shows "0181XXXX121".
 * Each digit in the stored number is allowed to appear as itself OR as "X"/"x".
 */
function buildRecipientPattern(recipientNumber: string): string {
  return recipientNumber
    .split("")
    .map(c => /\d/.test(c) ? `[${c}Xx]` : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("");
}

/**
 * Build a regex pattern for the {amount} placeholder that handles:
 * - Optional thousands comma separators  (50 → 50 or 1,500)
 * - bKash-style two-decimal SMS amounts  (50 stored → 50.00 in SMS)
 * - Trailing decimal zeros               (50.5 stored → 50.50 in SMS)
 */
function buildAmountPattern(amount: number): string {
  const str = String(amount);
  const dotIdx = str.indexOf(".");

  // Integer part: allow optional comma after every digit except the last
  const intStr = dotIdx >= 0 ? str.slice(0, dotIdx) : str;
  const intPattern = intStr
    .split("")
    .map((c, i) => (/\d/.test(c) && i < intStr.length - 1 ? `${c}[,]?` : c))
    .join("");

  if (dotIdx < 0) {
    // Whole number: SMS may show .00 / .0 etc. — allow any decimal suffix
    return `${intPattern}(?:\\.[0-9]+)?`;
  }

  const decStr = str.slice(dotIdx + 1);
  // Strip trailing zeros from the stored decimal
  const sigDec = decStr.replace(/0+$/, "");

  if (!sigDec) {
    // e.g. amount = 50.00 → treat as whole number
    return `${intPattern}(?:\\.[0-9]+)?`;
  }

  // e.g. amount = 50.5 → SMS shows 50.50 → allow trailing zeros
  return `${intPattern}\\.${sigDec}[0-9]*`;
}

export function buildSmsTemplateRegex(
  format: string,
  recipientNumber: string,
  amount: number
): RegExp | null {
  if (!format?.trim()) return null;
  let escaped = format.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  escaped = escaped.replace(/\s+/g, "\\s+");

  escaped = escaped
    .replace(/\\\{recipientNumber\\\}/g, buildRecipientPattern(recipientNumber))
    .replace(/\\\{amount\\\}/g, buildAmountPattern(amount))
    .replace(/\\\{trxId\\\}/g, "(?<txRef>\\w+)")
    .replace(/\\\{balance\\\}/g, "(?<balance>[0-9,.]+)")
    .replace(/\\\{[^\\}]+\\\}/g, ".*?");

  try {
    return new RegExp(escaped, "i");
  } catch {
    return null;
  }
}

export async function loadSuccessFormat(
  job: { serviceId: string; successSmsFormat?: string }
): Promise<string> {
  if (job.successSmsFormat?.trim()) return job.successSmsFormat;
  // Template may have been added to the service after the job was created — fall back to service.
  const service = await Service.findById(job.serviceId).lean();
  return service?.successSmsFormat ?? "";
}

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

export function evaluateSmsAgainstTemplates(args: {
  rawSms: string;
  recipientNumber: string;
  amount: number;
  successSmsFormat?: string;
  failureSmsTemplates?: { template: string; message: string }[];
}): SmsTemplateResult {
  const rawSms = args.rawSms.trim();
  const successSmsFormat = args.successSmsFormat ?? "";
  const successRegex = buildSmsTemplateRegex(successSmsFormat, args.recipientNumber, args.amount);
  const successMatch = successRegex ? rawSms.match(successRegex) : null;

  if (successMatch) {
    const parsedResult: SmsTemplateResult["parsedResult"] = { success: true };
    const txRef = successMatch.groups?.txRef;
    const balance = successMatch.groups?.balance;

    if (successSmsFormat.includes("{trxId}") && !txRef) {
      const reason = "Success template matched but transaction ID could not be extracted.";
      return { outcome: "waiting", parsedResult: { success: false, reason }, failureReason: reason };
    }

    if (txRef) parsedResult.txRef = txRef;
    if (balance) parsedResult.balance = balance;
    return { outcome: "done", parsedResult };
  }

  for (const template of args.failureSmsTemplates ?? []) {
    const failureRegex = buildSmsTemplateRegex(template.template, args.recipientNumber, args.amount);
    if (failureRegex?.test(rawSms)) {
      return {
        outcome: "failed",
        parsedResult: { success: false, reason: template.message },
        failureReason: template.message,
      };
    }
  }

  const reason = "SMS/USSD response did not match any configured success or failure template.";
  return { outcome: "waiting", parsedResult: { success: false, reason }, failureReason: reason };
}

