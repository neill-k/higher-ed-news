/**
 * Higher-Ed AI News Pipeline Orchestrator
 *
 * Runs the full data processing pipeline:
 *   1. Ingest: Fetch from Yutori API -> SQLite
 *   2. Extract: Claude agent insight extraction (per update)
 *   3. Synthesize: Claude agent trend synthesis (cross-update)
 *   4. Report: Claude agent report generation
 *
 * Usage:
 *   npx tsx scripts/pipeline.ts              # full pipeline
 *   npx tsx scripts/pipeline.ts --ingest-only
 *   npx tsx scripts/pipeline.ts --extract-only
 *   npx tsx scripts/pipeline.ts --synthesize-only
 *   npx tsx scripts/pipeline.ts --report-only
 */

import { initDb, closeDb, insertPipelineRun, updatePipelineRun } from "./db";

type Stage = "ingest" | "extract" | "synthesize" | "report";

function parseArgs(): Set<Stage> {
  const args = process.argv.slice(2);
  const allStages: Stage[] = ["ingest", "extract", "synthesize", "report"];

  if (args.length === 0) {
    return new Set(allStages);
  }

  const stages = new Set<Stage>();
  for (const arg of args) {
    const match = arg.match(/^--(\w+)-only$/);
    if (match && allStages.includes(match[1] as Stage)) {
      stages.add(match[1] as Stage);
    }
  }

  return stages.size > 0 ? stages : new Set(allStages);
}

function log(stage: string, message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${stage}] ${message}`);
}

async function main(): Promise<void> {
  const stages = parseArgs();
  log("pipeline", `Starting pipeline with stages: ${Array.from(stages).join(", ")}`);

  const db = initDb();
  const runId = insertPipelineRun(db);
  log("pipeline", `Pipeline run #${runId} started`);

  const counts = {
    updates_fetched: 0,
    updates_parsed: 0,
    updates_extracted: 0,
    updates_aggregated: 0,
  };

  try {
    // Stage 1: Ingest
    if (stages.has("ingest")) {
      log("ingest", "Starting data ingestion from Yutori API...");
      const { runIngest } = await import("./ingest");
      const result = await runIngest(db);
      counts.updates_fetched = result.updatesFetched;
      counts.updates_parsed = result.initiativesParsed;
      log("ingest", `Done: ${result.updatesFetched} updates, ${result.nonUpdatesFetched} non-updates, ${result.initiativesParsed} initiatives parsed`);
    }

    // Stage 2: Extract
    if (stages.has("extract")) {
      log("extract", "Starting Claude agent insight extraction...");
      const { runExtraction } = await import("./extract");
      const result = await runExtraction(db);
      counts.updates_extracted = result.updatesProcessed;
      log("extract", `Done: ${result.updatesProcessed} updates processed, ${result.insightsExtracted} insights extracted`);
    }

    // Stage 3: Synthesize
    if (stages.has("synthesize")) {
      log("synthesize", "Starting Claude agent trend synthesis...");
      const { runSynthesis } = await import("./synthesize");
      const result = await runSynthesis(db);
      counts.updates_aggregated = result.bundlesCreated;
      log("synthesize", `Done: ${result.bundlesCreated} bundles, ${result.trendsIdentified} trends, ${result.tensionsDetected} tensions`);
    }

    // Stage 4: Report
    if (stages.has("report")) {
      log("report", "Starting Claude agent report generation...");
      const { runReport } = await import("./report");
      const result = await runReport(db);
      log("report", `Done: report written to ${result.reportPath}`);
    }

    updatePipelineRun(db, runId, counts);
    log("pipeline", `Pipeline run #${runId} completed successfully`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updatePipelineRun(db, runId, { ...counts, error: message });
    log("pipeline", `Pipeline run #${runId} failed: ${message}`);
    throw error;
  } finally {
    closeDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
