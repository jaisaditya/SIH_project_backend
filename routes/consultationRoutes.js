// backend/routes/consultationRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import doctorProtect from "../middleware/doctorAuthMiddleware.js";
import anyAuth from "../middleware/anyAuthMiddleware.js";
import Consultation from "../models/Consultation.js";
import Doctor from "../models/Doctor.js";

const router = express.Router();

// -------------------- PATIENT ROUTES --------------------

// Create consultation (patient only)
router.post("/", protect, async (req, res) => {
  try {
    const { doctorId, symptoms, appointment_date, appointment_time } = req.body;
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    const consultation = await Consultation.create({
      patient: req.user._id,
      doctor: doctorId,
      symptoms: symptoms || "",
      appointment_date,
      appointment_time,
      status: "pending",
    });

    res.status(201).json(consultation);
  } catch (error) {
    console.error("❌ Error creating consultation:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all consultations for patient
router.get("/", protect, async (req, res) => {
  try {
    const consultations = await Consultation.find({ patient: req.user._id }).populate(
      "doctor",
      "name specialization"
    );
    res.json(consultations);
  } catch (error) {
    console.error("❌ Error fetching consultations:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get full consultation details (patient or doctor)
router.get("/:id", anyAuth, async (req, res) => {
  try {
    const consultation = await Consultation.findById(req.params.id)
      .populate("doctor", "name specialization")
      .populate("patient", "name email");

    if (!consultation) return res.status(404).json({ message: "Consultation not found" });

    res.json(consultation);
  } catch (error) {
    console.error("❌ Error fetching consultation:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get messages for a consultation (patient or doctor)
router.get("/:id/messages", anyAuth, async (req, res) => {
  try {
    const consultation = await Consultation.findById(req.params.id);
    if (!consultation) return res.status(404).json({ message: "Consultation not found" });
    res.json(consultation.messages);
  } catch (error) {
    console.error("❌ Error fetching messages:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------- DOCTOR ROUTES --------------------

// Get consultations for the logged doctor
router.get("/doctor", doctorProtect, async (req, res) => {
  try {
    const consultations = await Consultation.find({ doctor: req.doctor._id })
      .populate("patient", "name email")
      .populate("doctor", "name specialization");
    res.json(consultations);
  } catch (error) {
    console.error("❌ Error fetching consultations (doctor):", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Doctor starts/reserves a video room (optional helper)
router.post("/:id/start-video", doctorProtect, async (req, res) => {
  try {
    const consultation = await Consultation.findById(req.params.id);
    if (!consultation) return res.status(404).json({ message: "Consultation not found" });

    if (consultation.doctor.toString() !== req.doctor._id.toString()) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const roomId = consultation.videoRoomId || `room-${consultation._id}`;
    consultation.videoRoomId = roomId;
    await consultation.save();
    res.json({ roomId });
  } catch (error) {
    console.error("❌ Error starting video session:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
