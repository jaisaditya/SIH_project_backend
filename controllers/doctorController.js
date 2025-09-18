// backend/controllers/doctorController.js
import Doctor from "../models/Doctor.js";

export const getDoctors = async (req, res) => {
  try {
    const docs = await Doctor.find().select("-password").sort({ createdAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: "Error fetching doctors" });
  }
};

export const getDoctorById = async (req, res) => {
  try {
    const doc = await Doctor.findById(req.params.id).select("-password");
    if (!doc) return res.status(404).json({ message: "Doctor not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: "Error fetching doctor" });
  }
};


