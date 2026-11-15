import express from "express";
import mongoose from "mongoose";
import { z } from "zod";
import StudyTask from "../models/StudyTask.js";
import requireAuth from "../middleware/requireAuth.js";
import { addDays, countDueCards, newTaskSchema, onlyGiven, taskChangesSchema, toPlainTask } from "../services/agentTools.js";

const router = express.Router();
const DEFAULT_DAYS = 14;
const MAX_DAYS = 60;

router.use(requireAuth);

const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.coerce.number().int().min(1).max(MAX_DAYS).optional(),
});

function firstError(result) {
  return result.error.issues[0]?.message || "Some fields are not valid.";
}

// GET /api/tasks?from=YYYY-MM-DD&days=14 → the plan for those days, and how many flashcards are due
router.get("/", async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Use ?from=YYYY-MM-DD&days=14" });

  const from = parsed.data.from || new Date().toISOString().slice(0, 10);
  const days = parsed.data.days || DEFAULT_DAYS;
  try {
    const tasks = await StudyTask.find({
      userId: req.userId,
      date: { $gte: from, $lte: addDays(from, days - 1) },
    }).sort({ date: 1, createdAt: 1 });
    const dueCards = await countDueCards(req.userId);
    res.json({ tasks: tasks.map(toPlainTask), dueCards });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load your plan." });
  }
});

// POST /api/tasks  Body: { date, title, minutes, type } → add a task yourself
router.post("/", async (req, res) => {
  const parsed = newTaskSchema.pick({ date: true, title: true, minutes: true, type: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });

  try {
    const task = await StudyTask.create({ ...parsed.data, userId: req.userId, createdBy: "user" });
    res.status(201).json({ task: toPlainTask(task) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not add this task." });
  }
});

// PATCH /api/tasks/:id  Body: any of { date, title, minutes, done }
router.patch("/:id", async (req, res) => {
  const parsed = taskChangesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: firstError(parsed) });

  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Task not found." });
    const task = await StudyTask.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      onlyGiven(parsed.data),
      { returnDocument: "after", runValidators: true }
    );
    if (!task) return res.status(404).json({ message: "Task not found." });
    res.json({ task: toPlainTask(task) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not update this task." });
  }
});

// DELETE /api/tasks/:id
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Task not found." });
    const result = await StudyTask.deleteOne({ _id: req.params.id, userId: req.userId });
    if (result.deletedCount === 0) return res.status(404).json({ message: "Task not found." });
    res.json({ message: "Task deleted." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not delete this task." });
  }
});

export default router;