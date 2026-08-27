import { describe, expect, it } from "vitest";
import { answerProductQuestion, fallbackChat, selectCitations } from "./dataChat";

const reviews = [
  { id: "rv-1", text: "Fast delivery and helpful support.", source: "file.csv", category: "Delivery", label: "Positive" as const, compound: 0.72, confidence: 91, vaderCompound: 0.7, transformerConfidence: null, transformerUsed: false, actionTag: "Protect delivery strength", timestamp: 1 },
  { id: "rv-2", text: "My refund is delayed and customer care is slow.", source: "file.csv", category: "Refunds", label: "Negative" as const, compound: -0.68, confidence: 93, vaderCompound: -0.7, transformerConfidence: null, transformerUsed: false, actionTag: "Investigate refunds issue", timestamp: 2 },
];

describe("SentiX data chat", () => {
  it("selects cited evidence relevant to an operational question", () => {
    expect(selectCitations("What is causing refund delays?", reviews)[0]).toMatchObject({ reviewId: "rv-2", aspect: "Refunds" });
  });
  it("produces an evidence-based fallback with prompt suggestions", () => {
    const reply = fallbackChat("Where should we focus?", reviews);
    expect(reply.answer).toContain("2 analyzed reviews");
    expect(reply.citations).toHaveLength(2);
    expect(reply.followUps).toContain("What is driving negative sentiment?");
  });
  it("explains documented application metrics without manufacturing review citations", () => {
    const reply = answerProductQuestion("What is Sentiment Health Score and how does Engine Breakdown work?");
    expect(reply?.answer).toContain("Net Sentiment Score");
    expect(reply?.citations).toEqual([]);
  });
});
