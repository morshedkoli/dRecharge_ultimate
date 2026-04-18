import mongoose, { Schema, Document, Model } from "mongoose";

export interface IServiceCategory extends Document<string> {
  _id: string;
  name: string;
  logo: string;
  order?: number;
  createdAt: Date;
}

const ServiceCategorySchema = new Schema<IServiceCategory>(
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

const ServiceCategory: Model<IServiceCategory> =
  mongoose.models.ServiceCategory ||
  mongoose.model<IServiceCategory>("ServiceCategory", ServiceCategorySchema);

export default ServiceCategory;
