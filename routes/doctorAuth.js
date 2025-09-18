// routes/doctorAuth.js
import express from "express";
import Doctor from "../models/Doctor.js";
import protectDoctor from "../middleware/doctorAuthMiddleware.js";

//#
import Consultation from '../models/Consultation.js';
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// Utility: Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d", // 1 week
  });
};

// @route   POST /api/doctors/register
// @desc    Register a new doctor
router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      specialization,
      phone,
      hospital,
      experience,
    } = req.body;

    // check existing doctor
    const existing = await Doctor.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Doctor already exists" });
    }

    // create doctor
    const doctor = await Doctor.create({
      name,
      email,
      password,
      specialization,
      phone,
      hospital,
      experience,
    });

    res.status(201).json({
      _id: doctor._id,
      name: doctor.name,
      email: doctor.email,
      specialization: doctor.specialization,
      token: generateToken(doctor._id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/doctors/login
// @desc    Login doctor
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const doctor = await Doctor.findOne({ email });
    if (!doctor) {
      return res.status(400).json({ message: "Doctor not found" });
    }

    const isMatch = await doctor.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    res.json({
      _id: doctor._id,
      name: doctor.name,
      email: doctor.email,
      specialization: doctor.specialization,
      token: generateToken(doctor._id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add this somewhere after your existing login/register routes in doctorAuth.js

// @route   GET /api/doctors
// @desc    Return all doctors (public)
router.get("/", async (req, res) => {
  try {
    // Exclude password field
    const doctors = await Doctor.find().select("-password -googleId");
    res.json(doctors);
  } catch (err) {
    console.error("Error fetching doctors:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/doctors/me
// @desc    Get logged-in doctor profile
router.get("/me", protectDoctor, async (req, res) => {
  try {
    res.json(req.doctor); // already populated in middleware
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//# 
// @route GET /api/doctors/requests
// @desc  Get all consultation requests for the logged-in doctor
router.get('/requests', protectDoctor, async (req, res) => {
  try {
    // Find consultations for this doctor and include patient name
    const rawRequests = await Consultation.find({ doctor: req.doctor._id }).populate('patient', 'full_name');
    // Format response to include patientName for frontend
    const requests = rawRequests.map(r => ({
      _id: r._id,
      patientName: r.patient.full_name,
      symptoms: r.symptoms,
      status: r.status,
      createdAt: r.createdAt,
    }));
    console.log(`📋 Doctor ${req.doctor._id} fetched ${requests.length} requests`);
    res.json(requests);
  } catch (error) {
    console.error("❌ Error fetching doctor requests:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route POST /api/doctors/requests/:id
// @desc  Doctor accepts or declines a consultation request
router.post('/requests/:id', protectDoctor, async (req, res) => {
  const { action } = req.body; // expected 'accept' or 'decline'
  try {
    const consultation = await Consultation.findOne({
      _id: req.params.id,
      doctor: req.doctor._id,
    });
    if (!consultation) {
      return res.status(404).json({ message: 'Consultation not found' });
    }
    if (action === 'accept') {
      consultation.status = 'accepted';
       // create unique room id if not present
      if (!consultation.videoRoomId) {
        consultation.videoRoomId = uuidv4();
      }
    } else if (action === 'decline') {
      consultation.status = 'declined';
    }
    await consultation.save();
   // console.log(`🔄 Consultation ${consultation._id} status updated to ${consultation.status}`);
     console.log(`🔄 Consultation ${consultation._id} status updated to ${consultation.status} by doctor ${req.doctor._id}`); 
   res.json(consultation);
  } catch (error) {
    console.error("❌ Error updating consultation status:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
