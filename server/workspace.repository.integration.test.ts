import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { sentixChatMessages, sentixWorkspaceReviews, sentixWorkspaces } from "../drizzle/schema";
import { addSentiXChatMessage, createSentiXWorkspace, getDb, loadSentiXWorkspace, replaceSentiXWorkspaceReviews } from "./db";

const databaseTest = process.env.DATABASE_URL ? it : it.skip;

describe("SentiX workspace repository persistence", () => {
  databaseTest("persists and reopens reviews and prompt history through the real helper layer", async () => {
    const userId = 900_000_000 + Math.floor(Math.random() * 90_000_000);
    const workspace = await createSentiXWorkspace(userId, "SentiX repository verification");
    const db = await getDb();
    if (!db) throw new Error("Database was unavailable for the workspace repository test.");
    try {
      await replaceSentiXWorkspaceReviews(userId, workspace.id, [{ id: "integration-rv-1", date: "2026-08-01", text: "The refund process took too long, although the final agent was helpful.", source: "integration.xlsx", rating: 1, category: "Refunds", label: "Negative", compound: -0.74, confidence: 94, vaderCompound: -0.72, transformerConfidence: 92, transformerUsed: true, actionTag: "Investigate refund workflow", timestamp: 1_726_000_000_000 }]);
      await addSentiXChatMessage(userId, workspace.id, { role: "user", content: "What needs attention?" });
      await addSentiXChatMessage(userId, workspace.id, { role: "assistant", content: "Refunds need attention.", citations: [{ code: "TK-101", reviewId: "integration-rv-1", aspect: "Refunds" }], followUps: ["What should improve first?"] });
      const restored = await loadSentiXWorkspace(userId, workspace.id);
      expect(restored.reviews).toHaveLength(1);
      expect(restored.reviews[0]).toMatchObject({ id: "integration-rv-1", date: "2026-08-01", source: "integration.xlsx", text: "The refund process took too long, although the final agent was helpful.", category: "Refunds", compound: -0.74 });
      expect(restored.messages).toHaveLength(2);
      expect(restored.messages[1]).toMatchObject({ role: "assistant", citations: [{ code: "TK-101", reviewId: "integration-rv-1", aspect: "Refunds" }] });
    } finally {
      await db.delete(sentixChatMessages).where(eq(sentixChatMessages.workspaceId, workspace.id));
      await db.delete(sentixWorkspaceReviews).where(eq(sentixWorkspaceReviews.workspaceId, workspace.id));
      await db.delete(sentixWorkspaces).where(and(eq(sentixWorkspaces.id, workspace.id), eq(sentixWorkspaces.userId, userId)));
    }
  });
});
