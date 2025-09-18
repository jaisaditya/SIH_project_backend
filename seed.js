// backend/seed.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import HealthRecord from "./models/HealthRecord.js";
import connectDB from "./config/db.js";

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();

    // ✅ Find any existing user (you can also filter by email if needed)
    const user = await User.findOne();
    if (!user) {
      console.log("⚠️ No user found. Please register a user first.");
      process.exit(0);
    }

    console.log(`✅ Found user: ${user.full_name} (${user.email})`);

    // Clear old records for this user
    await HealthRecord.deleteMany({ patient: user._id });

    // Insert sample health records
    const records = [
      {
        patient: user._id,
        diagnosis: "Diabetes Type 2",
        prescription: "Metformin 500mg daily",
        notes: "Monitor blood sugar regularly",
      },
      {
        patient: user._id,
        diagnosis: "Hypertension",
        prescription: "Amlodipine 5mg daily",
        notes: "Reduce salt intake, exercise 30 mins daily",
      },
      {
        patient: user._id,
        diagnosis: "Seasonal Allergy",
        prescription: "Cetirizine 10mg as needed",
        notes: "Avoid pollen exposure",
      },
    ];

    await HealthRecord.insertMany(records);

    console.log("✅ Sample health records seeded successfully.");
    process.exit();
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
};

seedData();
