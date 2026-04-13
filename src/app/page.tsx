import type { Metadata } from "next";
import Link from "next/link";
import { InitiativesTable, type InitiativeTableRow } from "@/app/initiatives-table";
import { SCOUT_SOURCE_URL, getScoutDashboardData } from "@/lib/yutori";

export const metadata: Metadata = {
  title: "University AI Policies & Strategic Moves Dashboard",
  description:
    "A live dashboard of university AI policies, research, curriculum, partnerships, and governance moves sourced from a public Yutori scout.",
};

export const revalidate = 86400;

const CHART_COLORS = [
  "#10676F",
  "#1DCD98",
  "#35A4B9",
  "#E3A880",
  "#DB8577",
  "#B6D4E7",
];

function formatDate(value: number | string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(new Date(value));
}

function formatMonthYear(value: number | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function splitInstitutions(label: string) {
  return Array.from(
    new Set(
      label
        .split(/\s+(?:&|and|x|×)\s+/i)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function getMonthKey(value: number | string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildConicGradient(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);

  if (!total) {
    return "conic-gradient(#10676F 0deg 360deg)";
  }

  let cursor = 0;

  return `conic-gradient(${values
    .map((value, index) => {
      const start = (cursor / total) * 360;
      cursor += value;
      const end = (cursor / total) * 360;
      return `${CHART_COLORS[index % CHART_COLORS.length]} ${start}deg ${end}deg`;
    })
    .join(", ")})`;
}

export default async function Home() {
  const data = await getScoutDashboardData();
  const latest = data.updates[0];

  if (!latest) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-16">
        <div className="dashboard-card max-w-2xl p-8 text-center">
          <p className="dashboard-kicker">Higher Education Intelligence Report</p>
          <h1 className="mt-4 font-serif text-4xl tracking-[-0.04em] text-foreground">
            University AI dashboard is waiting for its first scout update.
          </h1>
          <p className="mt-4 text-base leading-8 text-muted">
            The page is wired to the public Yutori scout and will populate once the
            next digest is available.
          </p>
          <Link
            className="mt-6 inline-flex items-center rounded-[10px] border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-deep-teal hover:text-deep-teal"
            href={SCOUT_SOURCE_URL}
            rel="noreferrer"
            target="_blank"
          >
            Open source scout
          </Link>
        </div>
      </main>
    );
  }

  const oldest = data.updates[data.updates.length - 1] ?? latest;
  const reportRange = `${formatDate(oldest.timestamp, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })} - ${formatDate(latest.timestamp, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;

  const monthlyMap = new Map<string, { label: string; value: number }>();

  for (const update of data.updates) {
    const key = getMonthKey(update.timestamp);
    const existing = monthlyMap.get(key);

    monthlyMap.set(key, {
      label: formatMonthYear(update.timestamp),
      value: (existing?.value ?? 0) + update.initiativeCount,
    });
  }

  const monthlyTimeline = Array.from(monthlyMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => ({ key, ...item }));
  const peakMonth =
    monthlyTimeline.reduce<(typeof monthlyTimeline)[number] | null>((peak, month) => {
      if (!peak || month.value > peak.value) {
        return month;
      }

      return peak;
    }, null) ?? null;
  const maxMonthlyValue = Math.max(...monthlyTimeline.map((item) => item.value), 1);
  const strongestRun =
    data.updates.reduce<(typeof data.updates)[number] | null>((peak, update) => {
      if (!peak || update.initiativeCount > peak.initiativeCount) {
        return update;
      }

      return peak;
    }, null) ?? latest;

  const initiativeRowsMap = new Map<string, InitiativeTableRow>();

  for (const update of data.updates) {
    for (const initiative of update.initiatives) {
      const key = `${initiative.institution.toLowerCase()}|${initiative.title.toLowerCase()}`;
      const category = initiative.categories[0] ?? update.categories[0] ?? "Institution move";

      if (initiativeRowsMap.has(key)) {
        continue;
      }

      initiativeRowsMap.set(key, {
        id: `${update.id}-${initiative.title}-${initiative.institution}`,
        institution: initiative.institution,
        category,
        initiative: initiative.title,
        reportDate: formatDate(update.timestamp),
        monthLabel: formatMonthYear(update.timestamp),
        sortDate: update.timestamp,
        details:
          initiative.description || update.summary || update.whyItMatters || "Update captured",
        sourceUrl: initiative.sourceUrls[0] ?? update.sourceUrls[0] ?? "",
        sourceDomain:
          initiative.sourceUrls[0] || update.sourceUrls[0]
            ? new URL(initiative.sourceUrls[0] ?? update.sourceUrls[0] ?? "").hostname.replace(
                /^www\./,
                ""
              )
            : "Source unavailable",
      });
    }
  }

  const initiativeRows = Array.from(initiativeRowsMap.values()).sort((left, right) => {
    if (right.sortDate !== left.sortDate) {
      return right.sortDate - left.sortDate;
    }

    return left.institution.localeCompare(right.institution);
  });

  const institutionCounts = new Map<string, number>();

  for (const row of initiativeRows) {
    for (const institution of splitInstitutions(row.institution)) {
      institutionCounts.set(institution, (institutionCounts.get(institution) ?? 0) + 1);
    }
  }

  const topInstitutions = Array.from(institutionCounts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 6);
  const maxInstitutionValue = Math.max(...topInstitutions.map((item) => item.value), 1);

  const categoryItems = data.categoryBreakdown.slice(0, 6).map((item, index) => ({
    ...item,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));
  const categoryGradient = buildConicGradient(categoryItems.map((item) => item.value));
  const topCategory = categoryItems[0] ?? null;
  const latestSummary =
    latest.summary ||
    latest.whyItMatters ||
    "The most recent scout output is available for review.";
  const noResultRunCount = Math.max(data.scout.runCount - data.scout.updateCount, 0);

  const metrics = [
    {
      label: "Total initiatives",
      value: formatNumber(initiativeRows.length),
      detail: "Unique institution-level moves preserved in the current archive.",
      color: CHART_COLORS[0],
    },
    {
      label: "Institutions",
      value: formatNumber(data.totals.institutions),
      detail: "Distinct universities, systems, and colleges represented so far.",
      color: CHART_COLORS[1],
    },
    {
      label: "Archive entries",
      value: formatNumber(data.scout.archiveEntryCount),
      detail: `${formatNumber(data.scout.updateCount)} published reports and ${formatNumber(
        noResultRunCount
      )} no-result runs collapse into the visible archive entries shown on Yutori.`,
      color: CHART_COLORS[2],
    },
    {
      label: "Geographies",
      value: formatNumber(data.totals.geographies),
      detail: "Unique place labels mentioned across update summaries.",
      color: CHART_COLORS[3],
    },
    {
      label: "Source links",
      value: formatNumber(data.totals.sources),
      detail: "Primary citations attached back to the underlying reporting.",
      color: CHART_COLORS[4],
    },
    {
      label: "Peak month",
      value: peakMonth ? formatNumber(peakMonth.value) : "0",
      detail: peakMonth
        ? `${peakMonth.label} recorded the highest initiative volume in the archive.`
        : "Monthly aggregation will appear after the first few runs arrive.",
      color: CHART_COLORS[5],
    },
  ];

  const insights = [
    {
      index: "01",
      title: topCategory
        ? `${topCategory.label} leads the current mix`
        : "The archive is still establishing category patterns",
      body: topCategory
        ? `${formatNumber(topCategory.value)} tracked updates surfaced ${topCategory.label.toLowerCase()} signals, making it the most recurrent theme in the scout feed so far.`
        : "More digests are needed before the category distribution settles into a clear pattern.",
    },
    {
      index: "02",
      title: peakMonth
        ? `${peakMonth.label} marked the busiest month`
        : "Monthly pacing is still emerging",
      body: peakMonth
        ? `${formatNumber(peakMonth.value)} initiatives landed during ${peakMonth.label}, the highest monthly total in the current reporting window.`
        : "The monthly timeline will sharpen as additional updates accumulate.",
    },
    {
      index: "03",
      title: "The densest single digest stands out",
      body: `${formatNumber(strongestRun.initiativeCount)} initiatives appeared in the ${formatDate(
        strongestRun.timestamp
      )} report, spanning ${formatNumber(
        strongestRun.institutionCount
      )} institutions and ${formatNumber(strongestRun.geographyCount)} geography labels.`,
    },
    {
      index: "04",
      title: topInstitutions[0]
        ? `${topInstitutions[0].label} appears most often`
        : "Institution activity is distributed across the archive",
      body: topInstitutions[0]
        ? `${topInstitutions[0].label} shows up ${formatNumber(
            topInstitutions[0].value
          )} times in the initiative log, making it the most frequently surfaced institution today.`
        : `The current dataset spans ${formatNumber(
            data.totals.institutions
          )} institutions without a single dominant outlier yet.`,
    },
    {
      index: "05",
      title: "The source layer stays inspectable",
      body: `${formatNumber(
        data.totals.sources
      )} source links are attached across the archive, so the dashboard can still be traced back to individual citations instead of summary copy alone.`,
    },
    {
      index: "06",
      title: "The tracker is operating on a daily rhythm",
      body: data.scout.nextOutputTimestamp
        ? `The public scout archive currently shows ${formatNumber(
            data.scout.archiveEntryCount
          )} entries across ${formatNumber(data.scout.runCount)} total runs since ${formatDate(
            data.scout.createdAt
          )} and is scheduled to refresh again on ${formatDate(data.scout.nextOutputTimestamp)}.`
        : `The public scout archive currently shows ${formatNumber(
            data.scout.archiveEntryCount
          )} entries across ${formatNumber(data.scout.runCount)} total runs since ${formatDate(
            data.scout.createdAt
          )} and is currently refreshing on a daily cadence.`,
    },
  ];

  const filterCategories = Array.from(new Set(initiativeRows.map((row) => row.category))).sort();
  const filterMonths = Array.from(new Set(initiativeRows.map((row) => row.monthLabel))).sort(
    (left, right) => new Date(right).getTime() - new Date(left).getTime()
  );
  const filterDomains = Array.from(
    new Set(
      initiativeRows
        .map((row) => row.sourceDomain)
        .filter((domain) => domain !== "Source unavailable")
    )
  ).sort();

  return (
    <main className="mx-auto w-full max-w-[1280px] px-6 py-12 sm:px-8 lg:px-10 lg:py-14">
      <header className="border-b border-border pb-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="dashboard-kicker">Higher Education Intelligence Report</p>
            <h1 className="mt-4 font-serif text-[clamp(2.6rem,6vw,4.6rem)] leading-[0.98] tracking-[-0.06em] text-slate-700">
              University AI Policies &amp; Strategic Moves Dashboard
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted">
              <span>{reportRange}</span>
              <span className="hidden h-1 w-1 rounded-full bg-border sm:inline-flex" />
              <span className="inline-flex items-center gap-2 rounded-full bg-deep-teal px-3 py-1 text-[11px] font-semibold tracking-[0.04em] text-white">
                <span className="h-2 w-2 rounded-full bg-white/90" />
                Last updated {formatDate(latest.timestamp, { month: "long", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              className="inline-flex items-center rounded-[10px] border border-border bg-white px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-deep-teal hover:text-deep-teal"
              href={SCOUT_SOURCE_URL}
              rel="noreferrer"
              target="_blank"
            >
              Open source scout
            </Link>
            <div className="rounded-[10px] border border-border bg-surface px-4 py-2 text-sm text-muted">
              {formatNumber(data.scout.archiveEntryCount)} archive entries
            </div>
          </div>
        </div>
      </header>

      <section className="py-10">
        <div className="mb-5">
          <h2 className="dashboard-section-title">Topline Metrics</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric) => (
            <article key={metric.label} className="dashboard-card relative overflow-hidden p-6">
              <div
                className="absolute inset-x-0 top-0 h-1.5"
                style={{ backgroundColor: metric.color }}
              />
              <p className="dashboard-kicker">{metric.label}</p>
              <p className="mt-4 font-serif text-5xl leading-none tracking-[-0.05em] text-foreground">
                {metric.value}
              </p>
              <p className="mt-3 max-w-md text-sm leading-7 text-muted">{metric.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pb-10">
        <div className="mb-5">
          <h2 className="dashboard-section-title">Initiative Breakdown</h2>
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="dashboard-card p-6 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-xl">
                <p className="dashboard-kicker">By category</p>
                <h3 className="mt-3 font-serif text-2xl tracking-[-0.04em] text-slate-700 sm:text-[2rem]">
                  The archive clusters around policy, research, curriculum, and
                  partnership signals.
                </h3>
              </div>
              <div className="rounded-[14px] border border-border bg-surface px-4 py-3 text-sm text-muted">
                {formatNumber(initiativeRows.length)} archived initiatives
              </div>
            </div>

            <div className="mt-8 grid gap-8 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
              <div className="mx-auto">
                <div
                  className="relative h-56 w-56 rounded-full border border-white/70"
                  style={{ background: categoryGradient }}
                >
                  <div className="absolute inset-[23%] rounded-full bg-white/96 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.85)]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="dashboard-kicker">Tracked</p>
                      <p className="mt-2 font-serif text-4xl leading-none tracking-[-0.05em] text-foreground">
                        {formatNumber(initiativeRows.length)}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted">
                        initiatives
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                {categoryItems.map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-foreground">{item.label}</span>
                      <span className="font-mono text-muted">{formatNumber(item.value)}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-surface">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${(item.value / Math.max(categoryItems[0]?.value ?? 1, 1)) * 100}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="dashboard-card p-6 sm:p-7">
            <p className="dashboard-kicker">Most active institutions</p>
            <h3 className="mt-3 max-w-lg font-serif text-2xl tracking-[-0.04em] text-slate-700 sm:text-[2rem]">
              Institutions appearing most often in the current archive.
            </h3>

            <div className="mt-8 space-y-5">
              {topInstitutions.map((item, index) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-foreground">{item.label}</span>
                    <span className="font-mono text-muted">{formatNumber(item.value)}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-surface">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${(item.value / maxInstitutionValue) * 100}%`,
                        backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="pb-10">
        <div className="mb-5">
          <h2 className="dashboard-section-title">Announcement Timeline</h2>
        </div>
        <article className="dashboard-card p-6 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="dashboard-kicker">Monthly distribution</p>
              <h3 className="mt-3 font-serif text-2xl tracking-[-0.04em] text-slate-700 sm:text-[2rem]">
                Initiative volume by month across the reporting window.
              </h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="dashboard-card-soft px-4 py-3">
                <p className="dashboard-kicker">Peak month</p>
                <p className="mt-2 text-sm text-foreground">
                  {peakMonth ? `${peakMonth.label} (${formatNumber(peakMonth.value)})` : "Pending"}
                </p>
              </div>
              <div className="dashboard-card-soft px-4 py-3">
                <p className="dashboard-kicker">Strongest run</p>
                <p className="mt-2 text-sm text-foreground">
                  {formatDate(strongestRun.timestamp)} ({formatNumber(strongestRun.initiativeCount)})
                </p>
              </div>
              <div className="dashboard-card-soft px-4 py-3">
                <p className="dashboard-kicker">Next refresh</p>
                <p className="mt-2 text-sm text-foreground">
                  {data.scout.nextOutputTimestamp
                    ? formatDate(data.scout.nextOutputTimestamp)
                    : "Daily"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 grid-cols-[repeat(auto-fit,minmax(92px,1fr))]">
            {monthlyTimeline.map((month) => {
              const isPeak = month.key === peakMonth?.key;

              return (
                <div key={month.key} className="dashboard-card-soft px-4 py-5">
                  <div className="flex h-40 items-end">
                    <div
                      className="w-full rounded-t-[14px]"
                      style={{
                        height: `${Math.max((month.value / maxMonthlyValue) * 100, 12)}%`,
                        background: isPeak
                          ? "linear-gradient(180deg, #10676F 0%, #1DCD98 100%)"
                          : "linear-gradient(180deg, rgba(53,164,185,0.92) 0%, rgba(182,212,231,0.92) 100%)",
                      }}
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted">{month.label}</span>
                    <span className="font-mono text-foreground">{formatNumber(month.value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="pb-10">
        <div className="mb-5">
          <h2 className="dashboard-section-title">Current Briefing</h2>
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="dashboard-card p-6 sm:p-7">
            <p className="dashboard-kicker">Latest digest</p>
            <h3 className="mt-3 font-serif text-[clamp(2rem,4vw,3rem)] leading-[1.02] tracking-[-0.05em] text-slate-700">
              {latest.title}
            </h3>
            <p className="mt-5 text-[15px] leading-8 text-muted">{latestSummary}</p>
            {latest.whyItMatters && latest.whyItMatters !== latestSummary ? (
              <p className="mt-4 text-[15px] leading-8 text-muted">{latest.whyItMatters}</p>
            ) : null}

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="dashboard-card-soft px-4 py-4">
                <p className="dashboard-kicker">Initiatives</p>
                <p className="mt-2 font-serif text-3xl leading-none tracking-[-0.05em] text-foreground">
                  {formatNumber(latest.initiativeCount)}
                </p>
              </div>
              <div className="dashboard-card-soft px-4 py-4">
                <p className="dashboard-kicker">Institutions</p>
                <p className="mt-2 font-serif text-3xl leading-none tracking-[-0.05em] text-foreground">
                  {formatNumber(latest.institutionCount)}
                </p>
              </div>
              <div className="dashboard-card-soft px-4 py-4">
                <p className="dashboard-kicker">Geographies</p>
                <p className="mt-2 font-serif text-3xl leading-none tracking-[-0.05em] text-foreground">
                  {formatNumber(latest.geographyCount)}
                </p>
              </div>
            </div>
          </article>

          <div className="grid gap-6">
            <article className="dashboard-card p-6">
              <p className="dashboard-kicker">Coverage scope</p>
              <p className="mt-4 text-sm leading-7 text-muted">{data.scout.query}</p>
            </article>

            <article className="dashboard-card p-6">
              <div className="flex items-center justify-between gap-4">
                <p className="dashboard-kicker">Latest source deck</p>
                <Link
                  className="text-sm font-medium text-deep-teal transition-colors hover:text-cyan"
                  href={SCOUT_SOURCE_URL}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open scout
                </Link>
              </div>
              <div className="mt-5 space-y-3">
                {data.latestSources.slice(0, 3).map((source) => (
                  <Link
                    key={source.url}
                    className="block rounded-[14px] border border-border bg-surface px-4 py-4 transition-colors hover:border-cyan hover:bg-white"
                    href={source.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <p className="dashboard-kicker">{source.domain}</p>
                    <h4 className="mt-2 text-sm font-semibold text-foreground">{source.title}</h4>
                    <p className="mt-2 text-sm leading-7 text-muted">{source.description}</p>
                  </Link>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="pb-10">
        <div className="mb-5">
          <h2 className="dashboard-section-title">All Initiatives</h2>
        </div>
        <InitiativesTable
          rows={initiativeRows}
          categories={filterCategories}
          months={filterMonths}
          domains={filterDomains}
        />
      </section>

      <section className="pb-10">
        <div className="mb-5">
          <h2 className="dashboard-section-title">Key Insights</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {insights.map((insight) => (
            <article key={insight.index} className="dashboard-card p-6">
              <div className="flex items-start gap-4">
                <div className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-[12px] bg-surface font-mono text-sm text-deep-teal">
                  {insight.index}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{insight.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted">{insight.body}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <p className="dashboard-kicker">Sources & References</p>
        <ul className="mt-5 grid gap-x-10 gap-y-3 md:grid-cols-2">
          {data.latestSources.map((source) => (
            <li key={source.url} className="text-sm text-muted">
              <Link
                className="font-medium text-deep-teal transition-colors hover:text-cyan"
                href={source.url}
                rel="noreferrer"
                target="_blank"
              >
                {source.title}
              </Link>
              <span className="ml-2 text-muted/80">{source.domain}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs leading-6 text-muted/80">
          Dashboard content is pulled from the public Yutori scout and revalidated every
          24 hours.
        </p>
      </footer>
    </main>
  );
}
