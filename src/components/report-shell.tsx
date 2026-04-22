import type { ReactNode } from "react";

import { Sidebar } from "@/components/sidebar";

type ReportShellProps = {
  children: ReactNode;
};

export function ReportShell({ children }: ReportShellProps) {
  return (
    <div className="min-h-screen w-full bg-[var(--sidebar-bg)]">
      <div className="md:grid md:min-h-screen md:grid-cols-[272px_minmax(0,1fr)]">
        <Sidebar />
        <main className="relative min-w-0 overflow-hidden bg-[var(--canvas)] md:rounded-l-[34px] md:border-l md:border-white/12">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top_right,rgba(156,106,49,0.2),transparent_58%)]" />
          <div className="relative">{children}</div>
        </main>
      </div>
    </div>
  );
}

