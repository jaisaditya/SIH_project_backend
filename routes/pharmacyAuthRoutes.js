import express from "express";
import { registerPharmacy, loginPharmacy } from "../controllers/pharmacyAuthController.js";
import { protectPharmacy } from "../middleware/pharmacyAuthMiddleware.js";
import { getMyProfile, updateMyProfile } from "../controllers/pharmacyController.js";

const router = express.Router();

router.post("/register", registerPharmacy);
router.post("/login", loginPharmacy);

// Protected pharmacy routes
router.get("/me", protectPharmacy, getMyProfile);
router.put("/me", protectPharmacy, updateMyProfile);

export default router;

