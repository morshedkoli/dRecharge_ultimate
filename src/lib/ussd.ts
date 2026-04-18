type UssdStepType = "dial" | "select" | "input" | "wait";

export type NormalizedUssdStep = {
  order: number;
  type: UssdStepType;
  label: string;
  value: string;
  waitMs?: number;
};

type UssdSource = {
  ussdSteps?: unknown;
  ussdFlow?: unknown;
  pin?: unknown;
};

type JobResolutionInput = UssdSource & {
  recipientNumber: string;
  amount: number;
};

const VALID_TYPES = new Set<UssdStepType>(["dial", "select", "input", "wait"]);

function toStepLabel(type: UssdStepType, index: number): string {
  switch (type) {
    case "dial":
      return index === 0 ? "Dial" : `Dial ${index + 1}`;
    case "select":
      return `Select ${index}`;
    case "input":
      return `Input ${index}`;
    case "wait":
      return `Wait ${index}`;
  }
}

function replacePlaceholders(value: string, params: { recipientNumber: string; amount: number; pin: string }): string {
  return value
    .replace(/{recipientNumber}/gi, params.recipientNumber)
    .replace(/{amount}/gi, params.amount.toString())
    .replace(/{pin}/gi, params.pin);
}

function normalizeWaitStep(step: Partial<NormalizedUssdStep>, index: number): NormalizedUssdStep {
  const waitMs =
    typeof step.waitMs === "number"
      ? step.waitMs
      : Number.parseInt(String(step.value ?? "").trim(), 10);
  const safeWaitMs = Number.isFinite(waitMs) && waitMs >= 0 ? waitMs : 1000;

  return {
    order: index + 1,
    type: "wait",
    label: step.label?.trim() || toStepLabel("wait", index),
    value: String(safeWaitMs),
    waitMs: safeWaitMs,
  };
}

export function normalizeStructuredUssdSteps(rawSteps: unknown): NormalizedUssdStep[] {
  if (!Array.isArray(rawSteps)) return [];

  return rawSteps
    .map((step, index) => {
      if (!step || typeof step !== "object") return null;

      const rawType = String((step as { type?: unknown }).type ?? "").trim().toLowerCase();
      const type = VALID_TYPES.has(rawType as UssdStepType)
        ? (rawType as UssdStepType)
        : null;
      if (!type) return null;

      const rawValue = String((step as { value?: unknown }).value ?? "").trim();
      const rawLabel = String((step as { label?: unknown }).label ?? "").trim();
      const rawOrder = Number.parseInt(String((step as { order?: unknown }).order ?? index + 1), 10);
      const order = Number.isFinite(rawOrder) && rawOrder > 0 ? rawOrder : index + 1;

      if (type === "wait") {
        return normalizeWaitStep(
          {
            order,
            type,
            label: rawLabel,
            value: rawValue,
            waitMs: typeof (step as { waitMs?: unknown }).waitMs === "number"
              ? ((step as { waitMs?: number }).waitMs)
              : undefined,
          },
          index,
        );
      }

      if (!rawValue) return null;

      return {
        order,
        type,
        label: rawLabel || toStepLabel(type, index),
        value: rawValue,
      };
    })
    .filter((step): step is NormalizedUssdStep => step !== null)
    .sort((a, b) => a.order - b.order)
    .map((step, index) => ({ ...step, order: index + 1 }));
}

function inferLegacyStepType(segment: string, index: number): UssdStepType {
  if (index === 0) return "dial";
  if (/^wait[:=]\d+$/i.test(segment)) return "wait";
  if (/^\d+$/.test(segment)) return "select";
  return "input";
}

export function normalizeLegacyUssdFlow(rawFlow: unknown): NormalizedUssdStep[] {
  if (typeof rawFlow !== "string") return [];

  const segments = rawFlow
    .split("-")
    .map((segment) => segment.trim())
    .filter(Boolean);

  return segments.map((segment, index) => {
    const type = inferLegacyStepType(segment, index);
    if (type === "wait") {
      const waitMs = Number.parseInt(segment.replace(/^wait[:=]/i, ""), 10);
      return {
        order: index + 1,
        type,
        label: toStepLabel(type, index),
        value: String(Number.isFinite(waitMs) ? waitMs : 1000),
        waitMs: Number.isFinite(waitMs) ? waitMs : 1000,
      };
    }

    return {
      order: index + 1,
      type,
      label: toStepLabel(type, index),
      value: segment,
    };
  });
}

export function getServiceTemplateUssdSteps(source: UssdSource): NormalizedUssdStep[] {
  const structured = normalizeStructuredUssdSteps(source.ussdSteps);
  if (structured.length > 0) return structured;
  return normalizeLegacyUssdFlow(source.ussdFlow);
}

export function resolveJobUssdSteps(source: JobResolutionInput): NormalizedUssdStep[] {
  const pin = String(source.pin ?? "").trim();
  const templateSteps = getServiceTemplateUssdSteps(source);

  return templateSteps.map((step) => {
    if (step.type === "wait") {
      const derivedWaitMs = step.waitMs ?? Number.parseInt(step.value, 10);
      const safeWaitMs = Number.isFinite(derivedWaitMs) ? derivedWaitMs : 1000;

      return {
        ...step,
        value: String(safeWaitMs),
        waitMs: safeWaitMs,
      };
    }

    return {
      ...step,
      value: replacePlaceholders(step.value, {
        recipientNumber: source.recipientNumber,
        amount: source.amount,
        pin,
      }),
    };
  });
}
