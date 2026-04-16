/**
 * Insight extraction module for the AI-in-higher-ed pipeline.
 *
 * Queries v_pending_work for updates needing extraction, sends each update's
 * raw HTML to a Claude agent using the Initiative Extractor prompt, parses
 * the JSON response into ExtractedInsight objects, and stores them in the
 * insights table.
 *
 * Usage:
 *   npx tsx scripts/extract.ts            # extract all pending updates
 *   npx tsx scripts/extract.ts --limit 5  # extract at most 5 updates
 *   npx tsx scripts/extract.ts --dry-run  # show what would be extracted without calling Claude
 */

import { readFileSync } from "fs";
import { join } from "path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  getDb,
  initDb,
  getRawUpdate,
  getUnprocessedUpdates,
  logStage,
  insertInsight,
} from "./db";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-6";
const MAX_TURNS = 1; // Single-turn: prompt in, JSON out
const STAGE = "extracted";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5_000;
const CONCURRENCY = 5;

// ---------------------------------------------------------------------------
// Load the extraction prompt template
// ---------------------------------------------------------------------------

function loadExtractionPrompt(): string {
  const raw = readFileSync(
    join(__dirname, "..", "research", "agent-prompts.md"),
    "utf-8"
  );

  // Extract the full Prompt 1 section: everything between "## Prompt 1" header
  // and the next "---" section separator. This avoids issues with nested code fences.
  const prompt1Start = raw.indexOf("## Prompt 1: Initiative Extractor");
  if (prompt1Start === -1) throw new Error("Cannot find Prompt 1 in agent-prompts.md");

  const afterHeader = raw.slice(prompt1Start);
  // Find the next section separator (---) which marks the end of Prompt 1
  const sectionEnd = afterHeader.indexOf("\n---\n");
  const section = sectionEnd === -1 ? afterHeader : afterHeader.slice(0, sectionEnd);

  // Strip the markdown header lines and the outer ``` fences, keeping the prompt content.
  // The prompt content is everything between the first ``` and the last ``` in the section.
  // We include the full section content as the system prompt since it contains the schema,
  // enum references, few-shot examples, and rules.
  const lines = section.split("\n");
  // Skip the header line and the metadata lines (Input/Output descriptions)
  const contentStart = lines.findIndex((l) => l.startsWith("```"));
  const contentLines = contentStart !== -1 ? lines.slice(contentStart + 1) : lines.slice(3);

  // Remove the final closing ``` if present
  const lastFence = contentLines.findLastIndex((l) => l.trim() === "```");
  const finalLines = lastFence !== -1 ? contentLines.slice(0, lastFence) : contentLines;

  return finalLines.join("\n").trim();
}

// ---------------------------------------------------------------------------
// Build the user message for a single update
// ---------------------------------------------------------------------------

function buildUserMessage(update: {
  id: string;
  timestamp_ms: number;
  content_html: string;
  citations_json: string;
  header_image_url: string | null;
}): string {
  const citations = JSON.parse(update.citations_json);
  const input = {
    id: update.id,
    timestamp: update.timestamp_ms,
    content: update.content_html,
    citations,
    header_image_url: update.header_image_url,
  };

  return (
    "Extract insights from this Yutori Scout update. Return ONLY a JSON array of ExtractedInsight objects, no markdown fences or commentary.\n\n" +
    JSON.stringify(input)
  );
}

// ---------------------------------------------------------------------------
// Parse and validate the LLM response
// ---------------------------------------------------------------------------

type RawInsight = {
  id: string;
  updateId: string;
  timestamp: number;
  date: string;
  title: string;
  description: string;
  significance: string;
  institutions: Array<{
    name: string;
    type: string;
    region: string;
    location: string | null;
    system: string | null;
  }>;
  primaryCategory: string;
  secondaryCategories: string[];
  subcategories: string[];
  maturitySignal: string;
  technologyFocus: string[];
  stakeholderImpact: string[];
  investmentSignal: {
    scale: string;
    amountUsd: number | null;
    description: string;
    fundingSource: string | null;
  } | null;
  collaborations: Array<{
    pattern: string;
    partners: string[];
    description: string;
  }>;
  toolsAndVendors: Array<{
    name: string;
    vendor: string;
    role: string;
  }>;
  hasPolicyImplications: boolean;
  policyImplications: string | null;
  sourceUrls: string[];
  imageUrl: string | null;
};

function parseInsightsFromResponse(text: string): RawInsight[] {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Find the JSON array boundaries
  const arrayStart = cleaned.indexOf("[");
  const arrayEnd = cleaned.lastIndexOf("]");
  if (arrayStart === -1 || arrayEnd === -1) {
    throw new Error("No JSON array found in response");
  }

  const jsonStr = cleaned.slice(arrayStart, arrayEnd + 1);
  const parsed = JSON.parse(jsonStr);

  if (!Array.isArray(parsed)) {
    throw new Error("Parsed result is not an array");
  }

  // Validate each insight has required fields
  for (const item of parsed) {
    if (!item.id || !item.title || !item.primaryCategory) {
      throw new Error(
        `Insight missing required fields: id=${item.id}, title=${item.title}, primaryCategory=${item.primaryCategory}`
      );
    }
  }

  return parsed as RawInsight[];
}

// ---------------------------------------------------------------------------
// Call Claude via Agent SDK
// ---------------------------------------------------------------------------

async function callClaude(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const q = query({
    prompt: userMessage,
    options: {
      model: MODEL,
      maxTurns: MAX_TURNS,
      permissionMode: "acceptEdits",
      systemPrompt,
      tools: [], // No tools needed for extraction — pure text in, JSON out
    },
  });

  let resultText = "";

  for await (const message of q) {
    if (message.type === "result") {
      if (message.subtype === "success") {
        resultText = message.result;
      } else {
        // SDKResultError
        const errorMsg =
          "result" in message ? String(message.result) : "Unknown error";
        throw new Error(`Claude query failed: ${errorMsg}`);
      }
    }
  }

  if (!resultText) {
    throw new Error("No result text received from Claude");
  }

  return resultText;
}

// ---------------------------------------------------------------------------
// Process a single update
// ---------------------------------------------------------------------------

async function extractUpdate(
  systemPrompt: string,
  updateId: string
): Promise<number> {
  const db = getDb();
  const raw = getRawUpdate(db, updateId);
  if (!raw) {
    throw new Error(`Update ${updateId} not found in database`);
  }

  logStage(db, updateId, STAGE, "running");

  const userMessage = buildUserMessage(raw);
  const responseText = await callClaude(systemPrompt, userMessage);
  const insights = parseInsightsFromResponse(responseText);

  // Store each insight
  const insertMany = db.transaction(() => {
    for (const insight of insights) {
      insertInsight(db, {
        id: insight.id,
        update_id: insight.updateId,
        timestamp_ms: insight.timestamp,
        date: insight.date,
        title: insight.title,
        description: insight.description,
        significance: insight.significance,
        institutions: insight.institutions,
        primary_category: insight.primaryCategory,
        secondary_categories: insight.secondaryCategories,
        subcategories: insight.subcategories,
        maturity_signal: insight.maturitySignal,
        technology_focus: insight.technologyFocus,
        stakeholder_impact: insight.stakeholderImpact,
        investment_signal: insight.investmentSignal,
        collaborations: insight.collaborations,
        tools_and_vendors: insight.toolsAndVendors,
        has_policy_implications: insight.hasPolicyImplications,
        policy_implications: insight.policyImplications,
        source_urls: insight.sourceUrls,
        image_url: insight.imageUrl,
        model_id: MODEL,
      });
    }
  });

  insertMany();
  logStage(db, updateId, STAGE, "completed");

  return insights.length;
}

// ---------------------------------------------------------------------------
// Exported entry point for pipeline orchestrator
// ---------------------------------------------------------------------------

export async function runExtraction(
  db: import("better-sqlite3").Database,
  limit = Infinity
): Promise<{ updatesProcessed: number; insightsExtracted: number }> {
  const pending = getUnprocessedUpdates(db, STAGE);
  const toProcess = pending.slice(0, Math.min(pending.length, limit));

  console.log(
    `[extract] ${pending.length} updates pending extraction, processing ${toProcess.length}`
  );

  if (toProcess.length === 0) {
    return { updatesProcessed: 0, insightsExtracted: 0 };
  }

  const systemPrompt = loadExtractionPrompt();
  let totalInsights = 0;
  let successCount = 0;
  let failCount = 0;
  let completed = 0;

  async function processOne(update: (typeof toProcess)[number]) {
    const date = new Date(update.timestamp_ms).toISOString().slice(0, 10);
    const idx = ++completed;
    console.log(
      `[extract] Processing ${update.update_id} (${date}) [${idx}/${toProcess.length}]`
    );

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[extract]   Retry ${attempt}/${MAX_RETRIES} for ${update.update_id}...`);
          await sleep(RETRY_DELAY_MS * attempt);
        }

        const count = await extractUpdate(systemPrompt, update.update_id);
        totalInsights += count;
        successCount++;
        console.log(`[extract]   Extracted ${count} insights from ${update.update_id}`);
        lastError = null;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(
          `[extract]   Error (attempt ${attempt + 1}) for ${update.update_id}: ${lastError.message}`
        );
      }
    }

    if (lastError) {
      failCount++;
      logStage(db, update.update_id, STAGE, "failed", lastError.message);
      console.error(
        `[extract]   FAILED after ${MAX_RETRIES + 1} attempts: ${update.update_id}`
      );
    }
  }

  // Process in batches of CONCURRENCY
  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(processOne));
  }

  console.log(
    `\n[extract] Done. ${successCount} succeeded, ${failCount} failed, ${totalInsights} total insights extracted.`
  );

  return { updatesProcessed: successCount, insightsExtracted: totalInsights };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const limitFlag = args.indexOf("--limit");
  const limit =
    limitFlag !== -1 ? parseInt(args[limitFlag + 1], 10) : Infinity;
  const dryRun = args.includes("--dry-run");

  const db = initDb();

  if (dryRun) {
    const pending = getUnprocessedUpdates(db, STAGE);
    console.log(`[extract] ${pending.length} updates pending extraction`);
    for (const update of pending) {
      const date = new Date(update.timestamp_ms).toISOString().slice(0, 10);
      console.log(`  [dry-run] Would extract: ${update.update_id} (${date})`);
    }
    return;
  }

  await runExtraction(db, limit);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[extract] Fatal error:", err);
    process.exit(1);
  });
}
