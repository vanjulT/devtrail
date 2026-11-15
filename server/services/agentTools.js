import mongoose from "mongoose";
import { tool } from "ai";
import { z } from "zod";
import StudyTask from "../models/StudyTask.js";
import Document from "../models/Document.js";
import Deck from "../models/Deck.js";
import Quiz from "../models/Quiz.js";
import { generateQuiz } from "./studyGenerator.js";

export const TASK_TYPES = ["read", "flashcards", "quiz", "review", "practice"];
const MAX_TASKS_PER_CALL = 30;
const MAX_DAYS = 60;

// ---------- Small helpers (also used by routes/tasks.js) ----------

// A date like "2026-11-15" that really exists
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD.")
  .refine((value) => {
    const day = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value; // "2026-02-31" is refused
  }, "This date does not exist.");

// "2026-11-15" + 3 days = "2026-11-18"
export function addDays(date, days) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

// What the AI and the browser get for each task
export function toPlainTask(task) {
  return {
    id: String(task._id),
    date: task.date,
    title: task.title,
    minutes: task.minutes,
    type: task.type,
    done: task.done,
    documentId: task.documentId ? String(task.documentId) : null,
    quizId: task.quizId ? String(task.quizId) : null,
    createdBy: task.createdBy,
  };
}

// How many flashcards are waiting for review (due now or earlier)
export async function countDueCards(userId) {
  const decks = await Deck.find({ userId }).select("cards.dueAt");
  const now = new Date();
  return decks.reduce((sum, deck) => sum + deck.cards.filter((card) => card.dueAt <= now).length, 0);
}

// The fields of a new task (the AI sends these, and so does the "add a task" form)
export const newTaskSchema = z.object({
  date: dateSchema.describe("Day of the task, YYYY-MM-DD"),
  title: z.string().trim().min(3).max(120).describe("What to do, e.g. 'Read chapter 2 of React Basics: hooks'"),
  minutes: z.number().int().min(5).max(240).describe("How long it takes, in minutes"),
  type: z.enum(TASK_TYPES).describe("read, flashcards, quiz, review or practice"),
  documentId: z.string().nullish().describe("Id of the PDF this task uses (from list_documents), if any"),
  quizId: z.string().nullish().describe("Id of a quiz made with create_quiz, if this is a quiz task"),
});

// What can be changed on an existing task
export const taskChangesSchema = z.object({
  date: dateSchema.nullish().describe("New day, YYYY-MM-DD"),
  title: z.string().trim().min(3).max(120).nullish(),
  minutes: z.number().int().min(5).max(240).nullish(),
  done: z.boolean().nullish().describe("true when the user finished the task"),
});

// Keeps only the fields that were really sent (the AI sometimes sends null for "no change")
export function onlyGiven(changes) {
  return Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== null && value !== undefined));
}

// These throw clear errors: the AI reads them and can fix its next call
async function findOwnDocument(userId, documentId) {
  if (!mongoose.isValidObjectId(documentId)) {
    throw new Error(`"${documentId}" is not a document id. Call list_documents to get the real ids.`);
  }
  const document = await Document.findOne({ _id: documentId, userId, status: "ready" });
  if (!document) throw new Error(`No ready PDF with id ${documentId}. Call list_documents to get the real ids.`);
  return document;
}

async function findOwnTask(userId, taskId) {
  if (!mongoose.isValidObjectId(taskId)) {
    throw new Error(`"${taskId}" is not a task id. Call get_schedule to get the real ids.`);
  }
  const task = await StudyTask.findOne({ _id: taskId, userId });
  if (!task) throw new Error(`No task with id ${taskId}. Call get_schedule to get the real ids.`);
  return task;
}

// ---------- The tools the study coach can use ----------
// Each tool returns a "summary" sentence: the chat shows it under the tool name.

export function createAgentTools(userId) {
  return {
    list_documents: tool({
      description: "List the user's PDFs that are ready to study (id, title, number of pages).",
      inputSchema: z.object({}),
      execute: async () => {
        const documents = await Document.find({ userId, status: "ready" }).select("title pageCount").sort({ createdAt: -1 });
        return {
          documents: documents.map((doc) => ({ id: String(doc._id), title: doc.title, pages: doc.pageCount })),
          summary: documents.length ? `${documents.length} PDF(s): ${documents.map((d) => d.title).join(", ")}` : "No PDFs yet",
        };
      },
    }),

    get_schedule: tool({
      description:
        "Get the study tasks already planned between two dates (with their ids), and how many flashcards are due for review.",
      inputSchema: z.object({
        from: dateSchema.describe("First day, YYYY-MM-DD"),
        days: z.number().int().min(1).max(MAX_DAYS).describe("How many days to look at, from the first day"),
      }),
      execute: async ({ from, days }) => {
        const to = addDays(from, days - 1);
        const tasks = await StudyTask.find({ userId, date: { $gte: from, $lte: to } }).sort({ date: 1, createdAt: 1 });
        const dueCards = await countDueCards(userId);
        return {
          // Only what the coach needs (short results = fewer tokens = no free-plan limit errors)
          tasks: tasks.map((task) => ({ id: String(task._id), date: task.date, title: task.title, minutes: task.minutes, done: task.done })),
          dueCards,
          summary: `${tasks.length} task(s) planned from ${from} to ${to}, ${dueCards} flashcard(s) due`,
        };
      },
    }),

    create_study_tasks: tool({
      description: `Add one or more tasks to the study plan (at most ${MAX_TASKS_PER_CALL} per call).`,
      inputSchema: z.object({
        tasks: z.array(newTaskSchema).min(1).max(MAX_TASKS_PER_CALL),
      }),
      execute: async ({ tasks }) => {
        // Check every PDF and quiz belongs to this user before saving anything
        for (const task of tasks) {
          if (task.documentId) await findOwnDocument(userId, task.documentId);
          if (task.quizId) {
            const quiz = mongoose.isValidObjectId(task.quizId) && (await Quiz.exists({ _id: task.quizId, userId }));
            if (!quiz) throw new Error(`No quiz with id ${task.quizId}. Use the quizId returned by create_quiz.`);
          }
        }
        const saved = await StudyTask.insertMany(
          tasks.map((task) => ({ ...onlyGiven(task), userId, createdBy: "agent" }))
        );
        const dates = saved.map((task) => task.date).sort();
        return {
          count: saved.length,
          summary: `Created ${saved.length} task(s), ${dates[0]} to ${dates[dates.length - 1]}`,
        };
      },
    }),

    update_study_task: tool({
      description: "Change one task: move it to another day, rename it, change its minutes, or mark it done or not done.",
      inputSchema: taskChangesSchema.extend({
        taskId: z.string().describe("Id of the task, from get_schedule"),
      }),
      execute: async ({ taskId, ...changes }) => {
        const task = await findOwnTask(userId, taskId);
        const given = onlyGiven(changes);
        if (Object.keys(given).length === 0) throw new Error("Send at least one change: date, title, minutes or done.");
        Object.assign(task, given);
        await task.save();
        return { summary: `Updated "${task.title}" (${task.date})` };
      },
    }),

    delete_study_task: tool({
      description: "Remove one task from the study plan.",
      inputSchema: z.object({ taskId: z.string().describe("Id of the task, from get_schedule") }),
      execute: async ({ taskId }) => {
        const task = await findOwnTask(userId, taskId);
        await task.deleteOne();
        return { summary: `Removed "${task.title}" (${task.date})` };
      },
    }),

    create_quiz: tool({
      description:
        "Make a real 5-question quiz from one PDF (takes about 10 seconds). Returns a quizId you can attach to a quiz task.",
      inputSchema: z.object({
        documentId: z.string().describe("Id of the PDF, from list_documents"),
        topic: z.string().max(100).nullish().describe("Optional topic to focus on, e.g. 'React hooks'"),
      }),
      execute: async ({ documentId, topic }) => {
        const document = await findOwnDocument(userId, documentId);
        const cleanTopic = (topic || "").trim();
        const result = await generateQuiz({ userId, documentId, topic: cleanTopic });
        const quiz = await Quiz.create({
          userId,
          documentId,
          documentTitle: document.title,
          topic: cleanTopic,
          ...result,
        });
        return {
          quizId: String(quiz._id),
          title: quiz.title,
          summary: `Made the quiz "${quiz.title}" (${quiz.questions.length} questions)`,
        };
      },
    }),
  };
}