"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  LayoutDashboard,
  Menu,
  Play,
  Search,
  Settings,
  Sparkles,
  Wallet,
} from "lucide-react";
import UserBar from "@/components/UserBar";
import { useTraderWallet } from "@/hooks/useTraderWallet";
import { useUserPreferences } from "@/hooks/useUserPreferences";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/markets", label: "Games", icon: CalendarDays },
  { href: "/ora", label: "Ask ORA", icon: Sparkles },
  { href: "/wallet", label: "Funds", icon: Wallet },
  { href: "/portfolio", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

type TraderShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  onRunScan?: () => void;
  contentClassName?: string;
};

export default function TraderShell({ title, subtitle, children, onRunScan, contentClassName = "" }: TraderShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, authenticated, login, wallet, userId } = useTraderWallet();
  const { preferences } = useUserPreferences(userId);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const command = query.trim().toLowerCase();
    if (!command) return;
    const destination = command.includes("wallet") || command.includes("fund")
      ? "/wallet"
      : command.includes("record") || command.includes("receipt") || command.includes("history")
        ? "/portfolio"
        : command.includes("ora") || command.includes("agent")
          ? "/ora"
          : command.includes("game") || command.includes("market") || command.includes("match")
            ? "/markets"
            : command.includes("today") || command.includes("dashboard")
              ? "/dashboard"
              : command.includes("setting") || command.includes("profile") || command.includes("preference")
                ? "/settings"
              : null;
    if (destination) {
      setQuery("");
      router.push(destination);
      return;
    }
    setNotice(`I could not find "${query.trim()}". Try games, ORA, funds, history, or today.`);
  }

  function exportPositions() {
    if (!wallet?.positions.length) {
      setNotice("There are no positions to export yet.");
      return;
    }
    const rows = [
      ["match", "selection", "odds", "stake", "status", "pnl", "created_at"],
      ...wallet.positions.map((position) => [
        position.match,
        position.selection,
        position.odds,
        position.stake,
        position.status,
        position.pnl ?? "",
        position.created_at,
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "txagent-positions.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Position export created.");
  }

  function runScan() {
    if (!authenticated) {
      login();
      return;
    }
    if (onRunScan) {
      onRunScan();
      return;
    }
    router.push("/dashboard?scan=1#supervised-execution");
  }

  const visibleNavItems = NAV_ITEMS.filter((item) => preferences.showAskOra || item.href !== "/ora");

  if (!ready) {
    return (
      <div className="telemetry-dashboard grid min-h-[100dvh] place-items-center px-4">
        <div className="w-full max-w-md border border-[#252721] bg-[#11120f] p-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#ff650f]">Loading TXAgent</p>
          <p className="mt-3 text-sm text-[#8c8e87]">Preparing your football workspace.</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="telemetry-dashboard grid min-h-[100dvh] place-items-center px-4">
        <div className="w-full max-w-lg border border-[#252721] bg-[#11120f] p-6 text-center sm:p-8">
          <div className="mx-auto grid size-12 place-items-center bg-[#25170e] text-[#ff650f]">
            <Sparkles className="size-6" />
          </div>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-[#ff650f]">Sign in required</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#f4f4ef]">Open your ORA workspace.</h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-[#8c8e87]">
            The landing page is public. Games, picks, funds, and history stay inside your signed-in workspace.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={login} className="min-h-11 bg-[#ff650f] px-5 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#0a0b09] transition hover:bg-[#ff7a2f]">
              Sign in
            </button>
            <Link href="/" className="inline-flex min-h-11 items-center justify-center border border-[#30322c] bg-[#151613] px-5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#d4d5cf] transition hover:border-[#ff650f] hover:text-[#ff7a2f]">
              Back to landing
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`telemetry-dashboard grid min-h-[100dvh] ${collapsed ? "lg:grid-cols-[72px_minmax(0,1fr)]" : "lg:grid-cols-[230px_minmax(0,1fr)]"}`}>
      <aside className="border-b border-[#252721] bg-[#0d0e0c] lg:sticky lg:top-0 lg:h-[100dvh] lg:border-b-0 lg:border-r">
        <div className="flex h-[72px] items-center justify-between border-b border-[#252721] px-4">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3" aria-label="TXAgent dashboard">
            <span className="grid size-9 shrink-0 place-items-center bg-[#ff650f] font-mono text-xs font-black text-[#0a0b09]">TX</span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-black tracking-tight text-[#f0f0ec]">TXAgent</span>
                <span className="mt-0.5 block font-mono text-[8px] uppercase tracking-[0.17em] text-[#60625c]">ORA intelligence</span>
              </span>
            )}
          </Link>
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="hidden size-8 place-items-center text-[#6e706a] transition hover:bg-[#181916] hover:text-[#f0f0ec] lg:grid" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto p-3 lg:block lg:h-[calc(100dvh-72px)] lg:overflow-visible lg:p-0">
          <span className="flex shrink-0 items-center gap-2 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[#5f615b] lg:hidden">
            <Menu className="size-3.5" /> Navigate
          </span>
          <nav className="flex gap-1 lg:block lg:pt-5" aria-label="Dashboard navigation">
            {!collapsed && <p className="hidden px-5 pb-2 font-mono text-[9px] uppercase tracking-[0.15em] text-[#4e504b] lg:block">Main</p>}
            {visibleNavItems.map((item) => (
              <TerminalNavLink
                key={item.href}
                {...item}
                active={pathname === item.href || (item.href === "/markets" && pathname.startsWith("/market/")) || (item.href === "/portfolio" && pathname.startsWith("/prediction/"))}
                collapsed={collapsed}
              />
            ))}
          </nav>

          <div className={`hidden border-t border-[#252721] p-4 lg:absolute lg:bottom-0 lg:left-0 lg:right-0 lg:block ${collapsed ? "text-center" : ""}`}>
            <div className="border border-[#4b2b17] bg-[#17110d] p-3">
              <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
                <span className="size-2 bg-[#4ee58a]" aria-hidden="true" />
                {!collapsed && <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[#ff7a2f]">Practice mode</span>}
              </div>
              {!collapsed && <p className="mt-2 font-mono text-[9px] leading-4 text-[#666861]">Try every feature without using real money.</p>}
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-[72px] items-center justify-between gap-4 border-b border-[#252721] bg-[#0a0b09]/95 px-4 backdrop-blur-sm sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-[#efefeb]">{title}</h1>
            <p className="mt-0.5 hidden truncate font-mono text-[9px] text-[#5e605a] sm:block">{subtitle}</p>
          </div>
          <div className="flex min-w-0 items-center justify-end gap-2">
            <form onSubmit={runSearch} className="hidden h-10 min-w-0 w-[min(28vw,320px)] items-center gap-2 border border-[#242620] bg-[#11120f] px-3 md:flex">
              <Search className="size-3.5 shrink-0 text-[#565852]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games, picks, or history" aria-label="Search dashboard" className="min-w-0 flex-1 bg-transparent font-mono text-[10px] text-[#d7d8d3] outline-none placeholder:text-[#4d4f49]" />
            </form>
            <span className="hidden h-10 items-center gap-2 border border-[#1f4a35] bg-[#0d1711] px-3 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[#4ee58a] sm:flex">
              <span className="size-2 bg-[#4ee58a]" /> LIVE FOOTBALL DATA
            </span>
            <button type="button" onClick={exportPositions} className="hidden h-10 items-center gap-2 border border-[#242620] bg-[#151613] px-3 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[#84867f] transition hover:border-[#4a4c45] hover:text-[#efefeb] xl:flex">
              <Download className="size-3.5" /> Export
            </button>
            <UserBar variant="terminal" />
            <button type="button" onClick={runScan} className="inline-flex h-10 items-center gap-2 bg-[#ff650f] px-3 font-mono text-[9px] font-black uppercase tracking-[0.08em] text-[#0a0b09] transition hover:bg-[#ff7a2f] active:translate-y-px sm:px-4">
              <Play className="size-3.5 fill-current" /> <span className="hidden sm:inline">Run ORA scan</span><span className="sm:hidden">Scan</span>
            </button>
          </div>
        </header>

        <main id="workspace-content" className={`p-3 sm:p-5 lg:p-6 ${contentClassName}`}>
          {notice && (
            <div role="status" className="mb-4 flex items-center justify-between border border-[#4b2b17] bg-[#17110d] px-4 py-3 font-mono text-[10px] text-[#d59058]">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice(null)} className="text-[#ff650f] hover:text-[#ff8a49]">DISMISS</button>
            </div>
          )}
          {children}
          <footer className="mt-6 flex flex-col gap-2 border-t border-[#252721] pt-4 font-mono text-[8px] uppercase tracking-[0.12em] text-[#4e504b] sm:flex-row sm:items-center sm:justify-between">
            <span>TXAgent with ORA</span>
            <span>Football data. ORA analysis. Your decisions.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function TerminalNavLink({ href, label, icon: Icon, active, collapsed }: { href: string; label: string; icon: typeof Activity; active: boolean; collapsed: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`flex shrink-0 items-center gap-3 border-l-2 px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] transition lg:px-5 ${active ? "border-[#ff650f] bg-[#24170f] text-[#ff7a2f]" : "border-transparent text-[#656760] hover:bg-[#151613] hover:text-[#d2d3ce]"} ${collapsed ? "lg:justify-center lg:px-0" : ""}`}>
      <Icon className="size-3.5 shrink-0" strokeWidth={1.7} />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
