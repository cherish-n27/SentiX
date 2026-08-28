import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { BarChart3, Clock3, MessageSquare, Plus, ArrowRight, Sparkles } from "lucide-react";
import React, { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

function formatDate(value: Date | string | number) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Workbenches() {
  const [, setLocation] = useLocation();
  const workbenches = trpc.workspace.list.useQuery();
  const workspaceUtils = trpc.useUtils();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<{ workspace: { id: number; name: string; updatedAt: Date | string | number }; reviews: Array<{ label: "Positive" | "Neutral" | "Negative" }>; messages: Array<{ role: "user" | "assistant"; content: string; createdAt: Date | string | number }> } | null>(null);

  const selectWorkspace = async (id: number) => {
    setSelectedId(id);
    const loaded = await workspaceUtils.workspace.load.fetch({ workspaceId: id });
    setSelected(loaded);
  };

  const stats = useMemo(() => {
    const reviews = selected?.reviews ?? [];
    return {
      reviews: reviews.length,
      positive: reviews.filter(review => review.label === "Positive").length,
      negative: reviews.filter(review => review.label === "Negative").length,
      messages: selected?.messages.length ?? 0,
    };
  }, [selected]);

  return <main className="min-h-screen app-dashboard fine-grid px-4 py-6 text-[#F5F7FA] sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1320px]">
      <section className="rounded-3xl border border-[#323846] bg-gradient-to-br from-[#1D232F] via-[#161B26] to-[#0B72E7]/15 p-6 shadow-2xl sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="inline-flex items-center gap-2 rounded-full border border-[#0B72E7]/30 bg-[#0B72E7]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#8ec5ff]"><Sparkles className="h-3.5 w-3.5" />Workspace library</p><h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Revisit your evidence.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#8B93A3]">Open a saved workbench to continue its review analysis, recover its assistant conversation, and see the signal footprint you last left behind.</p></div>
          <Button onClick={() => setLocation("/dashboard?new=1&chat=1")} className="h-11 bg-[#0B72E7] text-white hover:bg-[#0360B9]"><Plus className="mr-2 h-4 w-4" />New chat</Button>
        </div>
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-[#323846] bg-[#1D232F]/90 p-5">
          <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Saved workbenches</h2><p className="mt-1 text-xs text-[#8B93A3]">Your latest work appears first.</p></div><span className="rounded-full bg-[#0B72E7]/10 px-3 py-1 text-xs font-bold text-[#8ec5ff]">{workbenches.data?.length ?? 0} total</span></div>
          <div className="mt-5 space-y-3">{workbenches.isLoading ? <p className="rounded-xl border border-dashed border-[#323846] p-6 text-sm text-[#8B93A3]">Loading your workbenches…</p> : workbenches.data?.length ? workbenches.data.map(workbench => <button key={workbench.id} type="button" onClick={() => void selectWorkspace(workbench.id)} className={`flex w-full items-center justify-between gap-4 rounded-xl border p-4 text-left transition ${selectedId === workbench.id ? "border-[#0B72E7] bg-[#0B72E7]/10" : "border-[#323846] bg-[#161B26] hover:border-[#0360B9]"}`}><span className="min-w-0"><span className="block truncate font-bold">{workbench.name}</span><span className="mt-1 flex items-center gap-2 text-xs text-[#8B93A3]"><Clock3 className="h-3.5 w-3.5" />Updated {formatDate(workbench.updatedAt)}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-[#8B93A3]" /></button>) : <div className="rounded-xl border border-dashed border-[#323846] p-8 text-center"><BarChart3 className="mx-auto h-8 w-8 text-[#0B72E7]" /><h3 className="mt-3 font-bold">No saved workbenches yet</h3><p className="mt-2 text-sm text-[#8B93A3]">Start a new chat or analyze review evidence to create your first workbench.</p><Button onClick={() => setLocation("/dashboard?new=1&chat=1")} variant="outline" className="mt-5 border-[#323846] text-[#F5F7FA]"><Plus className="mr-2 h-4 w-4" />Start a new chat</Button></div>}</div>
        </section>

        <aside className="rounded-2xl border border-[#323846] bg-[#1D232F]/90 p-5">{selected ? <><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#0B72E7]">Current workbench</p><h2 className="mt-2 truncate text-xl font-extrabold">{selected.workspace.name}</h2><p className="mt-1 text-xs text-[#8B93A3]">Updated {formatDate(selected.workspace.updatedAt)}</p><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#161B26] p-3"><p className="text-2xl font-extrabold">{stats.reviews}</p><p className="text-[11px] text-[#8B93A3]">Reviews</p></div><div className="rounded-xl bg-[#161B26] p-3"><p className="text-2xl font-extrabold text-[#09BF5A]">{stats.positive}</p><p className="text-[11px] text-[#8B93A3]">Positive</p></div><div className="rounded-xl bg-[#161B26] p-3"><p className="text-2xl font-extrabold text-[#D82528]">{stats.negative}</p><p className="text-[11px] text-[#8B93A3]">Negative</p></div><div className="rounded-xl bg-[#161B26] p-3"><p className="text-2xl font-extrabold text-[#8ec5ff]">{stats.messages}</p><p className="text-[11px] text-[#8B93A3]">Chat messages</p></div></div><div className="mt-5 flex flex-col gap-2"><Button onClick={() => setLocation(`/dashboard?workspaceId=${selected.workspace.id}`)} className="bg-[#0B72E7] hover:bg-[#0360B9]"><BarChart3 className="mr-2 h-4 w-4" />Open workbench</Button><Button onClick={() => setLocation(`/dashboard?workspaceId=${selected.workspace.id}&chat=1`)} variant="outline" className="border-[#323846] text-[#F5F7FA]"><MessageSquare className="mr-2 h-4 w-4" />Continue chat</Button></div><div className="mt-6 border-t border-[#323846] pt-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8B93A3]">Recent chat</p>{selected.messages.length ? <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">{selected.messages.slice(-5).map((message, index) => <div key={`${message.createdAt}-${index}`} className={`rounded-lg p-3 text-xs ${message.role === "assistant" ? "bg-[#0B72E7]/10 text-[#cfe6ff]" : "bg-[#161B26] text-[#8B93A3]"}`}><p className="mb-1 text-[10px] font-bold uppercase text-[#8B93A3]">{message.role}</p><p className="line-clamp-3">{message.content}</p></div>)}</div> : <p className="mt-3 text-xs leading-5 text-[#8B93A3]">No chat history yet. Continue to the workbench and ask SentiX AI a question.</p>}</div></> : <div className="py-10 text-center"><MessageSquare className="mx-auto h-8 w-8 text-[#0B72E7]" /><h2 className="mt-3 font-bold">Select a workbench</h2><p className="mt-2 text-sm leading-5 text-[#8B93A3]">Its reviews, sentiment mix, and saved assistant conversation will appear here.</p></div>}</aside>
      </div>
      <p className="mt-5 text-center text-xs text-[#8B93A3]"><Link href="/dashboard" className="font-bold text-[#8ec5ff] hover:text-white">Return to Home</Link></p>
    </div>
  </main>;
}
