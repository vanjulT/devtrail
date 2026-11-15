import { apiFetch } from "./api.js";

const API_URL = import.meta.env.VITE_API_URL;

// ---------- Recording (speech to text) ----------

// Asks for the microphone and starts recording. Returns a function that stops and gives back the audio.
export async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new Error("This browser cannot record audio. Please type your question instead.");
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    if (error.name === "NotAllowedError") {
      throw new Error(
        "Microphone blocked. Allow the microphone for this site (the icon in the address bar), then try again. You can still type your question.",
        { cause: error }
      );
    }
    throw new Error("No microphone was found. Please type your question instead.", { cause: error });
  }

  const recorder = new MediaRecorder(stream);
  const pieces = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) pieces.push(event.data);
  };

  // Wait until the recorder has really started, then save audio in small pieces every 250 ms
  await new Promise((resolve) => {
    recorder.onstart = resolve;
    recorder.start(250);
  });
  // The microphone needs a short moment to warm up before the first words are clear
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Calling this stops the recording, frees the microphone and returns the audio file
  return function stop() {
    return new Promise((resolve) => {
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        resolve(new Blob(pieces, { type: recorder.mimeType || "audio/webm" }));
      };
      recorder.stop();
    });
  };
}

// Sends the recording to our server, which asks Whisper for the text
export async function transcribe(audioBlob) {
  const extension = audioBlob.type.includes("mp4") ? "mp4" : "webm";
  const formData = new FormData();
  formData.append("audio", audioBlob, `question.${extension}`);
  const data = await apiFetch("/api/voice/transcribe", { method: "POST", body: formData });
  return data.text;
}

// ---------- Speaking (text to speech) ----------

// ONE player for the whole app. Safari only lets a player make sound if it was
// started during a click, so we "unlock" it when the user clicks the mic.
const player = typeof Audio !== "undefined" ? new Audio() : null;
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
const FIRST_PART_LENGTH = 150; // the first part is short, so the voice starts quickly
let speakRequest = 0; // goes up on every new speak/stop, so a late answer is ignored
let currentUrl = null;

// Call this directly inside a click (before any await)
export function unlockAudio() {
  if (!player) return;
  player.onended = null;
  player.onerror = null;
  player.src = SILENCE;
  player.play().catch(() => {});
}

// Removes things that sound bad when read aloud: citations [1], code blocks, markdown symbols
export function cleanForSpeech(text) {
  return text
    .replace(/```[\s\S]*?```/g, " (see the code on screen) ")
    .replace(/\[\d+\]/g, "")
    .replace(/[*_#`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Cuts the text in 2: the first sentence(s) up to 150 characters, and the rest
function splitInTwo(text) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [];
  let first = "";
  let i = 0;
  while (i < sentences.length && (first === "" || (first + sentences[i]).length <= FIRST_PART_LENGTH)) {
    first += sentences[i];
    i++;
  }
  return [first.trim(), sentences.slice(i).join("").trim()];
}

export function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Asks our server for the natural AI voice (Gemini) and returns the audio file
async function fetchAiVoice(text) {
  const token = localStorage.getItem("devtrail-token");
  const response = await fetch(`${API_URL}/api/voice/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    throw new Error(`The server could not make the AI voice (status ${response.status}).`);
  }
  return response.blob();
}

// Backup: the browser's own voice (works everywhere, sounds more robotic)
function speakWithBrowser(text, onEnd) {
  if (!canSpeak()) {
    onEnd();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
}

function freeUrl() {
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = null;
}

// Plays one part when its audio is ready (browser voice if it failed), then calls done
function playPart(audioPromise, text, request, done) {
  audioPromise
    .then((audioBlob) => {
      if (request !== speakRequest) return; // the user pressed Stop while we were waiting
      if (!player) throw new Error("This browser cannot play audio.");
      freeUrl();
      currentUrl = URL.createObjectURL(audioBlob);

      const finish = () => {
        freeUrl();
        done();
      };
      player.onended = finish;
      player.onerror = finish;
      player.src = currentUrl;
      return player.play();
    })
    .catch((error) => {
      if (request !== speakRequest) return;
      console.warn("AI voice failed, using the browser voice instead:", error.message);
      speakWithBrowser(text, done);
    });
}

// Reads the text out loud, then calls onEnd.
// Both parts are requested at the same time: the short first part is ready fast and starts playing,
// and the rest is prepared while the first part plays.
export function speak(text, onEnd) {
  stopSpeaking();
  const request = ++speakRequest;
  const [first, rest] = splitInTwo(cleanForSpeech(text));
  if (!first) {
    onEnd();
    return;
  }

  const firstAudio = fetchAiVoice(first);
  const restAudio = rest ? fetchAiVoice(rest) : null;
  restAudio?.catch(() => {}); // if it fails, playPart handles it later

  playPart(firstAudio, first, request, () => {
    if (!restAudio || request !== speakRequest) return onEnd();
    playPart(restAudio, rest, request, onEnd);
  });
}

export function stopSpeaking() {
  speakRequest++;
  if (player) {
    player.onended = null;
    player.onerror = null;
    player.pause();
  }
  freeUrl();
  if (canSpeak()) window.speechSynthesis.cancel();
}