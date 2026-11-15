import express from "express";
import multer from "multer";
import { generateSpeech, experimental_transcribe as transcribe } from "ai";
import { groq } from "@ai-sdk/groq";
import { google } from "@ai-sdk/google";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();
const MAX_SIZE_MB = 10; // about 5 minutes of speech, far more than one question
const MAX_SPEECH_CHARACTERS = 2000; // long answers are cut, so the voice starts quickly

// Speech to text: Whisper on Groq
const transcriptionModel = groq.transcription(process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo");

// Text to speech: Gemini's natural voices ("Kore" is clear and calm; others: "Puck", "Aoede", "Charon")
const speechModel = google.speech(process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts");
const VOICE_NAME = process.env.GEMINI_TTS_VOICE || "Kore";

router.use(requireAuth);

// Keep the recording in memory (we only need its text), audio files only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("audio/")) {
      return cb(new Error("Only audio recordings are allowed."));
    }
    cb(null, true);
  },
});

function receiveAudio(req, res, next) {
  upload.single("audio")(req, res, (error) => {
    if (error?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: `The recording is too long. The limit is ${MAX_SIZE_MB} MB.` });
    }
    if (error) return res.status(400).json({ message: error.message });
    if (!req.file) return res.status(400).json({ message: "No recording was received." });
    next();
  });
}

// POST /api/voice/transcribe  (form-data, field "audio") → { text }
router.post("/transcribe", receiveAudio, async (req, res) => {
  try {
    const result = await transcribe({
      model: transcriptionModel,
      audio: req.file.buffer,
      providerOptions: { groq: { language: "en" } },
    });

    const text = result.text.trim();
    if (!text) {
      return res.status(422).json({ message: "Sorry, I didn't catch that. Try again a bit closer to the mic, or type your question." });
    }
    res.json({ text });
  } catch (error) {
    console.error("Transcription failed:", error);
    res.status(500).json({ message: "Could not understand the recording. Please try again or type your question." });
  }
});

// POST /api/voice/speak  Body: { text } → an audio file (WAV) with a natural voice
router.post("/speak", async (req, res) => {
  const text = String(req.body.text || "").trim();
  if (!text) {
    return res.status(400).json({ message: "There is no text to read." });
  }

  try {
    const { audio } = await generateSpeech({
      model: speechModel,
      text: text.slice(0, MAX_SPEECH_CHARACTERS),
      voice: VOICE_NAME,
      instructions: "Speak in a warm, calm and natural tone, like a friendly tutor explaining something.",
    });

    res.setHeader("Content-Type", audio.mediaType || "audio/wav");
    res.send(Buffer.from(audio.uint8Array));
  } catch (error) {
    // The browser then falls back to its own voice, so the user still hears the answer
    console.error("Text to speech failed:", error.message);
    res.status(503).json({ message: "The AI voice is not available right now." });
  }
});

export default router;