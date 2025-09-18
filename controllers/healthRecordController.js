// backend/controllers/healthRecordController.js
import HealthRecord from "../models/HealthRecord.js";

export const getPatientRecords = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    console.log("🔍 Fetching records for userId:", userId);

    const records = await HealthRecord.find({ user: userId }) // ✅ fixed
      .sort({ createdAt: -1 })
      .lean();

    return res.json(records);
  } catch (err) {
    console.error("getPatientRecords:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getPatientRecordsCount = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    console.log("🔍 Counting records for userId:", userId);

    const count = await HealthRecord.countDocuments({ user: userId }); // ✅ fixed
    return res.json({ count });
  } catch (err) {
    console.error("getPatientRecordsCount:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getRecordById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user && req.user._id;

    console.log(`🔍 Fetching record ${id} for userId:`, userId);

    const record = await HealthRecord.findOne({ _id: id, user: userId }).lean(); // ✅ fixed
    if (!record) return res.status(404).json({ message: "Not found" });

    return res.json(record);
  } catch (err) {
    console.error("getRecordById:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

