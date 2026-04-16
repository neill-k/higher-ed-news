# Agent Prompt Templates for Insight Extraction Pipeline

These prompts instruct Claude to extract structured data from raw Yutori Scout HTML updates and produce insights matching the TypeScript types defined in `src/lib/insight-schema.ts`.

**Pipeline flow:**
1. Initiative Extractor: raw HTML -> `ExtractedInsight[]`
2. Update Synthesizer: `ExtractedInsight[]` for one update -> `UpdateInsightBundle`
3. Trend Analyzer: all `UpdateInsightBundle[]` -> `TrendLine[]`, `DetectedTension[]`, `InstitutionMaturityScore[]`
4. Report Generator: `TrendReportData` -> McKinsey/Meeker-quality report sections

---

## Prompt 1: Initiative Extractor

**Input:** A single Yutori Scout update object (JSON with `id`, `timestamp`, `content` (HTML), `citations`, `header_image_url`).
**Output:** An array of `ExtractedInsight` objects (one per initiative).

```
You are an expert higher education analyst. Extract every distinct university AI initiative from a Yutori Scout update and return structured JSON.

## Input

You will receive a JSON object with these fields:
- `id` (string): Update UUID
- `timestamp` (number): Unix timestamp in milliseconds
- `content` (string): HTML content of the update
- `citations` (array): Citation objects with `url` and `preview_data`
- `header_image_url` (string | null): Header image

## Content Format Variations

Updates come in TWO distinct formats. You must handle both:

**Format A — Structured em-dash bullets (~35% of corpus, more common in recent updates):**
```html
<ul>
  <li><b>Institution Name — Initiative Title</b> (Category; Date): Description. <a href="..."></a></li>
</ul>
```

**Format B — Narrative paragraphs (~65% of corpus, more common in older updates):**
```html
<p><b>Institution Name</b> announced/launched/introduced [initiative description]... <a href="..."></a></p>
```
Or bullet lists without the em-dash separator:
```html
<ul>
  <li><b>Institution Name</b> description of initiative. <a href="..."></a></li>
</ul>
```

Extract every distinct initiative from BOTH formats.

## Output Schema

Return a JSON array. Each element is an `ExtractedInsight` object:

```json
[
  {
    "id": "{updateId}_{0-based index}",
    "updateId": "the update UUID",
    "timestamp": 1776297604853,
    "date": "2026-04-15",

    "title": "Short initiative title",
    "description": "One paragraph describing what happened",
    "significance": "Why this matters for the sector",

    "institutions": [
      {
        "name": "Full official institution name",
        "type": "r1_research | r2_research | comprehensive_regional | liberal_arts | community_college | online_for_profit | professional_school | minority_serving | international | system_or_consortium | unknown",
        "region": "us_northeast | us_southeast | us_midwest | us_west | us_national | canada | united_kingdom | european_union | china | south_korea | japan | india | southeast_asia | australia_nz | latin_america | middle_east | sub_saharan_africa | multi_region | unknown",
        "location": "US state or country code (e.g., 'MA', 'Ontario', 'South Korea') or null",
        "system": "University system if applicable (e.g., 'UMass', 'SUNY', 'UC') or null"
      }
    ],

    "primaryCategory": "governance_and_policy | teaching_and_learning | research_and_innovation | student_experience_and_services | enterprise_tools_and_infrastructure | workforce_and_economic_development | equity_access_and_inclusion | institutional_transformation",
    "secondaryCategories": [],
    "subcategories": ["specific subcategory from the TREND_SUBCATEGORIES mapping"],
    "maturitySignal": "emerging | growing | mainstream | declining",

    "technologyFocus": ["large_language_models | generative_ai_multimodal | predictive_analytics_ml | agentic_ai | ai_search_and_retrieval | computer_vision | nlp_for_assessment | robotics_and_physical_ai | quantum_and_ai | general_ai | unspecified"],
    "stakeholderImpact": ["students | faculty | administrators | researchers | board_and_trustees | accreditors | government_and_regulators | employers | community"],

    "investmentSignal": {
      "scale": "major | significant | moderate | exploratory | unknown",
      "amountUsd": null,
      "description": "What the investment is for",
      "fundingSource": "alumni gift | NSF grant | state funding | etc., or null"
    },

    "collaborations": [
      {
        "pattern": "industry_academic | cross_institution | international | government_academic | community_academic | startup_academic | none",
        "partners": ["Partner name"],
        "description": "Nature of collaboration"
      }
    ],

    "toolsAndVendors": [
      {
        "name": "Product name (e.g., 'D2L Lumi Pro')",
        "vendor": "Company name (e.g., 'D2L')",
        "role": "How it is being used"
      }
    ],

    "hasPolicyImplications": false,
    "policyImplications": null,

    "sourceUrls": ["https://..."],
    "imageUrl": null
  }
]
```

## Enum Reference

### Subcategories by primary category

- **governance_and_policy**: acceptable_use_policy, institutional_ai_strategy, ai_ethics_framework, regulatory_compliance, data_privacy_and_security, syllabus_level_policy
- **teaching_and_learning**: ai_literacy_requirement, ai_enhanced_pedagogy, ai_resilient_assessment, ai_tutoring_and_adaptive_learning, faculty_training_and_development, ai_in_specific_disciplines, ai_degree_program
- **research_and_innovation**: ai_research_center, industry_academic_partnership, ai_for_scientific_discovery, computing_infrastructure, open_source_contribution, cross_border_research_alliance
- **student_experience_and_services**: ai_chatbot_or_virtual_assistant, predictive_analytics_retention, ai_in_admissions_and_enrollment, personalized_student_support, career_and_workforce_readiness, mental_health_and_wellbeing
- **enterprise_tools_and_infrastructure**: campus_wide_platform_rollout, lms_embedded_ai, ai_vendor_partnership, data_infrastructure_and_unification, ai_powered_admin_tools, cybersecurity_and_ai_risk
- **workforce_and_economic_development**: ai_workforce_training, ai_incubator_or_startup_support, industry_certification_pathway, community_college_ai_program, continuing_and_executive_education, regional_economic_impact
- **equity_access_and_inclusion**: digital_divide_and_access, ai_tool_equity, algorithmic_bias, multilingual_and_culturally_responsive_ai, disability_and_accessibility, underrepresented_student_support
- **institutional_transformation**: business_model_disruption, ai_and_degree_value, liberal_arts_in_ai_era, institutional_restructuring, ai_native_institution, faculty_role_evolution

### Investment scale thresholds

- **major**: >$10M (endowments, data centers, supercomputers)
- **significant**: $1M-$10M (center launches, enterprise licenses)
- **moderate**: $100K-$1M (pilots, partnerships, MOUs)
- **exploratory**: <$100K (task forces, workshops, guidelines)
- **unknown**: amount not disclosed

### US region mapping

- **us_northeast**: CT, DE, DC, ME, MD, MA, NH, NJ, NY, PA, RI, VT
- **us_southeast**: AL, AR, FL, GA, KY, LA, MS, NC, SC, TN, VA, WV
- **us_midwest**: IL, IN, IA, KS, MI, MN, MO, NE, ND, OH, SD, WI
- **us_west**: AK, AZ, CA, CO, HI, ID, MT, NV, NM, OR, UT, WA, WY

## Few-Shot Examples

### Example 1: Format A (Structured em-dash)

**Input (abbreviated):**
```json
{
  "id": "c7d7a088-740a-4bf5-9683-aab4dbf596d4",
  "timestamp": 1776297604853,
  "content": "<h3>Teaching-first rollouts and a new AI center</h3>\n<p><b>Report Period:</b> April 14–15, 2026</p>\n<p><b>Topline:</b> Three notable university AI moves this period.</p>\n<ul>\n  <li><b>UMass Lowell — Center for AI Computing Research (AICORE)</b> (Research Center; Apr 15, 2026): Focus on foundational models and deployment in defense, healthcare, and robotics. Significance: expands institutional AI research capacity. <a href=\"https://www.uml.edu/myuml/Submissions/2026/2026-04-14-20-17-14-UMass-Lowell-Launches-Two-New-Resea.aspx\"></a></li>\n  <li><b>Vanderbilt University — D2L Lumi Pro rollout</b> (Enterprise tool; Apr 14, 2026): Lumi Quiz for AI-generated assessments, Lumi Ideas for content ideation, and Lumi Insights for engagement analytics; faculty-only via Brightspace. <a href=\"https://www.vanderbilt.edu/brightspace/2026/04/14/announcing-d2l-lumi-pro-at-vanderbilt/\"></a></li>\n  <li><b>Yale University — AI teaching and learning resources</b> (Teaching guidelines/resources; Apr 14, 2026): Guiding principles, AI-resilient assessment strategies, and student guidance; developed by the Office of the Provost (Poorvu Center); adaptable across disciplines. <a href=\"https://provost.yale.edu/news/resources-teaching-and-learning-ai\"></a></li>\n</ul>",
  "citations": [],
  "header_image_url": "https://www.uml.edu/images/about-uc-opt_tcm18-191308.jpg"
}
```

**Output:**
```json
[
  {
    "id": "c7d7a088-740a-4bf5-9683-aab4dbf596d4_0",
    "updateId": "c7d7a088-740a-4bf5-9683-aab4dbf596d4",
    "timestamp": 1776297604853,
    "date": "2026-04-15",
    "title": "Center for AI Computing Research (AICORE)",
    "description": "UMass Lowell launched AICORE, a new research center focused on foundational AI models and their deployment in defense, healthcare, and robotics.",
    "significance": "Expands institutional AI research capacity with applied focus areas, adding to the growing count of dedicated university AI research centers.",
    "institutions": [
      {
        "name": "University of Massachusetts Lowell",
        "type": "r1_research",
        "region": "us_northeast",
        "location": "MA",
        "system": "UMass"
      }
    ],
    "primaryCategory": "research_and_innovation",
    "secondaryCategories": [],
    "subcategories": ["ai_research_center"],
    "maturitySignal": "growing",
    "technologyFocus": ["robotics_and_physical_ai", "general_ai"],
    "stakeholderImpact": ["researchers", "faculty"],
    "investmentSignal": {
      "scale": "unknown",
      "amountUsd": null,
      "description": "New research center launch",
      "fundingSource": null
    },
    "collaborations": [],
    "toolsAndVendors": [],
    "hasPolicyImplications": false,
    "policyImplications": null,
    "sourceUrls": ["https://www.uml.edu/myuml/Submissions/2026/2026-04-14-20-17-14-UMass-Lowell-Launches-Two-New-Resea.aspx"],
    "imageUrl": "https://www.uml.edu/images/about-uc-opt_tcm18-191308.jpg"
  },
  {
    "id": "c7d7a088-740a-4bf5-9683-aab4dbf596d4_1",
    "updateId": "c7d7a088-740a-4bf5-9683-aab4dbf596d4",
    "timestamp": 1776297604853,
    "date": "2026-04-15",
    "title": "D2L Lumi Pro Rollout",
    "description": "Vanderbilt University deployed D2L Lumi Pro campus-wide, including Lumi Quiz for AI-generated assessments, Lumi Ideas for content ideation, and Lumi Insights for engagement analytics, available to faculty via Brightspace LMS.",
    "significance": "Signals institutional shift from AI experimentation to production deployment within core teaching workflows, embedding generative AI directly into the LMS.",
    "institutions": [
      {
        "name": "Vanderbilt University",
        "type": "r1_research",
        "region": "us_southeast",
        "location": "TN",
        "system": null
      }
    ],
    "primaryCategory": "enterprise_tools_and_infrastructure",
    "secondaryCategories": ["teaching_and_learning"],
    "subcategories": ["lms_embedded_ai", "ai_vendor_partnership"],
    "maturitySignal": "growing",
    "technologyFocus": ["generative_ai_multimodal", "nlp_for_assessment"],
    "stakeholderImpact": ["faculty", "students"],
    "investmentSignal": {
      "scale": "significant",
      "amountUsd": null,
      "description": "Campus-wide enterprise AI tool license",
      "fundingSource": null
    },
    "collaborations": [
      {
        "pattern": "industry_academic",
        "partners": ["D2L"],
        "description": "Vendor partnership for LMS-embedded AI tools"
      }
    ],
    "toolsAndVendors": [
      {
        "name": "D2L Lumi Pro",
        "vendor": "D2L",
        "role": "AI-generated assessments, content ideation, and engagement analytics within Brightspace LMS"
      }
    ],
    "hasPolicyImplications": false,
    "policyImplications": null,
    "sourceUrls": ["https://www.vanderbilt.edu/brightspace/2026/04/14/announcing-d2l-lumi-pro-at-vanderbilt/"],
    "imageUrl": null
  },
  {
    "id": "c7d7a088-740a-4bf5-9683-aab4dbf596d4_2",
    "updateId": "c7d7a088-740a-4bf5-9683-aab4dbf596d4",
    "timestamp": 1776297604853,
    "date": "2026-04-15",
    "title": "AI Teaching and Learning Resources",
    "description": "Yale University published comprehensive AI teaching and learning resources developed by the Office of the Provost (Poorvu Center), including guiding principles, AI-resilient assessment strategies, and student guidance adaptable across disciplines.",
    "significance": "Reflects a shift from ad hoc course-level AI policies to structured, institution-wide, discipline-agnostic frameworks at elite research universities.",
    "institutions": [
      {
        "name": "Yale University",
        "type": "r1_research",
        "region": "us_northeast",
        "location": "CT",
        "system": null
      }
    ],
    "primaryCategory": "teaching_and_learning",
    "secondaryCategories": ["governance_and_policy"],
    "subcategories": ["ai_enhanced_pedagogy", "ai_resilient_assessment", "faculty_training_and_development"],
    "maturitySignal": "growing",
    "technologyFocus": ["general_ai"],
    "stakeholderImpact": ["faculty", "students", "administrators"],
    "investmentSignal": null,
    "collaborations": [],
    "toolsAndVendors": [],
    "hasPolicyImplications": true,
    "policyImplications": "Establishes provost-level institutional framework for AI use in teaching, setting a precedent for how elite universities govern classroom AI adoption.",
    "sourceUrls": ["https://provost.yale.edu/news/resources-teaching-and-learning-ai"],
    "imageUrl": null
  }
]
```

### Example 2: Format B (Narrative paragraphs)

**Input (abbreviated):**
```json
{
  "id": "54d5b83e-2327-43a5-bb18-6de5cddfb2e9",
  "timestamp": 1776211203510,
  "content": "<h3>New university AI centers, policies, and partnerships</h3>\n<p>I'm tracking notable moves from April 13-14, 2026. Nine new initiatives span research centers, curriculum changes, classroom policy, enterprise tools, and multi-institution partnerships.</p>\n<ul>\n  <li><b>Santa Clara University</b> established the Cunningham Shoquist Center for Applied AI and Human Potential with a $24.6M gift, focusing on responsible AI across research, education, and community engagement. <a href=\"https://www.scu.edu/news-and-events/press-releases/2026/april/news/santa-clara-university-establishes-the-cunningham-shoquist-center-for-applied-ai-and-human-potential.html\"></a></li>\n  <li><b>SUNY (Stony Brook)</b> introduced a Department of Technology, AI and Society with SUNY support, highlighted at the SUNY AI Symposium. <a href=\"https://www.suny.edu/suny-news/press-releases/4-26/4-14-26/ai.html\"></a></li>\n  <li><b>Golden Gate University</b> unveiled GGU Digital, an AI-powered global education platform launching August 2026 to deliver affordable, accredited, multilingual degrees with AI-enabled instruction. <a href=\"https://ggu.edu/2026/04/13/announcing-ggu-digital-an-ai-global-education-platform/\"></a></li>\n</ul>",
  "citations": [{"id": "0", "url": "https://ggu.edu/2026/04/13/announcing-ggu-digital-an-ai-global-education-platform/", "preview_data": {"title": "Golden Gate University Announces GGU Digital"}}],
  "header_image_url": "https://polsky.uchicago.edu/wp-content/uploads/2021/11/uchicago-drone-shot-scaled.jpg"
}
```

**Output:**
```json
[
  {
    "id": "54d5b83e-2327-43a5-bb18-6de5cddfb2e9_0",
    "updateId": "54d5b83e-2327-43a5-bb18-6de5cddfb2e9",
    "timestamp": 1776211203510,
    "date": "2026-04-14",
    "title": "Cunningham Shoquist Center for Applied AI and Human Potential",
    "description": "Santa Clara University established the Cunningham Shoquist Center for Applied AI and Human Potential, funded by a $24.6M gift, focusing on responsible AI across research, education, and community engagement.",
    "significance": "One of the largest disclosed philanthropic investments in university AI research, with an explicit responsible-AI mandate connecting industry leadership to academic institution building.",
    "institutions": [
      {
        "name": "Santa Clara University",
        "type": "comprehensive_regional",
        "region": "us_west",
        "location": "CA",
        "system": null
      }
    ],
    "primaryCategory": "research_and_innovation",
    "secondaryCategories": ["equity_access_and_inclusion"],
    "subcategories": ["ai_research_center"],
    "maturitySignal": "growing",
    "technologyFocus": ["general_ai"],
    "stakeholderImpact": ["researchers", "faculty", "community"],
    "investmentSignal": {
      "scale": "major",
      "amountUsd": 24600000,
      "description": "Endowed center for applied AI research",
      "fundingSource": "alumni gift"
    },
    "collaborations": [],
    "toolsAndVendors": [],
    "hasPolicyImplications": false,
    "policyImplications": null,
    "sourceUrls": ["https://www.scu.edu/news-and-events/press-releases/2026/april/news/santa-clara-university-establishes-the-cunningham-shoquist-center-for-applied-ai-and-human-potential.html"],
    "imageUrl": "https://polsky.uchicago.edu/wp-content/uploads/2021/11/uchicago-drone-shot-scaled.jpg"
  },
  {
    "id": "54d5b83e-2327-43a5-bb18-6de5cddfb2e9_1",
    "updateId": "54d5b83e-2327-43a5-bb18-6de5cddfb2e9",
    "timestamp": 1776211203510,
    "date": "2026-04-14",
    "title": "Department of Technology, AI and Society",
    "description": "SUNY Stony Brook introduced a new Department of Technology, AI and Society with SUNY system support, announced at the SUNY AI Symposium.",
    "significance": "A state university system creating a dedicated AI department signals institutional commitment beyond centers and programs, embedding AI into the permanent academic structure.",
    "institutions": [
      {
        "name": "Stony Brook University",
        "type": "r1_research",
        "region": "us_northeast",
        "location": "NY",
        "system": "SUNY"
      }
    ],
    "primaryCategory": "teaching_and_learning",
    "secondaryCategories": ["institutional_transformation"],
    "subcategories": ["ai_degree_program"],
    "maturitySignal": "growing",
    "technologyFocus": ["general_ai"],
    "stakeholderImpact": ["students", "faculty", "administrators"],
    "investmentSignal": {
      "scale": "significant",
      "amountUsd": null,
      "description": "New academic department creation",
      "fundingSource": "state system support"
    },
    "collaborations": [],
    "toolsAndVendors": [],
    "hasPolicyImplications": true,
    "policyImplications": "Creates a permanent institutional home for AI-society scholarship, which may influence AI governance approaches across the SUNY system.",
    "sourceUrls": ["https://www.suny.edu/suny-news/press-releases/4-26/4-14-26/ai.html"],
    "imageUrl": null
  },
  {
    "id": "54d5b83e-2327-43a5-bb18-6de5cddfb2e9_2",
    "updateId": "54d5b83e-2327-43a5-bb18-6de5cddfb2e9",
    "timestamp": 1776211203510,
    "date": "2026-04-14",
    "title": "GGU Digital AI-Powered Global Education Platform",
    "description": "Golden Gate University unveiled GGU Digital, an AI-powered global education platform launching August 2026 to deliver affordable, accredited, multilingual degrees with AI-enabled instruction.",
    "significance": "Represents an early example of an AI-native institution model, using AI not as a supplement but as the core delivery infrastructure for accredited degrees at global scale.",
    "institutions": [
      {
        "name": "Golden Gate University",
        "type": "comprehensive_regional",
        "region": "us_west",
        "location": "CA",
        "system": null
      }
    ],
    "primaryCategory": "institutional_transformation",
    "secondaryCategories": ["equity_access_and_inclusion", "teaching_and_learning"],
    "subcategories": ["ai_native_institution", "business_model_disruption", "multilingual_and_culturally_responsive_ai"],
    "maturitySignal": "emerging",
    "technologyFocus": ["large_language_models", "generative_ai_multimodal"],
    "stakeholderImpact": ["students", "faculty", "employers"],
    "investmentSignal": {
      "scale": "significant",
      "amountUsd": null,
      "description": "AI-powered global education platform development",
      "fundingSource": null
    },
    "collaborations": [],
    "toolsAndVendors": [],
    "hasPolicyImplications": true,
    "policyImplications": "Raises questions about accreditation standards for AI-native degree delivery and whether current regulatory frameworks accommodate this model.",
    "sourceUrls": ["https://ggu.edu/2026/04/13/announcing-ggu-digital-an-ai-global-education-platform/"],
    "imageUrl": null
  }
]
```

## Rules

1. Extract EVERY distinct initiative. Do not skip initiatives even if they seem minor.
2. An initiative is a concrete action (launch, partnership, policy, program, center, rollout, curriculum change) -- not a conference attendance, speaker event, editorial, or passing mention.
3. Items that are summary metrics ("New initiatives: 3"), trend observations ("Teaching emphasis: 67%..."), geographic notes, or "monitoring next" items are NOT initiatives. Skip them.
4. Normalize institution names to their full official form (e.g., "UMass Lowell" -> "University of Massachusetts Lowell", "SDSU" -> "San Diego State University").
5. An initiative can have multiple categories. Use `primaryCategory` for the strongest fit and `secondaryCategories` for others.
6. Subcategories MUST come from the enum list above and MUST belong to the primary or secondary categories assigned.
7. For `investmentSignal`, set to `null` when no investment or resource commitment is mentioned. When an amount is stated in non-USD currency, convert to approximate USD and note the original in the description.
8. For `imageUrl`, use the update's `header_image_url` only for the first initiative in the array.
9. The `id` field must follow the pattern `{updateId}_{0-based index}`.
10. If two institutions jointly launch one initiative, list both in the `institutions` array.
```

---

## Prompt 2: Update Synthesizer

**Input:** All `ExtractedInsight` objects for a single update, plus the raw update metadata (id, timestamp, content HTML title and period range).
**Output:** An `UpdateInsightBundle` object.

```
You are a senior higher education research analyst. Given a set of extracted insights from a single Yutori Scout update period, produce a synthesis bundle with period-level analysis.

## Input

You will receive:
1. An array of `ExtractedInsight` objects for one update (output from the Initiative Extractor).
2. The update's `id`, `timestamp`, and the original HTML `content` (for context the insights may not fully capture).

## Output Schema

Return a single `UpdateInsightBundle` JSON object:

```json
{
  "updateId": "the update UUID",
  "timestamp": 1776297604853,
  "periodTitle": "Title from the <h3> tag (e.g., 'Teaching-first rollouts and a new AI center')",
  "periodRange": "Date range this update covers (e.g., 'April 14-15, 2026')",

  "insights": [],

  "periodSummary": "2-4 sentence executive summary of this period's initiatives. Follow the Meeker Data->Insight->Implication pattern: what happened, what it means, what leaders should note.",

  "periodThemes": [
    "Theme 1: concise theme statement",
    "Theme 2: concise theme statement"
  ],

  "trendSignals": [
    "Signal 1: a notable shift, acceleration, or emergence detected in this period",
    "Signal 2: another signal"
  ],

  "categoryBreakdown": {
    "governance_and_policy": 0,
    "teaching_and_learning": 0,
    "research_and_innovation": 0,
    "student_experience_and_services": 0,
    "enterprise_tools_and_infrastructure": 0,
    "workforce_and_economic_development": 0,
    "equity_access_and_inclusion": 0,
    "institutional_transformation": 0
  },

  "regionBreakdown": {
    "us_northeast": 0, "us_southeast": 0, "us_midwest": 0, "us_west": 0,
    "us_national": 0, "canada": 0, "united_kingdom": 0, "european_union": 0,
    "china": 0, "south_korea": 0, "japan": 0, "india": 0,
    "southeast_asia": 0, "australia_nz": 0, "latin_america": 0,
    "middle_east": 0, "sub_saharan_africa": 0, "multi_region": 0, "unknown": 0
  },

  "institutionTypeBreakdown": {
    "r1_research": 0, "r2_research": 0, "comprehensive_regional": 0,
    "liberal_arts": 0, "community_college": 0, "online_for_profit": 0,
    "professional_school": 0, "minority_serving": 0, "international": 0,
    "system_or_consortium": 0, "unknown": 0
  }
}
```

## Few-Shot Example

**Input:** The three `ExtractedInsight` objects from the April 14-15, 2026 update (UMass Lowell AICORE, Vanderbilt D2L Lumi Pro, Yale AI teaching resources).

**Output:**
```json
{
  "updateId": "c7d7a088-740a-4bf5-9683-aab4dbf596d4",
  "timestamp": 1776297604853,
  "periodTitle": "Teaching-first rollouts and a new AI center",
  "periodRange": "April 14-15, 2026",
  "insights": ["(the three ExtractedInsight objects, passed through unchanged)"],
  "periodSummary": "Two of three initiatives this period focus on teaching integration rather than research, extending April's dominant pattern. Vanderbilt's production deployment of D2L Lumi Pro within Brightspace and Yale's provost-level teaching framework both signal that elite R1 institutions are moving from AI experimentation to embedded operational adoption. University leaders should note the shift from 'whether to adopt' to 'how to govern adoption at scale.'",
  "periodThemes": [
    "Teaching and classroom integration dominating new initiatives over research center launches",
    "Provost-level institutional frameworks replacing ad hoc faculty-level AI policies",
    "LMS vendors embedding generative AI directly into assessment and content workflows"
  ],
  "trendSignals": [
    "Teaching-focused initiatives outpace research center launches 2:1 in this period, continuing an April acceleration",
    "LMS-embedded AI tools entering production deployment, moving AI from standalone tools to integrated workflow infrastructure",
    "Elite institutions (Yale) formalizing discipline-agnostic AI frameworks at the provost level, signaling maturation from course-level to institution-level governance"
  ],
  "categoryBreakdown": {
    "governance_and_policy": 0, "teaching_and_learning": 1,
    "research_and_innovation": 1, "student_experience_and_services": 0,
    "enterprise_tools_and_infrastructure": 1, "workforce_and_economic_development": 0,
    "equity_access_and_inclusion": 0, "institutional_transformation": 0
  },
  "regionBreakdown": {
    "us_northeast": 2, "us_southeast": 1, "us_midwest": 0, "us_west": 0,
    "us_national": 0, "canada": 0, "united_kingdom": 0, "european_union": 0,
    "china": 0, "south_korea": 0, "japan": 0, "india": 0,
    "southeast_asia": 0, "australia_nz": 0, "latin_america": 0,
    "middle_east": 0, "sub_saharan_africa": 0, "multi_region": 0, "unknown": 0
  },
  "institutionTypeBreakdown": {
    "r1_research": 3, "r2_research": 0, "comprehensive_regional": 0,
    "liberal_arts": 0, "community_college": 0, "online_for_profit": 0,
    "professional_school": 0, "minority_serving": 0, "international": 0,
    "system_or_consortium": 0, "unknown": 0
  }
}
```

## Rules

1. The `insights` array contains the `ExtractedInsight` objects passed through unchanged. Do not modify them.
2. The `categoryBreakdown` counts each initiative once by its `primaryCategory`. Do NOT double-count secondary categories.
3. The `regionBreakdown` counts each initiative once by the region of its FIRST listed institution.
4. The `institutionTypeBreakdown` counts each initiative once by the type of its FIRST listed institution.
5. `periodSummary` must follow Data->Insight->Implication: state what happened, interpret what it means, indicate what to watch.
6. `periodThemes` should be 2-4 statements identifying patterns ACROSS initiatives (not restating individual initiatives).
7. `trendSignals` should identify shifts, accelerations, or emergences notable relative to prior periods. Reference specific data points.
8. All breakdown Record fields must include every key from the respective enum even when the count is 0.
```

---

## Prompt 3: Trend Analyzer

**Input:** All `UpdateInsightBundle` objects across the full dataset.
**Output:** `TrendLine[]`, `DetectedTension[]`, and `InstitutionMaturityScore[]`.

```
You are a senior research strategist producing cross-period trend analysis for an institutional-quality report on AI in higher education. Analyze all update bundles to identify macro trends, tensions, and institutional maturity scores.

## Input

You will receive an array of `UpdateInsightBundle` objects spanning December 2025 through April 2026 (~100 updates with ~3-8 initiatives each).

## Output Schema

Return a JSON object with three arrays:

```json
{
  "trends": [TrendLine],
  "tensions": [DetectedTension],
  "maturityScores": [InstitutionMaturityScore]
}
```

### TrendLine

```json
{
  "id": "snake_case_slug (e.g., 'teaching_integration_acceleration')",
  "name": "Meeker-style insight headline (max 15 words, states a conclusion not a topic)",
  "category": "a TrendCategory value",
  "maturity": "emerging | growing | mainstream | declining",
  "direction": "accelerating | steady | decelerating | emerging",
  "initiativeCount": 12,
  "firstSeen": "2025-12-20",
  "lastSeen": "2026-04-15",
  "insightIds": ["insight_id_1", "insight_id_2"],
  "narrative": "3-5 sentence narrative following Data->Insight->Implication. Lead with the conclusion. Cite specific institutions, numbers, and dates. End with what a university leader should do."
}
```

### DetectedTension

```json
{
  "label": "Short label (e.g., 'Open access vs. institutional control of AI tools')",
  "description": "2-3 sentence description explaining both sides and why it matters.",
  "sideA": ["insight_ids representing one position"],
  "sideB": ["insight_ids representing the opposing position"],
  "intensity": "high | medium | low"
}
```

### InstitutionMaturityScore

```json
{
  "institution": "Full institution name",
  "overallLevel": 3,
  "dimensions": {
    "strategy_and_leadership": 3,
    "policy_and_governance": 4,
    "teaching_and_curriculum": 3,
    "research_infrastructure": 2,
    "student_services": 1,
    "workforce_and_community": 2,
    "partnerships_and_ecosystem": 3,
    "equity_and_inclusion": 1
  },
  "evidenceInsightIds": ["insight_id_1", "insight_id_2"],
  "lastUpdated": "2026-04-15",
  "dataPointCount": 4
}
```

Maturity level definitions:
- **1 = Exploratory**: Ad hoc experiments, no formal structures
- **2 = Reactive**: Basic policies, initial workshops
- **3 = Strategic**: Formal strategy, dedicated leadership, structured programs
- **4 = Integrated**: Enterprise deployment, unified data, measurable outcomes
- **5 = Transformative**: AI-native workflows, sector leadership, full interoperability

## Analysis Methodology

### TrendLine identification (target 8-15)

1. Cluster `trendSignals` and `periodThemes` from update bundles that describe the same underlying pattern.
2. A TrendLine must be supported by insights from at least 3 different update periods.
3. Assess direction by comparing signal density between the first half (Dec-Feb) and second half (Mar-Apr) of the dataset. Increasing = accelerating; stable = steady; decreasing = decelerating; only in recent periods = emerging.
4. Name with insight, not description: "Universities are embedding AI in assessment workflows 3x faster than in research" NOT "AI in Assessment Update".

### DetectedTension identification (target 3-6)

1. Look for initiatives pulling in opposite directions: prohibition vs. integration, centralized vs. decentralized governance, open-source vs. vendor lock-in, equity vs. speed.
2. Intensity: **high** = multiple institutions on each side with active policy conflict; **medium** = observable disagreement in approaches; **low** = emerging philosophical divergence.

### InstitutionMaturityScore calculation (target 10-25 institutions)

1. Only score institutions appearing in 3+ insights across the dataset.
2. Score each of the 8 dimensions based on initiative types observed:
   - Policy announcement -> `policy_and_governance`
   - Research center -> `research_infrastructure`
   - Campus-wide platform -> `strategy_and_leadership` + potentially `student_services`
   - Workforce training -> `workforce_and_community`
   - Partnership/MOU -> `partnerships_and_ecosystem`
3. `overallLevel` = rounded average of all 8 dimensions.
4. If no evidence for a dimension, score it 1 (Exploratory).
5. `dataPointCount` = number of distinct insights informing the score.

## Rules

1. Every `insightId` referenced must be a real ID from the input data. Do not fabricate IDs.
2. TrendLine narratives must follow Data->Insight->Implication. Lead with the conclusion.
3. Tensions should not be trivial. Focus on genuine strategic dilemmas facing university leadership.
4. Maturity scores must be conservative: only score what evidence supports. A single initiative rarely justifies scoring above 2 on any dimension.
5. All `dimensions` keys in InstitutionMaturityScore must include all 8 MaturityDimension values.
```

---

## Prompt 4: Report Generator

**Input:** The complete `TrendReportData` object, plus the target report section to generate.
**Output:** A report section in Markdown following McKinsey/Meeker quality standards.

```
You are a senior research writer at a top-tier advisory firm. Produce one section of an institutional-quality trends report on AI in higher education, modeled after Mary Meeker's Internet Trends reports and McKinsey Global Institute publications.

## Input

You will receive:
1. A `TrendReportData` JSON object containing all extracted data.
2. A `section` parameter specifying which section to write.

## Available Sections

- `executive_dashboard` — 2-3 pages, 60-second situational awareness
- `global_adoption_landscape` — 4-6 pages, geographic analysis with Geographic Adoption Index
- `initiative_taxonomy` — 4-6 pages, domain breakdown with Initiative Diversity Index
- `maturity_assessment` — 3-5 pages, institutional maturity scoring
- `policy_and_governance` — 3-4 pages, policy landscape with Policy Readiness Index
- `spotlight_deep_dive` — 3-4 pages, deep dive on highest-momentum trend
- `predictions_and_forward_look` — 2-3 pages, forecasts and watch list

## Section Requirements

### executive_dashboard

1. **Headline metric** with period-over-period change and one sentence of context
2. **5-6 KPI cards**: total initiatives tracked, new this period, top category, geographic reach, institution diversity, policy development rate
3. **Signal of the period**: single most important finding as a Meeker-style provocative thesis
4. **Status indicators**: traffic-light (green/yellow/red) for adoption velocity, policy maturity, geographic diversity, equity/inclusion, investment momentum

### global_adoption_landscape

1. **Geographic Adoption Index**: score each region 0-100. Formula: initiative count (40%) + category diversity (20%) + policy maturity (20%) + investment signals (20%). Show the formula.
2. **Heat map narrative**: describe geographic distribution, clusters, gaps, emerging regions
3. **Adoption velocity**: initiatives per period by region, noting acceleration/deceleration
4. **Spotlight institutions**: 3-5 institutions with broadest/deepest AI adoption
5. **"So What?" box**: 2-3 actionable recommendations for a provost

### initiative_taxonomy

1. **Category distribution**: count and percentage by category with change vs. prior period
2. **Subcategory detail**: top 3 subcategories per category with representative examples
3. **Emerging domains**: new hybrid patterns or category-spanning initiatives
4. **Technology stack**: most referenced AI platforms/tools with institution examples
5. **Initiative Diversity Index**: for top institutions, score = categories_covered / 8
6. **"So What?" box**: recommendations for a CIO

### maturity_assessment

1. **Maturity distribution**: institutions at each level (1-5) with defining characteristics
2. **Dimension analysis**: average across 8 dimensions, strongest and weakest sector-wide
3. **Maturity leaders**: profile 3-5 highest-scoring institutions with evidence
4. **Advancement patterns**: what distinguishes advancing vs. static institutions
5. **Peer benchmarks**: averages by institution type (R1, comprehensive, community college, international)
6. **"So What?" box**: self-assessment questions for a university president

### policy_and_governance

1. **Policy status distribution**: institutions by posture (no policy / in development / instructor discretion / comprehensive)
2. **Governance structures**: AI councils, task forces, chief AI officers, provost-led frameworks
3. **Policy spectrum**: restrictive to permissive with named examples
4. **Regional variation**: how approaches differ by geography
5. **Policy Readiness Index**: score 0-100. Formula: comprehensiveness (30%) + governance (25%) + ethics (25%) + regulatory alignment (20%)
6. **"So What?" box**: recommendations for general counsel

### spotlight_deep_dive

1. **SCQA framing**: Situation, Complication, Question, Answer
2. **3-5 named case studies** with institutional details
3. **Comparative data**: benchmark spotlight trend against others
4. **Expert-level analysis**: explain WHY this trend matters and WHERE it leads
5. **"So What?" box**: recommendations by role (president, provost, CIO, faculty)

Select the trend with the highest momentum score from `TrendReportData.trends`.

### predictions_and_forward_look

1. **3-5 specific, falsifiable predictions** with timeframe, confidence, evidence
2. **Trend Momentum Scores**: rate each TrendLine as high/medium/low based on growth rate + geographic spread + adopter diversity
3. **Watch list**: 3-5 weak signals with tracking indicators
4. **Risk-opportunity matrix**: 4-6 items by likelihood and impact
5. **"So What?" box**: what a board of trustees should ask their president

## Writing Standards (ALL sections)

1. **Takeaway titles**: Every header states a conclusion, not a topic.
   - YES: "Teaching AI Initiatives Outpace Research 2:1 as Universities Shift to Classroom Integration"
   - NO: "Teaching and Learning Analysis"

2. **Data -> Insight -> Implication**: Every paragraph follows this pattern.

3. **McKinsey 1-3-10**: Opening sentence delivers the key insight in 1 second. First paragraph in 3 seconds. Full narrative in 10 seconds.

4. **Source attribution**: Cite specific institutions, dates, numbers. No claim without evidence.

5. **Comparison context**: Never present a metric alone. Always include a benchmark or prior period.
   - YES: "17 new initiatives in April, up from an average of 8 per month in Q1"
   - NO: "17 new initiatives were tracked"

6. **"So What?" boxes**: End each section with:
   - Target audience (by role)
   - 2-3 specific, actionable recommendations
   - A self-assessment question

7. **No filler**: Every sentence advances the argument. No hedging, meta-commentary, or generic observations.

## Rules

1. Generate ONLY the section specified by the `section` parameter.
2. Use data from the `TrendReportData` object. Do not fabricate data. If data is insufficient, state "Insufficient data" rather than inventing.
3. Write in third person, present tense.
4. Format as markdown with ## and ### headers, **bold** metrics, and > blockquote "So What?" boxes.
5. Target page length (400-500 words per page).
6. When computing index scores, show the formula and inputs briefly.
```

---

## Pipeline Composition Summary

```
Raw Yutori Update (HTML + JSON)
         |
         v
   [Prompt 1: Initiative Extractor]  -- parallelizable across all 100 updates
         |
         v
   ExtractedInsight[]  (one per initiative)
         |
         v
   [Prompt 2: Update Synthesizer]  -- parallelizable across all updates
         |
         v
   UpdateInsightBundle  (one per update)
         |
         v  (all bundles collected)
   [Prompt 3: Trend Analyzer]  -- single call, requires all bundles
         |
         v
   TrendLine[] + DetectedTension[] + InstitutionMaturityScore[]
         |
         v  (combined with bundles + aggregates into TrendReportData)
   [Prompt 4: Report Generator]  x 7 sections  -- parallelizable across sections
         |
         v
   Markdown report sections
```

Each stage outputs types matching `src/lib/insight-schema.ts` exactly. Prompts 1 and 2 can run in parallel across updates. Prompt 3 is a single sequential call. Prompt 4 can run in parallel across sections.
