import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { buildInsights, checkVaderRuntime, deriveActionTag, fallbackVaderScores, formatVaderRuntimeHealth, localizedAdjustment, sentimentLabel } from "./sentiment";

describe("sentiment domain logic", () => {
  it("retains VADER-compatible scoring when the Python runtime is unavailable", () => {
    const [positive, negative] = fallbackVaderScores(["Fast delivery and excellent support", "The refund was delayed and the item arrived damaged"]);
    expect(positive!.compound).toBeGreaterThan(0.18);
    expect(negative!.compound).toBeLessThan(-0.18);
  });

  it("reports native VADER readiness and fallback mode clearly at startup", () => {
    expect(formatVaderRuntimeHealth({ mode: "python-nltk-vader", detail: "NLTK and the VADER lexicon are ready." })).toContain("python-nltk-vader");
    expect(formatVaderRuntimeHealth({ mode: "javascript-vader-fallback", detail: "fallback scoring is enabled." })).toContain("javascript-vader-fallback");
  });

  it("returns healthy and fallback results from actual health-check process outcomes", async () => {
    const healthy = new EventEmitter(); Object.assign(healthy, { stderr: new EventEmitter(), kill: () => true });
    const ready = checkVaderRuntime({ spawnProcess: (() => healthy) as unknown as typeof import("node:child_process").spawn, timeoutMs: 100 });
    healthy.emit("close", 0);
    await expect(ready).resolves.toMatchObject({ mode: "python-nltk-vader" });

    const unavailable = new EventEmitter(); Object.assign(unavailable, { stderr: new EventEmitter(), kill: () => true });
    const fallback = checkVaderRuntime({ spawnProcess: (() => unavailable) as unknown as typeof import("node:child_process").spawn, timeoutMs: 100 });
    unavailable.stderr.emit("data", Buffer.from("ModuleNotFoundError: No module named 'nltk'")); unavailable.emit("close", 1);
    await expect(fallback).resolves.toMatchObject({ mode: "javascript-vader-fallback" });
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
