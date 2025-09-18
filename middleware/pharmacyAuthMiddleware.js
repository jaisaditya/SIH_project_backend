// backend/middlewares/pharmacyAuthMiddleware.js
import jwt from "jsonwebtoken";
import Pharmacy from "../models/Pharmacy.js";

export const protectPharmacy = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      console.log("🟢 Received token:", token);  // DEBUG

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("🟢 Decoded token payload:", decoded);  // DEBUG

      req.pharmacy = await Pharmacy.findById(decoded.id).select("-password");
      console.log("🟢 Pharmacy from DB:", req.pharmacy);  // DEBUG

      if (!req.pharmacy) {
        console.error("🔴 No pharmacy found for this token ID:", decoded.id);
        return res.status(404).json({ message: "Pharmacy not found" });
      }

      next();
    } catch (err) {
      console.error("🔴 Token verification error:", err.message);  // DEBUG
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    console.warn("⚠️ No token provided in Authorization header");
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

