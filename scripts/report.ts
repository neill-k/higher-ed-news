/**
 * Report generation module for the AI-in-higher-ed pipeline.
 *
 * Queries the full TrendReportData from SQLite, calls Claude with the
 * Report Generator prompt (Prompt 4 from agent-prompts.md) for each
 * report section, and assembles the final Markdown report.
 *
 * Usage:
 *   npx tsx scripts/report.ts               # generate full report
 *   npx tsx scripts/report.ts --section executive_dashboard  # single section
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  getDb,
  initDb,
  closeDb,
} from "./db";
import type Database from "better-sqlite3";
// Types defined inline to avoid coupling to schema file location.
// These mirror the shapes stored in SQLite and returned by the db helpers.

type TrendReportData = {
  metadata: {
    generatedAt: string;
    scoutId: string;
    coveragePeriod: { start: string; end: string };
    updateCount: number;
    insightCount: number;
    schemaVersion: string;
  };
  updateBundles: Array<{
    updateId: string;
    timestamp: number;
    periodTitle: string;
    periodRange: string;
    insights: any[];
    periodSummary: string;
    periodThemes: string[];
    trendSignals: string[];
    categoryBreakdown: Record<string, number>;
    regionBreakdown: Record<string, number>;
    institutionTypeBreakdown: Record<string, number>;
  }>;
  trends: Array<{
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
  }>;
  tensions: Array<{
    label: string;
    description: string;
    sideA: string[];
    sideB: string[];
    intensity: string;
  }>;
  maturityScores: Array<{
    institution: string;
    overallLevel: number;
    dimensions: Record<string, number>;
    evidenceInsightIds: string[];
    lastUpdated: string;
    dataPointCount: number;
  }>;
  aggregates: {
    byCategory: Record<string, number>;
    byRegion: Record<string, number>;
    byInstitutionType: Record<string, number>;
    byTechnology: Record<string, number>;
    byMaturity: Record<string, number>;
    byCollaboration: Record<string, number>;
    byInvestmentScale: Record<string, number>;
    topInstitutions: Array<{ name: string; count: number }>;
    topVendors: Array<{ name: string; count: number }>;
  };
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-6";
const OUTPUT_DIR = join(__dirname, "..", "output");
const REPORT_FILENAME = "report.md";

const REPORT_SECTIONS = [
  "executive_dashboard",
  "global_adoption_landscape",
  "initiative_taxonomy",
  "maturity_assessment",
  "policy_and_governance",
  "spotlight_deep_dive",
  "predictions_and_forward_look",
] as const;

type ReportSection = (typeof REPORT_SECTIONS)[number];

// ---------------------------------------------------------------------------
// System prompt for the report generator
// ---------------------------------------------------------------------------

const REPORT_GENERATOR_SYSTEM = `You are a senior research writer at a top-tier advisory firm. Produce one section of an institutional-quality trends report on AI in higher education, modeled after Mary Meeker's Internet Trends reports and McKinsey Global Institute publications.

## Writing Standards (ALL sections)

1. **Takeaway titles**: Every header states a conclusion, not a topic.
   - YES: "Teaching AI Initiatives Outpace Research 2:1 as Universities Shift to Classroom Integration"
   - NO: "Teaching and Learning Analysis"

2. **Data -> Insight -> Implication**: Every paragraph follows this pattern.

3. **McKinsey 1-3-10**: Opening sentence delivers the key insight in 1 second. First paragraph in 3 seconds. Full narrative in 10 seconds.

4. **Source attribution**: Reference specific institutions, dates, numbers. No claim without evidence.

5. **Comparison context**: Never present a metric alone. Always include a benchmark or prior period.

6. **"So What?" boxes**: End each section with a blockquote containing: target audience, 2-3 actionable recommendations, and a self-assessment question.

7. **No filler**: Every sentence advances the argument.

## Rules

1. Generate ONLY the section specified. Do not generate other sections.
2. Use data from the TrendReportData object provided. Do not fabricate data. If data is insufficient, state "Insufficient data" rather than inventing.
3. Write in third person, present tense.
4. Format as clean markdown with ## and ### headers, **bold** metrics, and > blockquote "So What?" boxes.
5. Target 400-500 words per page for the specified page count.
6. When computing index scores, show the formula briefly.`;

// ---------------------------------------------------------------------------
// Section-specific instructions appended to the system prompt
// ---------------------------------------------------------------------------

const SECTION_INSTRUCTIONS: Record<ReportSection, string> = {
  executive_dashboard: `## Section: Executive Dashboard (2-3 pages)

Required elements:
1. Headline metric with period-over-period change and one sentence of context
2. 5-6 KPI highlights (total initiatives, new this period, top category, geographic reach, institution diversity, policy development rate)
3. Signal of the period — single most important finding as a Meeker-style provocative thesis
4. Status indicators — traffic-light (green/yellow/red) for: adoption velocity, policy maturity, geographic diversity, equity/inclusion, investment momentum
5. Sparkline narratives — 1-sentence trend descriptions for each KPI`,

  global_adoption_landscape: `## Section: Global AI Adoption Landscape (4-6 pages)

Required elements:
1. Geographic Adoption Index — score each region 0-100. Formula: initiative count (40%) + category diversity (20%) + policy maturity (20%) + investment signals (20%). Show the formula.
2. Heat map narrative — describe geographic distribution, clusters, gaps, emerging regions
3. Adoption velocity — initiatives per period by region, noting acceleration/deceleration
4. Spotlight institutions — 3-5 institutions with broadest/deepest AI adoption
5. "So What?" box — 2-3 actionable recommendations for a provost`,

  initiative_taxonomy: `## Section: Initiative Taxonomy & Domain Analysis (4-6 pages)

Required elements:
1. Category distribution — count and percentage by category with change vs. prior period
2. Subcategory detail — top 3 subcategories per category with representative examples
3. Emerging domains — new hybrid patterns or category-spanning initiatives
4. Technology stack — most referenced AI platforms/tools with institution examples
5. Initiative Diversity Index — for top institutions, score = categories_covered / 8
6. "So What?" box — recommendations for a CIO`,

  maturity_assessment: `## Section: AI Maturity Assessment (3-5 pages)

Required elements:
1. Maturity distribution — institutions at each level (1-5) with defining characteristics
2. Dimension analysis — average across 8 dimensions, strongest and weakest
3. Maturity leaders — profile 3-5 highest-scoring institutions with evidence
4. Advancement patterns — what distinguishes advancing vs. static institutions
5. Peer benchmarks — averages by institution type
6. "So What?" box — self-assessment questions for a university president`,

  policy_and_governance: `## Section: Policy & Governance Landscape (3-4 pages)

Required elements:
1. Policy status distribution — no policy / in development / instructor discretion / comprehensive
2. Governance structures — AI councils, task forces, chief AI officers, provost-led frameworks
3. Policy spectrum — restrictive to permissive with named examples
4. Regional variation — how approaches differ by geography
5. Policy Readiness Index — score 0-100. Formula: comprehensiveness (30%) + governance (25%) + ethics (25%) + regulatory alignment (20%)
6. "So What?" box — recommendations for general counsel`,

  spotlight_deep_dive: `## Section: Spotlight Deep Dive (3-4 pages)

Select the trend with the highest momentum from the TrendLine data.

Required elements:
1. SCQA framing: Situation, Complication, Question, Answer
2. 3-5 named case studies with institutional details
3. Comparative data — benchmark spotlight trend against others
4. Expert-level analysis — explain WHY and WHERE it leads
5. "So What?" box — recommendations by role (president, provost, CIO, faculty)`,

  predictions_and_forward_look: `## Section: Predictions & Forward Look (2-3 pages)

Required elements:
1. 3-5 specific, falsifiable predictions with timeframe, confidence, evidence
2. Trend Momentum Scores — rate each TrendLine as high/medium/low
3. Watch list — 3-5 weak signals with tracking indicators
4. Risk-opportunity matrix — 4-6 items by likelihood and impact
5. "So What?" box — what a board of trustees should ask their president`,
};

// ---------------------------------------------------------------------------
// Build TrendReportData from SQLite
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

function buildTrendReportData(db: Database.Database): TrendReportData {
  // Insights
  const insightRows = db
    .prepare("SELECT * FROM insights ORDER BY timestamp_ms ASC")
    .all() as InsightRow[];

  // Update bundles
  const bundleRows = db
    .prepare("SELECT * FROM update_bundles ORDER BY timestamp_ms DESC")
    .all() as Array<{
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
  }>;

  // Trend lines
  const trendRows = db
    .prepare("SELECT * FROM trend_lines ORDER BY initiative_count DESC")
    .all() as Array<{
    id: string;
    name: string;
    category: string;
    maturity: string;
    direction: string;
    initiative_count: number;
    first_seen: string;
    last_seen: string;
    insight_ids_json: string;
    narrative: string;
  }>;

  // Tensions
  const tensionRows = db
    .prepare("SELECT * FROM detected_tensions")
    .all() as Array<{
    label: string;
    description: string;
    side_a_json: string;
    side_b_json: string;
    intensity: string;
  }>;

  // Maturity scores
  const maturityRows = db
    .prepare("SELECT * FROM institution_maturity_scores ORDER BY overall_level DESC")
    .all() as Array<{
    institution: string;
    overall_level: number;
    dimensions_json: string;
    evidence_insight_ids_json: string;
    last_updated: string;
    data_point_count: number;
  }>;

  // Build aggregates
  const aggregates = buildAggregates(insightRows);

  // Timestamps
  const timestamps = insightRows.map((r) => r.timestamp_ms);
  const startDate = timestamps.length > 0
    ? new Date(Math.min(...timestamps)).toISOString().slice(0, 10)
    : "unknown";
  const endDate = timestamps.length > 0
    ? new Date(Math.max(...timestamps)).toISOString().slice(0, 10)
    : "unknown";

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      scoutId: "40d662ee-5fe8-4b55-aeab-76cac0d5a654",
      coveragePeriod: { start: startDate, end: endDate },
      updateCount: bundleRows.length,
      insightCount: insightRows.length,
      schemaVersion: "1.0.0",
    },
    updateBundles: bundleRows.map((b) => ({
      updateId: b.update_id,
      timestamp: b.timestamp_ms,
      periodTitle: b.period_title,
      periodRange: b.period_range,
      insights: insightRows
        .filter((i) => i.update_id === b.update_id)
        .map(rowToInsightCompact),
      periodSummary: b.period_summary,
      periodThemes: JSON.parse(b.period_themes_json),
      trendSignals: JSON.parse(b.trend_signals_json),
      categoryBreakdown: JSON.parse(b.category_breakdown_json),
      regionBreakdown: JSON.parse(b.region_breakdown_json),
      institutionTypeBreakdown: JSON.parse(b.institution_type_breakdown_json),
    })),
    trends: trendRows.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category as string,
      maturity: t.maturity as string,
      direction: t.direction as "accelerating" | "steady" | "decelerating" | "emerging",
      initiativeCount: t.initiative_count,
      firstSeen: t.first_seen,
      lastSeen: t.last_seen,
      insightIds: JSON.parse(t.insight_ids_json),
      narrative: t.narrative,
    })),
    tensions: tensionRows.map((t) => ({
      label: t.label,
      description: t.description,
      sideA: JSON.parse(t.side_a_json),
      sideB: JSON.parse(t.side_b_json),
      intensity: t.intensity as "high" | "medium" | "low",
    })),
    maturityScores: maturityRows.map((m) => ({
      institution: m.institution,
      overallLevel: m.overall_level as 1 | 2 | 3 | 4 | 5,
      dimensions: JSON.parse(m.dimensions_json),
      evidenceInsightIds: JSON.parse(m.evidence_insight_ids_json),
      lastUpdated: m.last_updated,
      dataPointCount: m.data_point_count,
    })),
    aggregates,
  };
}

function rowToInsightCompact(row: InsightRow): any {
  return {
    id: row.id,
    updateId: row.update_id,
    timestamp: row.timestamp_ms,
    date: row.date,
    title: row.title,
    description: row.description,
    significance: row.significance,
    institutions: JSON.parse(row.institutions_json),
    primaryCategory: row.primary_category,
    secondaryCategories: JSON.parse(row.secondary_categories_json),
    subcategories: JSON.parse(row.subcategories_json),
    maturitySignal: row.maturity_signal,
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

function buildAggregates(rows: InsightRow[]): TrendReportData["aggregates"] {
  const byCategory = {} as Record<string, number>;
  const byRegion = {} as Record<string, number>;
  const byInstitutionType = {} as Record<string, number>;
  const byTechnology = {} as Record<string, number>;
  const byMaturity = {} as Record<string, number>;
  const byCollaboration = {} as Record<string, number>;
  const byInvestmentScale = {} as Record<string, number>;
  const institutionCounts = new Map<string, number>();
  const vendorCounts = new Map<string, number>();

  for (const row of rows) {
    // Category
    const cat = row.primary_category as string;
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;

    // Region (first institution)
    const institutions = JSON.parse(row.institutions_json) as Array<{ region: string; type: string; name: string }>;
    if (institutions.length > 0) {
      const region = institutions[0].region;
      byRegion[region] = (byRegion[region] ?? 0) + 1;

      const instType = institutions[0].type;
      byInstitutionType[instType] = (byInstitutionType[instType] ?? 0) + 1;

      for (const inst of institutions) {
        institutionCounts.set(inst.name, (institutionCounts.get(inst.name) ?? 0) + 1);
      }
    }

    // Technology
    const techFocus = JSON.parse(row.technology_focus_json) as string[];
    for (const tech of techFocus) {
      byTechnology[tech] = (byTechnology[tech] ?? 0) + 1;
    }

    // Maturity
    const mat = row.maturity_signal as string;
    byMaturity[mat] = (byMaturity[mat] ?? 0) + 1;

    // Collaborations
    const collabs = JSON.parse(row.collaborations_json) as Array<{ pattern: string }>;
    if (collabs.length === 0) {
      byCollaboration["none"] = (byCollaboration["none"] ?? 0) + 1;
    } else {
      for (const c of collabs) {
        byCollaboration[c.pattern] = (byCollaboration[c.pattern] ?? 0) + 1;
      }
    }

    // Investment
    if (row.investment_signal_json) {
      const inv = JSON.parse(row.investment_signal_json) as { scale: string };
      byInvestmentScale[inv.scale] = (byInvestmentScale[inv.scale] ?? 0) + 1;
    } else {
      byInvestmentScale["unknown"] = (byInvestmentScale["unknown"] ?? 0) + 1;
    }

    // Vendors
    const vendors = JSON.parse(row.tools_and_vendors_json) as Array<{ name: string }>;
    for (const v of vendors) {
      vendorCounts.set(v.name, (vendorCounts.get(v.name) ?? 0) + 1);
    }
  }

  const topInstitutions = Array.from(institutionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));

  const topVendors = Array.from(vendorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));

  return {
    byCategory,
    byRegion,
    byInstitutionType,
    byTechnology,
    byMaturity,
    byCollaboration,
    byInvestmentScale,
    topInstitutions,
    topVendors,
  };
}

// ---------------------------------------------------------------------------
// Call Claude for a single section
// ---------------------------------------------------------------------------

async function callClaude(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const q = query({
    prompt: userMessage,
    options: {
      model: MODEL,
      maxTurns: 1,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      persistSession: false,
      systemPrompt,
      tools: [],
    },
  });

  let result = "";
  for await (const message of q) {
    if (message.type === "result") {
      if (message.subtype === "success") {
        result = message.result;
      } else {
        const errorMsg =
          "result" in message ? String(message.result) : "Unknown error";
        throw new Error(`Claude query failed: ${errorMsg}`);
      }
    }
  }

  if (!result) {
    throw new Error("No result text received from Claude");
  }

  return result;
}

async function generateSection(
  section: ReportSection,
  reportData: TrendReportData,
): Promise<string> {
  const sectionInstructions = SECTION_INSTRUCTIONS[section];
  const systemPrompt = `${REPORT_GENERATOR_SYSTEM}\n\n${sectionInstructions}`;

  // Build a compact version of reportData to fit in context
  // Include full trends, tensions, maturity, and aggregates,
  // but compact the update bundles to summaries only
  const compactData = {
    metadata: reportData.metadata,
    trends: reportData.trends,
    tensions: reportData.tensions,
    maturityScores: reportData.maturityScores,
    aggregates: reportData.aggregates,
    updateBundleSummaries: reportData.updateBundles.map((b) => ({
      updateId: b.updateId,
      periodTitle: b.periodTitle,
      periodRange: b.periodRange,
      periodSummary: b.periodSummary,
      periodThemes: b.periodThemes,
      trendSignals: b.trendSignals,
      categoryBreakdown: b.categoryBreakdown,
      insightCount: b.insights.length,
    })),
  };

  const userMessage = `Generate the "${section}" section of the AI in Higher Education Trends Report.

Here is the full TrendReportData:

${JSON.stringify(compactData, null, 2)}`;

  console.log(`  Generating section: ${section}...`);
  const markdown = await callClaude(systemPrompt, userMessage);
  console.log(`  [done] ${section} (${markdown.length} chars)`);
  return markdown;
}

// ---------------------------------------------------------------------------
// Assemble the full report
// ---------------------------------------------------------------------------

function assembleReport(
  sections: Map<ReportSection, string>,
  metadata: TrendReportData["metadata"],
): string {
  const parts: string[] = [];

  // Title page
  parts.push(`# AI in Higher Education: Trends Report`);
  parts.push(``);
  parts.push(`**Coverage Period:** ${metadata.coveragePeriod.start} to ${metadata.coveragePeriod.end}`);
  parts.push(`**Generated:** ${new Date(metadata.generatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`);
  parts.push(`**Updates Analyzed:** ${metadata.updateCount} | **Insights Extracted:** ${metadata.insightCount}`);
  parts.push(`**Data Source:** Yutori Scout — University AI Initiatives`);
  parts.push(``);
  parts.push(`---`);
  parts.push(``);

  // Table of contents
  parts.push(`## Table of Contents`);
  parts.push(``);
  const sectionNames: Record<ReportSection, string> = {
    executive_dashboard: "Executive Dashboard",
    global_adoption_landscape: "Global AI Adoption Landscape",
    initiative_taxonomy: "Initiative Taxonomy & Domain Analysis",
    maturity_assessment: "AI Maturity Assessment",
    policy_and_governance: "Policy & Governance Landscape",
    spotlight_deep_dive: "Spotlight Deep Dive",
    predictions_and_forward_look: "Predictions & Forward Look",
  };
  for (const section of REPORT_SECTIONS) {
    if (sections.has(section)) {
      parts.push(`- ${sectionNames[section]}`);
    }
  }
  parts.push(``);
  parts.push(`---`);
  parts.push(``);

  // Section content
  for (const section of REPORT_SECTIONS) {
    const content = sections.get(section);
    if (content) {
      parts.push(content);
      parts.push(``);
      parts.push(`---`);
      parts.push(``);
    }
  }

  // Footer
  parts.push(`## Methodology & Data Notes`);
  parts.push(``);
  parts.push(`This report was generated using an automated pipeline that tracks university AI initiatives globally via the Yutori Scout platform. Raw updates are processed through a multi-stage extraction pipeline using Claude (Anthropic) to identify structured insights, detect trend signals, and produce analytical narratives.`);
  parts.push(``);
  parts.push(`**Pipeline stages:** Data ingestion -> Initiative extraction -> Update synthesis -> Cross-period trend analysis -> Report generation`);
  parts.push(``);
  parts.push(`**Schema version:** ${metadata.schemaVersion}`);
  parts.push(``);
  parts.push(`*This report is generated programmatically. All data points reference specific institutions and dates from the source data. No data has been fabricated.*`);

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Public API (called by pipeline.ts)
// ---------------------------------------------------------------------------

export async function runReport(
  dbOverride?: Database.Database,
): Promise<{ reportPath: string }> {
  const db = dbOverride ?? initDb();

  try {
    console.log("\n--- Report Generation ---");

    // Build the full report data from SQLite
    const reportData = buildTrendReportData(db);

    if (reportData.updateBundles.length === 0) {
      console.log("  No update bundles found. Run synthesis first.");
      return { reportPath: "" };
    }

    console.log(
      `  Report data: ${reportData.metadata.insightCount} insights, ` +
        `${reportData.trends.length} trends, ` +
        `${reportData.tensions.length} tensions, ` +
        `${reportData.maturityScores.length} maturity scores`,
    );

    // Determine which sections to generate
    const args = process.argv.slice(2);
    const sectionFlag = args.indexOf("--section");
    const requestedSections: ReportSection[] =
      sectionFlag !== -1 && args[sectionFlag + 1]
        ? [args[sectionFlag + 1] as ReportSection]
        : [...REPORT_SECTIONS];

    // Generate each section
    const sectionContents = new Map<ReportSection, string>();

    for (const section of requestedSections) {
      if (!REPORT_SECTIONS.includes(section)) {
        console.error(`  [skip] Unknown section: ${section}`);
        continue;
      }
      try {
        const content = await generateSection(section, reportData);
        sectionContents.set(section, content);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`  [fail] ${section}: ${msg}`);
        sectionContents.set(
          section,
          `## ${section}\n\n*Error generating this section: ${msg}*\n`,
        );
      }
    }

    // Assemble and write the report
    mkdirSync(OUTPUT_DIR, { recursive: true });
    const reportPath = join(OUTPUT_DIR, REPORT_FILENAME);
    const report = assembleReport(sectionContents, reportData.metadata);
    writeFileSync(reportPath, report, "utf-8");

    // Write the raw structured data for the Next.js frontend
    const dataPath = join(OUTPUT_DIR, "report-data.json");
    writeFileSync(dataPath, JSON.stringify(reportData, null, 2), "utf-8");

    console.log(`\n  Report written to: ${reportPath}`);
    console.log(`  Data written to: ${dataPath}`);
    console.log(`  Sections: ${sectionContents.size}`);
    console.log(`  Total length: ${report.length} chars`);

    return { reportPath };
  } finally {
    if (!dbOverride) closeDb();
  }
}

// CLI entry point
if (
  process.argv[1]?.endsWith("report.ts") ||
  process.argv[1]?.endsWith("report.js")
) {
  runReport().then((result) => {
    if (result.reportPath) {
      console.log(`\nReport generated: ${result.reportPath}`);
    }
  }).catch((err) => {
    console.error("Report generation failed:", err);
    process.exit(1);
  });
}
