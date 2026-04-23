import mongoose from "mongoose";
import User from "./src/lib/db/models/User.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/drecharge");
  const identifier = "test_user_query";
  const user = await User.findOne({
    $or: [{ email: identifier }, { username: identifier }]
  }).lean();
  console.log("Found:", user);
  process.exit(0);
}
run();
