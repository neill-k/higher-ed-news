import {
  BAN,
  Callout,
  cx,
  EmptyReportState,
  Exhibit,
  PeerChip,
  ReportPage,
  SourceLink,
} from "@/components/report-page";
import {
  ANCHOR_SLUG,
  countActiveLitigation,
  countWithChiefAIOfficer,
  countWithPolicy,
  filterByTier,
  getPeerProfiles,
} from "@/lib/peer-data";
import {
  formatCompactNumber,
  formatCurrencyCompact,
  getReportDataset,
} from "@/lib/report-data";

function formatMonthYear(value: string | null) {
  if (!value) return "";
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
}

export default async function DashboardOverview() {
  const [dataset, peers] = await Promise.all([getReportDataset(), getPeerProfiles()]);

  if (!dataset) {
    return (
      <ReportPage title="Executive briefing" subtitle="Run the pipeline to generate the briefing.">
        <EmptyReportState />
      </ReportPage>
    );
  }

  const anchor = peers.find((peer) => peer.slug === ANCHOR_SLUG) ?? null;
  const secPeers = filterByTier(peers, "sec");
  const nonAnchorPeers = secPeers.filter((peer) => peer.slug !== ANCHOR_SLUG);

  const policyRate = Math.round((countWithPolicy(secPeers) / secPeers.length) * 100);
  const policyRatePeers = Math.round(
    (countWithPolicy(nonAnchorPeers) / nonAnchorPeers.length) * 100,
  );
  const chiefAIOfficers = countWithChiefAIOfficer(secPeers);
  const chiefAIOfficerPeers = countWithChiefAIOfficer(nonAnchorPeers);
  const activeLitigation = countActiveLitigation(secPeers);

  const { data, insights, investments, institutions, dateRange } = dataset;
  const totalInvestment = investments.reduce((sum, deal) => sum + deal.amountUsd, 0);
  const updateCount = data.metadata.updateCount;
  const generatedLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(data.metadata.generatedAt));

  // Honest daily-rate change (replaces the misleading "momentum lift" metric)
  const windowDays =
    (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
  const midDay = windowDays / 2;
  const firstHalfDays = Math.max(1, midDay);
  const secondHalfDays = Math.max(1, windowDays - midDay);
  const earlyInsights = insights.filter(
    (insight) => new Date(insight.date).getTime() < dateRange.midpoint,
  );
  const lateInsights = insights.filter(
    (insight) => new Date(insight.date).getTime() >= dateRange.midpoint,
  );
  const earlyRate = earlyInsights.length / firstHalfDays;
  const lateRate = lateInsights.length / secondHalfDays;
  const dailyRateLift = earlyRate > 0 ? lateRate / earlyRate : 1;

  const recentTrend = data.trends[0];
  const recentTension = data.tensions[0];

  // "This week at peers" — gather the most recent statements + deals across SEC peers.
  const weeklyItems = [
    ...peers.flatMap((peer) =>
      peer.notable_deals_investments
        .filter((deal) => deal.date)
        .map((deal) => ({
          kind: "deal" as const,
          institution: peer.institution,
          slug: peer.slug,
          title: deal.title,
          date: deal.date,
          summary: deal.summary,
          href: deal.evidence_url,
        })),
    ),
    ...peers.flatMap((peer) =>
      peer.leadership_statements
        .filter((statement) => statement.date)
        .map((statement) => ({
          kind: "statement" as const,
          institution: peer.institution,
          slug: peer.slug,
          title: `${statement.speaker} — ${statement.context}`,
          date: statement.date,
          summary: statement.quote_or_summary,
          href: statement.evidence_url,
        })),
    ),
  ]
    .sort((left, right) => (right.date ?? "").localeCompare(left.date ?? ""))
    .slice(0, 8);

  return (
    <ReportPage
      eyebrow="LSU CIO Briefing"
      title="Executive briefing"
      subtitle={`Peer AI intelligence across ${secPeers.length} SEC institutions, cross-referenced against ${formatCompactNumber(institutions.length)} tracked institutions globally and ${data.metadata.updateCount} update bundles — ${generatedLabel}.`}
      actionHref="/api/report?format=markdown"
      actionLabel="Export report"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <BAN
          label="SEC peers with a published AI policy"
          value={`${policyRate}%`}
          definition={`${countWithPolicy(secPeers)} of ${secPeers.length} institutions`}
          comparator={
            anchor
              ? `LSU: ${anchor.ai_policy.has_published_policy ? "yes — Faculty Senate GAI guidelines, Fall 2025" : "no published policy"}. Peer rate excluding LSU: ${policyRatePeers}%.`
              : undefined
          }
        />
        <BAN
          label="SEC peers with a dedicated AI leadership role"
          value={`${chiefAIOfficers} / ${secPeers.length}`}
          tone="danger"
          definition={chiefAIOfficers === 0 ? "none publicly named" : `${chiefAIOfficerPeers} excluding LSU`}
          comparator="No SEC peer has appointed a Chief AI Officer. The CIO question is whether to lead the SEC by doing so."
        />
        <BAN
          label="Tracked capital in AI signals (global)"
          value={formatCurrencyCompact(totalInvestment)}
          tone="neutral"
          definition={`${investments.length} disclosed deals`}
          comparator={`Only 10.5% of ${insights.length} insights disclose a dollar amount — this is the floor, not the ceiling.`}
        />
        <BAN
          label="Active AI-related controversies at SEC peers"
          value={`${activeLitigation}`}
          tone="danger"
          definition={activeLitigation === 1 ? "1 school with live exposure" : `${activeLitigation} schools`}
          comparator={
            anchor && anchor.litigation_or_controversy.some((c) => c.status === "active")
              ? "Includes LSU — 1,488 Fall 2025 academic misconduct cases with Turnitin detection controversy."
              : undefined
          }
        />
      </div>

      <Exhibit
        number="1"
        title="Peer AI posture — the one-line read"
        subtitle="Where each SEC peer stands on the four moves that matter: published policy, dedicated AI leadership, named vendor deployment, AI degree program."
        source="SEC peer research team, primary-source verified"
        n={secPeers.length}
        asOf="April 2026"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f5f2e9] text-[10px] uppercase tracking-[0.16em] text-[#8c8782]">
              <tr>
                <th className="px-3 py-2.5 font-medium">Institution</th>
                <th className="px-3 py-2.5 font-medium">Policy</th>
                <th className="px-3 py-2.5 font-medium">AI leadership role</th>
                <th className="px-3 py-2.5 font-medium">Vendor deployments</th>
                <th className="px-3 py-2.5 font-medium">AI programs</th>
                <th className="px-3 py-2.5 font-medium">Active issues</th>
              </tr>
            </thead>
            <tbody>
              {[...secPeers]
                .sort((left, right) => {
                  if (left.slug === ANCHOR_SLUG) return -1;
                  if (right.slug === ANCHOR_SLUG) return 1;
                  return left.institution.localeCompare(right.institution);
                })
                .map((peer) => {
                  const deployments = peer.vendor_deployments.length;
                  const programs = peer.ai_academic_programs.length;
                  const active = peer.litigation_or_controversy.filter(
                    (item) => item.status === "active",
                  ).length;
                  const isAnchor = peer.slug === ANCHOR_SLUG;
                  return (
                    <tr
                      key={peer.slug}
                      className={cx(
                        "border-t border-[#ebe7dd]",
                        isAnchor ? "bg-[#f5f2e9]" : "",
                      )}
                    >
                      <td className="px-3 py-2.5 text-[13px] font-medium text-[#2d2926]">
                        <div className="flex items-center gap-2">
                          <span>{peer.institution}</span>
                          {isAnchor ? <PeerChip name="LSU" highlighted /> : null}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[13px] text-[#5e5954]">
                        {peer.ai_policy.has_published_policy ? "Published" : "None public"}
                      </td>
                      <td className="px-3 py-2.5 text-[13px] text-[#5e5954]">
                        {peer.system_leadership.chief_ai_officer ??
                          (peer.system_leadership.has_dedicated_ai_role ? "Yes (distributed)" : "No")}
                      </td>
                      <td className="px-3 py-2.5 text-[13px] text-[#5e5954] tabular">
                        {deployments}
                      </td>
                      <td className="px-3 py-2.5 text-[13px] text-[#5e5954] tabular">{programs}</td>
                      <td className="px-3 py-2.5 text-[13px] text-[#5e5954]">
                        {active > 0 ? (
                          <span className="inline-flex rounded-full bg-[#f8d8d2] px-2 py-0.5 text-[11px] font-medium text-[#9b3727]">
                            {active} active
                          </span>
                        ) : (
                          <span className="text-[#8c8782]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Exhibit>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Exhibit
          number="2"
          title="Recent moves across SEC peers"
          subtitle="Deals and leadership statements, most recent first. Each links to its primary source."
          source="Peer research team"
          n={weeklyItems.length}
        >
          <ol className="space-y-4">
            {weeklyItems.map((item) => (
              <li
                className="flex gap-4 border-b border-[#ebe7dd] pb-3 last:border-none last:pb-0"
                key={`${item.slug}-${item.title}`}
              >
                <div className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-[0.14em] text-[#8c8782]">
                  {formatMonthYear(item.date)}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium text-[#2d2926]">
                      {item.institution}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-[#8c8782]">
                      {item.kind === "deal" ? "Deal / partnership" : "Leadership"}
                    </span>
                  </div>
                  <div className="text-[13px] leading-[1.55] text-[#2d2926]">{item.title}</div>
                  <p className="text-[12px] leading-[1.55] text-[#5e5954]">{item.summary}</p>
                  {item.href ? <SourceLink href={item.href} /> : null}
                </div>
              </li>
            ))}
          </ol>
        </Exhibit>

        <div className="flex flex-col gap-5">
          <Exhibit
            number="3"
            title="Where LSU stands, in one view"
            subtitle="Anchored on the four measures above."
          >
            {anchor ? (
              <div className="space-y-4 text-[13px] leading-[1.6] text-[#2d2926]">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[#8c8782]">
                    Policy
                  </div>
                  <div>{anchor.ai_policy.summary}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[#8c8782]">
                    Vendor posture
                  </div>
                  <div>
                    {anchor.vendor_deployments
                      .map((deploy) => `${deploy.product} (${deploy.scope})`)
                      .join("; ")}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[#8c8782]">
                    Governance
                  </div>
                  <div>{anchor.governance_structure.notes}</div>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-[#5e5954]">LSU profile not available.</p>
            )}
          </Exhibit>

          <Callout kind="action">
            The CIO has two moves the rest of the SEC has not yet made: (1) name a Chief AI
            Officer or formalize ODSA&rsquo;s AI remit, and (2) convert the Faculty Senate Fall 2025 GAI
            guidelines into a board-approved university-wide policy before the Dec 2026 accreditation
            cycle. Either one alone would put LSU ahead of the SEC median.
          </Callout>
        </div>
      </div>

      <Exhibit
        number="4"
        title={`Signal volume rose ${dailyRateLift.toFixed(2)}× between the first and second halves of the window`}
        subtitle={`Computed from daily insight-reporting rates. First half: ${earlyRate.toFixed(1)} insights/day over ~${Math.round(firstHalfDays)} days. Second half: ${lateRate.toFixed(1)}/day over ~${Math.round(secondHalfDays)} days. This is a 4-month window, not a durable trend.`}
        source="report-data.json (pipeline output)"
        n={insights.length}
        caveat="Sparse early data inflates simple count ratios — the daily-rate ratio shown here is the honest comparison."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[12px] border border-[#ebe7dd] bg-[#fafaf6] p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#8c8782]">Window</div>
            <div className="mt-1 text-[14px] font-medium text-[#2d2926]">
              {dateRange.start.toLocaleDateString()} → {dateRange.end.toLocaleDateString()}
            </div>
            <div className="mt-1 text-[11px] text-[#8c8782]">
              {updateCount} update bundles · {insights.length} insights
            </div>
          </div>
          {recentTrend ? (
            <div className="rounded-[12px] border border-[#ebe7dd] bg-[#fafaf6] p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[#8c8782]">
                Lead trend
              </div>
              <div className="mt-1 text-[14px] font-medium text-[#2d2926]">{recentTrend.name}</div>
              <p className="mt-1 line-clamp-4 text-[11px] leading-[1.5] text-[#5e5954]">
                {recentTrend.narrative}
              </p>
            </div>
          ) : null}
          {recentTension ? (
            <div className="rounded-[12px] border border-[#ebe7dd] bg-[#fafaf6] p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[#8c8782]">
                Sharpest tension
              </div>
              <div className="mt-1 text-[14px] font-medium text-[#2d2926]">
                {recentTension.label}
              </div>
              <p className="mt-1 line-clamp-4 text-[11px] leading-[1.5] text-[#5e5954]">
                {recentTension.description}
              </p>
            </div>
          ) : null}
        </div>
      </Exhibit>
    </ReportPage>
  );
}
