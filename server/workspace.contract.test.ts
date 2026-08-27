import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("SentiX workspace persistence contract", () => {
  it("registers saved workspaces, review persistence, and history-aware chat procedures", () => {
    expect(appRouter._def.procedures["workspace.list"]).toBeDefined();
    expect(appRouter._def.procedures["workspace.create"]).toBeDefined();
    expect(appRouter._def.procedures["workspace.load"]).toBeDefined();
    expect(appRouter._def.procedures["workspace.saveReviews"]).toBeDefined();
    expect(appRouter._def.procedures["workspace.ask"]).toBeDefined();
    expect(appRouter._def.procedures["workspace.clearHistory"]).toBeDefined();
  });
});
