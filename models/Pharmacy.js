// backend/models/Pharmacy.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const pharmacySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    licenseNumber: { type: String, required: true, unique: true },
    address: { type: String },
    phone: { type: String },
  },
  { timestamps: true }
);

// Hash password before saving
pharmacySchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare passwords
pharmacySchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Pharmacy = mongoose.model("Pharmacy", pharmacySchema);
export default Pharmacy;



