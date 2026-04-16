const fs = require("fs");
const env = fs.readFileSync(".env.local", "utf8");
const match = env.match(/MONGODB_URI\s*=\s*"?([^"\n]+)"?/);
process.env.MONGODB_URI = match ? match[1] : "";
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB for seeding...");

    const db = mongoose.connection.db;

    const hashPassword = async (pw) => await bcrypt.hash(pw, 12);

    const admin = {
      _id: crypto.randomUUID().replace(/-/g, ""),
      email: "admin@finpay.com",
      displayName: "Super Admin",
      role: "super_admin",
      status: "active",
      walletBalance: 100000,
      walletLocked: 0,
      pin: "12345",
      passwordHash: await hashPassword("admin123"),
      phoneNumber: "01700000000",
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    const user = {
      _id: crypto.randomUUID().replace(/-/g, ""),
      email: "user@finpay.com",
      displayName: "Regular User",
      role: "user",
      status: "active",
      walletBalance: 1500,
      walletLocked: 0,
      pin: "54321",
      passwordHash: await hashPassword("user123"),
      phoneNumber: "01711111111",
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    const agent = {
      _id: crypto.randomUUID().replace(/-/g, ""),
      email: "agent@finpay.com",
      displayName: "Mobile Agent",
      role: "agent",
      status: "active",
      walletBalance: 0,
      walletLocked: 0,
      pin: "00000",
      passwordHash: await hashPassword("agent123"),
      phoneNumber: "01722222222",
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    // Upsert logic to prevent duplicate emails
    for (const doc of [admin, user, agent]) {
      const existing = await db.collection("users").findOne({ email: doc.email });
      if (!existing) {
        await db.collection("users").insertOne(doc);
        console.log(`Created ${doc.role} -> Email: ${doc.email} `);
      } else {
        await db.collection("users").updateOne({ email: doc.email }, { $set: { passwordHash: doc.passwordHash } });
        console.log(`Updated existing ${doc.role} -> Email: ${doc.email}`);
      }
    }

    console.log("Seeding complete!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
