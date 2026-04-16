-- Higher-Ed AI News Pipeline — SQLite Schema
--
-- Maps to TypeScript types in:
--   src/lib/yutori.ts      (ApiUpdate, ParsedUpdate, ParsedInitiative)
--   src/lib/insight-schema.ts (ExtractedInsight, UpdateInsightBundle, TrendLine,
--                              DetectedTension, InstitutionMaturityScore)
--
-- Design decisions:
--   - Complex nested arrays/objects (institutions, collaborations, toolsAndVendors,
--     dimensions, breakdowns) are stored as JSON columns. SQLite's json_extract()
--     makes them queryable; normalizing them would explode table count for little
--     benefit given the read-heavy, batch-write workload.
--   - Scalar enum fields (category, maturity, direction, etc.) stay as TEXT with
--     CHECK constraints so they can be indexed and filtered in SQL directly.
--   - Processing state uses a composite PK (update_id, stage) so the pipeline can
--     upsert each stage independently and query for "all updates missing stage X".

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. RAW DATA LAYER — mirrors Yutori API response
-- ============================================================================

-- One row per Yutori scout update.
-- `citations` and `stats` are stored as JSON blobs since they are consumed
-- whole by downstream code and rarely queried field-by-field.
CREATE TABLE IF NOT EXISTS updates (
  id                TEXT    PRIMARY KEY,                -- UUID from API
  timestamp_ms      INTEGER NOT NULL,                  -- Unix ms
  content_html      TEXT    NOT NULL,                  -- raw HTML body
  citations_json    TEXT    NOT NULL DEFAULT '[]',     -- JSON: ApiCitation[]
  stats_json        TEXT    NOT NULL DEFAULT '{}',     -- JSON: { sec_saved, num_tool_calls, ... }
  header_image_url  TEXT,                              -- nullable
  fetched_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_updates_ts ON updates (timestamp_ms DESC);

-- Runs where the scout found nothing new.
CREATE TABLE IF NOT EXISTS non_updates (
  timestamp_ms  INTEGER PRIMARY KEY,
  stats_json    TEXT,                                  -- JSON or NULL for older entries
  fetched_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- 2. PARSED DATA LAYER — output of existing yutori.ts parser
-- ============================================================================

-- One row per parsed initiative bullet.
-- Maps to ParsedInitiative from yutori.ts.
-- categories and source_urls are short arrays, stored as JSON.
CREATE TABLE IF NOT EXISTS initiatives (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  update_id       TEXT    NOT NULL REFERENCES updates(id),
  institution     TEXT    NOT NULL,
  title           TEXT    NOT NULL,
  description     TEXT    NOT NULL DEFAULT '',
  categories_json TEXT    NOT NULL DEFAULT '[]',       -- JSON: string[]
  source_urls_json TEXT   NOT NULL DEFAULT '[]'        -- JSON: string[]
);

CREATE INDEX IF NOT EXISTS idx_initiatives_update ON initiatives (update_id);
CREATE INDEX IF NOT EXISTS idx_initiatives_inst   ON initiatives (institution);

-- ============================================================================
-- 3. INSIGHT LAYER — Claude-extracted structured insights
-- ============================================================================

-- One row per extracted insight (one per initiative per update).
-- Maps to ExtractedInsight from insight-schema.ts.
-- Nested objects (institutions, collaborations, toolsAndVendors) are JSON.
-- Scalar enums are TEXT columns with CHECK constraints.
CREATE TABLE IF NOT EXISTS insights (
  id                    TEXT    PRIMARY KEY,            -- "{updateId}_{index}"
  update_id             TEXT    NOT NULL REFERENCES updates(id),
  timestamp_ms          INTEGER NOT NULL,
  date                  TEXT    NOT NULL,               -- ISO 8601

  -- Initiative basics
  title                 TEXT    NOT NULL,
  description           TEXT    NOT NULL,
  significance          TEXT    NOT NULL,

  -- Institutional context (JSON: InstitutionProfile[])
  institutions_json     TEXT    NOT NULL DEFAULT '[]',

  -- Trend classification
  primary_category      TEXT    NOT NULL,
  secondary_categories_json TEXT NOT NULL DEFAULT '[]', -- JSON: TrendCategory[]
  subcategories_json    TEXT    NOT NULL DEFAULT '[]',  -- JSON: TrendSubcategory[]
  maturity_signal       TEXT    NOT NULL DEFAULT 'emerging'
    CHECK(maturity_signal IN ('emerging','growing','mainstream','declining')),

  -- Analytical dimensions
  technology_focus_json     TEXT NOT NULL DEFAULT '[]', -- JSON: TechnologyFocus[]
  stakeholder_impact_json   TEXT NOT NULL DEFAULT '[]', -- JSON: StakeholderGroup[]
  investment_signal_json    TEXT,                       -- JSON: InvestmentSignal | null
  collaborations_json       TEXT NOT NULL DEFAULT '[]', -- JSON: CollaborationDetail[]
  tools_and_vendors_json    TEXT NOT NULL DEFAULT '[]', -- JSON: ToolOrVendorMention[]

  -- Policy & regulatory
  has_policy_implications   INTEGER NOT NULL DEFAULT 0, -- boolean
  policy_implications       TEXT,

  -- Provenance
  source_urls_json      TEXT    NOT NULL DEFAULT '[]',  -- JSON: string[]
  image_url             TEXT,

  extracted_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  model_id              TEXT
);

CREATE INDEX IF NOT EXISTS idx_insights_update   ON insights (update_id);
CREATE INDEX IF NOT EXISTS idx_insights_ts       ON insights (timestamp_ms DESC);
CREATE INDEX IF NOT EXISTS idx_insights_category ON insights (primary_category);
CREATE INDEX IF NOT EXISTS idx_insights_maturity ON insights (maturity_signal);

-- ============================================================================
-- 4. AGGREGATION LAYER — cross-period analysis for report generation
-- ============================================================================

-- One row per update period. Maps to UpdateInsightBundle.
-- The per-period breakdown records are JSON since they are
-- Record<Enum, number> maps consumed whole by the report renderer.
CREATE TABLE IF NOT EXISTS update_bundles (
  update_id                    TEXT    PRIMARY KEY REFERENCES updates(id),
  timestamp_ms                 INTEGER NOT NULL,
  period_title                 TEXT    NOT NULL,
  period_range                 TEXT    NOT NULL,

  period_summary               TEXT    NOT NULL,
  period_themes_json           TEXT    NOT NULL DEFAULT '[]', -- JSON: string[]
  trend_signals_json           TEXT    NOT NULL DEFAULT '[]', -- JSON: string[]

  category_breakdown_json      TEXT    NOT NULL DEFAULT '{}', -- JSON: Record<TrendCategory, number>
  region_breakdown_json        TEXT    NOT NULL DEFAULT '{}', -- JSON: Record<GeographicRegion, number>
  institution_type_breakdown_json TEXT NOT NULL DEFAULT '{}', -- JSON: Record<InstitutionType, number>

  computed_at                  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bundles_ts ON update_bundles (timestamp_ms DESC);

-- Cross-period trend lines. Maps to TrendLine.
CREATE TABLE IF NOT EXISTS trend_lines (
  id                TEXT    PRIMARY KEY,                -- slug identifier
  name              TEXT    NOT NULL,
  category          TEXT    NOT NULL,
  maturity          TEXT    NOT NULL DEFAULT 'emerging'
    CHECK(maturity IN ('emerging','growing','mainstream','declining')),
  direction         TEXT    NOT NULL DEFAULT 'emerging'
    CHECK(direction IN ('accelerating','steady','decelerating','emerging')),
  initiative_count  INTEGER NOT NULL DEFAULT 0,
  first_seen        TEXT    NOT NULL,                  -- ISO date
  last_seen         TEXT    NOT NULL,                  -- ISO date
  insight_ids_json  TEXT    NOT NULL DEFAULT '[]',     -- JSON: string[]
  narrative         TEXT    NOT NULL,

  computed_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trends_category ON trend_lines (category);
CREATE INDEX IF NOT EXISTS idx_trends_maturity ON trend_lines (maturity);

-- Tensions and debates surfaced by conflicting signals.
-- Maps to DetectedTension.
CREATE TABLE IF NOT EXISTS detected_tensions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  label         TEXT    NOT NULL,
  description   TEXT    NOT NULL,
  side_a_json   TEXT    NOT NULL DEFAULT '[]',         -- JSON: string[] (insight IDs)
  side_b_json   TEXT    NOT NULL DEFAULT '[]',         -- JSON: string[] (insight IDs)
  intensity     TEXT    NOT NULL DEFAULT 'medium'
    CHECK(intensity IN ('high','medium','low')),

  computed_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Institution maturity scores. Maps to InstitutionMaturityScore.
-- `dimensions` is Record<MaturityDimension, 1|2|3|4|5> — stored as JSON.
CREATE TABLE IF NOT EXISTS institution_maturity_scores (
  institution            TEXT    NOT NULL,
  overall_level          INTEGER NOT NULL CHECK(overall_level BETWEEN 1 AND 5),
  dimensions_json        TEXT    NOT NULL DEFAULT '{}', -- JSON: Record<MaturityDimension, MaturityLevel>
  evidence_insight_ids_json TEXT NOT NULL DEFAULT '[]', -- JSON: string[]
  last_updated           TEXT    NOT NULL DEFAULT (datetime('now')),
  data_point_count       INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (institution)
);

-- ============================================================================
-- 5. PROCESSING STATE — incremental pipeline tracking
-- ============================================================================

-- Tracks each update through the pipeline stages.
-- A row is inserted when a stage starts and updated when it finishes.
CREATE TABLE IF NOT EXISTS processing_log (
  update_id     TEXT    NOT NULL REFERENCES updates(id),
  stage         TEXT    NOT NULL
    CHECK(stage IN ('fetched','parsed','extracted','aggregated')),
  status        TEXT    NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','running','completed','failed')),
  started_at    TEXT,
  completed_at  TEXT,
  error         TEXT,

  PRIMARY KEY (update_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_proclog_stage  ON processing_log (stage, status);

-- Cursor watermark for resuming API pagination.
CREATE TABLE IF NOT EXISTS fetch_state (
  endpoint          TEXT    PRIMARY KEY,                -- 'updates' or 'non_updates'
  last_cursor       TEXT,
  last_timestamp_ms INTEGER,
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Audit log of pipeline invocations.
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  completed_at        TEXT,
  updates_fetched     INTEGER NOT NULL DEFAULT 0,
  updates_parsed      INTEGER NOT NULL DEFAULT 0,
  updates_extracted   INTEGER NOT NULL DEFAULT 0,
  updates_aggregated  INTEGER NOT NULL DEFAULT 0,
  error               TEXT
);

-- ============================================================================
-- 6. VIEWS — convenience queries for pipeline and report generation
-- ============================================================================

-- Updates that still need processing at any stage.
CREATE VIEW IF NOT EXISTS v_pending_work AS
SELECT
  u.id                                                              AS update_id,
  u.timestamp_ms,
  datetime(u.timestamp_ms / 1000, 'unixepoch')                     AS update_date,
  COALESCE(pf.status, 'missing')                                   AS fetch_status,
  COALESCE(pp.status, 'missing')                                   AS parse_status,
  COALESCE(pe.status, 'missing')                                   AS extract_status,
  COALESCE(pa.status, 'missing')                                   AS aggregate_status
FROM updates u
LEFT JOIN processing_log pf ON pf.update_id = u.id AND pf.stage = 'fetched'
LEFT JOIN processing_log pp ON pp.update_id = u.id AND pp.stage = 'parsed'
LEFT JOIN processing_log pe ON pe.update_id = u.id AND pe.stage = 'extracted'
LEFT JOIN processing_log pa ON pa.update_id = u.id AND pa.stage = 'aggregated'
WHERE COALESCE(pe.status, 'missing') != 'completed'
   OR COALESCE(pa.status, 'missing') != 'completed'
ORDER BY u.timestamp_ms DESC;

-- Full update context for report rendering: update + bundle + insight count.
CREATE VIEW IF NOT EXISTS v_update_overview AS
SELECT
  u.id,
  u.timestamp_ms,
  datetime(u.timestamp_ms / 1000, 'unixepoch')   AS update_date,
  u.header_image_url,
  json_extract(u.stats_json, '$.sec_saved')       AS sec_saved,
  b.period_title,
  b.period_range,
  b.period_summary,
  (SELECT COUNT(*) FROM insights i WHERE i.update_id = u.id) AS insight_count,
  (SELECT COUNT(*) FROM initiatives init WHERE init.update_id = u.id) AS parsed_initiative_count
FROM updates u
LEFT JOIN update_bundles b ON b.update_id = u.id
ORDER BY u.timestamp_ms DESC;

-- Category trend: insight counts per week per primary category.
CREATE VIEW IF NOT EXISTS v_weekly_category_trend AS
SELECT
  strftime('%Y-W%W', date)  AS week,
  primary_category          AS category,
  COUNT(*)                  AS insight_count,
  AVG(CASE maturity_signal
    WHEN 'emerging'   THEN 1
    WHEN 'growing'    THEN 2
    WHEN 'mainstream' THEN 3
    WHEN 'declining'  THEN 4
  END)                      AS avg_maturity_score
FROM insights
GROUP BY week, category
ORDER BY week, category;

-- Institution leaderboard: how often each institution appears across insights.
CREATE VIEW IF NOT EXISTS v_institution_rankings AS
SELECT
  je.value ->> '$.name'     AS institution_name,
  je.value ->> '$.type'     AS institution_type,
  je.value ->> '$.region'   AS region,
  COUNT(DISTINCT i.id)      AS insight_count,
  COUNT(DISTINCT i.update_id) AS update_count,
  MIN(i.date)               AS first_seen,
  MAX(i.date)               AS last_seen
FROM insights i, json_each(i.institutions_json) je
GROUP BY institution_name
ORDER BY insight_count DESC;
