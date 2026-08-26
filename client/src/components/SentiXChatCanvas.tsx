import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { BarChart3, Bot, ChevronRight, Database, FileSearch, Loader2, MessageSquareText, Send, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Sentiment = "Positive" | "Neutral" | "Negative";
export type ChatReview = {
  id: string;
  text: string;
  source?: string;
  author?: string;
  category: string;
  label: Sentiment;
  compound: number;
  confidence: number;
  vaderCompound: number;
  transformerConfidence: number | null;
  transformerUsed: boolean;
  actionTag: string;
  timestamp: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ code: string; reviewId: string; aspect: string; source: string; sentiment: Sentiment }>;
  followUps?: string[];
};

const SENTIMENT_TONE: Record<Sentiment, string> = { Positive: "text-emerald-300", Neutral: "text-amber-300", Negative: "text-rose-300" };

function metric(reviews: ChatReview[]) {
  const positive = reviews.filter(review => review.label === "Positive").length;
  const negative = reviews.filter(review => review.label === "Negative").length;
  const nss = reviews.length ? Math.round(((positive - negative) / reviews.length) * 100) : 0;
  const averageConfidence = reviews.length ? Math.round(reviews.reduce((sum, review) => sum + review.confidence, 0) / reviews.length) : 0;
  return { positive, negative, nss, averageConfidence };
}

export function SentiXChatCanvas({ isOpen, onClose, reviews, onCitation }: { isOpen: boolean; onClose: () => void; reviews: ChatReview[]; onCitation: (reviewId: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);
  const chat = trpc.sentiment.chat.useMutation();
  const metrics = useMemo(() => metric(reviews), [reviews]);
  const aspectData = useMemo(() => Object.entries(reviews.reduce<Record<string, number>>((total, review) => ({ ...total, [review.category]: (total[review.category] ?? 0) + 1 }), {})).sort(([, left], [, right]) => right - left).slice(0, 5), [reviews]);
  const sourceCount = useMemo(() => new Set(reviews.map(review => review.source ?? "Direct input")).size, [reviews]);
  const lastAssistant = [...messages].reverse().find(message => message.role === "assistant");
  const followUps = lastAssistant?.followUps ?? ["What is driving negative sentiment?", "Which aspect needs attention first?", "Summarize positive service signals"];

  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" }));
  }, [isOpen, messages, chat.isPending]);

  const send = async (question = draft) => {
    const content = question.trim();
    if (!content || chat.isPending) return;
    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: "user", content };
    setMessages(current => [...current, userMessage]);
    setDraft("");
    try {
      const reply = await chat.mutateAsync({
        question: content,
        reviews,
        history: messages.slice(-6).map(message => ({ role: message.role, content: message.content })),
      });
      setMessages(current => [...current, { id: `a-${Date.now()}`, role: "assistant", content: reply.answer, citations: reply.citations, followUps: reply.followUps }]);
    } catch {
      setMessages(current => [...current, { id: `a-${Date.now()}`, role: "assistant", content: "I could not prepare a data answer just now. Your workspace remains unchanged; please try again.", followUps }]);
    }
  };

  const citedReview = (reviewId: string) => reviews.find(review => review.id === reviewId);

  return <div aria-hidden={!isOpen} className={`fixed inset-0 z-50 overflow-hidden bg-slate-950/92 backdrop-blur-sm transition-opacity duration-500 ease-[cubic-bezier(.23,1,.32,1)] ${isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}>
    <aside className={`fixed inset-y-0 left-0 z-10 flex w-56 flex-col border-r border-slate-700/80 bg-[#0b1120] px-4 py-6 shadow-2xl transition-transform duration-500 ease-[cubic-bezier(.23,1,.32,1)] ${isOpen ? "translate-x-0" : "-translate-x-full"}`}><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-600"><Sparkles className="h-4 w-4 text-white" /></div><div><p className="font-extrabold tracking-tight text-slate-50">Senti<span className="text-indigo-400">X</span></p><p className="text-[9px] font-bold uppercase tracking-[.14em] text-slate-500">Chat canvas</p></div></div><div className="mt-10 space-y-1"><div className="flex items-center gap-3 rounded-xl bg-indigo-400/10 px-3 py-2.5 text-sm font-bold text-indigo-200"><MessageSquareText className="h-4 w-4" />Data chat</div><div className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-500"><BarChart3 className="h-4 w-4" />Workspace signal</div><div className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-500"><FileSearch className="h-4 w-4" />Evidence refs</div></div><div className="mt-auto rounded-2xl border border-slate-700/80 bg-slate-900/65 p-3"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Active dataset</p><p className="mt-2 text-sm font-bold text-slate-200">{reviews.length} review{reviews.length === 1 ? "" : "s"} in scope</p><p className="mt-1 text-xs leading-5 text-slate-500">Session-only evidence. Chat answers stay grounded in this workspace.</p></div></aside>
    <section className={`ml-56 mr-[380px] flex h-full min-w-0 flex-col border-r border-slate-700/70 bg-[#101827] transition-transform duration-500 ease-[cubic-bezier(.23,1,.32,1)] ${isOpen ? "translate-y-0" : "translate-y-8"}`}><header className="flex items-start justify-between border-b border-slate-700/80 px-7 py-5"><div><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-400/10 text-indigo-300"><Bot className="h-4 w-4" /></span><p className="text-sm font-extrabold text-slate-100">Data Insights Assistant</p></div><p className="mt-3 text-xs text-slate-400"><span className="font-bold text-emerald-300">Workspace active</span> · {reviews.length} analyzed reviews · {sourceCount} source{sourceCount === 1 ? "" : "s"} · citations open precise evidence</p></div><Button onClick={onClose} variant="outline" className="border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-white"><X className="mr-2 h-4 w-4" />Close Chat</Button></header>
      <div ref={feedRef} className="min-h-0 flex-1 overflow-y-auto px-7 py-6"><div className="mx-auto max-w-3xl space-y-5">{messages.length === 0 && <div className="rounded-2xl border border-indigo-400/15 bg-gradient-to-br from-indigo-500/10 to-transparent p-6"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-400/15"><Sparkles className="h-5 w-5 text-indigo-300" /></div><div><p className="font-bold text-slate-100">Ask the active dataset</p><p className="mt-1 text-sm text-slate-400">I summarize patterns, identify operational risks, and link each answer to review evidence.</p></div></div>{reviews.length === 0 && <p className="mt-5 rounded-xl border border-amber-400/15 bg-amber-400/5 p-3 text-sm text-amber-200">There is no review evidence yet. Import a dataset or run a search to activate cited analysis.</p>}</div>}{messages.map(message => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[86%] rounded-2xl px-4 py-3 ${message.role === "user" ? "bg-indigo-500 text-white" : "border border-slate-700/80 bg-slate-900/65 text-slate-200"}`}><p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>{message.citations?.length ? <div className="mt-3 flex flex-wrap gap-2">{message.citations.map(citation => <button key={citation.code} onClick={() => onCitation(citation.reviewId)} className="group inline-flex items-center gap-1.5 rounded-lg border border-indigo-400/25 bg-indigo-400/10 px-2 py-1 text-[11px] font-bold text-indigo-200 transition hover:border-indigo-300 hover:bg-indigo-400/20" title={`Open ${citation.aspect} evidence from ${citation.source}`}><span>[{citation.code}]</span><ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" /></button>)}</div> : null}</div></div>)}{chat.isPending && <div className="flex items-center gap-3 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin text-indigo-300" />Reading the active evidence…</div>}</div></div>
      <div className="border-t border-slate-700/80 bg-slate-950/25 px-7 py-4"><div className="mx-auto max-w-3xl"><div className="mb-3 flex flex-wrap gap-2">{followUps.map(prompt => <button key={prompt} onClick={() => void send(prompt)} disabled={chat.isPending} className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-indigo-400/50 hover:text-indigo-200 disabled:opacity-50">{prompt}</button>)}</div><form onSubmit={event => { event.preventDefault(); void send(); }} className="flex gap-3"><Input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Ask about reviews, aspects, sentiment, or operational priorities…" className="h-12 border-slate-700 bg-slate-900/80 text-slate-100 placeholder:text-slate-500" /><Button type="submit" disabled={!draft.trim() || chat.isPending} className="h-12 bg-indigo-500 px-4 hover:bg-indigo-400"><Send className="h-4 w-4" /></Button></form></div></div>
    </section>
    <aside className={`fixed inset-y-0 right-0 flex w-[380px] flex-col bg-[#0b1120] transition-transform duration-500 ease-[cubic-bezier(.23,1,.32,1)] ${isOpen ? "translate-x-0" : "translate-x-full"}`}><header className="border-b border-slate-700/80 px-5 py-5"><p className="text-sm font-extrabold text-slate-100">Workspace monitor</p><p className="mt-1 text-xs text-slate-500">Compact signals from the active evidence.</p></header><div className="grid grid-cols-2 gap-3 px-5 py-4"><div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Net signal</p><p className={`mt-2 text-xl font-extrabold ${metrics.nss >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{metrics.nss > 0 ? "+" : ""}{metrics.nss}%</p></div><div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Avg confidence</p><p className="mt-2 text-xl font-extrabold text-indigo-200">{metrics.averageConfidence}%</p></div><div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Positive</p><p className="mt-2 text-xl font-extrabold text-emerald-300">{metrics.positive}</p></div><div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Negative</p><p className="mt-2 text-xl font-extrabold text-rose-300">{metrics.negative}</p></div></div><div className="border-y border-slate-700/80 px-5 py-4"><div className="flex items-center justify-between"><p className="text-xs font-bold text-slate-200">Aspect distribution</p><Database className="h-4 w-4 text-cyan-300" /></div><div className="mt-4 space-y-3">{aspectData.length ? aspectData.map(([aspect, count]) => <div key={aspect}><div className="flex justify-between text-xs"><span className="text-slate-400">{aspect}</span><span className="font-mono text-slate-300">{count}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400" style={{ width: `${Math.max(8, count / reviews.length * 100)}%` }} /></div></div>) : <p className="text-xs text-slate-500">Import feedback to populate aspects.</p>}</div></div><div className="min-h-0 flex-1 px-5 py-4"><p className="text-xs font-bold text-slate-200">Review references</p><ScrollArea className="mt-3 h-full pr-3"><div className="space-y-2 pb-6">{reviews.length ? reviews.map((review, index) => <button key={review.id} onClick={() => onCitation(review.id)} className="w-full rounded-xl border border-slate-700/70 bg-slate-900/50 p-3 text-left transition hover:border-indigo-400/50 hover:bg-slate-800/70"><div className="flex items-center justify-between gap-3"><span className="font-mono text-[10px] font-bold text-indigo-300">[TK-{String(index + 101).padStart(3, "0")}]</span><span className={`text-[10px] font-bold ${SENTIMENT_TONE[review.label]}`}>{review.label}</span></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{review.text}</p><p className="mt-2 text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">{review.category} · {review.source ?? "Direct input"}</p></button>) : <p className="text-xs leading-5 text-slate-500">Evidence references appear after you analyze reviews.</p>}</div></ScrollArea></div></aside>
  </div>;
}
