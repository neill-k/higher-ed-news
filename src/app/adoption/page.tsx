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
  filterByTier,
  getPeerProfiles,
  totalAcademicPrograms,
  totalVendorDeployments,
} from "@/lib/peer-data";
import {
  formatCategoryLabel,
  getReportDataset,
  percentOf,
  type ReportInsight,
} from "@/lib/report-data";

const CATEGORY_KEYS = [
  "governance_and_policy",
  "teaching_and_learning",
  "research_and_innovation",
  "student_experience_and_services",
  "enterprise_tools_and_infrastructure",
] as const;

function uniqueValues(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function firstSentence(text: string) {
  const match = text.match(/.+?[.!?](?:\s|$)/);
  return match ? match[0].trim() : text;
}

function formatDateLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getTopCategoryLabels(breakdown: Record<string, number>, limit = 2) {
  return Object.entries(breakdown)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([category]) => formatCategoryLabel(category));
}

function getRepresentativeInstitutions(relatedInsights: ReportInsight[], limit = 3) {
  return uniqueValues(
    relatedInsights.flatMap((insight) =>
      insight.institutions
        .map((institution) => institution.name)
        .filter((name) => name && name.toLowerCase() !== "unknown"),
    ),
  ).slice(0, limit);
}

function getRepresentativeVendors(relatedInsights: ReportInsight[], limit = 2) {
  return uniqueValues(
    relatedInsights.flatMap((insight) =>
      insight.toolsAndVendors
        .map((tool) => tool.vendor)
        .filter((vendor) => vendor && vendor.toLowerCase() !== "unknown"),
    ),
  ).slice(0, limit);
}

export default async function AdoptionPage() {
  const [dataset, peers] = await Promise.all([getReportDataset(), getPeerProfiles()]);

  if (!dataset) {
    return (
      <ReportPage title="Adoption & trends" subtitle="Run the pipeline to generate the briefing.">
        <EmptyReportState />
      </ReportPage>
    );
  }

  const secPeers = filterByTier(peers, "sec");
  const { data, insights, institutions, dateRange } = dataset;

  // Honest daily-rate comparison instead of raw count ratio.
  const windowDays = (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
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

  // Per-category coverage across institutions
  const totalInstitutions = institutions.length;
  const categoryCoverage = CATEGORY_KEYS.map((key) => {
    const count = institutions.filter(
      (institution) => (institution.categories[key] ?? 0) > 0,
    ).length;
    return {
      key,
      label: formatCategoryLabel(key),
      count,
      pct: percentOf(count, totalInstitutions),
    };
  }).sort((left, right) => right.pct - left.pct);

  // Period narratives from update bundles — surface the week-by-week prose
  const recentBundles = [...data.updateBundles]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 5);
  const insightMap = new Map(insights.map((insight) => [insight.id, insight] as const));

  // Peer adoption benchmarks
  const withPolicy = secPeers.filter((peer) => peer.ai_policy.has_published_policy).length;
  const withDeployments = secPeers.filter((peer) => peer.vendor_deployments.length > 0).length;
  const withPrograms = secPeers.filter((peer) => peer.ai_academic_programs.length > 0).length;
  const withCommittee = secPeers.filter((peer) => peer.governance_structure.committee_name).length;
  const totalDeployments = totalVendorDeployments(secPeers);
  const totalPrograms = totalAcademicPrograms(secPeers);
  const bundleCards = recentBundles.map((bundle) => {
    const topCategories = getTopCategoryLabels(bundle.categoryBreakdown);
    const exampleInstitutions = getRepresentativeInstitutions(bundle.insights);
    const exampleVendors = getRepresentativeVendors(bundle.insights);

    return {
      ...bundle,
      topCategories,
      exampleInstitutions,
      exampleVendors,
      whatMoved:
        topCategories.length > 0
          ? `${bundle.insights.length} signals concentrated in ${topCategories.join(" and ")}.`
          : `${bundle.insights.length} signals across multiple categories.`,
      whyItMatters:
        bundle.trendSignals[0] ??
        bundle.periodThemes[0] ??
        firstSentence(bundle.periodSummary),
      examples:
        exampleInstitutions.length > 0
          ? exampleInstitutions.join(", ")
          : exampleVendors.join(", "),
    };
  });
  const trendCards = data.trends.slice(0, 5).map((trend) => {
    const relatedInsights = trend.insightIds
      .map((insightId) => insightMap.get(insightId))
      .filter((insight): insight is ReportInsight => Boolean(insight));
    const exampleInstitutions = getRepresentativeInstitutions(relatedInsights);
    const exampleVendors = getRepresentativeVendors(relatedInsights);
    const watchItem =
      relatedInsights.find((insight) => insight.policyImplications)?.policyImplications ??
      firstSentence(trend.narrative);

    return {
      ...trend,
      exampleInstitutions,
      exampleVendors,
      watchItem,
    };
  });

  return (
    <ReportPage
      eyebrow="LSU CIO Briefing"
      title="Adoption & trends"
      subtitle="This page answers two concrete questions: how far SEC peers have already gone, and which recent moves suggest the next baseline LSU will be judged against."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <BAN
          label="SEC peers with a published AI policy"
          value={`${withPolicy}/${secPeers.length}`}
          definition={`${percentOf(withPolicy, secPeers.length)}%`}
          tone="gold"
        />
        <BAN
          label="SEC peers with enterprise vendor deployments"
          value={`${withDeployments}/${secPeers.length}`}
          definition={`${totalDeployments} named deployments`}
          tone="gold"
        />
        <BAN
          label="SEC peers launching AI academic programs"
          value={`${withPrograms}/${secPeers.length}`}
          definition={`${totalPrograms} programs across the SEC`}
          tone="neutral"
        />
        <BAN
          label="SEC peers with a formal AI committee"
          value={`${withCommittee}/${secPeers.length}`}
          definition="distributed or dedicated governance body"
          tone="neutral"
        />
      </div>

      <Callout kind="finding">
        Baseline SEC adoption is already settled: {withDeployments} of {secPeers.length} peers have
        named AI deployments, {withPrograms} of {secPeers.length} have AI programs, and{" "}
        {withPolicy} of {secPeers.length} have a published policy. The useful question is no longer{" "}
        whether campuses are adopting AI. It is which institutions are turning adoption into durable
        governance, procurement discipline, and workforce advantage.
      </Callout>

      <Exhibit
        number="A1"
        title={`Reporting rate rose ${dailyRateLift.toFixed(2)}× — not ${(insights.length / Math.max(earlyInsights.length, 1)).toFixed(1)}×`}
        subtitle={`Earlier pages showed ${(insights.length / Math.max(earlyInsights.length, 1)).toFixed(1)}× "momentum" by comparing raw counts across two unequal windows. The honest number is the daily-rate ratio. First half: ${earlyRate.toFixed(1)} insights/day over ~${Math.round(firstHalfDays)} days. Second half: ${lateRate.toFixed(1)}/day over ~${Math.round(secondHalfDays)} days.`}
        source="report-data.json"
        n={insights.length}
        caveat="A 4-month window is a snapshot, not a durable trend."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[12px] border border-[#ebe7dd] bg-[#fafaf6] p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#8c8782]">
              First half
            </div>
            <div className="mt-1 text-[22px] font-semibold tabular text-[#2d2926]">
              {earlyRate.toFixed(1)}
            </div>
            <div className="text-[11px] text-[#8c8782]">
              insights per day · {earlyInsights.length} insights
            </div>
          </div>
          <div className="rounded-[12px] border border-[#ebe7dd] bg-[#fafaf6] p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#8c8782]">
              Second half
            </div>
            <div className="mt-1 text-[22px] font-semibold tabular text-[#2d2926]">
              {lateRate.toFixed(1)}
            </div>
            <div className="text-[11px] text-[#8c8782]">
              insights per day · {lateInsights.length} insights
            </div>
          </div>
        </div>
      </Exhibit>

      <Exhibit
        number="A2"
        title="Adoption by category — share of tracked institutions showing signals"
        subtitle="Category coverage across 1,104 institutions in the global dataset. Useful for seeing where institutional activity is concentrated sector-wide."
        source="report-data.json"
        n={totalInstitutions}
      >
        <div className="space-y-3">
          {categoryCoverage.map((row) => (
            <div className="flex items-center gap-3" key={row.key}>
              <span className="w-44 shrink-0 text-[12.5px] text-[#5e5954]">{row.label}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#ebe7dd]">
                <div
                  className="h-full rounded-full bg-[#7d6b3d]"
                  style={{ width: `${row.pct}%` }}
                />
              </div>
              <span className="w-14 text-right text-[12px] font-medium text-[#2d2926] tabular">
                {row.pct}%
              </span>
            </div>
          ))}
        </div>
      </Exhibit>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Exhibit
          number="A3"
          title="What changed most recently, and why it matters"
          subtitle="Each bundle answers three questions: what actually moved, where it showed up, and what institutional pattern it signals."
          source="Pipeline synthesis (updateBundles[].periodSummary)"
          n={data.updateBundles.length}
        >
          <ol className="space-y-4">
            {bundleCards.map((bundle) => (
              <li
                key={bundle.updateId}
                className="border-b border-[#ebe7dd] pb-3 last:border-none last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium text-[#2d2926]">{bundle.periodTitle}</span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-[#8c8782]">
                    {bundle.periodRange}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <div className="rounded-[12px] border border-[#ebe7dd] bg-[#fafaf6] p-3">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-[#8c8782]">
                      What moved
                    </div>
                    <div className="mt-1 text-[12.5px] leading-[1.55] text-[#2d2926]">
                      {bundle.whatMoved}
                    </div>
                  </div>
                  <div className="rounded-[12px] border border-[#ebe7dd] bg-[#fafaf6] p-3">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-[#8c8782]">
                      Named examples
                    </div>
                    <div className="mt-1 text-[12.5px] leading-[1.55] text-[#2d2926]">
                      {bundle.examples || "Examples are sparse in this bundle, but the pattern still appears in the source data."}
                    </div>
                  </div>
                </div>
                <p className="mt-1 text-[12.5px] leading-[1.6] text-[#2d2926]">
                  {bundle.periodSummary}
                </p>
                <div className="mt-2 rounded-[12px] border border-[#ebe7dd] bg-[#fafaf6] p-3">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[#8c8782]">
                    Why it matters
                  </div>
                  <p className="mt-1 text-[12px] leading-[1.6] text-[#5e5954]">
                    {bundle.whyItMatters}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Exhibit>

        <Exhibit
          number="A4"
          title="Trends worth a CIO read"
          subtitle="Each pattern includes volume, recency, and representative institutions so the claim has a concrete anchor."
          source="Pipeline synthesis (data.trends[].narrative)"
          n={data.trends.length}
        >
          <ol className="space-y-3">
            {trendCards.map((trend) => (
              <li key={trend.id} className="border-b border-[#ebe7dd] pb-3 last:border-none last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-[#2d2926]">{trend.name}</span>
                  <span
                    className={cx(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                      trend.direction === "accelerating"
                        ? "bg-[#d9ecd8] text-[#24513d]"
                        : trend.direction === "stable"
                          ? "bg-[#ece7de] text-[#5e5954]"
                          : "bg-[#f8d8d2] text-[#9b3727]",
                    )}
                  >
                    {trend.direction}
                  </span>
                  <span className="inline-flex rounded-full bg-[#f5f2e9] px-2 py-0.5 text-[11px] font-medium text-[#5e5954]">
                    {trend.initiativeCount} signals
                  </span>
                </div>
                <div className="mt-2 grid gap-2 text-[11px] text-[#8c8782] md:grid-cols-2">
                  <div>
                    Window: {formatDateLabel(trend.firstSeen)} to {formatDateLabel(trend.lastSeen)}
                  </div>
                  <div>Category: {formatCategoryLabel(trend.category)}</div>
                  <div className="md:col-span-2">
                    Examples:{" "}
                    {trend.exampleInstitutions.length > 0
                      ? trend.exampleInstitutions.join(", ")
                      : trend.exampleVendors.length > 0
                        ? trend.exampleVendors.join(", ")
                        : "No clean representative institution names surfaced for this trend."}
                  </div>
                </div>
                <p className="mt-2 text-[12px] leading-[1.6] text-[#5e5954]">{trend.watchItem}</p>
              </li>
            ))}
          </ol>
        </Exhibit>
      </div>

      <Exhibit
        number="A5"
        title="AI academic programs across SEC peers"
        subtitle="Every AI degree, certificate, minor, or concentration launched or announced by an SEC peer."
        source="Peer research team, primary-source verified"
        n={totalPrograms}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f5f2e9] text-[10px] uppercase tracking-[0.16em] text-[#8c8782]">
              <tr>
                <th className="px-3 py-2.5 font-medium">Institution</th>
                <th className="px-3 py-2.5 font-medium">Program</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Level</th>
                <th className="px-3 py-2.5 font-medium">Launch</th>
                <th className="px-3 py-2.5 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {secPeers
                .flatMap((peer) =>
                  peer.ai_academic_programs.map((program) => ({
                    ...program,
                    institution: peer.institution,
                    slug: peer.slug,
                  })),
                )
                .sort((left, right) =>
                  (right.announced_or_launched ?? "").localeCompare(left.announced_or_launched ?? ""),
                )
                .map((program, index) => (
                  <tr
                    key={`${program.slug}-${index}`}
                    className={cx(
                      "border-t border-[#ebe7dd]",
                      program.slug === ANCHOR_SLUG ? "bg-[#f5f2e9]" : "",
                    )}
                  >
                    <td className="px-3 py-2.5 text-[13px] font-medium text-[#2d2926]">
                      <div className="flex items-center gap-2">
                        <span>{program.institution}</span>
                        {program.slug === ANCHOR_SLUG ? <PeerChip name="LSU" highlighted /> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px] text-[#2d2926]">{program.name}</td>
                    <td className="px-3 py-2.5 text-[12px] text-[#5e5954] capitalize">
                      {program.program_type}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-[#5e5954] capitalize">
                      {program.level}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-[#5e5954] tabular">
                      {program.announced_or_launched ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[12px]">
                      {program.evidence_url ? <SourceLink href={program.evidence_url} /> : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Exhibit>

      <Callout kind="action">
        Two asymmetric opportunities visible from this page: (1) LSU launched Louisiana&rsquo;s first BS
        in AI for Fall 2026 and an AI Essentials dual-enrollment pipeline — few SEC peers have
        either. That&rsquo;s a reputational lead if leaned into. (2) On formal governance bodies LSU is
        mid-pack; converting the Faculty Senate Fall 2025 GAI guidelines into a board-approved
        policy would put LSU in the top quartile.
      </Callout>
    </ReportPage>
  );
}
