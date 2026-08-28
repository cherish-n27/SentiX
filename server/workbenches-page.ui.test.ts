/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), setLocation: vi.fn() }));

vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ workspace: { load: { fetch: mocks.fetch } } }),
  workspace: { list: { useQuery: () => ({ isLoading: false, data: [{ id: 7, name: "Refund workbench", updatedAt: new Date("2026-08-27") }] }) } },
} }));
vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: { href: string; children: unknown }) => createElement("a", { href, ...props }, children), useLocation: () => ["/workbenches", mocks.setLocation] }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => createElement("button", props, children) }));

import Workbenches from "../client/src/pages/Workbenches";

describe("SentiX Workbenches page", () => {
  beforeEach(() => { mocks.fetch.mockReset(); mocks.setLocation.mockReset(); mocks.fetch.mockResolvedValue({ workspace: { id: 7, name: "Refund workbench", updatedAt: new Date("2026-08-27") }, reviews: [{ label: "Positive" }, { label: "Negative" }, { label: "Negative" }], messages: [{ role: "user", content: "What should improve?", createdAt: new Date("2026-08-27") }, { role: "assistant", content: "Refund updates need attention.", createdAt: new Date("2026-08-27") }] }); });
  afterEach(() => { document.body.innerHTML = ""; });

  it("loads saved workbench stats and chat history for revisit", async () => {
    render(createElement(Workbenches));
    fireEvent.click(screen.getByRole("button", { name: /refund workbench/i }));
    expect(await screen.findByText("Refund updates need attention.")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(mocks.fetch).toHaveBeenCalledWith({ workspaceId: 7 });
    fireEvent.click(screen.getByRole("button", { name: /open workbench/i }));
    expect(mocks.setLocation).toHaveBeenCalledWith("/dashboard?workspaceId=7");
    fireEvent.click(screen.getByRole("button", { name: /continue chat/i }));
    expect(mocks.setLocation).toHaveBeenCalledWith("/dashboard?workspaceId=7&chat=1");
  });

  it("routes New Chat to a real auto-saved chat destination", () => {
    render(createElement(Workbenches));
    fireEvent.click(screen.getByRole("button", { name: /^new chat$/i }));
    expect(mocks.setLocation).toHaveBeenCalledWith("/dashboard?new=1&chat=1");
  });
});
