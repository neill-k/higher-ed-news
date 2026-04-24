# R1 AI Analytics Methodology

This note holds the implementation and methodology details that should not appear in the public-facing `/new` web surface. The web page should describe what the evidence says about R1 AI activity; this file can describe how the evidence was shaped into analyzable data.

## Current Corpus

- Scope: 187 Carnegie R1 universities.
- Profile source: `data/institutions/*.json`.
- Digest source: `data/institutions/_r1-digest.json`.
- Current digest timestamp: `2026-04-24T05:32:59.858Z`.
- Current profile count: 187 present, 0 missing.
- Current initiative count: 1,883 public AI initiatives.
- Current source count: 5,320 cited sources.
- Current disclosed-dollar floor: $26,227,405,486.

## Analytics Signals Layer

The `analytics_signals` fields are derived classification fields. They are not source facts; they are interpretation helpers that make the profile corpus easier to summarize with ordinary BI and spreadsheet workflows.

Signal groups include:

- Strategic archetype: platform-first, research-compute powerhouse, curriculum-led, governance-led, student-success led, workforce/regional development, balanced enterprise, or thin public signal.
- Policy quality: whether the public record shows an acceptable-use policy, published AI strategy, dedicated AI role, and other governance signals.
- Academic reality: teaching, curriculum, assessment, and faculty-support evidence.
- Research enterprise: compute posture, research infrastructure, and AI research activity.
- Student impact: student-facing initiatives and student-success claims.
- Vendor exposure: named tools, vendor parents, and platform-dependency signals.
- Outcome claims: usage/adoption, learning, productivity, career/workforce, student success, cost/revenue, and research-output claims.
- Risk readiness: inferred public posture around risk, governance, and operational maturity.
- Missing-data flags: operational questions the public record does not yet answer well.

## Export Layer

The conventional analytics export is generated under `output/analytics`. Arrays in source profiles are flattened into bridge tables keyed by institution slug and, where appropriate, initiative ID.

Current export tables:

- `institutions.csv`: one row per institution.
- `initiatives.csv`: one row per public AI initiative.
- `initiative_categories.csv`: initiative-to-category bridge.
- `initiative_subcategories.csv`: initiative-to-subcategory bridge.
- `initiative_technologies.csv`: initiative-to-technology bridge.
- `initiative_stakeholders.csv`: initiative-to-stakeholder bridge.
- `initiative_tools.csv`: initiative-to-tool/vendor bridge.
- `initiative_collaborations.csv`: initiative-to-collaboration bridge.
- `initiative_sources.csv`: initiative-to-source bridge.
- `profile_gaps.csv`: profile-level research gaps.
- `institution_analytics_signals.csv`: one row per institution of derived posture fields.
- `institution_analytics_gaps.csv`: one row per institution and missing-data type.
- `institution_outcome_claims.csv`: one row per institution and outcome-claim type.
- `institution_vendor_exposure.csv`: one row per institution and normalized vendor parent.
- `summary.json`: aggregate counts used by the report pages.

## Commands

Run these from the repository root:

```powershell
npm run validate:institution -- --all
npm run analytics:enrich
npm run analytics:institutions
```

Use validation before publishing a new sweep. Use enrichment when profile schema fields or derived signal rules change. Use the analytics export after data collection or enrichment so the digest, CSV tables, and `/new` route stay aligned.

## Public Web Copy Rule

The `/new` page should avoid self-referential implementation language such as schema, enrichment layer, export layer, CSV names, bridge tables, validators, generated-by script names, or internal data paths. Those details belong here.

Public-facing exhibits should instead name the substantive evidence base, for example:

- R1 public-source profile review.
- Carnegie R1 index and R1 public-source profile review.
- Public source review, as of April 2026.

The public page may discuss evidence limitations, missing disclosures, and unknowns. It should not describe its own data plumbing.
