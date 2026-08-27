import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { extractImportDrafts, getImportRoute, IMPORT_EXTENSIONS, isSupportedImport, parseTabularText, textToDrafts, validateIngestedReviewCount } from "../client/src/lib/documentImport";

describe("SentiX multi-format document import", () => {
  it("recognizes every supported legible document format", () => {
    ["feedback.pdf", "notes.doc", "notes.docx", "reviews.xls", "reviews.xlsx", "notes.txt", "photo.png", "feedback.csv", "feedback.json"].forEach(name => expect(isSupportedImport(name)).toBe(true));
    expect(IMPORT_EXTENSIONS).toContain(".xlsx");
    expect(isSupportedImport("archive.zip")).toBe(false);
  });

  it("routes PDF, DOCX, legacy DOC, and image files to their dedicated parsers", () => {
    expect(getImportRoute("brief.pdf")).toBe("pdf");
    expect(getImportRoute("brief.docx")).toBe("docx");
    expect(getImportRoute("legacy.doc")).toBe("legacy-doc");
    expect(getImportRoute("scan.png")).toBe("image");
    expect(getImportRoute("notes.txt")).toBe("text");
  });

  it("executes the dedicated PDF, DOCX, legacy DOC, and image extraction handlers", async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const file = (name: string) => ({ name, size: 3, text: async () => "", arrayBuffer: async () => bytes }) as unknown as File;
    const pdf = vi.fn().mockResolvedValue("The PDF says delivery was excellent.");
    const docx = vi.fn().mockResolvedValue("The DOCX says refunds were delayed.");
    const image = vi.fn().mockResolvedValue("The scanned image says service was helpful.");
    const legacy = vi.fn().mockResolvedValue("The legacy document says returns took too long.");
    await extractImportDrafts(file("brief.pdf"), legacy, vi.fn(), { pdf });
    await extractImportDrafts(file("brief.docx"), legacy, vi.fn(), { docx });
    await extractImportDrafts(file("scan.png"), legacy, vi.fn(), { image });
    await extractImportDrafts(file("legacy.doc"), legacy, vi.fn());
    expect(pdf).toHaveBeenCalledOnce();
    expect(docx).toHaveBeenCalledOnce();
    expect(image).toHaveBeenCalledOnce();
    expect(legacy).toHaveBeenCalledOnce();
  });

  it("maps CSV and JSON metadata into distinct fields while preserving each row as one complete review", () => {
    const csv = parseTabularText("id,date,source,review_text,author,category\nrv-101,2026-08-01,Mobile app,\"Delivery was late, but support resolved it quickly.\",Ava,Delivery\nrv-102,2026-08-02,Web,\"I love the new checkout. It is clear and fast.\",Ben,Checkout", "reviews.csv");
    expect(csv).toHaveLength(2);
    expect(csv[0]).toMatchObject({ id: "rv-101", date: "2026-08-01", source: "Mobile app", text: "Delivery was late, but support resolved it quickly.", author: "Ava", category: "Delivery", inputRecordCount: 2 });
    expect(csv[0].text).not.toContain("rv-101");
    expect(csv[0].text).not.toContain("2026-08-01");
    expect(csv[0].timestamp).toBe(new Date("2026-08-01").getTime());
    expect(parseTabularText(JSON.stringify([{ review_id: "json-8", created_at: "2026-08-03", feedback: "Refund was delayed. The eventual update was helpful.", source: "store" }]), "reviews.json")[0]).toMatchObject({ id: "json-8", date: "2026-08-03", text: "Refund was delayed. The eventual update was helpful.", source: "store" });
  });

  it("never treats periods or commas as review boundaries in raw document text", () => {
    const drafts = textToDrafts("Fast delivery, friendly service. The return process took too long.", "notes.txt");
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ id: "notes-1", text: "Fast delivery, friendly service. The return process took too long.", source: "notes.txt", inputRecordCount: 1 });
    expect(() => textToDrafts("   ", "notes.txt")).toThrow("No legible text");
  });

  it("uses the document-review parser before NLP rather than deriving records from punctuation", async () => {
    const file = { name: "feedback.txt", size: 100, text: async () => "rv-1 | 2026-08-01 | App | Delivery was late, but support was helpful.\nrv-2 | 2026-08-02 | Web | Checkout was smooth. I would buy again.", arrayBuffer: async () => new ArrayBuffer(0) } as unknown as File;
    const parseDocumentReviews = vi.fn().mockResolvedValue([
      { id: "rv-1", date: "2026-08-01", source: "App", text: "Delivery was late, but support was helpful." },
      { id: "rv-2", date: "2026-08-02", source: "Web", text: "Checkout was smooth. I would buy again." },
    ]);
    const drafts = await extractImportDrafts(file, async () => "", vi.fn(), { parseDocumentReviews });
    expect(parseDocumentReviews).toHaveBeenCalledWith({ text: await file.text(), source: "feedback.txt" });
    expect(drafts).toHaveLength(2);
    expect(drafts.map(draft => draft.id)).toEqual(["rv-1", "rv-2"]);
    expect(drafts.map(draft => draft.text)).toEqual(["Delivery was late, but support was helpful.", "Checkout was smooth. I would buy again."]);
  });

  it("flags an unexpected post-ingest review-count spike", () => {
    expect(validateIngestedReviewCount(2, 2)).toMatchObject({ valid: true, expectedRecords: 2, createdReviews: 2 });
    expect(validateIngestedReviewCount(1, 2)).toMatchObject({ valid: false, expectedRecords: 1, createdReviews: 2 });
    expect(validateIngestedReviewCount(2, 5)).toMatchObject({ valid: false, expectedRecords: 2, createdReviews: 5 });
  });

  it("extracts review fields from an XLSX worksheet", async () => {
    const sheet = XLSX.utils.json_to_sheet([{ id: "xls-42", date: "2026-08-04", source: "Retail", review_text: "The courier was quick. My parcel arrived intact.", author: "Ava", category: "Delivery" }]);
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Reviews");
    const content = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const file = { name: "reviews.xlsx", size: content.byteLength, text: async () => "", arrayBuffer: async () => content } as unknown as File;
    const reviews = await extractImportDrafts(file, async () => "", vi.fn());
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ id: "xls-42", date: "2026-08-04", source: "Retail", text: "The courier was quick. My parcel arrived intact.", author: "Ava", category: "Delivery" });
  });
});
