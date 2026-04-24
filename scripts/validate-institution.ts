/**
 * Validate an institution AI profile produced by the `collect-institution` skill.
 *
 * Reads data/institutions/<slug>.json (a JSON file conforming to
 * data/institutions/_schema.json) and reports completeness against every
 * dimension defined in research/insight-schema.ts plus the schema-required
 * top-level sections.
 *
 * This validator does NOT depend on the Yutori scout pipeline. It only
 * inspects the saved profile file.
 *
 * Usage:
 *   npx tsx scripts/validate-institution.ts yale-university
 *   npx tsx scripts/validate-institution.ts data/institutions/yale-university.json
 *   npx tsx scripts/validate-institution.ts yale-university --json
 *   npx tsx scripts/validate-institution.ts --list
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, join, resolve } from "path";
import {
  TREND_CATEGORIES,
  TREND_SUBCATEGORIES,
  MATURITY_DIMENSIONS,
  type TrendCategory,
  type MaturityDimension,
} from "../research/insight-schema";

// ---------------------------------------------------------------------------
// Canonical enum values
// ---------------------------------------------------------------------------

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

const ADOPTION_STAGES = [
  "announcement",
  "pilot",
  "scaling",
  "operational",
  "transformative",
] as const;

const INVESTMENT_SCALES = [
  "major",
  "significant",
  "moderate",
  "exploratory",
  "unknown",
] as const;

const COLLABORATION_PATTERNS = [
  "industry_academic",
  "cross_institution",
  "international",
  "government_academic",
  "community_academic",
  "startup_academic",
  "none",
] as const;

const POLICY_STANCES = [
  "prohibitive",
  "cautious",
  "permissive",
  "comprehensive",
  "not_applicable",
] as const;

const INSTITUTION_TYPES = [
  "r1_research",
  "r2_research",
  "comprehensive_regional",
  "liberal_arts",
  "community_college",
  "online_for_profit",
  "professional_school",
  "minority_serving",
  "international",
  "system_or_consortium",
  "unknown",
] as const;

const ANALYTICS_ARCHETYPES = [
  "platform_first",
  "research_compute_powerhouse",
  "curriculum_led",
  "governance_led",
  "student_success_led",
  "workforce_regional_development",
  "balanced_enterprise",
  "public_signal_thin",
] as const;

const CLASSROOM_AUTHORITY_MODELS = [
  "faculty_discretion",
  "centralized_rules",
  "mixed",
  "unclear",
] as const;

const AI_DETECTION_STANCES = [
  "rejects_or_limits_detection",
  "permits_detection",
  "requires_detection",
  "unclear",
] as const;

const COMPUTE_CAPACITY_TIERS = [
  "none",
  "named_system_capacity_unknown",
  "dedicated_compute_capacity_unknown",
  "modest_gpu_disclosed",
  "gpu_cluster_disclosed",
  "advanced_hpc_disclosed",
] as const;

const VENDOR_CONCENTRATION_LEVELS = ["none", "low", "moderate", "high"] as const;

const OUTCOME_CLAIM_TYPES = [
  "usage",
  "student_success",
  "learning",
  "productivity",
  "research_output",
  "career",
  "cost_or_revenue",
] as const;

const RISK_LEVELS = ["low_public_signal", "managed", "medium", "high"] as const;

// ---------------------------------------------------------------------------
// Maturity-dimension evidence rules: heuristic mapping from initiative content
// to one of the 8 maturity dimensions.
// ---------------------------------------------------------------------------

type Initiative = Record<string, any>;

const MATURITY_EVIDENCE: Record<MaturityDimension, (i: Initiative) => boolean> = {
  strategy_and_leadership: (i) =>
    arrIncludes(i.subcategories, "institutional_ai_strategy") ||
    /\b(ai (strategy|council|task force|roadmap)|chief ai|cao\b|caio\b)/i.test(
      `${i.title ?? ""} ${i.description ?? ""}`
    ),
  policy_and_governance: (i) =>
    i.primary_category === "governance_and_policy" ||
    arrIncludes(i.secondary_categories, "governance_and_policy"),
  teaching_and_curriculum: (i) =>
    i.primary_category === "teaching_and_learning" ||
    arrIncludes(i.secondary_categories, "teaching_and_learning"),
  research_infrastructure: (i) =>
    i.primary_category === "research_and_innovation" ||
    arrIncludes(i.subcategories, "computing_infrastructure") ||
    arrIncludes(i.subcategories, "ai_research_center"),
  student_services: (i) =>
    i.primary_category === "student_experience_and_services" ||
    arrIncludes(i.secondary_categories, "student_experience_and_services"),
  workforce_and_community: (i) =>
    i.primary_category === "workforce_and_economic_development" ||
    arrIncludes(i.secondary_categories, "workforce_and_economic_development"),
  partnerships_and_ecosystem: (i) =>
    (i.collaborations?.length ?? 0) > 0 ||
    arrIncludes(i.subcategories, "industry_academic_partnership") ||
    arrIncludes(i.subcategories, "cross_border_research_alliance"),
  equity_and_inclusion: (i) =>
    i.primary_category === "equity_access_and_inclusion" ||
    arrIncludes(i.secondary_categories, "equity_access_and_inclusion"),
};

function arrIncludes(arr: unknown, value: string): boolean {
  return Array.isArray(arr) && arr.includes(value);
}

// ---------------------------------------------------------------------------
// File loading
// ---------------------------------------------------------------------------

const PROFILES_DIR = join(__dirname, "..", "data", "institutions");

function resolveProfilePath(input: string): string {
  if (input.endsWith(".json") && existsSync(input)) return resolve(input);
  if (existsSync(input)) return resolve(input);
  const slug = input.replace(/\.json$/i, "");
  const candidate = join(PROFILES_DIR, `${slug}.json`);
  if (existsSync(candidate)) return candidate;
  throw new Error(
    `Could not find profile for "${input}". Looked at "${candidate}". List available with --list.`
  );
}

function listProfiles(): string[] {
  if (!existsSync(PROFILES_DIR)) return [];
  return readdirSync(PROFILES_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

type Issue = { severity: "error" | "warn" | "info"; field: string; message: string };

const REQUIRED_TOP_LEVEL = [
  "institution",
  "slug",
  "city_state",
  "carnegie",
  "institution_type",
  "leadership",
  "ai_strategy",
  "ai_policy",
  "governance_structure",
  "initiatives",
  "analytics_signals",
  "narrative_summary",
  "research_quality",
];

function isPlaceholder(value: unknown): boolean {
  if (typeof value !== "string") return false;
  // Anything still using schema placeholder text like "string", "string | null", "boolean"
  return /^(string|number|boolean|YYYY|array of)/i.test(value.trim());
}

function isMissing(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "" || isPlaceholder(value);
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}

function validateSchema(profile: any): Issue[] {
  const issues: Issue[] = [];

  for (const key of REQUIRED_TOP_LEVEL) {
    if (isMissing(profile[key])) {
      issues.push({ severity: "error", field: key, message: "missing or empty" });
    }
  }

  if (profile.institution_type && !INSTITUTION_TYPES.includes(profile.institution_type)) {
    issues.push({
      severity: "error",
      field: "institution_type",
      message: `not a valid institution_type (got "${profile.institution_type}")`,
    });
  }

  if (profile.ai_policy?.stance && !POLICY_STANCES.includes(profile.ai_policy.stance)) {
    issues.push({
      severity: "error",
      field: "ai_policy.stance",
      message: `invalid policy stance "${profile.ai_policy.stance}"`,
    });
  }

  if (profile.ai_policy?.has_acceptable_use_policy && (profile.ai_policy.policy_urls?.length ?? 0) === 0) {
    issues.push({
      severity: "warn",
      field: "ai_policy.policy_urls",
      message: "policy claimed but no URLs cited",
    });
  }

  if (profile.governance_structure?.has_governance_body && (profile.governance_structure.bodies?.length ?? 0) === 0) {
    issues.push({
      severity: "warn",
      field: "governance_structure.bodies",
      message: "governance body claimed but bodies array empty",
    });
  }

  const analytics = profile.analytics_signals;
  if (!analytics) {
    issues.push({
      severity: "error",
      field: "analytics_signals",
      message: "missing analytics enrichment layer; run npm run analytics:enrich",
    });
  } else {
    const primaryArchetype = analytics.strategic_archetype?.primary;
    if (primaryArchetype && !ANALYTICS_ARCHETYPES.includes(primaryArchetype)) {
      issues.push({
        severity: "error",
        field: "analytics_signals.strategic_archetype.primary",
        message: `invalid archetype "${primaryArchetype}"`,
      });
    }
    for (const archetype of analytics.strategic_archetype?.secondary ?? []) {
      if (!ANALYTICS_ARCHETYPES.includes(archetype)) {
        issues.push({
          severity: "error",
          field: "analytics_signals.strategic_archetype.secondary",
          message: `invalid archetype "${archetype}"`,
        });
      }
    }

    const policyScore = analytics.policy_quality?.score_0_5;
    if (typeof policyScore !== "number" || policyScore < 0 || policyScore > 5) {
      issues.push({
        severity: "error",
        field: "analytics_signals.policy_quality.score_0_5",
        message: "must be a number from 0 to 5",
      });
    }
    const classroomModel = analytics.policy_quality?.classroom_authority_model;
    if (classroomModel && !CLASSROOM_AUTHORITY_MODELS.includes(classroomModel)) {
      issues.push({
        severity: "error",
        field: "analytics_signals.policy_quality.classroom_authority_model",
        message: `invalid "${classroomModel}"`,
      });
    }
    const detectionStance = analytics.policy_quality?.ai_detection_stance;
    if (detectionStance && !AI_DETECTION_STANCES.includes(detectionStance)) {
      issues.push({
        severity: "error",
        field: "analytics_signals.policy_quality.ai_detection_stance",
        message: `invalid "${detectionStance}"`,
      });
    }

    const capacityTier = analytics.research_enterprise?.compute?.capacity_tier;
    if (capacityTier && !COMPUTE_CAPACITY_TIERS.includes(capacityTier)) {
      issues.push({
        severity: "error",
        field: "analytics_signals.research_enterprise.compute.capacity_tier",
        message: `invalid "${capacityTier}"`,
      });
    }

    const concentration = analytics.vendor_exposure?.concentration;
    if (concentration && !VENDOR_CONCENTRATION_LEVELS.includes(concentration)) {
      issues.push({
        severity: "error",
        field: "analytics_signals.vendor_exposure.concentration",
        message: `invalid "${concentration}"`,
      });
    }

    for (const claim of analytics.value_and_outcomes?.public_claims ?? []) {
      if (claim.claim_type && !OUTCOME_CLAIM_TYPES.includes(claim.claim_type)) {
        issues.push({
          severity: "error",
          field: "analytics_signals.value_and_outcomes.public_claims.claim_type",
          message: `invalid "${claim.claim_type}"`,
        });
      }
    }

    const riskLevel = analytics.risk_readiness?.risk_level;
    if (riskLevel && !RISK_LEVELS.includes(riskLevel)) {
      issues.push({
        severity: "error",
        field: "analytics_signals.risk_readiness.risk_level",
        message: `invalid "${riskLevel}"`,
      });
    }
  }

  if ((profile.initiatives?.length ?? 0) === 0) {
    issues.push({
      severity: "error",
      field: "initiatives",
      message: "no initiatives recorded — at minimum 3-5 expected for any active institution",
    });
  }

  for (const [idx, init] of (profile.initiatives ?? []).entries()) {
    const tag = `initiatives[${idx}]`;
    for (const f of ["title", "description", "primary_category", "source_urls"]) {
      if (isMissing(init[f])) {
        issues.push({ severity: "error", field: `${tag}.${f}`, message: "missing" });
      }
    }
    if (init.primary_category && !TREND_CATEGORIES.includes(init.primary_category)) {
      issues.push({
        severity: "error",
        field: `${tag}.primary_category`,
        message: `invalid category "${init.primary_category}"`,
      });
    }
    for (const sc of init.secondary_categories ?? []) {
      if (!TREND_CATEGORIES.includes(sc)) {
        issues.push({ severity: "error", field: `${tag}.secondary_categories`, message: `invalid category "${sc}"` });
      }
    }
    for (const sub of init.subcategories ?? []) {
      const allSubs = (Object.values(TREND_SUBCATEGORIES) as readonly (readonly string[])[]).flat();
      if (!allSubs.includes(sub)) {
        issues.push({ severity: "error", field: `${tag}.subcategories`, message: `unknown subcategory "${sub}"` });
      }
    }
    for (const tech of init.technology_focus ?? []) {
      if (!TECHNOLOGY_FOCUS_VALUES.includes(tech)) {
        issues.push({ severity: "error", field: `${tag}.technology_focus`, message: `invalid "${tech}"` });
      }
    }
    for (const stakeholder of init.stakeholder_impact ?? []) {
      if (!STAKEHOLDER_VALUES.includes(stakeholder)) {
        issues.push({ severity: "error", field: `${tag}.stakeholder_impact`, message: `invalid "${stakeholder}"` });
      }
    }
    if (init.maturity_signal && !["emerging", "growing", "mainstream", "declining"].includes(init.maturity_signal)) {
      issues.push({ severity: "error", field: `${tag}.maturity_signal`, message: `invalid "${init.maturity_signal}"` });
    }
    if (init.adoption_stage && !ADOPTION_STAGES.includes(init.adoption_stage)) {
      issues.push({ severity: "error", field: `${tag}.adoption_stage`, message: `invalid "${init.adoption_stage}"` });
    }
    if (init.investment?.scale && !INVESTMENT_SCALES.includes(init.investment.scale)) {
      issues.push({ severity: "error", field: `${tag}.investment.scale`, message: `invalid "${init.investment.scale}"` });
    }
    for (const c of init.collaborations ?? []) {
      if (c.pattern && !COLLABORATION_PATTERNS.includes(c.pattern)) {
        issues.push({ severity: "error", field: `${tag}.collaborations.pattern`, message: `invalid "${c.pattern}"` });
      }
    }
    if (init.policy_stance && !POLICY_STANCES.includes(init.policy_stance)) {
      issues.push({ severity: "error", field: `${tag}.policy_stance`, message: `invalid "${init.policy_stance}"` });
    }
  }

  if ((profile.research_quality?.sources?.length ?? 0) === 0) {
    issues.push({
      severity: "error",
      field: "research_quality.sources",
      message: "no source URLs recorded — every claim should cite a source",
    });
  }

  if (profile.research_quality?.confidence === "low") {
    issues.push({
      severity: "warn",
      field: "research_quality.confidence",
      message: "agent self-reported low confidence",
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Coverage analysis
// ---------------------------------------------------------------------------

type Coverage = {
  initiativeCount: number;
  dateRange: { earliest: string | null; latest: string | null };
  categoriesTouched: Map<string, number>;
  subcategoriesTouched: Map<string, number>;
  technologies: Map<string, number>;
  stakeholders: Map<string, number>;
  adoptionStages: Map<string, number>;
  investmentScales: Map<string, number>;
  totalDisclosedUsd: number;
  collaborationPatterns: Map<string, number>;
  collaboratorPartners: Map<string, number>;
  toolsAndVendors: Map<string, { vendor: string; count: number }>;
  policyStances: Map<string, number>;
  maturityDimensionsCovered: Map<string, number>;
  topLevelPresence: Record<string, boolean>;
};

function increment<K>(map: Map<K, number>, key: K) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

const TOP_LEVEL_FIELDS = [
  "leadership.president",
  "leadership.cio",
  "leadership.chief_ai_officer",
  "leadership.has_dedicated_ai_role",
  "ai_strategy.has_published_strategy",
  "ai_strategy.documents",
  "ai_policy.has_acceptable_use_policy",
  "ai_policy.policy_urls",
  "ai_policy.stance",
  "governance_structure.has_governance_body",
  "governance_structure.bodies",
  "research_centers",
  "ai_academic_programs",
  "enterprise_platforms",
  "computing_infrastructure.has_dedicated_ai_compute",
  "investments_and_gifts",
  "industry_and_research_partnerships",
  "student_facing_ai",
  "equity_and_access_initiatives",
  "analytics_signals.strategic_archetype.primary",
  "analytics_signals.policy_quality.score_0_5",
  "analytics_signals.academic_reality",
  "analytics_signals.research_enterprise",
  "analytics_signals.student_impact",
  "analytics_signals.vendor_exposure",
  "analytics_signals.value_and_outcomes",
  "analytics_signals.risk_readiness",
  "analytics_signals.data_gaps",
  "regulatory_context.summary",
  "narrative_summary",
];

function getPath(obj: any, path: string): unknown {
  return path.split(".").reduce((acc: any, key) => (acc == null ? acc : acc[key]), obj);
}

function buildCoverage(profile: any): Coverage {
  const cov: Coverage = {
    initiativeCount: profile.initiatives?.length ?? 0,
    dateRange: { earliest: null, latest: null },
    categoriesTouched: new Map(),
    subcategoriesTouched: new Map(),
    technologies: new Map(),
    stakeholders: new Map(),
    adoptionStages: new Map(),
    investmentScales: new Map(),
    totalDisclosedUsd: 0,
    collaborationPatterns: new Map(),
    collaboratorPartners: new Map(),
    toolsAndVendors: new Map(),
    policyStances: new Map(),
    maturityDimensionsCovered: new Map(),
    topLevelPresence: {},
  };

  const dates: string[] = [];

  for (const init of profile.initiatives ?? []) {
    if (init.date_announced) dates.push(init.date_announced);

    if (init.primary_category) increment(cov.categoriesTouched, init.primary_category);
    for (const cat of init.secondary_categories ?? []) increment(cov.categoriesTouched, cat);
    for (const sub of init.subcategories ?? []) increment(cov.subcategoriesTouched, sub);
    for (const tech of init.technology_focus ?? []) increment(cov.technologies, tech);
    for (const sh of init.stakeholder_impact ?? []) increment(cov.stakeholders, sh);
    if (init.adoption_stage) increment(cov.adoptionStages, init.adoption_stage);
    if (init.investment?.scale) increment(cov.investmentScales, init.investment.scale);
    if (typeof init.investment?.amount_usd === "number") {
      cov.totalDisclosedUsd += init.investment.amount_usd;
    }
    for (const c of init.collaborations ?? []) {
      if (c.pattern) increment(cov.collaborationPatterns, c.pattern);
      for (const p of c.partners ?? []) increment(cov.collaboratorPartners, p);
    }
    for (const t of init.tools_and_vendors ?? []) {
      const key = t.name || t.vendor || "(unnamed)";
      const existing = cov.toolsAndVendors.get(key);
      cov.toolsAndVendors.set(key, {
        vendor: t.vendor || existing?.vendor || "",
        count: (existing?.count ?? 0) + 1,
      });
    }
    if (init.policy_stance) increment(cov.policyStances, init.policy_stance);

    for (const dim of MATURITY_DIMENSIONS) {
      if (MATURITY_EVIDENCE[dim](init)) increment(cov.maturityDimensionsCovered, dim);
    }
  }

  // Also pick up evidence from top-level structures (a published strategy
  // counts as evidence for strategy_and_leadership; a governance body counts
  // for policy_and_governance, etc.)
  if (profile.ai_strategy?.has_published_strategy) {
    increment(cov.maturityDimensionsCovered, "strategy_and_leadership");
  }
  if (profile.governance_structure?.has_governance_body || profile.ai_policy?.has_acceptable_use_policy) {
    increment(cov.maturityDimensionsCovered, "policy_and_governance");
  }
  if ((profile.research_centers?.length ?? 0) > 0 || profile.computing_infrastructure?.has_dedicated_ai_compute) {
    increment(cov.maturityDimensionsCovered, "research_infrastructure");
  }
  if ((profile.ai_academic_programs?.length ?? 0) > 0) {
    increment(cov.maturityDimensionsCovered, "teaching_and_curriculum");
  }
  if ((profile.student_facing_ai?.length ?? 0) > 0) {
    increment(cov.maturityDimensionsCovered, "student_services");
  }
  if ((profile.industry_and_research_partnerships?.length ?? 0) > 0) {
    increment(cov.maturityDimensionsCovered, "partnerships_and_ecosystem");
  }
  if ((profile.equity_and_access_initiatives?.length ?? 0) > 0) {
    increment(cov.maturityDimensionsCovered, "equity_and_inclusion");
  }

  if (dates.length > 0) {
    dates.sort();
    cov.dateRange.earliest = dates[0];
    cov.dateRange.latest = dates[dates.length - 1];
  }

  for (const path of TOP_LEVEL_FIELDS) {
    cov.topLevelPresence[path] = !isMissing(getPath(profile, path));
  }

  return cov;
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

const C_RESET = "\x1b[0m";
const C_BOLD = "\x1b[1m";
const C_DIM = "\x1b[2m";
const C_GREEN = "\x1b[32m";
const C_YELLOW = "\x1b[33m";
const C_RED = "\x1b[31m";
const C_CYAN = "\x1b[36m";

function bar(): string {
  return "─".repeat(72);
}

function section(title: string): string {
  return `\n${C_BOLD}${C_CYAN}${title}${C_RESET}\n${C_DIM}${bar()}${C_RESET}`;
}

function checkLine(present: boolean, label: string, suffix = ""): string {
  const mark = present ? `${C_GREEN}✓${C_RESET}` : `${C_RED}✗${C_RESET}`;
  return `  ${mark} ${label}${suffix ? `  ${C_DIM}${suffix}${C_RESET}` : ""}`;
}

function coveragePct(have: number, total: number): string {
  const pct = total === 0 ? 0 : Math.round((have / total) * 100);
  const color = pct >= 60 ? C_GREEN : pct >= 30 ? C_YELLOW : C_RED;
  return `${color}${have}/${total} (${pct}%)${C_RESET}`;
}

function fmtUsd(n: number): string {
  if (n === 0) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

function renderEnumCoverage<T extends string>(
  values: readonly T[],
  observed: Map<string, number>
): string {
  return values
    .map((v) => {
      const count = observed.get(v) ?? 0;
      return checkLine(count > 0, v, count > 0 ? `(${count})` : "");
    })
    .join("\n");
}

function renderSubcategoryCoverage(observed: Map<string, number>): string {
  const lines: string[] = [];
  for (const cat of TREND_CATEGORIES) {
    const subs = TREND_SUBCATEGORIES[cat];
    const hits = subs.filter((s) => (observed.get(s) ?? 0) > 0).length;
    lines.push(`\n  ${C_BOLD}${cat}${C_RESET}  ${C_DIM}${hits}/${subs.length}${C_RESET}`);
    for (const sub of subs) {
      const count = observed.get(sub) ?? 0;
      const mark = count > 0 ? `${C_GREEN}✓${C_RESET}` : `${C_DIM}·${C_RESET}`;
      const text = count > 0 ? `${sub} ${C_DIM}(${count})${C_RESET}` : `${C_DIM}${sub}${C_RESET}`;
      lines.push(`    ${mark} ${text}`);
    }
  }
  return lines.join("\n");
}

function renderTopLevelPresence(cov: Coverage): string {
  const lines: string[] = [];
  for (const path of TOP_LEVEL_FIELDS) {
    lines.push(checkLine(cov.topLevelPresence[path], path));
  }
  return lines.join("\n");
}

function renderTopList(map: Map<string, number | { count: number; vendor?: string }>, limit = 10): string {
  const entries = Array.from(map.entries())
    .map(([k, v]) => ({
      name: k,
      count: typeof v === "number" ? v : v.count,
      vendor: typeof v === "object" ? v.vendor : undefined,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  if (entries.length === 0) return `  ${C_DIM}(none)${C_RESET}`;
  return entries
    .map((e) => `  ${C_DIM}·${C_RESET} ${e.name}${e.vendor ? ` ${C_DIM}(${e.vendor})${C_RESET}` : ""}  ${C_DIM}${e.count}×${C_RESET}`)
    .join("\n");
}

function renderIssues(issues: Issue[]): string {
  if (issues.length === 0) return `  ${C_GREEN}No schema issues.${C_RESET}`;
  const colorFor = { error: C_RED, warn: C_YELLOW, info: C_CYAN };
  const labelFor = { error: "ERROR", warn: " WARN", info: " INFO" };
  return issues
    .map((i) => `  ${colorFor[i.severity]}${labelFor[i.severity]}${C_RESET}  ${C_BOLD}${i.field}${C_RESET}  ${C_DIM}${i.message}${C_RESET}`)
    .join("\n");
}

function renderReport(profile: any, cov: Coverage, issues: Issue[]): string {
  const lines: string[] = [];

  const header = `Institution profile: ${profile.institution ?? "(unknown)"}`;
  lines.push(`\n${C_BOLD}╔${"═".repeat(70)}╗${C_RESET}`);
  lines.push(`${C_BOLD}║  ${header.padEnd(68)}║${C_RESET}`);
  lines.push(`${C_BOLD}╚${"═".repeat(70)}╝${C_RESET}`);

  lines.push(`\n${C_DIM}Slug:${C_RESET} ${profile.slug ?? "?"}    ${C_DIM}Carnegie:${C_RESET} ${profile.carnegie ?? "?"}    ${C_DIM}Type:${C_RESET} ${profile.institution_type ?? "?"}    ${C_DIM}Location:${C_RESET} ${profile.city_state ?? "?"}`);
  if (profile.system) lines.push(`${C_DIM}System:${C_RESET} ${profile.system}`);

  lines.push(`\n${C_BOLD}Initiatives:${C_RESET} ${cov.initiativeCount}    ${C_BOLD}Date range:${C_RESET} ${cov.dateRange.earliest ?? "?"} → ${cov.dateRange.latest ?? "?"}    ${C_BOLD}Disclosed investment:${C_RESET} ${fmtUsd(cov.totalDisclosedUsd)}`);

  lines.push(section("Schema completeness — top-level sections"));
  lines.push(renderTopLevelPresence(cov));

  lines.push(section(`Trend categories  ${coveragePct(cov.categoriesTouched.size, TREND_CATEGORIES.length)}`));
  lines.push(renderEnumCoverage(TREND_CATEGORIES, cov.categoriesTouched));

  const subTotal = (Object.values(TREND_SUBCATEGORIES) as readonly (readonly string[])[]).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  lines.push(section(`Subcategories  ${coveragePct(cov.subcategoriesTouched.size, subTotal)}`));
  lines.push(renderSubcategoryCoverage(cov.subcategoriesTouched));

  lines.push(section(`Technology focus  ${coveragePct(cov.technologies.size, TECHNOLOGY_FOCUS_VALUES.length)}`));
  lines.push(renderEnumCoverage(TECHNOLOGY_FOCUS_VALUES, cov.technologies));

  lines.push(section(`Stakeholder impact  ${coveragePct(cov.stakeholders.size, STAKEHOLDER_VALUES.length)}`));
  lines.push(renderEnumCoverage(STAKEHOLDER_VALUES, cov.stakeholders));

  lines.push(section(`Adoption stage  ${coveragePct(cov.adoptionStages.size, ADOPTION_STAGES.length)}`));
  lines.push(renderEnumCoverage(ADOPTION_STAGES, cov.adoptionStages));

  lines.push(section(`Investment signals  ${coveragePct(cov.investmentScales.size, INVESTMENT_SCALES.length)}`));
  lines.push(renderEnumCoverage(INVESTMENT_SCALES, cov.investmentScales));

  lines.push(section(`Collaboration patterns  ${coveragePct(cov.collaborationPatterns.size, COLLABORATION_PATTERNS.length)}`));
  lines.push(renderEnumCoverage(COLLABORATION_PATTERNS, cov.collaborationPatterns));

  lines.push(section("Top partners"));
  lines.push(renderTopList(cov.collaboratorPartners as Map<string, number>));

  lines.push(section("Tools & vendors"));
  lines.push(renderTopList(cov.toolsAndVendors as Map<string, { count: number; vendor: string }>));

  lines.push(section(`Policy stance distribution  ${coveragePct(cov.policyStances.size, POLICY_STANCES.length)}`));
  lines.push(renderEnumCoverage(POLICY_STANCES, cov.policyStances));

  lines.push(section(`Maturity dimensions evidenced  ${coveragePct(cov.maturityDimensionsCovered.size, MATURITY_DIMENSIONS.length)}`));
  for (const dim of MATURITY_DIMENSIONS) {
    const count = cov.maturityDimensionsCovered.get(dim) ?? 0;
    lines.push(checkLine(count > 0, dim, count > 0 ? `${count} signal(s)` : "no evidence"));
  }

  lines.push(section("Schema validation"));
  lines.push(renderIssues(issues));

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.filter((i) => i.severity === "warn").length;
  const verdict =
    errorCount === 0 && warnCount === 0
      ? `${C_GREEN}PASS${C_RESET} — profile is complete and schema-valid.`
      : errorCount === 0
        ? `${C_YELLOW}PASS WITH WARNINGS${C_RESET} — ${warnCount} warning(s).`
        : `${C_RED}FAIL${C_RESET} — ${errorCount} error(s), ${warnCount} warning(s). Re-research to fill gaps.`;
  lines.push(section("Verdict"));
  lines.push(`  ${verdict}`);

  if (profile.research_quality?.gaps_acknowledged?.length) {
    lines.push(`\n  ${C_DIM}Agent-acknowledged gaps:${C_RESET}`);
    for (const g of profile.research_quality.gaps_acknowledged) {
      lines.push(`    ${C_DIM}·${C_RESET} ${g}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): {
  command: "validate" | "list" | "all" | "help";
  target: string;
  json: boolean;
} {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return { command: "help", target: "", json: false };
  }
  if (args[0] === "--list") return { command: "list", target: "", json: false };
  if (args[0] === "--all") return { command: "all", target: "", json: args.includes("--json") };
  return {
    command: "validate",
    target: args.find((a) => !a.startsWith("--")) ?? "",
    json: args.includes("--json"),
  };
}

function printHelp() {
  console.log(`
Validate an institution AI profile JSON file produced by the
\`collect-institution\` skill.

Usage:
  npx tsx scripts/validate-institution.ts <slug>
  npx tsx scripts/validate-institution.ts <slug> --json
  npx tsx scripts/validate-institution.ts <path-to-profile.json>
  npx tsx scripts/validate-institution.ts --list
  npx tsx scripts/validate-institution.ts --all

Examples:
  npx tsx scripts/validate-institution.ts yale-university
  npx tsx scripts/validate-institution.ts data/institutions/yale-university.json

Schema reference: data/institutions/_schema.json
`);
}

function coverageToJson(cov: Coverage, issues: Issue[]): unknown {
  const mapToObj = <V>(m: Map<string, V>) => Object.fromEntries(m.entries());
  return {
    initiativeCount: cov.initiativeCount,
    dateRange: cov.dateRange,
    categoriesTouched: mapToObj(cov.categoriesTouched),
    subcategoriesTouched: mapToObj(cov.subcategoriesTouched),
    technologies: mapToObj(cov.technologies),
    stakeholders: mapToObj(cov.stakeholders),
    adoptionStages: mapToObj(cov.adoptionStages),
    investmentScales: mapToObj(cov.investmentScales),
    totalDisclosedUsd: cov.totalDisclosedUsd,
    collaborationPatterns: mapToObj(cov.collaborationPatterns),
    collaboratorPartners: mapToObj(cov.collaboratorPartners),
    toolsAndVendors: mapToObj(cov.toolsAndVendors),
    policyStances: mapToObj(cov.policyStances),
    maturityDimensionsCovered: mapToObj(cov.maturityDimensionsCovered),
    topLevelPresence: cov.topLevelPresence,
    issues,
  };
}

function validateAllProfiles(json: boolean) {
  const slugs = listProfiles();
  const failedSlugs: string[] = [];
  const warningSlugs: string[] = [];
  let initiativeCount = 0;
  let disclosedUsd = 0;
  let warningCount = 0;
  let errorCount = 0;

  for (const slug of slugs) {
    const profilePath = resolveProfilePath(slug);
    const profile = JSON.parse(readFileSync(profilePath, "utf-8"));
    const issues = validateSchema(profile);
    const coverage = buildCoverage(profile);
    const errors = issues.filter((issue) => issue.severity === "error").length;
    const warnings = issues.filter((issue) => issue.severity === "warn").length;

    initiativeCount += coverage.initiativeCount;
    disclosedUsd += coverage.totalDisclosedUsd;
    errorCount += errors;
    warningCount += warnings;
    if (errors > 0) failedSlugs.push(slug);
    if (warnings > 0) warningSlugs.push(slug);
  }

  const summary = {
    checked: slugs.length,
    failed: failedSlugs.length,
    warnings: warningSlugs.length,
    issueTotals: {
      errors: errorCount,
      warnings: warningCount,
    },
    totals: {
      initiatives: initiativeCount,
      disclosedUsd,
    },
    failedSlugs,
    warningSlugs,
  };

  writeFileSync(join(PROFILES_DIR, "_validation-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(
      `Checked ${summary.checked} profile(s): ${summary.failed} failed, ${summary.warnings} with warnings. ` +
        `Initiatives: ${summary.totals.initiatives}. Disclosed USD: ${fmtUsd(summary.totals.disclosedUsd)}.`,
    );
    if (failedSlugs.length > 0) {
      console.log(`Failed: ${failedSlugs.join(", ")}`);
    }
    if (warningSlugs.length > 0) {
      console.log(`Warnings: ${warningSlugs.join(", ")}`);
    }
  }

  process.exit(failedSlugs.length > 0 ? 1 : 0);
}

function main() {
  const opts = parseArgs(process.argv);

  if (opts.command === "help") {
    printHelp();
    return;
  }

  if (opts.command === "list") {
    const profiles = listProfiles();
    if (profiles.length === 0) {
      console.log(`No profiles in ${PROFILES_DIR} yet.`);
    } else {
      console.log(`${profiles.length} profile(s):`);
      for (const p of profiles) console.log(`  ${p}`);
    }
    return;
  }

  if (opts.command === "all") {
    validateAllProfiles(opts.json);
    return;
  }

  if (!opts.target) {
    console.error("Error: profile slug or path required. Use --help.");
    process.exit(1);
  }

  let path: string;
  try {
    path = resolveProfilePath(opts.target);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const profile = JSON.parse(readFileSync(path, "utf-8"));
  const issues = validateSchema(profile);
  const coverage = buildCoverage(profile);

  if (opts.json) {
    console.log(JSON.stringify(coverageToJson(coverage, issues), null, 2));
    process.exit(issues.some((i) => i.severity === "error") ? 1 : 0);
  }

  console.log(renderReport(profile, coverage, issues));
  process.exit(issues.some((i) => i.severity === "error") ? 1 : 0);
}

main();
