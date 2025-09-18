// // backend/models/Consultation.js
import mongoose from "mongoose";
const consultationSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    symptoms: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "completed"],
      default: "pending",
    },

    // Appointment details
    appointment_date: { type: Date },
    appointment_time: { type: String },

    // Chat messages (persistent)
    messages: [
      {
        sender: { type: String, enum: ["user", "doctor"], required: true },
        message: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // Video call support
    videoRoomId: { type: String }, // e.g. WebRTC/Twilio Room ID
  },
  { timestamps: true }
);

const Consultation = mongoose.model("Consultation", consultationSchema);
export default Consultation;
