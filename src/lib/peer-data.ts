import "server-only";

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

export type PeerProfile = {
  institution: string;
  slug: string;
  city_state: string;
  carnegie: string;
  aau_member: boolean;
  enrollment: number | null;
  lsu_peer_tiers: {
    sec: boolean;
    sreb_4yr_1: boolean;
    carnegie_land_grant: boolean;
    aau_aspirational: boolean;
  };
  system_leadership: {
    president_name: string | null;
    cio_name: string | null;
    chief_ai_officer: string | null;
    has_dedicated_ai_role: boolean;
  };
  ai_policy: {
    has_published_policy: boolean;
    policy_urls: string[];
    adopted_date: string | null;
    scope: string[];
    key_provisions: string[];
    summary: string;
  };
  governance_structure: {
    committee_name: string | null;
    committee_url: string | null;
    committee_members_public: boolean;
    notes: string;
  };
  vendor_deployments: Array<{
    vendor: string;
    product: string;
    scope: string;
    user_count: number | null;
    announced_date: string | null;
    evidence_urls: string[];
    notes: string;
  }>;
  ai_academic_programs: Array<{
    program_type: string;
    name: string;
    level: string;
    announced_or_launched: string | null;
    evidence_url: string;
  }>;
  notable_deals_investments: Array<{
    title: string;
    amount_usd: number | null;
    counterparty: string;
    date: string | null;
    evidence_url: string;
    summary: string;
  }>;
  leadership_statements: Array<{
    speaker: string;
    role: string;
    date: string | null;
    context: string;
    quote_or_summary: string;
    evidence_url: string;
  }>;
  state_ai_policy_context: {
    state: string;
    has_state_ai_executive_order: boolean;
    has_higher_ed_system_ai_policy: boolean;
    summary: string;
    evidence_urls: string[];
  };
  litigation_or_controversy: Array<{
    date: string | null;
    summary: string;
    status: string;
    evidence_url: string;
  }>;
  narrative_summary: string;
  confidence_notes: string;
  sources: string[];
  researched_on: string;
};

export const ANCHOR_SLUG = "lsu";

export type VendorBucket =
  | "microsoft_copilot"
  | "chatgpt_edu"
  | "claude_education"
  | "google_gemini"
  | "homegrown"
  | "other";

const VENDOR_PATTERNS: Array<{ bucket: VendorBucket; test: (s: string) => boolean; label: string }> =
  [
    {
      bucket: "microsoft_copilot",
      label: "Microsoft Copilot",
      test: (s) => /copilot|microsoft 365 copilot|m365 copilot/i.test(s),
    },
    {
      bucket: "chatgpt_edu",
      label: "ChatGPT Edu",
      test: (s) => /chatgpt edu|openai for education|chatgpt enterprise/i.test(s),
    },
    {
      bucket: "claude_education",
      label: "Claude for Education",
      test: (s) => /claude for education|anthropic claude/i.test(s),
    },
    {
      bucket: "google_gemini",
      label: "Google Gemini / NotebookLM",
      test: (s) => /gemini|notebooklm|google for education ai/i.test(s),
    },
    {
      bucket: "homegrown",
      label: "Homegrown / custom",
      test: (s) =>
        /custom|homegrown|in-house|built by|university-built|institution-built|via azure|via aws|bedrock|openai via/i.test(
          s,
        ),
    },
  ];

export function classifyVendor(vendor: string, product: string, notes: string): {
  bucket: VendorBucket;
  label: string;
} {
  const combined = `${vendor} ${product} ${notes}`.toLowerCase();
  for (const pattern of VENDOR_PATTERNS) {
    if (pattern.test(combined)) {
      return { bucket: pattern.bucket, label: pattern.label };
    }
  }
  return { bucket: "other", label: vendor || product || "Other vendor" };
}

export const VENDOR_LABEL: Record<VendorBucket, string> = {
  microsoft_copilot: "Microsoft Copilot",
  chatgpt_edu: "ChatGPT Edu",
  claude_education: "Claude for Education",
  google_gemini: "Google Gemini / NotebookLM",
  homegrown: "Homegrown / custom RAG",
  other: "Other",
};

export const VENDOR_ORDER: VendorBucket[] = [
  "microsoft_copilot",
  "chatgpt_edu",
  "claude_education",
  "google_gemini",
  "homegrown",
  "other",
];

export const getPeerProfiles = cache(async (): Promise<PeerProfile[]> => {
  const dir = path.join(process.cwd(), "data", "sec-peers");
  const entries = await readdir(dir);
  const files = entries.filter((name) => name.endsWith(".json") && !name.startsWith("_"));
  const profiles = await Promise.all(
    files.map(async (file) => {
      const raw = await readFile(path.join(dir, file), "utf8");
      return JSON.parse(raw) as PeerProfile;
    }),
  );
  return profiles.sort((left, right) => left.institution.localeCompare(right.institution));
});

export const getAnchor = cache(async (): Promise<PeerProfile | null> => {
  const profiles = await getPeerProfiles();
  return profiles.find((p) => p.slug === ANCHOR_SLUG) ?? null;
});

export function peerSetLabel(key: "sec" | "sreb_4yr_1" | "carnegie_land_grant" | "aau_aspirational") {
  if (key === "sec") return "SEC";
  if (key === "sreb_4yr_1") return "SREB 4-Yr 1";
  if (key === "carnegie_land_grant") return "Carnegie Land-Grant";
  return "AAU aspirational";
}

export function filterByTier(
  profiles: PeerProfile[],
  tier: "sec" | "sreb_4yr_1" | "carnegie_land_grant" | "aau_aspirational",
) {
  return profiles.filter((profile) => profile.lsu_peer_tiers[tier]);
}

/** True when a peer has at least one deployment classified into this bucket. */
export function hasVendor(profile: PeerProfile, bucket: VendorBucket) {
  return profile.vendor_deployments.some((deployment) => {
    const classification = classifyVendor(
      deployment.vendor,
      deployment.product,
      deployment.notes,
    );
    return classification.bucket === bucket;
  });
}

export function countWithPolicy(profiles: PeerProfile[]) {
  return profiles.filter((p) => p.ai_policy.has_published_policy).length;
}

export function countWithChiefAIOfficer(profiles: PeerProfile[]) {
  return profiles.filter(
    (p) =>
      p.system_leadership.chief_ai_officer !== null || p.system_leadership.has_dedicated_ai_role,
  ).length;
}

export function countWithStateHigherEdPolicy(profiles: PeerProfile[]) {
  return profiles.filter((p) => p.state_ai_policy_context.has_higher_ed_system_ai_policy).length;
}

export function countWithStateExecutiveOrder(profiles: PeerProfile[]) {
  return profiles.filter((p) => p.state_ai_policy_context.has_state_ai_executive_order).length;
}

export function countActiveLitigation(profiles: PeerProfile[]) {
  return profiles.filter((p) =>
    p.litigation_or_controversy.some((item) => item.status === "active"),
  ).length;
}

export function totalAcademicPrograms(profiles: PeerProfile[]) {
  return profiles.reduce((sum, profile) => sum + profile.ai_academic_programs.length, 0);
}

export function totalVendorDeployments(profiles: PeerProfile[]) {
  return profiles.reduce((sum, profile) => sum + profile.vendor_deployments.length, 0);
}

export function recentLeadershipStatements(profiles: PeerProfile[], limit = 6) {
  const rows = profiles.flatMap((profile) =>
    profile.leadership_statements.map((statement) => ({
      ...statement,
      institution: profile.institution,
      slug: profile.slug,
    })),
  );
  return rows
    .filter((row) => row.date)
    .sort((left, right) => (right.date ?? "").localeCompare(left.date ?? ""))
    .slice(0, limit);
}

export function activeControversies(profiles: PeerProfile[]) {
  return profiles.flatMap((profile) =>
    profile.litigation_or_controversy
      .filter((item) => item.status === "active")
      .map((item) => ({
        ...item,
        institution: profile.institution,
        slug: profile.slug,
      })),
  );
}

export function peerMedian(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
