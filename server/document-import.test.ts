import { describe, expect, it, vi } from "vitest";
import { extractImportReviews, isSupportedImportFile, MAX_IMPORT_FILE_BYTES, parseStructuredDataset, reviewsFromExtractedText } from "../client/src/lib/documentImport";

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: [{ str: "PDF delivery feedback was excellent." }] }) }) }) }),
}));

vi.mock("mammoth/mammoth.browser", () => ({
  extractRawText: async () => ({ value: "DOCX refund feedback was clear." }),
}));

vi.mock("tesseract.js", () => ({
  createWorker: async () => ({ recognize: async () => ({ data: { text: "Image review text was legible." } }), terminate: async () => undefined }),
}));

function fakeFile(name: string, text = "", size = text.length) {
  return {
    name,
    size,
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer,
  } as unknown as File;
}

describe("SentiX document import", () => {
  it("recognizes the supported legible input formats", () => {
    ["brief.pdf", "reviews.doc", "report.docx", "notes.txt", "feedback.png", "reviews.csv", "reviews.json"].forEach(fileName => {
      expect(isSupportedImportFile(fileName)).toBe(true);
    });
    expect(isSupportedImportFile("archive.zip")).toBe(false);
  });

  it("extracts review records from JSON and preserves available attribution", () => {
    const reviews = parseStructuredDataset(JSON.stringify([{ feedback: "The delivery was fast.", author: "Ava", category: "Delivery" }]), "reviews.json");
    expect(reviews).toEqual([{ text: "The delivery was fast.", author: "Ava", source: "reviews.json", rating: null, category: "Delivery", timestamp: undefined }]);
  });

  it("segments legible document text into bounded feedback blocks", () => {
    const reviews = reviewsFromExtractedText("Fast delivery and friendly service.\n\nThe return process took too long.", "notes.txt");
    expect(reviews).toHaveLength(2);
    expect(reviews[0]).toMatchObject({ source: "notes.txt", category: "Document Import" });
    expect(reviews[1]?.text).toContain("return process");
  });

  it("rejects unsupported, oversized, and unreadable documents before analysis", async () => {
    const legacyExtractor = vi.fn(async () => "legacy body");
    await expect(extractImportReviews(fakeFile("archive.zip"), legacyExtractor, vi.fn())).rejects.toThrow("Supported formats");
    await expect(extractImportReviews(fakeFile("large.txt", "x", MAX_IMPORT_FILE_BYTES + 1), legacyExtractor, vi.fn())).rejects.toThrow("smaller than 8 MB");
    await expect(extractImportReviews(fakeFile("blank.txt", "   "), legacyExtractor, vi.fn())).rejects.toThrow("No legible text");
  });

  it("routes TXT and CSV imports through their text and structured parsers", async () => {
    const legacyExtractor = vi.fn(async () => "legacy body");
    const txt = await extractImportReviews(fakeFile("notes.txt", "Quick delivery and friendly support."), legacyExtractor, vi.fn());
    const csv = await extractImportReviews(fakeFile("reviews.csv", "review,author\nFast delivery,Ava"), legacyExtractor, vi.fn());
    expect(txt[0]).toMatchObject({ source: "notes.txt", category: "Document Import" });
    expect(csv[0]).toMatchObject({ text: "Fast delivery", author: "Ava", source: "reviews.csv" });
  });

  it("routes PDF, DOCX, DOC, and image files through their respective extractors", async () => {
    const progress = vi.fn();
    const legacyExtractor = vi.fn(async () => "Legacy Word feedback was helpful.");
    const pdf = await extractImportReviews(fakeFile("feedback.pdf", "pdf"), legacyExtractor, progress);
    const docx = await extractImportReviews(fakeFile("feedback.docx", "docx"), legacyExtractor, progress);
    const doc = await extractImportReviews(fakeFile("feedback.doc", "doc"), legacyExtractor, progress);
    const image = await extractImportReviews(fakeFile("feedback.png", "png"), legacyExtractor, progress);
    expect(pdf[0]?.text).toContain("PDF delivery feedback");
    expect(docx[0]?.text).toContain("DOCX refund feedback");
    expect(doc[0]?.text).toContain("Legacy Word feedback");
    expect(image[0]?.text).toContain("Image review text");
    expect(legacyExtractor).toHaveBeenCalledWith("feedback.doc", expect.any(String));
  });
});
