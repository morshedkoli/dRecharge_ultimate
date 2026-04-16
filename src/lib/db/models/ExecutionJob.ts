import mongoose, { Schema, Document, Model } from "mongoose";

export type JobStatus = "queued" | "processing" | "done" | "failed";

export interface IExecutionJob extends Document<string> {
  _id: string;
  txId: string;
  userId: string;
  serviceId: string;
  recipientNumber: string;
  amount: number;
  ussdFlow?: string;
  rawUssdFlow?: string;
  successSmsFormat?: string;
  failureSmsFormat?: string;
  status: JobStatus;
  locked: boolean;
  lockedAt?: Date;
  lockedByDevice?: string;
  attempt: number;
  rawSms?: string;
  parsedResult?: {
    success: boolean;
    txRef?: string;
    amount?: number;
    reason?: string;
  };
  ussdStepsExecuted?: object[];
  createdAt: Date;
  completedAt?: Date;
}

const ExecutionJobSchema = new Schema<IExecutionJob>(
  {
    _id: { type: String, required: true },
    txId: { type: String, required: true },
    userId: { type: String, required: true },
    serviceId: { type: String, required: true },
    recipientNumber: { type: String, required: true },
    amount: { type: Number, required: true },
    ussdFlow: { type: String },
    rawUssdFlow: { type: String },
    successSmsFormat: { type: String },
    failureSmsFormat: { type: String },
    status: {
      type: String,
      enum: ["queued", "processing", "done", "failed"],
      default: "queued",
    },
    locked: { type: Boolean, default: false },
    lockedAt: { type: Date },
    lockedByDevice: { type: String },
    attempt: { type: Number, default: 0 },
    rawSms: { type: String },
    parsedResult: { type: Schema.Types.Mixed },
    ussdStepsExecuted: [{ type: Schema.Types.Mixed }],
    completedAt: { type: Date },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
    _id: false,
  }
);

ExecutionJobSchema.index({ status: 1, createdAt: 1 });
ExecutionJobSchema.index({ locked: 1, status: 1, lockedAt: 1 });

const ExecutionJob: Model<IExecutionJob> =
  mongoose.models.ExecutionJob ||
  mongoose.model<IExecutionJob>("ExecutionJob", ExecutionJobSchema);

export default ExecutionJob;
