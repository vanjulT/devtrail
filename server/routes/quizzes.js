import express from "express";
import Quiz from "../models/Quiz.js";
import Document from "../models/Document.js";
import requireAuth from "../middleware/requireAuth.js";
import { generateQuiz } from "../services/studyGenerator.js";

const router = express.Router();
router.use(requireAuth);

// What the browser gets while you take the quiz: no correct answers, no explanations
function withoutAnswers(quiz) {
  return {
    _id: quiz._id,
    title: quiz.title,
    documentTitle: quiz.documentTitle,
    topic: quiz.topic,
    questions: quiz.questions.map((q) => ({ question: q.question, code: q.code, options: q.options, page: q.page })),
    attempts: quiz.attempts.map((a) => ({ score: a.score, total: a.total, createdAt: a.createdAt })),
    createdAt: quiz.createdAt,
  };
}

// POST /api/quizzes  Body: { documentId, topic? }
router.post("/", async (req, res) => {
  try {
    const { documentId, topic = "" } = req.body;
    const document = await Document.findOne({ _id: documentId, userId: req.userId, status: "ready" });
    if (!document) {
      return res.status(404).json({ message: "Choose one of your ready PDFs first." });
    }

    const result = await generateQuiz({ userId: req.userId, documentId, topic: topic.trim() });
    const quiz = await Quiz.create({
      userId: req.userId,
      documentId,
      documentTitle: document.title,
      topic: topic.trim(),
      ...result,
    });
    res.status(201).json({ quiz: withoutAnswers(quiz) });
  } catch (error) {
    console.error("Quiz failed:", error);
    res.status(500).json({ message: error.message || "Could not create the quiz." });
  }
});

// GET /api/quizzes: the user's quizzes with their best and last scores
router.get("/", async (req, res) => {
  try {
    const quizzes = await Quiz.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({
      quizzes: quizzes.map((quiz) => {
        const scores = quiz.attempts.map((a) => a.score);
        return {
          _id: quiz._id,
          title: quiz.title,
          documentTitle: quiz.documentTitle,
          questionCount: quiz.questions.length,
          attemptCount: quiz.attempts.length,
          bestScore: scores.length ? Math.max(...scores) : null,
          lastScore: scores.length ? scores[scores.length - 1] : null,
          createdAt: quiz.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load your quizzes." });
  }
});

// GET /api/quizzes/:id
router.get("/:id", async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, userId: req.userId });
    if (!quiz) return res.status(404).json({ message: "Quiz not found." });
    res.json({ quiz: withoutAnswers(quiz) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load this quiz." });
  }
});

// POST /api/quizzes/:id/attempts  Body: { answers: [0, 2, 1, 3, 0] }
// The server checks the answers, saves the score and only now sends the corrections
router.post("/:id/attempts", async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, userId: req.userId });
    if (!quiz) return res.status(404).json({ message: "Quiz not found." });

    const { answers } = req.body;
    if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
      return res.status(400).json({ message: "Please answer every question." });
    }

    const results = quiz.questions.map((q, i) => ({
      chosen: answers[i],
      correctIndex: q.correctIndex,
      isCorrect: answers[i] === q.correctIndex,
      explanation: q.explanation,
      evidence: q.evidence,
      page: q.page,
    }));
    const score = results.filter((r) => r.isCorrect).length;

    quiz.attempts.push({ answers, score, total: quiz.questions.length });
    await quiz.save();

    res.status(201).json({ score, total: quiz.questions.length, results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not save your answers." });
  }
});

// DELETE /api/quizzes/:id
router.delete("/:id", async (req, res) => {
  try {
    const result = await Quiz.deleteOne({ _id: req.params.id, userId: req.userId });
    if (result.deletedCount === 0) return res.status(404).json({ message: "Quiz not found." });
    res.json({ message: "Quiz deleted." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not delete this quiz." });
  }
});

export default router;