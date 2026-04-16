"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { label: "Briefing", href: "/", icon: "grid" },
  { label: "Peer Profiles", href: "/peers", icon: "users" },
  { label: "Adoption & Trends", href: "/adoption", icon: "trending-up" },
  { label: "Vendors & Capital", href: "/investment", icon: "dollar-sign" },
  { label: "Risk & Governance", href: "/governance", icon: "shield" },
];

const ICONS: Record<string, React.ReactNode> = {
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
    <aside className="shrink-0 border-b border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] md:flex md:min-h-screen md:w-[220px] md:flex-col md:border-b-0 md:border-r">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex items-center justify-center w-8 h-8 rounded-[var(--radius-xs)] bg-[var(--foreground)] text-white text-xs font-semibold">
          AI
        </div>
        <span className="text-sm font-semibold text-[var(--foreground)]">AI in HE</span>
      </div>

      <div className="hidden px-5 pt-4 pb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)] md:block">
        Briefing
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 pb-4 md:flex-col md:gap-0.5 md:pb-0">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 whitespace-nowrap rounded-[var(--radius-xs)] px-3 py-2 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-[var(--accent)] text-[var(--foreground)]"
                  : "text-[var(--sidebar-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              }`}
            >
              {ICONS[item.icon]}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden flex-1 md:block" />

      <div className="hidden items-center gap-2.5 border-t border-[var(--sidebar-border)] px-5 py-4 md:flex">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] text-xs font-semibold">
          NK
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-medium text-[var(--foreground)]">Neill Killgore</span>
          <span className="text-[10px] text-[var(--muted-foreground)]">nkillgore@gmail.com</span>
        </div>
      </div>
    </aside>
  );
}
