import type Database from "better-sqlite3";
import type { ApiUpdate, ApiNonUpdate } from "../src/lib/yutori";
import { parseUpdate } from "../src/lib/yutori";
import {
  initDb,
  closeDb,
  upsertUpdate,
  upsertNonUpdate,
  insertInitiative,
  logStage,
  insertPipelineRun,
  updatePipelineRun,
} from "./db";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCOUT_ID = "40d662ee-5fe8-4b55-aeab-76cac0d5a654";
const SCOUT_API_URL = `https://api.yutori.com/client/scouting/${SCOUT_ID}`;
const PAGE_SIZE = 20;
const MAX_CURSOR_PAGES = 50;

// ---------------------------------------------------------------------------
// API types (response envelopes — only needed here)
// ---------------------------------------------------------------------------

type ApiUpdatesPayload = {
  scout: { id: string; display_name: string; query: string; created_at: string };
  updates: ApiUpdate[];
  next_cursor?: string | null;
  prev_cursor?: string | null;
};

type ApiNonUpdatesPayload = {
  non_updates: ApiNonUpdate[];
  next_cursor?: string | null;
  prev_cursor?: string | null;
};

// ---------------------------------------------------------------------------
// Fetch helpers (no Next.js cache directives — plain fetch for scripts)
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Yutori API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Fetch all updates, paginating with cursor
// ---------------------------------------------------------------------------

async function fetchAllUpdates(
  db: Database.Database,
): Promise<{ updates: ApiUpdate[]; pagesTraversed: number }> {
  const allUpdates: ApiUpdate[] = [];
  const seenIds = new Set<string>();

  // Check fetch_state for a saved cursor
  const saved = db
    .prepare("SELECT last_cursor FROM fetch_state WHERE endpoint = 'updates'")
    .get() as { last_cursor: string | null } | undefined;

  let cursor: string | null = saved?.last_cursor ?? null;
  let pagesTraversed = 0;

  // Check which update IDs already exist in the DB
  const existingIds = new Set(
    (db.prepare("SELECT id FROM updates").all() as { id: string }[]).map((r) => r.id),
  );

  // Paginate. We always start from page 1 (no cursor) to catch the newest
  // updates, then stop once we hit IDs we already have.
  cursor = null; // always start fresh to catch new updates at the top
  let hitExisting = false;

  for (let page = 0; page < MAX_CURSOR_PAGES; page++) {
    const url = new URL(`${SCOUT_API_URL}/updates`);
    url.searchParams.set("page_size", String(PAGE_SIZE));
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const payload = await fetchJson<ApiUpdatesPayload>(url.toString());
    pagesTraversed++;

    let newOnThisPage = 0;
    for (const update of payload.updates) {
      if (seenIds.has(update.id)) continue;
      seenIds.add(update.id);

      if (existingIds.has(update.id)) {
        hitExisting = true;
        continue;
      }

      allUpdates.push(update);
      newOnThisPage++;
    }

    // Stop paginating if we've exhausted new content or hit the API end
    if (!payload.next_cursor || payload.updates.length === 0) {
      break;
    }

    // If this entire page was already in the DB, no need to go deeper
    if (hitExisting && newOnThisPage === 0) {
      break;
    }

    cursor = payload.next_cursor;
  }

  // Save cursor watermark for potential future use
  db.prepare(
    `INSERT INTO fetch_state (endpoint, last_cursor, last_timestamp_ms)
     VALUES ('updates', ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       last_cursor = excluded.last_cursor,
       last_timestamp_ms = excluded.last_timestamp_ms,
       updated_at = datetime('now')`,
  ).run(
    cursor,
    allUpdates.length > 0
      ? Math.max(...allUpdates.map((u) => u.timestamp))
      : null,
  );

  return {
    updates: allUpdates.sort((a, b) => b.timestamp - a.timestamp),
    pagesTraversed,
  };
}

// ---------------------------------------------------------------------------
// Fetch all non-updates
// ---------------------------------------------------------------------------

async function fetchAllNonUpdates(
  db: Database.Database,
): Promise<{ nonUpdates: ApiNonUpdate[]; pagesTraversed: number }> {
  const allNonUpdates: ApiNonUpdate[] = [];
  const seenTimestamps = new Set<number>();

  const existingTimestamps = new Set(
    (
      db.prepare("SELECT timestamp_ms FROM non_updates").all() as {
        timestamp_ms: number;
      }[]
    ).map((r) => r.timestamp_ms),
  );

  let cursor: string | null = null;
  let pagesTraversed = 0;

  for (let page = 0; page < MAX_CURSOR_PAGES; page++) {
    const url = new URL(`${SCOUT_API_URL}/non_updates`);
    url.searchParams.set("page_size", String(PAGE_SIZE));
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const payload = await fetchJson<ApiNonUpdatesPayload>(url.toString());
    pagesTraversed++;

    for (const nu of payload.non_updates) {
      if (seenTimestamps.has(nu.timestamp)) continue;
      seenTimestamps.add(nu.timestamp);

      if (existingTimestamps.has(nu.timestamp)) continue;

      allNonUpdates.push(nu);
    }

    if (!payload.next_cursor || payload.non_updates.length === 0) {
      break;
    }

    cursor = payload.next_cursor;
  }

  db.prepare(
    `INSERT INTO fetch_state (endpoint, last_cursor, last_timestamp_ms)
     VALUES ('non_updates', ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       last_cursor = excluded.last_cursor,
       last_timestamp_ms = excluded.last_timestamp_ms,
       updated_at = datetime('now')`,
  ).run(
    cursor,
    allNonUpdates.length > 0
      ? Math.max(...allNonUpdates.map((nu) => nu.timestamp))
      : null,
  );

  return {
    nonUpdates: allNonUpdates.sort((a, b) => b.timestamp - a.timestamp),
    pagesTraversed,
  };
}

// ---------------------------------------------------------------------------
// Store raw updates + parse initiatives
// ---------------------------------------------------------------------------

function storeAndParse(
  db: Database.Database,
  updates: ApiUpdate[],
): { updatesParsed: number; initiativesParsed: number } {
  let updatesParsed = 0;
  let initiativesParsed = 0;

  const storeAndParseOne = db.transaction((update: ApiUpdate) => {
    const isNew = upsertUpdate(db, {
      id: update.id,
      timestamp: update.timestamp,
      content: update.content,
      citations: update.citations,
      stats: update.stats,
      header_image_url: update.header_image_url ?? null,
    });

    if (!isNew) return;

    logStage(db, update.id, "fetched", "completed");

    // Run the existing parser
    logStage(db, update.id, "parsed", "running");
    try {
      const parsed = parseUpdate(update);
      for (const initiative of parsed.initiatives) {
        insertInitiative(db, {
          update_id: update.id,
          institution: initiative.institution,
          title: initiative.title,
          description: initiative.description,
          categories: initiative.categories,
          sourceUrls: initiative.sourceUrls,
        });
      }
      logStage(db, update.id, "parsed", "completed");
      updatesParsed++;
      initiativesParsed += parsed.initiatives.length;
    } catch (err) {
      logStage(db, update.id, "parsed", "failed", String(err));
    }
  });

  for (const update of updates) {
    storeAndParseOne(update);
  }

  return { updatesParsed, initiativesParsed };
}

function storeNonUpdates(
  db: Database.Database,
  nonUpdates: ApiNonUpdate[],
): number {
  let count = 0;
  for (const nu of nonUpdates) {
    if (upsertNonUpdate(db, { timestamp: nu.timestamp, stats: nu.stats })) {
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Public API — can be imported by the orchestrator or run standalone
// ---------------------------------------------------------------------------

export type IngestResult = {
  updatesFetched: number;
  nonUpdatesFetched: number;
  updatesParsed: number;
  initiativesParsed: number;
  pagesTraversed: number;
  durationMs: number;
};

export async function runIngest(db: Database.Database): Promise<IngestResult> {
  const start = Date.now();

  // Fetch from API
  const [{ updates, pagesTraversed: updatePages }, { nonUpdates, pagesTraversed: nonUpdatePages }] =
    await Promise.all([fetchAllUpdates(db), fetchAllNonUpdates(db)]);

  // Store and parse
  const { updatesParsed, initiativesParsed } = storeAndParse(db, updates);
  const nonUpdateCount = storeNonUpdates(db, nonUpdates);

  return {
    updatesFetched: updates.length,
    nonUpdatesFetched: nonUpdateCount,
    updatesParsed,
    initiativesParsed,
    pagesTraversed: updatePages + nonUpdatePages,
    durationMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Standalone entrypoint
// ---------------------------------------------------------------------------

async function main() {
  const db = initDb();

  const runId = insertPipelineRun(db);
  console.log(`[ingest] Pipeline run #${runId} started`);

  try {
    const result = await runIngest(db);

    updatePipelineRun(db, runId, {
      updates_fetched: result.updatesFetched,
      updates_parsed: result.updatesParsed,
    });

    console.log(`[ingest] Done in ${(result.durationMs / 1000).toFixed(1)}s`);
    console.log(`  API pages traversed:  ${result.pagesTraversed}`);
    console.log(`  New updates fetched:  ${result.updatesFetched}`);
    console.log(`  Non-updates fetched:  ${result.nonUpdatesFetched}`);
    console.log(`  Updates parsed:       ${result.updatesParsed}`);
    console.log(`  Initiatives parsed:   ${result.initiativesParsed}`);

    // Summary of DB state
    const totalUpdates = (
      db.prepare("SELECT COUNT(*) as n FROM updates").get() as { n: number }
    ).n;
    const totalInitiatives = (
      db.prepare("SELECT COUNT(*) as n FROM initiatives").get() as { n: number }
    ).n;
    console.log(`  Total updates in DB: ${totalUpdates}`);
    console.log(`  Total initiatives:   ${totalInitiatives}`);
  } catch (err) {
    updatePipelineRun(db, runId, { error: String(err) });
    console.error(`[ingest] Failed:`, err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

// Run when executed directly (not imported)
const isDirectRun =
  typeof require !== "undefined" && require.main === module;
const isCliRun = process.argv[1]?.includes("ingest");

if (isDirectRun || isCliRun) {
  main();
}
