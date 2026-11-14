import { extractText } from "unpdf";

// Each piece is about 1000 characters (roughly one section of a page).
// The 150-character overlap keeps a sentence from being cut in half between two pieces.
export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 150;

// Returns one string per page
export async function readPdfPages(buffer) {
  const { totalPages, text } = await extractText(new Uint8Array(buffer), { mergePages: false });
  return { totalPages, pages: text };
}

// Cuts every page into pieces and remembers which page each piece came from
export function chunkPages(pages) {
  const chunks = [];

  pages.forEach((pageText, pageIndex) => {
    const clean = pageText.replace(/\s+/g, " ").trim();
    if (!clean) return; // skip empty pages (for example, a page with only an image)

    let start = 0;
    while (start < clean.length) {
      const end = Math.min(start + CHUNK_SIZE, clean.length);
      chunks.push({ text: clean.slice(start, end), page: pageIndex + 1 });
      if (end === clean.length) break;
      start = end - CHUNK_OVERLAP;
    }
  });

  return chunks;
}