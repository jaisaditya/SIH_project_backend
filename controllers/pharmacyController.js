import Pharmacy from "../models/Pharmacy.js";

// ✅ Get logged-in pharmacy profile
export const getMyProfile = async (req, res) => {
  try {
    console.log("🟢 Inside getMyProfile, req.pharmacy:", req.pharmacy); // DEBUG

    if (!req.pharmacy || !req.pharmacy._id) {
      console.error("🔴 No pharmacy info on req.pharmacy");
      return res.status(401).json({ message: "Not authorized, pharmacy not found in request" });
    }

    const pharmacy = await Pharmacy.findById(req.pharmacy._id).select("-password");
    console.log("🟢 Pharmacy fetched from DB:", pharmacy); // DEBUG

    if (!pharmacy) {
      console.error("🔴 Pharmacy not found in DB for ID:", req.pharmacy._id);
      return res.status(404).json({ message: "Pharmacy not found" });
    }

    res.json(pharmacy);
  } catch (err) {
    console.error("🔴 Error in getMyProfile:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Update logged-in pharmacy profile
export const updateMyProfile = async (req, res) => {
  try {
    console.log("🟢 Inside updateMyProfile, req.pharmacy:", req.pharmacy); // DEBUG
    console.log("🟢 Update payload:", req.body); // DEBUG

    if (!req.pharmacy || !req.pharmacy._id) {
      console.error("🔴 No pharmacy info on req.pharmacy");
      return res.status(401).json({ message: "Not authorized, pharmacy not found in request" });
    }

    const updates = req.body;
    const pharmacy = await Pharmacy.findByIdAndUpdate(req.pharmacy._id, updates, { new: true })
      .select("-password");

    console.log("🟢 Updated pharmacy:", pharmacy); // DEBUG

    if (!pharmacy) {
      console.error("🔴 Pharmacy not found in DB for ID:", req.pharmacy._id);
      return res.status(404).json({ message: "Pharmacy not found" });
    }

    res.json(pharmacy);
  } catch (err) {
    console.error("🔴 Error in updateMyProfile:", err.message);
    res.status(400).json({ message: err.message });
  }
};

// ✅ Upload bills (later)
export const uploadBill = async (req, res) => {
  try {
    console.log("🟢 Inside uploadBill, req.file:", req.file); // DEBUG
    res.json({ message: "Bill uploaded successfully", file: req.file });
  } catch (err) {
    console.error("🔴 Error in uploadBill:", err.message);
    res.status(500).json({ message: err.message });
  }
};

