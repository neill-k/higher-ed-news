import {
  BAN,
  Callout,
  cx,
  EmptyReportState,
  Exhibit,
  Panel,
  PeerChip,
  ReportPage,
  SourceLink,
} from "@/components/report-page";
import {
  ANCHOR_SLUG,
  filterByTier,
  getPeerProfiles,
  hasVendor,
  totalVendorDeployments,
  VENDOR_LABEL,
  VENDOR_ORDER,
} from "@/lib/peer-data";
import {
  formatCategoryLabel,
  formatCurrencyCompact,
  getReportDataset,
  percentOf,
} from "@/lib/report-data";

export default async function VendorsAndCapitalPage() {
  const [dataset, peers] = await Promise.all([getReportDataset(), getPeerProfiles()]);

  if (!dataset) {
    return (
      <ReportPage title="Vendors & capital" subtitle="Run the pipeline to generate the briefing.">
        <EmptyReportState />
      </ReportPage>
    );
  }

  const secPeers = filterByTier(peers, "sec");
  const anchor = peers.find((peer) => peer.slug === ANCHOR_SLUG);
  const { investments, insights } = dataset;

  const totalInvestment = investments.reduce((sum, deal) => sum + deal.amountUsd, 0);
  const totalDeployments = totalVendorDeployments(secPeers);

  // SEC peer vendor concentration
  const vendorCounts = VENDOR_ORDER.map((bucket) => ({
    bucket,
    label: VENDOR_LABEL[bucket],
    count: secPeers.filter((peer) => hasVendor(peer, bucket)).length,
  })).filter((row) => row.count > 0);
  const totalSECPeers = secPeers.length;

  // Peer-level deals
  const peerDeals = secPeers
    .flatMap((peer) =>
      peer.notable_deals_investments.map((deal) => ({
        ...deal,
        institution: peer.institution,
        slug: peer.slug,
      })),
    )
    .sort((left, right) => (right.date ?? "").localeCompare(left.date ?? ""));

  // Funding source rollup from global dataset
  const fundingBySource = investments.reduce<Record<string, number>>((totals, deal) => {
    totals[deal.sourceBucket] = (totals[deal.sourceBucket] ?? 0) + deal.amountUsd;
    return totals;
  }, {});
  const fundingSourceRows = Object.entries(fundingBySource)
    .sort((left, right) => right[1] - left[1])
    .map(([label, value]) => ({
      label,
      value,
      pct: percentOf(value, totalInvestment),
    }));

  const topDeals = investments.slice(0, 6);

  return (
    <ReportPage
      eyebrow="LSU CIO Briefing"
      title="Vendors & capital"
      subtitle="Two questions: which AI platforms is the SEC actually deploying, and where is disclosed capital flowing in the broader sector?"
      actionHref="/api/report?format=json"
      actionLabel="Export data"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <BAN
          label="Vendor deployments tracked across SEC peers"
          value={`${totalDeployments}`}
          definition={`${totalSECPeers} peers`}
          tone="gold"
          comparator="Average of ~2 named deployments per peer; most run at least one productivity suite plus one frontier-model partner."
        />
        <BAN
          label="Dominant SEC stack"
          value="Copilot+"
          definition={`${secPeers.filter((peer) => hasVendor(peer, "microsoft_copilot")).length}/${totalSECPeers} with Copilot`}
          tone="gold"
          comparator="Microsoft Copilot is the baseline productivity layer; frontier-model partner choice (OpenAI vs. Anthropic vs. homegrown) is the differentiator."
        />
        <BAN
          label="Tracked disclosed capital (global dataset)"
          value={formatCurrencyCompact(totalInvestment)}
          tone="neutral"
          definition={`${investments.length} deals`}
          comparator={`Only ${percentOf(investments.length, insights.length)}% of ${insights.length} insights disclose an amount. This is the floor, not the ceiling.`}
        />
        <BAN
          label="LSU&rsquo;s enterprise AI stack"
          value={anchor ? `${anchor.vendor_deployments.length}` : "—"}
          tone="danger"
          definition={anchor ? "named deployments" : "profile missing"}
          comparator={
            anchor && anchor.vendor_deployments[0]
              ? `Primary: ${anchor.vendor_deployments[0].product} (${anchor.vendor_deployments[0].scope}).`
              : undefined
          }
        />
      </div>

      <Exhibit
        number="V1"
        title="SEC vendor-deployment matrix — who&rsquo;s running what"
        subtitle="Classifies each peer&rsquo;s disclosed deployments into the five enterprise stacks CIOs are actually comparing."
        source="Peer research team, primary-source verified"
        n={totalSECPeers}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f5f2e9] text-[10px] uppercase tracking-[0.16em] text-[#8c8782]">
              <tr>
                <th className="px-3 py-2.5 font-medium">Institution</th>
                {VENDOR_ORDER.map((bucket) => (
                  <th key={bucket} className="px-3 py-2.5 font-medium text-center">
                    {VENDOR_LABEL[bucket]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...secPeers]
                .sort((left, right) => {
                  if (left.slug === ANCHOR_SLUG) return -1;
                  if (right.slug === ANCHOR_SLUG) return 1;
                  return left.institution.localeCompare(right.institution);
                })
                .map((peer) => (
                  <tr
                    key={peer.slug}
                    className={cx(
                      "border-t border-[#ebe7dd]",
                      peer.slug === ANCHOR_SLUG ? "bg-[#f5f2e9]" : "",
                    )}
                  >
                    <td className="px-3 py-2.5 text-[13px] font-medium text-[#2d2926]">
                      <div className="flex items-center gap-2">
                        <span>{peer.institution}</span>
                        {peer.slug === ANCHOR_SLUG ? <PeerChip name="LSU" highlighted /> : null}
                      </div>
                    </td>
                    {VENDOR_ORDER.map((bucket) => (
                      <td key={bucket} className="px-3 py-2.5 text-center text-[13px]">
                        {hasVendor(peer, bucket) ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#7d6b3d] text-[11px] font-medium text-white">
                            ●
                          </span>
                        ) : (
                          <span className="text-[#b8b2a8]">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-2 text-[12px] text-[#5e5954]">
          {vendorCounts.map((row) => (
            <div key={row.bucket} className="flex items-center gap-3">
              <span className="w-44 shrink-0">{row.label}</span>
              <div className="h-2 flex-1 rounded-full bg-[#ebe7dd]">
                <div
                  className="h-full rounded-full bg-[#7d6b3d]"
                  style={{ width: `${(row.count / totalSECPeers) * 100}%` }}
                />
              </div>
              <span className="w-20 text-right tabular text-[#2d2926]">
                {row.count}/{totalSECPeers}
              </span>
            </div>
          ))}
        </div>
        <Callout kind="implication">
          Microsoft Copilot is the SEC baseline. The divergence — and procurement leverage — is on
          the frontier-model layer. LSU&rsquo;s MikeGPT (OpenAI via Azure, custom RAG on 35K curated
          LSU documents) puts LSU in a small SEC minority with a homegrown sovereign posture
          rather than an enterprise ChatGPT Edu or Claude for Education contract.
        </Callout>
      </Exhibit>

      <Exhibit
        number="V2"
        title="Deal flow across SEC peers"
        subtitle="Every deal or partnership surfaced by the peer research team, newest first. Each links to its primary source."
        source="Peer research team"
        n={peerDeals.length}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f5f2e9] text-[10px] uppercase tracking-[0.16em] text-[#8c8782]">
              <tr>
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Institution</th>
                <th className="px-3 py-2.5 font-medium">Deal / partnership</th>
                <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                <th className="px-3 py-2.5 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {peerDeals.slice(0, 16).map((deal, index) => (
                <tr key={`${deal.slug}-${index}`} className="border-t border-[#ebe7dd]">
                  <td className="px-3 py-2.5 text-[12px] text-[#8c8782] tabular">
                    {deal.date ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[13px] font-medium text-[#2d2926]">
                    {deal.institution}
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px] text-[#2d2926]">
                    <div className="font-medium">{deal.title}</div>
                    <div className="mt-0.5 text-[11.5px] leading-[1.5] text-[#5e5954]">
                      {deal.summary}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px] text-right text-[#2d2926] tabular">
                    {deal.amount_usd !== null
                      ? formatCurrencyCompact(deal.amount_usd)
                      : "Undisclosed"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px]">
                    {deal.evidence_url ? <SourceLink href={deal.evidence_url} /> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Exhibit>

      <Exhibit
        number="V3"
        title={`Disclosed capital in the global signal set — ${formatCurrencyCompact(totalInvestment)} across ${investments.length} deals`}
        subtitle="Funding by source type. Totals reflect only deals with an explicitly disclosed dollar amount."
        source="Pipeline output, with funding-source classification"
        n={investments.length}
        caveat={`Only ${percentOf(investments.length, insights.length)}% of ${insights.length} tracked insights have a disclosed amount — steady-state procurement (LMS licences, API tiers, cloud contracts) is not captured here.`}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            {fundingSourceRows.map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-48 shrink-0 text-[13px] text-[#2d2926]">{row.label}</span>
                <div className="h-3 flex-1 rounded-full bg-[#ebe7dd]">
                  <div
                    className="h-full rounded-full bg-[#7d6b3d]"
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
                <span className="w-20 text-right text-[12px] font-medium text-[#2d2926] tabular">
                  {formatCurrencyCompact(row.value)}
                </span>
              </div>
            ))}
          </div>
          <Panel className="bg-[#f5f2e9]">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#8c8782]">
              Top tracked deals (global)
            </div>
            <ul className="mt-2 space-y-2 text-[12.5px] leading-[1.55] text-[#2d2926]">
              {topDeals.map((deal) => (
                <li key={deal.id} className="border-b border-[#ebe7dd] pb-2 last:border-none">
                  <div className="font-medium">{deal.title}</div>
                  <div className="text-[11px] text-[#8c8782]">
                    {deal.institution} · {formatCategoryLabel(deal.category)} ·{" "}
                    <span className="tabular">{formatCurrencyCompact(deal.amountUsd)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </Exhibit>
    </ReportPage>
  );
}
