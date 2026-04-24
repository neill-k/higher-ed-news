---
name: r1-university-news
description: Fan-out research across all 187 R1 (Carnegie 2025) universities by spawning a team of 30 parallel subagents, each invoking the collect-institution skill on a slice of the R1 list. Use when the user asks to "research all R1 universities", "build R1 profiles", "run R1 university news", "collect data on all R1s", or any sweep across the full R1 cohort. Long-running and expensive — confirm scope with the user before kicking off.
---

# R1 University News

This skill orchestrates a parallel research sweep across **every R1 institution** in the 2025 Carnegie Classification (187 universities). It spawns a team of 30 subagents that each invoke the [`collect-institution`](../collect-institution/SKILL.md) skill on a slice of the list, then aggregates the results into an R1-wide digest.

## Prerequisites

- The `collect-institution` skill must be available (it is — at `.Codex/skills/collect-institution/SKILL.md`).
- The R1 list must exist at [`data/r1-institutions.json`](../../../data/r1-institutions.json) (187 institutions).
- The schema at [`data/institutions/_schema.json`](../../../data/institutions/_schema.json) defines the per-institution output shape.
- The validator at `scripts/validate-institution.ts` checks each profile.

## Scope warning — confirm before starting

This sweep is **expensive and slow**:
- 187 institutions × ~10 web searches each = ~1,800 web requests
- Each profile takes minutes of subagent time
- Total wall-clock: 30–90 minutes depending on how the team distributes work
- Cost: substantial Codex usage across 30 parallel subagents

Before running, surface this to the user and confirm they want the full sweep. Offer alternatives:
- A smaller sample (e.g., the 16 Texas R1s, the 10 UC campuses, the 14 SEC R1s)
- Top-N by enrollment or research spending
- A dry run of 5 to validate the workflow first

## Workflow

### Step 1 — Load the R1 list

```ts
const r1 = JSON.parse(readFileSync("data/r1-institutions.json", "utf-8"));
// r1.institutions is an array of 187 { name, state, system } objects
```

### Step 2 — Slice into 30 batches

Distribute 187 institutions across 30 workers as evenly as possible — 23 workers get 6 universities each, 7 workers get 7 each (23×6 + 7×7 = 138 + 49 = 187). Use a simple chunked split:

```ts
const N_WORKERS = 30;
const batches: Array<typeof r1.institutions> = Array.from({ length: N_WORKERS }, () => []);
r1.institutions.forEach((inst, idx) => {
  batches[idx % N_WORKERS].push(inst);
});
```

### Step 3 — Spawn the team of 30 subagents in parallel

Make a **single message with 30 Agent tool calls**. All run in background; the runtime notifies you as each completes. Each subagent gets a self-contained prompt with its slice and instructions.

For each batch (`batchIndex` 1..30):

```
Agent({
  description: "R1 batch <N>: research <K> universities",
  subagent_type: "general-purpose",
  name: "r1-batch-<N>",
  team_name: "r1-collectors",
  run_in_background: true,
  prompt: `
You are one of 30 parallel agents collecting AI-posture profiles for R1 universities.
Your batch contains the following <K> institutions:

<NUMBERED LIST OF UNIVERSITIES IN THIS BATCH, e.g.:
  1. Yale University (CT)
  2. University of Connecticut (CT)
  3. Boston University (MA)
  ...
>

For EACH university in your batch, in order:

1. Read .Codex/skills/collect-institution/SKILL.md and follow its workflow exactly.
   That skill instructs you to do live internet research (WebSearch + WebFetch), build a
   profile JSON conforming to data/institutions/_schema.json, save it to
   data/institutions/<slug>.json, and validate it with
   \`npm run validate:institution -- <slug>\`.

2. Use a kebab-case slug derived from the canonical Carnegie name (e.g., 'yale-university',
   'university-of-connecticut'). Cross-check the canonical name against
   data/r1-institutions.json.

3. Set institution_type to "r1_research" for every university in this batch.

4. If a profile already exists at data/institutions/<slug>.json, skip it (do not overwrite).

5. If the validator reports errors for a university, attempt one round of follow-up
   research to fill gaps, then move on. Do not block the batch on a single hard case.

6. Report back with: a) which universities you completed (slug + initiative count + validator
   verdict), b) which you skipped (and why), c) any errors that prevented completion.

Do NOT use the Yutori dataset (src/data/report-data.json or data/pipeline.db). All data
must come from live web research.

Work through your batch sequentially. When done, return a concise summary.
`
})
```

Send all 30 of these in one tool-use message so they run truly in parallel.

### Step 4 — Wait for completions

Do **not** poll, sleep, or check on agent progress. The runtime notifies you automatically when each background agent completes. While waiting, you can:
- Respond to other user messages
- Aggregate results from already-completed batches incrementally

When you receive notifications, note which batches finished. After all 30 have completed, proceed to aggregation.

### Step 5 — Aggregate

Once all 30 batches finish:

1. **List the saved profiles**:
   ```bash
   npm run validate:institution -- --list
   ```

2. **Validate each profile** and collect the JSON output:
   ```bash
   for slug in $(ls data/institutions/*.json | grep -v _schema | xargs -n1 basename | sed 's/.json//'); do
     npm run validate:institution -- "$slug" --json > /tmp/$slug.cov.json
   done
   ```

   (Or write a small helper script if you prefer to do this in Node.)

3. **Build the R1-wide digest**:
   - Total profiles produced (X / 187 expected)
   - Profiles that PASSED vs FAILED validation
   - Aggregate coverage: total initiatives across all R1s, by category and subcategory
   - Top institutions by initiative count, by disclosed investment, by maturity-dimension breadth
   - Most-cited vendors and partners across the cohort
   - Geographic distribution of initiatives (state, region)
   - Common gaps (which dimensions are most often empty across the cohort)

4. **Save the digest** to `data/institutions/_r1-digest.json` with a `generated_at` timestamp and a summary section.

### Step 6 — Report to the user

Present:
1. **Sweep stats**: profiles produced, failures, total wall-clock time.
2. **Top-line findings** from the aggregate digest (3–5 bullets).
3. **Notable gaps**: institutions where the team couldn't find enough public data, or batches that errored.
4. **Next steps**: offer to deepen specific institutions, re-run failed ones, or filter the digest by region/system/state.

## Variants the user may ask for

- **"Run it for SEC R1s only"** → filter `r1.institutions` to the 14 SEC schools' universities first
- **"Run it for the 10 UC campuses"** → filter where `system === "University of California"`
- **"Just Texas R1s"** → filter where `state === "TX"` (16 institutions)
- **"Resume after a partial failure"** → list existing profiles in `data/institutions/`, build the queue from R1 list MINUS already-saved slugs, then proceed

## Hard rules

1. **Always confirm scope with the user before launching the full 187-university sweep.** This is expensive.
2. **Spawn all 30 subagents in a single tool-use message** so they truly run in parallel, not sequentially.
3. **Use `run_in_background: true`** for every spawn so notifications drive the workflow.
4. **Do not poll or sleep.** The runtime notifies on completion.
5. **No Yutori dependency.** Subagents must use `collect-institution` (live web research only).
6. **Idempotent**: if a profile already exists for a slug, the subagent skips it. This makes the sweep safe to re-run.
7. **Don't over-customize per institution.** The collect-institution skill already handles per-institution variation; the orchestrator just distributes work.

## Failure modes

| Symptom | Cause | Action |
|---|---|---|
| A batch returns no completed profiles | Subagent hit an error early | Inspect its output, re-spawn just that batch |
| Many profiles fail validation | Schema enum drift or rushed research | Tighten the collect-institution prompt; re-run the failed slugs |
| Wall-clock too long | Big universities have lots to research | Reduce to 15 workers (more universities per worker, fewer parallel browsers) or filter the cohort |
| Notifications don't arrive | Background spawning broken | Switch to foreground for one batch as a smoke test |

## CLI quick reference

```bash
# After the sweep, list what was produced
npm run validate:institution -- --list

# Validate a specific institution
npm run validate:institution -- yale-university

# Get JSON output for aggregation
npm run validate:institution -- yale-university --json
```

## Files this skill touches

- Reads: `data/r1-institutions.json`, `.Codex/skills/collect-institution/SKILL.md`, `data/institutions/_schema.json`
- Writes: `data/institutions/<slug>.json` (one per R1, via subagents), `data/institutions/_r1-digest.json` (aggregate)
- Spawns: 30 parallel `general-purpose` subagents under team name `r1-collectors`
