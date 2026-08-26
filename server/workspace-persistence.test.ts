import { describe, expect, it } from "vitest";
import { buildPersistedReviewRows, hydrateWorkspaceState } from "./db";

const review = { id: "rv-101", text: "Refund processing took too long.", source: "reviews.xlsx", rating: 1, category: "Refunds", label: "Negative" as const, compound: -0.72, confidence: 94, vaderCompound: -0.7, transformerConfidence: 93, transformerUsed: true, actionTag: "Investigate refund workflow", timestamp: 1_726_000_000_000 };

describe("SentiX workspace persistence transformations", () => {
  it("serializes analyzed reviews to the saved workspace row format", () => {
    const row = buildPersistedReviewRows(42, [review])[0];
    expect(row).toMatchObject({ workspaceId: 42, clientReviewId: "rv-101", compound: "-0.72", vaderCompound: "-0.7" });
    expect(row.reviewedAt.getTime()).toBe(review.timestamp);
  });

  it("hydrates saved reviews and prompt history for reopening a workspace", () => {
    const state = hydrateWorkspaceState([{ ...buildPersistedReviewRows(42, [review])[0]!, author: null, source: "reviews.xlsx" }], [{ role: "assistant", content: "Refund delays are the main concern.", citations: [{ code: "TK-101" }], followUps: ["What should we fix first?"], createdAt: new Date(1_726_000_001_000) }]);
    expect(state.reviews[0]).toMatchObject({ id: "rv-101", compound: -0.72, category: "Refunds" });
    expect(state.messages[0]).toMatchObject({ role: "assistant", citations: [{ code: "TK-101" }] });
  });
});
