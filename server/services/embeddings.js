import { embed, embedMany } from "ai";
import { google } from "@ai-sdk/google";

const model = google.embeddingModel("gemini-embedding-001");
export const EMBEDDING_DIMENSIONS = 768; // must match the Pinecone index

// Gemini's free tier allows 100 embeddings per minute.
// So big PDFs are sent in batches of 90, with a pause so each batch starts in a new minute.
const BATCH_SIZE = 90;
const MINUTE_MS = 61_000;
const MAX_WAITS = 3; // how many times we wait and retry if Gemini still says "too many"

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRateLimit(error) {
  const text = `${error?.statusCode ?? ""} ${error?.message ?? ""} ${error?.lastError?.message ?? ""}`;
  return /429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(text);
}

async function embedBatch(texts) {
  for (let wait = 0; ; wait++) {
    try {
      const { embeddings } = await embedMany({
        model,
        values: texts,
        maxRetries: 0, // we handle retries ourselves, with a real one-minute wait
        providerOptions: {
          google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: "RETRIEVAL_DOCUMENT" },
        },
      });
      return embeddings;
    } catch (error) {
      if (!isRateLimit(error) || wait >= MAX_WAITS) {
        throw isRateLimit(error)
          ? new Error("The free AI quota is used up for now. Wait a minute and upload the PDF again.")
          : error;
      }
      console.warn(`[embeddings] rate limited, waiting a minute (try ${wait + 1}/${MAX_WAITS})`);
      await sleep(MINUTE_MS);
    }
  }
}

// For PDF pieces (many at once)
export async function embedChunks(texts) {
  const all = [];
  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batchStart = Date.now();
    all.push(...(await embedBatch(texts.slice(start, start + BATCH_SIZE))));

    const moreToSend = start + BATCH_SIZE < texts.length;
    if (moreToSend) {
      const pause = MINUTE_MS - (Date.now() - batchStart);
      console.log(`[embeddings] ${all.length}/${texts.length} done, pausing ${Math.round(pause / 1000)} s for the free quota`);
      if (pause > 0) await sleep(pause);
    }
  }
  return all;
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
