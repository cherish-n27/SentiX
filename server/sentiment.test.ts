import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { buildInsights, checkVaderRuntime, deriveActionTag, fallbackVaderScores, formatVaderRuntimeHealth, localizedAdjustment, sentimentLabel } from "./sentiment";

describe("sentiment domain logic", () => {
  it("uses VADER-compatible JavaScript scoring without a Python runtime", () => {
    const [positive, negative] = fallbackVaderScores(["Fast delivery and excellent support", "The refund was delayed and the item arrived damaged"]);
    expect(positive!.compound).toBeGreaterThan(0.18);
    expect(negative!.compound).toBeLessThan(-0.18);
  });

  it("reports JavaScript VADER readiness clearly at startup", () => {
    expect(formatVaderRuntimeHealth({ mode: "javascript-vader", detail: "The bundled JavaScript VADER engine is ready." })).toContain("javascript-vader");
  });

  it("performs readiness validation without spawning a child process", async () => {
    await expect(checkVaderRuntime()).resolves.toMatchObject({ mode: "javascript-vader" });
  });

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
