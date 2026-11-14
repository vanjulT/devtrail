import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    // Whose PDF this is: every search is limited to the owner
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    originalName: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    pageCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    // processing → ready, or failed with an error message
    status: { type: String, enum: ["processing", "ready", "failed"], default: "processing" },
    errorMessage: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Document", documentSchema);