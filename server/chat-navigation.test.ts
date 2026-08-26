import { describe, expect, it } from "vitest";
import { citationFilterText, getCitationTarget, resolveCitationNavigation } from "../client/src/lib/chatNavigation";

describe("chat citation navigation", () => {
  const reviews = [{ id: "r-101", text: "Refund processing took too long.", category: "Refunds" }];

  it("resolves a citation into the precise review filter and aspect", () => {
    expect(getCitationTarget(reviews, "r-101")).toEqual({ reviewId: "r-101", aspect: "Refunds" });
    expect(citationFilterText(reviews, "r-101")).toBe("Refund processing took too long.");
  });

  it("returns the complete dashboard navigation state for a citation click", () => {
    expect(resolveCitationNavigation(reviews, "r-101")).toEqual({
      chatOpen: false,
      tab: "dashboard",
      tableSearch: "Refund processing took too long.",
      sentimentFilter: "All",
      confidenceFilter: "0",
      categoryFilter: "Refunds",
    });
  });
});
