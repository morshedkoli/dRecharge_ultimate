import { z } from "zod";

export const addBalanceSchema = z.object({
  amount: z.number({ required_error: "Amount is required" }).positive("Must be positive").max(100000, "Max 1,00,000 BDT"),
  note: z.string().optional(),
});

export const rejectRequestSchema = z.object({
  adminNote: z.string().min(5, "Please provide a reason (min 5 characters)"),
});

export const approveRequestSchema = z.object({
  adminNote: z.string().optional(),
});

export const ussdStepSchema = z.object({
  order: z.number(),
  type: z.enum(["dial", "select", "input"]),
  value: z.string().min(1, "Value required"),
  label: z.string().optional(),
  waitMs: z.number().min(0).max(10000),
});

export const smsPatternSchema = z.object({
  result: z.enum(["success", "failure"]),
  regex: z.string().min(1, "Regex pattern required"),
  groups: z.array(z.string()),
});

export const ussdTemplateSchema = z.object({
  ussdCode: z.string().min(1, "USSD code required").startsWith("*"),
  smsTimeout: z.number().min(10).max(120),
  steps: z.array(ussdStepSchema).min(1, "At least one step required"),
  smsPatterns: z.array(smsPatternSchema),
});
