import mongoose, { Schema, Document, Model } from "mongoose";

export interface IServiceProvider extends Document<string> {
  _id: string;
  name: string;
  logo: string;
  order?: number;
  createdAt: Date;
}

const ServiceProviderSchema = new Schema<IServiceProvider>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    logo: { type: String, default: "" },
    order: { type: Number },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  }
);

const ServiceProvider: Model<IServiceProvider> =
  mongoose.models.ServiceProvider ||
  mongoose.model<IServiceProvider>("ServiceProvider", ServiceProviderSchema);

export default ServiceProvider;
