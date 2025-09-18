// backend/models/Doctor.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const DoctorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  password: { type: String },
  specialization: { type: String, required: false },
  phone: { type: String },
  hospital: { type: String },
  experience: { type: Number, default: 0 },
  googleId: { type: String, index: true, sparse: true },
}, { timestamps: true });

// Hash password if set / modified
DoctorSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  if (!this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

DoctorSchema.methods.matchPassword = async function(entered) {
  if (!this.password) return false;
  return await bcrypt.compare(entered, this.password);
};

export default mongoose.model("Doctor", DoctorSchema);

