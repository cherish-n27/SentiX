export type ImportReviewDraft = { text: string; author?: string; source?: string; rating?: number | null; category?: string; timestamp?: number };
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export const IMPORT_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".png", ".jpg", ".jpeg", ".csv", ".json"];

const suffix = (name: string) => `.${name.split(".").pop()?.toLowerCase() ?? ""}`;
export const isSupportedImport = (name: string) => IMPORT_EXTENSIONS.includes(suffix(name));
export type ImportRoute = "tabular" | "spreadsheet" | "text" | "pdf" | "docx" | "legacy-doc" | "image" | "unsupported";
export function getImportRoute(name: string): ImportRoute { const type = suffix(name); if ([".csv", ".json"].includes(type)) return "tabular"; if ([".xls", ".xlsx"].includes(type)) return "spreadsheet"; if (type === ".txt") return "text"; if (type === ".pdf") return "pdf"; if (type === ".docx") return "docx"; if (type === ".doc") return "legacy-doc"; if ([".png", ".jpg", ".jpeg"].includes(type)) return "image"; return "unsupported"; }

function csvCells(line: string) { return line.match(/("[^"]*(?:""[^"]*)*"|[^,])+/g)?.map(value => value.replace(/^"|"$/g, "").replaceAll('""', '"').trim()) ?? []; }
function recordsToDrafts(records: Array<Record<string, unknown>>, name: string) {
  return records.map(record => ({ text: String(record.text ?? record.review ?? record.review_text ?? record.feedback ?? record.comment ?? ""), author: record.author ? String(record.author) : record.name ? String(record.name) : undefined, source: record.source ? String(record.source) : name, rating: typeof record.rating === "number" ? record.rating : null, category: record.category ? String(record.category) : undefined, timestamp: record.timestamp ? new Date(String(record.timestamp)).getTime() : undefined })).filter(item => item.text.trim());
}
export function parseTabularText(content: string, name: string): ImportReviewDraft[] {
  if (suffix(name) === ".json") { const payload = JSON.parse(content) as unknown; const rows = Array.isArray(payload) ? payload : (payload as { reviews?: unknown[] }).reviews; if (!Array.isArray(rows)) throw new Error("JSON must be an array of records or contain a reviews array."); return recordsToDrafts(rows as Array<Record<string, unknown>>, name); }
  const [header, ...data] = content.trim().split(/\r?\n/); if (!header || !data.length) throw new Error("The CSV needs a header row and at least one record.");
  const headings = csvCells(header).map(value => value.toLowerCase().replace(/\s+/g, "_")); const find = (...names: string[]) => names.map(item => headings.indexOf(item)).find(index => index >= 0) ?? -1;
  const textIndex = find("text", "review", "review_text", "feedback", "comment"); if (textIndex < 0) throw new Error("Include a text, review, review_text, feedback, or comment column.");
  const authorIndex = find("author", "name", "customer"), sourceIndex = find("source", "platform", "channel"), ratingIndex = find("rating", "score", "stars"), categoryIndex = find("category", "topic", "product_category");
  return data.map(csvCells).map(cells => ({ text: cells[textIndex] ?? "", author: authorIndex >= 0 ? cells[authorIndex] : undefined, source: sourceIndex >= 0 ? cells[sourceIndex] : name, rating: ratingIndex >= 0 && cells[ratingIndex] ? Number(cells[ratingIndex]) : null, category: categoryIndex >= 0 ? cells[categoryIndex] : undefined })).filter(item => item.text.trim());
}
export function textToDrafts(text: string, name: string) {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim(); if (!clean) throw new Error("No legible text could be extracted from this file.");
  const blocks = clean.split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z0-9])/).map(item => item.trim()).filter(item => item.length > 10).flatMap(item => item.length <= 1400 ? [item] : item.match(/.{1,1200}(?:\s|$)/g) ?? [item.slice(0, 1400)]).slice(0, 100);
  if (!blocks.length) throw new Error("No review-sized text could be extracted from this file."); return blocks.map(text => ({ text, source: name, category: "Document Import" }));
}
function base64(buffer: ArrayBuffer) { const bytes = new Uint8Array(buffer); let output = ""; for (let index = 0; index < bytes.length; index += 1) output += String.fromCharCode(bytes[index]); return btoa(output); }
async function pdfText(file: File, progress: (message: string) => void) { progress("Reading PDF pages…"); const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs"); pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString(); const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; const pages: string[] = []; for (let page = 1; page <= pdf.numPages; page += 1) { progress(`Reading PDF page ${page} of ${pdf.numPages}…`); const content = await (await pdf.getPage(page)).getTextContent(); pages.push(content.items.map(item => "str" in item ? item.str : "").join(" ")); } return pages.join("\n\n"); }
async function docxText(file: File, progress: (message: string) => void) { progress("Reading Word document…"); const mammoth = await import("mammoth/mammoth.browser"); return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value; }
async function imageText(file: File, progress: (message: string) => void) { progress("Preparing image OCR…"); const { createWorker } = await import("tesseract.js"); const worker = await createWorker("eng", 1, { logger: event => { if (event.status === "recognizing text") progress(`Reading image text… ${Math.round(event.progress * 100)}%`); } }); try { return (await worker.recognize(file)).data.text; } finally { await worker.terminate(); } }
async function spreadsheetDrafts(file: File, progress: (message: string) => void) { progress("Reading spreadsheet…"); const XLSX = await import("xlsx"); const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" }); const sheet = workbook.Sheets[workbook.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }); if (!rows.length) throw new Error("The spreadsheet has no data rows."); return recordsToDrafts(rows, file.name); }
export type ImportExtractionHandlers = { pdf?: typeof pdfText; docx?: typeof docxText; image?: typeof imageText };
export async function extractImportDrafts(file: File, extractLegacyDoc: (name: string, contentBase64: string) => Promise<string>, progress: (message: string) => void, handlers: ImportExtractionHandlers = {}) {
  const route = getImportRoute(file.name); if (route === "unsupported") throw new Error("Supported formats are PDF, DOC, DOCX, XLS, XLSX, TXT, PNG/JPG, CSV, and JSON."); if (file.size > MAX_IMPORT_BYTES) throw new Error("Choose a file smaller than 8 MB.");
  if (route === "tabular") return parseTabularText(await file.text(), file.name); if (route === "spreadsheet") return spreadsheetDrafts(file, progress);
  const extracted = route === "text" ? await file.text() : route === "pdf" ? await (handlers.pdf ?? pdfText)(file, progress) : route === "docx" ? await (handlers.docx ?? docxText)(file, progress) : route === "legacy-doc" ? await extractLegacyDoc(file.name, base64(await file.arrayBuffer())) : await (handlers.image ?? imageText)(file, progress); return textToDrafts(extracted, file.name);
}
