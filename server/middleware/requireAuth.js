import jwt from "jsonwebtoken";

// Runs before private routes. If the token is valid, we know who the user is.
export default function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Please log in first." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId; // every later route uses this to keep data per user
    next();
  } catch (error) {
    return res.status(401).json({ message: "Your session is invalid or has expired. Please log in again." });
  }
}