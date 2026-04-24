/**
 * Build flat analytics exports from collected institution AI profiles.
 *
 * The source profiles stay rich and nested. This script creates tabular
 * outputs for spreadsheet, BI, DuckDB, Python, and R workflows.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  MATURITY_DIMENSIONS,
  TREND_CATEGORIES,
  TREND_SUBCATEGORIES,
  type MaturityDimension,
} from "../research/insight-schema";
import {
  computeAnalyticsSignals,
  normalizeState,
} from "./institution-analytics-enrichment";

const PROFILE_DIR = join(__dirname, "..", "data", "institutions");
const R1_PATH = join(__dirname, "..", "data", "r1-institutions.json");
const OUT_DIR = join(__dirname, "..", "output", "analytics");

const TECHNOLOGY_FOCUS_VALUES = [
  "large_language_models",
  "generative_ai_multimodal",
  "predictive_analytics_ml",
  "agentic_ai",
  "ai_search_and_retrieval",
  "computer_vision",
  "nlp_for_assessment",
  "robotics_and_physical_ai",
  "quantum_and_ai",
  "general_ai",
  "unspecified",
] as const;

const STAKEHOLDER_VALUES = [
  "students",
  "faculty",
  "administrators",
  "researchers",
  "board_and_trustees",
  "accreditors",
  "government_and_regulators",
  "employers",
  "community",
] as const;

const ADOPTION_STAGES = ["announcement", "pilot", "scaling", "operational", "transformative"] as const;
const INVESTMENT_SCALES = ["major", "significant", "moderate", "exploratory", "unknown"] as const;
const COLLABORATION_PATTERNS = [
  "industry_academic",
  "cross_institution",
  "international",
  "government_academic",
  "community_academic",
  "startup_academic",
  "none",
] as const;
const POLICY_STANCES = ["prohibitive", "cautious", "permissive", "comprehensive", "not_applicable"] as const;

type CsvValue = string | number | boolean | null | undefined;
type CsvRow = Record<string, CsvValue>;
type InstitutionProfile = Record<string, any>;
type Initiative = Record<string, any>;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function inc(target: Record<string, number>, key: string | null | undefined, by = 1): void {
  if (!key) return;
  target[key] = (target[key] ?? 0) + by;
}

function seeded(keys: readonly string[]): Record<string, number> {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function topEntries(values: Record<string, number>, limit: number): Array<{ name: string; count: number }> {
  return Object.entries(values)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function sourceHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function csvEscape(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function writeCsv(filename: string, rows: CsvRow[]): void {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  writeFileSync(join(OUT_DIR, filename), `${lines.join("\n")}\n`);
}

function totalDisclosedUsd(profile: InstitutionProfile): number {
  return asArray<Initiative>(profile.initiatives).reduce(
    (sum, initiative) => sum + (Number(initiative.investment?.amount_usd) || 0),
    0,
  );
}

function profileMaturityDimensions(profile: InstitutionProfile): MaturityDimension[] {
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
    const categories = [initiative.primary_category, ...asArray<string>(initiative.secondary_categories)];
    const subcategories = asArray<string>(initiative.subcategories);
    const collaborations = asArray<Record<string, any>>(initiative.collaborations);
    if (categories.includes("teaching_and_learning")) dims.add("teaching_and_curriculum");
    if (categories.includes("research_and_innovation") || subcategories.includes("computing_infrastructure")) {
      dims.add("research_infrastructure");
    }
    if (categories.includes("student_experience_and_services")) dims.add("student_services");
    if (categories.includes("workforce_and_economic_development")) dims.add("workforce_and_community");
    if (collaborations.some((collaboration) => collaboration.pattern && collaboration.pattern !== "none")) {
      dims.add("partnerships_and_ecosystem");
    }
    if (categories.includes("equity_access_and_inclusion")) dims.add("equity_and_inclusion");
    if (subcategories.includes("institutional_ai_strategy")) dims.add("strategy_and_leadership");
  }

  return MATURITY_DIMENSIONS.filter((dim) => dims.has(dim));
}

function initiativeId(profile: InstitutionProfile, index: number): string {
  return `${profile.slug}__${String(index + 1).padStart(3, "0")}`;
}

function loadProfiles(): InstitutionProfile[] {
  return readdirSync(PROFILE_DIR)
    .filter((file) => file.endsWith(".json") && !file.startsWith("_"))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(PROFILE_DIR, file), "utf-8")));
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  const profiles = loadProfiles();
  const r1 = JSON.parse(readFileSync(R1_PATH, "utf-8")).institutions as Array<{
    name: string;
    state: string;
    system: string | null;
  }>;
  const r1BySlug = new Map(r1.map((institution) => [slugify(institution.name), institution]));

  const institutions: CsvRow[] = [];
  const initiatives: CsvRow[] = [];
  const categories: CsvRow[] = [];
  const subcategories: CsvRow[] = [];
  const technologies: CsvRow[] = [];
  const stakeholders: CsvRow[] = [];
  const collaborations: CsvRow[] = [];
  const tools: CsvRow[] = [];
  const sources: CsvRow[] = [];
  const gaps: CsvRow[] = [];
  const analyticsSignals: CsvRow[] = [];
  const vendorExposure: CsvRow[] = [];
  const outcomeClaims: CsvRow[] = [];
  const analyticsGaps: CsvRow[] = [];

  const byCategory = seeded(TREND_CATEGORIES);
  const bySubcategory = seeded((Object.values(TREND_SUBCATEGORIES) as readonly (readonly string[])[]).flat());
  const byTechnology = seeded(TECHNOLOGY_FOCUS_VALUES);
  const byStakeholder = seeded(STAKEHOLDER_VALUES);
  const byAdoptionStage = seeded(ADOPTION_STAGES);
  const byInvestmentScale = seeded(INVESTMENT_SCALES);
  const byCollaborationPattern = seeded(COLLABORATION_PATTERNS);
  const byPolicyStance = seeded(POLICY_STANCES);
  const maturityDimensionProfileCounts = seeded(MATURITY_DIMENSIONS);
  const byState: Record<string, number> = {};
  const bySystem: Record<string, number> = {};
  const topVendors: Record<string, number> = {};
  const topPartners: Record<string, number> = {};
  const sourceDomains: Record<string, number> = {};
  const confidence: Record<string, number> = {};
  const byStrategicArchetype: Record<string, number> = {};
  const byRiskLevel: Record<string, number> = {};
  const byVendorParent: Record<string, number> = {};
  const byVendorConcentration: Record<string, number> = {};
  const byStudentServiceType: Record<string, number> = {};
  const byOutcomeClaimType: Record<string, number> = {};
  const byAnalyticsGapType: Record<string, number> = {};
  const byComputeCapacityTier: Record<string, number> = {};
  const byPolicyQualityScore: Record<string, number> = {};

  let totalInitiatives = 0;
  let totalSources = 0;
  let profilesWithDedicatedAiRole = 0;
  let profilesWithPublishedStrategy = 0;
  let profilesWithAcceptableUsePolicy = 0;
  let profilesWithGovernanceBody = 0;
  let profilesWithDedicatedCompute = 0;

  for (const profile of profiles) {
    const canonical = r1BySlug.get(profile.slug);
    const state = normalizeState(canonical?.state || profile.regulatory_context?.state || "");
    const system = profile.system || canonical?.system || "";
    const profileInitiatives = asArray<Initiative>(profile.initiatives);
    const maturityDimensions = profileMaturityDimensions(profile);
    const profileSources = asArray<string>(profile.research_quality?.sources);
    const profileGaps = asArray<string>(profile.research_quality?.gaps_acknowledged);
    const analytics = profile.analytics_signals ?? computeAnalyticsSignals(profile);
    const archetype = analytics.strategic_archetype?.primary ?? "unknown";
    const riskLevel = analytics.risk_readiness?.risk_level ?? "unknown";
    const policyQualityScore = analytics.policy_quality?.score_0_5;

    totalInitiatives += profileInitiatives.length;
    totalSources += profileSources.length;
    inc(byState, state || "unknown");
    inc(bySystem, system || "none");
    inc(confidence, profile.research_quality?.confidence || "unknown");
    inc(byStrategicArchetype, archetype);
    inc(byRiskLevel, riskLevel);
    inc(byVendorConcentration, analytics.vendor_exposure?.concentration || "unknown");
    inc(byComputeCapacityTier, analytics.research_enterprise?.compute?.capacity_tier || "unknown");
    inc(byPolicyQualityScore, policyQualityScore === undefined ? "unknown" : String(policyQualityScore));
    if (profile.leadership?.has_dedicated_ai_role) profilesWithDedicatedAiRole++;
    if (profile.ai_strategy?.has_published_strategy) profilesWithPublishedStrategy++;
    if (profile.ai_policy?.has_acceptable_use_policy) profilesWithAcceptableUsePolicy++;
    if (profile.governance_structure?.has_governance_body) profilesWithGovernanceBody++;
    if (profile.computing_infrastructure?.has_dedicated_ai_compute) profilesWithDedicatedCompute++;
    for (const dim of maturityDimensions) inc(maturityDimensionProfileCounts, dim);
    for (const source of profileSources) inc(sourceDomains, sourceHost(source));

    institutions.push({
      slug: profile.slug,
      institution: profile.institution,
      city_state: profile.city_state,
      state,
      system,
      control: profile.control,
      institution_type: profile.institution_type,
      enrollment: profile.enrollment,
      initiative_count: profileInitiatives.length,
      disclosed_usd: totalDisclosedUsd(profile),
      has_dedicated_ai_role: Boolean(profile.leadership?.has_dedicated_ai_role),
      has_published_strategy: Boolean(profile.ai_strategy?.has_published_strategy),
      has_acceptable_use_policy: Boolean(profile.ai_policy?.has_acceptable_use_policy),
      ai_policy_stance: profile.ai_policy?.stance,
      has_governance_body: Boolean(profile.governance_structure?.has_governance_body),
      has_dedicated_ai_compute: Boolean(profile.computing_infrastructure?.has_dedicated_ai_compute),
      research_confidence: profile.research_quality?.confidence,
      source_count: profileSources.length,
      gap_count: profileGaps.length,
      maturity_dimension_count: maturityDimensions.length,
      maturity_dimensions: maturityDimensions.join("|"),
      strategic_archetype: archetype,
      secondary_archetypes: asArray<string>(analytics.strategic_archetype?.secondary).join("|"),
      policy_quality_score_0_5: policyQualityScore,
      classroom_authority_model: analytics.policy_quality?.classroom_authority_model,
      ai_detection_stance: analytics.policy_quality?.ai_detection_stance,
      assessment_redesign_signal: Boolean(analytics.academic_reality?.has_assessment_redesign),
      faculty_development_signal: Boolean(analytics.academic_reality?.has_faculty_development),
      ai_literacy_signal: Boolean(analytics.academic_reality?.has_ai_literacy_requirement),
      ai_program_count: analytics.academic_reality?.ai_program_count,
      research_center_count: analytics.research_enterprise?.research_center_count,
      compute_capacity_tier: analytics.research_enterprise?.compute?.capacity_tier,
      gpu_count: analytics.research_enterprise?.compute?.gpu_count,
      partnership_count: analytics.research_enterprise?.partnership_count,
      student_facing_tool_count: analytics.student_impact?.student_facing_tool_count,
      student_experience_signal_count: analytics.student_impact?.student_experience_signal_count,
      student_outcome_claim_count: analytics.student_impact?.public_student_outcome_claim_count,
      top_vendor_parent: analytics.vendor_exposure?.top_vendor,
      vendor_concentration: analytics.vendor_exposure?.concentration,
      outcome_claim_count: analytics.value_and_outcomes?.public_claim_count,
      has_usage_metrics: Boolean(analytics.value_and_outcomes?.has_usage_metrics),
      has_cost_or_productivity_claim: Boolean(analytics.value_and_outcomes?.has_cost_or_productivity_claim),
      has_learning_outcome_claim: Boolean(analytics.value_and_outcomes?.has_learning_outcome_claim),
      has_student_success_outcome_claim: Boolean(analytics.value_and_outcomes?.has_student_success_outcome_claim),
      has_research_output_claim: Boolean(analytics.value_and_outcomes?.has_research_output_claim),
      risk_level: riskLevel,
      risk_signal_count: analytics.risk_readiness?.risk_signal_count,
      control_signal_count: analytics.risk_readiness?.control_signal_count,
      analytics_gap_count: asArray<string>(analytics.data_gaps?.gap_types).length,
    });

    profileGaps.forEach((gap, index) => {
      gaps.push({ slug: profile.slug, institution: profile.institution, gap_index: index + 1, gap });
    });

    analyticsSignals.push({
      slug: profile.slug,
      institution: profile.institution,
      state,
      system,
      strategic_archetype: archetype,
      secondary_archetypes: asArray<string>(analytics.strategic_archetype?.secondary).join("|"),
      archetype_rationale: analytics.strategic_archetype?.rationale,
      policy_quality_score_0_5: policyQualityScore,
      classroom_authority_model: analytics.policy_quality?.classroom_authority_model,
      ai_detection_stance: analytics.policy_quality?.ai_detection_stance,
      teaching_learning_signal_count: analytics.academic_reality?.teaching_learning_signal_count,
      ai_program_count: analytics.academic_reality?.ai_program_count,
      assessment_redesign_signal: Boolean(analytics.academic_reality?.has_assessment_redesign),
      faculty_development_signal: Boolean(analytics.academic_reality?.has_faculty_development),
      research_center_count: analytics.research_enterprise?.research_center_count,
      scientific_discovery_signal_count: analytics.research_enterprise?.scientific_discovery_signal_count,
      compute_capacity_tier: analytics.research_enterprise?.compute?.capacity_tier,
      disclosed_funding_usd: analytics.research_enterprise?.disclosed_funding_usd,
      student_facing_tool_count: analytics.student_impact?.student_facing_tool_count,
      student_experience_signal_count: analytics.student_impact?.student_experience_signal_count,
      top_vendor_parent: analytics.vendor_exposure?.top_vendor,
      vendor_concentration: analytics.vendor_exposure?.concentration,
      outcome_claim_count: analytics.value_and_outcomes?.public_claim_count,
      risk_level: riskLevel,
      risk_rationale: analytics.risk_readiness?.rationale,
      analytics_gap_types: asArray<string>(analytics.data_gaps?.gap_types).join("|"),
    });

    for (const vendor of asArray<Record<string, any>>(analytics.vendor_exposure?.parent_vendors)) {
      inc(byVendorParent, vendor.vendor, Number(vendor.mentions) || 1);
      vendorExposure.push({
        slug: profile.slug,
        institution: profile.institution,
        vendor_parent: vendor.vendor,
        mentions: vendor.mentions,
        products: asArray<string>(vendor.products).join("|"),
        concentration: analytics.vendor_exposure?.concentration,
        is_top_vendor: vendor.vendor === analytics.vendor_exposure?.top_vendor,
      });
    }

    for (const [type, count] of Object.entries(analytics.student_impact?.service_type_counts ?? {})) {
      inc(byStudentServiceType, type, Number(count));
    }

    for (const claim of asArray<Record<string, any>>(analytics.value_and_outcomes?.public_claims)) {
      inc(byOutcomeClaimType, claim.claim_type);
      outcomeClaims.push({
        slug: profile.slug,
        institution: profile.institution,
        claim_type: claim.claim_type,
        title: claim.title,
        summary: claim.summary,
        source_url: claim.source_url,
      });
    }

    for (const gapType of asArray<string>(analytics.data_gaps?.gap_types)) {
      inc(byAnalyticsGapType, gapType);
      analyticsGaps.push({
        slug: profile.slug,
        institution: profile.institution,
        gap_type: gapType,
        explicit_gap_count: analytics.data_gaps?.explicit_gap_count,
      });
    }

    profileInitiatives.forEach((initiative, index) => {
      const id = initiativeId(profile, index);
      const sourceUrls = asArray<string>(initiative.source_urls);
      initiatives.push({
        initiative_id: id,
        slug: profile.slug,
        institution: profile.institution,
        state,
        system,
        title: initiative.title,
        description: initiative.description,
        significance: initiative.significance,
        date_announced: initiative.date_announced,
        primary_category: initiative.primary_category,
        maturity_signal: initiative.maturity_signal,
        adoption_stage: initiative.adoption_stage,
        investment_scale: initiative.investment?.scale,
        amount_usd: initiative.investment?.amount_usd,
        funding_source: initiative.investment?.funding_source,
        policy_stance: initiative.policy_stance,
        policy_implications: initiative.policy_implications,
        source_count: sourceUrls.length,
      });

      inc(byCategory, initiative.primary_category);
      categories.push({ initiative_id: id, slug: profile.slug, category: initiative.primary_category, category_role: "primary" });
      for (const category of asArray<string>(initiative.secondary_categories)) {
        inc(byCategory, category);
        categories.push({ initiative_id: id, slug: profile.slug, category, category_role: "secondary" });
      }
      for (const subcategory of asArray<string>(initiative.subcategories)) {
        inc(bySubcategory, subcategory);
        subcategories.push({ initiative_id: id, slug: profile.slug, subcategory });
      }
      for (const technology of asArray<string>(initiative.technology_focus)) {
        inc(byTechnology, technology);
        technologies.push({ initiative_id: id, slug: profile.slug, technology });
      }
      for (const stakeholder of asArray<string>(initiative.stakeholder_impact)) {
        inc(byStakeholder, stakeholder);
        stakeholders.push({ initiative_id: id, slug: profile.slug, stakeholder });
      }
      inc(byAdoptionStage, initiative.adoption_stage);
      inc(byInvestmentScale, initiative.investment?.scale);
      inc(byPolicyStance, initiative.policy_stance);

      const initiativeCollaborations = asArray<Record<string, any>>(initiative.collaborations);
      if (initiativeCollaborations.length === 0) inc(byCollaborationPattern, "none");
      for (const collaboration of initiativeCollaborations) {
        inc(byCollaborationPattern, collaboration.pattern || "none");
        const partners = asArray<string>(collaboration.partners);
        if (partners.length === 0) {
          collaborations.push({
            initiative_id: id,
            slug: profile.slug,
            pattern: collaboration.pattern || "none",
            partner: "",
            description: collaboration.description,
          });
        }
        for (const partner of partners) {
          inc(topPartners, partner);
          collaborations.push({
            initiative_id: id,
            slug: profile.slug,
            pattern: collaboration.pattern || "none",
            partner,
            description: collaboration.description,
          });
        }
      }

      for (const tool of asArray<Record<string, any>>(initiative.tools_and_vendors)) {
        const toolKey = tool.vendor ? `${tool.name} (${tool.vendor})` : tool.name;
        inc(topVendors, toolKey);
        tools.push({
          initiative_id: id,
          slug: profile.slug,
          name: tool.name,
          vendor: tool.vendor,
          role: tool.role,
        });
      }

      sourceUrls.forEach((url, sourceIndex) => {
        sources.push({
          initiative_id: id,
          slug: profile.slug,
          source_index: sourceIndex + 1,
          url,
          domain: sourceHost(url),
        });
      });
    });
  }

  writeCsv("institutions.csv", institutions);
  writeCsv("initiatives.csv", initiatives);
  writeCsv("initiative_categories.csv", categories);
  writeCsv("initiative_subcategories.csv", subcategories);
  writeCsv("initiative_technologies.csv", technologies);
  writeCsv("initiative_stakeholders.csv", stakeholders);
  writeCsv("initiative_collaborations.csv", collaborations);
  writeCsv("initiative_tools.csv", tools);
  writeCsv("initiative_sources.csv", sources);
  writeCsv("profile_gaps.csv", gaps);
  writeCsv("institution_analytics_signals.csv", analyticsSignals);
  writeCsv("institution_vendor_exposure.csv", vendorExposure);
  writeCsv("institution_outcome_claims.csv", outcomeClaims);
  writeCsv("institution_analytics_gaps.csv", analyticsGaps);

  const validationPath = join(PROFILE_DIR, "_validation-summary.json");
  const validation = JSON.parse(readFileSync(validationPath, "utf-8"));
  const summary = {
    generated_at: new Date().toISOString(),
    generated_by: "scripts/institution-analytics.ts",
    expected_r1_profiles: r1.length,
    profiles_present: profiles.length,
    profiles_missing: r1.length - profiles.length,
    validation: {
      checked: validation.checked,
      failed: validation.failed,
      warnings: validation.warnings,
      validation_summary_path: "data/institutions/_validation-summary.json",
    },
    total_initiatives: totalInitiatives,
    total_disclosed_usd: institutions.reduce((sum, row) => sum + Number(row.disclosed_usd || 0), 0),
    profiles_with_dedicated_ai_role: profilesWithDedicatedAiRole,
    profiles_with_published_strategy: profilesWithPublishedStrategy,
    profiles_with_acceptable_use_policy: profilesWithAcceptableUsePolicy,
    profiles_with_governance_body: profilesWithGovernanceBody,
    profiles_with_dedicated_ai_compute: profilesWithDedicatedCompute,
    research_confidence: confidence,
    total_research_sources_listed: totalSources,
  };

  const digest = {
    generated_at: summary.generated_at,
    generated_by: summary.generated_by,
    summary,
    coverage: {
      by_category: byCategory,
      by_subcategory: bySubcategory,
      by_technology: byTechnology,
      by_stakeholder: byStakeholder,
      by_adoption_stage: byAdoptionStage,
      by_investment_scale: byInvestmentScale,
      by_collaboration_pattern: byCollaborationPattern,
      by_policy_stance: byPolicyStance,
      maturity_dimension_profile_counts: maturityDimensionProfileCounts,
      by_strategic_archetype: byStrategicArchetype,
      by_policy_quality_score: byPolicyQualityScore,
      by_compute_capacity_tier: byComputeCapacityTier,
      by_vendor_parent: byVendorParent,
      by_vendor_concentration: byVendorConcentration,
      by_student_service_type: byStudentServiceType,
      by_outcome_claim_type: byOutcomeClaimType,
      by_risk_level: byRiskLevel,
      by_analytics_gap_type: byAnalyticsGapType,
    },
    rankings: {
      top_institutions_by_initiative_count: institutions
        .map((row) => ({ slug: String(row.slug), institution: String(row.institution), initiative_count: Number(row.initiative_count) }))
        .sort((a, b) => b.initiative_count - a.initiative_count || a.institution.localeCompare(b.institution))
        .slice(0, 25),
      top_institutions_by_disclosed_investment: institutions
        .map((row) => ({ slug: String(row.slug), institution: String(row.institution), disclosed_usd: Number(row.disclosed_usd || 0) }))
        .filter((row) => row.disclosed_usd > 0)
        .sort((a, b) => b.disclosed_usd - a.disclosed_usd || a.institution.localeCompare(b.institution))
        .slice(0, 25),
      top_institutions_by_maturity_breadth: institutions
        .map((row) => ({
          slug: String(row.slug),
          institution: String(row.institution),
          breadth: Number(row.maturity_dimension_count || 0),
          maturity_dimensions: String(row.maturity_dimensions || "").split("|").filter(Boolean),
        }))
        .sort((a, b) => b.breadth - a.breadth || a.institution.localeCompare(b.institution))
        .slice(0, 25),
      top_vendors_and_tools: topEntries(topVendors, 30),
      top_collaboration_partners: topEntries(topPartners, 30),
      top_source_domains: topEntries(sourceDomains, 30),
      top_vendor_parents: topEntries(byVendorParent, 30),
      top_outcome_claim_institutions: analyticsSignals
        .map((row) => ({
          slug: String(row.slug),
          institution: String(row.institution),
          outcome_claim_count: Number(row.outcome_claim_count || 0),
        }))
        .filter((row) => row.outcome_claim_count > 0)
        .sort((a, b) => b.outcome_claim_count - a.outcome_claim_count || a.institution.localeCompare(b.institution))
        .slice(0, 25),
      top_student_impact_institutions: analyticsSignals
        .map((row) => ({
          slug: String(row.slug),
          institution: String(row.institution),
          student_facing_tool_count: Number(row.student_facing_tool_count || 0),
          student_experience_signal_count: Number(row.student_experience_signal_count || 0),
        }))
        .sort(
          (a, b) =>
            b.student_facing_tool_count - a.student_facing_tool_count ||
            b.student_experience_signal_count - a.student_experience_signal_count ||
            a.institution.localeCompare(b.institution),
        )
        .slice(0, 25),
      top_research_enterprise_institutions: analyticsSignals
        .map((row) => ({
          slug: String(row.slug),
          institution: String(row.institution),
          research_center_count: Number(row.research_center_count || 0),
          scientific_discovery_signal_count: Number(row.scientific_discovery_signal_count || 0),
          compute_capacity_tier: String(row.compute_capacity_tier || "unknown"),
        }))
        .sort(
          (a, b) =>
            b.research_center_count - a.research_center_count ||
            b.scientific_discovery_signal_count - a.scientific_discovery_signal_count ||
            a.institution.localeCompare(b.institution),
        )
        .slice(0, 25),
    },
    geography: {
      by_state: Object.fromEntries(Object.entries(byState).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
      by_system: Object.fromEntries(Object.entries(bySystem).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
    },
    exports: {
      directory: "output/analytics",
      tables: [
        "institutions.csv",
        "initiatives.csv",
        "initiative_categories.csv",
        "initiative_subcategories.csv",
        "initiative_technologies.csv",
        "initiative_stakeholders.csv",
        "initiative_collaborations.csv",
        "initiative_tools.csv",
        "initiative_sources.csv",
        "profile_gaps.csv",
        "institution_analytics_signals.csv",
        "institution_vendor_exposure.csv",
        "institution_outcome_claims.csv",
        "institution_analytics_gaps.csv",
        "summary.json",
      ],
    },
  };

  writeFileSync(join(OUT_DIR, "summary.json"), `${JSON.stringify(digest, null, 2)}\n`);
  writeFileSync(join(PROFILE_DIR, "_r1-digest.json"), `${JSON.stringify(digest, null, 2)}\n`);
  writeFileSync(
    join(OUT_DIR, "README.md"),
    [
      "# Institution Analytics Exports",
      "",
      `Generated at ${summary.generated_at} by \`npm run analytics:institutions\`.`,
      "",
      "## Grain",
      "",
      "- `institutions.csv`: one row per R1 institution profile.",
      "- `initiatives.csv`: one row per recorded AI initiative.",
      "- `initiative_*` files: bridge tables for many-to-many initiative dimensions.",
      "- `profile_gaps.csv`: one row per acknowledged research gap.",
      "- `institution_analytics_signals.csv`: one row per institution with archetype, policy quality, research, student impact, vendor, outcome, risk, and gap signals.",
      "- `institution_vendor_exposure.csv`: normalized parent-vendor mentions by institution.",
      "- `institution_outcome_claims.csv`: public usage, learning, productivity, research, career, and student-success claims extracted from initiative text.",
      "- `institution_analytics_gaps.csv`: analytics gap categories needed for honest interpretation.",
      "- `summary.json`: aggregate digest and rankings.",
      "",
      "## Notes",
      "",
      "- Use `initiative_id` to join initiative-level tables.",
      "- Use `slug` to join institution-level tables.",
      "- Arrays from the source JSON are represented as bridge tables instead of comma-packed cells where possible.",
      "- Disclosed investment totals only include explicit dollar amounts found in public sources; undisclosed licensing and staffing costs are not imputed.",
      "",
    ].join("\n"),
  );

  console.log(
    JSON.stringify(
      {
        outDir: "output/analytics",
        profiles: profiles.length,
        initiatives: totalInitiatives,
        disclosedUsd: summary.total_disclosed_usd,
        tables: digest.exports.tables.length,
      },
      null,
      2,
    ),
  );
}

main();
