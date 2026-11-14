import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

// Makes a login token that lasts 7 days
function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// Only send safe fields to the browser (never the password)
function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email };
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please fill in name, email and password." });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "The password needs at least 8 characters." });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });

    res.status(201).json({ token: createToken(user._id), user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not create the account. Please try again." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please fill in email and password." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    const passwordOk = user && (await bcrypt.compare(password, user.password));

    // Same message for both cases, so nobody can guess which emails exist
    if (!passwordOk) {
      return res.status(401).json({ message: "Wrong email or password." });
    }

    res.json({ token: createToken(user._id), user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not log in. Please try again." });
  }
});

// GET /api/auth/me  (private: needs a token)
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load your account." });
  }
});

export default router;