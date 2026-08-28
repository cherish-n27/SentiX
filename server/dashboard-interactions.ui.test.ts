// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  load: vi.fn(), create: vi.fn(), rename: vi.fn(), quickList: vi.fn(), quickRun: vi.fn(), extract: vi.fn(), documentReviews: vi.fn(), analyzeBatch: vi.fn(), saveReviews: vi.fn(), clearHistory: vi.fn(), insights: vi.fn(), download: vi.fn(), pdfSave: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1 }, isAuthenticated: true, loading: false }) }));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn(), switchable: true }) }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => createElement("button", props, children) }));
vi.mock("@/components/ui/input", () => ({ Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => createElement("input", props) }));
vi.mock("streamdown", () => ({ Streamdown: ({ children }: { children: string }) => createElement("div", null, children) }));
vi.mock("@/components/ui/scroll-area", () => ({ ScrollArea: ({ children }: { children: ReactNode }) => createElement("div", null, children) }));
vi.mock("@/lib/documentImport", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/documentImport")>()), isSupportedImport: () => true, extractImportDrafts: (...args: unknown[]) => mocks.extract(...args) }));
vi.mock("@/lib/exports", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/exports")>()), triggerDownload: (...args: unknown[]) => mocks.download(...args) }));
vi.mock("jspdf", () => ({ jsPDF: class { splitTextToSize(text: string) { return [text]; } setFont() {} setFontSize() {} text() {} addPage() {} save(name: string) { mocks.pdfSave(name); } } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock("recharts", () => ({ ResponsiveContainer: ({ children }: { children: ReactNode }) => createElement("div", null, children), PieChart: ({ children }: { children: ReactNode }) => createElement("div", null, children), Pie: ({ children }: { children: ReactNode }) => createElement("div", null, children), Cell: () => null, Legend: () => null, LineChart: ({ children }: { children: ReactNode }) => createElement("div", null, children), Line: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ workspace: { load: { fetch: mocks.load } } }),
  workspace: { list: { useQuery: () => ({ data: [{ id: 5, name: "Refund workbench", updatedAt: new Date("2026-08-27") }], refetch: vi.fn() }) }, createAuto: { useMutation: () => ({ mutateAsync: mocks.create, isPending: false }) }, rename: { useMutation: () => ({ mutateAsync: mocks.rename, isPending: false }) }, saveReviews: { useMutation: () => ({ mutateAsync: mocks.saveReviews, isPending: false }) }, ask: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) }, clearHistory: { useMutation: () => ({ mutateAsync: mocks.clearHistory, isPending: false }) } },
  quickAnalysis: { list: { useQuery: () => ({ data: mocks.quickList(), refetch: vi.fn() }) }, run: { useMutation: () => ({ mutateAsync: mocks.quickRun, isPending: false }) } },
  sentiment: { analyzeBatch: { useMutation: () => ({ mutateAsync: mocks.analyzeBatch, isPending: false }) }, analyzeText: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) }, liveSearch: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) }, extractLegacyWord: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) }, extractDocumentReviews: { useMutation: () => ({ mutateAsync: mocks.documentReviews, isPending: false }) }, insights: { useMutation: () => ({ mutateAsync: mocks.insights, isPending: false }) } },
} }));

import SentiXDashboard from "../client/src/components/SentiXDashboard";

const restoredReview = { id: "rv-restore", text: "Refund processing took too long.", source: "workspace.xlsx", rating: 1, category: "Refunds", label: "Negative" as const, compound: -0.72, confidence: 94, vaderCompound: -0.7, transformerLabel: "Negative" as const, transformerConfidence: 93, transformerUsed: true, actionTag: "Investigate refunds", timestamp: 1 };

beforeEach(() => {
  mocks.load.mockReset(); mocks.create.mockReset(); mocks.rename.mockReset(); mocks.quickList.mockReset(); mocks.quickRun.mockReset(); mocks.extract.mockReset(); mocks.documentReviews.mockReset(); mocks.analyzeBatch.mockReset(); mocks.saveReviews.mockReset(); mocks.clearHistory.mockReset(); mocks.insights.mockReset(); mocks.download.mockReset(); mocks.pdfSave.mockReset();
  mocks.load.mockResolvedValue({ workspace: { id: 5, name: "Refund workbench" }, reviews: [restoredReview], messages: [{ role: "assistant", content: "Refunds require attention.", citations: [{ code: "TK-101" }], followUps: ["What should improve first?"], createdAt: 2 }] });
  mocks.create.mockResolvedValue({ id: 17, name: "Customer feedback workbench" }); mocks.quickList.mockReturnValue([]); mocks.quickRun.mockResolvedValue([{ ...restoredReview, id: "quick-1", text: "Private feedback" }]);
  mocks.extract.mockResolvedValue([{ text: "Imported feedback from a legible document.", source: "file" }]);
  mocks.insights.mockResolvedValue({ keyPositives: "Fast delivery is valued.", frictionPoints: "Refunds need attention.", recommendations: ["Improve refund updates."] });
  let importIndex = 0;
  mocks.analyzeBatch.mockImplementation(async () => [{ ...restoredReview, id: `rv-import-${++importIndex}`, text: "Imported feedback from a legible document." }]);
});
afterEach(() => cleanup());

describe("SentiX dashboard rendered interactions", () => {
  it("automatically saves a workbench and opens Data chat when no saved session exists", async () => {
    const user = userEvent.setup(); const view = render(createElement(SentiXDashboard));
    expect(screen.getByRole("button", { name: /ask sentix ai/i }).className).toContain("fixed bottom-6 right-6");
    expect(within(view.container.querySelector("header")!).queryByRole("button", { name: /^data chat$/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: /ask sentix ai/i }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ seed: "Customer feedback analysis", reviewSnippets: [] }));
    expect(await screen.findByText("Data Insights Assistant")).toBeTruthy();
    expect(screen.getAllByText("Customer feedback workbench").length).toBeGreaterThan(0);
  });

  it("opens the tri-fold assistant from the authenticated chat deep link", () => {
    window.history.replaceState({}, "", "/dashboard?chat=1");
    render(createElement(SentiXDashboard));
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog.getAttribute("aria-hidden")).toBe("false");
    expect(dialog.className).toContain("opacity-100");
    window.history.replaceState({}, "", "/");
  });

  it.each(["/workbenches", "/quick-analysis#quick-analysis"])("loads the intended dashboard sections on the %s alias", (path) => {
    window.history.replaceState({}, "", path);
    render(createElement(SentiXDashboard));
    expect(screen.getByText("Live web search")).toBeTruthy();
    expect(screen.getByText("Dataset import")).toBeTruthy();
    expect(screen.getAllByText("Quick analysis").length).toBeGreaterThan(0);
    expect(screen.getByText("Engine Breakdown")).toBeTruthy();
    window.history.replaceState({}, "", "/");
  });

  it("communicates the next evidence-led action across zero-data dashboard states", () => {
    render(createElement(SentiXDashboard));
    expect(screen.getByText("Your signal map will appear here once review evidence is analyzed.")).toBeTruthy();
    expect(screen.getByText("Import or search for review evidence above to plot the polarity trend.")).toBeTruthy();
    expect(screen.getByText("No evidence loaded yet. Import a review file above to compare VADER, Hugging Face, and final signals.")).toBeTruthy();
    expect(screen.getByText("No review evidence in view. Import a document or run Live web search above to begin.")).toBeTruthy();
  });

  it("restores selected workspace reviews and prompt history into the dashboard UI", async () => {
    const user = userEvent.setup(); render(createElement(SentiXDashboard));
    await user.selectOptions(screen.getAllByRole("combobox")[0]!, "5");
    await waitFor(() => expect(mocks.load).toHaveBeenCalledWith({ workspaceId: 5 }));
    expect(screen.getAllByText("Refund workbench").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Refund processing took too long.").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /ask sentix ai/i }));
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
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ seed: "Imported feedback from a legible document.", reviewSnippets: ["Imported feedback from a legible document."] }));
    await waitFor(() => expect(mocks.saveReviews).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 17, reviews: [expect.objectContaining({ id: "rv-import-1" })] })));
  });

  it("downloads enriched CSV and executive PDF reports from the visible export control", async () => {
    const user = userEvent.setup(); const view = render(createElement(SentiXDashboard)); const scope = within(view.container);
    await user.selectOptions(scope.getAllByRole("combobox")[0]!, "5");
    expect(scope.getAllByText("Refund workbench").length).toBeGreaterThan(0);
    expect(scope.getByText("Customer volume trend")).toBeTruthy();
    expect(scope.getByText("Engine Breakdown")).toBeTruthy();
    expect(scope.getByText("HF refined")).toBeTruthy();
    await user.click(scope.getByRole("button", { name: /export report/i }));
    await user.click(scope.getByRole("menuitem", { name: /enriched csv/i }));
    expect(mocks.download).toHaveBeenCalledWith(expect.any(String), "refund-workbench-enriched.csv", "text/csv;charset=utf-8");
    await user.click(scope.getByRole("button", { name: /export report/i }));
    await user.click(scope.getByRole("menuitem", { name: /pdf executive report/i }));
    await waitFor(() => expect(mocks.pdfSave).toHaveBeenCalledWith("refund-workbench-executive-report.pdf"));
  });

  it("saves a personal quick analysis separately without changing business review persistence", async () => {
    const user = userEvent.setup(); render(createElement(SentiXDashboard));
    await user.type(screen.getByPlaceholderText(/paste feedback, one per line/i), "Private feedback");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(mocks.quickRun).toHaveBeenCalledWith({ texts: ["Private feedback"] }));
    expect(await screen.findByText(/private result · negative/i)).toBeTruthy();
    expect(screen.getByLabelText("Private quick analysis result").querySelector('[data-sentiment="negative"]')?.className).toContain("bg-[#D82528]/10");
    expect(screen.getByLabelText("Private quick analysis result").querySelector('[data-urgency="high-urgency"]')?.className).toContain("bg-[#F8C72D]/10");
    expect(mocks.saveReviews).not.toHaveBeenCalled();
  });
});
