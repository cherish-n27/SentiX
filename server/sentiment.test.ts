import { describe, expect, it } from "vitest";
import { buildInsights, deriveActionTag, localizedAdjustment, sentimentLabel } from "./sentiment";

describe("sentiment domain logic", () => {
  it("weights localized e-commerce service terms", () => {
    const analysis = localizedAdjustment("Eish, my delivery is late and the robot cannot help.");
    expect(analysis.weight).toBeLessThan(-0.2);
    expect(analysis.category).toBe("Delivery");
  });

  it("applies stable labels and action tags", () => {
    expect(sentimentLabel(0.62)).toBe("Positive");
    expect(sentimentLabel(-0.62)).toBe("Negative");
    expect(sentimentLabel(0.04)).toBe("Neutral");
    expect(deriveActionTag("Negative", "Refunds")).toContain("Investigate");
  });

  it("summarizes evidence without inventing customer feedback", () => {
    const insights = buildInsights([
      { id: "1", text: "Fast delivery and easy returns", label: "Positive", compound: 0.8, confidence: 88, category: "Delivery", vaderCompound: 0.7, transformerConfidence: 90, transformerUsed: true, actionTag: "Protect delivery strength", timestamp: 1 },
      { id: "2", text: "Late delivery and refund waiting", label: "Negative", compound: -0.7, confidence: 86, category: "Delivery", vaderCompound: -0.6, transformerConfidence: 89, transformerUsed: true, actionTag: "Investigate delivery issue", timestamp: 2 },
    ]);
    expect(insights.topCategory).toBe("Delivery");
    expect(insights.positiveTopics[0]?.term).toBe("fast");
    expect(insights.negativeTopics.map(topic => topic.term)).toContain("late");
  });
});
