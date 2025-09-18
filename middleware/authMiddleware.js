// middleware//authMiddleware.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id).select('-password');

  
    // 🔍 Debug log here
    if (req.user) {
      console.log("✅ Logged in user:", req.user._id.toString(), req.user.email);
    } else {
      console.log("❌ No user found for token", decoded);
    }


    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Not authorized' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, error: 'Not authorized to access this route' });
    }
    next();
  };
};
