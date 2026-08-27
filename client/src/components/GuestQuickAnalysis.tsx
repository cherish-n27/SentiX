import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { SentimentBadge, UrgencyBadge } from "./SentiXBadges";
import { Activity, BrainCircuit, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import React, { useState } from "react";

type Sentiment = "Positive" | "Neutral" | "Negative";
type GuestResult = { label: Sentiment; category: string; confidence: number; vaderCompound: number; transformerLabel?: Sentiment | null; transformerConfidence: number | null; actionTag: string };

function urgencyFor(label: Sentiment, confidence: number) {
  if (label === "Negative" && confidence >= 70) return "High urgency";
  if (label === "Negative") return "Review soon";
  return "Monitor";
}

export default function GuestQuickAnalysis() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<GuestResult | null>(null);
  const analysis = trpc.sentiment.guestQuickAnalysis.useMutation();

  async function runAnalysis() {
    const value = text.trim();
    if (value.length < 2) return;
    const next = await analysis.mutateAsync({ text: value });
    setResult(next);
  }

  return <section id="quick-analysis" className="landing-quick mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:px-8 lg:px-10">
    <div className="grid gap-8 rounded-3xl border border-[#323846] bg-[#1D232F] p-6 shadow-2xl shadow-black/20 lg:grid-cols-[1.05fr_.95fr] lg:p-9">
      <div><div className="inline-flex items-center gap-2 rounded-full border border-[#0B72E7]/30 bg-[#0B72E7]/10 px-3 py-1.5 text-xs font-bold text-[#8ec5ff]"><Sparkles className="h-3.5 w-3.5" />Guest Quick Analysis</div><h2 className="mt-5 text-3xl font-extrabold tracking-tight text-[#F5F7FA] sm:text-4xl">Try the aspect-based signal, no account required.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-[#8B93A3]">Paste a customer review to see a stateless hybrid assessment. This public demonstration is processed for the response only and is not stored in a workbench or personal history.</p><div className="mt-7"><label className="text-xs font-bold uppercase tracking-[.14em] text-[#8B93A3]" htmlFor="guest-review">Customer review</label><Input id="guest-review" value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void runAnalysis(); }} placeholder="e.g. Delivery was quick, but the refund process was frustrating." className="mt-3 h-12 border-[#323846] bg-[#131722] text-[#F5F7FA] placeholder:text-[#8B93A3]" /><Button onClick={() => void runAnalysis()} disabled={analysis.isPending || text.trim().length < 2} className="mt-3 h-11 w-full bg-[#0B72E7] text-white hover:bg-[#0360B9] sm:w-auto"><ScanSearch className="mr-2 h-4 w-4" />{analysis.isPending ? "Analyzing…" : "Analyze this review"}</Button>{analysis.error && <p role="alert" className="mt-3 text-sm text-[#ff9a9c]">We could not complete this trial. Please try again.</p>}</div><div className="mt-8 flex items-start gap-3 rounded-2xl border border-[#323846] bg-[#161B26] p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#09BF5A]" /><p className="text-xs leading-5 text-[#8B93A3]"><strong className="text-[#F5F7FA]">Read-only trial.</strong> Guest submissions are never written to SentiX storage. Sign in when you are ready to save business evidence and workbenches.</p></div></div>
      <div className="rounded-2xl border border-[#323846] bg-[#131722] p-5 sm:p-6">{result ? <><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8B93A3]">Trial result</p><p className="mt-2 text-lg font-extrabold text-[#F5F7FA]">One review, explained</p></div><SentimentBadge label={result.label} /></div><div className="mt-6 grid grid-cols-3 gap-3"><div className="landing-kpi"><p>Aspect</p><strong>{result.category}</strong></div><div className="landing-kpi"><p>Urgency</p><UrgencyBadge urgency={urgencyFor(result.label, result.confidence)} className="mt-2" /></div><div className="landing-kpi"><p>Confidence</p><strong>{result.confidence}%</strong></div></div><div className="mt-5 rounded-xl border border-[#323846] bg-[#161B26] p-4"><div className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-[#0B72E7]" /><p className="text-sm font-bold text-[#F5F7FA]">Dual-engine breakdown</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-[#323846] bg-[#1D232F] p-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8B93A3]">VADER raw polarity</p><p className="mt-2 font-mono text-lg font-extrabold text-[#8ec5ff]">{result.vaderCompound > 0 ? "+" : ""}{result.vaderCompound.toFixed(2)}</p></div><div className="rounded-lg border border-[#323846] bg-[#1D232F] p-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8B93A3]">Hugging Face refined</p><p className="mt-2 text-lg font-extrabold text-[#F5F7FA]">{result.transformerLabel ?? "Unavailable"}</p><p className="mt-1 font-mono text-[11px] text-[#8B93A3]">{result.transformerConfidence === null ? "No refinement returned" : `${result.transformerConfidence}% confidence`}</p></div></div><div className="mt-3 rounded-lg border border-[#09BF5A]/20 bg-[#09BF5A]/5 p-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#7fefae]">Final hybrid classification</p><p className="mt-1 text-sm font-bold text-[#F5F7FA]">{result.label} · {result.actionTag}</p></div></div></> : <div className="flex h-full min-h-[330px] flex-col items-center justify-center text-center"><span className="grid h-14 w-14 place-items-center rounded-2xl border border-[#0B72E7]/25 bg-[#0B72E7]/10 text-[#0B72E7]"><Activity className="h-6 w-6" /></span><h3 className="mt-5 text-lg font-extrabold text-[#F5F7FA]">Your result will appear here.</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[#8B93A3]">SentiX combines VADER polarity with Hugging Face refinement and aspect-aware rules.</p></div>}</div>
    </div>
  </section>;
}
