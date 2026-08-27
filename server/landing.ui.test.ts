/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guestAnalysis: vi.fn(), startLogin: vi.fn() }));

vi.mock("@/const", () => ({ startLogin: mocks.startLogin }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => createElement("button", props, children) }));
vi.mock("@/components/ui/input", () => ({ Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => createElement("input", props) }));
vi.mock("@/lib/trpc", () => ({ trpc: { sentiment: { guestQuickAnalysis: { useMutation: () => ({ mutateAsync: mocks.guestAnalysis, isPending: false, error: null }) } } } }));

import Home from "../client/src/pages/Home";

describe("SentiX public landing", () => {
  beforeEach(() => {
    mocks.guestAnalysis.mockReset();
    mocks.startLogin.mockReset();
    mocks.guestAnalysis.mockResolvedValue({ id: "guest-1", text: "Refund took too long", category: "Refunds", label: "Negative", confidence: 84, vaderCompound: -0.52, transformerLabel: "Negative", transformerConfidence: 91, actionTag: "Review refund updates" });
  });

  it("offers a public stateless Quick Analysis with a labeled engine breakdown", async () => {
    render(createElement(Home));
    expect(screen.getByText("From customer language to a clearer operating signal.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Customer review"), { target: { value: "Refund took too long" } });
    fireEvent.click(screen.getByRole("button", { name: /analyze this review/i }));
    expect(await screen.findByText("Dual-engine breakdown")).toBeTruthy();
    expect(screen.getByText("VADER raw polarity")).toBeTruthy();
    expect(screen.getByText("Hugging Face refined")).toBeTruthy();
    expect(document.querySelector('[data-sentiment="negative"]')?.className).toContain("bg-[#D82528]/10");
    expect(document.querySelector('[data-urgency="high-urgency"]')?.className).toContain("bg-[#F8C72D]/10");
    expect(mocks.guestAnalysis).toHaveBeenCalledWith({ text: "Refund took too long" });
  });

  it("routes public sign-in and sign-up actions through their distinct hosted account modes", () => {
    render(createElement(Home));
    fireEvent.click(screen.getAllByRole("button", { name: /^sign in$/i })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: /^sign up/i })[0]!);
    expect(mocks.startLogin).toHaveBeenNthCalledWith(1, "signIn");
    expect(mocks.startLogin).toHaveBeenNthCalledWith(2, "signUp");
  });
});
