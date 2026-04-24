type AnyRecord = Record<string, any>;

const ARCHETYPES = [
  "platform_first",
  "research_compute_powerhouse",
  "curriculum_led",
  "governance_led",
  "student_success_led",
  "workforce_regional_development",
  "balanced_enterprise",
  "public_signal_thin",
] as const;

const OUTCOME_PATTERNS: Array<{ type: string; pattern: RegExp }> = [
  { type: "usage", pattern: /\b(users?|adoption|usage|active|monthly|weekly)\b/i },
  { type: "student_success", pattern: /\b(retention|completion|persistence|graduation|advising|success)\b/i },
  { type: "learning", pattern: /\b(learning outcome|learning gain|assessment|metacognition|writing|pedagog|course outcome)\b/i },
  { type: "productivity", pattern: /\b(productivity|efficiency|time saving|saved|automation|workflow|caseload)\b/i },
  { type: "research_output", pattern: /\b(grant capture|publication|scientific discovery|research output|accelerat(?:e|ed|es) research)\b/i },
  { type: "career", pattern: /\b(job placement|placement|career readiness|employer|workforce)\b/i },
  { type: "cost_or_revenue", pattern: /\b(cost saving|revenue|roi|return on investment|enrollment lift|new revenue)\b/i },
];

const RISK_PATTERN =
  /\b(ferpa|hipaa|privacy|bias|accessibility|security|cyber|intellectual property|copyright|records retention|academic integrity|ai detection|detector|sensitive data|risk)\b/i;

const CONTROL_PATTERN =
  /\b(policy|governance|committee|council|guardrail|privacy|security|compliance|ethics|responsible ai|accessibility|review|approval)\b/i;

const STATE_ABBREVIATIONS: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  "District of Columbia": "DC",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
};

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function lowerText(...values: unknown[]) {
  return values
    .flatMap((value) => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object") return JSON.stringify(value);
      return value ?? "";
    })
    .join(" ")
    .toLowerCase();
}

function sourceProfileText(profile: AnyRecord) {
  const { analytics_signals: _analyticsSignals, ...sourceBackedProfile } = profile;
  return JSON.stringify(sourceBackedProfile);
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function initiativeSubcategoryCount(profile: AnyRecord, subcategory: string) {
  return asArray<AnyRecord>(profile.initiatives).filter((initiative) =>
    asArray<string>(initiative.subcategories).includes(subcategory),
  ).length;
}

function initiativeCategoryCount(profile: AnyRecord, category: string) {
  return asArray<AnyRecord>(profile.initiatives).filter((initiative) => {
    const categories = [
      initiative.primary_category,
      ...asArray<string>(initiative.secondary_categories),
    ];
    return categories.includes(category);
  }).length;
}

function totalDisclosedUsd(profile: AnyRecord) {
  const initiativeUsd = asArray<AnyRecord>(profile.initiatives).reduce(
    (sum, initiative) => sum + (Number(initiative.investment?.amount_usd) || 0),
    0,
  );
  const giftUsd = asArray<AnyRecord>(profile.investments_and_gifts).reduce(
    (sum, gift) => sum + (Number(gift.amount_usd) || 0),
    0,
  );

  return Math.max(initiativeUsd, giftUsd);
}

function fundingBucket(value: AnyRecord) {
  const text = lowerText(value.source, value.funding_source, value.purpose, value.title, value.description);
  if (/nsf|nih|dod|doe|arpa|federal|national science|department of|government|state/.test(text)) {
    return "public_federal_state";
  }
  if (/gift|donor|foundation|philanthrop|alumni|endowment/.test(text)) {
    return "philanthropy_foundation";
  }
  if (/microsoft|google|nvidia|amazon|aws|openai|anthropic|industry|corporate|company|vendor/.test(text)) {
    return "industry_vendor";
  }
  if (/university|institution|internal|campus|college|school/.test(text)) {
    return "institutional";
  }
  return "other_unclear";
}

export function normalizeState(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  return STATE_ABBREVIATIONS[raw] ?? raw;
}

export function normalizeVendorParent(value: unknown) {
  const text = String(value ?? "").toLowerCase();
  if (!text.trim()) return "Unknown";
  if (/microsoft|copilot|azure|github/.test(text)) return "Microsoft";
  if (/google|gemini|notebooklm|vertex/.test(text)) return "Google";
  if (/openai|chatgpt|gpt-/.test(text)) return "OpenAI";
  if (/anthropic|claude/.test(text)) return "Anthropic";
  if (/amazon|aws|bedrock|nova/.test(text)) return "Amazon";
  if (/nvidia|dgx|cuda/.test(text)) return "NVIDIA";
  if (/instructure|canvas/.test(text)) return "Instructure";
  if (/d2l|brightspace/.test(text)) return "D2L";
  if (/turnitin/.test(text)) return "Turnitin";
  if (/grammarly/.test(text)) return "Grammarly";
  if (/coursera/.test(text)) return "Coursera";
  if (/salesforce|tableau/.test(text)) return "Salesforce";
  if (/oracle/.test(text)) return "Oracle";
  if (/servicenow/.test(text)) return "ServiceNow";
  if (/zoom/.test(text)) return "Zoom";
  if (/adobe/.test(text)) return "Adobe";
  if (/ellucian/.test(text)) return "Ellucian";
  if (/workday/.test(text)) return "Workday";
  if (/blackboard/.test(text)) return "Blackboard";
  if (/slack/.test(text)) return "Salesforce";
  if (/ibm|watson/.test(text)) return "IBM";
  return String(value ?? "Unknown").trim() || "Unknown";
}

function vendorExposure(profile: AnyRecord) {
  const products = [
    ...asArray<AnyRecord>(profile.enterprise_platforms).map((platform) => ({
      product: platform.product,
      vendor: platform.vendor,
    })),
    ...asArray<AnyRecord>(profile.initiatives).flatMap((initiative) =>
      asArray<AnyRecord>(initiative.tools_and_vendors).map((tool) => ({
        product: tool.name,
        vendor: tool.vendor,
      })),
    ),
  ];
  const byParent = new Map<string, { vendor: string; mentions: number; products: Set<string> }>();

  for (const item of products) {
    const parent = normalizeVendorParent(`${item.vendor ?? ""} ${item.product ?? ""}`);
    if (parent === "Unknown") continue;
    const current = byParent.get(parent) ?? { vendor: parent, mentions: 0, products: new Set<string>() };
    current.mentions += 1;
    if (item.product) current.products.add(String(item.product));
    byParent.set(parent, current);
  }

  const parent_vendors = Array.from(byParent.values())
    .map((item) => ({
      vendor: item.vendor,
      mentions: item.mentions,
      products: Array.from(item.products).sort().slice(0, 12),
    }))
    .sort((left, right) => right.mentions - left.mentions || left.vendor.localeCompare(right.vendor));
  const total = parent_vendors.reduce((sum, item) => sum + item.mentions, 0);
  const topShare = total > 0 ? parent_vendors[0].mentions / total : 0;
  const concentration =
    total === 0 ? "none" : topShare >= 0.5 ? "high" : topShare >= 0.35 ? "moderate" : "low";

  return {
    parent_vendors,
    concentration,
    top_vendor: parent_vendors[0]?.vendor ?? null,
    single_vendor_dependency_risk: concentration === "high" && total >= 3,
  };
}

function policyQuality(profile: AnyRecord) {
  const policy = profile.ai_policy ?? {};
  const provisions = asArray<string>(policy.key_provisions);
  const policyText = lowerText(policy.summary, provisions, profile.narrative_summary);
  const score =
    (policy.has_acceptable_use_policy ? 1 : 0) +
    (policy.addresses_data_privacy ? 1 : 0) +
    (policy.addresses_regulatory_compliance ? 1 : 0) +
    (policy.addresses_ethics ? 1 : 0) +
    (policy.syllabus_level_required ? 1 : 0);
  const classroom_authority_model = /faculty discretion|faculty.*decide|instructor.*discretion|course-level|syllabus/.test(
    policyText,
  )
    ? "faculty_discretion"
    : /central|university-wide|required|must not|prohibit/.test(policyText)
      ? "centralized_rules"
      : /committee|department|school|college/.test(policyText)
        ? "mixed"
        : "unclear";
  const ai_detection_stance = /disable(?:d)? turnitin|does not endorse|cannot rely solely|not.*solely.*detector|false positive/.test(
    policyText,
  )
    ? "rejects_or_limits_detection"
    : /requires?.*detector|mandatory.*detector/.test(policyText)
      ? "requires_detection"
      : /ai detector|turnitin|detection/.test(policyText)
        ? "permits_detection"
        : "unclear";

  return {
    score_0_5: Math.min(5, score),
    has_syllabus_guidance: Boolean(policy.syllabus_level_required || /syllabus/.test(policyText)),
    addresses_privacy: Boolean(policy.addresses_data_privacy),
    addresses_regulatory_compliance: Boolean(policy.addresses_regulatory_compliance),
    addresses_ethics: Boolean(policy.addresses_ethics),
    adopted_date: policy.adopted_date ?? null,
    classroom_authority_model,
    ai_detection_stance,
  };
}

function academicReality(profile: AnyRecord) {
  const subcategories = {
    ai_literacy_requirement: initiativeSubcategoryCount(profile, "ai_literacy_requirement"),
    ai_resilient_assessment: initiativeSubcategoryCount(profile, "ai_resilient_assessment"),
    faculty_training_and_development: initiativeSubcategoryCount(profile, "faculty_training_and_development"),
    ai_tutoring_and_adaptive_learning: initiativeSubcategoryCount(profile, "ai_tutoring_and_adaptive_learning"),
    lms_embedded_ai: initiativeSubcategoryCount(profile, "lms_embedded_ai"),
    ai_degree_program: initiativeSubcategoryCount(profile, "ai_degree_program"),
    syllabus_level_policy: initiativeSubcategoryCount(profile, "syllabus_level_policy"),
  };

  return {
    teaching_learning_signal_count: initiativeCategoryCount(profile, "teaching_and_learning"),
    ai_program_count: asArray(profile.ai_academic_programs).length,
    has_ai_literacy_requirement: subcategories.ai_literacy_requirement > 0,
    has_assessment_redesign: subcategories.ai_resilient_assessment > 0,
    has_faculty_development: subcategories.faculty_training_and_development > 0,
    has_ai_degree_or_certificate:
      subcategories.ai_degree_program > 0 ||
      asArray<AnyRecord>(profile.ai_academic_programs).some((program) =>
        ["degree", "certificate", "minor", "concentration"].includes(program.type),
      ),
    subcategory_counts: subcategories,
  };
}

function researchEnterprise(profile: AnyRecord) {
  const compute = profile.computing_infrastructure ?? {};
  const gpuCount = typeof compute.gpu_count === "number" ? compute.gpu_count : null;
  const capacity_tier = !compute.has_dedicated_ai_compute
    ? "none"
    : gpuCount === null
      ? compute.supercomputer_name
        ? "named_system_capacity_unknown"
        : "dedicated_compute_capacity_unknown"
      : gpuCount >= 100
        ? "advanced_hpc_disclosed"
        : gpuCount >= 20
          ? "gpu_cluster_disclosed"
          : "modest_gpu_disclosed";
  const investmentValues = [
    ...asArray<AnyRecord>(profile.investments_and_gifts),
    ...asArray<AnyRecord>(profile.initiatives).map((initiative) => ({
      amount_usd: initiative.investment?.amount_usd,
      source: initiative.investment?.funding_source,
      purpose: initiative.investment?.description,
      title: initiative.title,
    })),
  ].filter((item) => item.amount_usd || item.source || item.purpose || item.title);
  const fundingBuckets = countBy(investmentValues.map(fundingBucket));

  return {
    research_center_count: asArray(profile.research_centers).length,
    scientific_discovery_signal_count: initiativeSubcategoryCount(profile, "ai_for_scientific_discovery"),
    computing_infrastructure_signal_count: initiativeSubcategoryCount(profile, "computing_infrastructure"),
    compute: {
      has_dedicated_ai_compute: Boolean(compute.has_dedicated_ai_compute),
      supercomputer_name: compute.supercomputer_name ?? null,
      gpu_count: gpuCount,
      capacity_tier,
    },
    disclosed_funding_usd: totalDisclosedUsd(profile),
    funding_source_buckets: fundingBuckets,
    partnership_count: asArray(profile.industry_and_research_partnerships).length,
  };
}

function studentImpact(profile: AnyRecord) {
  const studentFacing = asArray<AnyRecord>(profile.student_facing_ai);
  const serviceTypeCounts = countBy(studentFacing.map((item) => item.type || "other"));
  const studentInitiatives = asArray<AnyRecord>(profile.initiatives).filter((initiative) =>
    asArray<string>(initiative.stakeholder_impact).includes("students"),
  );
  const studentOutcomeClaimCount = studentInitiatives.filter((initiative) =>
    OUTCOME_PATTERNS.some(({ pattern }) =>
      pattern.test(
        lowerText(initiative.title, initiative.description, initiative.significance, initiative.policy_implications),
      ),
    ),
  ).length;

  return {
    student_facing_tool_count: studentFacing.length,
    service_type_counts: serviceTypeCounts,
    student_experience_signal_count: initiativeCategoryCount(profile, "student_experience_and_services"),
    has_advising_ai: serviceTypeCounts.advisor > 0 || /advising|advisor/.test(lowerText(studentFacing)),
    has_retention_analytics: initiativeSubcategoryCount(profile, "predictive_analytics_retention") > 0,
    has_enrollment_admissions_ai: initiativeSubcategoryCount(profile, "ai_in_admissions_and_enrollment") > 0,
    has_career_readiness_ai: initiativeSubcategoryCount(profile, "career_and_workforce_readiness") > 0,
    has_mental_health_wellbeing_ai: initiativeSubcategoryCount(profile, "mental_health_and_wellbeing") > 0,
    has_accessibility_or_equity_signal:
      asArray(profile.equity_and_access_initiatives).length > 0 ||
      initiativeCategoryCount(profile, "equity_access_and_inclusion") > 0,
    public_student_outcome_claim_count: studentOutcomeClaimCount,
  };
}

function valueAndOutcomes(profile: AnyRecord) {
  const claims: Array<{ claim_type: string; title: string; summary: string; source_url: string | null }> = [];
  for (const initiative of asArray<AnyRecord>(profile.initiatives)) {
    const text = lowerText(initiative.title, initiative.description, initiative.significance, initiative.policy_implications);
    const match = OUTCOME_PATTERNS.find(({ pattern }) => pattern.test(text));
    if (!match) continue;
    claims.push({
      claim_type: match.type,
      title: initiative.title ?? "Untitled initiative",
      summary: initiative.significance || initiative.description || "",
      source_url: asArray<string>(initiative.source_urls)[0] ?? null,
    });
  }

  return {
    has_usage_metrics:
      asArray<AnyRecord>(profile.enterprise_platforms).some((platform) => typeof platform.user_count === "number") ||
      claims.some((claim) => claim.claim_type === "usage"),
    has_cost_or_productivity_claim: claims.some((claim) =>
      ["productivity", "cost_or_revenue"].includes(claim.claim_type),
    ),
    has_learning_outcome_claim: claims.some((claim) => claim.claim_type === "learning"),
    has_student_success_outcome_claim: claims.some((claim) => claim.claim_type === "student_success"),
    has_research_output_claim: claims.some((claim) => claim.claim_type === "research_output"),
    public_claims: claims.slice(0, 12),
    public_claim_count: claims.length,
  };
}

function riskReadiness(profile: AnyRecord, policyScore: number, studentSignals: ReturnType<typeof studentImpact>) {
  const initiatives = asArray<AnyRecord>(profile.initiatives);
  const risk_signal_count = initiatives.filter((initiative) =>
    RISK_PATTERN.test(lowerText(initiative.title, initiative.description, initiative.policy_implications)),
  ).length;
  const control_signal_count =
    initiatives.filter((initiative) =>
      CONTROL_PATTERN.test(lowerText(initiative.title, initiative.description, initiative.policy_implications)),
    ).length +
    (profile.ai_policy?.addresses_data_privacy ? 1 : 0) +
    (profile.ai_policy?.addresses_regulatory_compliance ? 1 : 0) +
    (profile.ai_policy?.addresses_ethics ? 1 : 0);
  const high_impact_student_use =
    studentSignals.has_retention_analytics ||
    studentSignals.has_enrollment_admissions_ai ||
    studentSignals.has_mental_health_wellbeing_ai ||
    studentSignals.has_advising_ai;
  const sensitive_data_risk_signal = /ferpa|hipaa|student data|patient|health|privacy|confidential|sensitive data/i.test(
    sourceProfileText(profile),
  );
  const risk_level =
    high_impact_student_use && (policyScore < 3 || control_signal_count < 3)
      ? "high"
      : (risk_signal_count > 0 || high_impact_student_use || sensitive_data_risk_signal) && policyScore < 4
        ? "medium"
        : risk_signal_count > 0 || sensitive_data_risk_signal
          ? "managed"
          : "low_public_signal";

  return {
    high_impact_student_use,
    sensitive_data_risk_signal,
    risk_signal_count,
    control_signal_count,
    risk_level,
    rationale:
      risk_level === "high"
        ? "High-impact student use is visible while public control signals are comparatively thin."
        : risk_level === "medium"
          ? "Risk-bearing AI signals are visible, but public policy/control depth is incomplete."
          : risk_level === "managed"
            ? "Risk-bearing AI signals are paired with multiple public policy/control indicators."
            : "Few public high-risk use cases were found in the profile.",
  };
}

function dataGaps(profile: AnyRecord, valueSignals: ReturnType<typeof valueAndOutcomes>) {
  const gaps = asArray<string>(profile.research_quality?.gaps_acknowledged);
  const gapText = lowerText(gaps);
  const platformUserCounts = asArray<AnyRecord>(profile.enterprise_platforms).filter(
    (platform) => typeof platform.user_count === "number",
  ).length;
  const gapTypes: string[] = [];

  if (valueSignals.public_claim_count === 0 && platformUserCounts === 0) {
    gapTypes.push("outcomes_or_usage");
  }
  if (!platformUserCounts || /license|contract|user count|adoption metric|usage/.test(gapText)) {
    gapTypes.push("platform_usage_or_contracts");
  }
  if (totalDisclosedUsd(profile) === 0 || /dollar|cost|budget|funding|investment/.test(gapText)) {
    gapTypes.push("cost_or_funding");
  }
  if (!profile.computing_infrastructure?.gpu_count || /gpu|compute|capacity|infrastructure/.test(gapText)) {
    gapTypes.push("compute_capacity");
  }
  if (!initiativeSubcategoryCount(profile, "ai_resilient_assessment")) {
    gapTypes.push("assessment_redesign");
  }
  if (!/first-gen|low-income|disabled|international|subgroup|equity outcome/i.test(sourceProfileText(profile))) {
    gapTypes.push("student_subgroup_impact");
  }

  return {
    gap_types: Array.from(new Set(gapTypes)).sort(),
    explicit_gap_count: gaps.length,
    notes: gaps.slice(0, 10),
  };
}

function strategicArchetype(
  profile: AnyRecord,
  academic: ReturnType<typeof academicReality>,
  research: ReturnType<typeof researchEnterprise>,
  student: ReturnType<typeof studentImpact>,
  vendor: ReturnType<typeof vendorExposure>,
  policy: ReturnType<typeof policyQuality>,
) {
  const scores: Record<(typeof ARCHETYPES)[number], number> = {
    platform_first:
      asArray(profile.enterprise_platforms).length * 2 +
      initiativeSubcategoryCount(profile, "campus_wide_platform_rollout") * 2 +
      initiativeSubcategoryCount(profile, "ai_vendor_partnership") +
      (vendor.concentration !== "none" ? 1 : 0),
    research_compute_powerhouse:
      research.research_center_count +
      research.scientific_discovery_signal_count * 2 +
      (research.compute.capacity_tier === "advanced_hpc_disclosed" ? 6 : 0) +
      (research.compute.capacity_tier === "gpu_cluster_disclosed" ? 3 : 0) +
      (research.compute.has_dedicated_ai_compute ? 2 : 0),
    curriculum_led:
      academic.ai_program_count +
      academic.subcategory_counts.ai_degree_program * 2 +
      academic.subcategory_counts.faculty_training_and_development +
      academic.subcategory_counts.ai_literacy_requirement,
    governance_led:
      (profile.governance_structure?.has_governance_body ? 4 : 0) +
      policy.score_0_5 +
      initiativeCategoryCount(profile, "governance_and_policy"),
    student_success_led:
      student.student_facing_tool_count +
      student.student_experience_signal_count * 2 +
      (student.has_retention_analytics ? 3 : 0) +
      (student.has_advising_ai ? 2 : 0),
    workforce_regional_development:
      initiativeCategoryCount(profile, "workforce_and_economic_development") * 2 +
      initiativeSubcategoryCount(profile, "regional_economic_impact") * 2 +
      initiativeSubcategoryCount(profile, "industry_certification_pathway"),
    balanced_enterprise: 0,
    public_signal_thin: asArray(profile.initiatives).length < 6 ? 6 : 0,
  };
  const activeDomains = [
    scores.platform_first >= 7,
    scores.research_compute_powerhouse >= 8,
    scores.curriculum_led >= 7,
    scores.governance_led >= 8,
    scores.student_success_led >= 7,
    scores.workforce_regional_development >= 7,
  ].filter(Boolean).length;
  scores.balanced_enterprise = activeDomains >= 4 ? 12 + activeDomains : 0;

  const ranked = Object.entries(scores)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .filter(([, score]) => score > 0);
  const primary = (ranked[0]?.[0] ?? "public_signal_thin") as (typeof ARCHETYPES)[number];
  const secondary = ranked
    .slice(1, 4)
    .map(([key]) => key)
    .filter((key) => key !== "public_signal_thin");

  return {
    primary,
    secondary,
    scores,
    rationale: `Primary archetype selected from visible public signals: ${primary.replaceAll("_", " ")}.`,
  };
}

export function computeAnalyticsSignals(profile: AnyRecord) {
  const policy = policyQuality(profile);
  const academic = academicReality(profile);
  const research = researchEnterprise(profile);
  const student = studentImpact(profile);
  const vendor = vendorExposure(profile);
  const value = valueAndOutcomes(profile);
  const risk = riskReadiness(profile, policy.score_0_5, student);
  const gaps = dataGaps(profile, value);
  const archetype = strategicArchetype(profile, academic, research, student, vendor, policy);

  return {
    schema_version: "2026-04-23",
    strategic_archetype: archetype,
    policy_quality: policy,
    academic_reality: academic,
    research_enterprise: research,
    student_impact: student,
    vendor_exposure: vendor,
    value_and_outcomes: value,
    risk_readiness: risk,
    data_gaps: gaps,
  };
}
