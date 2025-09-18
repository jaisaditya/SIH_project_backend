// backend/models/Bill.js
import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: "Pharmacy", required: true },
    fileName: String,
    originalName: String,
    fileUrl: String,
    status: {
      type: String,
      enum: ["Uploaded", "Processing", "Completed", "Error"],
      default: "Uploaded",
    },
    medicines: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Medicine" }
    ]
  },
  { timestamps: true }
);

export default mongoose.model("Bill", billSchema);
