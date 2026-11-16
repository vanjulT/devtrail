import { generateText, Output } from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";
import { findSources } from "./rag.js";

const model = groq(process.env.GROQ_MODEL || "openai/gpt-oss-120b");
const MAX_TRIES = 3;
export const CARD_COUNT = 10;
export const QUESTION_COUNT = 5;

// ---------- Checking that answers really come from the PDF ----------

// Lower case, no punctuation, single spaces: so small differences don't matter
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// True if the quote is really written in the source it points to
function quoteIsInSource(sources, sourceNumber, quote) {
  const source = sources.find((s) => s.number === sourceNumber);
  const cleanQuote = normalize(quote || "");
  return Boolean(source) && cleanQuote.length >= 8 && normalize(source.text).includes(cleanQuote);
}

const evidenceField = z
  .string()
  .describe("An exact quote, copied word for word from the source, that proves the answer");

// ---------- The forms the AI must fill in (Zod schemas) ----------
// They are built for each request, because Zod also checks the quotes against these sources.

function flashcardsSchema(sources) {
  return z
    .object({
      title: z.string().min(3).describe("A short title for this set of flashcards"),
      cards: z
        .array(
          z.object({
            front: z.string().min(2).describe("A term or a short question"),
            back: z.string().min(2).describe("The answer, in one or two sentences"),
            source: z.number().int().describe("The number of the source this card comes from"),
            evidence: evidenceField,
          })
        )
        .length(CARD_COUNT),
    })
    .superRefine((result, ctx) => {
      result.cards.forEach((card, i) => {
        if (!quoteIsInSource(sources, card.source, card.evidence)) {
          ctx.addIssue({ code: "custom", path: ["cards", i, "evidence"], message: `Card ${i + 1}: the evidence is not an exact quote from source [${card.source}]` });
        }
      });
    });
}

function quizSchema(sources) {
  return z
    .object({
      title: z.string().min(3).describe("A short title for this quiz"),
      questions: z
        .array(
          z.object({
            question: z.string().min(5),
            code: z.string().describe("A short code snippet copied from the sources, or an empty string if there is none"),
            options: z.array(z.string().min(1)).length(4).describe("Exactly 4 possible answers"),
            correctIndex: z.number().int().min(0).max(3).describe("The position (0 to 3) of the correct option"),
            explanation: z.string().min(5).describe("Why the correct answer is right"),
            source: z.number().int().describe("The number of the source this question comes from"),
            evidence: evidenceField,
          })
        )
        .length(QUESTION_COUNT),
    })
    .superRefine((result, ctx) => {
      result.questions.forEach((q, i) => {
        if (!quoteIsInSource(sources, q.source, q.evidence)) {
          ctx.addIssue({ code: "custom", path: ["questions", i, "evidence"], message: `Question ${i + 1}: the evidence is not an exact quote from source [${q.source}]` });
        }
      });
    });
}

// ---------- Helpers ----------

// The rule that keeps quizzes and flashcards honest: only what the PDF actually says
const GROUNDING_RULES =
  "Use ONLY facts that are written in the sources below. Every correct answer must be supported by the text of a source, " +
  "and its 'source' number must point to that source. Do NOT use outside knowledge. " +
  "If a source only lists a topic name without explaining it (for example a syllabus or a table of contents), " +
  "ask only about what the source itself says (for example which module or week covers that topic), not about how the topic works. " +
  "Only include code that appears in the sources; otherwise leave 'code' empty. " +
  "For every item, put in 'evidence' a quote copied word for word from that source which proves the answer. " +
  "Never mention source numbers like [1] in the questions, options or cards: say \"the document\" or \"the course\" instead. " +
  "LANGUAGE: write the title, cards, questions, options and explanations in the SAME language as the sources " +
  "(a French document gets French flashcards). Copy every evidence quote exactly as it is written in the source, " +
  "in its original language: never translate or rephrase a quote.";

// Finds the parts of the PDF to build the cards or quiz from
async function getMaterial({ userId, documentId, topic }) {
  const sources = await findSources({
    userId,
    documentId,
    question: topic || "the most important concepts, definitions and code examples",
    topK: 8,
  });
  if (sources.length === 0) {
    throw new Error("No content found in this PDF for that topic.");
  }
  const text = sources.map((s) => `[${s.number}] (page ${s.page})\n${s.text}`).join("\n\n");
  return { sources, text };
}

// Asks the AI to fill in the form. If Zod says the result is wrong, it asks again.
async function generateValidated({ schema, name, system, prompt }) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    try {
      // On a new try, tell the AI why the last answer was rejected
      const feedback = lastError
        ? `\n\nYour previous answer was rejected: ${String(lastError.message).slice(0, 600)}\nFix it. Copy every evidence quote word for word from the sources, in their original language (do not translate).`
        : "";
      const { output } = await generateText({
        model,
        system,
        prompt: prompt + feedback,
        output: Output.object({ schema, name }),
      });
      console.log(`[${name}] raw output (try ${attempt}):`, JSON.stringify(output, null, 2));
      return output; // already checked by Zod, quotes included
    } catch (error) {
      lastError = error;
      console.warn(`[${name}] try ${attempt} failed: ${error.message}`);
    }
  }
  throw new Error(`The AI could not produce a valid ${name} after ${MAX_TRIES} tries. ${lastError?.message || ""}`);
}

// Turns the source number into the page it came from
function pageOf(sources, number) {
  return sources.find((s) => s.number === number)?.page ?? null;
}

// ---------- What the routes use ----------

export async function generateFlashcards({ userId, documentId, topic }) {
  const { sources, text } = await getMaterial({ userId, documentId, topic });

  const result = await generateValidated({
    schema: flashcardsSchema(sources),
    name: "flashcards",
    system:
      "You create study flashcards for developers. Each card tests one idea. Keep the back short and precise. " + GROUNDING_RULES,
    prompt: `Create ${CARD_COUNT} flashcards${topic ? ` about "${topic}"` : ""} from these sources:\n\n${text}`,
  });

  return {
    title: result.title,
    cards: result.cards.map((card) => ({
      front: card.front,
      back: card.back,
      evidence: card.evidence,
      page: pageOf(sources, card.source),
    })),
  };
}

export async function generateQuiz({ userId, documentId, topic }) {
  const { sources, text } = await getMaterial({ userId, documentId, topic });

  const result = await generateValidated({
    schema: quizSchema(sources),
    name: "quiz",
    system:
      "You write multiple-choice quizzes for developers. " +
      "Mix concept questions with 'what does this code do / print?' questions when the sources contain code. " +
      "Exactly one option is correct; the wrong options must be believable. " +
      GROUNDING_RULES,
    prompt: `Write a ${QUESTION_COUNT}-question quiz${topic ? ` about "${topic}"` : ""} from these sources:\n\n${text}`,
  });

  return {
    title: result.title,
    questions: result.questions.map((q) => ({
      question: q.question,
      code: q.code,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      evidence: q.evidence,
      page: pageOf(sources, q.source),
    })),
  };
}