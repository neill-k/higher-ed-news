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
  activeControversies,
  countWithPolicy,
  countWithStateExecutiveOrder,
  countWithStateHigherEdPolicy,
  filterByTier,
  getPeerProfiles,
} from "@/lib/peer-data";
import { getReportDataset, percentOf } from "@/lib/report-data";

export default async function GovernancePage() {
  const [dataset, peers] = await Promise.all([getReportDataset(), getPeerProfiles()]);

  if (!dataset) {
    return (
      <ReportPage title="Risk & Governance" subtitle="Run the pipeline to generate the briefing.">
        <EmptyReportState />
      </ReportPage>
    );
  }

  const secPeers = filterByTier(peers, "sec");
  const anchor = peers.find((peer) => peer.slug === ANCHOR_SLUG);

  const policyCount = countWithPolicy(secPeers);
  const policyRate = percentOf(policyCount, secPeers.length);
  const stateEOCount = countWithStateExecutiveOrder(secPeers);
  const stateHigherEdCount = countWithStateHigherEdPolicy(secPeers);
  const controversies = activeControversies(secPeers);

  // Global dataset: policy/ethics/data-governance/faculty coverage across all 1,104 tracked institutions.
  const { data, institutions } = dataset;
  const totalInstitutions = institutions.length;
  const policyCoverageGlobal = percentOf(
    institutions.filter((institution) => institution.policySignals > 0).length,
    totalInstitutions,
  );
  const ethicsCoverageGlobal = percentOf(
    institutions.filter((institution) => institution.ethicsSignals > 0).length,
    totalInstitutions,
  );
  const dataGovCoverageGlobal = percentOf(
    institutions.filter((institution) => institution.dataGovernanceSignals > 0).length,
    totalInstitutions,
  );
  const facultyCoverageGlobal = percentOf(
    institutions.filter((institution) => institution.facultySignals > 0).length,
    totalInstitutions,
  );

  return (
    <ReportPage
      eyebrow="LSU CIO Briefing"
      title="Risk & governance"
      subtitle="Three layers: Louisiana state policy overlay, SEC peer policy posture, and the sector tensions the data actually supports talking about."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <BAN
          label="SEC peers with a published AI policy"
          value={`${policyRate}%`}
          definition={`${policyCount} of ${secPeers.length}`}
          tone="gold"
          comparator="LSU has Faculty Senate Fall 2025 guidelines but no board-approved university-wide policy."
        />
        <BAN
          label="SEC states with a higher-ed AI policy"
          value={`${stateHigherEdCount}`}
          definition={stateHigherEdCount === 1 ? "1 state" : `${stateHigherEdCount} states`}
          tone="danger"
          comparator="Louisiana Board of Regents adopted the SEC's first statewide postsecondary AI policy on Oct 22, 2025."
        />
        <BAN
          label="SEC states with a governor's AI executive order"
          value={`${stateEOCount}`}
          definition={`${stateEOCount} of ${secPeers.length}`}
          tone="danger"
          comparator="Louisiana EO JML 25-103 (Oct 2025) bans DeepSeek and froze state AI procurement through Dec 15, 2025."
        />
        <BAN
          label="Active SEC-peer AI controversies"
          value={`${controversies.length}`}
          definition={controversies.length === 1 ? "1 active issue" : `${controversies.length} active issues`}
          tone="danger"
          comparator="Litigation and accusation-based disputes at peers tell the CIO which Board-level exposures are imminent."
        />
      </div>

      <Exhibit
        number="G1"
        title="Louisiana's AI governance stack — what binds LSU that peers outside LA don't carry"
        subtitle="Three overlapping authorities. The CIO answers to all three."
        source="Louisiana Board of Regents + Office of the Governor"
        asOf="April 2026"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Panel className="border-[#ebe7dd] bg-[#fdfaf1]">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#8c8782]">Layer 1</div>
            <h3 className="mt-1 text-[15px] font-semibold text-[#2d2926]">
              Governor's Executive Order
            </h3>
            <p className="mt-2 text-[12.5px] leading-[1.6] text-[#5e5954]">
              JML 25-103 (Oct 13, 2025) — bans CCP-linked AI platforms (DeepSeek specifically) from
              state schools, colleges, and agencies. Froze new state AI procurement through Dec 15,
              2025, pending state AI-safety rules.
            </p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              <SourceLink href="https://gov.louisiana.gov/news/4960" label="gov.louisiana.gov" />
              <SourceLink
                href="https://gov.louisiana.gov/assets/ExecutiveOrders/2025/JML-Exective-Order-25-103.pdf"
                label="EO full text"
              />
            </div>
          </Panel>
          <Panel className="border-[#ebe7dd] bg-[#fdfaf1]">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#8c8782]">Layer 2</div>
            <h3 className="mt-1 text-[15px] font-semibold text-[#2d2926]">
              Board of Regents statewide policy
            </h3>
            <p className="mt-2 text-[12.5px] leading-[1.6] text-[#5e5954]">
              Oct 22, 2025 — first SEC-state statewide postsecondary AI policy covering responsible,
              ethical, and secure use. Companion resolution urges public systems (incl. LSU) to
              adopt conforming institutional policies. Regents' standing AI Committee is the direct
              oversight body.
            </p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              <SourceLink href="https://www.laregents.edu/news/102225release/" />
            </div>
          </Panel>
          <Panel className="border-[#ebe7dd] bg-[#fdfaf1]">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#8c8782]">Layer 3</div>
            <h3 className="mt-1 text-[15px] font-semibold text-[#2d2926]">LSU institutional posture</h3>
            <p className="mt-2 text-[12.5px] leading-[1.6] text-[#5e5954]">
              Faculty Senate ad hoc GAI Committee issued Fall 2025 guidelines (course-level
              discretion, required disclosure). No board-approved university-wide student AI
              policy. No Chief AI Officer. Governance distributed across ODSA (Arbuthnot), CIO
              (Woolley), and Faculty Senate.
            </p>
            {anchor && anchor.ai_policy.policy_urls[0] ? (
              <div className="mt-2">
                <SourceLink href={anchor.ai_policy.policy_urls[0]} label="LSU Faculty Senate GAI" />
              </div>
            ) : null}
          </Panel>
        </div>
        <Callout kind="action">
          No SEC peer carries all three state layers. If the Dec 2025 procurement freeze, the
          Regents' statewide policy, and the Faculty Senate guidelines are treated as a single
          compliance surface, LSU has a shorter path to full policy coverage than any peer — but
          has not yet closed it.
        </Callout>
      </Exhibit>

      <Exhibit
        number="G2"
        title="SEC peer policy scorecard"
        subtitle="Published AI policy, dedicated AI role, and state-level overlay for each SEC institution."
        source="Peer research team, primary-source verified"
        n={secPeers.length}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f5f2e9] text-[10px] uppercase tracking-[0.16em] text-[#8c8782]">
              <tr>
                <th className="px-3 py-2.5 font-medium">Institution</th>
                <th className="px-3 py-2.5 font-medium">Published policy</th>
                <th className="px-3 py-2.5 font-medium">Governance body</th>
                <th className="px-3 py-2.5 font-medium">State higher-ed AI policy</th>
                <th className="px-3 py-2.5 font-medium">Governor's AI EO</th>
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
                    <td className="px-3 py-2.5 text-[12.5px] text-[#5e5954]">
                      {peer.ai_policy.has_published_policy ? (
                        <span className="inline-flex rounded-full bg-[#d9ecd8] px-2 py-0.5 text-[11px] font-medium text-[#24513d]">
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-[#f8d8d2] px-2 py-0.5 text-[11px] font-medium text-[#9b3727]">
                          None public
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px] text-[#5e5954]">
                      {peer.governance_structure.committee_name ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px] text-[#5e5954]">
                      {peer.state_ai_policy_context.has_higher_ed_system_ai_policy ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px] text-[#5e5954]">
                      {peer.state_ai_policy_context.has_state_ai_executive_order ? "Yes" : "No"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Exhibit>

      <Exhibit
        number="G3"
        title="Sector tensions — the narratives behind the data"
        subtitle="Each tension was identified from the underlying insight corpus. Showing the full description rather than the label alone."
        source="Pipeline synthesis"
        n={data.tensions.length}
      >
        <div className="space-y-4">
          {data.tensions.map((tension) => (
            <div
              key={tension.label}
              className="rounded-[12px] border border-[#ebe7dd] bg-[#fafaf6] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[14px] font-semibold text-[#2d2926]">{tension.label}</h3>
                <span
                  className={cx(
                    "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                    tension.intensity === "high"
                      ? "bg-[#f8d8d2] text-[#9b3727]"
                      : tension.intensity === "medium"
                        ? "bg-[#f3dec4] text-[#8b5d1f]"
                        : "bg-[#ece7de] text-[#5e5954]",
                  )}
                >
                  {tension.intensity} intensity
                </span>
              </div>
              <p className="mt-2 text-[12.5px] leading-[1.6] text-[#2d2926]">
                {tension.description}
              </p>
              <div className="mt-3 grid gap-3 text-[12px] leading-[1.55] md:grid-cols-2">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[#8c8782]">
                    Side A
                  </div>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[#5e5954]">
                    {tension.sideA.slice(0, 3).map((side) => (
                      <li key={side}>{side}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[#8c8782]">
                    Side B
                  </div>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[#5e5954]">
                    {tension.sideB.slice(0, 3).map((side) => (
                      <li key={side}>{side}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Exhibit>

      <Exhibit
        number="G4"
        title="Active controversies at SEC peers"
        subtitle="Live disputes — academic-integrity litigation, detection-tool false-positive complaints, state-policy pushback."
        source="Peer research team"
        n={controversies.length}
      >
        {controversies.length === 0 ? (
          <p className="text-[13px] text-[#5e5954]">No active controversies identified.</p>
        ) : (
          <ol className="space-y-3">
            {controversies.map((item, index) => (
              <li key={index} className="border-b border-[#ebe7dd] pb-3 last:border-none last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium text-[#2d2926]">{item.institution}</span>
                  {item.date ? (
                    <span className="text-[11px] uppercase tracking-[0.14em] text-[#8c8782]">
                      {item.date}
                    </span>
                  ) : null}
                  <span className="inline-flex rounded-full bg-[#f8d8d2] px-2 py-0.5 text-[11px] font-medium text-[#9b3727]">
                    active
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] leading-[1.55] text-[#5e5954]">{item.summary}</p>
                {item.evidence_url ? (
                  <div className="mt-1">
                    <SourceLink href={item.evidence_url} />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Exhibit>

      <Exhibit
        number="G5"
        title="Global coverage — governance signal density across 1,104 tracked institutions"
        subtitle="These are coverage percentages, not risk levels. Interpret them as 'share of institutions where signals exist,' not as a quantified risk score."
        source="report-data.json"
        n={totalInstitutions}
        caveat="Replaces the earlier composite risk score, which used unvalidated weights and arbitrary bases."
      >
        <div className="grid gap-4 md:grid-cols-4">
          <BAN
            label="Policy signals"
            value={`${policyCoverageGlobal}%`}
            tone="gold"
            definition="institutions with published AI policy or governance signals"
          />
          <BAN
            label="Ethics / oversight signals"
            value={`${ethicsCoverageGlobal}%`}
            tone="gold"
            definition="ethics committees, responsible-AI boards, oversight"
          />
          <BAN
            label="Data governance signals"
            value={`${dataGovCoverageGlobal}%`}
            tone="danger"
            definition="privacy, FERPA, compliance"
          />
          <BAN
            label="Faculty readiness signals"
            value={`${facultyCoverageGlobal}%`}
            tone="neutral"
            definition="teaching enablement, curriculum, pedagogy"
          />
        </div>
      </Exhibit>
    </ReportPage>
  );
}
