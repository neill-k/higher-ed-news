import {
  cx,
  Exhibit,
  Panel,
  PeerChip,
  ReportPage,
  SourceLink,
} from "@/components/report-page";
import {
  ANCHOR_SLUG,
  classifyVendor,
  getPeerProfiles,
  type PeerProfile,
} from "@/lib/peer-data";

function PeerCard({ peer }: { peer: PeerProfile }) {
  const isAnchor = peer.slug === ANCHOR_SLUG;
  const tiers = [
    peer.lsu_peer_tiers.sec && "SEC",
    peer.lsu_peer_tiers.sreb_4yr_1 && "SREB 4-Yr 1",
    peer.lsu_peer_tiers.carnegie_land_grant && "Carnegie Land-Grant",
    peer.aau_member && "AAU",
  ].filter(Boolean) as string[];

  return (
    <Panel
      className={cx(
        "flex flex-col gap-4",
        isAnchor ? "border-[#7d6b3d] bg-[#fdfaf1]" : "",
      )}
    >
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[17px] font-semibold text-[#2d2926]">{peer.institution}</h3>
          {isAnchor ? <PeerChip name="Anchor: LSU" highlighted /> : null}
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] text-[#8c8782]">
          <span>{peer.city_state}</span>
          <span>·</span>
          <span>{peer.carnegie}</span>
          {peer.enrollment ? (
            <>
              <span>·</span>
              <span className="tabular">{peer.enrollment.toLocaleString()} enrolled</span>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tiers.map((tier) => (
            <PeerChip key={tier} name={tier} />
          ))}
        </div>
      </header>

      <div className="space-y-3 text-[12.5px] leading-[1.6] text-[#2d2926]">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#8c8782]">
            CIO / AI leadership
          </div>
          <div>
            {peer.system_leadership.cio_name ? `CIO: ${peer.system_leadership.cio_name}` : "CIO: not identified"}
            {peer.system_leadership.chief_ai_officer
              ? ` · Chief AI Officer: ${peer.system_leadership.chief_ai_officer}`
              : peer.system_leadership.has_dedicated_ai_role
                ? " · Dedicated AI role (distributed)"
                : " · No dedicated AI role"}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#8c8782]">AI policy</div>
          <p>{peer.ai_policy.summary}</p>
          {peer.ai_policy.policy_urls.length ? (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {peer.ai_policy.policy_urls.slice(0, 3).map((url) => (
                <SourceLink key={url} href={url} />
              ))}
            </div>
          ) : null}
        </div>

        {peer.vendor_deployments.length ? (
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#8c8782]">
              Vendor deployments
            </div>
            <ul className="mt-1 space-y-1">
              {peer.vendor_deployments.slice(0, 4).map((deployment) => {
                const classification = classifyVendor(
                  deployment.vendor,
                  deployment.product,
                  deployment.notes,
                );
                return (
                  <li key={`${deployment.vendor}-${deployment.product}`}>
                    <span className="font-medium text-[#2d2926]">{deployment.product}</span>
                    <span className="text-[#5e5954]">
                      {" "}
                      — {classification.label} · {deployment.scope}
                      {deployment.user_count
                        ? ` · ${deployment.user_count.toLocaleString()} users`
                        : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {peer.ai_academic_programs.length ? (
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#8c8782]">
              AI academic programs
            </div>
            <ul className="mt-1 space-y-0.5">
              {peer.ai_academic_programs.slice(0, 4).map((program) => (
                <li key={program.name}>
                  <span className="font-medium text-[#2d2926]">{program.name}</span>
                  <span className="text-[#5e5954]">
                    {" "}
                    · {program.program_type} ({program.level})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {peer.litigation_or_controversy.length ? (
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#8c8782]">
              Active issues
            </div>
            <ul className="mt-1 space-y-1">
              {peer.litigation_or_controversy.map((item, index) => (
                <li key={index} className="flex gap-2">
                  <span
                    className={cx(
                      "inline-flex h-4 shrink-0 items-center rounded-full px-1.5 text-[10px] font-medium uppercase",
                      item.status === "active"
                        ? "bg-[#f8d8d2] text-[#9b3727]"
                        : "bg-[#ece7de] text-[#5e5954]",
                    )}
                  >
                    {item.status}
                  </span>
                  <span className="flex-1 text-[#5e5954]">{item.summary}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#8c8782]">
            State policy
          </div>
          <p>{peer.state_ai_policy_context.summary}</p>
        </div>
      </div>
    </Panel>
  );
}

export default async function PeersPage() {
  const peers = await getPeerProfiles();
  const anchor = peers.find((peer) => peer.slug === ANCHOR_SLUG);
  const others = peers.filter((peer) => peer.slug !== ANCHOR_SLUG);

  return (
    <ReportPage
      eyebrow="SEC Peer Research"
      title="Peer profiles"
      subtitle="Primary-source AI posture for all 16 SEC institutions. Each card was researched and verified against the school&rsquo;s own disclosures; evidence URLs are attached to every substantive claim."
    >
      <Exhibit
        number="P"
        title="Methodology in a sentence"
        subtitle="Each profile was researched from the institution&rsquo;s own website, state government sources, and specialist higher-ed reporting (EDUCAUSE, Chronicle, Inside Higher Ed). Every non-trivial claim has a primary source URL. Fields left null are explicit gaps, not errors — see confidence notes on each peer&rsquo;s source list."
        source="LSU Peer Research Team"
        n={peers.length}
        asOf="April 2026"
        caveat="Vendor deployment user counts are often undisclosed by contract. Policy dates inferred from publication context where exact dates are not published."
      >
        <div className="text-[13px] leading-[1.6] text-[#2d2926]">
          Sort order: LSU pinned first, then alphabetical. Tier badges indicate LSU&rsquo;s own peer
          groupings as maintained by the Office of Budget & Planning.
        </div>
      </Exhibit>

      {anchor ? (
        <div className="grid gap-5">
          <PeerCard peer={anchor} />
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        {others.map((peer) => (
          <PeerCard key={peer.slug} peer={peer} />
        ))}
      </div>
    </ReportPage>
  );
}
