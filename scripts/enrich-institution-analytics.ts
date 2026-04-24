/**
 * Add analytics-oriented signals to every collected institution profile.
 *
 * This does not replace source research. It extracts a decision-support layer
 * from the existing source-backed profile fields so the portal can answer
 * "what is going on?" questions without flattening everything to counts.
 */

import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { computeAnalyticsSignals } from "./institution-analytics-enrichment";

const PROFILE_DIR = join(__dirname, "..", "data", "institutions");

function loadProfilePaths() {
  return readdirSync(PROFILE_DIR)
    .filter((file) => file.endsWith(".json") && !file.startsWith("_"))
    .sort()
    .map((file) => join(PROFILE_DIR, file));
}

function main() {
  const paths = loadProfilePaths();
  let changed = 0;

  for (const profilePath of paths) {
    const profile = JSON.parse(readFileSync(profilePath, "utf8"));
    const analyticsSignals = computeAnalyticsSignals(profile);
    const previous = JSON.stringify(profile.analytics_signals ?? null);
    const next = JSON.stringify(analyticsSignals);

    if (previous !== next) {
      profile.analytics_signals = analyticsSignals;
      writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`);
      changed += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        profiles: paths.length,
        changed,
        field: "analytics_signals",
      },
      null,
      2,
    ),
  );
}

main();
