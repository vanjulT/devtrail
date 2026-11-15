import mongoose from "mongoose";

// One thing to do on one day of the study plan, e.g. "Read chapter 2" on 2026-11-16 for 30 minutes
const studyTaskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // "YYYY-MM-DD", easy to sort and compare
    title: { type: String, required: true, trim: true },
    minutes: { type: Number, required: true, min: 5, max: 240 },
    type: { type: String, enum: ["read", "flashcards", "quiz", "review", "practice"], default: "read" },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null }, // the PDF it uses
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", default: null }, // a quiz to take that day
    done: { type: Boolean, default: false },
    createdBy: { type: String, enum: ["agent", "user"], default: "agent" },
  },
  { timestamps: true }
);

// Most searches are "this user's tasks between two dates"
studyTaskSchema.index({ userId: 1, date: 1 });

export default mongoose.model("StudyTask", studyTaskSchema);