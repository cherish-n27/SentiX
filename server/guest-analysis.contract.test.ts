import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ analyzeReviews: vi.fn(), saveSentiXQuickAnalyses: vi.fn() }));

vi.mock("./sentiment", () => ({
  analyzeReviews: mocks.analyzeReviews,
  buildInsights: vi.fn(),
  searchReviews: vi.fn(),
}));
vi.mock("./db", () => ({
  addSentiXChatMessage: vi.fn(),
  clearSentiXChatHistory: vi.fn(),
  createSentiXWorkspace: vi.fn(),
  listSentiXQuickAnalyses: vi.fn(),
  listSentiXWorkspaces: vi.fn(),
  loadSentiXWorkspace: vi.fn(),
  renameSentiXWorkspace: vi.fn(),
  replaceSentiXWorkspaceReviews: vi.fn(),
  saveSentiXQuickAnalyses: mocks.saveSentiXQuickAnalyses,
}));

import { appRouter } from "./routers";

describe("sentiment.guestQuickAnalysis", () => {
  it("runs one stateless hybrid analysis without saving to any user-owned store", async () => {
    const result = { id: "guest-1", text: "Delivery was fast but the refund was slow.", source: "Guest quick analysis", category: "Refunds", label: "Negative" as const, compound: -0.34, confidence: 82, vaderCompound: -0.21, transformerLabel: "Negative" as const, transformerConfidence: 88, transformerUsed: true, actionTag: "Review refund updates", timestamp: 1 };
    mocks.analyzeReviews.mockResolvedValueOnce([result]);
    const caller = appRouter.createCaller({ user: null, req: {} as never, res: {} as never });

    await expect(caller.sentiment.guestQuickAnalysis({ text: result.text })).resolves.toEqual(result);
    expect(mocks.analyzeReviews).toHaveBeenCalledWith([{ text: result.text, source: "Guest quick analysis", category: "Guest trial" }]);
    expect(mocks.saveSentiXQuickAnalyses).not.toHaveBeenCalled();
  });
});
