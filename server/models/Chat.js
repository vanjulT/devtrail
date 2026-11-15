import mongoose from "mongoose";

const sourceSchema = new mongoose.Schema(
  {
    number: Number, // the [1], [2]… used in the answer
    documentId: String,
    title: String,
    page: Number,
    text: String, // the piece of the PDF the answer used
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    sources: { type: [sourceSchema], default: [] },
  },
  { timestamps: true }
);

const chatSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // One PDF, or null = search in all of the user's PDFs
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null },
    title: { type: String, default: "New chat" },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("Chat", chatSchema);