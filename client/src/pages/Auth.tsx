import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAccountEntryPath, startHostedLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import React, { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

type AuthMode = "signin" | "signup";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "We could not complete that request. Please try again.";
}

export default function Auth() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<AuthMode>(() => new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const completeAccountEntry = async () => {
    await utils.auth.me.invalidate();
    setLocation("/dashboard");
  };

  const register = trpc.auth.register.useMutation({ onSuccess: () => void completeAccountEntry() });
  const login = trpc.auth.login.useMutation({ onSuccess: () => void completeAccountEntry() });
  const pending = register.isPending || login.isPending;

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setSubmitError(null);
    setLocation(getAccountEntryPath(nextMode === "signup" ? "signUp" : "signIn"));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    try {
      if (mode === "signup") {
        await register.mutateAsync({ name, email, password });
      } else {
        await login.mutateAsync({ email, password });
      }
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  };

  return (
    <main className="auth-shell grid min-h-screen overflow-hidden bg-[#131722] text-[#F5F7FA] lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden border-r border-[#323846] bg-[#161B26] p-10 lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -left-36 -top-32 h-96 w-96 rounded-full bg-[#0B72E7]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-[#4E1477]/25 blur-3xl" />
        <Link href="/" className="relative z-10 flex w-fit items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B72E7]">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#0B72E7] text-white shadow-lg shadow-[#0B72E7]/20"><Sparkles className="h-5 w-5" /></span>
          <span><strong className="block text-lg tracking-tight">SentiX</strong><span className="block text-[9px] font-bold uppercase tracking-[.16em] text-[#8B93A3]">Aspect-Based Review Intelligence</span></span>
        </Link>
        <div className="relative z-10 my-auto max-w-md">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#09BF5A]/25 bg-[#09BF5A]/10 px-3 py-1.5 text-xs font-bold text-[#7fefae]"><ShieldCheck className="h-3.5 w-3.5" />Private workspaces, clear ownership</p>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight">Bring your review evidence into focus.</h1>
          <p className="mt-5 text-base leading-8 text-[#8B93A3]">Create a SentiX account to save workbenches, retain quick analyses, collaborate on cited insights, and export executive-ready reports.</p>
          <div className="mt-10 space-y-4">
            {[
              "Your imported reviews stay separated by workbench.",
              "Customer evidence remains traceable to each signal.",
              "Password credentials are stored only as a salted server-side hash.",
            ].map((item) => <p key={item} className="flex items-start gap-3 text-sm font-medium text-[#F5F7FA]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#09BF5A]" />{item}</p>)}
          </div>
        </div>
        <p className="relative z-10 text-xs text-[#8B93A3]">Guest Quick Analysis remains available without an account.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm font-semibold text-[#8B93A3] transition hover:text-[#F5F7FA]"><ArrowLeft className="h-4 w-4" />Back to public home</Link>
          <div className="rounded-3xl border border-[#323846] bg-[#1D232F] p-6 shadow-2xl shadow-black/20 sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B72E7]/12 text-[#0B72E7]"><KeyRound className="h-5 w-5" /></div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-[#0B72E7]">SentiX account</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">{mode === "signup" ? "Create your workspace" : "Welcome back"}</h2>
            <p className="mt-3 text-sm leading-6 text-[#8B93A3]">{mode === "signup" ? "Start saving analyses in a secure personal workspace." : "Sign in to continue where your review analysis left off."}</p>

            <div className="mt-7 grid grid-cols-2 rounded-xl border border-[#323846] bg-[#161B26] p-1" aria-label="Account action">
              <button type="button" onClick={() => changeMode("signin")} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${mode === "signin" ? "bg-[#0B72E7] text-white shadow" : "text-[#8B93A3] hover:text-[#F5F7FA]"}`}>Sign In</button>
              <button type="button" onClick={() => changeMode("signup")} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${mode === "signup" ? "bg-[#0B72E7] text-white shadow" : "text-[#8B93A3] hover:text-[#F5F7FA]"}`}>Create Account</button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={submit}>
              {mode === "signup" && <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-[#8B93A3]">Your name</span><Input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Sam Taylor" className="h-11 border-[#323846] bg-[#161B26] text-[#F5F7FA] placeholder:text-[#8B93A3]" /></label>}
              <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-[#8B93A3]">Email address</span><Input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="h-11 border-[#323846] bg-[#161B26] text-[#F5F7FA] placeholder:text-[#8B93A3]" /></label>
              <label className="block"><span className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[.12em] text-[#8B93A3]">Password {mode === "signup" && <span className="normal-case tracking-normal text-[#8B93A3]">10+ characters</span>}</span><Input required minLength={10} type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter a secure password" className="h-11 border-[#323846] bg-[#161B26] text-[#F5F7FA] placeholder:text-[#8B93A3]" /></label>
              {submitError && <p role="alert" className="rounded-xl border border-[#D82528]/30 bg-[#D82528]/10 px-3 py-2.5 text-sm font-medium text-[#ff9a9c]">{submitError}</p>}
              <Button type="submit" disabled={pending} className="h-11 w-full bg-[#0B72E7] text-white hover:bg-[#0360B9]">{pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Working securely…</> : <>{mode === "signup" ? "Create account" : "Sign in to SentiX"}<ArrowRight className="ml-2 h-4 w-4" /></>}</Button>
            </form>
            <p className="mt-6 text-center text-xs leading-5 text-[#8B93A3]">{mode === "signup" ? "Already have an account? " : "New to SentiX? "}<button type="button" onClick={() => changeMode(mode === "signup" ? "signin" : "signup")} className="font-bold text-[#0B72E7] hover:text-[#8ec5ff]">{mode === "signup" ? "Sign in" : "Create an account"}</button></p>
            {mode === "signin" && <div className="mt-6 border-t border-[#323846] pt-5 text-center"><p className="text-xs leading-5 text-[#8B93A3]">Previously used the hosted SentiX sign-in?</p><button type="button" onClick={() => startHostedLogin("signIn")} className="mt-2 text-xs font-bold text-[#8ec5ff] transition hover:text-[#F5F7FA]">Continue with your existing hosted account</button></div>}
          </div>
        </div>
      </section>
    </main>
  );
}
