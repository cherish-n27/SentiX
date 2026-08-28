/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ startLogin: vi.fn(), auth: { isAuthenticated: false, loading: false, user: null as { name?: string; email?: string } | null } }));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ ...mocks.auth, logout: vi.fn() }) }));
vi.mock("@/const", () => ({ startLogin: mocks.startLogin }));
vi.mock("@/components/SentiXDashboard", () => ({ default: () => createElement("div", null, "Private dashboard content") }));
vi.mock("@/pages/Workbenches", () => ({ default: () => createElement("div", null, "Saved workbenches") }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => createElement("button", props, children) }));

import Dashboard from "../client/src/pages/Dashboard";

describe("protected SentiX dashboard route", () => {
  afterEach(() => cleanup());
  beforeEach(() => { mocks.startLogin.mockReset(); mocks.auth = { isAuthenticated: false, loading: false, user: null }; });

  it("directs guests to sign in instead of exposing the dashboard", async () => {
    render(createElement(Dashboard));
    expect(screen.getByText("Sign in to open your workspace")).toBeTruthy();
    await waitFor(() => expect(mocks.startLogin).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Private dashboard content")).toBeNull();
  });

  it("renders a distinct persistent application shell for authenticated users", () => {
    mocks.auth = { isAuthenticated: true, loading: false, user: { name: "SentiX User", email: "user@example.com" } };
    render(createElement(Dashboard));
    expect(screen.getAllByLabelText("Dashboard navigation")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Home" })).toHaveLength(2);
    expect(screen.queryByText("Public home")).toBeNull();
    expect(screen.getByText("Private dashboard content")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByLabelText("Mobile navigation drawer").className).toContain("translate-x-0");
    fireEvent.click(screen.getAllByRole("button", { name: "Close navigation" })[0]!);
    expect(screen.getByLabelText("Mobile navigation drawer").className).toContain("-translate-x-full");
  });

  it.each(["/workbenches", "/quick-analysis"])("renders the authenticated app shell on %s", (path) => {
    mocks.auth = { isAuthenticated: true, loading: false, user: { name: "SentiX User", email: "user@example.com" } };
    window.history.replaceState({}, "", path);
    render(createElement(Dashboard));
    expect(screen.getByText(path === "/workbenches" ? "Saved workbenches" : "Private dashboard content")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Home" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Workbenches" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Quick Analysis" })).toHaveLength(2);
  });
});
