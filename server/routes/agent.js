import express from "express";
import { generateText, isStepCount } from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";
import requireAuth from "../middleware/requireAuth.js";
import { addDays, createAgentTools } from "../services/agentTools.js";

const router = express.Router();
// The coach runs on Groq. Groq's free plan allows about 8,000 tokens (pieces of text) per minute,
// and an agent sends a lot (it calls the AI again after every tool), so below we keep every call small.
const model = groq(process.env.AGENT_MODEL || process.env.GROQ_MODEL || "openai/gpt-oss-120b");
const MAX_ANSWER_TOKENS = 1200; // a cap on each reply (Groq counts the reply towards the limit too)
const MAX_STEPS = 8; // the coach can use tools at most 8 times in a row, so it never loops forever
const HISTORY_LENGTH = 10; // the coach sees the last 10 messages
const TIME_LIMIT_MS = 90_000; // stop waiting after 90 seconds, so the page never spins forever
const CALENDAR_DAYS = 14; // the coach gets the dates of the next 14 days, because AI models are bad at date math

// What the browser sends: the conversation so far, and the user's own date (their time zone, not the server's)
const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000),
      })
    )
    .min(1),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

router.use(requireAuth);

// "- Monday 2026-11-16 (tomorrow)" for the next 14 days
function buildCalendar(today) {
  return Array.from({ length: CALENDAR_DAYS }, (_, i) => {
    const date = addDays(today, i);
    const weekday = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
    const note = i === 0 ? " (today)" : i === 1 ? " (tomorrow)" : "";
    return `- ${weekday} ${date}${note}`;
  }).join("\n");
}

function buildAgentPrompt(today) {
  return `You are DevTrail's study coach. You plan the user's study time around their own PDFs, using your tools.

Calendar (use these exact dates, do not calculate dates yourself):
${buildCalendar(today)}

How to work:
- ALWAYS call get_schedule first (from today, 30 days) before you create, move, change, delete or talk about tasks. It gives you every task with its id and date.
- Never ask the user for a task id: find the task yourself in get_schedule by its date or title. Only ask if two tasks really match.
- Before making a new plan, also call list_documents to see the PDFs.
- Build plans with create_study_tasks: spread the work over the days, respect the minutes per day the user gives, and mix reading, flashcards, quizzes and review. Put a review or a quiz near the end.
- Before creating reading tasks, call get_document_topics for each PDF you plan with. Give every reading task a precise title with the real topics and pages from it, e.g. "Closures and hoisting (p. 1-2)". Spread the topics in page order over the days. Never write vague titles like "Read sections of X".
- Link each task to its PDF with documentId. Never invent PDFs or topics.
- To move, rename, finish or change a task use update_study_task. To remove one use delete_study_task.
- create_quiz makes a real quiz and takes time: only use it when the user asks for a quiz or for a plan with a quiz in it, then add a quiz task with its quizId.
- If a tool returns an error, read it, then either call the tool again with corrected input, or tell the user plainly that it failed and why.
- Never say a task was added, moved, changed or deleted unless that tool call succeeded in this conversation.
- If something important is missing (for example no deadline or no time per day), ask one short question instead of guessing.
- Never plan anything before today.
- When you are done, reply in 2 to 4 short sentences: what you did, with the dates. Do not list every task: the user sees the plan on the dashboard.`;
}

// True when the AI provider says "too many requests" (free plans have a limit per minute)
function isRateLimit(error) {
  const status = error?.statusCode ?? error?.lastError?.statusCode;
  return status === 429 || /rate limit|quota|too many requests/i.test(String(error?.message));
}

function errorText(error) {
  return String(error?.message || error || "Unknown error").slice(0, 200);
}

// POST /api/agent  Body: { messages: [{ role, content }], today: "YYYY-MM-DD" } → { text, toolSteps }
router.post("/", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Please type a message for the coach." });
  }
  const { messages } = parsed.data;
  if (messages[messages.length - 1].role !== "user") {
    return res.status(400).json({ message: "The last message must come from you." });
  }
  const today = parsed.data.today || new Date().toISOString().slice(0, 10);

  const startedAt = Date.now();
  const seconds = () => ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[coach] new request (${messages.length} message(s))`);

  try {
    const result = await generateText({
      model,
      system: buildAgentPrompt(today),
      messages: messages.slice(-HISTORY_LENGTH),
      tools: createAgentTools(req.userId),
      stopWhen: isStepCount(MAX_STEPS),
      abortSignal: AbortSignal.timeout(TIME_LIMIT_MS),
      maxOutputTokens: MAX_ANSWER_TOKENS,
      // "low" reasoning: the model thinks less, which is faster and uses far fewer tokens
      providerOptions: { groq: { reasoningEffort: "low" } },
      // Shows each step in the terminal: which tools the coach used and how long it took so far
      onStepEnd: (step) => {
        const tools = step.toolCalls.map((call) => call.toolName).join(", ") || "no tool";
        console.log(`[coach] step done after ${seconds()}s: ${tools} (${step.finishReason})`);
      },
    });
    console.log(`[coach] finished in ${seconds()}s`);

    // Every tool the coach used, in order, so the chat can show them (including the ones that failed)
    const toolSteps = result.steps
      .flatMap((step) => step.content)
      .filter((part) => part.type === "tool-result" || part.type === "tool-error")
      .map((part) => ({
        tool: part.toolName,
        input: part.input,
        ok: part.type === "tool-result",
        summary: part.type === "tool-result" ? part.output?.summary || "Done" : errorText(part.error),
      }));

    // Safety net: if a tool's LAST call failed, say so plainly, even if the model's reply sounds like it worked.
    // (The model once said "I added it" after a failed call; code can't make that mistake.)
    const lastCallOfEachTool = new Map(toolSteps.map((step) => [step.tool, step]));
    const notSaved = [...lastCallOfEachTool.values()].filter((step) => !step.ok);
    const warning = notSaved.length
      ? `\n\n⚠️ Not saved: ${notSaved.map((step) => `${step.tool} failed (${step.summary.split(". Fix it")[0]})`).join("; ")}.`
      : "";

    const text = (result.text.trim() || "Done. Have a look at the dashboard.") + warning;
    res.json({ text, toolSteps });
  } catch (error) {
    console.error(`[coach] failed after ${seconds()}s:`, error?.message || error);
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      return res.status(504).json({ message: "The coach took too long. Please try again with a shorter request." });
    }
    if (isRateLimit(error)) {
      return res.status(429).json({ message: "The free AI limit was reached for this minute. Wait about one minute, then try again." });
    }
    res.status(500).json({ message: "The study coach could not answer right now. Please try again." });
  }
});

export default router;