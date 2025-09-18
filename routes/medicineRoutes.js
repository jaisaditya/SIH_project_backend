// backend/routes/medicineRoutes.js
import express from "express";
import Medicine from "../models/Medicine.js";

const router = express.Router();

// ✅ Get all medicines (with filters)
router.get("/", async (req, res) => {
  try {
    const { search, category, form, available } = req.query;
    let filter = {};

    // 🔍 Search by name or genericName (case-insensitive)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { genericName: { $regex: search, $options: "i" } }
      ];
    }

    if (category) filter.category = category;
    if (form) filter.form = form;
    if (available === "true") filter.quantity = { $gt: 0 };

    const medicines = await Medicine.find(filter);
    res.json(medicines);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Add new medicine
router.post("/", async (req, res) => {
  try {
    const medicine = await Medicine.create(req.body);
    res.status(201).json(medicine);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ✅ Update medicine
router.put("/:id", async (req, res) => {
  try {
    const updated = await Medicine.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ✅ Delete medicine
router.delete("/:id", async (req, res) => {
  try {
    await Medicine.findByIdAndDelete(req.params.id);
    res.json({ message: "Medicine deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
