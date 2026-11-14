import "dotenv/config";
import { Pinecone } from "@pinecone-database/pinecone";

// Run once: creates the Pinecone index where the PDF pieces are stored.
// 768 numbers per piece, because we ask Gemini for 768-number embeddings.
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

try {
  await pinecone.createIndex({
    name: process.env.PINECONE_INDEX,
    dimension: 768,
    metric: "cosine",
    spec: { serverless: { cloud: "aws", region: "us-east-1" } },
    waitUntilReady: true,
    suppressConflicts: true, // no error if it already exists
  });
  console.log(`Index "${process.env.PINECONE_INDEX}" is ready.`);
} catch (error) {
  console.error("Could not create the index:", error.message);
  process.exit(1);
}