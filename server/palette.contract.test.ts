import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(import.meta.dirname, "../client/src/index.css"), "utf8");

describe("SentiX palette contract", () => {
  it("defines the requested dark brand surfaces and semantic signal colors", () => {
    for (const token of ["--background: #131722", "--card: #1D232F", "--secondary: #161B26", "--primary: #0B72E7", "--destructive: #D82528", "#09BF5A", "#F8C72D", "#4E1477", "#0360B9", "#323846"]) expect(css).toContain(token);
  });

  it("preserves an explicit readable light-mode surface treatment and shared badge semantics", () => {
    expect(css).toContain("html:not(.dark) .landing-shell");
    expect(css).toContain("--background: #F7F9FC");
    const badges = readFileSync(resolve(import.meta.dirname, "../client/src/components/SentiXBadges.tsx"), "utf8");
    expect(badges).toContain("data-sentiment");
    expect(badges).toContain("data-urgency");
  });
});
