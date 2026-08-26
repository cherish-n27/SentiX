export type ImportReviewDraft = {
  text: string;
  author?: string;
  source?: string;
  rating?: number | null;
  category?: string;
  timestamp?: number;
};

export const MAX_IMPORT_FILE_BYTES = 8 * 1024 * 1024;
export const SUPPORTED_IMPORT_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".csv", ".json"];

function extension(name: string) {
  return `.${name.split(".").pop()?.toLowerCase() ?? ""}`;
}

function csvCells(line: string) {
  return line.match(/("[^"]*(?:""[^"]*)*"|[^,])+/g)?.map(value => value.replace(/^"|"$/g, "").replaceAll('""', '"').trim()) ?? [];
}

export function isSupportedImportFile(fileName: string) {
  return SUPPORTED_IMPORT_EXTENSIONS.includes(extension(fileName));
}

export function parseStructuredDataset(content: string, fileName: string): ImportReviewDraft[] {
  if (extension(fileName) === ".json") {
    const parsed = JSON.parse(content) as unknown;
    const records = Array.isArray(parsed) ? parsed : (parsed as { reviews?: unknown[] }).reviews;
    if (!Array.isArray(records)) throw new Error("JSON must be an array of reviews or include a reviews array.");
    return records.map(record => {
      const row = record as Record<string, unknown>;
      return {
        text: String(row.text ?? row.review ?? row.review_text ?? row.feedback ?? row.comment ?? ""),
        author: row.author ? String(row.author) : undefined,
        source: row.source ? String(row.source) : fileName,
        rating: typeof row.rating === "number" ? row.rating : null,
        category: row.category ? String(row.category) : undefined,
        timestamp: row.timestamp ? new Date(String(row.timestamp)).getTime() : undefined,
      };
    }).filter(review => review.text.trim());
  }

  const [header, ...rows] = content.trim().split(/\r?\n/);
  if (!header || !rows.length) throw new Error("The CSV needs a header row and at least one record.");
  const headers = csvCells(header).map(cell => cell.toLowerCase().replace(/\s+/g, "_"));
  const valueIndex = (...names: string[]) => names.map(name => headers.indexOf(name)).find(index => index >= 0) ?? -1;
  const textIndex = valueIndex("text", "review", "review_text", "feedback", "comment");
  if (textIndex < 0) throw new Error("The CSV needs a text, review, review_text, feedback, or comment column.");
  const authorIndex = valueIndex("author", "name", "customer");
  const sourceIndex = valueIndex("source", "platform", "channel");
  const ratingIndex = valueIndex("rating", "score", "stars");
  const categoryIndex = valueIndex("category", "topic", "product_category");
  return rows.map(csvCells).map(cells => ({
    text: cells[textIndex] ?? "",
    author: authorIndex >= 0 ? cells[authorIndex] : undefined,
    source: sourceIndex >= 0 ? cells[sourceIndex] : fileName,
    rating: ratingIndex >= 0 && cells[ratingIndex] ? Number(cells[ratingIndex]) : null,
    category: categoryIndex >= 0 ? cells[categoryIndex] : undefined,
  })).filter(review => review.text.trim());
}

export function reviewsFromExtractedText(text: string, fileName: string): ImportReviewDraft[] {
  const normalized = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  if (!normalized) throw new Error("No legible text could be extracted from this file.");
  const rawBlocks = normalized.split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z0-9])/).map(block => block.trim()).filter(block => block.length > 10);
  const chunks = rawBlocks.flatMap(block => {
    if (block.length <= 1400) return [block];
    return block.match(/.{1,1200}(?:\s|$)/g) ?? [block.slice(0, 1400)];
  }).slice(0, 100);
  if (!chunks.length) throw new Error("No review-sized text could be extracted from this file.");
  return chunks.map(textBlock => ({ text: textBlock, source: fileName, category: "Document Import" }));
}

function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

async function extractPdfText(file: File, onProgress: (message: string) => void) {
  onProgress("Reading PDF pages…");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    onProgress(`Reading PDF page ${pageNumber} of ${pdf.numPages}…`);
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => "str" in item ? item.str : "").join(" "));
  }
  return pages.join("\n\n");
}

async function extractDocxText(file: File, onProgress: (message: string) => void) {
  onProgress("Reading Word document…");
  const mammoth = await import("mammoth/mammoth.browser");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

async function extractImageText(file: File, onProgress: (message: string) => void) {
  onProgress("Preparing image OCR…");
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { logger: message => { if (message.status === "recognizing text") onProgress(`Reading image text… ${Math.round(message.progress * 100)}%`); } });
  try {
    const result = await worker.recognize(file);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}

export async function extractImportReviews(
  file: File,
  extractLegacyWord: (fileName: string, contentBase64: string) => Promise<string>,
  onProgress: (message: string) => void,
) {
  if (!isSupportedImportFile(file.name)) throw new Error("Supported formats are PDF, DOC, DOCX, TXT, PNG/JPG, CSV, and JSON.");
  if (file.size > MAX_IMPORT_FILE_BYTES) throw new Error("Choose a document smaller than 8 MB.");
  const suffix = extension(file.name);
  if (suffix === ".csv" || suffix === ".json") return parseStructuredDataset(await file.text(), file.name);
  let extractedText: string;
  if (suffix === ".txt") { onProgress("Reading text file…"); extractedText = await file.text(); }
  else if (suffix === ".pdf") extractedText = await extractPdfText(file, onProgress);
  else if (suffix === ".docx") extractedText = await extractDocxText(file, onProgress);
  else if (suffix === ".doc") { onProgress("Reading legacy Word document…"); extractedText = await extractLegacyWord(file.name, bufferToBase64(await file.arrayBuffer())); }
  else extractedText = await extractImageText(file, onProgress);
  return reviewsFromExtractedText(extractedText, file.name);
}
