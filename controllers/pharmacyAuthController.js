// controllers/pharmacuAuthController.js
import jwt from "jsonwebtoken";
import Pharmacy from "../models/Pharmacy.js";

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// Register pharmacy
export const registerPharmacy = async (req, res) => {
  try {
    const { name, email, password, licenseNumber, address, phone } = req.body;

    const exists = await Pharmacy.findOne({ email });
    if (exists) return res.status(400).json({ message: "Pharmacy already exists" });

    const pharmacy = await Pharmacy.create({
      name,
      email,
      password,
      licenseNumber,
      address,
      phone,
    });

    res.status(201).json({
        message: "Pharmacy registered successfully",
      _id: pharmacy._id,
      name: pharmacy.name,
      email: pharmacy.email,
      token: generateToken(pharmacy._id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Login pharmacy
export const loginPharmacy = async (req, res) => {
  try {
    const { email, password } = req.body;
    const pharmacy = await Pharmacy.findOne({ email });

    if (pharmacy && (await pharmacy.matchPassword(password))) {
      res.json({
        _id: pharmacy._id,
        name: pharmacy.name,
        email: pharmacy.email,
        token: generateToken(pharmacy._id),
      });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
