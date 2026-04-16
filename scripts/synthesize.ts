/**
 * Synthesis pipeline: creates UpdateInsightBundles, TrendLines,
 * DetectedTensions, and InstitutionMaturityScores from extracted insights.
 *
 * Stage 1 — Update Synthesizer: groups insights by update, calls Claude to
 *           produce an UpdateInsightBundle per update.
 * Stage 2 — Trend Analyzer: takes all bundles, calls Claude to identify
 *           cross-period trends, tensions, and maturity scores.
 *
 * Uses the Agent SDK's `query()` with tools disabled and structured output
 * to get clean JSON back.
 */

import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import {
  getDb,
  initDb,
  closeDb,
  getAllInsights,
  upsertUpdateBundle,
  upsertTrendLine,
  logStage,
  getUnprocessedUpdates,
  getRawUpdate,
} from "./db";
import type Database from "better-sqlite3";
// Types are defined inline to avoid coupling to schema file location.
// Field names match the SQLite column conventions used in db.ts.

type TrendCategory = string;
type GeographicRegion = string;
type InstitutionType = string;

type ExtractedInsight = {
  id: string;
  updateId: string;
  timestamp: number;
  date: string;
  title: string;
  description: string;
  significance: string;
  institutions: Array<{ name: string; type: string; region: string; location: string | null; system: string | null }>;
  primaryCategory: string;
  secondaryCategories: string[];
  subcategories: string[];
  maturitySignal: string;
  technologyFocus: string[];
  stakeholderImpact: string[];
  investmentSignal: { scale: string; amountUsd: number | null; description: string; fundingSource: string | null } | null;
  collaborations: Array<{ pattern: string; partners: string[]; description: string }>;
  toolsAndVendors: Array<{ name: string; vendor: string; role: string }>;
  hasPolicyImplications: boolean;
  policyImplications: string | null;
  sourceUrls: string[];
  imageUrl: string | null;
};

type TrendLine = {
  id: string;
  name: string;
  category: string;
  maturity: string;
  direction: string;
  initiativeCount: number;
  firstSeen: string;
  lastSeen: string;
  insightIds: string[];
  narrative: string;
};

type DetectedTension = {
  label: string;
  description: string;
  sideA: string[];
  sideB: string[];
  intensity: "high" | "medium" | "low";
};

type InstitutionMaturityScore = {
  institution: string;
  overallLevel: number;
  dimensions: Record<string, number>;
  evidenceInsightIds: string[];
  lastUpdated: string;
  dataPointCount: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-6";
const CONCURRENCY = 3;

// ---------------------------------------------------------------------------
// Prompt templates (from research/agent-prompts.md)
// ---------------------------------------------------------------------------

const UPDATE_SYNTHESIZER_SYSTEM = `You are a senior higher education research analyst. Given a set of extracted insights from a single Yutori Scout update period, produce a synthesis bundle with period-level analysis.

Return a single JSON object matching the UpdateInsightBundle schema. Do NOT include the insights array in your response — only the metadata and analysis fields.

## Output Schema

Return a JSON object with these fields:
- "periodTitle": string — title from the update
- "periodRange": string — date range covered
- "periodSummary": string — 2-4 sentence executive summary following Data->Insight->Implication pattern
- "periodThemes": string[] — 2-4 concise theme statements identifying patterns across initiatives
- "trendSignals": string[] — notable shifts, accelerations, or emergences
- "categoryBreakdown": Record<TrendCategory, number> — count each insight once by primaryCategory
- "regionBreakdown": Record<GeographicRegion, number> — count each insight once by first institution's region
- "institutionTypeBreakdown": Record<InstitutionType, number> — count each insight once by first institution's type

## Category keys
governance_and_policy, teaching_and_learning, research_and_innovation, student_experience_and_services, enterprise_tools_and_infrastructure, workforce_and_economic_development, equity_access_and_inclusion, institutional_transformation

## Region keys
us_northeast, us_southeast, us_midwest, us_west, us_national, canada, united_kingdom, european_union, china, south_korea, japan, india, southeast_asia, australia_nz, latin_america, middle_east, sub_saharan_africa, multi_region, unknown

## Institution type keys
r1_research, r2_research, comprehensive_regional, liberal_arts, community_college, online_for_profit, professional_school, minority_serving, international, system_or_consortium, unknown

## Rules
1. categoryBreakdown counts each insight once by primaryCategory. Do NOT double-count secondary categories.
2. regionBreakdown counts each insight once by the region of its FIRST listed institution.
3. institutionTypeBreakdown counts each insight once by the type of its FIRST listed institution.
4. periodSummary must follow Data->Insight->Implication: state what happened, interpret what it means, indicate what to watch.
5. periodThemes should identify patterns ACROSS initiatives, not restate individual ones.
6. trendSignals should identify shifts or accelerations notable relative to prior periods.
7. All breakdown fields must include every key from the respective enum, even when count is 0.
8. Return ONLY valid JSON. No markdown, no commentary.`;

const TREND_ANALYZER_SYSTEM = `You are a senior research strategist producing cross-period trend analysis for an institutional-quality report on AI in higher education.

Analyze all update bundles to identify macro trends, tensions, and institutional maturity scores.

## Output Schema

Return a JSON object with three arrays:

{
  "trends": [TrendLine objects],
  "tensions": [DetectedTension objects],
  "maturityScores": [InstitutionMaturityScore objects]
}

### TrendLine
{
  "id": "snake_case_slug",
  "name": "Meeker-style insight headline (max 15 words, states a conclusion)",
  "category": "a TrendCategory value",
  "maturity": "emerging | growing | mainstream | declining",
  "direction": "accelerating | steady | decelerating | emerging",
  "initiativeCount": number,
  "firstSeen": "ISO date",
  "lastSeen": "ISO date",
  "insightIds": ["insight_id_1"],
  "narrative": "3-5 sentence Data->Insight->Implication narrative"
}

### DetectedTension
{
  "label": "Short label",
  "description": "2-3 sentence description",
  "sideA": ["insight_ids"],
  "sideB": ["insight_ids"],
  "intensity": "high | medium | low"
}

### InstitutionMaturityScore
{
  "institution": "Full name",
  "overallLevel": 1-5,
  "dimensions": {
    "strategy_and_leadership": 1-5,
    "policy_and_governance": 1-5,
    "teaching_and_curriculum": 1-5,
    "research_infrastructure": 1-5,
    "student_services": 1-5,
    "workforce_and_community": 1-5,
    "partnerships_and_ecosystem": 1-5,
    "equity_and_inclusion": 1-5
  },
  "evidenceInsightIds": ["insight_ids"],
  "lastUpdated": "ISO date",
  "dataPointCount": number
}

Maturity levels: 1=Exploratory, 2=Reactive, 3=Strategic, 4=Integrated, 5=Transformative

## Rules
1. Target 8-15 TrendLines, 3-6 tensions, 10-25 maturity scores.
2. A TrendLine must be supported by insights from at least 3 different update periods.
3. Only score institutions appearing in 3+ insights.
4. Maturity scores must be conservative: a single initiative rarely justifies above 2.
5. Every insightId must be a real ID from the input. Do not fabricate.
6. TrendLine names must state conclusions, not topics.
7. Return ONLY valid JSON. No markdown, no commentary.`;

// ---------------------------------------------------------------------------
// SDK helpers
// ---------------------------------------------------------------------------

const BASE_OPTIONS: Options = {
  model: MODEL,
  tools: [],
  permissionMode: "bypassPermissions",
  allowDangerouslySkipPermissions: true,
  persistSession: false,
  thinking: { type: "disabled" },
};

async function callClaude(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const q = query({
    prompt: userMessage,
    options: {
      ...BASE_OPTIONS,
      systemPrompt,
    },
  });

  let result = "";
  for await (const message of q) {
    if (message.type === "result" && message.subtype === "success") {
      result = message.result;
    }
  }
  return result;
}

function parseJsonResponse<T>(raw: string): T {
  // Strip markdown fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

// ---------------------------------------------------------------------------
// Insight hydration from SQLite rows
// ---------------------------------------------------------------------------

type InsightRow = {
  id: string;
  update_id: string;
  timestamp_ms: number;
  date: string;
  title: string;
  description: string;
  significance: string;
  institutions_json: string;
  primary_category: string;
  secondary_categories_json: string;
  subcategories_json: string;
  maturity_signal: string;
  technology_focus_json: string;
  stakeholder_impact_json: string;
  investment_signal_json: string | null;
  collaborations_json: string;
  tools_and_vendors_json: string;
  has_policy_implications: number;
  policy_implications: string | null;
  source_urls_json: string;
  image_url: string | null;
};

function rowToInsight(row: InsightRow): ExtractedInsight {
  return {
    id: row.id,
    updateId: row.update_id,
    timestamp: row.timestamp_ms,
    date: row.date,
    title: row.title,
    description: row.description,
    significance: row.significance,
    institutions: JSON.parse(row.institutions_json),
    primaryCategory: row.primary_category as TrendCategory,
    secondaryCategories: JSON.parse(row.secondary_categories_json),
    subcategories: JSON.parse(row.subcategories_json),
    maturitySignal: row.maturity_signal as any,
    technologyFocus: JSON.parse(row.technology_focus_json),
    stakeholderImpact: JSON.parse(row.stakeholder_impact_json),
    investmentSignal: row.investment_signal_json
      ? JSON.parse(row.investment_signal_json)
      : null,
    collaborations: JSON.parse(row.collaborations_json),
    toolsAndVendors: JSON.parse(row.tools_and_vendors_json),
    hasPolicyImplications: row.has_policy_implications === 1,
    policyImplications: row.policy_implications,
    sourceUrls: JSON.parse(row.source_urls_json),
    imageUrl: row.image_url,
  };
}

// ---------------------------------------------------------------------------
// Stage 1: Update Synthesizer
// ---------------------------------------------------------------------------

async function synthesizeUpdate(
  db: Database.Database,
  updateId: string,
  insights: ExtractedInsight[],
): Promise<void> {
  const rawUpdate = getRawUpdate(db, updateId);
  if (!rawUpdate) {
    console.error(`  [skip] No raw update found for ${updateId}`);
    return;
  }

  logStage(db, updateId, "aggregated", "running");

  const insightSummaries = insights.map((i) => ({
    id: i.id,
    title: i.title,
    primaryCategory: i.primaryCategory,
    secondaryCategories: i.secondaryCategories,
    institutions: i.institutions.map((inst) => ({
      name: inst.name,
      type: inst.type,
      region: inst.region,
    })),
    maturitySignal: i.maturitySignal,
    significance: i.significance,
  }));

  const userMessage = `Synthesize this update's insights into an UpdateInsightBundle.

Update ID: ${updateId}
Update timestamp: ${rawUpdate.timestamp_ms}
Update HTML title context (first 500 chars): ${rawUpdate.content_html.slice(0, 500)}

Extracted insights (${insights.length} total):
${JSON.stringify(insightSummaries, null, 2)}`;

  try {
    const raw = await callClaude(UPDATE_SYNTHESIZER_SYSTEM, userMessage);
    const bundle = parseJsonResponse<{
      periodTitle: string;
      periodRange: string;
      periodSummary: string;
      periodThemes: string[];
      trendSignals: string[];
      categoryBreakdown: Record<string, number>;
      regionBreakdown: Record<string, number>;
      institutionTypeBreakdown: Record<string, number>;
    }>(raw);

    upsertUpdateBundle(db, {
      update_id: updateId,
      timestamp_ms: rawUpdate.timestamp_ms,
      period_title: bundle.periodTitle,
      period_range: bundle.periodRange,
      period_summary: bundle.periodSummary,
      period_themes: bundle.periodThemes,
      trend_signals: bundle.trendSignals,
      category_breakdown: bundle.categoryBreakdown,
      region_breakdown: bundle.regionBreakdown,
      institution_type_breakdown: bundle.institutionTypeBreakdown,
    });

    logStage(db, updateId, "aggregated", "completed");
    console.log(`  [done] ${updateId} — "${bundle.periodTitle}"`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStage(db, updateId, "aggregated", "failed", msg);
    console.error(`  [fail] ${updateId}: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Stage 2: Trend Analyzer
// ---------------------------------------------------------------------------

function insertTension(
  db: Database.Database,
  tension: DetectedTension,
): void {
  db.prepare(
    `INSERT INTO detected_tensions (label, description, side_a_json, side_b_json, intensity)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    tension.label,
    tension.description,
    JSON.stringify(tension.sideA),
    JSON.stringify(tension.sideB),
    tension.intensity,
  );
}

function upsertMaturityScore(
  db: Database.Database,
  score: InstitutionMaturityScore,
): void {
  db.prepare(
    `INSERT INTO institution_maturity_scores
       (institution, overall_level, dimensions_json, evidence_insight_ids_json, last_updated, data_point_count)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(institution) DO UPDATE SET
       overall_level = excluded.overall_level,
       dimensions_json = excluded.dimensions_json,
       evidence_insight_ids_json = excluded.evidence_insight_ids_json,
       last_updated = excluded.last_updated,
       data_point_count = excluded.data_point_count`,
  ).run(
    score.institution,
    score.overallLevel,
    JSON.stringify(score.dimensions),
    JSON.stringify(score.evidenceInsightIds),
    score.lastUpdated,
    score.dataPointCount,
  );
}

type BundleRow = {
  update_id: string;
  timestamp_ms: number;
  period_title: string;
  period_range: string;
  period_summary: string;
  period_themes_json: string;
  trend_signals_json: string;
  category_breakdown_json: string;
  region_breakdown_json: string;
  institution_type_breakdown_json: string;
};

async function analyzeTrends(db: Database.Database): Promise<{ trendsIdentified: number; tensionsDetected: number }> {
  console.log("\n--- Stage 2: Trend Analysis ---");

  const bundleRows = db
    .prepare("SELECT * FROM update_bundles ORDER BY timestamp_ms ASC")
    .all() as BundleRow[];

  if (bundleRows.length === 0) {
    console.log("  No update bundles found. Run synthesis first.");
    return { trendsIdentified: 0, tensionsDetected: 0 };
  }

  console.log(`  Analyzing ${bundleRows.length} update bundles...`);

  // Build compact bundle summaries for the prompt
  const bundleSummaries = bundleRows.map((row) => ({
    updateId: row.update_id,
    timestamp: row.timestamp_ms,
    periodTitle: row.period_title,
    periodRange: row.period_range,
    periodSummary: row.period_summary,
    periodThemes: JSON.parse(row.period_themes_json),
    trendSignals: JSON.parse(row.trend_signals_json),
    categoryBreakdown: JSON.parse(row.category_breakdown_json),
    regionBreakdown: JSON.parse(row.region_breakdown_json),
    institutionTypeBreakdown: JSON.parse(row.institution_type_breakdown_json),
  }));

  // Also include insight-level institution data for maturity scoring
  const insightRows = db
    .prepare(
      `SELECT id, update_id, date, title, primary_category, institutions_json,
              maturity_signal, investment_signal_json, collaborations_json
       FROM insights ORDER BY timestamp_ms ASC`,
    )
    .all() as Array<{
    id: string;
    update_id: string;
    date: string;
    title: string;
    primary_category: string;
    institutions_json: string;
    maturity_signal: string;
    investment_signal_json: string | null;
    collaborations_json: string;
  }>;

  const insightSummaries = insightRows.map((row) => ({
    id: row.id,
    updateId: row.update_id,
    date: row.date,
    title: row.title,
    primaryCategory: row.primary_category,
    institutions: (JSON.parse(row.institutions_json) as Array<{ name: string; type: string; region: string }>).map(
      (inst) => ({
        name: inst.name,
        type: inst.type,
        region: inst.region,
      }),
    ),
    maturitySignal: row.maturity_signal,
    hasInvestment: row.investment_signal_json !== null,
    hasCollaborations:
      JSON.parse(row.collaborations_json).length > 0,
  }));

  const userMessage = `Analyze these update bundles and insights to produce TrendLines, DetectedTensions, and InstitutionMaturityScores.

Dataset spans: ${bundleRows.length} updates
Date range: ${bundleSummaries[0]?.periodRange ?? "unknown"} through ${bundleSummaries[bundleSummaries.length - 1]?.periodRange ?? "unknown"}
Total insights: ${insightRows.length}

Update bundles (period-level summaries):
${JSON.stringify(bundleSummaries, null, 2)}

Insight-level data for maturity scoring (${insightSummaries.length} insights):
${JSON.stringify(insightSummaries, null, 2)}`;

  try {
    const raw = await callClaude(TREND_ANALYZER_SYSTEM, userMessage);
    const analysis = parseJsonResponse<{
      trends: TrendLine[];
      tensions: DetectedTension[];
      maturityScores: InstitutionMaturityScore[];
    }>(raw);

    // Clear previous analysis
    db.exec("DELETE FROM trend_lines");
    db.exec("DELETE FROM detected_tensions");
    db.exec("DELETE FROM institution_maturity_scores");

    // Store trends
    for (const trend of analysis.trends) {
      upsertTrendLine(db, {
        id: trend.id,
        name: trend.name,
        category: trend.category,
        maturity: trend.maturity,
        direction: trend.direction,
        initiative_count: trend.initiativeCount,
        first_seen: trend.firstSeen,
        last_seen: trend.lastSeen,
        insight_ids: trend.insightIds,
        narrative: trend.narrative,
      });
    }
    console.log(`  Stored ${analysis.trends.length} trend lines`);

    // Store tensions
    for (const tension of analysis.tensions) {
      insertTension(db, tension);
    }
    console.log(`  Stored ${analysis.tensions.length} detected tensions`);

    // Store maturity scores
    for (const score of analysis.maturityScores) {
      upsertMaturityScore(db, score);
    }
    console.log(
      `  Stored ${analysis.maturityScores.length} maturity scores`,
    );

    return {
      trendsIdentified: analysis.trends.length,
      tensionsDetected: analysis.tensions.length,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  [fail] Trend analysis failed: ${msg}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

async function runBatchWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

export async function runSynthesis(
  dbOverride?: Database.Database,
): Promise<{ bundlesCreated: number; trendsIdentified: number; tensionsDetected: number }> {
  const db = dbOverride ?? initDb();

  try {
    // --- Stage 1: Update Synthesis ---
    console.log("\n--- Stage 1: Update Synthesis ---");

    // Get all insights grouped by update
    const insightRows = getAllInsights(db) as InsightRow[];
    const insightsByUpdate = new Map<string, ExtractedInsight[]>();
    for (const row of insightRows) {
      const insight = rowToInsight(row);
      const list = insightsByUpdate.get(insight.updateId) ?? [];
      list.push(insight);
      insightsByUpdate.set(insight.updateId, list);
    }

    // Find updates that need synthesis (have insights but no bundle)
    const existingBundles = new Set(
      (
        db
          .prepare("SELECT update_id FROM update_bundles")
          .all() as Array<{ update_id: string }>
      ).map((r) => r.update_id),
    );

    const updateIdsToSynthesize = Array.from(insightsByUpdate.keys()).filter(
      (id) => !existingBundles.has(id),
    );

    let bundlesCreated = 0;

    if (updateIdsToSynthesize.length === 0) {
      console.log("  All updates already synthesized.");
    } else {
      console.log(
        `  Synthesizing ${updateIdsToSynthesize.length} updates (${CONCURRENCY} concurrent)...`,
      );
      await runBatchWithConcurrency(
        updateIdsToSynthesize,
        CONCURRENCY,
        async (updateId) => {
          const insights = insightsByUpdate.get(updateId)!;
          await synthesizeUpdate(db, updateId, insights);
          bundlesCreated++;
        },
      );
    }

    // --- Stage 2: Trend Analysis ---
    const { trendsIdentified, tensionsDetected } = await analyzeTrends(db);

    console.log("\nSynthesis pipeline complete.");
    return { bundlesCreated, trendsIdentified, tensionsDetected };
  } finally {
    if (!dbOverride) closeDb();
  }
}

// CLI entry point
if (
  process.argv[1]?.endsWith("synthesize.ts") ||
  process.argv[1]?.endsWith("synthesize.js")
) {
  runSynthesis().then((result) => {
    console.log(
      `\nResult: ${result.bundlesCreated} bundles, ${result.trendsIdentified} trends, ${result.tensionsDetected} tensions`,
    );
  }).catch((err) => {
    console.error("Synthesis failed:", err);
    process.exit(1);
  });
}
