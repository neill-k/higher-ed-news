---
name: collect-institution
description: Build a comprehensive AI-posture profile for one higher-ed institution by doing live internet research and saving the result as a structured JSON file. Use when the user asks to research, profile, look up, or "collect data on" a specific university (e.g., "research Yale", "profile Vanderbilt's AI work", "build a profile for ASU", "collect data on University of Michigan"). Drives a multi-step web-research workflow followed by a script-based completeness check.
---

# Collect Institution

This skill drives the agent to **research one institution's AI posture from scratch using public web sources** and produce a validated JSON profile at `data/institutions/<slug>.json`.

## Hard rules

1. **Do NOT use the existing Yutori dataset** (`src/data/report-data.json` or anything under `data/pipeline.db`). This skill operates entirely from live web research. The Yutori pipeline is a parallel system; ignore it for this task.
2. **Cite every claim.** Every non-obvious fact in the profile must point to a specific URL in `source_urls` (per-initiative) or `research_quality.sources` (overall).
3. **Don't fabricate.** If you can't find something after a real search, write `null` and add a line to `research_quality.gaps_acknowledged`.
4. **Don't filter through any single role's lens.** The profile is sector-wide research. Cover all 8 trend categories and all 8 maturity dimensions; do not over-index on CIO / SEC / LSU framing.

## Schema

The profile must conform to [`data/institutions/_schema.json`](../../../data/institutions/_schema.json). Read it before starting. The schema covers:

- **Identity**: name, slug, city/state, Carnegie classification, institution type, system, control, enrollment
- **Leadership**: president, provost, CIO, chief AI officer (if any), AI strategy lead
- **AI strategy**: published strategy documents, summary
- **AI policy**: acceptable use, scope, stance (prohibitive | cautious | permissive | comprehensive), data privacy, regulatory compliance
- **Governance**: councils, committees, task forces, offices
- **Initiatives**: array of discrete actions (launches, partnerships, programs, centers, rollouts, policies). Each maps to the same dimensions as `research/insight-schema.ts`: primary/secondary categories, subcategories, maturity, adoption stage, technology focus, stakeholder impact, investment, collaborations, tools/vendors, policy stance.
- **Inventories**: research centers, AI academic programs, enterprise platforms, computing infrastructure, investments/gifts, industry/research partnerships, student-facing AI, equity initiatives
- **Context**: regulatory_context (state and system-level AI policy), controversies/litigation
- **Analytics signals**: computed archetype, policy quality, academic reality, research enterprise, student impact, vendor exposure, outcome claims, risk readiness, and missing-data flags. These are populated by `npm run analytics:enrich` after the source-backed profile is saved.
- **Synthesis**: narrative_summary (200–400 words)
- **Provenance**: research_quality (sources, queries, gaps, confidence)

## The 8 trend categories and 49 subcategories

Initiatives must use these exact values (from [`research/insight-schema.ts`](../../../research/insight-schema.ts)):

1. **governance_and_policy** → acceptable_use_policy, institutional_ai_strategy, ai_ethics_framework, regulatory_compliance, data_privacy_and_security, syllabus_level_policy
2. **teaching_and_learning** → ai_literacy_requirement, ai_enhanced_pedagogy, ai_resilient_assessment, ai_tutoring_and_adaptive_learning, faculty_training_and_development, ai_in_specific_disciplines, ai_degree_program
3. **research_and_innovation** → ai_research_center, industry_academic_partnership, ai_for_scientific_discovery, computing_infrastructure, open_source_contribution, cross_border_research_alliance
4. **student_experience_and_services** → ai_chatbot_or_virtual_assistant, predictive_analytics_retention, ai_in_admissions_and_enrollment, personalized_student_support, career_and_workforce_readiness, mental_health_and_wellbeing
5. **enterprise_tools_and_infrastructure** → campus_wide_platform_rollout, lms_embedded_ai, ai_vendor_partnership, data_infrastructure_and_unification, ai_powered_admin_tools, cybersecurity_and_ai_risk
6. **workforce_and_economic_development** → ai_workforce_training, ai_incubator_or_startup_support, industry_certification_pathway, community_college_ai_program, continuing_and_executive_education, regional_economic_impact
7. **equity_access_and_inclusion** → digital_divide_and_access, ai_tool_equity, algorithmic_bias, multilingual_and_culturally_responsive_ai, disability_and_accessibility, underrepresented_student_support
8. **institutional_transformation** → business_model_disruption, ai_and_degree_value, liberal_arts_in_ai_era, institutional_restructuring, ai_native_institution, faculty_role_evolution

## Workflow

Follow these steps in order. Use `WebSearch` and `WebFetch` for everything; do not read the Yutori data files.

### Step 1 — Confirm the institution

- If the user gave a short name or ambiguous name, search to resolve it (e.g., "Michigan" → University of Michigan-Ann Arbor or Michigan State?).
- If applicable, cross-check against [`data/r1-institutions.json`](../../../data/r1-institutions.json) for the canonical Carnegie name and system membership.
- Fix the canonical institution name and slug (`lowercase-hyphenated`, e.g., `university-of-michigan-ann-arbor`).

### Step 2 — Plan the research

Build a checklist covering each top-level schema section. Plan at least one targeted search per section. Don't rush a single broad search — depth beats breadth.

### Step 3 — Execute the searches

Run one or more `WebSearch` calls per dimension. Suggested query patterns (substitute the institution name):

| Dimension | Search queries |
|---|---|
| Strategy | `"<institution>" AI strategy 2025 2026`, `"<institution>" AI roadmap site:edu` |
| Policy | `"<institution>" acceptable use policy AI`, `"<institution>" generative AI guidelines faculty staff` |
| Governance | `"<institution>" AI council OR committee OR task force`, `"<institution>" chief AI officer` |
| Leadership | `"<institution>" CIO`, `"<institution>" provost`, `"<institution>" president` |
| Research centers | `"<institution>" AI research center OR institute`, `"<institution>" AI lab launch` |
| Academic programs | `"<institution>" AI degree OR certificate OR major OR minor`, `"<institution>" artificial intelligence curriculum` |
| Enterprise platforms | `"<institution>" Microsoft Copilot OR Google Gemini OR ChatGPT Edu OR Codex for Education`, `"<institution>" campus-wide AI deployment` |
| Computing infrastructure | `"<institution>" GPU cluster OR supercomputer OR HPC AI` |
| Investment / gifts | `"<institution>" AI gift OR donation OR endowment million`, `"<institution>" NSF AI grant` |
| Partnerships | `"<institution>" AI partnership announcement`, `"<institution>" MOU AI` |
| Student services | `"<institution>" AI chatbot students`, `"<institution>" predictive analytics retention` |
| Equity / access | `"<institution>" AI equity OR digital divide`, `"<institution>" AI accessibility` |
| State context | `"<state>" higher education AI policy`, `"<state>" AI executive order universities` |
| Controversy | `"<institution>" AI lawsuit OR controversy OR FERPA`, `"<institution>" AI cheating policy violation` |

For high-priority hits, follow up with `WebFetch` on the source URL to get details (dates, amounts, named partners, exact policy language).

### Step 4 — Build the profile JSON

- Normalize every initiative to the schema. Each initiative gets exactly one `primary_category`, can have `secondary_categories`, must have `subcategories` from the canonical list, and must include `source_urls`.
- For investments: convert to USD if stated in another currency; set `amount_usd` to `null` if not disclosed.
- For policy stance: pick the closest match. "Faculty discretion" → `permissive`. "Outright ban" → `prohibitive`. "Detailed guidance with ethics framework" → `comprehensive`.
- For tools/vendors: name both the product (`Lumi Pro`) and the vendor (`D2L`).

### Step 5 — Save the profile

Write to `data/institutions/<slug>.json`. Use the institution's canonical Carnegie name in the `institution` field and the kebab-case slug as both filename and `slug` field.

### Step 6 — Validate

First populate the computed analytics layer:

```bash
npm run analytics:enrich
```

Then validate:

Run:

```bash
npm run validate:institution -- <slug>
```

The validator (which has no Yutori dependency) will:
- Check every required top-level section is populated
- Check every enum value is from the canonical list
- Compute coverage against the 8 categories, 49 subcategories, 11 technology focus areas, 9 stakeholder groups, 5 adoption stages, 5 investment scales, 7 collaboration patterns, 5 policy stances, 8 maturity dimensions
- Report errors (must fix), warnings (should fix), and a final PASS/FAIL verdict
- Exit non-zero if any errors

### Step 7 — Iterate on gaps

If the validator reports errors or major coverage gaps, **go back to Step 3** and run more targeted searches. Don't ship a profile with all-zero categories or an empty initiatives array unless the institution genuinely has no public AI activity (rare for an R1).

Acceptable to ship when:
- All required schema fields are populated (or explicitly null with `gaps_acknowledged` entry)
- At least 5 initiatives recorded
- At least 4 of 8 trend categories touched
- At least 5 of 8 maturity dimensions evidenced
- `research_quality.confidence` honestly reflects the depth of search

### Step 8 — Report to the user

Present:
1. Headline summary (2–3 sentences): institution name, type/system, # initiatives, # categories covered, total disclosed investment, AI policy stance.
2. Validator output (or summary of it).
3. Acknowledged gaps and suggested follow-up if the user wants deeper coverage.

## CLI quick reference

```bash
# Validate a profile after saving it
npm run analytics:enrich
npm run validate:institution -- yale-university

# JSON output (machine-readable)
npm run validate:institution -- yale-university --json

# List all saved profiles
npm run validate:institution -- --list

# Validate by full path
npm run validate:institution -- data/institutions/yale-university.json
```

## Files this skill touches

- Reads: `data/institutions/_schema.json`, `data/r1-institutions.json`, `research/insight-schema.ts`
- Writes: `data/institutions/<slug>.json`
- Runs: `scripts/validate-institution.ts`

## What this skill does NOT do

- Does not query `src/data/report-data.json` or `data/pipeline.db`
- Does not call the Yutori scout API
- Does not run any of the `pipeline:*` npm scripts
- Does not edit Next.js pages, components, or report content
