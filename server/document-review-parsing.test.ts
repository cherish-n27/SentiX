import { afterEach, describe, expect, it, vi } from "vitest";
import { extractDocumentReviews, normalizeDocumentReviewRecords } from "./documentReviewParsing";

const originalToken = process.env.HF_TOKEN;
afterEach(() => { process.env.HF_TOKEN = originalToken; });

describe("SentiX AI document review parsing", () => {
  it("normalizes discrete AI review objects without introducing sentence fragments", () => {
    const records = normalizeDocumentReviewRecords({ reviews: [
      { id: "rv-31", date: "2026-08-01", source: "Marketplace", text: "The item arrived late, but the replacement was excellent.", author: "Ava", rating: 4, category: "Delivery" },
      { id: "rv-32", date: "2026-08-02", source: "Marketplace", text: "Checkout was simple. I would order again.", author: "Ben", rating: 5, category: "Checkout" },
    ] }, "feedback.pdf");
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ id: "rv-31", date: "2026-08-01", source: "Marketplace", text: "The item arrived late, but the replacement was excellent.", timestamp: new Date("2026-08-01").getTime() });
    expect(records[1].text).toBe("Checkout was simple. I would order again.");
  });

  it("uses the Hugging Face structured-output API with instructions that forbid punctuation splitting", async () => {
    process.env.HF_TOKEN = "test-token";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reviews: [{ id: "rv-77", date: "2026-08-05", source: "OCR", text: "Support was kind, and the issue is now resolved.", author: "Kai", rating: null, category: "Customer Care" }] }) } }] }), { status: 200 }));
    const records = await extractDocumentReviews("rv-77 2026-08-05 OCR Support was kind, and the issue is now resolved.", "scan.png", fetchMock);
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(fetchMock).toHaveBeenCalledWith("https://router.huggingface.co/v1/chat/completions", expect.any(Object));
    expect(request).toMatchObject({ model: "Qwen/Qwen2.5-7B-Instruct-1M", temperature: 0, response_format: { type: "json_schema" } });
    expect(request.messages[0].content).toContain("Do not use commas, periods");
    expect(records).toEqual([expect.objectContaining({ id: "rv-77", source: "OCR", text: "Support was kind, and the issue is now resolved." })]);
  });
});
