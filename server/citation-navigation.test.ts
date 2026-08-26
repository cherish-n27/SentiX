import { describe, expect, it } from "vitest";
import { resolveCitationDestination } from "../client/src/lib/citationNavigation";

describe("SentiX citation navigation", () => {
  it("closes chat and applies the cited review text and aspect filter", () => {
    expect(resolveCitationDestination([{ id: "tk-1", text: "Refund processing took too long.", category: "Refunds" }], "tk-1")).toEqual({ chatOpen: false, tableSearch: "Refund processing took too long.", categoryFilter: "Refunds" });
  });
});
