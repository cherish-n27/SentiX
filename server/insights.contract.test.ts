import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("sentiment insights transport", () => {
  it("uses a mutation so review datasets are sent in the request body", () => {
    const procedure = appRouter._def.procedures["sentiment.insights"];
    expect(procedure?._def.type).toBe("mutation");
  });
});
