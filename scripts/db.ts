import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";

const DB_PATH = join(__dirname, "..", "data", "pipeline.db");
const SCHEMA_PATH = join(__dirname, "..", "research", "schema.sql");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const { mkdirSync } = require("fs");
    mkdirSync(join(__dirname, "..", "data"), { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
  }
  return _db;
}

export function initDb(): Database.Database {
  const db = getDb();
  const schema = readFileSync(SCHEMA_PATH, "utf-8");

  // Split on statement boundaries and execute each
  // (better-sqlite3's exec handles multiple statements, but we strip PRAGMAs
  //  since they were already set in getDb)
  const filtered = schema
    .split("\n")
    .filter((line) => !line.trim().startsWith("PRAGMA"))
    .join("\n");

  db.exec(filtered);
  return db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ---------------------------------------------------------------------------
// Raw data layer helpers
// ---------------------------------------------------------------------------

export function upsertUpdate(
  db: Database.Database,
  update: {
    id: string;
    timestamp: number;
    content: string;
    citations: unknown[];
    stats: unknown;
    header_image_url: string | null;
  }
): boolean {
  const stmt = db.prepare(`
    INSERT INTO updates (id, timestamp_ms, content_html, citations_json, stats_json, header_image_url)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  const result = stmt.run(
    update.id,
    update.timestamp,
    update.content,
    JSON.stringify(update.citations),
    JSON.stringify(update.stats),
    update.header_image_url ?? null
  );
  return result.changes > 0;
}

export function upsertNonUpdate(
  db: Database.Database,
  nonUpdate: { timestamp: number; stats: unknown }
): boolean {
  const stmt = db.prepare(`
    INSERT INTO non_updates (timestamp_ms, stats_json)
    VALUES (?, ?)
    ON CONFLICT(timestamp_ms) DO NOTHING
  `);
  const result = stmt.run(nonUpdate.timestamp, JSON.stringify(nonUpdate.stats));
  return result.changes > 0;
}

export function insertInitiative(
  db: Database.Database,
  initiative: {
    update_id: string;
    institution: string;
    title: string;
    description: string;
    categories: string[];
    sourceUrls: string[];
  }
): void {
  const stmt = db.prepare(`
    INSERT INTO initiatives (update_id, institution, title, description, categories_json, source_urls_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    initiative.update_id,
    initiative.institution,
    initiative.title,
    initiative.description,
    JSON.stringify(initiative.categories),
    JSON.stringify(initiative.sourceUrls)
  );
}

// ---------------------------------------------------------------------------
// Processing log helpers
// ---------------------------------------------------------------------------

export function logStage(
  db: Database.Database,
  updateId: string,
  stage: string,
  status: "pending" | "running" | "completed" | "failed",
  error?: string
): void {
  const stmt = db.prepare(`
    INSERT INTO processing_log (update_id, stage, status, started_at, completed_at, error)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(update_id, stage) DO UPDATE SET
      status = excluded.status,
      started_at = COALESCE(excluded.started_at, processing_log.started_at),
      completed_at = excluded.completed_at,
      error = excluded.error
  `);

  const now = new Date().toISOString();
  stmt.run(
    updateId,
    stage,
    status,
    status === "running" ? now : null,
    status === "completed" || status === "failed" ? now : null,
    error ?? null
  );
}

export function getUnprocessedUpdates(
  db: Database.Database,
  stage: string
): Array<{ update_id: string; timestamp_ms: number }> {
  return db
    .prepare(
      `
      SELECT u.id AS update_id, u.timestamp_ms
      FROM updates u
      LEFT JOIN processing_log pl ON pl.update_id = u.id AND pl.stage = ?
      WHERE pl.status IS NULL OR pl.status = 'failed'
      ORDER BY u.timestamp_ms ASC
    `
    )
    .all(stage) as Array<{ update_id: string; timestamp_ms: number }>;
}

export function getRawUpdate(
  db: Database.Database,
  updateId: string
): {
  id: string;
  timestamp_ms: number;
  content_html: string;
  citations_json: string;
  stats_json: string;
  header_image_url: string | null;
} | null {
  return db.prepare("SELECT * FROM updates WHERE id = ?").get(updateId) as any;
}

// ---------------------------------------------------------------------------
// Insight layer helpers
// ---------------------------------------------------------------------------

export function insertInsight(
  db: Database.Database,
  insight: {
    id: string;
    update_id: string;
    timestamp_ms: number;
    date: string;
    title: string;
    description: string;
    significance: string;
    institutions: unknown[];
    primary_category: string;
    secondary_categories: string[];
    subcategories: string[];
    maturity_signal: string;
    technology_focus: string[];
    stakeholder_impact: string[];
    investment_signal: unknown | null;
    collaborations: unknown[];
    tools_and_vendors: unknown[];
    has_policy_implications: boolean;
    policy_implications: string | null;
    source_urls: string[];
    image_url: string | null;
    model_id?: string;
  }
): void {
  const stmt = db.prepare(`
    INSERT INTO insights (
      id, update_id, timestamp_ms, date,
      title, description, significance,
      institutions_json,
      primary_category, secondary_categories_json, subcategories_json, maturity_signal,
      technology_focus_json, stakeholder_impact_json,
      investment_signal_json, collaborations_json, tools_and_vendors_json,
      has_policy_implications, policy_implications,
      source_urls_json, image_url, model_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  stmt.run(
    insight.id,
    insight.update_id,
    insight.timestamp_ms,
    insight.date,
    insight.title,
    insight.description,
    insight.significance,
    JSON.stringify(insight.institutions),
    insight.primary_category,
    JSON.stringify(insight.secondary_categories),
    JSON.stringify(insight.subcategories),
    insight.maturity_signal,
    JSON.stringify(insight.technology_focus),
    JSON.stringify(insight.stakeholder_impact),
    insight.investment_signal ? JSON.stringify(insight.investment_signal) : null,
    JSON.stringify(insight.collaborations),
    JSON.stringify(insight.tools_and_vendors),
    insight.has_policy_implications ? 1 : 0,
    insight.policy_implications,
    JSON.stringify(insight.source_urls),
    insight.image_url,
    insight.model_id ?? null
  );
}

// ---------------------------------------------------------------------------
// Aggregation layer helpers
// ---------------------------------------------------------------------------

export function upsertUpdateBundle(
  db: Database.Database,
  bundle: {
    update_id: string;
    timestamp_ms: number;
    period_title: string;
    period_range: string;
    period_summary: string;
    period_themes: string[];
    trend_signals: string[];
    category_breakdown: Record<string, number>;
    region_breakdown: Record<string, number>;
    institution_type_breakdown: Record<string, number>;
  }
): void {
  const stmt = db.prepare(`
    INSERT INTO update_bundles (
      update_id, timestamp_ms, period_title, period_range,
      period_summary, period_themes_json, trend_signals_json,
      category_breakdown_json, region_breakdown_json, institution_type_breakdown_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(update_id) DO UPDATE SET
      period_title = excluded.period_title,
      period_summary = excluded.period_summary,
      period_themes_json = excluded.period_themes_json,
      trend_signals_json = excluded.trend_signals_json,
      category_breakdown_json = excluded.category_breakdown_json,
      region_breakdown_json = excluded.region_breakdown_json,
      institution_type_breakdown_json = excluded.institution_type_breakdown_json,
      computed_at = datetime('now')
  `);
  stmt.run(
    bundle.update_id,
    bundle.timestamp_ms,
    bundle.period_title,
    bundle.period_range,
    bundle.period_summary,
    JSON.stringify(bundle.period_themes),
    JSON.stringify(bundle.trend_signals),
    JSON.stringify(bundle.category_breakdown),
    JSON.stringify(bundle.region_breakdown),
    JSON.stringify(bundle.institution_type_breakdown)
  );
}

export function upsertTrendLine(
  db: Database.Database,
  trend: {
    id: string;
    name: string;
    category: string;
    maturity: string;
    direction: string;
    initiative_count: number;
    first_seen: string;
    last_seen: string;
    insight_ids: string[];
    narrative: string;
  }
): void {
  const stmt = db.prepare(`
    INSERT INTO trend_lines (
      id, name, category, maturity, direction,
      initiative_count, first_seen, last_seen,
      insight_ids_json, narrative
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      maturity = excluded.maturity,
      direction = excluded.direction,
      initiative_count = excluded.initiative_count,
      last_seen = excluded.last_seen,
      insight_ids_json = excluded.insight_ids_json,
      narrative = excluded.narrative,
      computed_at = datetime('now')
  `);
  stmt.run(
    trend.id,
    trend.name,
    trend.category,
    trend.maturity,
    trend.direction,
    trend.initiative_count,
    trend.first_seen,
    trend.last_seen,
    JSON.stringify(trend.insight_ids),
    trend.narrative
  );
}

export function insertPipelineRun(db: Database.Database): number {
  const result = db.prepare("INSERT INTO pipeline_runs DEFAULT VALUES").run();
  return Number(result.lastInsertRowid);
}

export function updatePipelineRun(
  db: Database.Database,
  runId: number,
  counts: {
    updates_fetched?: number;
    updates_parsed?: number;
    updates_extracted?: number;
    updates_aggregated?: number;
    error?: string;
  }
): void {
  const sets: string[] = ["completed_at = datetime('now')"];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(counts)) {
    if (value !== undefined) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
  }

  values.push(runId);
  db.prepare(`UPDATE pipeline_runs SET ${sets.join(", ")} WHERE id = ?`).run(
    ...values
  );
}

export function getAllInsights(db: Database.Database): unknown[] {
  return db.prepare("SELECT * FROM insights ORDER BY timestamp_ms ASC").all();
}

export function getAllUpdateBundles(db: Database.Database): unknown[] {
  return db
    .prepare("SELECT * FROM update_bundles ORDER BY timestamp_ms ASC")
    .all();
}
