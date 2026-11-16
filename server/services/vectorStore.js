import { Pinecone } from "@pinecone-database/pinecone";

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const BATCH_SIZE = 100;

// Each user has a private section ("namespace") in the index
function userIndex(userId) {
  return pinecone.index({ name: process.env.PINECONE_INDEX, namespace: `user-${userId}` });
}

function chunkId(documentId, chunkIndex) {
  return `${documentId}-${chunkIndex}`;
}

// Saves the pieces of one PDF with their numbers and where they came from
export async function saveChunks({ userId, documentId, title, chunks, embeddings }) {
  const index = userIndex(userId);
  const records = chunks.map((chunk, i) => ({
    id: chunkId(documentId, i),
    values: embeddings[i],
    metadata: { documentId: String(documentId), title, page: chunk.page, chunkIndex: i, text: chunk.text },
  }));

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    await index.upsert({ records: records.slice(i, i + BATCH_SIZE) });
  }
}

// Finds the pieces closest in meaning to the question (used by the chat later)
export async function searchChunks({ userId, vector, topK = 5, documentId }) {
  const result = await userIndex(userId).query({
    vector,
    topK,
    includeMetadata: true,
    filter: documentId ? { documentId: { $eq: String(documentId) } } : undefined,
  });
  return result.matches || [];
}

// Deletes all pieces of one PDF
export async function deleteChunks({ userId, documentId, chunkCount }) {
  const index = userIndex(userId);
  const ids = Array.from({ length: chunkCount }, (_, i) => chunkId(documentId, i));
  for (let i = 0; i < ids.length; i += 1000) {
    await index.deleteMany({ ids: ids.slice(i, i + 1000) });
  }
}

// Reads some pieces of one PDF by their position (0 = first piece), in page order.
// The study coach uses this to see what a PDF is about, so it can plan real topics.
export async function getChunksByPosition({ userId, documentId, positions }) {
  const ids = positions.map((i) => chunkId(documentId, i));
  const result = await userIndex(userId).fetch({ ids });
  return ids
    .map((id) => result.records?.[id]?.metadata)
    .filter(Boolean)
    .map((meta) => ({ page: meta.page, text: meta.text }));
}
