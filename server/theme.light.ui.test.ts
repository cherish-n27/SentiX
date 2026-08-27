/** @vitest-environment jsdom */
import { render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "../client/src/contexts/ThemeContext";

const css = readFileSync(resolve(import.meta.dirname, "../client/src/index.css"), "utf8");

describe("SentiX light theme", () => {
  afterEach(() => { localStorage.clear(); document.documentElement.classList.remove("dark"); });

  it("honors the persisted light preference and provides dedicated landing and dashboard surface overrides", async () => {
    localStorage.setItem("theme", "light");
    render(createElement(ThemeProvider, { defaultTheme: "dark", switchable: true }, createElement("div", null, "SentiX")));
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(false));
    expect(css).toContain("html:not(.dark) .landing-shell");
    expect(css).toContain("html:not(.dark) .fine-grid");
    expect(css).toContain("#F7F9FC");
  });
});
