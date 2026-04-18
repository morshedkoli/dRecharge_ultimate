const fs = require("fs");
const envFile = fs.readFileSync(".env.local", "utf8");
for (const line of envFile.split("\\n")) {
  if (line.trim().startsWith("#") || !line.trim()) continue;
  const [key, ...valueParts] = line.split("=");
  process.env[key.trim()] = valueParts.join("=").trim().replace(/^"|"$/g, '');
}
const mongoose = require("mongoose");
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(async () => {
    // connectDB()
    const db = mongoose.connection.db;
    // Let's directly query the driver first
    const fromDriver = await db.collection("servicecategories").find({}).toArray();
    console.log("From Driver:", fromDriver);

    // Now through Mongoose
    const ServiceCategorySchema = new mongoose.Schema({
        _id: { type: String, required: true },
        name: { type: String, required: true, trim: true },
        logo: { type: String, default: "" },
        order: { type: Number },
      },
      {
        timestamps: { createdAt: "createdAt", updatedAt: false },
        _id: false,
      }
    );
    const ServiceCategory = mongoose.models.ServiceCategory || mongoose.model("ServiceCategory", ServiceCategorySchema);
    
    const fromMongoose = await ServiceCategory.find().lean();
    console.log("From Mongoose:", fromMongoose);

    mongoose.disconnect();
  })
  .catch(console.error);
