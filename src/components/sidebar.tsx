"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { label: "Briefing", href: "/", icon: "grid" },
  { label: "Peer Profiles", href: "/peers", icon: "users" },
  { label: "Adoption & Trends", href: "/adoption", icon: "trending-up" },
  { label: "Vendors & Capital", href: "/investment", icon: "dollar-sign" },
  { label: "Risk & Governance", href: "/governance", icon: "shield" },
];

const ICONS: Record<string, ReactNode> = {
  grid: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  "trending-up": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  "dollar-sign": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  shield: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="relative shrink-0 overflow-hidden border-b border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] text-[var(--sidebar-foreground)] md:flex md:min-h-screen md:w-[272px] md:flex-col md:border-b-0">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_34%)]" />

      <div className="relative flex items-center gap-3 px-5 py-5 md:px-6 md:py-7">
        <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/10 bg-white/6 text-xs font-semibold tracking-[0.18em] text-[var(--sidebar-active)]">
          AI
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-[0.26em] text-white/40">
            LSU Desk
          </div>
          <div className="truncate text-[18px] font-semibold text-[var(--sidebar-active)]">
            AI in HE
          </div>
        </div>
      </div>

      <div className="relative hidden px-6 pb-4 text-[12px] leading-[1.65] text-white/60 md:block">
        Benchmarking LSU against SEC peers on policy, vendors, governance, and institutional AI posture.
      </div>

      <div className="relative hidden px-6 pb-3 text-[10px] font-medium uppercase tracking-[0.24em] text-white/36 md:block">
        Workspace
      </div>

      <nav className="relative flex gap-1 overflow-x-auto px-3 pb-4 md:flex-col md:gap-1 md:px-4 md:pb-0">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 whitespace-nowrap rounded-[18px] px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                active
                  ? "bg-white/9 text-[var(--sidebar-active)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "text-[var(--sidebar-foreground)] hover:bg-white/5 hover:text-[var(--sidebar-active)]"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                  active
                    ? "border-white/10 bg-white/8 text-[var(--sidebar-active)]"
                    : "border-white/6 bg-white/3 text-white/55 group-hover:border-white/10 group-hover:text-[var(--sidebar-active)]"
                }`}
              >
                {ICONS[item.icon]}
              </span>
              <span className="flex-1">{item.label}</span>
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  active ? "bg-[#d8b27a]" : "bg-transparent group-hover:bg-white/25"
                }`}
              />
            </Link>
          );
        })}
      </nav>

      <div className="hidden flex-1 md:block" />

      <div className="relative hidden border-t border-[var(--sidebar-border)] px-6 py-5 md:block">
        <div className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/36">
          Cadence
        </div>
        <div className="mt-2 text-[13px] leading-[1.65] text-white/70">
          Updated nightly with extraction, synthesis, and report refresh.
        </div>
      </div>
    </aside>
  );
}
