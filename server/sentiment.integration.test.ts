import { describe, expect, it } from "vitest";
import { analyzeReviews } from "./sentiment";

describe("hybrid sentiment analysis", () => {
  it("returns a scored result from the VADER bridge and transformer layer", async () => {
    const [result] = await analyzeReviews([
      { text: "I absolutely love the fast delivery and excellent service." },
    ]);

    expect(result).toBeDefined();
    expect(result?.label).toBe("Positive");
    expect(result?.compound).toBeGreaterThan(0.18);
    expect(result?.confidence).toBeGreaterThan(50);
    expect(result?.vaderCompound).toBeGreaterThan(0);
  }, 30_000);

  it("returns exactly one classified record for each complete imported review without changing its structured metadata", async () => {
    const results = await analyzeReviews([
      { id: "review-101", date: "2026-08-01", timestamp: new Date("2026-08-01").getTime(), source: "App", text: "Delivery was late, but the agent resolved it quickly." },
      { id: "review-102", date: "2026-08-02", timestamp: new Date("2026-08-02").getTime(), source: "Web", text: "The checkout was simple. I would order again." },
    ]);

    expect(results).toHaveLength(2);
    expect(results.map(result => ({ id: result.id, date: result.date, source: result.source, text: result.text }))).toEqual([
      { id: "review-101", date: "2026-08-01", source: "App", text: "Delivery was late, but the agent resolved it quickly." },
      { id: "review-102", date: "2026-08-02", source: "Web", text: "The checkout was simple. I would order again." },
    ]);
  }, 30_000);
});
