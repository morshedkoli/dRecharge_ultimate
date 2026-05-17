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

export function buildSmsTemplateRegex(
  format: string,
  recipientNumber: string,
  amount: number
): RegExp | null {
  if (!format?.trim()) return null;
  let escaped = format.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  escaped = escaped.replace(/\s+/g, "\\s+");
  const amountText = String(amount).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const amountWithOptionalSeparators = amountText
    .replace(/\\,/g, ",")
    .replace(/\d/g, "$&[,]?");

  escaped = escaped
    .replace(/\\\{recipientNumber\\\}/g, recipientNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .replace(/\\\{amount\\\}/g, `(?:${amountWithOptionalSeparators}(?:\\.0+)?|${amountText}(?:\\.0+)?)`)
    .replace(/\\\{trxId\\\}/g, "(?<txRef>\\w+)")
    .replace(/\\\{balance\\\}/g, "(?<balance>[0-9,.]+)")
    .replace(/\\\{[^\\}]+\\\}/g, ".*?");

  try {
    return new RegExp(escaped, "i");
  } catch {
    return null;
  }
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

