// backend/routes/pharmacyRoutes.js
import express from "express";
import Pharmacy from "../models/Pharmacy.js";
import multer from "multer";
import path from "path";

const router = express.Router();

// 📂 Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");  // make sure /uploads exists
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // unique filename
  },
});

const upload = multer({ storage });

// 📤 Upload Bill API
router.post("/upload-bill", upload.single("billFile"), async (req, res) => {
  try {
    const { pharmacyId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Create bill entry
    const newBill = {
      pharmacy: pharmacyId,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      status: "Uploaded",
      createdAt: new Date(),
    };

    // for now, just return
    res.status(201).json(newBill);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Get pharmacy profile
router.get("/:id", async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    res.json(pharmacy);
  } catch (err) {
    res.status(500).json({ message: "Error fetching pharmacy", error: err.message });
  }
});

 export default router;
