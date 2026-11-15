import express from "express";
import mongoose from "mongoose";
import { streamText } from "ai";
import { groq } from "@ai-sdk/groq";
import Chat from "../models/Chat.js";
import Document from "../models/Document.js";
import requireAuth from "../middleware/requireAuth.js";
import { findSources, buildSystemPrompt } from "../services/rag.js";

const router = express.Router();
// The model name lives in .env, so a retired model can be swapped without changing code
const model = groq(process.env.GROQ_MODEL || "openai/gpt-oss-120b");
const HISTORY_LENGTH = 6; // the AI also sees the last 6 messages, for follow-up questions
const MAX_QUESTION_LENGTH = 2000;

router.use(requireAuth);

// GET /api/chats: the user's chats, newest first (without the messages)
router.get("/", async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.userId })
      .select("title documentId updatedAt")
      .sort({ updatedAt: -1 });
    res.json({ chats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load your chats." });
  }
});

// GET /api/chats/:id: one chat with all its messages
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Chat not found." });
    }
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.userId });
    if (!chat) {
      return res.status(404).json({ message: "Chat not found." });
    }
    res.json({ chat });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load this chat." });
  }
});

// DELETE /api/chats/:id
router.delete("/:id", async (req, res) => {
  try {
    const result = await Chat.deleteOne({ _id: req.params.id, userId: req.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Chat not found." });
    }
    res.json({ message: "Chat deleted." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not delete this chat." });
  }
});

// POST /api/chats/message: ask a question, get a streamed answer
// Body: { message, chatId? (continue a chat), documentId? (only search this PDF) }
router.post("/message", async (req, res) => {
  const { message, chatId, documentId } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ message: "Please type a question." });
  }
  if (message.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({ message: `Questions can be at most ${MAX_QUESTION_LENGTH} characters.` });
  }

  try {
    // 1. Find the chat, or start a new one
    let chat;
    if (chatId) {
      chat = await Chat.findOne({ _id: chatId, userId: req.userId });
      if (!chat) return res.status(404).json({ message: "Chat not found." });
    } else {
      if (documentId) {
        const document = await Document.findOne({ _id: documentId, userId: req.userId, status: "ready" });
        if (!document) return res.status(404).json({ message: "This PDF was not found or is not ready." });
      }
      chat = new Chat({
        userId: req.userId,
        documentId: documentId || null,
        title: message.trim().slice(0, 60),
      });
    }

    // 2. Find the closest pieces in this user's PDFs
    const sources = await findSources({
      userId: req.userId,
      question: message,
      documentId: chat.documentId,
    });

    // 3. Ask the AI, with the sources and the last few messages
    const history = chat.messages.slice(-HISTORY_LENGTH).map((m) => ({ role: m.role, content: m.content }));
    let aiError = null;
    const result = streamText({
      model,
      system: buildSystemPrompt(sources),
      messages: [...history, { role: "user", content: message }],
      onError: ({ error }) => {
        aiError = error; // the stream does not throw by itself, so we remember the error
      },
    });

    // 4. Send the chat id and the sources first (in headers), then the answer word by word
    chat.messages.push({ role: "user", content: message });
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("X-Chat-Id", String(chat._id));
    res.setHeader("X-Sources", encodeURIComponent(JSON.stringify(sources)));

    let answer = "";
    for await (const piece of result.textStream) {
      answer += piece;
      res.write(piece);
    }

    if (aiError) throw aiError;
    if (!answer.trim()) throw new Error("The AI returned an empty answer.");

    // 5. Save the full answer once it is finished
    chat.messages.push({ role: "assistant", content: answer, sources });
    await chat.save();
    res.end();
  } catch (error) {
    console.error("Chat failed:", error);
    if (!res.headersSent) {
      return res.status(500).json({ message: "The AI could not answer right now. Please try again." });
    }
    res.write("\n\n[The answer was cut off because of an error. Please try again.]");
    res.end();
  }
});

export default router;