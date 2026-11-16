import { getDocumentProxy } from "unpdf";

// Each piece is about 1000 characters (roughly one section of a page).
// The 150-character overlap keeps a sentence from being cut in half between two pieces.
export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 150;
// A page needs at least this many letters to count as text.
// Scanned PDFs often give only bullets or symbols ("◇ ◇ ◇"): the AI can't learn or quote anything from that.
const MIN_LETTERS_PER_PAGE = 20;

function countLetters(text) {
  return (text.match(/\p{L}/gu) || []).length;
}

// Returns one string per page.
// Pages are read ONE AT A TIME and pdf.js's cache is emptied after each one.
// Without that, an 83-page scanned PDF used ~760 MB and crashed the free Render server (512 MB).
export async function readPdfPages(buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const pages = [];
  try {
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .filter((item) => item.str != null)
          .map((item) => item.str + (item.hasEOL ? "\n" : ""))
          .join("")
      );
      page.cleanup();
      await pdf.cleanup(); // free the fonts and images pdf.js keeps in its cache, before reading the next page
    }
    return { totalPages: pdf.numPages, pages };
  } finally {
    await pdf.loadingTask.destroy(); // free the whole document from memory
  }
}

// Cuts every page into pieces and remembers which page each piece came from
export function chunkPages(pages) {
  const chunks = [];

  pages.forEach((pageText, pageIndex) => {
    const clean = pageText.replace(/\s+/g, " ").trim();
    if (countLetters(clean) < MIN_LETTERS_PER_PAGE) return; // skip pages with no real text (for example, a scanned image)

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