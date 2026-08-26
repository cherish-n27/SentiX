import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const cycle = vi.hoisted(() => ({
  workspace: { id: 72, userId: 9, name: "Operational feedback", createdAt: new Date(), updatedAt: new Date() },
  reviews: [] as Array<Record<string, unknown>>,
  messages: [] as Array<Record<string, unknown>>,
}));

vi.mock("./db", () => ({
  createSentiXWorkspace: vi.fn(async () => cycle.workspace),
  listSentiXWorkspaces: vi.fn(async () => [cycle.workspace]),
  replaceSentiXWorkspaceReviews: vi.fn(async (_userId: number, _workspaceId: number, reviews: Array<Record<string, unknown>>) => { cycle.reviews = reviews; }),
  addSentiXChatMessage: vi.fn(async (_userId: number, _workspaceId: number, message: Record<string, unknown>) => { cycle.messages.push({ ...message, createdAt: Date.now() }); }),
  loadSentiXWorkspace: vi.fn(async () => ({ workspace: cycle.workspace, reviews: cycle.reviews, messages: cycle.messages })),
}));

vi.mock("./dataChat", () => ({ answerDataQuestion: vi.fn(async () => ({ answer: "Refund handling is the main operational risk.", citations: [{ code: "TK-101", reviewId: "rv-1", aspect: "Refunds", source: "xlsx", sentiment: "Negative" }], followUps: ["What should be fixed first?"] })) }));

import { appRouter } from "./routers";

function context() { return { user: { id: 9, openId: "workspace-test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), name: null, email: null, loginMethod: null }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext; }

describe("SentiX workspace persistence cycle", () => {
  it("saves analyzed reviews and prompt history, then reopens the same workspace state", async () => {
    cycle.reviews = []; cycle.messages = [];
    const caller = appRouter.createCaller(context());
    const created = await caller.workspace.create({ name: "Operational feedback" });
    await caller.workspace.saveReviews({ workspaceId: created.id, reviews: [{ id: "rv-1", text: "Refund processing took too long.", source: "xlsx", rating: 1, category: "Refunds", label: "Negative", compound: -0.72, confidence: 94, vaderCompound: -0.7, transformerConfidence: 93, transformerUsed: true, actionTag: "Investigate refunds", timestamp: 1_726_000_000_000 }] });
    await caller.workspace.ask({ workspaceId: created.id, question: "What needs attention?" });
    const restored = await caller.workspace.load({ workspaceId: created.id });
    expect(restored.reviews).toHaveLength(1);
    expect(restored.reviews[0]).toMatchObject({ id: "rv-1", category: "Refunds" });
    expect(restored.messages).toHaveLength(2);
    expect(restored.messages[0]).toMatchObject({ role: "user", content: "What needs attention?" });
    expect(restored.messages[1]).toMatchObject({ role: "assistant", citations: [{ code: "TK-101", reviewId: "rv-1", aspect: "Refunds", source: "xlsx", sentiment: "Negative" }] });
  });
});
