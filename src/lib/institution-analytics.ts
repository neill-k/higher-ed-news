import "server-only";

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

const PROFILE_DIR = path.join(process.cwd(), "data", "institutions");
const DIGEST_PATH = path.join(PROFILE_DIR, "_r1-digest.json");
const R1_PATH = path.join(process.cwd(), "data", "r1-institutions.json");

const MATURITY_DIMENSIONS = [
  "strategy_and_leadership",
  "policy_and_governance",
  "teaching_and_curriculum",
  "research_infrastructure",
  "student_services",
  "workforce_and_community",
  "partnerships_and_ecosystem",
  "equity_and_inclusion",
] as const;

type CountMap = Record<string, number>;
type MaturityDimension = (typeof MATURITY_DIMENSIONS)[number];

type Digest = {
  generated_at: string;
  generated_by: string;
  summary: {
    expected_r1_profiles: number;
    profiles_present: number;
    profiles_missing: number;
    validation: {
      checked: number;
      failed: number;
      warnings: number;
      validation_summary_path: string;
    };
    total_initiatives: number;
    total_disclosed_usd: number;
    profiles_with_dedicated_ai_role: number;
    profiles_with_published_strategy: number;
    profiles_with_acceptable_use_policy: number;
    profiles_with_governance_body: number;
    profiles_with_dedicated_ai_compute: number;
    research_confidence: CountMap;
    total_research_sources_listed: number;
  };
  coverage: {
    by_category: CountMap;
    by_subcategory: CountMap;
    by_technology: CountMap;
    by_stakeholder: CountMap;
    by_adoption_stage: CountMap;
    by_investment_scale: CountMap;
    by_collaboration_pattern: CountMap;
    by_policy_stance: CountMap;
    maturity_dimension_profile_counts: CountMap;
    by_strategic_archetype: CountMap;
    by_policy_quality_score: CountMap;
    by_compute_capacity_tier: CountMap;
    by_vendor_parent: CountMap;
    by_vendor_concentration: CountMap;
    by_student_service_type: CountMap;
    by_outcome_claim_type: CountMap;
    by_risk_level: CountMap;
    by_analytics_gap_type: CountMap;
  };
  rankings: {
    top_institutions_by_initiative_count: Array<{
      slug: string;
      institution: string;
      initiative_count: number;
    }>;
    top_institutions_by_disclosed_investment: Array<{
      slug: string;
      institution: string;
      disclosed_usd: number;
    }>;
    top_institutions_by_maturity_breadth: Array<{
      slug: string;
      institution: string;
      breadth: number;
      maturity_dimensions: string[];
    }>;
    top_vendors_and_tools: Array<{ name: string; count: number }>;
    top_collaboration_partners: Array<{ name: string; count: number }>;
    top_source_domains: Array<{ name: string; count: number }>;
    top_vendor_parents: Array<{ name: string; count: number }>;
    top_outcome_claim_institutions: Array<{
      slug: string;
      institution: string;
      outcome_claim_count: number;
    }>;
    top_student_impact_institutions: Array<{
      slug: string;
      institution: string;
      student_facing_tool_count: number;
      student_experience_signal_count: number;
    }>;
    top_research_enterprise_institutions: Array<{
      slug: string;
      institution: string;
      research_center_count: number;
      scientific_discovery_signal_count: number;
      compute_capacity_tier: string;
    }>;
  };
  geography: {
    by_state: CountMap;
    by_system: CountMap;
  };
  exports: {
    directory: string;
    tables: string[];
  };
};

type R1Index = {
  institutions: Array<{ name: string; state: string; system: string | null }>;
};

type Initiative = {
  primary_category?: string;
  secondary_categories?: string[];
  subcategories?: string[];
  adoption_stage?: string;
  maturity_signal?: string;
  technology_focus?: string[];
  stakeholder_impact?: string[];
  investment?: {
    scale?: string | null;
    amount_usd?: number | null;
  } | null;
  collaborations?: Array<{
    pattern?: string | null;
    partners?: string[];
  }>;
  tools_and_vendors?: Array<{
    name?: string | null;
    vendor?: string | null;
  }>;
  source_urls?: string[];
};

type InstitutionProfile = {
  institution: string;
  slug: string;
  city_state?: string;
  system?: string | null;
  control?: string | null;
  institution_type?: string | null;
  enrollment?: number | null;
  leadership?: {
    chief_ai_officer?: {
      name?: string | null;
      url?: string | null;
    };
    ai_strategy_lead?: {
      name?: string | null;
      title?: string | null;
      url?: string | null;
    };
    has_dedicated_ai_role?: boolean;
  };
  ai_strategy?: {
    has_published_strategy?: boolean;
  };
  ai_policy?: {
    has_acceptable_use_policy?: boolean;
    stance?: string | null;
  };
  governance_structure?: {
    has_governance_body?: boolean;
  };
  computing_infrastructure?: {
    has_dedicated_ai_compute?: boolean;
  };
  regulatory_context?: {
    state?: string | null;
  };
  initiatives?: Initiative[];
  research_quality?: {
    sources?: string[];
    gaps_acknowledged?: string[];
    confidence?: string | null;
  };
};

export type RankedMetric = {
  key: string;
  label: string;
  value: number;
  share: number;
};

export type InstitutionAnalyticsRow = {
  slug: string;
  institution: string;
  state: string;
  system: string;
  control: string;
  enrollment: number | null;
  initiativeCount: number;
  disclosedUsd: number;
  maturityDimensionCount: number;
  sourceCount: number;
  gapCount: number;
  researchConfidence: string;
  hasDedicatedAiRole: boolean;
  hasPublishedStrategy: boolean;
  hasAcceptableUsePolicy: boolean;
  hasGovernanceBody: boolean;
  hasDedicatedAiCompute: boolean;
};

export type GeographyRow = {
  key: string;
  label: string;
  profileCount: number;
  initiativeCount: number;
  disclosedUsd: number;
  policyCount: number;
  strategyCount: number;
  highConfidenceCount: number;
};

export type ExportTableMetric = {
  table: string;
  grain: string;
  rows: number;
};

export type InstitutionAnalyticsDataset = {
  generatedAt: string;
  generatedBy: string;
  summary: Digest["summary"];
  coverage: Digest["coverage"];
  rankings: Digest["rankings"];
  exports: Digest["exports"];
  chiefAiOfficerCount: number;
  categoryBars: RankedMetric[];
  technologyBars: RankedMetric[];
  stakeholderBars: RankedMetric[];
  adoptionStageBars: RankedMetric[];
  investmentScaleBars: RankedMetric[];
  policyStanceBars: RankedMetric[];
  maturityBars: RankedMetric[];
  strategicArchetypeBars: RankedMetric[];
  riskLevelBars: RankedMetric[];
  vendorParentBars: RankedMetric[];
  outcomeClaimBars: RankedMetric[];
  analyticsGapBars: RankedMetric[];
  computeTierBars: RankedMetric[];
  studentServiceBars: RankedMetric[];
  institutionRows: InstitutionAnalyticsRow[];
  topInstitutionRows: InstitutionAnalyticsRow[];
  capitalRows: InstitutionAnalyticsRow[];
  stateRows: GeographyRow[];
  systemRows: GeographyRow[];
  exportTables: ExportTableMetric[];
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function total(values: CountMap) {
  return Object.values(values).reduce((sum, value) => sum + value, 0);
}

function toRankedMetrics(values: CountMap, labeler: (key: string) => string, limit = 10) {
  const denominator = Math.max(1, total(values));

  return Object.entries(values)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([key, value]) => ({
      key,
      label: labeler(key),
      value,
      share: Math.round((value / denominator) * 100),
    }));
}

function disclosedUsd(profile: InstitutionProfile) {
  return asArray<Initiative>(profile.initiatives).reduce(
    (sum, initiative) => sum + (Number(initiative.investment?.amount_usd) || 0),
    0,
  );
}

function profileMaturityDimensions(profile: InstitutionProfile) {
  const dims = new Set<MaturityDimension>();

  if (profile.ai_strategy?.has_published_strategy || profile.leadership?.has_dedicated_ai_role) {
    dims.add("strategy_and_leadership");
  }

  if (profile.governance_structure?.has_governance_body || profile.ai_policy?.has_acceptable_use_policy) {
    dims.add("policy_and_governance");
  }

  if (profile.computing_infrastructure?.has_dedicated_ai_compute) {
    dims.add("research_infrastructure");
  }

  for (const initiative of asArray<Initiative>(profile.initiatives)) {
    const categories = [
      initiative.primary_category,
      ...asArray<string>(initiative.secondary_categories),
    ].filter(Boolean);
    const subcategories = asArray<string>(initiative.subcategories);
    const collaborations = asArray<{ pattern?: string | null }>(initiative.collaborations);

    if (categories.includes("teaching_and_learning")) dims.add("teaching_and_curriculum");
    if (
      categories.includes("research_and_innovation") ||
      subcategories.includes("computing_infrastructure")
    ) {
      dims.add("research_infrastructure");
    }
    if (categories.includes("student_experience_and_services")) dims.add("student_services");
    if (categories.includes("workforce_and_economic_development")) dims.add("workforce_and_community");
    if (categories.includes("equity_access_and_inclusion")) dims.add("equity_and_inclusion");
    if (subcategories.includes("institutional_ai_strategy")) dims.add("strategy_and_leadership");
    if (collaborations.some((collaboration) => collaboration.pattern && collaboration.pattern !== "none")) {
      dims.add("partnerships_and_ecosystem");
    }
  }

  return MATURITY_DIMENSIONS.filter((dimension) => dims.has(dimension));
}

async function loadProfiles() {
  const files = await readdir(PROFILE_DIR);

  return Promise.all(
    files
      .filter((file) => file.endsWith(".json") && !file.startsWith("_"))
      .sort()
      .map((file) => readJson<InstitutionProfile>(path.join(PROFILE_DIR, file))),
  );
}

function addGeographyRow(
  rows: Map<string, GeographyRow>,
  key: string,
  profile: InstitutionAnalyticsRow,
) {
  const label = key || "None";
  const row =
    rows.get(label) ??
    ({
      key: label,
      label,
      profileCount: 0,
      initiativeCount: 0,
      disclosedUsd: 0,
      policyCount: 0,
      strategyCount: 0,
      highConfidenceCount: 0,
    } satisfies GeographyRow);

  row.profileCount += 1;
  row.initiativeCount += profile.initiativeCount;
  row.disclosedUsd += profile.disclosedUsd;
  if (profile.hasAcceptableUsePolicy) row.policyCount += 1;
  if (profile.hasPublishedStrategy) row.strategyCount += 1;
  if (profile.researchConfidence === "high") row.highConfidenceCount += 1;
  rows.set(label, row);
}

function countExportRows(profiles: InstitutionProfile[]) {
  const initiativeRows = profiles.flatMap((profile) => asArray<Initiative>(profile.initiatives));
  const categoryRows = initiativeRows.reduce(
    (sum, initiative) => sum + 1 + asArray(initiative.secondary_categories).length,
    0,
  );
  const collaborationRows = initiativeRows.reduce((sum, initiative) => {
    return (
      sum +
      asArray<{ partners?: string[] }>(initiative.collaborations).reduce(
        (innerSum, collaboration) => innerSum + Math.max(1, asArray(collaboration.partners).length),
        0,
      )
    );
  }, 0);

  return {
    institutions: profiles.length,
    initiatives: initiativeRows.length,
    categories: categoryRows,
    subcategories: initiativeRows.reduce(
      (sum, initiative) => sum + asArray(initiative.subcategories).length,
      0,
    ),
    technologies: initiativeRows.reduce(
      (sum, initiative) => sum + asArray(initiative.technology_focus).length,
      0,
    ),
    stakeholders: initiativeRows.reduce(
      (sum, initiative) => sum + asArray(initiative.stakeholder_impact).length,
      0,
    ),
    collaborations: collaborationRows,
    tools: initiativeRows.reduce(
      (sum, initiative) => sum + asArray(initiative.tools_and_vendors).length,
      0,
    ),
    sources: initiativeRows.reduce(
      (sum, initiative) => sum + asArray(initiative.source_urls).length,
      0,
    ),
    gaps: profiles.reduce(
      (sum, profile) => sum + asArray(profile.research_quality?.gaps_acknowledged).length,
      0,
    ),
  };
}

function defaultLabel(key: string) {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const getInstitutionAnalytics = cache(async (): Promise<InstitutionAnalyticsDataset | null> => {
  try {
    const [digest, profiles, r1] = await Promise.all([
      readJson<Digest>(DIGEST_PATH),
      loadProfiles(),
      readJson<R1Index>(R1_PATH),
    ]);
    const canonicalBySlug = new Map(
      r1.institutions.map((institution) => [slugify(institution.name), institution] as const),
    );

    const institutionRows = profiles.map((profile) => {
      const canonical = canonicalBySlug.get(profile.slug);
      const maturityDimensions = profileMaturityDimensions(profile);
      const sources = asArray<string>(profile.research_quality?.sources);
      const gaps = asArray<string>(profile.research_quality?.gaps_acknowledged);

      return {
        slug: profile.slug,
        institution: profile.institution,
        state: canonical?.state ?? profile.regulatory_context?.state ?? "",
        system: canonical?.system ?? profile.system ?? "None",
        control: profile.control ?? "unknown",
        enrollment: typeof profile.enrollment === "number" ? profile.enrollment : null,
        initiativeCount: asArray<Initiative>(profile.initiatives).length,
        disclosedUsd: disclosedUsd(profile),
        maturityDimensionCount: maturityDimensions.length,
        sourceCount: sources.length,
        gapCount: gaps.length,
        researchConfidence: profile.research_quality?.confidence ?? "unknown",
        hasDedicatedAiRole: Boolean(profile.leadership?.has_dedicated_ai_role),
        hasPublishedStrategy: Boolean(profile.ai_strategy?.has_published_strategy),
        hasAcceptableUsePolicy: Boolean(profile.ai_policy?.has_acceptable_use_policy),
        hasGovernanceBody: Boolean(profile.governance_structure?.has_governance_body),
        hasDedicatedAiCompute: Boolean(profile.computing_infrastructure?.has_dedicated_ai_compute),
      } satisfies InstitutionAnalyticsRow;
    });

    const states = new Map<string, GeographyRow>();
    const systems = new Map<string, GeographyRow>();
    for (const row of institutionRows) {
      addGeographyRow(states, row.state || "Unknown", row);
      addGeographyRow(systems, row.system || "None", row);
    }

    const exportCounts = countExportRows(profiles);
    const exportTables: ExportTableMetric[] = [
      { table: "institutions.csv", grain: "one row per R1 institution", rows: exportCounts.institutions },
      { table: "initiatives.csv", grain: "one row per public AI initiative", rows: exportCounts.initiatives },
      { table: "initiative_categories.csv", grain: "primary and secondary category bridge", rows: exportCounts.categories },
      { table: "initiative_subcategories.csv", grain: "subcategory bridge", rows: exportCounts.subcategories },
      { table: "initiative_technologies.csv", grain: "technology focus bridge", rows: exportCounts.technologies },
      { table: "initiative_stakeholders.csv", grain: "stakeholder impact bridge", rows: exportCounts.stakeholders },
      { table: "initiative_collaborations.csv", grain: "partner collaboration bridge", rows: exportCounts.collaborations },
      { table: "initiative_tools.csv", grain: "tools and vendors bridge", rows: exportCounts.tools },
      { table: "initiative_sources.csv", grain: "initiative source URLs", rows: exportCounts.sources },
      { table: "profile_gaps.csv", grain: "acknowledged profile research gaps", rows: exportCounts.gaps },
      { table: "summary.json", grain: "aggregate digest and rankings", rows: 1 },
    ];

    return {
      generatedAt: digest.generated_at,
      generatedBy: digest.generated_by,
      summary: digest.summary,
      coverage: digest.coverage,
      rankings: digest.rankings,
      exports: digest.exports,
      chiefAiOfficerCount: profiles.filter(
        (profile) => Boolean(profile.leadership?.chief_ai_officer?.name?.trim()),
      ).length,
      categoryBars: toRankedMetrics(digest.coverage.by_category, defaultLabel, 8),
      technologyBars: toRankedMetrics(digest.coverage.by_technology, defaultLabel, 8),
      stakeholderBars: toRankedMetrics(digest.coverage.by_stakeholder, defaultLabel, 8),
      adoptionStageBars: toRankedMetrics(digest.coverage.by_adoption_stage, defaultLabel, 5),
      investmentScaleBars: toRankedMetrics(digest.coverage.by_investment_scale, defaultLabel, 5),
      policyStanceBars: toRankedMetrics(digest.coverage.by_policy_stance, defaultLabel, 5),
      maturityBars: toRankedMetrics(digest.coverage.maturity_dimension_profile_counts, defaultLabel, 8),
      strategicArchetypeBars: toRankedMetrics(digest.coverage.by_strategic_archetype, defaultLabel, 8),
      riskLevelBars: toRankedMetrics(digest.coverage.by_risk_level, defaultLabel, 4),
      vendorParentBars: toRankedMetrics(digest.coverage.by_vendor_parent, defaultLabel, 10),
      outcomeClaimBars: toRankedMetrics(digest.coverage.by_outcome_claim_type, defaultLabel, 8),
      analyticsGapBars: toRankedMetrics(digest.coverage.by_analytics_gap_type, defaultLabel, 8),
      computeTierBars: toRankedMetrics(digest.coverage.by_compute_capacity_tier, defaultLabel, 6),
      studentServiceBars: toRankedMetrics(digest.coverage.by_student_service_type, defaultLabel, 6),
      institutionRows: institutionRows.sort(
        (left, right) =>
          right.initiativeCount - left.initiativeCount ||
          right.maturityDimensionCount - left.maturityDimensionCount ||
          left.institution.localeCompare(right.institution),
      ),
      topInstitutionRows: [...institutionRows]
        .sort(
          (left, right) =>
            right.initiativeCount - left.initiativeCount ||
            right.maturityDimensionCount - left.maturityDimensionCount ||
            left.institution.localeCompare(right.institution),
        )
        .slice(0, 25),
      capitalRows: [...institutionRows]
        .filter((row) => row.disclosedUsd > 0)
        .sort(
          (left, right) =>
            right.disclosedUsd - left.disclosedUsd ||
            right.initiativeCount - left.initiativeCount ||
            left.institution.localeCompare(right.institution),
        )
        .slice(0, 20),
      stateRows: Array.from(states.values()).sort(
        (left, right) =>
          right.profileCount - left.profileCount ||
          right.initiativeCount - left.initiativeCount ||
          left.label.localeCompare(right.label),
      ),
      systemRows: Array.from(systems.values())
        .filter((row) => row.label !== "None")
        .sort(
          (left, right) =>
            right.profileCount - left.profileCount ||
            right.initiativeCount - left.initiativeCount ||
            left.label.localeCompare(right.label),
        ),
      exportTables,
    };
  } catch {
    return null;
  }
});
