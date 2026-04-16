/**
 * Insight Extraction Schema for the AI-in-Higher-Ed Trend Reporting Pipeline
 *
 * This schema defines the structured output of the LLM extraction step.
 * It transforms raw Yutori scout HTML (100 updates, 119 days, ~290K chars)
 * into typed data that feeds McKinsey/Meeker-level trend reports.
 *
 * Key design decisions:
 *
 * 1. LLM-first extraction: Only 35% of updates use the structured em-dash
 *    format ("Institution -- Title: Description"). The other 65% are narrative
 *    paragraphs. Every field in ExtractedInsight must be extractable by a
 *    Claude agent from either format. Fields use bounded enums where possible
 *    to constrain LLM output and improve reliability.
 *
 * 2. Report-ready: The five analytical frameworks from the report structure
 *    (Geographic Adoption Index, Initiative Diversity Index, AI Maturity Score,
 *    Policy Readiness Index, Trend Momentum Score) are directly computable
 *    from the typed fields without additional LLM calls.
 *
 * 3. Provenance: Every insight links back to its source update and tracks
 *    extraction confidence so the pipeline can flag items for human review.
 *
 * 4. Alignment with existing code: The 5 CATEGORY_LABELS in yutori.ts
 *    ("Governance & Policy", "Research", "Curriculum & Training",
 *    "Partnerships", "Operations & Tools") map into the 8-category taxonomy
 *    defined here. The schema extends, not replaces, the existing parser.
 *
 * References:
 *   - research/trend-landscape.md  (8-category taxonomy, maturity model)
 *   - research/data-analysis.md    (data shape, parsing gaps)
 *   - research/report-structure.md (5 analytical frameworks, report sections)
 *   - src/lib/yutori.ts            (existing ParsedInitiative, ParsedUpdate)
 */

// ============================================================================
// SECTION 1: Enumerated dimensions
// ============================================================================

// -- 1a. Trend taxonomy (from trend-landscape.md) ----------------------------

export const TREND_CATEGORIES = [
  "governance_and_policy",
  "teaching_and_learning",
  "research_and_innovation",
  "student_experience_and_services",
  "enterprise_tools_and_infrastructure",
  "workforce_and_economic_development",
  "equity_access_and_inclusion",
  "institutional_transformation",
] as const;

export type TrendCategory = (typeof TREND_CATEGORIES)[number];

/**
 * Maps each category to its sub-categories.
 * These are the finest-grained classification labels the LLM should assign.
 */
export const TREND_SUBCATEGORIES = {
  governance_and_policy: [
    "acceptable_use_policy",
    "institutional_ai_strategy",
    "ai_ethics_framework",
    "regulatory_compliance",
    "data_privacy_and_security",
    "syllabus_level_policy",
  ],
  teaching_and_learning: [
    "ai_literacy_requirement",
    "ai_enhanced_pedagogy",
    "ai_resilient_assessment",
    "ai_tutoring_and_adaptive_learning",
    "faculty_training_and_development",
    "ai_in_specific_disciplines",
    "ai_degree_program",
  ],
  research_and_innovation: [
    "ai_research_center",
    "industry_academic_partnership",
    "ai_for_scientific_discovery",
    "computing_infrastructure",
    "open_source_contribution",
    "cross_border_research_alliance",
  ],
  student_experience_and_services: [
    "ai_chatbot_or_virtual_assistant",
    "predictive_analytics_retention",
    "ai_in_admissions_and_enrollment",
    "personalized_student_support",
    "career_and_workforce_readiness",
    "mental_health_and_wellbeing",
  ],
  enterprise_tools_and_infrastructure: [
    "campus_wide_platform_rollout",
    "lms_embedded_ai",
    "ai_vendor_partnership",
    "data_infrastructure_and_unification",
    "ai_powered_admin_tools",
    "cybersecurity_and_ai_risk",
  ],
  workforce_and_economic_development: [
    "ai_workforce_training",
    "ai_incubator_or_startup_support",
    "industry_certification_pathway",
    "community_college_ai_program",
    "continuing_and_executive_education",
    "regional_economic_impact",
  ],
  equity_access_and_inclusion: [
    "digital_divide_and_access",
    "ai_tool_equity",
    "algorithmic_bias",
    "multilingual_and_culturally_responsive_ai",
    "disability_and_accessibility",
    "underrepresented_student_support",
  ],
  institutional_transformation: [
    "business_model_disruption",
    "ai_and_degree_value",
    "liberal_arts_in_ai_era",
    "institutional_restructuring",
    "ai_native_institution",
    "faculty_role_evolution",
  ],
} as const;

export type TrendSubcategory =
  (typeof TREND_SUBCATEGORIES)[TrendCategory][number];

/**
 * Maps old yutori.ts CATEGORY_LABELS to the 8-category taxonomy.
 * Used during migration from the existing parser output.
 */
export const LEGACY_CATEGORY_MAP: Record<string, TrendCategory> = {
  "Governance & Policy": "governance_and_policy",
  "Research": "research_and_innovation",
  "Curriculum & Training": "teaching_and_learning",
  "Partnerships": "research_and_innovation", // partnerships span categories; default to research
  "Operations & Tools": "enterprise_tools_and_infrastructure",
};

// -- 1b. Maturity & adoption signals -----------------------------------------

export type TrendMaturity = "emerging" | "growing" | "mainstream" | "declining";

/**
 * Adoption stage of the specific initiative, not the broader trend.
 * Distinguishes what the institution is doing from where the sector is.
 */
export type AdoptionStage =
  | "announcement"   // Intent declared, nothing operational yet
  | "pilot"          // Small-scale trial or proof of concept
  | "scaling"        // Expanding from pilot to broader use
  | "operational"    // Running in production, integrated into workflows
  | "transformative"; // Fundamentally reshaping how the institution operates

// -- 1c. Institution classification ------------------------------------------

export type InstitutionType =
  | "r1_research"
  | "r2_research"
  | "comprehensive_regional"
  | "liberal_arts"
  | "community_college"
  | "online_for_profit"
  | "professional_school"     // Law, medicine, business
  | "minority_serving"        // HBCU, HSI, tribal
  | "international"
  | "system_or_consortium"    // Multi-institution entity (SUNY, UC, Big Ten)
  | "unknown";

// -- 1d. Geography -----------------------------------------------------------

export type GeographicRegion =
  | "us_northeast"
  | "us_southeast"
  | "us_midwest"
  | "us_west"
  | "us_national"             // System-wide or federal scope
  | "canada"
  | "united_kingdom"
  | "european_union"
  | "china"
  | "south_korea"
  | "japan"
  | "india"
  | "southeast_asia"          // Singapore, Philippines, Indonesia, etc.
  | "australia_nz"
  | "latin_america"
  | "middle_east"
  | "sub_saharan_africa"
  | "multi_region"
  | "unknown";

// -- 1e. Investment ----------------------------------------------------------

export type InvestmentScale =
  | "major"        // >$10M: endowments, data centers, supercomputers
  | "significant"  // $1M-$10M: center launches, enterprise licenses
  | "moderate"     // $100K-$1M: pilots, MOUs, grants
  | "exploratory"  // <$100K: task forces, workshops, guidelines
  | "unknown";

// -- 1f. Collaboration -------------------------------------------------------

export type CollaborationPattern =
  | "industry_academic"       // Tech company + university
  | "cross_institution"       // Multi-university consortia
  | "international"           // Cross-border partnerships
  | "government_academic"     // Federal/state agency + university
  | "community_academic"      // Local economic development
  | "startup_academic"        // Incubators, commercialization
  | "none";

// -- 1g. Technology focus ----------------------------------------------------

export type TechnologyFocus =
  | "large_language_models"
  | "generative_ai_multimodal"
  | "predictive_analytics_ml"
  | "agentic_ai"
  | "ai_search_and_retrieval"
  | "computer_vision"
  | "nlp_for_assessment"
  | "robotics_and_physical_ai"
  | "quantum_and_ai"
  | "general_ai"              // AI referenced broadly, no specific tech
  | "unspecified";

// -- 1h. Stakeholder impact --------------------------------------------------

export type StakeholderGroup =
  | "students"
  | "faculty"
  | "administrators"
  | "researchers"
  | "board_and_trustees"
  | "accreditors"
  | "government_and_regulators"
  | "employers"
  | "community";

// -- 1i. Policy stance -------------------------------------------------------

/** Where the initiative falls on the policy spectrum. */
export type PolicyStance =
  | "prohibitive"         // Banning or restricting AI use
  | "cautious"            // Allowing with significant constraints
  | "permissive"          // Encouraging with basic guardrails
  | "comprehensive"       // Full governance framework with ethics, risk, etc.
  | "not_applicable";     // Initiative has no policy dimension

// -- 1j. Extraction quality --------------------------------------------------

/** How the initiative was found in the source HTML. */
export type ExtractionMethod =
  | "structured_bullet"   // Parsed from em-dash format (<b>Inst</b> -- Title)
  | "narrative_paragraph"  // Extracted by LLM from <p> narrative
  | "table_row"           // Extracted from <table> / <tr> structure
  | "section_header"      // Inferred from category section + list items
  | "citation_enriched";  // Reconstructed from citation preview_data

// ============================================================================
// SECTION 2: Component types (building blocks for ExtractedInsight)
// ============================================================================

/** A single institution mentioned in an initiative. */
export type InstitutionProfile = {
  /** Institution name as it appears in the source. */
  name: string;
  /** Normalized institution type for analytical slicing. */
  type: InstitutionType;
  /** Geographic region. */
  region: GeographicRegion;
  /** US state abbreviation or ISO country code when identifiable. */
  location: string | null;
  /** University system membership if applicable (e.g., "SUNY", "UC", "UMass"). */
  system: string | null;
};

/** Monetary or resource commitment details when mentioned. */
export type InvestmentSignal = {
  /** Investment scale bucket. */
  scale: InvestmentScale;
  /** Dollar amount if stated (normalized to USD). Null when not disclosed. */
  amountUsd: number | null;
  /** Raw amount string as it appeared in text (e.g., "Rs 23 crore", "$24.6M"). */
  rawAmountText: string | null;
  /** What the investment is for. */
  description: string;
  /** Source of funding when mentioned (e.g., "alumni gift", "NSF grant"). */
  fundingSource: string | null;
};

/** A partnership or collaboration extracted from the initiative. */
export type CollaborationDetail = {
  /** Type of collaboration pattern. */
  pattern: CollaborationPattern;
  /** Partner names (companies, institutions, government agencies). */
  partners: string[];
  /** Nature of the collaboration. */
  description: string;
};

/** Named product, platform, or vendor mentioned in the initiative. */
export type ToolOrVendorMention = {
  /** Product or tool name (e.g., "Google Gemini", "D2L Lumi Pro"). */
  name: string;
  /** The vendor/company behind it (e.g., "Google", "D2L"). */
  vendor: string;
  /** How it's being used (e.g., "campus-wide LLM access", "AI-generated assessments"). */
  role: string;
};

/** Extraction provenance — how and how well this insight was extracted. */
export type ExtractionProvenance = {
  /** How the initiative was located in the HTML. */
  method: ExtractionMethod;
  /**
   * Confidence that the extraction is correct (0.0-1.0).
   * structured_bullet -> typically 0.9+
   * narrative_paragraph -> typically 0.6-0.8
   * citation_enriched -> typically 0.5-0.7
   */
  confidence: number;
  /** The raw HTML snippet that was extracted from (for debugging/audit). */
  rawHtml: string;
};

// ============================================================================
// SECTION 3: ExtractedInsight — the core per-initiative type
// ============================================================================

/**
 * A single structured insight extracted from a Yutori scout update.
 *
 * One per initiative. The LLM extraction agent produces an array of these
 * from each update's HTML content. Fields are ordered from most to least
 * reliably extractable — the LLM should always fill identity + basics,
 * and make best-effort on analytical dimensions.
 */
export type ExtractedInsight = {
  // -- Identity (always populated) -----------------------------------------

  /** Unique ID: `{updateId}_{index}` */
  id: string;
  /** ID of the parent Yutori update. */
  updateId: string;
  /** Unix timestamp (ms) from the parent update. */
  timestamp: number;
  /** ISO 8601 date string (YYYY-MM-DD). */
  date: string;

  // -- Initiative basics (always populated) --------------------------------

  /** Short initiative title (max ~100 chars). */
  title: string;
  /** One-paragraph description of what happened. */
  description: string;
  /** One sentence on why this matters for the sector. */
  significance: string;

  // -- Institutional context -----------------------------------------------

  /** Primary institution(s) involved. At least one. */
  institutions: InstitutionProfile[];

  // -- Trend classification ------------------------------------------------

  /** Primary trend category from the 8-category taxonomy. */
  primaryCategory: TrendCategory;
  /** Secondary categories when the initiative spans multiple areas. */
  secondaryCategories: TrendCategory[];
  /** Specific sub-categories within the primary and secondary categories. */
  subcategories: TrendSubcategory[];
  /** Where does this type of initiative sit on the sector adoption curve? */
  maturitySignal: TrendMaturity;
  /** What stage is THIS specific initiative at? */
  adoptionStage: AdoptionStage;

  // -- Analytical dimensions -----------------------------------------------

  /** Technology focus areas relevant to this initiative. */
  technologyFocus: TechnologyFocus[];
  /** Which stakeholder groups are most affected. */
  stakeholderImpact: StakeholderGroup[];
  /** Investment/resource signals. Null if no financial signals present. */
  investmentSignal: InvestmentSignal | null;
  /** Collaboration details. Empty array if no collaboration involved. */
  collaborations: CollaborationDetail[];
  /** Named tools, platforms, or vendors. Empty array if none mentioned. */
  toolsAndVendors: ToolOrVendorMention[];

  // -- Policy & governance signals -----------------------------------------

  /** Where the initiative falls on the policy spectrum. */
  policyStance: PolicyStance;
  /** Brief description of policy/governance implications, if any. */
  policyImplications: string | null;
  /**
   * Is this a policy/statement (true) or a concrete implementation (false)?
   * Feeds the Policy vs. Practice gap analysis in the report.
   */
  isPolicyVsPractice: "policy" | "practice" | "both";

  // -- Provenance ----------------------------------------------------------

  /** Source URLs from the original update. */
  sourceUrls: string[];
  /** Header image URL if available. */
  imageUrl: string | null;
  /** Extraction quality metadata. */
  extraction: ExtractionProvenance;
};

// ============================================================================
// SECTION 4: Update-level aggregation (per-period)
// ============================================================================

/**
 * Aggregated insights for a single Yutori update (one reporting period).
 * Produced after all ExtractedInsights for the update are collected.
 */
export type UpdateInsightBundle = {
  /** Yutori update ID. */
  updateId: string;
  /** Unix timestamp (ms). */
  timestamp: number;
  /** Report period title from the <h3> header. */
  periodTitle: string;
  /** Date range this update covers (e.g., "April 14-15, 2026"). */
  periodRange: string;

  /** All extracted insights for this period. */
  insights: ExtractedInsight[];

  // -- Period-level LLM-generated analysis ---------------------------------

  /** 2-3 sentence digest suitable for the Executive Dashboard. */
  periodSummary: string;
  /** Key themes or patterns observed across this period's initiatives. */
  periodThemes: string[];
  /** Notable trend shifts, accelerations, or new signals. */
  trendSignals: string[];
  /** Cross-cutting tensions surfaced in this period's data. */
  tensionsObserved: string[];

  // -- Distributions (computed from insights, not LLM-generated) -----------

  /** Initiative count by category. */
  categoryBreakdown: Partial<Record<TrendCategory, number>>;
  /** Initiative count by region. */
  regionBreakdown: Partial<Record<GeographicRegion, number>>;
  /** Initiative count by institution type. */
  institutionTypeBreakdown: Partial<Record<InstitutionType, number>>;
  /** Initiative count by technology focus. */
  technologyBreakdown: Partial<Record<TechnologyFocus, number>>;
  /** Policy vs. practice ratio for this period. */
  policyVsPracticeRatio: { policy: number; practice: number; both: number };

  // -- Raw update metadata -------------------------------------------------

  /** Seconds saved metric from Yutori stats. */
  secondsSaved: number;
  /** Number of citations in the raw update. */
  citationCount: number;
  /** Total initiatives extracted (may differ from parsed initiatives). */
  extractedInitiativeCount: number;
  /** How many used structured_bullet vs other extraction methods. */
  extractionMethodBreakdown: Partial<Record<ExtractionMethod, number>>;
};

// ============================================================================
// SECTION 5: Cross-period trend analysis
// ============================================================================

/** A detected trend across multiple reporting periods. */
export type TrendLine = {
  /** Trend identifier slug (e.g., "campus_wide_google_gemini_deployments"). */
  id: string;
  /** Human-readable trend name. */
  name: string;
  /** Primary category this trend belongs to. */
  category: TrendCategory;
  /** Current maturity assessment. */
  maturity: TrendMaturity;
  /** Direction of change over the observation window. */
  direction: "accelerating" | "steady" | "decelerating" | "emerging";
  /** Number of initiatives contributing to this trend. */
  initiativeCount: number;
  /** Number of unique institutions involved. */
  institutionCount: number;
  /** Number of unique regions involved. */
  regionCount: number;
  /** ISO date of first observed signal. */
  firstSeen: string;
  /** ISO date of most recent signal. */
  lastSeen: string;
  /** IDs of contributing insights. */
  insightIds: string[];
  /** One-paragraph narrative of the trend (Meeker data->insight->implication). */
  narrative: string;
  /** Trend Momentum Score inputs (feeds Section 7 of the report). */
  momentumInputs: TrendMomentumInputs;
};

/** A tension or debate surfaced by conflicting signals in the data. */
export type DetectedTension = {
  /** Short label (e.g., "Academic integrity vs. AI integration"). */
  label: string;
  /** Narrative description of the tension and why it matters. */
  description: string;
  /** Insight IDs representing one side of the tension. */
  sideA: { label: string; insightIds: string[] };
  /** Insight IDs representing the other side. */
  sideB: { label: string; insightIds: string[] };
  /** How acute is this tension right now? */
  intensity: "high" | "medium" | "low";
  /** Which category or categories this tension spans. */
  categories: TrendCategory[];
};

// ============================================================================
// SECTION 6: Analytical frameworks (report-structure.md Section mappings)
// ============================================================================

// -- 6a. Geographic Adoption Index (Report Section 2) ------------------------
//    Composite score 0-100 per region.

/** Inputs for computing the Geographic Adoption Index for one region. */
export type GeographicAdoptionInputs = {
  region: GeographicRegion;
  /** Total initiative count from this region. */
  initiativeCount: number;
  /** Number of unique categories represented. */
  categoryDiversity: number;
  /** Number of initiatives with policyStance !== "not_applicable". */
  policyInitiativeCount: number;
  /** Number of initiatives at "operational" or "transformative" adoption stage. */
  matureInitiativeCount: number;
  /** Number of initiatives with investmentSignal !== null. */
  investmentSignalCount: number;
  /** Sum of known investment amounts (USD). */
  totalKnownInvestmentUsd: number;
  /** Number of unique institutions in the region. */
  institutionCount: number;
  /** Number of cross-border collaborations originating here. */
  internationalCollaborationCount: number;
};

// -- 6b. Initiative Diversity Index (Report Section 3) -----------------------
//    Score 0-1 per institution. Breadth of adoption across the 8 categories.

/** Inputs for computing the Initiative Diversity Index for one institution. */
export type InitiativeDiversityInputs = {
  institution: string;
  /** Which of the 8 categories the institution has initiatives in. */
  categoriesPresent: TrendCategory[];
  /** Total initiative count. */
  initiativeCount: number;
  /** Score: categoriesPresent.length / TREND_CATEGORIES.length */
  diversityScore: number;
};

// -- 6c. AI Maturity Score (Report Section 4) --------------------------------
//    Level 1-5 per institution. Adapted from EAB/CMU/SEI models.

export const MATURITY_DIMENSIONS = [
  "strategy_and_leadership",
  "policy_and_governance",
  "teaching_and_curriculum",
  "research_infrastructure",
  "student_services",
  "workforce_and_community",
  "partnerships_and_ecosystem",
  "equity_and_inclusion",
] as const;

export type MaturityDimension = (typeof MATURITY_DIMENSIONS)[number];

export type MaturityLevel = 1 | 2 | 3 | 4 | 5;

/**
 * AI Maturity Score for a single institution.
 *
 * Level definitions (from trend-landscape.md):
 *   1 = Exploratory: ad hoc, no formal structures
 *   2 = Reactive: basic policies exist, initial workshops
 *   3 = Strategic: formal strategy, dedicated leadership, structured programs
 *   4 = Integrated: enterprise deployment, unified data, measurable outcomes
 *   5 = Transformative: AI-native, sector leadership, full interoperability
 */
export type InstitutionMaturityScore = {
  institution: string;
  institutionType: InstitutionType;
  region: GeographicRegion;
  /** Overall maturity level. */
  overallLevel: MaturityLevel;
  /** Per-dimension scores. Partial because not all dimensions may have evidence. */
  dimensions: Partial<Record<MaturityDimension, MaturityLevel>>;
  /** Insight IDs that contributed evidence to this score. */
  evidenceInsightIds: string[];
  /** When this score was last computed. */
  lastUpdated: string;
  /** How many data points (insights) informed the score. More = higher confidence. */
  dataPointCount: number;
};

// -- 6d. Policy Readiness Index (Report Section 5) ---------------------------
//    Score 0-100 per institution. Evaluates governance comprehensiveness.

/** Inputs for computing the Policy Readiness Index for one institution. */
export type PolicyReadinessInputs = {
  institution: string;
  /** Does the institution have a formal AI acceptable use policy? */
  hasAcceptableUsePolicy: boolean;
  /** Does the institution have an AI governance body (council, committee)? */
  hasGovernanceBody: boolean;
  /** Does the institution have an AI ethics framework? */
  hasEthicsFramework: boolean;
  /** Does the institution require syllabus-level AI policies? */
  requiresSyllabusPolicy: boolean;
  /** Does the institution address data privacy specifically for AI? */
  addressesDataPrivacy: boolean;
  /** Does the institution address regulatory compliance (EU AI Act, state laws)? */
  addressesRegulatoryCompliance: boolean;
  /** PolicyStance of the institution's most recent policy initiative. */
  latestPolicyStance: PolicyStance;
  /** Number of governance/policy initiatives tracked. */
  policyInitiativeCount: number;
  /** Computed score (0-100). */
  readinessScore: number;
};

// -- 6e. Trend Momentum Score (Report Section 7) -----------------------------
//    High/Medium/Low per trend. Predicts trajectory.

/** Inputs for computing the Trend Momentum Score for one trend. */
export type TrendMomentumInputs = {
  /**
   * Growth rate: initiatives in last 30 days vs. prior 30 days.
   * >1.0 = accelerating, 1.0 = steady, <1.0 = decelerating.
   */
  growthRate: number;
  /** Number of unique regions where this trend has been observed. */
  geographicSpread: number;
  /** Number of unique institution types adopting this trend. */
  adopterDiversity: number;
  /** Computed score. */
  momentum: "high" | "medium" | "low";
};

// ============================================================================
// SECTION 7: Top-level report data structure
// ============================================================================

/**
 * Complete extracted dataset for report generation.
 *
 * This is the final output of the extraction pipeline. It contains everything
 * needed to render all 8 sections of the trend report without additional
 * data fetching or LLM calls.
 */
export type TrendReportData = {
  // -- Pipeline metadata ---------------------------------------------------

  metadata: {
    /** ISO timestamp when extraction ran. */
    generatedAt: string;
    /** Yutori scout ID. */
    scoutId: string;
    /** Date range covered by the data. */
    coveragePeriod: { start: string; end: string };
    /** Total Yutori updates processed. */
    updateCount: number;
    /** Total non-updates in the period (for hit-rate calculation). */
    nonUpdateCount: number;
    /** Total insights extracted across all updates. */
    insightCount: number;
    /** Schema version for forward compatibility. */
    schemaVersion: "1.0.0";
    /** Average extraction confidence across all insights. */
    averageExtractionConfidence: number;
    /** Breakdown of extraction methods used. */
    extractionMethodBreakdown: Record<ExtractionMethod, number>;
  };

  // -- Per-period data (Section 1: Executive Dashboard inputs) --------------

  /** Per-period insight bundles, ordered newest-first. */
  updateBundles: UpdateInsightBundle[];

  // -- Cross-period analysis (Section 7: Predictions inputs) ----------------

  /** Detected trend lines across the full observation window. */
  trends: TrendLine[];
  /** Detected tensions and debates. */
  tensions: DetectedTension[];

  // -- Section 2: Global Adoption Landscape inputs --------------------------

  /** Geographic Adoption Index inputs, one per region with data. */
  geographicAdoption: GeographicAdoptionInputs[];

  // -- Section 3: Initiative Taxonomy inputs --------------------------------

  /** Initiative Diversity Index inputs, one per institution with data. */
  initiativeDiversity: InitiativeDiversityInputs[];

  // -- Section 4: Maturity Assessment inputs --------------------------------

  /** AI Maturity Scores, one per institution with sufficient data. */
  maturityScores: InstitutionMaturityScore[];

  // -- Section 5: Policy & Governance inputs --------------------------------

  /** Policy Readiness Index inputs, one per institution with policy data. */
  policyReadiness: PolicyReadinessInputs[];

  // -- Aggregate statistics (dashboard visualizations) ----------------------

  aggregates: {
    byCategory: Record<TrendCategory, number>;
    byRegion: Partial<Record<GeographicRegion, number>>;
    byInstitutionType: Partial<Record<InstitutionType, number>>;
    byTechnology: Partial<Record<TechnologyFocus, number>>;
    byMaturity: Record<TrendMaturity, number>;
    byAdoptionStage: Record<AdoptionStage, number>;
    byCollaboration: Partial<Record<CollaborationPattern, number>>;
    byInvestmentScale: Partial<Record<InvestmentScale, number>>;
    byPolicyStance: Partial<Record<PolicyStance, number>>;
    byExtractionMethod: Record<ExtractionMethod, number>;
    /** Policy vs. practice breakdown across all insights. */
    policyVsPractice: { policy: number; practice: number; both: number };
    /** Top institutions by initiative count. */
    topInstitutions: Array<{ name: string; type: InstitutionType; region: GeographicRegion; count: number }>;
    /** Top vendors/tools by mention count. */
    topVendors: Array<{ name: string; vendor: string; count: number }>;
    /** Top collaboration partners by mention count. */
    topPartners: Array<{ name: string; pattern: CollaborationPattern; count: number }>;
    /** Time series: initiatives per week for sparkline charts. */
    weeklyInitiativeCounts: Array<{ weekStart: string; count: number }>;
    /** Cumulative initiative count over time. */
    cumulativeTimeline: Array<{ date: string; cumulative: number }>;
  };
};
