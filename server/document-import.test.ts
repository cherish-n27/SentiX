import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { extractImportDrafts, getImportRoute, IMPORT_EXTENSIONS, isSupportedImport, parseTabularText, textToDrafts } from "../client/src/lib/documentImport";

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

  it("parses structured CSV and JSON review records", () => {
    expect(parseTabularText("review,author,category\nFast delivery,Ava,Delivery", "reviews.csv")[0]).toMatchObject({ text: "Fast delivery", author: "Ava", category: "Delivery" });
    expect(parseTabularText(JSON.stringify([{ feedback: "Refund was delayed", source: "store" }]), "reviews.json")[0]).toMatchObject({ text: "Refund was delayed", source: "store" });
  });

  it("converts readable document text into bounded feedback blocks and rejects empty content", () => {
    expect(textToDrafts("Fast delivery and friendly service.\n\nThe return took too long.", "notes.txt")).toHaveLength(2);
    expect(() => textToDrafts("   ", "notes.txt")).toThrow("No legible text");
  });

  it("extracts review fields from an XLSX worksheet", async () => {
    const sheet = XLSX.utils.json_to_sheet([{ review: "The courier was quick.", author: "Ava", category: "Delivery" }]);
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Reviews");
    const content = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const file = { name: "reviews.xlsx", size: content.byteLength, text: async () => "", arrayBuffer: async () => content } as unknown as File;
    const reviews = await extractImportDrafts(file, async () => "", vi.fn());
    expect(reviews[0]).toMatchObject({ text: "The courier was quick.", author: "Ava", category: "Delivery" });
  });
});
