import GuestQuickAnalysis from "@/components/GuestQuickAnalysis";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import {
  ArrowRight,
  BarChart3,
  BotMessageSquare,
  BrainCircuit,
  Database,
  LockKeyhole,
  Sparkles,
  TableProperties,
} from "lucide-react";
import React from "react";

const capabilities = [
  {
    icon: BrainCircuit,
    title: "Aspect-Based Analysis",
    body: "Classify the service theme behind every review, then see the operational signal behind the sentiment.",
  },
  {
    icon: BarChart3,
    title: "Dual-Engine NLP",
    body: "Compare interpretable VADER polarity with Hugging Face refinement and the final hybrid classification.",
  },
  {
    icon: BotMessageSquare,
    title: "Ask Your Data",
    body: "Turn saved review evidence into cited answers, follow-up prompts, and focused investigation paths.",
  },
  {
    icon: TableProperties,
    title: "Workbenches",
    body: "Keep distinct business review sets together with their history, exports, and evidence trail.",
  },
  {
    icon: LockKeyhole,
    title: "Read-Only Integrity",
    body: "SentiX preserves your submitted review evidence while producing an auditable analytical layer.",
  },
  {
    icon: Database,
    title: "Structured Imports",
    body: "Bring in legible spreadsheets and documents while keeping IDs, dates, sources, and review text distinct.",
  },
];

function SignalCard({
  label,
  tag,
  tagClassName,
  widthClassName,
  barClassName,
}: {
  label: string;
  tag: string;
  tagClassName: string;
  widthClassName: string;
  barClassName: string;
}) {
  return (
    <div className="rounded-2xl border border-[#323846] bg-[#161B26] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-[#F5F7FA]">{label}</span>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${tagClassName}`}>{tag}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#323846]">
        <div className={`h-full rounded-full ${widthClassName} ${barClassName}`} />
      </div>
    </div>
  );
}

export default function Home() {
  const goToTrial = () => document.getElementById("quick-analysis")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const openSignIn = () => startLogin("signIn");
  const openSignUp = () => startLogin("signUp");

  return (
    <div className="landing-shell min-h-screen overflow-x-hidden bg-[#131722] text-[#F5F7FA]">
      <header className="sticky top-0 z-30 border-b border-[#323846]/80 bg-[#131722]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
          <a href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0B72E7] text-white shadow-lg shadow-[#0B72E7]/20">
              <Sparkles className="h-5 w-5" />
            </span>
            <span>
              <strong className="block tracking-tight">SentiX</strong>
              <span className="block text-[9px] font-bold uppercase tracking-[.15em] text-[#8B93A3]">Aspect-Based Review Intelligence</span>
            </span>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-[#8B93A3] md:flex" aria-label="Public site">
            <a className="transition hover:text-[#F5F7FA]" href="#features">Features</a>
            <button onClick={goToTrial} className="transition hover:text-[#F5F7FA]">Quick Analysis</button>
            <a className="transition hover:text-[#F5F7FA]" href="#integrity">Integrity</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button onClick={openSignIn} variant="ghost" className="hidden text-[#F5F7FA] hover:bg-[#1D232F] sm:flex">Sign In</Button>
            <Button onClick={openSignUp} className="bg-[#0B72E7] text-white hover:bg-[#0360B9]">Sign Up <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-10 lg:py-28">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[#0B72E7]/30 bg-[#0B72E7]/10 px-3 py-1.5 text-xs font-bold text-[#8ec5ff]">
                <Sparkles className="h-3.5 w-3.5" />Aspect-Based Review Intelligence
              </p>
              <h1 className="mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-[#F5F7FA] sm:text-5xl lg:text-6xl">From customer language to a clearer operating signal.</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[#8B93A3]">SentiX separates review evidence by aspect, blends transparent VADER and Hugging Face signals, and helps teams turn feedback into defensible action.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button onClick={goToTrial} size="lg" className="bg-[#0B72E7] text-white hover:bg-[#0360B9]">Try Quick Analysis <ArrowRight className="ml-2 h-4 w-4" /></Button>
                <Button onClick={openSignUp} size="lg" variant="outline" className="border-[#323846] bg-[#1D232F] text-[#F5F7FA] hover:bg-[#161B26]">Sign Up</Button>
              </div>
              <p className="mt-5 text-xs text-[#8B93A3]">No account is needed to try one review. Guest trials are never saved.</p>
            </div>

            <div className="landing-hero-panel rounded-3xl border border-[#323846] bg-[#1D232F]/90 p-5 shadow-2xl shadow-black/20 sm:p-7">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#8B93A3]">Evidence, made legible</p>
              <div className="mt-6 space-y-3">
                <SignalCard label="Delivery" tag="Positive" tagClassName="border-[#09BF5A]/30 bg-[#09BF5A]/10 text-[#7fefae]" widthClassName="w-[74%]" barClassName="bg-[#09BF5A]" />
                <SignalCard label="Refunds" tag="High urgency" tagClassName="border-[#F8C72D]/30 bg-[#F8C72D]/10 text-[#F8C72D]" widthClassName="w-[58%]" barClassName="bg-[#F8C72D]" />
                <div className="rounded-2xl border border-[#323846] bg-[#161B26] p-4">
                  <p className="text-xs font-bold uppercase tracking-[.12em] text-[#8B93A3]">Engine agreement</p>
                  <p className="mt-2 text-3xl font-extrabold text-[#F5F7FA]">91<span className="text-lg text-[#8B93A3]">%</span></p>
                  <p className="mt-1 text-xs text-[#8B93A3]">VADER polarity + Hugging Face refinement</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <GuestQuickAnalysis />

        <section id="features" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#0B72E7]">The SentiX method</p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#F5F7FA] sm:text-4xl">One analytical surface for the questions that matter.</h2>
            <p className="mt-4 leading-7 text-[#8B93A3]">Move from raw feedback to decision-ready evidence while keeping source metadata and engine outputs visible.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-[#323846] bg-[#1D232F] p-5 transition hover:-translate-y-0.5 hover:border-[#0B72E7]/45">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0B72E7]/10 text-[#0B72E7]"><feature.icon className="h-5 w-5" /></span>
                <h3 className="mt-5 font-extrabold text-[#F5F7FA]">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#8B93A3]">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="integrity" className="border-y border-[#323846] bg-[#161B26]">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:px-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#09BF5A]">Read-only data integrity</p>
              <h2 className="mt-4 text-3xl font-extrabold text-[#F5F7FA]">Keep the customer evidence distinct from the analytical result.</h2>
            </div>
            <p className="self-end text-base leading-8 text-[#8B93A3]">Structured review IDs, dates, sources, and text stay intact as a review enters analysis. SentiX layers aspects, sentiment, confidence, and actions on top, allowing teams to trace each conclusion back to the exact review.</p>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-sm sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#0B72E7]" />
          <span className="font-bold text-[#F5F7FA]">SentiX</span>
          <span className="text-[#8B93A3]">© {new Date().getFullYear()}</span>
        </div>
        <nav className="flex gap-5 text-[#8B93A3]" aria-label="Footer">
          <a href="#features" className="hover:text-[#F5F7FA]">Features</a>
          <button onClick={openSignIn} className="hover:text-[#F5F7FA]">Sign In</button>
          <button onClick={openSignUp} className="hover:text-[#F5F7FA]">Sign Up</button>
        </nav>
      </footer>
    </div>
  );
}
