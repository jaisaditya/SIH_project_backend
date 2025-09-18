//controllers/authController.js
import User from "../models/User.js";
import Otp from "../models/Otp.js";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import twilio from "twilio";

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

/* USER REGISTER */
export const registerUser = async (req, res) => {
  try {
    const { full_name, email, password, phone } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ message: "Name, email and password required" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const user = await User.create({ full_name, email, password, phone });
    res.status(201).json({
      _id: user._id,
      name: user.full_name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: "Error registering user", error: err.message });
  }
};

/* USER LOGIN */
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && (await user.matchPassword(password))) {
      return res.json({
        _id: user._id,
        name: user.full_name,
        email: user.email,
        token: generateToken(user._id),
      });
    }
    res.status(401).json({ message: "Invalid credentials" });
  } catch (err) {
    res.status(500).json({ message: "Error logging in", error: err.message });
  }
};

/* GOOGLE SIGN-IN */
export const googleSignInUser = async (req, res) => {
  try {
    const { idToken } = req.body;
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const email = payload.email;
    const googleId = payload.sub;
    const name = payload.name;

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ full_name: name, email, googleId });
    } else if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }

    res.json({
      _id: user._id,
      name: user.full_name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: "Google sign-in failed", error: err.message });
  }
};

/* SEND OTP for User */
export const sendOtpUser = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone required" });

    const provider = process.env.OTP_PROVIDER || "mock";

    if (provider === "twilio") {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
      const client = twilio(accountSid, authToken);

      if (!serviceSid)
        return res.status(500).json({ message: "TWILIO_VERIFY_SERVICE_SID not configured" });

      await client.verify
        .services(serviceSid)
        .verifications.create({ to: phone, channel: "sms" });
      return res.json({ message: "OTP sent via Twilio Verify" });
    }

    // Mock provider: generate code, store in DB
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 min
    await Otp.findOneAndUpdate(
      { phone },
      { code, expiresAt: expires },
      { upsert: true }
    );

    console.log(`[MOCK OTP] phone=${phone} code=${code} (expires in 5m)`);

    return res.json({ message: "OTP (mock) generated and logged to console" });
  } catch (err) {
    res.status(500).json({ message: "Error sending OTP", error: err.message });
  }
};


/* VERIFY OTP for User */
export const verifyOtpUser = async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ message: "Phone and code required" });

    const provider = process.env.OTP_PROVIDER || "mock";

    if (provider === "twilio") {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
      const client = twilio(accountSid, authToken);

      const verification = await client.verify
        .services(serviceSid)
        .verificationChecks.create({ to: phone, code });

      if (verification.status === "approved") {
        let user = await User.findOne({ phone });
        if (!user) {
          user = await User.create({ full_name: `User ${phone}`, phone });
        }
        return res.json({
          token: generateToken(user._id),
          name: user.full_name,
          email: user.email,
        });
      }
      return res.status(401).json({ message: "Invalid OTP" });
    }

    // Mock provider: check DB entry
    const entry = await Otp.findOne({ phone });
    if (!entry) return res.status(400).json({ message: "No OTP requested for this number" });
    if (entry.expiresAt < new Date()) return res.status(400).json({ message: "OTP expired" });
    if (entry.code !== code) return res.status(401).json({ message: "Invalid OTP" });

    let user = await User.findOne({ phone });
    if (!user) user = await User.create({ full_name: `User ${phone}`, phone });

    await Otp.deleteOne({ phone });

    return res.json({
      token: generateToken(user._id),
      name: user.full_name,
      email: user.email,
    });
  } catch (err) {
    res.status(500).json({ message: "Error verifying OTP", error: err.message });
  }
};
