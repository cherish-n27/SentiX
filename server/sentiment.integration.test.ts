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
});
