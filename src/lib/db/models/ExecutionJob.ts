import mongoose, { Schema, Document, Model } from "mongoose";

export type JobStatus = "queued" | "processing" | "waiting" | "done" | "failed" | "cancelled";

export interface IExecutionJob extends Document<string> {
  _id: string;
  txId: string;
  userId: string;
  serviceId: string;
  serviceName?: string;
  recipientNumber: string;
  amount: number;
  ussdSteps?: {               // structured steps (source of truth for agent)
    order: number;
    type: "dial" | "select" | "input" | "wait";
    label: string;
    value: string;
    waitMs?: number;
  }[];
  simSlot?: number;
  smsTimeout?: number;
  successSmsFormat?: string;
  failureSmsTemplates?: { template: string; message: string }[];
  status: JobStatus;
  locked: boolean;
  lockedAt?: Date;
  lockedByDevice?: string;
  lockedByUser?: string;
  attempt: number;
  rawSms?: string;
  parsedResult?: {
    success: boolean;
    txRef?: string;
    senderNumber?: string;
    amount?: number;
    reason?: string;
  };
  ussdStepsExecuted?: object[];
  queuedAt?: Date;
  createdAt: Date;
  completedAt?: Date;
}

const ExecutionJobSchema = new Schema<IExecutionJob>(
  {
    _id: { type: String, required: true },
    txId: { type: String, required: true },
    userId: { type: String, required: true },
    serviceId: { type: String, required: true },
    serviceName: { type: String },
    recipientNumber: { type: String, required: true },
    amount: { type: Number, required: true },
    ussdSteps: {
      type: [
        {
          order:  { type: Number },
          type:   { type: String },
          label:  { type: String },
          value:  { type: String },
          waitMs: { type: Number },
        },
      ],
      default: undefined,
    },
    simSlot: { type: Number },
    smsTimeout: { type: Number },
    successSmsFormat: { type: String },
    failureSmsTemplates: {
      type: [{ template: { type: String }, message: { type: String } }],
      default: undefined,
    },
    status: {
      type: String,
      enum: ["queued", "processing", "waiting", "done", "failed", "cancelled"],
      default: "queued",
    },
    locked: { type: Boolean, default: false },
    lockedAt: { type: Date },
    lockedByDevice: { type: String },
    lockedByUser: { type: String },
    attempt: { type: Number, default: 0 },
    rawSms: { type: String },
    parsedResult: { type: Schema.Types.Mixed },
    ussdStepsExecuted: [{ type: Schema.Types.Mixed }],
    completedAt: { type: Date },
  },
  {
    timestamps: { createdAt: "queuedAt", updatedAt: "updatedAt" },
  }
);

ExecutionJobSchema.index({ status: 1, createdAt: 1 });
ExecutionJobSchema.index({ locked: 1, status: 1, lockedAt: 1 });

const ExecutionJob: Model<IExecutionJob> =
  mongoose.models.ExecutionJob ||
  mongoose.model<IExecutionJob>("ExecutionJob", ExecutionJobSchema);

export default ExecutionJob;
