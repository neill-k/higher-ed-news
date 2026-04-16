# Yutori Scout Data Analysis

## 1. Dataset Overview

| Metric | Value |
|---|---|
| Total updates | 100 |
| Total non-updates | 18 |
| Date range | 2025-12-17 to 2026-04-15 |
| Span | 119 days (~4 months) |
| Scout name | "University AI initiatives" |
| Scout created | 2025-12-17 |
| Scheduling | Daily at 9:00 AM CT |
| Next output | 2026-04-17 |
| Total content | 289,942 characters of HTML |
| Pagination | 5 pages of 20, cursor-based |

### API Endpoints

- **Updates**: `GET /client/scouting/{scout_id}/updates?page_size=20[&cursor=...]`
- **Non-updates**: `GET /client/scouting/{scout_id}/non_updates?page_size=20[&cursor=...]`
- Both require `Accept: application/json` header
- Cursor pagination via `next_cursor` / `prev_cursor` in response body
- Non-updates fit in a single page (18 items, no cursor returned)

### Update Frequency

The scout runs daily. Of 118 total runs:
- **100 produced updates** (content found)
- **18 produced non-updates** (no new content found)
- ~85% hit rate

Weekly distribution is fairly even (4-8 updates per week), with slight acceleration in late March/April.

---

## 2. Data Schema & Field Completeness

### ApiUpdate fields

| Field | Type | Completeness | Notes |
|---|---|---|---|
| `id` | string (UUID) | 100/100 (100%) | Always present, unique |
| `timestamp` | number (ms epoch) | 100/100 (100%) | Always present |
| `content` | string (HTML) | 100/100 (100%) | Always present, 1,005-11,908 chars |
| `citations` | ApiCitation[] | 100/100 (100%) | Always present as array, 0-13 items |
| `stats` | object | 100/100 (100%) | Always present (never null for updates) |
| `header_image_url` | string or null | 57/100 (57%) | Appeared starting 2026-01-26 |

### ApiCitation fields

| Field | Completeness | Notes |
|---|---|---|
| `id` | 100% | Integer id (within update) |
| `url` | 100% | Always a full URL |
| `preview_data` | 428/428 (100%) | Always present for citations |
| `preview_data.title` | 418/428 (98%) | Almost always available |
| `preview_data.description` | 416/428 (97%) | Almost always available |
| `preview_data.image` | 407/428 (95%) | Usually available |

### Stats fields

| Field | Notes |
|---|---|
| `sec_saved` | Always present, range: 87-10,511 |
| `num_tool_calls` | Always present, range: 1-520, avg 86 |
| `num_mcp_tool_calls` | Always equals `num_tool_calls` |
| `num_crawler_calls` | Always 0 |
| `num_navigator_steps` | Always 0 |
| `num_websites_visited` | Always 0 |
| `credit_cost` | Only present for 8 most recent updates (values: 15-72), null for the rest |

### Non-update fields

| Field | Notes |
|---|---|
| `timestamp` | Always present (ms epoch) |
| `stats` | Present for 9/18, null for 9/18 (null for older ones pre-Jan 2026) |

---

## 3. Content HTML Structure

### Tags used (across all 100 updates)

| Tag | Count | Purpose |
|---|---|---|
| `<li>` | 1,120 | Initiative bullets + summary metadata |
| `<a>` | 1,116 | Source links (nearly 1:1 with `<li>`) |
| `<p>` | 928 | Narrative paragraphs, metadata |
| `<b>` | 818 | Bold labels, section headers |
| `<ul>` | 360 | Lists (3-4 per update on average) |
| `<h3>` | 200 | Title (2 per update: opening + closing tag) |
| `<i>` | 118 | Italic text, timestamps |
| `<section>` | 48 | Rare structural grouping |
| `<strong>` | 44 | Alternative bold in some updates |
| `<td>/<tr>/<th>` | 40/24/8 | Rare tabular data |

### Standard document structure

Updates follow a consistent pattern:

```
<h3>Title</h3>
<p>Report period / intro paragraph</p>
<p><b>Topline:</b> summary metrics</p>

[Optional: <p><b>Category header</b></p>]
<ul>
  <li><b>Institution Name</b> -- Initiative Title (Category; Date): Description. <a href="..."></a></li>
  ...
</ul>

<p><b>Trends & Observations:</b></p>
<ul>
  <li>Trend bullet 1</li>
  <li>Trend bullet 2</li>
</ul>

<p><b>Cumulative 2026:</b> running totals</p>
<p><i>Dashboard updated:</i> timestamp</p>
```

### Key content patterns

1. **Initiative bullets**: `<b>Institution</b> -- Title (Category; Date): Description <a href="..."></a>`
   - Uses em-dash (U+2014) as separator
   - Institution name in `<b>` tags
   - Each bullet usually has exactly one `<a>` link to the source
   
2. **Summary metadata**: Lines starting with "New initiatives:", "Categories:", "Geography:", etc.

3. **Narrative paragraphs**: Appear in `<p>` tags, often with `<b>` labels like "What's new", "Why this matters", "Topline"

4. **The "Why it matters" / "Takeaways" section**: `<p><b>Why this matters now</b></p><p>narrative</p>` pattern

---

## 4. Initiative Parsing Analysis

Using the parsing logic from `src/lib/yutori.ts`:

| Metric | Value |
|---|---|
| Total `<li>` items | 560 |
| Items matching initiative pattern (em-dash) | 124 |
| Parse rate | 22.1% |
| Updates with 1+ parsed initiatives | 35/100 |
| Updates with 0 parsed initiatives | 65/100 |
| Initiatives per update (when present) | avg 3.5 |
| Max initiatives in one update | 8 |

### Why the parse rate is only 22%

The majority of `<li>` items (436/560) are **not** initiative bullets. They are:
- Summary metadata ("New initiatives: 3", "Categories: Research, Policy")
- Trend observations ("Teaching emphasis: 67% of new initiatives...")
- Geographic coverage bullets
- Observations/takeaway bullets

The em-dash parsing correctly excludes these. However, **65 updates have 0 parsed initiatives** because many updates use a different format where institutions are listed in `<p>` narrative blocks or `<li>` items without the em-dash separator. The format evolved over time.

### Content structure evolution by month

| Month | Updates | Avg content len | Avg `<li>` | Avg citations | Avg parsed initiatives | Header images |
|---|---|---|---|---|---|---|
| 2025-12 | 14 | 2,980 | 5.4 | 4.9 | 0.7 | 0/14 |
| 2026-01 | 25 | 2,519 | 4.2 | 4.1 | 0.7 | 2/25 |
| 2026-02 | 25 | 2,451 | 4.7 | 3.4 | 0.4 | 22/25 |
| 2026-03 | 26 | 3,155 | 5.4 | 4.5 | 1.8 | 23/26 |
| 2026-04 | 10 | 4,193 | 12.2 | 5.6 | 4.0 | 10/10 |

**Key trends:**
- Content is getting richer over time (2,980 avg chars in Dec -> 4,193 in April)
- More list items per update (5.4 -> 12.2)
- The em-dash initiative format became dominant in March-April
- Header images appeared in late January 2026 and became standard by February
- Citations per update have been increasing

---

## 5. sec_saved Distribution

| Metric | Value |
|---|---|
| Min | 87 seconds |
| Max | 10,511 seconds (~2.9 hours) |
| Average | 1,810 seconds (~30 min) |
| Total across all updates | 180,960 seconds (50.3 hours) |

Distribution clusters:
- Most updates: 800-2,500 seconds (13-42 minutes)
- Outlier high: 10,511 seconds (update with 520 tool calls, Apr 6)
- Outlier low: 87-139 seconds (1-2 tool calls)

Non-updates always have `sec_saved: 0`.

---

## 6. Source Domain Analysis

### Top citation domains

| Domain | Count | Type |
|---|---|---|
| edtechinnovationhub.com | 13 | EdTech news aggregator |
| hawaii.edu | 5 | University |
| scouts.yutori.com | 5 | Self-references |
| govtech.com | 5 | Government tech news |
| usf.edu | 4 | University |
| news.stonybrook.edu | 4 | University |
| tribuneindia.com | 4 | Indian news |
| cmu.edu | 4 | University |
| purdue.edu | 4 | University |
| prnewswire.com | 4 | Press releases |

### Top in-content link domains

| Domain | Count |
|---|---|
| hpcwire.com | 15 |
| edtechinnovationhub.com | 13 |
| ecampusnews.com | 7 |
| jconline.com | 7 |
| hawaii.edu | 6 |
| govtech.com | 5 |

Source diversity is high -- 200+ unique domains across 428 citations. Mix of:
- **University newsrooms** (.edu domains): most common
- **EdTech trade press**: edtechinnovationhub.com, ecampusnews.com, edscoop.com
- **General news**: morningstar.com, latimes.com, tribuneindia.com
- **HPC/tech**: hpcwire.com
- **Press release wires**: prnewswire.com, prnewswire.co.uk, newswise.com

---

## 7. Category Distribution

Categories mentioned across updates (keyword analysis):

| Category | Updates mentioning | Pct |
|---|---|---|
| Curriculum & Training | 92/100 | 92% |
| Partnerships | 88/100 | 88% |
| Governance & Policy | 82/100 | 82% |
| Operations & Tools | 80/100 | 80% |
| Research | 66/100 | 66% |

Most updates touch multiple categories. Curriculum & Training is the most pervasive.

---

## 8. Geographic Coverage

Most initiatives are from U.S. institutions (implicitly -- most .edu links). Explicit geographic mentions:

| Region | Updates mentioning |
|---|---|
| US | 20 (explicitly; nearly all updates cover US institutions) |
| India | 19 |
| Canada | 9 |
| China | 3 |
| South Korea | 2 |
| Australia | 2 |
| Singapore | 2 |
| UK | 2 |
| Denmark, France, Germany, Israel, Netherlands, Saudi Arabia, Taiwan | 1 each |

Coverage is heavily US-centric with India as a strong secondary focus. International coverage has increased over time.

---

## 9. Representative Update Parsing (Detailed)

### Update #1 (Apr 15, 2026) -- "Teaching-first rollouts and a new AI center"
- 3 initiatives parsed cleanly
- Format: `<b>Institution -- Title</b> (Category; Date): Description`
- Each initiative has exactly 1 source URL
- Includes dashboard metrics section, cumulative tracking
- 2,800 chars, no citations (links only in content)

### Update #31 (Mar 9, 2026) -- "Five New University AI Initiatives"
- 5 initiatives parsed perfectly -- highest parse quality
- Clean `Institution -- Title -- Category` pattern
- 2,814 chars, 5 citations (1:1 with initiatives)
- Includes: Clemson, ASU, Rice, Alabama, Northwestern

### Update #51 (Feb 13, 2026) -- "Two scale moves: MUSC AI hub and CodePath rollout"
- 0 initiatives parsed (narrative format, no em-dash bullets)
- Institutions described in `<p>` tags instead of `<li>` bullets
- 1,869 chars, 2 citations

### Update #100 (Dec 17, 2025) -- "Universities set AI policies, colleges, and requirements"
- 0 initiatives parsed from em-dash pattern (different format)
- Uses `<p><b>Category header</b></p><ul><li>description</li></ul>` structure
- 16 `<li>` items organized under category headers
- 4,990 chars, 13 citations -- richest earliest update

---

## 10. Implications for Pipeline Design

### Parsing considerations

1. **Only 35% of updates use the em-dash initiative format** that the parser expects. The other 65% use narrative `<p>` blocks or `<li>` items without em-dashes. A production pipeline should handle both patterns.

2. **The format is evolving** toward more structured, parser-friendly content (April updates average 4.0 parsed initiatives vs 0.4 in February). The parser will become more effective over time, but historical data needs a fallback parser.

3. **Citation data is rich** -- 100% have preview_data with title (98%), description (97%), and image (95%). This is excellent for source card generation.

4. **Header images became standard in Feb 2026** (88% coverage from Feb onward vs 0% in Dec). Pipeline should handle null gracefully.

5. **Content length is increasing** -- April updates are 40% longer than December/January averages. Plan for scaling.

### Data quality notes

- `stats.sec_saved` is always present for updates and is a useful engagement metric
- `credit_cost` is only populated for the 8 most recent updates -- not reliable for historical analysis
- `num_crawler_calls`, `num_navigator_steps`, `num_websites_visited` are always 0 -- the scout uses MCP tools exclusively
- Non-updates have sparser stats (null for older ones)
- The `diffs` field exists in the API response but was not analyzed (separate artifact tracking)
