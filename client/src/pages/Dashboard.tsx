import { useAuth } from "@/_core/hooks/useAuth";
import SentiXDashboard from "@/components/SentiXDashboard";
import Workbenches from "@/pages/Workbenches";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { BarChart3, FileSearch, Home, LayoutDashboard, LogOut, Menu, Sparkles, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

type NavItem = { href: string; label: string; icon: typeof Home };
const navItems: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/workbenches", label: "Workbenches", icon: BarChart3 },
  { href: "/quick-analysis#quick-analysis", label: "Quick Analysis", icon: FileSearch },
];

function Navigation({ onNavigate, mobile = false }: { onNavigate?: () => void; mobile?: boolean }) {
  const [location] = useLocation();
  const currentPath = location.split("#")[0];
  return <nav aria-label="Dashboard navigation" className={`${mobile ? "mt-8" : "mt-10"} space-y-2`}>
    {navItems.map(({ href, label, icon: Icon }) => { const hrefPath = href.split("#")[0]; const active = currentPath === hrefPath || (hrefPath !== "/dashboard" && currentPath.startsWith(hrefPath)); return <a key={href} href={href} onClick={onNavigate} className={`app-nav-link ${active ? "app-nav-link-active" : ""}`}><Icon className="h-4 w-4" />{label}</a>; })}
  </nav>;
}

function SentiXAppShell() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeDrawer(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [drawerOpen]);

  const accountFooter = <div className="mt-auto border-t border-[#323846] pt-4"><p className="truncate px-2 text-xs font-semibold text-[#F5F7FA]">{user?.name ?? "Signed in"}</p><p className="mt-1 truncate px-2 text-[11px] text-[#8B93A3]">{user?.email ?? "Your private workspace"}</p><Button onClick={() => void logout()} variant="ghost" className="mt-4 w-full justify-start text-[#8B93A3] hover:bg-[#1D232F] hover:text-[#F5F7FA]"><LogOut className="mr-2 h-4 w-4" />Sign out</Button></div>;
  const brand = <a href="/dashboard" onClick={closeDrawer} className="flex items-center gap-3 rounded-xl px-2 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B72E7]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0B72E7] text-white shadow-lg shadow-[#0B72E7]/20"><Sparkles className="h-5 w-5" /></span><span><strong className="block text-base tracking-tight text-[#F5F7FA]">SentiX</strong><span className="block text-[9px] font-bold uppercase tracking-[.14em] text-[#8B93A3]">Review intelligence</span></span></a>;

  return <div className="min-h-screen bg-[#131722] lg:flex">
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[#323846] bg-[#161B26] px-4 py-6 lg:fixed lg:inset-y-0 lg:flex">{brand}<Navigation />{accountFooter}</aside>
    {drawerOpen && <button type="button" aria-label="Close navigation" onClick={closeDrawer} className="fixed inset-0 z-40 bg-[#131722]/75 backdrop-blur-sm lg:hidden" />}
    <aside aria-label="Mobile navigation drawer" className={`fixed inset-y-0 left-0 z-50 flex w-[min(86vw,20rem)] flex-col border-r border-[#323846] bg-[#161B26] px-4 py-6 shadow-2xl transition-transform duration-300 ease-out lg:hidden ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center justify-between">{brand}<Button variant="ghost" size="icon" aria-label="Close navigation" onClick={closeDrawer} className="text-[#8B93A3] hover:bg-[#1D232F] hover:text-[#F5F7FA]"><X className="h-5 w-5" /></Button></div>
      <Navigation onNavigate={closeDrawer} mobile />
      {accountFooter}
    </aside>
    <div className="min-w-0 flex-1 lg:pl-64">
      <div className="flex items-center gap-3 border-b border-[#323846] bg-[#161B26] px-4 py-3 lg:hidden"><Button variant="outline" size="icon" aria-label="Open navigation" onClick={() => setDrawerOpen(true)} className="border-[#323846] bg-[#1D232F] text-[#F5F7FA]"><Menu className="h-5 w-5" /></Button><div><p className="text-sm font-extrabold text-[#F5F7FA]">Home</p><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8B93A3]">SentiX workspace</p></div></div>
      {location.split("#")[0] === "/workbenches" ? <Workbenches /> : <SentiXDashboard embedded />}
    </div>
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
