import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("SentiX workspace persistence contract", () => {
  it("registers auto-saved workbenches, review persistence, history-aware chat, and isolated quick-analysis procedures", () => {
    expect(appRouter._def.procedures["workspace.list"]).toBeDefined();
    expect(appRouter._def.procedures["workspace.create"]).toBeDefined();
    expect(appRouter._def.procedures["workspace.createAuto"]).toBeDefined();
    expect(appRouter._def.procedures["workspace.rename"]).toBeDefined();
    expect(appRouter._def.procedures["workspace.load"]).toBeDefined();
    expect(appRouter._def.procedures["workspace.saveReviews"]).toBeDefined();
    expect(appRouter._def.procedures["workspace.ask"]).toBeDefined();
    expect(appRouter._def.procedures["workspace.clearHistory"]).toBeDefined();
    expect(appRouter._def.procedures["quickAnalysis.list"]).toBeDefined();
    expect(appRouter._def.procedures["quickAnalysis.run"]).toBeDefined();
  });
});
