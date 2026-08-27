// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("streamdown", () => ({ Streamdown: ({ children }: { children: string }) => createElement("div", null, children) }));
vi.mock("@/components/ui/scroll-area", () => ({ ScrollArea: ({ children }: { children: ReactNode }) => createElement("div", null, children) }));

import { SentiXChatCanvas } from "../client/src/components/SentiXChatCanvas";

const review = { id: "rv-1", text: "The refund was delayed for too long.", source: "reviews.xlsx", category: "Refunds", label: "Negative" as const, compound: -0.71, confidence: 93, vaderCompound: -0.7, transformerConfidence: 92, transformerUsed: true, actionTag: "Investigate refunds", timestamp: 1 };

describe("SentiX chat canvas UI", () => {
  it("invokes citation navigation and the center-panel Close Chat action", async () => {
    const user = userEvent.setup(); const onCitation = vi.fn(); const onClose = vi.fn(); const onExportTranscript = vi.fn(); const onClearHistory = vi.fn();
    render(createElement(SentiXChatCanvas, { open: true, onClose, workspaceName: "Review workspace", workspaceId: 5, reviews: [review], history: [{ role: "assistant", content: "Refunds need attention.", citations: [{ code: "TK-101", reviewId: "rv-1", aspect: "Refunds", source: "reviews.xlsx", sentiment: "Negative" }] }], onHistoryChange: vi.fn(), onAsk: vi.fn(), asking: false, onCitation, onOpenWorkspace: vi.fn(), onExportTranscript, onClearHistory }));
    await user.click(screen.getByRole("button", { name: "[TK-101]" }));
    expect(onCitation).toHaveBeenCalledWith("rv-1");
    await user.click(screen.getByRole("button", { name: /transcript/i }));
    expect(onExportTranscript).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(onClearHistory).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: /^data chat$/i }));
    await user.click(screen.getByRole("button", { name: /workspace signal/i }));
    expect(screen.getByText("Workspace monitor").parentElement?.parentElement?.className).toContain("ring-cyan-300");
    await user.click(screen.getByRole("button", { name: /prompt history/i }));
    await user.click(screen.getByRole("button", { name: /close chat/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
