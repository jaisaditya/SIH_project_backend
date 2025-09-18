// backend/models/Medicine.js
import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  genericName: { type: String, default: "" },
  category: { type: String, default: "Unknown" },
  form: { type: String, default: "" },
  quantity: { type: Number, default: 0 },
  price: { type: Number },
  expiryDate: { type: Date },
  pharmacy: { type: String }, // human readable name
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: "Pharmacy" },
  sourceBill: { type: mongoose.Schema.Types.ObjectId, ref: "Bill" },
  location: { type: String, default: "" }
}, { timestamps: true });

export default mongoose.model("Medicine", medicineSchema);
