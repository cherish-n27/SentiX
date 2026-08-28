/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(),
  setLocation: vi.fn(),
  authState: { isAuthenticated: false, loading: false, user: null as { name?: string; email?: string } | null },
  register: vi.fn(),
  login: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => mocks.authState }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => createElement("button", props, children) }));
vi.mock("@/components/ui/input", () => ({ Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => createElement("input", props) }));
vi.mock("@/components/SentiXDashboard", () => ({ default: () => createElement("div", null, "Protected dashboard content") }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { invalidate: mocks.invalidate } } }),
    auth: {
      register: { useMutation: (options: { onSuccess?: (result: unknown) => void }) => ({ mutateAsync: async (...args: unknown[]) => { const result = await mocks.register(...args); options.onSuccess?.(result); return result; }, isPending: false }) },
      login: { useMutation: (options: { onSuccess?: (result: unknown) => void }) => ({ mutateAsync: async (...args: unknown[]) => { const result = await mocks.login(...args); options.onSuccess?.(result); return result; }, isPending: false }) },
    },
  },
}));
vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => createElement("a", { href, ...props }, children),
  useLocation: () => ["/login", mocks.setLocation],
}));

import Auth from "../client/src/pages/Auth";
import Dashboard from "../client/src/pages/Dashboard";

describe("SentiX local account page", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authState = { isAuthenticated: false, loading: false, user: null };
    mocks.invalidate.mockResolvedValue(undefined);
    mocks.register.mockResolvedValue({ user: { id: 1 } });
    mocks.login.mockResolvedValue({ user: { id: 1 } });
    window.history.replaceState({}, "", "/login?mode=signup");
  });

  it("opens in account-creation mode from the public Sign Up route and can switch to sign-in", () => {
    render(createElement(Auth));
    expect(screen.getByRole("heading", { name: "Create your workspace" })).toBeTruthy();
    expect(screen.getByText("Your name")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
    expect(mocks.setLocation).toHaveBeenCalledWith("/login?mode=signin");
  });

  it("invalidates auth and navigates to the protected dashboard after a successful account submit", async () => {
    mocks.register.mockImplementation(async () => {
      mocks.authState = { isAuthenticated: true, loading: false, user: { name: "Sam Taylor", email: "sam@example.com" } };
      return { user: { id: 1 } };
    });
    render(createElement(Auth));
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Sam Taylor" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "sam@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "a-secure-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await vi.waitFor(() => expect(mocks.register).toHaveBeenCalledWith({ name: "Sam Taylor", email: "sam@example.com", password: "a-secure-password" }));
    expect(mocks.invalidate).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(mocks.setLocation).toHaveBeenLastCalledWith("/dashboard"));
    render(createElement(Dashboard));
    expect(screen.getAllByLabelText("Dashboard navigation")).toHaveLength(2);
    expect(screen.getByText("Protected dashboard content")).toBeTruthy();
  });

  it("recovers an existing account into the protected dashboard after a valid sign-in", async () => {
    window.history.replaceState({}, "", "/login?mode=signin");
    render(createElement(Auth));
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "sam@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "a-secure-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in to SentiX" }));

    await vi.waitFor(() => expect(mocks.login).toHaveBeenCalledWith({ email: "sam@example.com", password: "a-secure-password" }));
    expect(mocks.invalidate).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(mocks.setLocation).toHaveBeenLastCalledWith("/dashboard"));
  });
});
