// backend/models/Otp.js
import mongoose from "mongoose";

const OtpSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

export default mongoose.model("Otp", OtpSchema);
