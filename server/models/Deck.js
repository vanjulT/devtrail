import mongoose from "mongoose";

const cardSchema = new mongoose.Schema(
  {
    front: { type: String, required: true }, // the question or term
    back: { type: String, required: true }, // the answer
    evidence: { type: String, default: "" }, // exact quote from the PDF that proves the answer
    page: Number, // where it comes from in the PDF
    box: { type: Number, default: 0 }, // spaced repetition: 0 = new or forgotten, 4 = well known
    dueAt: { type: Date, default: Date.now }, // when to show this card again
  },
  { _id: true }
);

const deckSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true },
    documentTitle: String,
    title: { type: String, required: true },
    topic: { type: String, default: "" },
    cards: { type: [cardSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("Deck", deckSchema);