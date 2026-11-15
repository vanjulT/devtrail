import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    code: { type: String, default: "" }, // optional code snippet ("what does this print?")
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true },
    explanation: { type: String, required: true },
    evidence: { type: String, default: "" }, // exact quote from the PDF that proves the answer
    page: Number,
  },
  { _id: false }
);

const attemptSchema = new mongoose.Schema(
  {
    answers: [Number], // the option the user picked for each question
    score: Number,
    total: Number,
  },
  { timestamps: true }
);

const quizSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true },
    documentTitle: String,
    title: { type: String, required: true },
    topic: { type: String, default: "" },
    questions: { type: [questionSchema], default: [] },
    attempts: { type: [attemptSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("Quiz", quizSchema);