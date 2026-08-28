import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SentiXChatCanvas, type ChatReview, type SavedPrompt } from "@/components/SentiXChatCanvas";
import { SentimentBadge, UrgencyBadge } from "@/components/SentiXBadges";
import { extractImportDrafts, isSupportedImport, validateIngestedReviewCount, type ImportReviewDraft } from "@/lib/documentImport";
import { resolveCitationDestination } from "@/lib/citationNavigation";
import { buildChatTranscript, buildEnrichedCsv, buildExecutiveReportSections, safeExportName, triggerDownload } from "@/lib/exports";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
import { Activity, Check, CloudUpload, Download, FileDown, FileText, Inbox, Loader2, MessageSquareText, Moon, Pencil, Plus, Search, Sparkles, Sun, Upload, WandSparkles, X } from "lucide-react";
import { jsPDF } from "jspdf";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

type Sentiment = "Positive" | "Neutral" | "Negative";
type Review = ChatReview;
const COLORS: Record<Sentiment, string> = { Positive: "#09BF5A", Neutral: "#8B93A3", Negative: "#D82528" };
const percent = (value: number) => `${Math.round(value)}%`;
const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
const urgencyForReview = (review: Review): "High urgency" | "Review soon" | "Monitor" => review.label === "Negative" && review.confidence >= 70 ? "High urgency" : review.label === "Negative" ? "Review soon" : "Monitor";

function Metric({ label, value, detail, color }: { label: string; value: string; detail: string; color: string }) {
  return <div className="glass-panel rounded-2xl border border-slate-700/75 p-5"><p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-500">{label}</p><p className={`mt-4 text-3xl font-extrabold tracking-tight ${color}`}>{value}</p><p className="mt-2 text-xs text-slate-400">{detail}</p></div>;
}

function asQuickReview(value: unknown): Review | null {
  if (!value || typeof value !== "object" || !("id" in value) || !("label" in value) || !("text" in value)) return null;
  return value as Review;
}

function EngineBreakdown({ reviews, vader, hfCoverage, hfConfidence, nss }: { reviews: Review[]; vader: number; hfCoverage: number; hfConfidence: number; nss: number }) {
  return <section className="glass-panel mt-5 rounded-2xl border border-slate-700/80 p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-bold text-slate-100">Engine Breakdown</p><p className="mt-1 text-xs text-slate-400">Every row shows the same business-review evidence through both scoring engines and the final classification.</p></div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Same business-review dataset</p></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-slate-700 bg-slate-950/35 p-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-indigo-300">VADER</p><p className="mt-2 text-2xl font-extrabold text-slate-100">{signed(vader)}</p><p className="mt-1 text-xs text-slate-400">Mean raw JavaScript VADER polarity.</p></div><div className="rounded-xl border border-slate-700 bg-slate-950/35 p-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-violet-300">Hugging Face</p><p className="mt-2 text-2xl font-extrabold text-slate-100">{hfConfidence}%</p><p className="mt-1 text-xs text-slate-400">Mean refined confidence · {hfCoverage}% coverage.</p></div><div className="rounded-xl border border-slate-700 bg-slate-950/35 p-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-emerald-300">Final classification</p><p className="mt-2 text-2xl font-extrabold text-slate-100">{percent(nss)}</p><p className="mt-1 text-xs text-slate-400">Blended polarity with service-aspect rules.</p></div></div><div className="mt-5 overflow-x-auto rounded-xl border border-slate-700/80"><table className="min-w-[760px] w-full text-left text-xs"><thead className="bg-slate-950/40 text-[10px] font-bold uppercase tracking-[.11em] text-slate-500"><tr><th className="px-3 py-3">Review</th><th className="px-3 py-3">VADER raw</th><th className="px-3 py-3">HF refined</th><th className="px-3 py-3">Aspect</th><th className="px-3 py-3">Final</th></tr></thead><tbody>{reviews.length ? reviews.slice(0, 12).map(review => <tr key={review.id} className="border-t border-slate-800/90"><td className="max-w-[260px] px-3 py-3"><p className="font-mono text-[10px] text-indigo-300">{review.id}</p><p className="mt-1 line-clamp-1 text-slate-400">{review.text}</p></td><td className="px-3 py-3 font-mono font-bold text-indigo-200">{signed(review.vaderCompound)}</td><td className="px-3 py-3"><p className={review.transformerLabel === "Positive" ? "font-bold text-emerald-300" : review.transformerLabel === "Negative" ? "font-bold text-rose-300" : review.transformerLabel === "Neutral" ? "font-bold text-amber-300" : "text-slate-500"}>{review.transformerLabel ?? "Unavailable"}</p><p className="mt-0.5 font-mono text-[10px] text-slate-500">{review.transformerConfidence === null ? "—" : `${review.transformerConfidence}%`}</p></td><td className="px-3 py-3 text-slate-300">{review.category}</td><td className="px-3 py-3"><span className={review.label === "Positive" ? "font-bold text-emerald-300" : review.label === "Negative" ? "font-bold text-rose-300" : "font-bold text-amber-300"}>{review.label}</span><p className="mt-0.5 font-mono text-[10px] text-slate-500">{signed(review.compound)}</p></td></tr>) : <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No evidence loaded yet. Import a review file above to compare VADER, Hugging Face, and final signals.</td></tr>}</tbody></table></div></section>;
}

export default function SentiXDashboard({ embedded = false }: { embedded?: boolean }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [history, setHistory] = useState<SavedPrompt[]>([]);
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);
  const [workspaceName, setWorkspaceName] = useState("Untitled workbench");
  const [workbenchDraft, setWorkbenchDraft] = useState("Customer feedback analysis");
  const [renamingWorkspace, setRenamingWorkspace] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [manualText, setManualText] = useState("");
  const [quickResults, setQuickResults] = useState<Review[]>([]);
  const [tableSearch, setTableSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [chatOpen, setChatOpen] = useState(() => new URLSearchParams(window.location.search).get("chat") === "1");
  const [importProgress, setImportProgress] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const quickInputRef = useRef<HTMLInputElement>(null);
  const automaticWorkbenchCreate = useRef<Promise<boolean> | null>(null);

  const workspaceUtils = trpc.useUtils();
  const workbenches = trpc.workspace.list.useQuery(undefined, { enabled: isAuthenticated });
  const quickAnalyses = trpc.quickAnalysis.list.useQuery(undefined, { enabled: isAuthenticated });
  const createAutoWorkbench = trpc.workspace.createAuto.useMutation();
  const renameWorkbench = trpc.workspace.rename.useMutation();
  const saveReviews = trpc.workspace.saveReviews.useMutation();
  const askWorkspace = trpc.workspace.ask.useMutation();
  const clearHistory = trpc.workspace.clearHistory.useMutation();
  const analyzeBatch = trpc.sentiment.analyzeBatch.useMutation();
  const analyzeText = trpc.sentiment.analyzeText.useMutation();
  const liveSearch = trpc.sentiment.liveSearch.useMutation();
  const legacyWord = trpc.sentiment.extractLegacyWord.useMutation();
  const documentReviews = trpc.sentiment.extractDocumentReviews.useMutation();
  const reportInsights = trpc.sentiment.insights.useMutation();
  const runQuickAnalysis = trpc.quickAnalysis.run.useMutation();
  const loading = analyzeBatch.isPending || analyzeText.isPending || liveSearch.isPending || runQuickAnalysis.isPending;
  const quickHistory = useMemo(() => (quickAnalyses.data ?? []).flatMap(item => {
    const result = asQuickReview(item.analysis);
    return result ? [{ id: item.id, text: item.text, createdAt: item.createdAt, result }] : [];
  }), [quickAnalyses.data]);

  const metrics = useMemo(() => {
    const total = reviews.length;
    const positive = reviews.filter(review => review.label === "Positive").length;
    const neutral = reviews.filter(review => review.label === "Neutral").length;
    const negative = reviews.filter(review => review.label === "Negative").length;
    const category = Object.entries(reviews.reduce<Record<string, number>>((all, review) => ({ ...all, [review.category]: (all[review.category] ?? 0) + 1 }), {})).sort(([, left], [, right]) => right - left)[0]?.[0] ?? "—";
    return { total, positive, neutral, negative, category, nss: total ? (positive - negative) / total * 100 : 0 };
  }, [reviews]);
  const shownReviews = useMemo(() => reviews.filter(review => (categoryFilter === "All" || review.category === categoryFilter) && review.text.toLowerCase().includes(tableSearch.toLowerCase())), [reviews, categoryFilter, tableSearch]);
  const donut = (Object.keys(COLORS) as Sentiment[]).map(name => ({ name, value: metrics[name.toLowerCase() as "positive" | "neutral" | "negative"] }));
  const trend = [...reviews].sort((left, right) => left.timestamp - right.timestamp).map((review, index) => ({ step: `#${index + 1}`, polarity: review.compound }));
  const volumeTrend = useMemo(() => {
    const end = Date.now(); const currentStart = end - 7 * 86_400_000; const previousStart = end - 14 * 86_400_000;
    const current = reviews.filter(review => review.timestamp >= currentStart).length;
    const previous = reviews.filter(review => review.timestamp >= previousStart && review.timestamp < currentStart).length;
    const delta = current - previous;
    return { current, previous, delta, direction: delta > 0 ? "↑" : delta < 0 ? "↓" : "→" };
  }, [reviews]);
  const engines = useMemo(() => {
    const total = reviews.length || 1; const hf = reviews.filter(review => review.transformerUsed);
    return { vader: reviews.length ? reviews.reduce((sum, review) => sum + review.vaderCompound, 0) / reviews.length : 0, hfCoverage: Math.round(hf.length / total * 100), hfConfidence: hf.length ? Math.round(hf.reduce((sum, review) => sum + (review.transformerConfidence ?? 0), 0) / hf.length) : 0 };
  }, [reviews]);

  useEffect(() => {
    if (!workspaceId || !isAuthenticated) return;
    const timer = window.setTimeout(() => { void saveReviews.mutateAsync({ workspaceId, reviews }); }, 700);
    return () => window.clearTimeout(timer);
  }, [workspaceId, reviews, isAuthenticated]);

  const requireAccount = () => {
    if (!isAuthenticated) { startLogin(); return false; }
    return true;
  };
  const ensureAutoSavedWorkbench = async (reviewsToPersist = reviews, seed = workbenchDraft) => {
    if (workspaceId) return true;
    if (!requireAccount()) return false;
    if (automaticWorkbenchCreate.current) return automaticWorkbenchCreate.current;
    const creation = (async () => {
      try {
        const workspace = await createAutoWorkbench.mutateAsync({ seed: reviewsToPersist[0]?.text ?? seed, reviewSnippets: reviewsToPersist.slice(0, 5).map(review => review.text) });
        setWorkspaceId(workspace.id); setWorkspaceName(workspace.name); setWorkbenchDraft(workspace.name); setHistory([]);
        if (reviewsToPersist.length) await saveReviews.mutateAsync({ workspaceId: workspace.id, reviews: reviewsToPersist });
        await workbenches.refetch();
        toast.success(reviewsToPersist.length ? "Analysis auto-saved to a new workbench. Data chat is ready." : "New workbench auto-saved. Data chat is ready for incoming reviews.");
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "A workbench could not be auto-saved.");
        return false;
      } finally { automaticWorkbenchCreate.current = null; }
    })();
    automaticWorkbenchCreate.current = creation;
    return creation;
  };
  const addReviews = (incoming: Review[]) => {
    setReviews(current => [...incoming, ...current].slice(0, 100));
    if (isAuthenticated && !workspaceId) void ensureAutoSavedWorkbench(incoming, incoming[0]?.text);
    toast.success(`${incoming.length} review${incoming.length === 1 ? "" : "s"} analyzed.`);
  };
  const analyzeMany = async (items: ImportReviewDraft[]) => {
    if (!items.length) return toast.error("No review text was found.");
    try {
      const analyzed = await analyzeBatch.mutateAsync({ reviews: items.slice(0, 100) });
      const validation = validateIngestedReviewCount(items[0]?.inputRecordCount ?? items.length, analyzed.length);
      if (!validation.valid) throw new Error(`Import stopped: ${validation.createdReviews} reviews were created from ${validation.expectedRecords} source records. Review text was not saved because the count is unexpectedly high.`);
      addReviews(analyzed);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Analysis could not be completed."); }
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    if (!isSupportedImport(file.name)) return toast.error("Supported formats are PDF, DOC, DOCX, XLS, XLSX, TXT, PNG/JPG, CSV, and JSON.");
    try {
      setImportProgress("Preparing document…");
      const drafts = await extractImportDrafts(file, (fileName, contentBase64) => legacyWord.mutateAsync({ fileName, contentBase64 }), setImportProgress, { parseDocumentReviews: input => documentReviews.mutateAsync(input) });
      setImportProgress(`Found ${drafts.length} complete review${drafts.length === 1 ? "" : "s"}…`);
      await analyzeMany(drafts);
    } catch (error) { toast.error(error instanceof Error ? error.message : "This document could not be read."); } finally { setImportProgress(""); }
  };
  const analyzeOne = async () => {
    if (manualText.trim().length < 2) return toast.error("Enter at least two characters of feedback.");
    if (!requireAccount()) return;
    try {
      const texts = manualText.split(/\n+|\s*\|\|\s*/).map(text => text.trim()).filter(Boolean).slice(0, 10);
      const results = await runQuickAnalysis.mutateAsync({ texts });
      setQuickResults(results); setManualText(""); await quickAnalyses.refetch();
      toast.success(`${results.length} private quick ${results.length === 1 ? "analysis" : "analyses"} saved. Business workbench data is unchanged.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Quick analysis could not be completed."); }
  };
  const search = async () => {
    if (searchTerm.trim().length < 3) return toast.error("Enter a keyword phrase of at least three characters.");
    try { addReviews(await liveSearch.mutateAsync({ keyword: searchTerm })); } catch (error) { toast.error(error instanceof Error ? error.message : "Live search could not be completed."); }
  };
  const createWorkbench = async () => {
    if (!requireAccount()) return;
    try {
      const workspace = await createAutoWorkbench.mutateAsync({ seed: "New customer feedback workbench" });
      setWorkspaceId(workspace.id); setWorkspaceName(workspace.name); setWorkbenchDraft(workspace.name); setHistory([]); setReviews([]);
      await workbenches.refetch(); toast.success("New workbench created and auto-saved.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Workbench could not be created."); }
  };
  const renameActiveWorkbench = async () => {
    if (!workspaceId || workbenchDraft.trim().length < 2) return;
    try {
      const workspace = await renameWorkbench.mutateAsync({ workspaceId, name: workbenchDraft.trim() });
      setWorkspaceName(workspace.name); setWorkbenchDraft(workspace.name); setRenamingWorkspace(false); await workbenches.refetch(); toast.success("Workbench renamed.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Workbench could not be renamed."); }
  };
  const openWorkbench = async (id: number) => {
    if (!requireAccount()) return;
    try {
      const loaded = await workspaceUtils.workspace.load.fetch({ workspaceId: id });
      setWorkspaceId(loaded.workspace.id); setWorkspaceName(loaded.workspace.name); setWorkbenchDraft(loaded.workspace.name); setReviews(loaded.reviews);
      setHistory(loaded.messages.map(message => ({ role: message.role, content: message.content, citations: Array.isArray(message.citations) ? message.citations as SavedPrompt["citations"] : undefined, followUps: Array.isArray(message.followUps) ? message.followUps as string[] : undefined, createdAt: new Date(message.createdAt).getTime() })));
      toast.success("Workbench restored.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Workbench could not be opened."); }
  };
  const ask = async (question: string) => {
    if (!workspaceId) throw new Error("A workbench is required for data chat.");
    return askWorkspace.mutateAsync({ workspaceId, question });
  };
  const citation = (reviewId: string) => {
    const destination = resolveCitationDestination(reviews, reviewId);
    if (!destination) return toast.error("That cited review is no longer in this workbench.");
    setChatOpen(destination.chatOpen); setTableSearch(destination.tableSearch); setCategoryFilter(destination.categoryFilter); toast.success("Cited review and aspect filter applied.");
  };
  const openChat = async () => { if (!workspaceId && !await ensureAutoSavedWorkbench()) return; setChatOpen(true); };
  const openQuickAnalysis = () => { setChatOpen(false); window.setTimeout(() => { document.getElementById("quick-analysis")?.scrollIntoView({ behavior: "smooth", block: "center" }); quickInputRef.current?.focus(); }, 0); };
  useEffect(() => { if (isAuthenticated && !workspaceId && reviews.length) void ensureAutoSavedWorkbench(reviews, reviews[0]?.text); }, [isAuthenticated, reviews, workspaceId]);
  useEffect(() => {
    if (!isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    const requestedWorkspaceId = Number(params.get("workspaceId"));
    if (requestedWorkspaceId > 0 && requestedWorkspaceId !== workspaceId) void openWorkbench(requestedWorkspaceId);
    if (params.get("chat") === "1" && !workspaceId && !reviews.length) void ensureAutoSavedWorkbench([], "New customer feedback chat");
  }, [isAuthenticated, workspaceId]);
  const exportCsv = () => {
    if (!reviews.length) return toast.error("Analyze feedback before exporting a report.");
    setExporting("csv");
    try { triggerDownload(buildEnrichedCsv(reviews), `${safeExportName(workspaceName, "sentix-analysis")}-enriched.csv`, "text/csv;charset=utf-8"); toast.success("Enriched CSV downloaded."); } finally { setExporting(null); setExportOpen(false); }
  };
  const exportPdf = async () => {
    if (!reviews.length) return toast.error("Analyze feedback before exporting a report.");
    setExporting("pdf");
    try {
      const insights = await reportInsights.mutateAsync({ reviews }); const doc = new jsPDF({ unit: "pt", format: "a4" }); let y = 56;
      const add = (title: string, text: string) => { const lines = doc.splitTextToSize(text, 500) as string[]; if (y + lines.length * 15 + 42 > 780) { doc.addPage(); y = 56; } doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(title, 48, y); y += 20; doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(lines, 48, y); y += lines.length * 15 + 20; };
      doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text("SentiX Executive Report", 48, y); y += 32; doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`Workbench: ${workspaceName} · Generated ${new Date().toLocaleString()}`, 48, y); y += 30;
      buildExecutiveReportSections(metrics.total, metrics.nss, insights).forEach(([title, text]) => add(title, text)); add("Review evidence", reviews.slice(0, 10).map((review, index) => `${index + 1}. [${review.label}] ${review.category}: ${review.text}`).join("\n"));
      doc.save(`${safeExportName(workspaceName, "sentix-analysis")}-executive-report.pdf`); toast.success("Executive PDF report downloaded.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Report export could not be completed."); } finally { setExporting(null); setExportOpen(false); }
  };
  const exportTranscript = () => { if (!history.length) return toast.error("Ask the assistant before exporting a transcript."); triggerDownload(buildChatTranscript(workspaceName, history), `${safeExportName(workspaceName, "sentix-workbench")}-chat-transcript.txt`, "text/plain;charset=utf-8"); toast.success("Chat transcript downloaded."); };
  const clearPromptHistory = async () => { if (!workspaceId) return; try { await clearHistory.mutateAsync({ workspaceId }); setHistory([]); toast.success("Prompt history cleared from this workbench."); } catch (error) { toast.error(error instanceof Error ? error.message : "Prompt history could not be cleared."); } };

  return <div className={embedded ? "min-h-screen app-dashboard fine-grid" : "min-h-screen fine-grid"}>
    <header className="sticky top-0 z-30 border-b border-slate-700/75 bg-[#0f172a]/90 backdrop-blur-xl"><div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-600"><Sparkles className="h-5 w-5 text-white" /></div><div><p className="text-lg font-extrabold tracking-tight text-slate-50">Senti<span className="text-indigo-400">X</span></p><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Sentiment intelligence</p></div></div><div className="flex items-center gap-2"><Button aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={toggleTheme} size="icon" variant="outline" className="border-slate-700 bg-slate-800/55 text-slate-200 hover:bg-slate-700 hover:text-white">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button><div className="relative"><Button onClick={() => setExportOpen(value => !value)} variant="outline" className="hidden border-slate-700 bg-slate-800/55 text-slate-200 hover:bg-slate-700 hover:text-white sm:flex"><FileText className="mr-2 h-4 w-4" />Export report</Button>{exportOpen && <div role="menu" className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl shadow-slate-950/50"><button role="menuitem" onClick={exportPdf} disabled={exporting !== null} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"><FileDown className="h-4 w-4 text-rose-300" />{exporting === "pdf" ? "Building report…" : "PDF executive report"}</button><button role="menuitem" onClick={exportCsv} disabled={exporting !== null} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"><Download className="h-4 w-4 text-emerald-300" />{exporting === "csv" ? "Preparing CSV…" : "Enriched CSV dataset"}</button></div>}</div></div></div></header>
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-slate-700/70 bg-gradient-to-br from-slate-800/80 via-slate-900/70 to-indigo-950/40 p-5 shadow-2xl shadow-slate-950/25 sm:p-7"><div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end"><div><p className="inline-flex rounded-full border border-indigo-400/20 bg-indigo-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-indigo-300">Executive intelligence</p><h1 className="mt-4 max-w-2xl text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Turn customer feedback into a clear operational signal.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Import legible documents, analyze customer evidence, and keep each business session in an auto-saved workbench.</p></div><div className="rounded-2xl border border-slate-700 bg-slate-950/25 p-4 xl:w-[410px]"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">Current workbench</p><Button onClick={() => void createWorkbench()} disabled={createAutoWorkbench.isPending || authLoading} size="sm" className="h-8 bg-indigo-500 px-3 text-xs hover:bg-indigo-400"><Plus className="mr-1.5 h-3.5 w-3.5" />New workbench</Button></div>{renamingWorkspace ? <div className="mt-3 flex gap-2"><Input autoFocus value={workbenchDraft} onChange={event => setWorkbenchDraft(event.target.value)} onKeyDown={event => event.key === "Enter" && void renameActiveWorkbench()} className="border-slate-700 bg-slate-900/80 text-sm text-slate-100" /><Button size="icon" onClick={() => void renameActiveWorkbench()} disabled={renameWorkbench.isPending} className="bg-indigo-500 hover:bg-indigo-400"><Check className="h-4 w-4" /></Button><Button size="icon" variant="outline" onClick={() => { setWorkbenchDraft(workspaceName); setRenamingWorkspace(false); }} className="border-slate-700 text-slate-300"><X className="h-4 w-4" /></Button></div> : <button onDoubleClick={() => { if (workspaceId) setRenamingWorkspace(true); }} className="mt-3 flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-900/55 px-3 py-2 text-left"><span className="truncate text-sm font-bold text-slate-200">{workspaceName}</span><Pencil className="h-3.5 w-3.5 text-slate-500" /></button>}{isAuthenticated ? <select value={workspaceId ?? ""} onChange={event => event.target.value && void openWorkbench(Number(event.target.value))} className="mt-3 h-9 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 text-xs text-slate-300"><option value="">Open a saved workbench…</option>{workbenches.data?.map(workbench => <option key={workbench.id} value={workbench.id}>{workbench.name} · {new Date(workbench.updatedAt).toLocaleDateString()}</option>)}</select> : <Button onClick={() => startLogin()} variant="outline" className="mt-3 w-full border-slate-700 text-slate-300">Sign in to retain workbenches</Button>}<p className="mt-2 text-xs text-slate-500">{workspaceId ? `${reviews.length} review${reviews.length === 1 ? "" : "s"} · auto-saved session` : "A workbench is created automatically when you analyze or chat."}</p></div></div></section>
      <section className="mt-6 grid gap-4 xl:grid-cols-3"><div className="glass-panel rounded-2xl border border-slate-700/80 p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-slate-100">Live web search</p><p className="mt-1 text-xs text-slate-400">Structured snippets via SerpApi.</p></div><Search className="h-5 w-5 text-indigo-400" /></div><div className="mt-4 flex gap-2"><Input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} onKeyDown={event => event.key === "Enter" && void search()} placeholder="e.g. delivery experience" className="border-slate-700 bg-slate-950/45 text-slate-100" /><Button onClick={() => void search()} disabled={loading} className="bg-indigo-500 hover:bg-indigo-400">{liveSearch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button></div></div><div className="glass-panel rounded-2xl border border-slate-700/80 p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-slate-100">Dataset import</p><p className="mt-1 text-xs text-slate-400">PDF, Word, Excel, TXT, image, CSV, JSON · 8 MB max.</p></div><Upload className="h-5 w-5 text-cyan-400" /></div><button disabled={Boolean(importProgress)} onClick={() => inputRef.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void importFile(event.dataTransfer.files[0]); }} className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-2.5 text-xs font-bold disabled:cursor-wait ${dragging ? "border-indigo-400 bg-indigo-400/10 text-indigo-200" : "border-slate-700 bg-slate-950/30 text-slate-400 hover:border-slate-500"}`}>{importProgress ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}{importProgress || "Drop file or browse"}</button><input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.csv,.json" onChange={event => void importFile(event.target.files?.[0])} className="hidden" /></div><div id="quick-analysis" className="glass-panel rounded-2xl border border-slate-700/80 p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-slate-100">Quick analysis</p><p className="mt-1 text-xs text-slate-400">Private one-off checks, never added to business workbenches.</p></div><Activity className="h-5 w-5 text-emerald-400" /></div><div className="mt-4 flex gap-2"><Input ref={quickInputRef} value={manualText} onChange={event => setManualText(event.target.value)} onKeyDown={event => event.key === "Enter" && void analyzeOne()} placeholder="Paste feedback, one per line for a small batch…" className="border-slate-700 bg-slate-950/45 text-slate-100" /><Button onClick={() => void analyzeOne()} disabled={loading} className="bg-indigo-500 hover:bg-indigo-400">{runQuickAnalysis.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}</Button></div>{quickResults[0] && <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs"><p className="font-bold text-emerald-200">Private result · {quickResults[0].label} · {quickResults[0].confidence}% confidence</p><p className="mt-1 text-slate-400">{quickResults[0].category} · {quickResults[0].actionTag}</p></div>}<div className="mt-3 border-t border-slate-800 pt-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">My Quick Analyses</p>{quickHistory.length ? <div className="mt-2 max-h-24 space-y-1 overflow-y-auto">{quickHistory.slice(0, 4).map(item => <button key={item.id} onClick={() => setQuickResults([item.result])} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"><span className="truncate">{item.text}</span><span className="shrink-0 font-bold text-emerald-300">{item.result.label}</span></button>)}</div> : <p className="mt-2 text-[10px] text-slate-600">Private results you run will stay here, separate from business data.</p>}</div></div></section>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-7"><Metric label="Reviews processed" value={metrics.total.toLocaleString()} detail={workspaceId ? "Current workbench evidence" : "Current analysis session"} color="text-slate-50" /><Metric label="Net sentiment score" value={percent(metrics.nss)} detail="Positive minus negative share" color="text-emerald-300" /><Metric label="Positive vs. negative" value={`${metrics.total ? Math.round(metrics.positive / metrics.total * 100) : 0}% / ${metrics.total ? Math.round(metrics.negative / metrics.total * 100) : 0}%`} detail="Distribution ratio" color="text-amber-300" /><Metric label="Top category" value={metrics.category} detail="Most frequent service signal" color="text-cyan-300" /><Metric label="VADER polarity" value={signed(engines.vader)} detail="Raw JavaScript VADER mean" color="text-indigo-200" /><Metric label="HF coverage" value={`${engines.hfCoverage}%`} detail="Reviews with refined signal" color="text-violet-200" /><Metric label="Customer volume trend" value={`${volumeTrend.direction} ${volumeTrend.current}`} detail={`${Math.abs(volumeTrend.delta)} vs. prior 7 days`} color={volumeTrend.delta >= 0 ? "text-emerald-300" : "text-rose-300"} /></section>
      <section className="mt-5 grid gap-5 xl:grid-cols-5"><div className="glass-panel rounded-2xl border border-slate-700/80 p-5 xl:col-span-2"><p className="font-bold text-slate-100">Sentiment breakout</p>{metrics.total ? <div className="mt-3 h-56"><ResponsiveContainer><PieChart><Pie data={donut} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={5}>{donut.map(item => <Cell key={item.name} fill={COLORS[item.name as Sentiment]} />)}</Pie><Legend /></PieChart></ResponsiveContainer></div> : <p className="mt-16 text-center text-sm text-slate-500">Your signal map will appear here once review evidence is analyzed.</p>}</div><div className="glass-panel rounded-2xl border border-slate-700/80 p-5 xl:col-span-3"><p className="font-bold text-slate-100">Polarity trend</p>{trend.length ? <div className="mt-3 h-56"><ResponsiveContainer><LineChart data={trend}><XAxis dataKey="step" /><YAxis domain={[-1, 1]} /><RechartsTooltip /><Line type="monotone" dataKey="polarity" stroke="#818cf8" strokeWidth={3} /></LineChart></ResponsiveContainer></div> : <p className="mt-16 text-center text-sm text-slate-500">Import or search for review evidence above to plot the polarity trend.</p>}</div></section>
      {quickResults[0] && <section aria-label="Private quick analysis result" className="glass-panel mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700/80 p-5"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Latest private Quick Analysis</p><p className="mt-2 text-sm font-bold text-slate-100">{quickResults[0].category} · {quickResults[0].confidence}% confidence</p><p className="mt-1 text-xs text-slate-400">{quickResults[0].actionTag}</p></div><div className="flex flex-wrap items-center gap-2"><SentimentBadge label={quickResults[0].label} /><UrgencyBadge urgency={urgencyForReview(quickResults[0])} /></div></section>}
      <EngineBreakdown reviews={reviews} vader={engines.vader} hfCoverage={engines.hfCoverage} hfConfidence={engines.hfConfidence} nss={metrics.nss} />
      <section className="glass-panel mt-5 overflow-hidden rounded-2xl border border-slate-700/80"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 px-5 py-4"><div><p className="font-bold text-slate-100">Categorized review results</p><p className="mt-1 text-xs text-slate-400">Citation clicks return here with an exact review and aspect filter.</p></div><div className="flex gap-2"><select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-300"><option>All</option>{Array.from(new Set(reviews.map(review => review.category))).map(category => <option key={category}>{category}</option>)}</select><Input value={tableSearch} onChange={event => setTableSearch(event.target.value)} placeholder="Filter review text" className="h-9 w-48 border-slate-700 bg-slate-900 text-xs text-slate-100" /></div></div><div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left"><thead className="bg-slate-950/25"><tr className="text-[10px] font-bold uppercase tracking-[.13em] text-slate-500"><th className="px-5 py-3">Source / author</th><th className="px-5 py-3">Review text</th><th className="px-5 py-3">Sentiment</th><th className="px-5 py-3">Polarity</th><th className="px-5 py-3">Confidence</th><th className="px-5 py-3">Action tag</th></tr></thead><tbody>{shownReviews.length ? shownReviews.map(review => <tr key={review.id} className="border-t border-slate-800/90"><td className="px-5 py-4"><p className="text-sm font-semibold text-slate-200">{review.source ?? "Direct input"}</p><p className="text-xs text-slate-500">{review.author ?? "Unattributed"}</p></td><td className="max-w-[370px] px-5 py-4"><p className="line-clamp-2 text-sm text-slate-300">{review.text}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.1em] text-slate-500">{review.category}</p></td><td className="px-5 py-4"><span className={review.label === "Positive" ? "text-emerald-300" : review.label === "Negative" ? "text-rose-300" : "text-amber-300"}>{review.label}</span></td><td className="px-5 py-4 font-mono text-sm text-slate-300">{signed(review.compound)}</td><td className="px-5 py-4 font-mono text-xs text-slate-300">{review.confidence}%</td><td className="px-5 py-4 text-xs text-slate-400">{review.actionTag}</td></tr>) : <tr><td colSpan={6} className="px-5 py-14 text-center"><Inbox className="mx-auto h-7 w-7 text-slate-600" /><p className="mt-3 font-semibold text-slate-300">No review evidence in view. Import a document or run Live web search above to begin.</p></td></tr>}</tbody></table></div></section>
    </main>
    <Button onClick={() => void openChat()} className="fixed bottom-6 right-6 z-20 h-12 rounded-full bg-indigo-500 px-5 text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-400"><MessageSquareText className="mr-2 h-4 w-4" />Ask SentiX AI</Button>
    <SentiXChatCanvas open={chatOpen} onClose={() => setChatOpen(false)} workspaceName={workspaceName} workspaceId={workspaceId} reviews={reviews} history={history} onHistoryChange={setHistory} onAsk={ask} asking={askWorkspace.isPending} onCitation={citation} onOpenWorkspace={() => { void ensureAutoSavedWorkbench(); }} workbenches={workbenches.data ?? []} onSelectWorkbench={id => { void openWorkbench(id); }} onCreateWorkbench={() => { void createWorkbench(); }} onQuickAnalysis={openQuickAnalysis} onExportTranscript={exportTranscript} onClearHistory={clearPromptHistory} clearingHistory={clearHistory.isPending} />
  </div>;
}
