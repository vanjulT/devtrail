import express from "express";
import Deck from "../models/Deck.js";
import Document from "../models/Document.js";
import requireAuth from "../middleware/requireAuth.js";
import { generateFlashcards } from "../services/studyGenerator.js";

const router = express.Router();
router.use(requireAuth);

// Spaced repetition: how many days until a card comes back, for each box
const REVIEW_DAYS = [0, 1, 3, 7, 14];

function dueCount(deck) {
  const now = Date.now();
  return deck.cards.filter((card) => new Date(card.dueAt).getTime() <= now).length;
}

// POST /api/decks  Body: { documentId, topic? }
router.post("/", async (req, res) => {
  try {
    const { documentId, topic = "" } = req.body;
    const document = await Document.findOne({ _id: documentId, userId: req.userId, status: "ready" });
    if (!document) {
      return res.status(404).json({ message: "Choose one of your ready PDFs first." });
    }

    const result = await generateFlashcards({ userId: req.userId, documentId, topic: topic.trim() });
    const deck = await Deck.create({
      userId: req.userId,
      documentId,
      documentTitle: document.title,
      topic: topic.trim(),
      ...result,
    });
    res.status(201).json({ deck });
  } catch (error) {
    console.error("Flashcards failed:", error);
    res.status(500).json({ message: error.message || "Could not create the flashcards." });
  }
});

// GET /api/decks: the user's decks, with how many cards are due today
router.get("/", async (req, res) => {
  try {
    const decks = await Deck.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({
      decks: decks.map((deck) => ({
        _id: deck._id,
        title: deck.title,
        documentTitle: deck.documentTitle,
        topic: deck.topic,
        cardCount: deck.cards.length,
        dueCount: dueCount(deck),
        createdAt: deck.createdAt,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load your flashcards." });
  }
});

// GET /api/decks/:id
router.get("/:id", async (req, res) => {
  try {
    const deck = await Deck.findOne({ _id: req.params.id, userId: req.userId });
    if (!deck) return res.status(404).json({ message: "Deck not found." });
    res.json({ deck });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load this deck." });
  }
});

// POST /api/decks/:id/review  Body: { cardId, knew: true|false }
router.post("/:id/review", async (req, res) => {
  try {
    const { cardId, knew } = req.body;
    const deck = await Deck.findOne({ _id: req.params.id, userId: req.userId });
    if (!deck) return res.status(404).json({ message: "Deck not found." });

    const card = deck.cards.id(cardId);
    if (!card) return res.status(404).json({ message: "Card not found." });

    // Knew it: move up a box (comes back later). Didn't: back to box 0 (comes back today)
    card.box = knew ? Math.min(card.box + 1, REVIEW_DAYS.length - 1) : 0;
    card.dueAt = new Date(Date.now() + REVIEW_DAYS[card.box] * 24 * 60 * 60 * 1000);
    await deck.save();

    res.json({ card });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not save your answer." });
  }
});

// DELETE /api/decks/:id
router.delete("/:id", async (req, res) => {
  try {
    const result = await Deck.deleteOne({ _id: req.params.id, userId: req.userId });
    if (result.deletedCount === 0) return res.status(404).json({ message: "Deck not found." });
    res.json({ message: "Deck deleted." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not delete this deck." });
  }
});

export default router;