import type { ReactNode } from "react";

import { ReportShell } from "@/components/report-shell";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ReportPageProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
  tabs?: Array<{ label: string; active?: boolean }>;
  children: ReactNode;
};

export function ReportPage({
  eyebrow,
  title,
  subtitle,
  actionHref,
  actionLabel,
  tabs,
  children,
}: ReportPageProps) {
  return (
    <ReportShell>
      <div className="mx-auto flex max-w-[1184px] flex-col gap-5 px-5 py-6 md:px-10 md:py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            {eyebrow ? (
              <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#8c8782]">
                {eyebrow}
              </div>
            ) : null}
            <h1 className="text-[30px] font-semibold tracking-tight text-[#2d2926] md:text-[32px]">
              {title}
            </h1>
            {subtitle ? (
              <p className="max-w-[80ch] text-sm text-[#5e5954] md:text-base">{subtitle}</p>
            ) : null}
          </div>
          {actionLabel && actionHref ? (
            <a
              className="inline-flex items-center justify-center rounded-full border border-[#d0cbc0] bg-[#d9d9db] px-4 py-2 text-sm font-medium text-[#2a2933] transition-colors hover:bg-[#cecfd2]"
              href={actionHref}
            >
              {actionLabel}
            </a>
          ) : null}
        </div>

        {tabs?.length ? (
          <div className="overflow-x-auto">
            <div className="inline-flex min-w-max items-center gap-2 rounded-full border border-[#c5c5cb] bg-white p-2">
              {tabs.map((tab) => (
                <span
                  key={tab.label}
                  className={cx(
                    "rounded-full border px-5 py-2 text-sm transition-colors",
                    tab.active
                      ? "border-[#d0cbc0] bg-[#d9d9db] text-[#2a2933]"
                      : "border-[#ebe7dd] bg-white text-[#5e5954]",
                  )}
                >
                  {tab.label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {children}
      </div>
    </ReportShell>
  );
}

/** Panel — matches Pencil's rounded-16 white card. */
export function Panel({
  title,
  eyebrow,
  className,
  children,
}: {
  title?: string;
  eyebrow?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx("rounded-[16px] border border-[#dcd8cb] bg-white p-6", className)}>
      {eyebrow ? (
        <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#8c8782]">
          {eyebrow}
        </div>
      ) : null}
      {title ? (
        <h2 className="mb-4 text-lg font-semibold text-[#2d2926]">{title}</h2>
      ) : null}
      {children}
    </section>
  );
}

/** Exhibit — a Panel with a numbered exhibit label, optional subtitle, and a source footer. */
export function Exhibit({
  number,
  title,
  subtitle,
  source,
  asOf = "April 2026",
  n,
  caveat,
  className,
  children,
}: {
  number?: string;
  title: string;
  subtitle?: string;
  source?: string;
  asOf?: string;
  n?: string | number;
  caveat?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx("rounded-[16px] border border-[#dcd8cb] bg-white p-6", className)}>
      <div className="mb-4 space-y-1">
        {number ? (
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8c8782]">
            Exhibit {number}
          </div>
        ) : null}
        <h2 className="text-lg font-semibold leading-tight text-[#2d2926] md:text-[19px]">
          {title}
        </h2>
        {subtitle ? (
          <p className="max-w-[80ch] text-[13px] leading-[1.55] text-[#5e5954]">{subtitle}</p>
        ) : null}
      </div>
      <div>{children}</div>
      {(source || n || caveat) && (
        <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 border-t border-[#ebe7dd] pt-3 text-[11px] leading-[1.5] text-[#8c8782]">
          {source ? <span>Source: {source}</span> : null}
          {n !== undefined ? <span>n = {n}</span> : null}
          <span>As of {asOf}</span>
          {caveat ? <span>· {caveat}</span> : null}
        </div>
      )}
    </section>
  );
}

/** BAN — keeps the original MetricCard skin, extended with an optional comparator line. */
type MetricTone = "gold" | "neutral" | "danger" | "success";

const metricToneClasses: Record<MetricTone, string> = {
  gold: "bg-[#f3dec4] text-[#8b5d1f]",
  neutral: "bg-[#ece7de] text-[#5e5954]",
  danger: "bg-[#f8d8d2] text-[#9b3727]",
  success: "bg-[#d9ecd8] text-[#24513d]",
};

export function BAN({
  label,
  value,
  definition,
  comparator,
  tone = "gold",
}: {
  label: string;
  value: string;
  definition?: string;
  comparator?: string;
  tone?: MetricTone;
}) {
  return (
    <section className="rounded-[24px] border border-[#ebe7dd] bg-[#f5f5f5] p-5">
      <div className="space-y-3">
        <p className="max-w-[22ch] text-xs font-medium text-[#5e5954]">{label}</p>
        <div className="text-[34px] font-semibold leading-none tracking-tight tabular text-[#2d2926]">
          {value}
        </div>
        {definition ? (
          <span
            className={cx(
              "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium",
              metricToneClasses[tone],
            )}
          >
            {definition}
          </span>
        ) : null}
        {comparator ? (
          <div className="border-t border-[#e7e1d5] pt-3 text-[11px] leading-[1.5] text-[#8c8782]">
            {comparator}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Legacy name — same rendering as BAN. Kept so older imports still work. */
export function MetricCard(props: {
  label: string;
  value: string;
  annotation?: string;
  annotationTone?: MetricTone;
}) {
  return (
    <BAN
      label={props.label}
      value={props.value}
      definition={props.annotation}
      tone={props.annotationTone}
    />
  );
}

/** Callout — Finding / Implication / Action for the CIO. */
type CalloutKind = "finding" | "implication" | "action" | "note";

const calloutLabel: Record<CalloutKind, string> = {
  finding: "Finding",
  implication: "Implication",
  action: "Action for the CIO",
  note: "Note",
};

const calloutAccent: Record<CalloutKind, string> = {
  finding: "border-[#dcd8cb] bg-[#f5f2e9]",
  implication: "border-[#d0cbc0] bg-[#ece7de]",
  action: "border-[#e7c998] bg-[#f3dec4]",
  note: "border-[#e5e5ea] bg-[#f5f5f5]",
};

export function Callout({ kind, children }: { kind: CalloutKind; children: ReactNode }) {
  return (
    <aside
      className={cx(
        "rounded-[12px] border px-4 py-3 text-[13px] leading-[1.6] text-[#2d2926]",
        calloutAccent[kind],
      )}
    >
      <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#8c8782]">
        {calloutLabel[kind]}
      </div>
      <div>{children}</div>
    </aside>
  );
}

/** PeerStrip — distribution of peer values with optional highlighted anchor and peer median. */
export function PeerStrip({
  label,
  points,
  valueSuffix = "",
  median,
  max,
  unitsLabel,
}: {
  label: string;
  points: Array<{ name: string; value: number; isAnchor?: boolean }>;
  valueSuffix?: string;
  median?: number;
  max?: number;
  unitsLabel?: string;
}) {
  if (!points.length) return null;
  const dataMax = max ?? Math.max(...points.map((p) => p.value), median ?? 0);
  const safeMax = dataMax > 0 ? dataMax : 1;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-medium text-[#2d2926]">{label}</span>
        {unitsLabel ? (
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#8c8782]">
            {unitsLabel}
          </span>
        ) : null}
      </div>
      <div className="relative h-9 rounded-full bg-[#ebe7dd]">
        {median !== undefined ? (
          <div
            className="absolute top-0 h-full border-l border-dashed border-[#8c8782]"
            style={{ left: `${Math.min(100, (median / safeMax) * 100)}%` }}
            title={`Peer median: ${median}${valueSuffix}`}
          />
        ) : null}
        {points.map((point) => {
          const left = Math.min(100, (point.value / safeMax) * 100);
          const anchor = point.isAnchor;
          return (
            <div
              key={`${point.name}-${point.value}`}
              className={cx(
                "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border",
                anchor
                  ? "z-10 h-4 w-4 border-[#7d6b3d] bg-[#f3dec4]"
                  : "h-2.5 w-2.5 border-[#8c8782] bg-[#dcd8cb]",
              )}
              style={{ left: `${left}%` }}
              title={`${point.name}: ${point.value}${valueSuffix}`}
            />
          );
        })}
      </div>
      {median !== undefined ? (
        <div className="flex items-center justify-between text-[10px] text-[#8c8782]">
          <span>0</span>
          <span>
            median {median}
            {valueSuffix}
          </span>
          <span>
            {Math.round(safeMax)}
            {valueSuffix}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** PeerChip — small pill for tagging a peer institution in a list. */
export function PeerChip({
  name,
  meta,
  highlighted,
}: {
  name: string;
  meta?: string;
  highlighted?: boolean;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        highlighted
          ? "border-[#7d6b3d] bg-[#f3dec4] text-[#8b5d1f]"
          : "border-[#ebe7dd] bg-[#f5f2e9] text-[#5e5954]",
      )}
    >
      <span>{name}</span>
      {meta ? <span className="text-[#8c8782]">· {meta}</span> : null}
    </span>
  );
}

/** SourceLink — renders an external link showing the bare domain. */
export function SourceLink({ href, label }: { href: string; label?: string }) {
  const domain = (() => {
    try {
      return new URL(href).hostname.replace(/^www\./, "");
    } catch {
      return href;
    }
  })();
  return (
    <a
      className="inline-flex items-center gap-1 text-[11px] text-[#5e5954] underline decoration-[#b8b2a8] decoration-dotted underline-offset-2 hover:text-[#7d6b3d] hover:decoration-[#7d6b3d]"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label ?? domain}
      <span aria-hidden className="text-[#b8b2a8]">↗</span>
    </a>
  );
}

export function EmptyReportState() {
  return (
    <Panel title="Pipeline output missing" className="max-w-[760px]">
      <p className="max-w-[60ch] text-sm leading-6 text-[#5e5954]">
        This briefing reads from <code>output/report-data.json</code> and{" "}
        <code>data/sec-peers/*.json</code>. Run the pipeline to generate the signal artifacts, then
        refresh the page.
      </p>
    </Panel>
  );
}
