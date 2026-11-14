import { embed, embedMany } from "ai";
import { google } from "@ai-sdk/google";

const model = google.embeddingModel("gemini-embedding-001");
export const EMBEDDING_DIMENSIONS = 768; // must match the Pinecone index

// For PDF pieces (many at once)
export async function embedChunks(texts) {
  const { embeddings } = await embedMany({
    model,
    values: texts,
    providerOptions: {
      google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: "RETRIEVAL_DOCUMENT" },
    },
  });
  return embeddings;
}

// For one question (used by the chat later)
export async function embedQuery(text) {
  const { embedding } = await embed({
    model,
    value: text,
    providerOptions: {
      google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: "RETRIEVAL_QUERY" },
    },
  });
  return embedding;
}