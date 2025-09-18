// middleware/doctorAuthMiddleware.js
import jwt from "jsonwebtoken";
import Doctor from "../models/Doctor.js";

const protectDoctor = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.doctor = await Doctor.findById(decoded.id).select("-password");

      if (!req.doctor) {
        return res.status(404).json({ message: "Doctor not found" });
      }

      next();
    } catch (error) {
      console.error("Doctor Auth Error:", error);
      res.status(401).json({ message: "Not authorized, invalid token" });
    }
  }

  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

export default protectDoctor;



