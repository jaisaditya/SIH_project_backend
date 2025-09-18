// backend/routes/recordRoutes.js
import express from "express";
import {
  getPatientRecords,
  getPatientRecordsCount,
  getRecordById,
} from "../controllers/healthRecordController.js";
import { protect } from "../middleware/authMiddleware.js"; // ✅ use named import

const router = express.Router();

// Use protect middleware for authentication
router.get("/", protect, getPatientRecords);
router.get("/count", protect, getPatientRecordsCount);
router.get("/:id", protect, getRecordById);

export default router;
