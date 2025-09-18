// backend/middleware/anyAuthMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Doctor from "../models/Doctor.js";

/**
 * Accept either a user token or a doctor token.
 * If it's a user -> set req.user
 * If it's a doctor -> set req.doctor
 */
const anyAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // try find User first
    let user = await User.findById(decoded.id).select("-password");
    if (user) {
      req.user = user;
      return next();
    }
    // try doctor
    const doctor = await Doctor.findById(decoded.id).select("-password");
    if (doctor) {
      req.doctor = doctor;
      return next();
    }

    return res.status(401).json({ message: "Not authorized" });
  } catch (err) {
    console.error("anyAuth error:", err);
    return res.status(401).json({ message: "Not authorized, invalid token" });
  }
};

export default anyAuth;
