import { embedQuery } from "./embeddings.js";
import { searchChunks } from "./vectorStore.js";

export const TOP_K = 5; // how many pieces of the PDF the chat gets for each question

// Finds the pieces of the user's PDFs closest in meaning to the question
export async function findSources({ userId, question, documentId, topK = TOP_K }) {
  const vector = await embedQuery(question);
  const matches = await searchChunks({ userId, vector, topK, documentId });

  return matches.map((match, i) => ({
    number: i + 1,
    documentId: match.metadata.documentId,
    title: match.metadata.title,
    page: match.metadata.page,
    text: match.metadata.text,
  }));
}

// The rules the AI must follow. This is what stops it from inventing answers.
export function buildSystemPrompt(sources) {
  const context = sources
    .map((s) => `[${s.number}] (${s.title}, page ${s.page})\n${s.text}`)
    .join("\n\n");

  return `You are DevTrail, a study assistant for developers.
Answer the question using ONLY the sources below, taken from the user's own PDFs.

Rules:
- After each fact, cite the source number in square brackets, like [1] or [2][3].
- If the sources do not contain the answer, reply exactly: "I couldn't find this in your material." Do not use outside knowledge.
- Keep answers clear and short. Use code blocks for code.

Sources:
${context || "(no sources found)"}`;
}