import { describe, expect, it } from "vitest";
import { buildEnrichedCsv, buildExecutiveReportSections } from "./exports";

describe("SentiX export payloads", () => {
  it("uses a stable enriched CSV column order and escapes review content", () => {
    const csv = buildEnrichedCsv([{
      source: "Search",
      author: "Ava",
      text: "Fast, \"helpful\" delivery",
      label: "Positive",
      compound: 0.82,
      confidence: 94,
      category: "Delivery",
      actionTag: "Protect delivery strength",
      timestamp: Date.UTC(2026, 0, 2),
    }]);

    expect(csv.split("\n")[0]).toBe("source,author,review_text,sentiment_label,compound_polarity,confidence_percent,category,action_tag,timestamp");
    expect(csv).toContain('"Fast, ""helpful"" delivery"');
    expect(csv).toContain('"2026-01-02T00:00:00.000Z"');
  });

  it("builds report sections from actual analysis evidence", () => {
    const sections = buildExecutiveReportSections(3, 33.3, {
      keyPositives: "Customers value fast delivery.",
      frictionPoints: "Refund delays remain a concern.",
      recommendations: ["Review delivery SLAs."],
    });

    expect(sections[0][1]).toContain("3 analyzed reviews");
    expect(sections[1][1]).toBe("Customers value fast delivery.");
    expect(sections[3][1]).toContain("Review delivery SLAs.");
  });
});
