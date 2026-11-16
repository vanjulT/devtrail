import express from "express";
import multer from "multer";
import Document from "../models/Document.js";
import requireAuth from "../middleware/requireAuth.js";
import { readPdfPages, chunkPages } from "../services/pdf.js";
import { embedChunks } from "../services/embeddings.js";
import { saveChunks, deleteChunks } from "../services/vectorStore.js";

const router = express.Router();
const MAX_SIZE_MB = 25;
const MAX_CHUNKS = 1500; // about 600 pages of text: protects the free AI limits and the 512 MB server

// Keep the file in memory (we only need its text), only PDFs, max 25 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed."));
    }
    cb(null, true);
  },
});

// Runs multer and turns its errors into clear messages
function receivePdf(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (error?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: `The file is too big. The limit is ${MAX_SIZE_MB} MB.` });
    }
    if (error) {
      return res.status(400).json({ message: error.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Please choose a PDF file." });
    }
    next();
  });
}

// Every route below needs a logged-in user
router.use(requireAuth);

// GET /api/documents: the user's library
router.get("/", async (req, res) => {
  try {
    const documents = await Document.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ documents });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load your library." });
  }
});

// POST /api/documents: upload one PDF
router.post("/", receivePdf, async (req, res) => {
  const title = req.file.originalname.replace(/\.pdf$/i, "");
  const document = await Document.create({
    userId: req.userId,
    title,
    originalName: req.file.originalname,
    sizeBytes: req.file.size,
  });

  try {
    const { totalPages, pages } = await readPdfPages(req.file.buffer);
    const chunks = chunkPages(pages);

    if (chunks.length === 0) {
      throw new Error("No text found in this PDF. Is it a scanned image?");
    }
    if (chunks.length > MAX_CHUNKS) {
      throw new Error(
        `This PDF has too much text (${totalPages} pages). The limit is about 600 pages: split it into smaller PDFs and upload them one by one.`
      );
    }

    const embeddings = await embedChunks(chunks.map((chunk) => chunk.text));
    await saveChunks({ userId: req.userId, documentId: document._id, title, chunks, embeddings });

    document.pageCount = totalPages;
    document.chunkCount = chunks.length;
    document.status = "ready";
    await document.save();

    res.status(201).json({ document });
  } catch (error) {
    console.error("Upload failed:", error);
    document.status = "failed";
    document.errorMessage = error.message;
    await document.save();
    res.status(500).json({ message: `Could not process the PDF: ${error.message}`, document });
  }
});

// DELETE /api/documents/:id: remove a PDF and its pieces
router.delete("/:id", async (req, res) => {
  try {
    // Search by id AND owner, so nobody can delete someone else's PDF
    const document = await Document.findOne({ _id: req.params.id, userId: req.userId });
    if (!document) {
      return res.status(404).json({ message: "Document not found." });
    }

    await deleteChunks({ userId: req.userId, documentId: document._id, chunkCount: document.chunkCount });
    await document.deleteOne();
    res.json({ message: "Document deleted." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not delete the document." });
  }
});

export default router;