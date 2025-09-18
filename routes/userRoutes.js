// backend/routes/userRoutes.js
import express from "express";
import {
  registerUser,
  loginUser,
  googleSignInUser,
  sendOtpUser,
  verifyOtpUser,
} from "../controllers/authController.js";

const router = express.Router();

// User Auth
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/auth/google", googleSignInUser);
router.post("/auth/send-otp", sendOtpUser);
router.post("/auth/verify-otp", verifyOtpUser);

export default router;
