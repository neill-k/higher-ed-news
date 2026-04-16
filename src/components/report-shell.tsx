import type { ReactNode } from "react";

import { Sidebar } from "@/components/sidebar";

type ReportShellProps = {
  children: ReactNode;
};

export function ReportShell({ children }: ReportShellProps) {
  return (
    <div className="min-h-screen w-full bg-[var(--canvas)] md:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 bg-[var(--canvas)]">{children}</main>
    </div>
  );
}

