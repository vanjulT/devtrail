import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import rateLimit from "./middleware/rateLimit.js";
import authRoutes from "./routes/auth.js";
import documentRoutes from "./routes/documents.js";
import chatRoutes from "./routes/chats.js";
import deckRoutes from "./routes/decks.js";
import quizRoutes from "./routes/quizzes.js";
import voiceRoutes from "./routes/voice.js";
import agentRoutes from "./routes/agent.js";
import taskRoutes from "./routes/tasks.js";

const app = express();
const PORT = process.env.PORT || 5001;

// Online (Render) our server sits behind a proxy: this lets req.ip be the visitor's real address
app.set("trust proxy", 1);

// Only our React app is allowed to call this API.
// exposedHeaders lets the browser read the chat id and the sources we send with each answer.
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    exposedHeaders: ["X-Chat-Id", "X-Sources"],
  })
);

// Lets the server read JSON sent in requests
app.use(express.json());

// Speed limits (per visitor). Reading lists is free; only the expensive actions are counted.
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: "Too many login attempts." });
const uploadLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, message: "Too many uploads." });
// One shared AI budget: a voice question uses 4 requests (transcribe, answer, 2 voice parts)
const aiLimit = rateLimit({ windowMs: 60 * 1000, max: 20, message: "Too many AI requests." });

app.post(["/api/auth/login", "/api/auth/register"], loginLimit);
app.post("/api/documents", uploadLimit);
app.post(
  ["/api/chats/message", "/api/agent", "/api/decks", "/api/quizzes", "/api/voice/transcribe", "/api/voice/speak"],
  aiLimit
);

// Test address: if this answers, the server is running
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/decks", deckRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/tasks", taskRoutes);

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