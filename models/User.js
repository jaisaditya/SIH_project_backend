// backend/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    full_name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    password: { type: String },

    // NEW: Google OAuth
    googleId: { type: String, unique: true, sparse: true },

    phone: { type: String, unique: true, sparse: true },
    role: { type: String, default: "patient" },
    preferred_language: { type: String },
    village: { type: String },
    medical_history: { type: [String], default: [] },
    allergies: { type: [String], default: [] },
  },
  { timestamps: true }
);

// hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// check password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;


