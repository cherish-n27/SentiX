import { describe, expect, it } from "vitest";
import { fallbackWorkbenchName } from "./workbenchNaming";

describe("SentiX workbench naming", () => {
  it("creates a concise descriptive fallback from opening review evidence", () => {
    expect(fallbackWorkbenchName("", ["My delivery is late and the courier did not update me."])).toBe("Delivery review analysis");
    expect(fallbackWorkbenchName("Refund waiting times", [])).toBe("Refund review analysis");
  });

  it("uses a neutral analysis title when evidence carries no recognizable topic", () => {
    expect(fallbackWorkbenchName()).toBe("Customer feedback analysis");
  });
});
