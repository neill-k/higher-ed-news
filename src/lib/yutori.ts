const SCOUT_ID = "40d662ee-5fe8-4b55-aeab-76cac0d5a654";
const SCOUT_API_URL = `https://api.yutori.com/client/scouting/${SCOUT_ID}`;
const PAGE_SIZE = 20;
const MAX_CURSOR_PAGES = 50;

export const SCOUT_SOURCE_URL = `https://scouts.yutori.com/inbox/${SCOUT_ID}`;

export type ApiCitation = {
  id: string;
  url: string;
  preview_data?: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
  };
};

export type ApiUpdate = {
  id: string;
  timestamp: number;
  content: string;
  citations: ApiCitation[];
  stats?: {
    sec_saved?: number;
  } | null;
  header_image_url?: string | null;
};

type ApiScout = {
  id: string;
  display_name: string;
  query: string;
  created_at: string;
  next_output_timestamp?: string;
  update_count?: number;
};

type ApiCursorPayload = {
  next_cursor?: string | null;
  prev_cursor?: string | null;
};

type ApiUpdatesPayload = ApiCursorPayload & {
  scout: ApiScout;
  updates: ApiUpdate[];
};

export type ApiNonUpdate = {
  timestamp: number;
  stats?: {
    sec_saved?: number;
  } | null;
};

type ApiNonUpdatesPayload = ApiCursorPayload & {
  non_updates: ApiNonUpdate[];
};

export type ParsedInitiative = {
  institution: string;
  title: string;
  description: string;
  categories: string[];
  sourceUrls: string[];
};

export type ParsedUpdate = {
  id: string;
  timestamp: number;
  title: string;
  summary: string;
  whyItMatters: string;
  initiativeCount: number;
  institutionCount: number;
  geographyCount: number;
  geographyLabels: string[];
  categories: string[];
  initiatives: ParsedInitiative[];
  sourceUrls: string[];
  headerImageUrl: string | null;
  secondsSaved: number;
};

export type DashboardData = {
  scout: {
    id: string;
    title: string;
    query: string;
    createdAt: string;
    nextOutputTimestamp: string | null;
    updateCount: number;
    runCount: number;
    archiveEntryCount: number;
  };
  updates: ParsedUpdate[];
  totals: {
    initiatives: number;
    institutions: number;
    geographies: number;
    sources: number;
    hoursSaved: number;
  };
  categoryBreakdown: Array<{
    label: string;
    value: number;
  }>;
  timeline: Array<{
    label: string;
    value: number;
  }>;
  latestSources: Array<{
    title: string;
    description: string;
    url: string;
    domain: string;
  }>;
};

const CATEGORY_LABELS = [
  "Governance & Policy",
  "Research",
  "Curriculum & Training",
  "Partnerships",
  "Operations & Tools",
] as const;

const SUMMARY_PREFIXES = [
  "new initiatives:",
  "new university ai initiatives",
  "categories:",
  "date range:",
  "report period:",
  "report date:",
  "coverage:",
  "geography:",
  "geographic regions:",
  "regions added:",
  "dashboard digest",
  "digest",
  "what’s new:",
  "what's new:",
  "why it matters:",
  "research infrastructure:",
  "workforce development:",
  "breadth of adoption:",
  "most common initiative type",
  "metrics visualization updated:",
  "institution types:",
  "topline metrics",
];

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&ldquo;": "“",
  "&rdquo;": "”",
};

function decodeHtmlEntities(value: string) {
  return value.replace(/&[a-z0-9#]+;/gi, (entity) => ENTITY_MAP[entity] ?? entity);
}

function stripHtml(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function extractTagContents(html: string, tag: string) {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const matches: string[] = [];

  for (const match of html.matchAll(pattern)) {
    matches.push(match[1]);
  }

  return matches;
}

function extractLinks(html: string) {
  const matches = html.matchAll(/<a\s+[^>]*href="([^"]+)"/gi);
  return unique(
    Array.from(matches, ([, url]) => url).filter((url) => url.startsWith("http"))
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function parseCount(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function normalizeCategory(value: string) {
  const lower = value.toLowerCase();

  if (
    /policy|governance|framework|guideline|guidelines|responsible ai|oversight/.test(
      lower
    )
  ) {
    return CATEGORY_LABELS[0];
  }

  if (/center|centre|hub|institute|lab|research|fellowship|showcase/.test(lower)) {
    return CATEGORY_LABELS[1];
  }

  if (
    /curriculum|course|certificate|certification|program|degree|specialization|academy|training|workshop|micro-credential|literacy|minor|major|fellows/.test(
      lower
    )
  ) {
    return CATEGORY_LABELS[2];
  }

  if (/partner|partnership|mou|memorandum|collaboration|alliance|coalition/.test(lower)) {
    return CATEGORY_LABELS[3];
  }

  if (/tool|rollout|platform|implementation|deployment|procurement|rfp|systemwide/.test(lower)) {
    return CATEGORY_LABELS[4];
  }

  return null;
}

function parseExplicitCategories(listItems: string[]) {
  const categoryLine = listItems.find((item) => item.toLowerCase().startsWith("categories:"));

  if (!categoryLine) {
    return [];
  }

  const values = categoryLine
    .split(":")[1]
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!values) {
    return [];
  }

  return unique(
    values
      .map((value) => normalizeCategory(value) ?? value)
      .filter(Boolean) as string[]
  );
}

function parseGeographyLabels(text: string, listItems: string[]) {
  const countryListMatch = text.match(/countries?\s*\(([^)]+)\)/i);

  if (countryListMatch) {
    return unique(
      countryListMatch[1]
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    );
  }

  const geographyLine = listItems.find((item) =>
    /^(geography|geographic regions|regions added):/i.test(item)
  );

  if (!geographyLine) {
    return [];
  }

  return unique(
    geographyLine
      .split(":")[1]
      ?.split(/[;,]/)
      .map((item) =>
        item
          .replace(/\([^)]*\)/g, "")
          .replace(/\d+/g, "")
          .trim()
      )
      .filter(Boolean) ?? []
  );
}

function isInitiativeBullet(text: string, sourceUrls: string[]) {
  const lower = text.toLowerCase();

  if (!text.includes("—")) {
    return false;
  }

  if (SUMMARY_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return false;
  }

  return sourceUrls.length > 0 || text.includes(":");
}

function splitInstitutions(label: string) {
  return unique(
    label
      .split(/\s+(?:&|×|and)\s+/i)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function parseInitiatives(content: string) {
  const rawItems = extractTagContents(content, "li");

  return rawItems
    .map((item) => ({
      raw: item,
      text: stripHtml(item),
      sourceUrls: extractLinks(item),
    }))
    .filter((item) => isInitiativeBullet(item.text, item.sourceUrls))
    .map<ParsedInitiative>((item) => {
      const matched = item.text.match(/^(.+?)\s+—\s+(.+?)(?::\s*(.+))?$/);
      const institution = matched?.[1]?.trim() ?? item.text;
      const title = matched?.[2]?.trim() ?? item.text;
      const description = matched?.[3]?.trim() ?? "";
      const category = normalizeCategory(item.text);

      return {
        institution,
        title,
        description,
        categories: category ? [category] : [],
        sourceUrls: item.sourceUrls,
      };
    });
}

function extractNarrativeParagraphs(content: string) {
  return extractTagContents(content, "p")
    .map((item) => stripHtml(item))
    .filter(
      (item) =>
        item &&
        !/^report (period|date):/i.test(item) &&
        !/^topline metrics/i.test(item) &&
        !/^dashboard/i.test(item) &&
        !/^(why this matters(?: now)?|takeaways|executive digest|digest)$/i.test(item)
    );
}

function extractWhyItMatters(content: string) {
  const matched = content.match(
    /<p><b>(Why this matters(?: now)?|Takeaways|Executive digest|Digest)<\/b><\/p>\s*<p>([\s\S]*?)<\/p>/i
  );

  if (matched) {
    return stripHtml(matched[2]);
  }

  return "";
}

export function parseUpdate(update: ApiUpdate): ParsedUpdate {
  const title = stripHtml(extractTagContents(update.content, "h3")[0] ?? "Daily scout update");
  const listItems = extractTagContents(update.content, "li").map((item) => stripHtml(item));
  const narrativeParagraphs = extractNarrativeParagraphs(update.content);
  const initiatives = parseInitiatives(update.content);
  const explicitCategories = parseExplicitCategories(listItems);
  const text = stripHtml(update.content);
  const geographyLabels = parseGeographyLabels(text, listItems);
  const sourceUrls = unique([
    ...extractLinks(update.content),
    ...update.citations.map((citation) => citation.url),
  ]);
  const institutionSet = new Set(
    initiatives.flatMap((initiative) => splitInstitutions(initiative.institution))
  );
  const categorySet = new Set<string>(explicitCategories);

  for (const initiative of initiatives) {
    for (const category of initiative.categories) {
      categorySet.add(category);
    }
  }

  const initiativeCount =
    parseCount(text, [/new initiatives:\s*(\d+)/i, /new university ai initiatives\s*(\d+)/i]) ??
    initiatives.length;
  const institutionCount =
    parseCount(text, [/across\s+(\d+)\s+institutions?/i, /universities involved:\s*(\d+)/i]) ??
    institutionSet.size;
  const geographyCount =
    parseCount(text, [/in\s+(\d+)\s+countries/i, /geographic regions:\s*(\d+)/i]) ??
    geographyLabels.length;

  return {
    id: update.id,
    timestamp: update.timestamp,
    title,
    summary: narrativeParagraphs[0] ?? "",
    whyItMatters: extractWhyItMatters(update.content),
    initiativeCount,
    institutionCount,
    geographyCount,
    geographyLabels,
    categories: Array.from(categorySet),
    initiatives,
    sourceUrls,
    headerImageUrl: update.header_image_url ?? null,
    secondsSaved: update.stats?.sec_saved ?? 0,
  };
}

function toSourceCards(updates: ApiUpdate[]) {
  const cards = new Map<
    string,
    {
      title: string;
      description: string;
      url: string;
      domain: string;
    }
  >();

  for (const update of updates) {
    for (const citation of update.citations) {
      if (cards.has(citation.url)) {
        continue;
      }

      cards.set(citation.url, {
        title:
          citation.preview_data?.title?.trim() ||
          getDomain(citation.url).replace(/\.[^.]+$/, ""),
        description: citation.preview_data?.description?.trim() || "Primary source",
        url: citation.url,
        domain: getDomain(citation.url),
      });
    }
  }

  return Array.from(cards.values());
}

async function fetchScoutJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch scout data: ${response.status}`);
  }

  return (await response.json()) as T;
}

function countArchiveEntries(updates: ApiUpdate[], nonUpdates: ApiNonUpdate[]) {
  const events = [
    ...updates.map((update) => ({ type: "update" as const, timestamp: update.timestamp })),
    ...nonUpdates.map((nonUpdate) => ({
      type: "non_update" as const,
      timestamp: nonUpdate.timestamp,
    })),
  ].sort((left, right) => right.timestamp - left.timestamp);

  let archiveEntryCount = 0;
  let previousType: "update" | "non_update" | null = null;

  for (const event of events) {
    if (event.type === "update" || previousType !== "non_update") {
      archiveEntryCount += 1;
    }

    previousType = event.type;
  }

  return archiveEntryCount;
}

async function fetchAllUpdates(): Promise<{ scout: ApiScout; updates: ApiUpdate[] }> {
  const allUpdates: ApiUpdate[] = [];
  const seenUpdateIds = new Set<string>();
  let scout: ApiScout | null = null;
  let cursor: string | null = null;

  for (let page = 0; page < MAX_CURSOR_PAGES; page++) {
    const url = new URL(`${SCOUT_API_URL}/updates`);
    url.searchParams.set("page_size", String(PAGE_SIZE));

    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const payload = await fetchScoutJson<ApiUpdatesPayload>(url.toString());

    if (!scout) {
      scout = payload.scout;
    }

    for (const update of payload.updates) {
      if (seenUpdateIds.has(update.id)) {
        continue;
      }

      seenUpdateIds.add(update.id);
      allUpdates.push(update);
    }

    if (!payload.next_cursor || payload.updates.length === 0) {
      break;
    }

    cursor = payload.next_cursor;
  }

  if (!scout) {
    throw new Error("No scout data received from API");
  }

  return {
    scout,
    updates: allUpdates.sort((left, right) => right.timestamp - left.timestamp),
  };
}

async function fetchAllNonUpdates(): Promise<ApiNonUpdate[]> {
  const allNonUpdates: ApiNonUpdate[] = [];
  const seenNonUpdateTimestamps = new Set<number>();
  let cursor: string | null = null;

  for (let page = 0; page < MAX_CURSOR_PAGES; page++) {
    const url = new URL(`${SCOUT_API_URL}/non_updates`);
    url.searchParams.set("page_size", String(PAGE_SIZE));

    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const payload = await fetchScoutJson<ApiNonUpdatesPayload>(url.toString());

    for (const nonUpdate of payload.non_updates) {
      if (seenNonUpdateTimestamps.has(nonUpdate.timestamp)) {
        continue;
      }

      seenNonUpdateTimestamps.add(nonUpdate.timestamp);
      allNonUpdates.push(nonUpdate);
    }

    if (!payload.next_cursor || payload.non_updates.length === 0) {
      break;
    }

    cursor = payload.next_cursor;
  }

  return allNonUpdates.sort((left, right) => right.timestamp - left.timestamp);
}

export async function getScoutDashboardData(): Promise<DashboardData> {
  const [{ scout: rawScout, updates: rawUpdates }, rawNonUpdates] = await Promise.all([
    fetchAllUpdates(),
    fetchAllNonUpdates(),
  ]);
  const updates = rawUpdates.map(parseUpdate);
  const runCount = rawUpdates.length + rawNonUpdates.length;
  const archiveEntryCount = countArchiveEntries(rawUpdates, rawNonUpdates);
  const uniqueInstitutions = new Set(
    updates.flatMap((update) =>
      update.initiatives.flatMap((initiative) => splitInstitutions(initiative.institution))
    )
  );
  const uniqueGeographies = new Set(updates.flatMap((update) => update.geographyLabels));
  const uniqueSources = new Set(updates.flatMap((update) => update.sourceUrls));
  const categoryCounts = new Map<string, number>();

  for (const update of updates) {
    for (const category of update.categories) {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }

  return {
    scout: {
      id: rawScout.id,
      title: rawScout.display_name,
      query: rawScout.query,
      createdAt: rawScout.created_at,
      nextOutputTimestamp: rawScout.next_output_timestamp ?? null,
      updateCount: Math.max(rawScout.update_count ?? 0, rawUpdates.length),
      runCount,
      archiveEntryCount,
    },
    updates,
    totals: {
      initiatives: updates.reduce((total, update) => total + update.initiativeCount, 0),
      institutions: uniqueInstitutions.size,
      geographies: uniqueGeographies.size,
      sources: uniqueSources.size,
      hoursSaved:
        Math.round(
          updates.reduce((total, update) => total + update.secondsSaved, 0) / 360
        ) / 10,
    },
    categoryBreakdown: Array.from(categoryCounts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value),
    timeline: updates
      .slice(0, 12)
      .reverse()
      .map((update) => ({
        label: new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
        }).format(new Date(update.timestamp)),
        value: update.initiativeCount,
      })),
    latestSources: toSourceCards(rawUpdates).slice(0, 8),
  };
}
