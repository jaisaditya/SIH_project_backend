// backend/models/HealthRecord.js
import mongoose from "mongoose";
const healthRecordSchema = new mongoose.Schema(
  {
    user: {   // ✅ renamed from patient
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    diagnosis: { type: String, required: true },
    prescription: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

const HealthRecord = mongoose.model("HealthRecord", healthRecordSchema);
export default HealthRecord;


