import type { ReactNode } from "react";

import {
  Callout,
  cx,
  ReportPage,
} from "@/components/report-page";
import {
  getInstitutionAnalytics,
  type GeographyRow,
  type InstitutionAnalyticsRow,
  type RankedMetric,
} from "@/lib/institution-analytics";
import {
  formatCategoryLabel,
  formatCompactNumber,
  formatCurrencyCompact,
} from "@/lib/report-data";

const TECHNOLOGY_LABELS: Record<string, string> = {
  large_language_models: "Large language models",
  generative_ai_multimodal: "Multimodal generative AI",
  predictive_analytics_ml: "Predictive analytics / ML",
  agentic_ai: "Agentic AI",
  ai_search_and_retrieval: "AI search and retrieval",
  computer_vision: "Computer vision",
  nlp_for_assessment: "NLP for assessment",
  robotics_and_physical_ai: "Robotics / physical AI",
  quantum_and_ai: "Quantum and AI",
  general_ai: "General AI",
  unspecified: "Unspecified",
};

const STAKEHOLDER_LABELS: Record<string, string> = {
  students: "Students",
  faculty: "Faculty",
  administrators: "Administrators",
  researchers: "Researchers",
  board_and_trustees: "Boards and trustees",
  accreditors: "Accreditors",
  government_and_regulators: "Government / regulators",
  employers: "Employers",
  community: "Community",
};

const STAGE_LABELS: Record<string, string> = {
  announcement: "Announcement",
  pilot: "Pilot",
  scaling: "Scaling",
  operational: "Operational",
  transformative: "Transformative",
};

const POLICY_LABELS: Record<string, string> = {
  prohibitive: "Prohibitive",
  cautious: "Cautious",
  permissive: "Permissive",
  comprehensive: "Comprehensive",
  not_applicable: "Not applicable",
};

const MATURITY_LABELS: Record<string, string> = {
  strategy_and_leadership: "Strategy and leadership",
  policy_and_governance: "Policy and governance",
  teaching_and_curriculum: "Teaching and curriculum",
  research_infrastructure: "Research infrastructure",
  student_services: "Student services",
  workforce_and_community: "Workforce and community",
  partnerships_and_ecosystem: "Partnerships and ecosystem",
  equity_and_inclusion: "Equity and inclusion",
};

const ARCHETYPE_LABELS: Record<string, string> = {
  platform_first: "Platform-first",
  research_compute_powerhouse: "Research compute powerhouse",
  curriculum_led: "Curriculum-led",
  governance_led: "Governance-led",
  student_success_led: "Student-success led",
  workforce_regional_development: "Workforce / regional development",
  balanced_enterprise: "Balanced enterprise",
  public_signal_thin: "Thin public signal",
};

const GAP_LABELS: Record<string, string> = {
  outcomes_or_usage: "Outcomes or usage",
  platform_usage_or_contracts: "Platform usage / contracts",
  cost_or_funding: "Cost or funding",
  compute_capacity: "Compute capacity",
  assessment_redesign: "Assessment redesign",
  student_subgroup_impact: "Student subgroup impact",
};

const OUTCOME_LABELS: Record<string, string> = {
  usage: "Usage / adoption",
  career: "Career / workforce",
  productivity: "Productivity",
  learning: "Learning",
  student_success: "Student success",
  cost_or_revenue: "Cost or revenue",
  research_output: "Research output",
};

const COMPUTE_LABELS: Record<string, string> = {
  none: "No dedicated AI compute",
  named_system_capacity_unknown: "Named system, capacity unknown",
  dedicated_compute_capacity_unknown: "Dedicated compute, capacity unknown",
  modest_gpu_disclosed: "Modest GPU disclosed",
  gpu_cluster_disclosed: "GPU cluster disclosed",
  advanced_hpc_disclosed: "Advanced HPC disclosed",
};

function formatPercent(part: number, total: number) {
  return `${Math.round((part / Math.max(1, total)) * 100)}%`;
}

function formatLargeCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function generatedMonth(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function labelFor(key: string, fallback: string, labels?: Record<string, string>) {
  return labels?.[key] ?? fallback;
}

function RankedBars({
  rows,
  labels,
  totalForShare,
  valueLabel = "mentions",
  valueFormatter = formatCompactNumber,
}: {
  rows: RankedMetric[];
  labels?: Record<string, string>;
  totalForShare?: number;
  valueLabel?: string;
  valueFormatter?: (value: number) => string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  const denominator = totalForShare ?? rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.key} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[12px] font-semibold text-[#2d2926]">
              {labelFor(row.key, row.label, labels)}
            </span>
            <span className="shrink-0 text-[11px] tabular text-[#8c8782]">
              {valueFormatter(row.value)} {valueLabel} | {formatPercent(row.value, denominator)}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#ebe7dd]">
            <div
              className="h-full rounded-full bg-[#8d6d3a]"
              style={{ width: `${Math.max(3, Math.round((row.value / max) * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Slide({
  number,
  eyebrow,
  title,
  takeaway,
  source = "R1 public-source profile review",
  n,
  children,
  className,
}: {
  number: string;
  eyebrow: string;
  title: string;
  takeaway?: string;
  source?: string;
  n?: string | number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "report-surface report-entrance rounded-[12px] p-6 md:p-8",
        className,
      )}
    >
      <div className="mb-7 grid gap-5 border-b border-[var(--rule-soft)] pb-5 lg:grid-cols-[92px_minmax(0,1fr)]">
        <div className="font-data text-[44px] font-semibold leading-none text-[#d8b4fe]">
          {number}
        </div>
        <div className="space-y-3">
          <div className="font-caption text-[11px] font-semibold uppercase tracking-[0.24em] text-[#ec4899]">
            {eyebrow}
          </div>
          <h2 className="font-display max-w-[980px] text-[34px] font-semibold leading-[0.98] text-white md:text-[48px]">
            {title}
          </h2>
          {takeaway ? (
            <p className="max-w-[920px] text-[15px] leading-[1.65] text-[#d4d4d8]">
              {takeaway}
            </p>
          ) : null}
        </div>
      </div>
      {children}
      <div className="font-caption mt-7 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--rule-soft)] pt-3 text-[11px] leading-[1.5] text-[#71717a]">
        <span>Source: {source}</span>
        {n !== undefined ? <span>n = {n}</span> : null}
        <span>As of April 2026</span>
      </div>
    </section>
  );
}

function NumberStrip({
  items,
}: {
  items: Array<{ label: string; value: string; detail: string; tone?: "light" | "dark" }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={cx(
            "rounded-[10px] border p-4",
            item.tone === "light"
              ? "border-[#ebe7dd] bg-[#fafaf6]"
              : "border-white/10 bg-white/[0.045]",
          )}
        >
          <div
            className={cx(
              "font-caption text-[10px] font-semibold uppercase tracking-[0.18em]",
              item.tone === "light" ? "text-[#8c8782]" : "text-[#a1a1aa]",
            )}
          >
            {item.label}
          </div>
          <div
            className={cx(
              "mt-4 font-data text-[34px] font-semibold leading-none tabular",
              item.tone === "light" ? "text-[#241d18]" : "text-white",
            )}
          >
            {item.value}
          </div>
          <p
            className={cx(
              "mt-3 text-[12px] leading-[1.55]",
              item.tone === "light" ? "text-[#5e5954]" : "text-[#a1a1aa]",
            )}
          >
            {item.detail}
          </p>
        </div>
      ))}
    </div>
  );
}

function StoryGrid({
  items,
}: {
  items: Array<{
    number: string;
    title: string;
    detail: string;
    metric: string;
  }>;
}) {
  return (
    <section className="report-surface report-entrance rounded-[12px] p-6 md:p-8">
      <div className="mb-6 max-w-[980px] space-y-3">
        <div className="font-caption text-[11px] font-semibold uppercase tracking-[0.24em] text-[#ec4899]">
          Storyline
        </div>
        <h2 className="font-display text-[36px] font-semibold leading-none text-white md:text-[52px]">
          The R1 AI market is already operating. The evidence layer is not.
        </h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={item.number} className="rounded-[10px] border border-white/10 bg-white/[0.045] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-data text-[28px] font-semibold text-[#d8b4fe]">
                {item.number}
              </span>
              <span className="font-caption text-[10px] uppercase tracking-[0.18em] text-[#71717a]">
                {item.metric}
              </span>
            </div>
            <h3 className="mt-5 font-display text-[24px] font-semibold leading-[1.05] text-white">
              {item.title}
            </h3>
            <p className="mt-3 text-[12px] leading-[1.6] text-[#a1a1aa]">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusChip({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]",
        active
          ? "border-[#b9955e] bg-[#f3dec4] text-[#7d4f15]"
          : "border-[#e4dfd3] bg-[#f7f4ed] text-[#9a9288]",
      )}
    >
      {label}
    </span>
  );
}

function InstitutionTable({ rows }: { rows: InstitutionAnalyticsRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[900px] text-left text-sm">
        <thead className="bg-[#f5f2e9] text-[10px] uppercase tracking-[0.16em] text-[#8c8782]">
          <tr>
            <th className="px-3 py-2.5 font-medium">Institution</th>
            <th className="px-3 py-2.5 font-medium">State</th>
            <th className="px-3 py-2.5 text-right font-medium">Initiatives</th>
            <th className="px-3 py-2.5 text-right font-medium">Maturity</th>
            <th className="px-3 py-2.5 text-right font-medium">Disclosed capital</th>
            <th className="px-3 py-2.5 text-right font-medium">Evidence</th>
            <th className="px-3 py-2.5 font-medium">Operating posture</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.slug} className="border-t border-[#ebe7dd]">
              <td className="px-3 py-3">
                <div className="max-w-[280px] text-[13px] font-semibold leading-snug text-[#2d2926]">
                  {row.institution}
                </div>
                <div className="mt-1 text-[11px] text-[#8c8782]">
                  {row.control.replaceAll("_", " ")}
                </div>
              </td>
              <td className="px-3 py-3 text-[13px] text-[#5e5954]">{row.state}</td>
              <td className="px-3 py-3 text-right text-[13px] tabular text-[#2d2926]">
                {row.initiativeCount}
              </td>
              <td className="px-3 py-3 text-right text-[13px] tabular text-[#2d2926]">
                {row.maturityDimensionCount}/8
              </td>
              <td className="px-3 py-3 text-right text-[13px] tabular text-[#2d2926]">
                {row.disclosedUsd > 0 ? formatCurrencyCompact(row.disclosedUsd) : "undisclosed"}
              </td>
              <td className="px-3 py-3 text-right text-[13px] tabular text-[#2d2926]">
                {row.sourceCount}
              </td>
              <td className="px-3 py-3">
                <div className="flex min-w-[220px] flex-wrap gap-1.5">
                  <StatusChip active={row.hasAcceptableUsePolicy} label="policy" />
                  <StatusChip active={row.hasPublishedStrategy} label="strategy" />
                  <StatusChip active={row.hasDedicatedAiCompute} label="compute" />
                  <StatusChip active={row.hasDedicatedAiRole} label="role" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GeographyTable({ rows, kind }: { rows: GeographyRow[]; kind: "state" | "system" }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[660px] text-left text-sm">
        <thead className="bg-[#f5f2e9] text-[10px] uppercase tracking-[0.16em] text-[#8c8782]">
          <tr>
            <th className="px-3 py-2.5 font-medium">{kind === "state" ? "State" : "System"}</th>
            <th className="px-3 py-2.5 text-right font-medium">Profiles</th>
            <th className="px-3 py-2.5 text-right font-medium">Initiatives</th>
            <th className="px-3 py-2.5 text-right font-medium">Policy rate</th>
            <th className="px-3 py-2.5 text-right font-medium">Disclosed capital</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-[#ebe7dd]">
              <td className="px-3 py-3 text-[13px] font-semibold text-[#2d2926]">
                {row.label}
              </td>
              <td className="px-3 py-3 text-right text-[13px] tabular text-[#2d2926]">
                {row.profileCount}
              </td>
              <td className="px-3 py-3 text-right text-[13px] tabular text-[#2d2926]">
                {row.initiativeCount}
              </td>
              <td className="px-3 py-3 text-right text-[13px] tabular text-[#2d2926]">
                {formatPercent(row.policyCount, row.profileCount)}
              </td>
              <td className="px-3 py-3 text-right text-[13px] tabular text-[#2d2926]">
                {row.disclosedUsd > 0 ? formatCurrencyCompact(row.disclosedUsd) : "undisclosed"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyAnalyticsState() {
  return (
    <ReportPage
      eyebrow="R1 AI Sector Brief"
      title="R1 AI sector brief"
      subtitle="The R1 evidence base is not ready yet."
    >
      <Callout kind="note">
        This page will appear once the R1 evidence base has been collected.
      </Callout>
    </ReportPage>
  );
}

export default async function R1AnalyticsPortal() {
  const analytics = await getInstitutionAnalytics();

  if (!analytics) {
    return <EmptyAnalyticsState />;
  }

  const { summary } = analytics;
  const profileCount = summary.profiles_present;
  const policyRate = formatPercent(summary.profiles_with_acceptable_use_policy, profileCount);
  const strategyRate = formatPercent(summary.profiles_with_published_strategy, profileCount);
  const categoryRows = analytics.categoryBars.map((row) => ({
    ...row,
    label: formatCategoryLabel(row.key),
  }));
  const sumValues = (values: Record<string, number>) =>
    Object.values(values).reduce((sum, value) => sum + value, 0);
  const technologyMentionTotal = sumValues(analytics.coverage.by_technology);
  const stakeholderMentionTotal = sumValues(analytics.coverage.by_stakeholder);
  const vendorExposureTotal = sumValues(analytics.coverage.by_vendor_parent);
  const outcomeClaimTotal = sumValues(analytics.coverage.by_outcome_claim_type);
  const studentLed = analytics.coverage.by_strategic_archetype.student_success_led ?? 0;
  const assessmentGap = analytics.coverage.by_analytics_gap_type.assessment_redesign ?? 0;
  const platformGap = analytics.coverage.by_analytics_gap_type.platform_usage_or_contracts ?? 0;
  const costGap = analytics.coverage.by_analytics_gap_type.cost_or_funding ?? 0;
  const computeGap = analytics.coverage.by_analytics_gap_type.compute_capacity ?? 0;
  const teachingMentions = analytics.coverage.by_category.teaching_and_learning ?? 0;
  const researchMentions = analytics.coverage.by_category.research_and_innovation ?? 0;
  const studentStakeholders = analytics.coverage.by_stakeholder.students ?? 0;
  const facultyStakeholders = analytics.coverage.by_stakeholder.faculty ?? 0;
  const llmMentions = analytics.coverage.by_technology.large_language_models ?? 0;
  const generalAiMentions = analytics.coverage.by_technology.general_ai ?? 0;
  const agenticMentions = analytics.coverage.by_technology.agentic_ai ?? 0;
  const usageClaims = analytics.coverage.by_outcome_claim_type.usage ?? 0;
  const careerClaims = analytics.coverage.by_outcome_claim_type.career ?? 0;
  const costOutcomeClaims = analytics.coverage.by_outcome_claim_type.cost_or_revenue ?? 0;
  const researchOutputClaims = analytics.coverage.by_outcome_claim_type.research_output ?? 0;
  const unknownInvestment = analytics.coverage.by_investment_scale.unknown ?? 0;
  const advancedHpc = analytics.coverage.by_compute_capacity_tier.advanced_hpc_disclosed ?? 0;
  const gpuCluster = analytics.coverage.by_compute_capacity_tier.gpu_cluster_disclosed ?? 0;
  const namedCapacityUnknown =
    analytics.coverage.by_compute_capacity_tier.named_system_capacity_unknown ?? 0;
  const topVendor = analytics.vendorParentBars[0];
  const secondVendor = analytics.vendorParentBars[1];
  const thirdVendor = analytics.vendorParentBars[2];
  const topInstitution = analytics.topInstitutionRows[0];
  const topCapital = analytics.capitalRows[0];
  const topState = analytics.stateRows[0];
  const capitalStateRows = [...analytics.stateRows]
    .filter((row) => row.disclosedUsd > 0)
    .sort(
      (left, right) =>
        right.disclosedUsd - left.disclosedUsd ||
        right.profileCount - left.profileCount ||
        left.label.localeCompare(right.label),
    );
  const topCapitalState = capitalStateRows[0];
  const operationalStage = analytics.coverage.by_adoption_stage.operational ?? 0;
  const announcementStage = analytics.coverage.by_adoption_stage.announcement ?? 0;
  const namedAiRoleRate = formatPercent(summary.profiles_with_dedicated_ai_role, profileCount);
  const chiefAiOfficerRate = formatPercent(analytics.chiefAiOfficerCount, profileCount);
  const concentratedVendorMentions =
    (topVendor?.value ?? 0) + (secondVendor?.value ?? 0) + (thirdVendor?.value ?? 0);
  const advancedOrGpuCompute = advancedHpc + gpuCluster;
  const financialResearchOutputClaims = costOutcomeClaims + researchOutputClaims;
  const storyItems = [
    {
      number: "01",
      title: "AI is already in the operating model.",
      metric: `${operationalStage} operational`,
      detail: `${announcementStage} initiatives are still announcements. The story has moved from intent to execution.`,
    },
    {
      number: "02",
      title: "The visible stack is general-purpose before it is agentic.",
      metric: `${formatCompactNumber(llmMentions)} LLM mentions`,
      detail: `${agenticMentions} agentic-AI mentions trail far behind model-access signals. Workflow redesign is still less visible than tool access.`,
    },
    {
      number: "03",
      title: "Named vendor exposure is concentrated.",
      metric: `${formatCompactNumber(concentratedVendorMentions)} top-3 mentions`,
      detail: `${topVendor?.label ?? "The top vendor"}, ${secondVendor?.label ?? "the second"}, and ${thirdVendor?.label ?? "the third"} account for nearly half of vendor-parent mentions.`,
    },
    {
      number: "04",
      title: "Compute is the emerging disclosure divide.",
      metric: `${advancedOrGpuCompute} advanced or GPU clusters`,
      detail: `${namedCapacityUnknown} campuses name systems without enough capacity detail. The capacity story is partly visible and partly obscured.`,
    },
    {
      number: "05",
      title: "Policy is nearly universal; chief AI officers are rare.",
      metric: `${policyRate} policy / ${chiefAiOfficerRate} CAIO`,
      detail: "Dedicated AI roles are broader than named executive ownership. That is the management gap.",
    },
    {
      number: "06",
      title: "Students dominate the rhetoric; student-success strategy barely appears.",
      metric: `${formatCompactNumber(studentStakeholders)} student mentions`,
      detail: `Only ${studentLed} campus surfaces as student-success led. Stakeholder language is far ahead of measured impact.`,
    },
    {
      number: "07",
      title: "The sector reports participation before financial or research-output proof.",
      metric: `${financialResearchOutputClaims} financial/research-output claims`,
      detail: `${formatCompactNumber(usageClaims + careerClaims)} usage or workforce claims dwarf cost, revenue, and research-output effects.`,
    },
  ];

  return (
    <ReportPage
      eyebrow="R1 AI Market Deck"
      title="R1 AI has moved from pilots into infrastructure faster than universities can prove, price, or govern it."
      subtitle={`${profileCount} R1 universities, ${formatCompactNumber(summary.total_initiatives)} public AI initiatives, ${formatLargeCurrency(summary.total_disclosed_usd)} in publicly disclosed AI/AI-adjacent capital, and ${formatCompactNumber(summary.total_research_sources_listed)} cited sources. Updated ${generatedMonth(analytics.generatedAt)}.`}
    >
      <StoryGrid items={storyItems} />

      <Slide
        number="01"
        eyebrow="Adoption"
        title="R1 AI has left the announcement layer."
        takeaway={`${operationalStage} initiatives are already operational, compared with ${announcementStage} announcements. The R1 sector has crossed from AI interest into AI operating reality.`}
        n={summary.total_initiatives}
      >
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <NumberStrip
            items={[
              {
                label: "Operational initiatives",
                value: formatCompactNumber(operationalStage),
                detail: "AI is already part of ongoing campus work.",
              },
              {
                label: "Announcements",
                value: formatCompactNumber(announcementStage),
                detail: "The press-release-only phase is a minority pattern.",
              },
              {
                label: "Teaching mentions",
                value: formatCompactNumber(teachingMentions),
                detail: "Instruction is the largest attention category.",
              },
              {
                label: "Research mentions",
                value: formatCompactNumber(researchMentions),
                detail: "Research remains nearly as central as teaching.",
              },
            ]}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[10px] bg-[#fbfaf5] p-5">
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c8782]">
                Adoption Stage
              </div>
              <RankedBars
                rows={analytics.adoptionStageBars}
                labels={STAGE_LABELS}
                totalForShare={summary.total_initiatives}
                valueLabel="initiatives"
              />
            </div>
            <div className="rounded-[10px] bg-[#fbfaf5] p-5">
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c8782]">
                Where Activity Is Concentrated
              </div>
              <RankedBars rows={categoryRows} valueLabel="mentions" />
            </div>
          </div>
        </div>
      </Slide>

      <Slide
        number="02"
        eyebrow="Technology Stack"
        title="The stack is general-purpose before it is agentic."
        takeaway={`${formatCompactNumber(llmMentions)} large-language-model mentions and ${formatCompactNumber(generalAiMentions)} general-AI mentions dwarf ${agenticMentions} agentic-AI mentions. The first wave is model access, not agentic operations.`}
        n={technologyMentionTotal}
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-[10px] bg-[#fbfaf5] p-5">
            <RankedBars rows={analytics.technologyBars} labels={TECHNOLOGY_LABELS} />
          </div>
          <div className="space-y-3">
            <NumberStrip
              items={[
                {
                  label: "Large language models",
                  value: formatCompactNumber(llmMentions),
                  detail: "The dominant technology label.",
                },
                {
                  label: "Agentic AI",
                  value: formatCompactNumber(agenticMentions),
                  detail: "Still small relative to platform adoption.",
                },
              ]}
            />
            <div className="rounded-[10px] border border-white/10 bg-white/[0.045] p-4">
              <h3 className="font-display text-[24px] font-semibold leading-tight text-white">
                Implication
              </h3>
              <p className="mt-3 text-[13px] leading-[1.65] text-[#a1a1aa]">
                The first wave is access to models. The second wave will be workflow redesign.
                The data says the first wave is much more visible than the second.
              </p>
            </div>
          </div>
        </div>
      </Slide>

      <Slide
        number="03"
        eyebrow="Platforms"
        title="Named vendor exposure is concentrated, while contracts are dark."
        takeaway={`${topVendor?.label ?? "The top vendor"} appears ${topVendor?.value ?? 0} times; the top three named vendors total ${formatCompactNumber(concentratedVendorMentions)} mentions, or ${formatPercent(concentratedVendorMentions, vendorExposureTotal)} of vendor-parent exposure. But ${platformGap} campuses still lack platform usage or contract detail.`}
        n={vendorExposureTotal}
      >
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <NumberStrip
            items={[
              {
                label: "Top vendor",
                value: topVendor?.label ?? "n/a",
                detail: `${topVendor?.value ?? 0} mentions.`,
              },
              {
                label: "Second vendor",
                value: secondVendor?.label ?? "n/a",
                detail: `${secondVendor?.value ?? 0} mentions.`,
              },
              {
                label: "Top-three total",
                value: formatCompactNumber(concentratedVendorMentions),
                detail: "Named platform exposure is not evenly distributed.",
              },
              {
                label: "Platform detail gaps",
                value: `${platformGap}`,
                detail: "Most campuses still do not reveal usage or contract terms.",
              },
            ]}
          />
          <div className="rounded-[10px] bg-[#fbfaf5] p-5">
            <RankedBars
              rows={analytics.vendorParentBars.slice(0, 9).map((row) => ({
                key: row.key,
                label: row.label,
                value: row.value,
                share: 0,
              }))}
              valueLabel="mentions"
            />
          </div>
        </div>
      </Slide>

      <Slide
        number="04"
        eyebrow="Compute"
        title="Compute is becoming the visible disclosure divide."
        takeaway={`${advancedOrGpuCompute} campuses disclose advanced HPC or GPU-cluster tiers; ${namedCapacityUnknown} name systems without enough capacity detail. The data proves disclosure tiers, not comparable sector GPU capacity.`}
        n={profileCount}
      >
        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-[10px] bg-[#fbfaf5] p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c8782]">
              Compute Capacity
            </div>
            <RankedBars
              rows={analytics.computeTierBars}
              labels={COMPUTE_LABELS}
              totalForShare={profileCount}
              valueLabel="profiles"
            />
          </div>
          <div className="rounded-[10px] bg-[#fbfaf5] p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c8782]">
              Largest Disclosed Capital Bets
            </div>
            <ol className="space-y-3">
              {analytics.capitalRows.slice(0, 8).map((row, index) => (
                <li
                  key={row.slug}
                  className="flex gap-3 border-b border-[#ebe7dd] pb-3 last:border-none last:pb-0"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f3dec4] text-[11px] font-semibold text-[#7d4f15]">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold leading-snug text-[#2d2926]">
                      {row.institution}
                    </div>
                    <div className="mt-1 text-[12px] text-[#5e5954]">
                      {formatLargeCurrency(row.disclosedUsd)} | {row.initiativeCount} initiatives
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Slide>

      <Slide
        number="05"
        eyebrow="Governance"
        title="Policy is universal; chief AI officers are rare."
        takeaway={`${policyRate} of R1 profiles have acceptable-use policy language, ${namedAiRoleRate} show a dedicated AI role, and only ${chiefAiOfficerRate} name a chief AI officer. Public governance signals exist; executive ownership is much less consistently named.`}
        n={profileCount}
      >
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <NumberStrip
            items={[
              {
                label: "Acceptable-use policy",
                value: policyRate,
                detail: `${summary.profiles_with_acceptable_use_policy} profiles.`,
              },
              {
                label: "Published strategy",
                value: strategyRate,
                detail: `${summary.profiles_with_published_strategy} profiles.`,
              },
              {
                label: "Dedicated AI role flag",
                value: namedAiRoleRate,
                detail: `${summary.profiles_with_dedicated_ai_role} profiles.`,
              },
              {
                label: "Named chief AI officer",
                value: chiefAiOfficerRate,
                detail: `${analytics.chiefAiOfficerCount} profiles.`,
              },
            ]}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[10px] bg-[#fbfaf5] p-5">
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c8782]">
                Policy Stance
              </div>
              <RankedBars
                rows={analytics.policyStanceBars}
                labels={POLICY_LABELS}
                totalForShare={summary.total_initiatives}
                valueLabel="initiatives"
              />
            </div>
            <div className="rounded-[10px] bg-[#fbfaf5] p-5">
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c8782]">
                Strategic Posture
              </div>
              <RankedBars
                rows={analytics.strategicArchetypeBars}
                labels={ARCHETYPE_LABELS}
                totalForShare={profileCount}
                valueLabel="profiles"
              />
            </div>
          </div>
        </div>
      </Slide>

      <Slide
        number="06"
        eyebrow="Students And Faculty"
        title="Students dominate the rhetoric; student-success strategy barely appears."
        takeaway={`Students appear in ${formatCompactNumber(studentStakeholders)} stakeholder tags and faculty in ${formatCompactNumber(facultyStakeholders)}; only ${studentLed} campus surfaces as student-success led. Stakeholder language is ahead of measured impact.`}
        n={stakeholderMentionTotal}
      >
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[10px] bg-[#fbfaf5] p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c8782]">
              Stakeholder Load
            </div>
            <RankedBars rows={analytics.stakeholderBars} labels={STAKEHOLDER_LABELS} />
          </div>
          <div className="rounded-[10px] bg-[#fbfaf5] p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c8782]">
              Maturity Breadth
            </div>
            <RankedBars
              rows={analytics.maturityBars}
              labels={MATURITY_LABELS}
              totalForShare={profileCount}
              valueLabel="profiles"
            />
          </div>
        </div>
      </Slide>

      <Slide
        number="07"
        eyebrow="Outcomes"
        title="Participation claims outnumber financial and research-output proof."
        takeaway={`${formatCompactNumber(usageClaims)} usage/adoption claims and ${formatCompactNumber(careerClaims)} career/workforce claims dominate. Only ${financialResearchOutputClaims} claims point to cost, revenue, or research-output effects.`}
        n={outcomeClaimTotal}
      >
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-[10px] bg-[#fbfaf5] p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c8782]">
              Outcome Claims
            </div>
            <RankedBars rows={analytics.outcomeClaimBars} labels={OUTCOME_LABELS} valueLabel="claims" />
          </div>
          <div className="rounded-[10px] bg-[#fbfaf5] p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c8782]">
              Data That Is Still Missing
            </div>
            <RankedBars
              rows={analytics.analyticsGapBars}
              labels={GAP_LABELS}
              totalForShare={profileCount}
              valueLabel="profiles"
            />
          </div>
        </div>
      </Slide>

      <Slide
        number="08"
        eyebrow="Market Map"
        title="Campus clusters and dollar clusters are different maps."
        takeaway={`${topState?.label ?? "The top state"} leads R1 campus count with ${topState?.profileCount ?? 0} profiles; ${topCapitalState?.label ?? "the top capital state"} leads disclosed capital with ${topCapitalState ? formatLargeCurrency(topCapitalState.disclosedUsd) : "$0"}. R1 density and disclosed capital are related, but not the same geography story.`}
        source="Carnegie R1 index and R1 public-source profile review"
        n={analytics.stateRows.length}
      >
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-[10px] bg-[#fbfaf5] p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c8782]">
              State Rollup
            </div>
            <GeographyTable rows={analytics.stateRows.slice(0, 12)} kind="state" />
          </div>
          <div className="rounded-[10px] bg-[#fbfaf5] p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c8782]">
              Multi-Campus Systems
            </div>
            <GeographyTable rows={analytics.systemRows.slice(0, 10)} kind="system" />
          </div>
        </div>
      </Slide>

      <Slide
        number="09"
        eyebrow="Leaders"
        title="The leading campuses bundle policy, platforms, compute, teaching, and research."
        takeaway={`${topInstitution?.institution ?? "The leading campus"} has ${topInstitution?.initiativeCount ?? 0} initiatives and ${topInstitution?.maturityDimensionCount ?? 0}/8 maturity breadth. Scale matters most when activity spans governance, compute, teaching, research, and support.`}
        n={analytics.topInstitutionRows.length}
      >
        <div className="rounded-[10px] bg-[#fbfaf5] p-5">
          <InstitutionTable rows={analytics.topInstitutionRows.slice(0, 18)} />
        </div>
      </Slide>

      <Slide
        number="10"
        eyebrow="Investment And Unknowns"
        title="The dollar story is a public floor, not unit economics."
        takeaway={`${unknownInvestment} initiatives have unknown investment scale, the second-largest scale bucket after moderate. Disclosed AI/AI-adjacent capital is useful for spotting big bets, not for estimating total AI operating cost.`}
        n={summary.total_initiatives}
      >
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-[10px] bg-[#fbfaf5] p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c8782]">
              Investment Scale
            </div>
            <RankedBars
              rows={analytics.investmentScaleBars}
              totalForShare={summary.total_initiatives}
              valueLabel="initiatives"
            />
          </div>
          <div className="grid gap-3">
            <NumberStrip
              items={[
                {
                  label: "Public AI/AI-adjacent capital",
                  value: formatLargeCurrency(summary.total_disclosed_usd),
                  detail: "A public floor, not a total cost estimate.",
                },
                {
                  label: "Unknown investment scale",
                  value: `${unknownInvestment}`,
                  detail: "The second-largest investment-scale bucket.",
                },
                {
                  label: "Cost or funding gaps",
                  value: `${costGap}`,
                  detail: "Missing data blocks ROI comparisons.",
                },
                {
                  label: "Top disclosed bet",
                  value: topCapital ? formatLargeCurrency(topCapital.disclosedUsd) : "$0",
                  detail: topCapital?.institution ?? "No disclosed capital leader found.",
                },
              ]}
            />
          </div>
        </div>
      </Slide>

      <Slide
        number="11"
        eyebrow="What To Watch"
        title="The next R1 AI story is not more adoption. It is proof."
        takeaway={`${platformGap} platform/contract gaps, ${costGap} cost/funding gaps, ${computeGap} compute-capacity gaps, and ${assessmentGap} assessment-redesign gaps define the next research agenda.`}
        n={profileCount}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: "Platform Terms",
              detail: "Who is using which tools, at what scale, under what renewal and data terms?",
            },
            {
              title: "Cost Model",
              detail: "What is the full cost of licenses, staffing, security, training, and compute operations?",
            },
            {
              title: "Assessment Change",
              detail: "Which campuses are redesigning grading, credential evidence, and academic-integrity practice?",
            },
            {
              title: "Measured Impact",
              detail: "Where does AI change learning, research output, student support, or productivity enough to measure?",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-[10px] border border-white/10 bg-white/[0.045] p-4">
              <h3 className="font-display text-[24px] font-semibold leading-tight text-white">
                {item.title}
              </h3>
              <p className="mt-3 text-[13px] leading-[1.65] text-[#a1a1aa]">{item.detail}</p>
            </div>
          ))}
        </div>
      </Slide>
    </ReportPage>
  );
}
