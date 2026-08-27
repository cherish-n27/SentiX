import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Streamdown } from "streamdown";
import { BarChart3, Bot, Database, Download, FileSearch, Loader2, MessageSquareText, Send, Sparkles, Trash2, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

export type ChatReview = {
  id: string; date?: string; text: string; author?: string; source?: string; rating?: number | null;
  category: string; label: "Positive" | "Neutral" | "Negative"; compound: number; confidence: number;
  vaderCompound: number; transformerLabel?: "Positive" | "Neutral" | "Negative" | null;
  transformerConfidence: number | null; transformerUsed: boolean; actionTag: string; timestamp: number;
};
export type SavedPrompt = {
  role: "user" | "assistant"; content: string;
  citations?: Array<{ code: string; reviewId: string; aspect: string; source: string; sentiment: "Positive" | "Neutral" | "Negative" }>;
  followUps?: string[]; createdAt?: number;
};

const tone = { Positive: "text-emerald-300", Neutral: "text-amber-300", Negative: "text-rose-300" };
type WorkbenchSummary = { id: number; name: string; updatedAt: Date | string };
type Props = {
  open: boolean; onClose: () => void; workspaceName: string; workspaceId: number | null; reviews: ChatReview[];
  history: SavedPrompt[]; onHistoryChange: (messages: SavedPrompt[]) => void;
  onAsk: (question: string) => Promise<{ answer: string; citations: SavedPrompt["citations"]; followUps: string[] }>;
  asking: boolean; onCitation: (reviewId: string) => void; onOpenWorkspace: () => void;
  workbenches?: WorkbenchSummary[]; onSelectWorkbench?: (id: number) => void; onCreateWorkbench?: () => void;
  onQuickAnalysis?: () => void; onExportTranscript?: () => void; onClearHistory?: () => void; clearingHistory?: boolean;
};

export function SentiXChatCanvas({
  open, onClose, workspaceName, workspaceId, reviews, history, onHistoryChange, onAsk, asking, onCitation,
  onOpenWorkspace, workbenches = [], onSelectWorkbench, onCreateWorkbench, onQuickAnalysis, onExportTranscript,
  onClearHistory, clearingHistory = false,
}: Props) {
  const [draft, setDraft] = useState("");
  const [signalFocused, setSignalFocused] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const rightRailRef = useRef<HTMLDivElement>(null);

  const metrics = useMemo(() => {
    const positive = reviews.filter(review => review.label === "Positive").length;
    const negative = reviews.filter(review => review.label === "Negative").length;
    return {
      positive,
      negative,
      nss: reviews.length ? Math.round((positive - negative) / reviews.length * 100) : 0,
      confidence: reviews.length ? Math.round(reviews.reduce((sum, review) => sum + review.confidence, 0) / reviews.length) : 0,
    };
  }, [reviews]);
  const aspects = useMemo(() => Object.entries(reviews.reduce<Record<string, number>>(
    (all, review) => ({ ...all, [review.category]: (all[review.category] ?? 0) + 1 }), {},
  )).sort(([, left], [, right]) => right - left).slice(0, 5), [reviews]);
  const prompts = [...history].reverse().find(message => message.role === "assistant")?.followUps
    ?? ["What is driving negative sentiment?", "Which aspect needs attention first?", "Summarize positive service signals"];

  const scrollFeed = (position: "top" | "bottom") => {
    const feed = feedRef.current;
    if (feed && typeof feed.scrollTo === "function") feed.scrollTo({ top: position === "top" ? 0 : feed.scrollHeight, behavior: "smooth" });
  };
  const focusSignal = () => {
    setSignalFocused(true);
    if (rightRailRef.current && typeof rightRailRef.current.scrollTo === "function") rightRailRef.current.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => setSignalFocused(false), 1400);
  };
  useEffect(() => { if (open) requestAnimationFrame(() => scrollFeed("bottom")); }, [open, history, asking]);

  const send = async (raw = draft) => {
    const question = raw.trim();
    if (!question || asking) return;
    if (!workspaceId) { onOpenWorkspace(); return; }
    const user: SavedPrompt = { role: "user", content: question, createdAt: Date.now() };
    onHistoryChange([...history, user]);
    setDraft("");
    try {
      const reply = await onAsk(question);
      onHistoryChange([...history, user, {
        role: "assistant", content: reply.answer, citations: reply.citations, followUps: reply.followUps, createdAt: Date.now(),
      }]);
    } catch {
      onHistoryChange([...history, user, {
        role: "assistant", content: "I could not prepare a data answer just now. Please try again; the workbench data remains unchanged.", createdAt: Date.now(),
      }]);
    }
  };

  return <div role="dialog" aria-modal="true" aria-hidden={!open} className={`fixed inset-0 z-50 overflow-hidden overscroll-none bg-slate-950/90 backdrop-blur-sm transition-opacity duration-500 ease-[cubic-bezier(.23,1,.32,1)] ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}>
    <aside className={`fixed inset-y-0 left-0 z-10 hidden w-44 flex-col overflow-hidden border-r border-slate-700/80 bg-[#0b1120] px-3 py-5 shadow-2xl transition-transform duration-500 ease-[cubic-bezier(.23,1,.32,1)] lg:flex xl:w-56 xl:px-4 xl:py-6 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex shrink-0 items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-600"><Sparkles className="h-4 w-4 text-white" /></div><div className="min-w-0"><p className="font-extrabold tracking-tight text-slate-50">Senti<span className="text-indigo-400">X</span></p><p className="text-[9px] font-bold uppercase tracking-[.14em] text-slate-500">Chat canvas</p></div></div>
      <nav aria-label="Assistant tools" className="mt-8 shrink-0 space-y-1 xl:mt-10">
        <button type="button" onClick={() => scrollFeed("bottom")} className="flex w-full items-center gap-2 rounded-xl bg-indigo-400/10 px-2 py-2.5 text-left text-xs font-bold text-indigo-200 transition hover:bg-indigo-400/15 xl:gap-3 xl:px-3 xl:text-sm"><MessageSquareText className="h-4 w-4 shrink-0" />Data chat</button>
        <button type="button" onClick={focusSignal} className="flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left text-xs text-slate-500 transition hover:bg-slate-800 hover:text-slate-300 xl:gap-3 xl:px-3 xl:text-sm"><BarChart3 className="h-4 w-4 shrink-0" />Workbench signal</button>
        <button type="button" onClick={() => scrollFeed("top")} className="flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left text-xs text-slate-500 transition hover:bg-slate-800 hover:text-slate-300 xl:gap-3 xl:px-3 xl:text-sm"><FileSearch className="h-4 w-4 shrink-0" />Prompt history</button>
      </nav>
      <div className="mt-5 flex min-h-0 flex-1 flex-col border-t border-slate-800 pt-4">
        <Button onClick={onCreateWorkbench} size="sm" className="w-full shrink-0 bg-indigo-500 text-xs hover:bg-indigo-400"><Sparkles className="mr-2 h-3.5 w-3.5" />New workbench</Button>
        <button type="button" onClick={onQuickAnalysis} className="mt-2 flex w-full shrink-0 items-center gap-2 rounded-xl px-2 py-2.5 text-left text-xs text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 xl:px-3"><FileSearch className="h-4 w-4 shrink-0" />Quick analysis</button>
        <p className="mt-4 shrink-0 px-2 text-[9px] font-bold uppercase tracking-[.12em] text-slate-500 xl:px-3">Recent workbenches</p>
        <div aria-label="Recent workbenches" className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-1 pb-3">{workbenches.length ? workbenches.slice(0, 12).map(workbench => <button type="button" key={workbench.id} onClick={() => onSelectWorkbench?.(workbench.id)} className={`w-full rounded-lg px-2 py-2 text-left transition ${workspaceId === workbench.id ? "bg-indigo-400/10 text-indigo-200" : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"}`}><span className="block truncate text-[11px] font-semibold">{workbench.name}</span><span className="mt-0.5 block text-[9px] text-slate-600">{new Date(workbench.updatedAt).toLocaleDateString()}</span></button>) : <p className="px-2 py-2 text-[10px] leading-4 text-slate-600">Your saved workbenches will appear here.</p>}</div>
      </div>
      <div className="shrink-0 rounded-2xl border border-slate-700/80 bg-slate-900/65 p-2.5 xl:p-3"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-slate-500 xl:text-[10px]">Active workbench</p><p className="mt-2 truncate text-xs font-bold text-slate-200 xl:text-sm">{workspaceName || "Auto-saved session"}</p><p className="mt-1 text-[10px] leading-4 text-slate-500 xl:text-xs xl:leading-5">{reviews.length} review{reviews.length === 1 ? "" : "s"} · prompt history</p></div>
    </aside>

    <section className={`flex h-full min-w-0 flex-col overflow-hidden bg-[#101827] transition-all duration-500 ease-[cubic-bezier(.23,1,.32,1)] lg:ml-44 lg:mr-[280px] xl:ml-56 xl:mr-[380px] ${open ? "translate-y-0" : "translate-y-8"}`}>
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-700/80 px-5 py-4 sm:flex-nowrap sm:px-7 sm:py-5"><div className="min-w-0"><div className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-400/10 text-indigo-300"><Bot className="h-4 w-4" /></span><p className="text-sm font-extrabold text-slate-100">Data Insights Assistant</p></div><p className="mt-2 text-xs text-slate-400"><span className="font-bold text-emerald-300">{workspaceId ? "Workbench active" : "A workbench auto-saves when you begin"}</span> · {reviews.length} analyzed reviews</p></div><div className="flex shrink-0 items-center gap-2"><Button onClick={onExportTranscript} disabled={!history.length} variant="outline" className="hidden border-slate-700 bg-slate-900/60 px-3 text-slate-300 hover:bg-slate-800 hover:text-white sm:flex"><Download className="mr-2 h-4 w-4" />Transcript</Button><Button onClick={onClearHistory} disabled={!workspaceId || !history.length || clearingHistory} variant="outline" className="hidden border-slate-700 bg-slate-900/60 px-3 text-slate-300 hover:bg-slate-800 hover:text-white md:flex"><Trash2 className="mr-2 h-4 w-4" />{clearingHistory ? "Clearing…" : "Clear"}</Button><Button onClick={onClose} variant="outline" className="border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-white"><X className="mr-2 h-4 w-4" />Close Chat</Button></div></header>
      <div ref={feedRef} aria-label="Conversation history" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7"><div className="mx-auto max-w-3xl space-y-5">{history.length === 0 ? <div className="rounded-2xl border border-indigo-400/15 bg-gradient-to-br from-indigo-500/10 to-transparent p-6"><div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-400/15"><Sparkles className="h-5 w-5 text-indigo-300" /></div><div><p className="font-bold text-slate-100">Ask the active workbench</p><p className="mt-1 text-sm text-slate-400">I answer from analyzed review evidence and explain SentiX metrics, charts, and reports in plain language.</p></div></div>{!workspaceId && <Button onClick={onOpenWorkspace} className="mt-5 bg-indigo-500 hover:bg-indigo-400">Start an auto-saved workbench</Button>}</div> : history.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 ${message.role === "user" ? "bg-indigo-500 text-white" : "border border-slate-700/80 bg-slate-900/65 text-slate-200"}`}>{message.role === "assistant" ? <div className="prose prose-sm prose-invert max-w-none"><Streamdown>{message.content}</Streamdown></div> : <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>}{message.citations?.length ? <div className="mt-3 flex flex-wrap gap-2">{message.citations.map(citation => <button type="button" key={citation.code} onClick={() => onCitation(citation.reviewId)} title={`Open ${citation.aspect} evidence from ${citation.source}`} className="rounded-lg border border-indigo-400/30 bg-indigo-400/10 px-2 py-1 text-[11px] font-bold text-indigo-200 transition hover:border-indigo-300 hover:bg-indigo-400/20">[{citation.code}]</button>)}</div> : null}</div></div>)}{asking && <div className="flex items-center gap-3 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin text-indigo-300" />Reading workbench evidence…</div>}</div></div>
      <div className="shrink-0 border-t border-slate-700/80 bg-slate-950/25 px-5 py-4 sm:px-7"><div className="mx-auto max-w-3xl"><div className="mb-3 flex max-h-20 flex-wrap gap-2 overflow-y-auto overscroll-contain pr-1">{prompts.map(prompt => <button type="button" key={prompt} onClick={() => void send(prompt)} disabled={asking} className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-indigo-400/50 hover:text-indigo-200 disabled:opacity-50">{prompt}</button>)}</div><form onSubmit={event => { event.preventDefault(); void send(); }} className="flex gap-3"><Input aria-label="Ask the active workbench" value={draft} onChange={event => setDraft(event.target.value)} placeholder={workspaceId ? "Ask about reviews, aspects, sentiment, or priorities…" : "Start a workbench to begin chatting…"} disabled={!workspaceId} className="h-12 min-w-0 border-slate-700 bg-slate-900/80 text-slate-100 placeholder:text-slate-500" /><Button aria-label="Send question" type="submit" disabled={!workspaceId || !draft.trim() || asking} className="h-12 shrink-0 bg-indigo-500 px-4 hover:bg-indigo-400"><Send className="h-4 w-4" /></Button></form></div></div>
    </section>

    <aside className={`fixed inset-y-0 right-0 hidden w-[280px] flex-col overflow-hidden bg-[#0b1120] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(.23,1,.32,1)] lg:flex xl:w-[380px] ${open ? "translate-x-0" : "translate-x-full"} ${signalFocused ? "ring-2 ring-inset ring-cyan-300 shadow-[0_0_44px_rgba(34,211,238,.28)]" : ""}`}><header className="shrink-0 border-b border-slate-700/80 px-4 py-5 xl:px-5"><p className="text-sm font-extrabold text-slate-100">Workbench monitor</p><p className="mt-1 text-xs text-slate-500">Live evidence from this saved workbench.</p></header><div ref={rightRailRef} aria-label="Workbench evidence" className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><div className="grid grid-cols-2 gap-2 px-4 py-4 xl:gap-3 xl:px-5">{[["Net signal", `${metrics.nss > 0 ? "+" : ""}${metrics.nss}%`, metrics.nss >= 0 ? "text-emerald-300" : "text-rose-300"], ["Avg confidence", `${metrics.confidence}%`, "text-indigo-200"], ["Positive", String(metrics.positive), "text-emerald-300"], ["Negative", String(metrics.negative), "text-rose-300"]].map(([label, value, color]) => <div key={label} className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-2.5 xl:p-3"><p className="text-[9px] font-bold uppercase tracking-[.1em] text-slate-500 xl:text-[10px]">{label}</p><p className={`mt-2 text-lg font-extrabold xl:text-xl ${color}`}>{value}</p></div>)}</div><div className="border-y border-slate-700/80 px-4 py-4 xl:px-5"><div className="flex items-center justify-between"><p className="text-xs font-bold text-slate-200">Aspect distribution</p><Database className="h-4 w-4 text-cyan-300" /></div><div className="mt-4 space-y-3">{aspects.length ? aspects.map(([aspect, count]) => <div key={aspect}><div className="flex justify-between text-xs"><span className="truncate text-slate-400">{aspect}</span><span className="font-mono text-slate-300">{count}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400" style={{ width: `${Math.max(8, count / reviews.length * 100)}%` }} /></div></div>) : <p className="text-xs text-slate-500">No analyzed aspects yet.</p>}</div></div><div className="px-4 py-4 xl:px-5"><p className="text-xs font-bold text-slate-200">Review references</p><div className="mt-3 space-y-2 pb-6">{reviews.length ? reviews.map((review, index) => <button type="button" key={review.id} onClick={() => onCitation(review.id)} className="w-full rounded-xl border border-slate-700/70 bg-slate-900/50 p-2.5 text-left transition hover:border-indigo-400/50 hover:bg-slate-800/70 xl:p-3"><div className="flex items-center justify-between"><span className="font-mono text-[10px] font-bold text-indigo-300">[TK-{String(index + 101).padStart(3, "0")}]</span><span className={`text-[10px] font-bold ${tone[review.label]}`}>{review.label}</span></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{review.text}</p><p className="mt-2 text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">{review.category}</p></button>) : <p className="text-xs text-slate-500">No references in this workbench yet.</p>}</div></div></div></aside>
  </div>;
}
