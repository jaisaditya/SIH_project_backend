import mongoose from "mongoose";

const PatientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },   // ✅ add this
  phone: { type: String, required: true },   // ✅ required
  age: { type: Number, required: true },
  gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
  address: { type: String },
  medicalHistory: { type: [String], default: [] },
}, { timestamps: true });

export default mongoose.model("Patient", PatientSchema);
