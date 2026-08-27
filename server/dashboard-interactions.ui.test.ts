// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  load: vi.fn(), extract: vi.fn(), analyzeBatch: vi.fn(), saveReviews: vi.fn(), clearHistory: vi.fn(), insights: vi.fn(), download: vi.fn(), pdfSave: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1 }, isAuthenticated: true, loading: false }) }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => createElement("button", props, children) }));
vi.mock("@/components/ui/input", () => ({ Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => createElement("input", props) }));
vi.mock("streamdown", () => ({ Streamdown: ({ children }: { children: string }) => createElement("div", null, children) }));
vi.mock("@/components/ui/scroll-area", () => ({ ScrollArea: ({ children }: { children: ReactNode }) => createElement("div", null, children) }));
vi.mock("@/lib/documentImport", () => ({ isSupportedImport: () => true, extractImportDrafts: (...args: unknown[]) => mocks.extract(...args) }));
vi.mock("@/lib/exports", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/exports")>()), triggerDownload: (...args: unknown[]) => mocks.download(...args) }));
vi.mock("jspdf", () => ({ jsPDF: class { splitTextToSize(text: string) { return [text]; } setFont() {} setFontSize() {} text() {} addPage() {} save(name: string) { mocks.pdfSave(name); } } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock("recharts", () => ({ ResponsiveContainer: ({ children }: { children: ReactNode }) => createElement("div", null, children), PieChart: ({ children }: { children: ReactNode }) => createElement("div", null, children), Pie: ({ children }: { children: ReactNode }) => createElement("div", null, children), Cell: () => null, Legend: () => null, LineChart: ({ children }: { children: ReactNode }) => createElement("div", null, children), Line: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ workspace: { load: { fetch: mocks.load } } }),
  workspace: { list: { useQuery: () => ({ data: [{ id: 5, name: "Refund workspace" }], refetch: vi.fn() }) }, create: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) }, saveReviews: { useMutation: () => ({ mutateAsync: mocks.saveReviews, isPending: false }) }, ask: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) }, clearHistory: { useMutation: () => ({ mutateAsync: mocks.clearHistory, isPending: false }) } },
  sentiment: { analyzeBatch: { useMutation: () => ({ mutateAsync: mocks.analyzeBatch, isPending: false }) }, analyzeText: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) }, liveSearch: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) }, extractLegacyWord: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) }, insights: { useMutation: () => ({ mutateAsync: mocks.insights, isPending: false }) } },
} }));

import SentiXDashboard from "../client/src/components/SentiXDashboard";

const restoredReview = { id: "rv-restore", text: "Refund processing took too long.", source: "workspace.xlsx", rating: 1, category: "Refunds", label: "Negative" as const, compound: -0.72, confidence: 94, vaderCompound: -0.7, transformerConfidence: 93, transformerUsed: true, actionTag: "Investigate refunds", timestamp: 1 };

beforeEach(() => {
  mocks.load.mockReset(); mocks.extract.mockReset(); mocks.analyzeBatch.mockReset(); mocks.saveReviews.mockReset(); mocks.clearHistory.mockReset(); mocks.insights.mockReset(); mocks.download.mockReset(); mocks.pdfSave.mockReset();
  mocks.load.mockResolvedValue({ workspace: { id: 5, name: "Refund workspace" }, reviews: [restoredReview], messages: [{ role: "assistant", content: "Refunds require attention.", citations: [{ code: "TK-101" }], followUps: ["What should improve first?"], createdAt: 2 }] });
  mocks.extract.mockResolvedValue([{ text: "Imported feedback from a legible document.", source: "file" }]);
  mocks.insights.mockResolvedValue({ keyPositives: "Fast delivery is valued.", frictionPoints: "Refunds need attention.", recommendations: ["Improve refund updates."] });
  let importIndex = 0;
  mocks.analyzeBatch.mockImplementation(async () => [{ ...restoredReview, id: `rv-import-${++importIndex}`, text: "Imported feedback from a legible document." }]);
});

describe("SentiX dashboard rendered interactions", () => {
  it("restores selected workspace reviews and prompt history into the dashboard UI", async () => {
    const user = userEvent.setup(); render(createElement(SentiXDashboard));
    await user.selectOptions(screen.getAllByRole("combobox")[0]!, "5");
    await waitFor(() => expect(mocks.load).toHaveBeenCalledWith({ workspaceId: 5 }));
    expect(await screen.findByText("Active: Refund workspace")).toBeTruthy();
    expect(screen.getAllByText("Refund processing took too long.").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /data chat/i }));
    expect(await screen.findByText("Refunds require attention.")).toBeTruthy();
  });

  it("hands representative PDF, XLSX, and PNG file selections to document extraction and batch analysis", async () => {
    render(createElement(SentiXDashboard));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    for (const name of ["brief.pdf", "reviews.xlsx", "scan.png"]) {
      fireEvent.change(input, { target: { files: [new File(["content"], name, { type: "application/octet-stream" })] } });
      await waitFor(() => expect(mocks.extract).toHaveBeenCalled());
    }
    expect(mocks.extract).toHaveBeenCalledTimes(3);
    expect(mocks.analyzeBatch).toHaveBeenCalledTimes(3);
  });

  it("downloads enriched CSV and executive PDF reports from the visible export control", async () => {
    const user = userEvent.setup(); const view = render(createElement(SentiXDashboard)); const scope = within(view.container);
    await user.selectOptions(scope.getAllByRole("combobox")[0]!, "5");
    await scope.findByText("Active: Refund workspace");
    await user.click(scope.getByRole("button", { name: /export report/i }));
    await user.click(scope.getByRole("menuitem", { name: /enriched csv/i }));
    expect(mocks.download).toHaveBeenCalledWith(expect.any(String), "refund-workspace-enriched.csv", "text/csv;charset=utf-8");
    await user.click(scope.getByRole("button", { name: /export report/i }));
    await user.click(scope.getByRole("menuitem", { name: /pdf executive report/i }));
    await waitFor(() => expect(mocks.pdfSave).toHaveBeenCalledWith("refund-workspace-executive-report.pdf"));
  });
});
