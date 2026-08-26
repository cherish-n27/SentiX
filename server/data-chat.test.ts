import { describe, expect, it } from "vitest";
import { buildDataChatFallback, selectDataCitations } from "./dataChat";

const reviews = [
  { id: "r-1", text: "The delivery was quick and helpful.", source: "feedback.csv", label: "Positive" as const, compound: 0.71, confidence: 89, category: "Delivery", vaderCompound: 0.7, transformerConfidence: null, transformerUsed: false, actionTag: "Protect delivery strength", timestamp: 1 },
  { id: "r-2", text: "My refund is delayed and support is slow.", source: "feedback.csv", label: "Negative" as const, compound: -0.68, confidence: 91, category: "Refunds", vaderCompound: -0.7, transformerConfidence: null, transformerUsed: false, actionTag: "Investigate refunds issue", timestamp: 2 },
];

describe("SentiX data chat evidence", () => {
  it("selects navigable citations relevant to the question", () => {
    const citations = selectDataCitations("What is causing refund delays?", reviews);
    expect(citations[0]).toMatchObject({ code: "TK-102", reviewId: "r-2", aspect: "Refunds" });
  });

  it("answers from active-session metrics and supplies citations without fabricating feedback", () => {
    const reply = buildDataChatFallback("Where should we focus?", reviews);
    expect(reply.answer).toContain("2 analyzed reviews");
    expect(reply.answer).toContain("Net Sentiment Score");
    expect(reply.citations).toHaveLength(2);
    expect(reply.followUps).toContain("What is driving negative sentiment?");
  });
});
