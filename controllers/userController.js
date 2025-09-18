// backend /controllers/userController.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Otp from "../models/Otp.js";
import { OAuth2Client } from "google-auth-library";
import twilio from "twilio";

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

/* ---------- REGISTER ---------- */
export const registerUser = async (req, res) => {
  try {
    const { full_name, email, password, phone, role, preferred_language, village } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const user = await User.create({
      full_name,
      email,
      password,
      phone,
      role,
      preferred_language,
      village,
    });

    res.status(201).json({
      _id: user._id,
      full_name: user.full_name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: "Error registering user", error: err.message });
  }
};

/* ---------- LOGIN (EMAIL/PASSWORD) ---------- */
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      return res.json({
        _id: user._id,
        full_name: user.full_name,
        email: user.email,
        token: generateToken(user._id),
      });
    }
    res.status(401).json({ message: "Invalid email or password" });
  } catch (err) {
    res.status(500).json({ message: "Error logging in", error: err.message });
  }
};

/* ---------- GOOGLE SIGN-IN ---------- */
export const googleSignIn = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: "idToken required" });

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const email = payload.email;
    const name = payload.name;
    const googleId = payload.sub;

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ full_name: name, email, googleId });
    } else if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }

    res.json({
      _id: user._id,
      full_name: user.full_name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: "Google sign-in failed", error: err.message });
  }
};

/* ---------- SEND OTP ---------- */
export const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone required" });

    const provider = process.env.OTP_PROVIDER || "mock";

    if (provider === "twilio") {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID)
        .verifications.create({ to: phone, channel: "sms" });

      return res.json({ message: "OTP sent via Twilio" });
    }

    // Mock OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    await Otp.findOneAndUpdate({ phone }, { code, expiresAt: expires }, { upsert: true });
    console.log(`[MOCK OTP] phone=${phone} code=${code}`);
    return res.json({ message: "OTP (mock) generated and logged to console" });
  } catch (err) {
    res.status(500).json({ message: "Error sending OTP", error: err.message });
  }
};

/* ---------- VERIFY OTP ---------- */
export const verifyOtp = async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ message: "Phone and code required" });

    const provider = process.env.OTP_PROVIDER || "mock";

    if (provider === "twilio") {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const verification = await client.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID)
        .verificationChecks.create({ to: phone, code });

      if (verification.status === "approved") {
        let user = await User.findOne({ phone });
        if (!user) user = await User.create({ full_name: `User ${phone}`, phone });
        return res.json({ token: generateToken(user._id), full_name: user.full_name, email: user.email });
      }
      return res.status(401).json({ message: "Invalid OTP" });
    }

    // Mock OTP
    const entry = await Otp.findOne({ phone });
    if (!entry) return res.status(400).json({ message: "No OTP requested for this number" });
    if (entry.expiresAt < new Date()) return res.status(400).json({ message: "OTP expired" });
    if (entry.code !== code) return res.status(401).json({ message: "Invalid OTP" });

    let user = await User.findOne({ phone });
    if (!user) user = await User.create({ full_name: `User ${phone}`, phone });

    await Otp.deleteOne({ phone }); // one-time use
    return res.json({ token: generateToken(user._id), full_name: user.full_name, email: user.email });
  } catch (err) {
    res.status(500).json({ message: "Error verifying OTP", error: err.message });
  }
};



