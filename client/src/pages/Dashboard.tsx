import { useAuth } from "@/_core/hooks/useAuth";
import SentiXDashboard from "@/components/SentiXDashboard";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { BarChart3, FileSearch, Home, LayoutDashboard, LogOut, Sparkles } from "lucide-react";
import React, { useEffect, useRef } from "react";

function SentiXAppShell() {
  const { user, logout } = useAuth();
  return <div className="min-h-screen bg-[#131722] lg:flex">
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[#323846] bg-[#161B26] px-4 py-6 lg:fixed lg:inset-y-0 lg:flex">
      <a href="/" className="flex items-center gap-3 rounded-xl px-2 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B72E7]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0B72E7] text-white shadow-lg shadow-[#0B72E7]/20"><Sparkles className="h-5 w-5" /></span><span><strong className="block text-base tracking-tight text-[#F5F7FA]">SentiX</strong><span className="block text-[9px] font-bold uppercase tracking-[.14em] text-[#8B93A3]">Review intelligence</span></span></a>
      <nav aria-label="Dashboard navigation" className="mt-10 space-y-2"><a href="/dashboard" className="app-nav-link app-nav-link-active"><LayoutDashboard className="h-4 w-4" />Dashboard</a><a href="/workbenches" className="app-nav-link"><BarChart3 className="h-4 w-4" />Workbenches</a><a href="/quick-analysis#quick-analysis" className="app-nav-link"><FileSearch className="h-4 w-4" />Quick Analysis</a></nav>
      <div className="mt-auto border-t border-[#323846] pt-4"><p className="truncate px-2 text-xs font-semibold text-[#F5F7FA]">{user?.name ?? "Signed in"}</p><p className="mt-1 truncate px-2 text-[11px] text-[#8B93A3]">{user?.email ?? "Your private workspace"}</p><Button onClick={() => void logout()} variant="ghost" className="mt-4 w-full justify-start text-[#8B93A3] hover:bg-[#1D232F] hover:text-[#F5F7FA]"><LogOut className="mr-2 h-4 w-4" />Sign out</Button><a href="/" className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#8B93A3] transition hover:bg-[#1D232F] hover:text-[#F5F7FA]"><Home className="h-4 w-4" />Public home</a></div>
    </aside>
    <div className="min-w-0 flex-1 lg:pl-64"><SentiXDashboard embedded /></div>
  </div>;
}

export default function Dashboard() {
  const { isAuthenticated, loading } = useAuth();
  const sentToLogin = useRef(false);
  useEffect(() => { if (!loading && !isAuthenticated && !sentToLogin.current) { sentToLogin.current = true; startLogin(); } }, [isAuthenticated, loading]);
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#131722] text-[#8B93A3]">Loading SentiX…</div>;
  if (!isAuthenticated) return <div className="grid min-h-screen place-items-center bg-[#131722] p-6"><div className="max-w-sm rounded-2xl border border-[#323846] bg-[#1D232F] p-7 text-center"><Sparkles className="mx-auto h-9 w-9 text-[#0B72E7]" /><h1 className="mt-4 text-xl font-extrabold text-[#F5F7FA]">Sign in to open your workspace</h1><p className="mt-2 text-sm leading-6 text-[#8B93A3]">Saved workbenches and full analysis are available after sign in.</p><Button onClick={() => startLogin("signIn")} className="mt-6 w-full bg-[#0B72E7] hover:bg-[#0360B9]">Sign in or sign up</Button><a className="mt-4 inline-flex text-sm font-semibold text-[#0B72E7]" href="/">Return to public home</a></div></div>;
  return <SentiXAppShell />;
}
