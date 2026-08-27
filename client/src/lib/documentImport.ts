export type ImportReviewDraft = {
  id?: string;
  date?: string;
  text: string;
  author?: string;
  source?: string;
  rating?: number | null;
  category?: string;
  timestamp?: number;
  /** The number of row-level source records represented by this import. Not sent to NLP. */
  inputRecordCount?: number;
};

export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export const IMPORT_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".png", ".jpg", ".jpeg", ".csv", ".json"];

const suffix = (name: string) => `.${name.split(".").pop()?.toLowerCase() ?? ""}`;
const normalizeHeading = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const trimValue = (value: unknown) => value === undefined || value === null ? "" : String(value).trim();
const firstMappedValue = (record: Record<string, unknown>, names: string[]) => {
  const fields = new Map(Object.entries(record).map(([key, value]) => [normalizeHeading(key), value]));
  return names.map(name => fields.get(name)).find(value => trimValue(value));
};
const numberOrNull = (value: unknown) => {
  const parsed = Number(trimValue(value));
  return Number.isFinite(parsed) ? parsed : null;
};
const timestampFor = (date: string) => {
  if (!date) return undefined;
  const numeric = Number(date);
  if (Number.isFinite(numeric) && numeric > 0) return numeric < 10_000_000_000 ? numeric * 1_000 : numeric;
  const parsed = new Date(date).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
};
const makeGeneratedId = (name: string, position: number) => `${name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "review"}-${position + 1}`;

export const isSupportedImport = (name: string) => IMPORT_EXTENSIONS.includes(suffix(name));
export type ImportRoute = "tabular" | "spreadsheet" | "text" | "pdf" | "docx" | "legacy-doc" | "image" | "unsupported";
export function getImportRoute(name: string): ImportRoute { const type = suffix(name); if ([".csv", ".json"].includes(type)) return "tabular"; if ([".xls", ".xlsx"].includes(type)) return "spreadsheet"; if (type === ".txt") return "text"; if (type === ".pdf") return "pdf"; if (type === ".docx") return "docx"; if (type === ".doc") return "legacy-doc"; if ([".png", ".jpg", ".jpeg"].includes(type)) return "image"; return "unsupported"; }

function csvCells(line: string) { return line.match(/("[^"]*(?:""[^"]*)*"|[^,])+/g)?.map(value => value.replace(/^"|"$/g, "").replaceAll('""', '"').trim()) ?? []; }

function recordToDraft(record: Record<string, unknown>, name: string, position: number): ImportReviewDraft | null {
  const text = trimValue(firstMappedValue(record, ["review_text", "review", "text", "feedback", "comment", "content", "body"]));
  if (!text) return null;
  const id = trimValue(firstMappedValue(record, ["review_id", "reviewid", "id", "uuid", "record_id"])) || makeGeneratedId(name, position);
  const date = trimValue(firstMappedValue(record, ["date", "review_date", "created_at", "timestamp", "reviewed_at"]));
  const source = trimValue(firstMappedValue(record, ["source", "platform", "channel", "origin"])) || name;
  const author = trimValue(firstMappedValue(record, ["author", "name", "customer", "reviewer"]));
  const category = trimValue(firstMappedValue(record, ["category", "topic", "product_category"]));
  const ratingValue = firstMappedValue(record, ["rating", "score", "stars"]);
  return { id, date: date || undefined, text, author: author || undefined, source, rating: ratingValue === undefined ? null : numberOrNull(ratingValue), category: category || undefined, timestamp: timestampFor(date) };
}

function recordsToDrafts(records: Array<Record<string, unknown>>, name: string) {
  const drafts = records.map((record, index) => recordToDraft(record, name, index)).filter((draft): draft is ImportReviewDraft => Boolean(draft));
  return drafts.map(draft => ({ ...draft, inputRecordCount: drafts.length }));
}

export function parseTabularText(content: string, name: string): ImportReviewDraft[] {
  if (suffix(name) === ".json") {
    const payload = JSON.parse(content) as unknown;
    const rows = Array.isArray(payload) ? payload : (payload as { reviews?: unknown[] }).reviews;
    if (!Array.isArray(rows)) throw new Error("JSON must be an array of records or contain a reviews array.");
    return recordsToDrafts(rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object"), name);
  }
  const [header, ...data] = content.trim().split(/\r?\n/);
  if (!header || !data.length) throw new Error("The CSV needs a header row and at least one record.");
  const headings = csvCells(header).map(normalizeHeading);
  const records = data.map(csvCells).map(cells => Object.fromEntries(headings.map((heading, index) => [heading, cells[index] ?? ""])));
  const textColumnPresent = headings.some(heading => ["review_text", "review", "text", "feedback", "comment", "content", "body"].includes(heading));
  if (!textColumnPresent) throw new Error("Include a text, review, review_text, feedback, or comment column.");
  return recordsToDrafts(records, name);
}

/**
 * Retained as a safe utility fallback for callers that only have raw text. It intentionally creates
 * one document-level draft rather than using punctuation as false review boundaries.
 */
export function textToDrafts(text: string, name: string): ImportReviewDraft[] {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  if (!clean) throw new Error("No legible text could be extracted from this file.");
  return [{ id: makeGeneratedId(name, 0), text: clean, source: name, category: "Document Import", inputRecordCount: 1 }];
}

export function validateIngestedReviewCount(expectedRecords: number, createdReviews: number) {
  const expected = Math.max(0, expectedRecords);
  const maximumExpected = Math.max(1, Math.floor(expected * 1.1));
  return { expectedRecords: expected, createdReviews, valid: createdReviews > 0 && createdReviews <= maximumExpected };
}

function base64(buffer: ArrayBuffer) { const bytes = new Uint8Array(buffer); let output = ""; for (let index = 0; index < bytes.length; index += 1) output += String.fromCharCode(bytes[index]); return btoa(output); }
async function pdfText(file: File, progress: (message: string) => void) { progress("Reading PDF pages…"); const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs"); pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString(); const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; const pages: string[] = []; for (let page = 1; page <= pdf.numPages; page += 1) { progress(`Reading PDF page ${page} of ${pdf.numPages}…`); const content = await (await pdf.getPage(page)).getTextContent(); pages.push(content.items.map(item => "str" in item ? item.str : "").join(" ")); } return pages.join("\n\n"); }
async function docxText(file: File, progress: (message: string) => void) { progress("Reading Word document…"); const mammoth = await import("mammoth/mammoth.browser"); return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value; }
async function imageText(file: File, progress: (message: string) => void) { progress("Preparing image OCR…"); const { createWorker } = await import("tesseract.js"); const worker = await createWorker("eng", 1, { logger: event => { if (event.status === "recognizing text") progress(`Reading image text… ${Math.round(event.progress * 100)}%`); } }); try { return (await worker.recognize(file)).data.text; } finally { await worker.terminate(); } }
async function spreadsheetDrafts(file: File, progress: (message: string) => void) { progress("Reading spreadsheet…"); const XLSX = await import("xlsx"); const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" }); const sheet = workbook.Sheets[workbook.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }); if (!rows.length) throw new Error("The spreadsheet has no data rows."); return recordsToDrafts(rows, file.name); }

export type ImportExtractionHandlers = {
  pdf?: typeof pdfText;
  docx?: typeof docxText;
  image?: typeof imageText;
  parseDocumentReviews?: (input: { text: string; source: string }) => Promise<ImportReviewDraft[]>;
};

export async function extractImportDrafts(file: File, extractLegacyDoc: (name: string, contentBase64: string) => Promise<string>, progress: (message: string) => void, handlers: ImportExtractionHandlers = {}) {
  const route = getImportRoute(file.name);
  if (route === "unsupported") throw new Error("Supported formats are PDF, DOC, DOCX, XLS, XLSX, TXT, PNG/JPG, CSV, and JSON.");
  if (file.size > MAX_IMPORT_BYTES) throw new Error("Choose a file smaller than 8 MB.");
  if (route === "tabular") return parseTabularText(await file.text(), file.name);
  if (route === "spreadsheet") return spreadsheetDrafts(file, progress);
  const extracted = route === "text" ? await file.text() : route === "pdf" ? await (handlers.pdf ?? pdfText)(file, progress) : route === "docx" ? await (handlers.docx ?? docxText)(file, progress) : route === "legacy-doc" ? await extractLegacyDoc(file.name, base64(await file.arrayBuffer())) : await (handlers.image ?? imageText)(file, progress);
  if (!extracted.trim()) throw new Error("No legible text could be extracted from this file.");
  if (!handlers.parseDocumentReviews) return textToDrafts(extracted, file.name);
  progress("Identifying complete reviews and metadata with AI…");
  const drafts = await handlers.parseDocumentReviews({ text: extracted, source: file.name });
  if (!drafts.length) throw new Error("No complete review records could be identified in this document.");
  return drafts.map((draft, index) => ({ ...draft, id: draft.id?.trim() || makeGeneratedId(file.name, index), source: draft.source?.trim() || file.name, text: draft.text.trim(), inputRecordCount: drafts.length })).filter(draft => draft.text.length > 0);
}
