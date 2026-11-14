import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import documentRoutes from "./routes/documents.js";

const app = express();
const PORT = process.env.PORT || 5001;

// Only our React app is allowed to call this API
app.use(cors({ origin: process.env.CLIENT_URL }));

// Lets the server read JSON sent in requests
app.use(express.json());

// Test address: if this answers, the server is running
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);

// Connect to MongoDB first, then start the server
async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Could not connect to MongoDB:", error.message);
    process.exit(1);
  }
}

start();