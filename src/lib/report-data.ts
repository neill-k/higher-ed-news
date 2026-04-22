import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

const REPORT_DATA_PATHS = [
  path.join(process.cwd(), "output", "report-data.json"),
  path.join(process.cwd(), "src", "data", "report-data.json"),
];

async function readFirstAvailable(paths: string[]) {
  for (const filePath of paths) {
    try {
      return await readFile(filePath, "utf8");
    } catch {
      // Try the next candidate path.
    }
  }

  return null;
}

export type ReportInsight = {
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

export type TrendReportData = {
  metadata: {
    generatedAt: string;
    scoutId: string;
    coveragePeriod: { start: string; end: string };
    updateCount: number;
    insightCount: number;
    schemaVersion: string;
  };
  updateBundles: Array<{
    updateId: string;
    timestamp: number;
    periodTitle: string;
    periodRange: string;
    insights: ReportInsight[];
    periodSummary: string;
    periodThemes: string[];
    trendSignals: string[];
    categoryBreakdown: Record<string, number>;
    regionBreakdown: Record<string, number>;
    institutionTypeBreakdown: Record<string, number>;
  }>;
  trends: Array<{
    id: string;
    name: string;
    category: string;
    maturity: string;
    direction: string;
    initiativeCount: number;
    firstSeen: string;
    lastSeen: string;
    insightIds: string[];
    narrative: string;
  }>;
  tensions: Array<{
    label: string;
    description: string;
    sideA: string[];
    sideB: string[];
    intensity: "high" | "medium" | "low";
  }>;
  maturityScores: Array<{
    institution: string;
    overallLevel: number;
    dimensions: Record<string, number>;
    evidenceInsightIds: string[];
    lastUpdated: string;
    dataPointCount: number;
  }>;
  aggregates: {
    byCategory: Record<string, number>;
    byRegion: Record<string, number>;
    byInstitutionType: Record<string, number>;
    byTechnology: Record<string, number>;
    byMaturity: Record<string, number>;
    byCollaboration: Record<string, number>;
    byInvestmentScale: Record<string, number>;
    topInstitutions: Array<{ name: string; count: number }>;
    topVendors: Array<{ name: string; count: number }>;
  };
};

export type InstitutionSnapshot = {
  name: string;
  type: string;
  primaryRegion: string;
  insightCount: number;
  categories: Record<string, number>;
  toolSignals: number;
  policySignals: number;
  ethicsSignals: number;
  dataGovernanceSignals: number;
  facultySignals: number;
  equitySignals: number;
  investmentAmount: number;
  overallLevel: number | null;
  dimensions: Record<string, number> | null;
  lastUpdated: string | null;
};

export type InvestmentDeal = {
  id: string;
  institution: string;
  title: string;
  description: string;
  category: string;
  amountUsd: number;
  sourceLabel: string;
  sourceBucket: string;
  scale: string;
  date: string;
};

export type ReportDataset = {
  data: TrendReportData;
  insights: ReportInsight[];
  institutions: InstitutionSnapshot[];
  investments: InvestmentDeal[];
  dateRange: {
    start: Date;
    end: Date;
    midpoint: number;
  };
};

const CATEGORY_LABELS: Record<string, string> = {
  governance_and_policy: "Policy Frameworks",
  teaching_and_learning: "AI Courses",
  research_and_innovation: "Research Tools",
  student_experience_and_services: "Student Services",
  enterprise_tools_and_infrastructure: "Administrative AI",
  workforce_and_economic_development: "Workforce Programs",
  institutional_transformation: "Institutional Change",
  equity_access_and_inclusion: "Equity & Access",
};

const INSTITUTION_TYPE_LABELS: Record<string, string> = {
  r1_research: "R1 Research Universities",
  r2_research: "R2 Research Universities",
  comprehensive_regional: "Comprehensive Regionals",
  liberal_arts: "Liberal Arts Colleges",
  community_college: "Community Colleges",
  online_for_profit: "Online-First",
  professional_school: "Professional Schools",
  minority_serving: "MSI / HBCU / HSI",
  international: "International Institutions",
  system_or_consortium: "Systems & Consortia",
  unknown: "Unclassified",
};

const REGION_LABELS: Record<string, string> = {
  us_northeast: "Northeast",
  us_southeast: "Southeast",
  us_midwest: "Midwest",
  us_west: "West Coast",
  us_national: "U.S. National",
  canada: "Canada",
  united_kingdom: "United Kingdom",
  european_union: "European Union",
  china: "China",
  south_korea: "South Korea",
  japan: "Japan",
  india: "India",
  southeast_asia: "Southeast Asia",
  australia_nz: "Australia & New Zealand",
  latin_america: "Latin America",
  middle_east: "Middle East",
  sub_saharan_africa: "Sub-Saharan Africa",
  multi_region: "Multi-region",
  unknown: "Unknown",
};

function percentage(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((part / total) * 100);
}

function toSearchText(insight: ReportInsight) {
  return [
    insight.title,
    insight.description,
    insight.policyImplications ?? "",
    ...insight.secondaryCategories,
    ...insight.subcategories,
    ...insight.stakeholderImpact,
    ...insight.technologyFocus,
    ...insight.toolsAndVendors.map((tool) => `${tool.name} ${tool.vendor} ${tool.role}`),
  ]
    .join(" ")
    .toLowerCase();
}

function classifyFundingBucket(
  title: string,
  sourceLabel: string | null,
  description: string,
) {
  const text = `${title} ${sourceLabel ?? ""} ${description}`.toLowerCase();

  if (
    /venture|capital|vc|private equity|investor|industry|corporate|microsoft|google|nvidia|anthropic|openai|amazon|aws|coreweave|partnership/.test(
      text,
    )
  ) {
    return "Corporate / VC";
  }

  if (
    /federal|nsf|nih|arpa|grant|government|ministry|commission|state funding|national|department of education|public/.test(
      text,
    )
  ) {
    return "Federal / Public Grants";
  }

  if (
    /institution|university|internal|budget|campus|system|endowment|philanthrop|gift|alumni|foundation/.test(
      text,
    )
  ) {
    return "Institutional / Philanthropic";
  }

  return "Other";
}

export function formatCategoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category.replaceAll("_", " ");
}

export function formatInstitutionType(type: string) {
  return INSTITUTION_TYPE_LABELS[type] ?? type.replaceAll("_", " ");
}

export function formatRegionLabel(region: string) {
  return REGION_LABELS[region] ?? region.replaceAll("_", " ");
}

export function formatCurrencyCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: value >= 10_000_000_000 ? 0 : 1,
  }).format(value);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function intensityWeight(intensity: "high" | "medium" | "low") {
  if (intensity === "high") {
    return 1.7;
  }

  if (intensity === "medium") {
    return 1;
  }

  return 0.5;
}

export function computeInstitutionScore(institution: InstitutionSnapshot) {
  const categoryCoverage = Object.keys(institution.categories).length;
  const base = (institution.overallLevel ?? 2.5) * 12;
  const breadth = categoryCoverage * 3;
  const depth = Math.min(institution.insightCount, 10) * 2;
  const governance = institution.policySignals > 0 ? 6 : 0;

  return Math.min(99, Math.round(base + breadth + depth + governance));
}

export const getReportDataset = cache(async (): Promise<ReportDataset | null> => {
  const raw = await readFirstAvailable(REPORT_DATA_PATHS);
  if (!raw) {
    return null;
  }

  try {
    const data = JSON.parse(raw) as TrendReportData;
    const insights = data.updateBundles.flatMap((bundle) => bundle.insights);
    const fallbackStart = new Date(data.metadata.coveragePeriod.start);
    const fallbackEnd = new Date(data.metadata.coveragePeriod.end);

    if (insights.length === 0) {
      return {
        data,
        insights: [],
        institutions: [],
        investments: [],
        dateRange: {
          start: fallbackStart,
          end: fallbackEnd,
          midpoint:
            fallbackStart.getTime() +
            (fallbackEnd.getTime() - fallbackStart.getTime()) / 2,
        },
      };
    }

    const timestamps = insights.map((insight) => new Date(insight.date).getTime());
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    const institutionMap = new Map<string, InstitutionSnapshot>();
    const maturityMap = new Map(
      data.maturityScores.map((score) => [score.institution, score] as const),
    );

    for (const insight of insights) {
      const searchText = toSearchText(insight);
      const institutionNames = new Set<string>();

      for (const institution of insight.institutions) {
        if (institutionNames.has(institution.name)) {
          continue;
        }

        institutionNames.add(institution.name);

        const existing = institutionMap.get(institution.name) ?? {
          name: institution.name,
          type: institution.type || "unknown",
          primaryRegion: institution.region || "unknown",
          insightCount: 0,
          categories: {},
          toolSignals: 0,
          policySignals: 0,
          ethicsSignals: 0,
          dataGovernanceSignals: 0,
          facultySignals: 0,
          equitySignals: 0,
          investmentAmount: 0,
          overallLevel: null,
          dimensions: null,
          lastUpdated: null,
        };

        existing.type ||= institution.type || "unknown";
        existing.primaryRegion ||= institution.region || "unknown";
        existing.insightCount += 1;
        existing.categories[insight.primaryCategory] =
          (existing.categories[insight.primaryCategory] ?? 0) + 1;

        if (insight.toolsAndVendors.length > 0) {
          existing.toolSignals += 1;
        }

        if (
          insight.primaryCategory === "governance_and_policy" ||
          insight.hasPolicyImplications
        ) {
          existing.policySignals += 1;
        }

        if (/ethic|committee|oversight|responsible ai|board/.test(searchText)) {
          existing.ethicsSignals += 1;
        }

        if (/data governance|privacy|ferpa|security|compliance|data/.test(searchText)) {
          existing.dataGovernanceSignals += 1;
        }

        if (
          insight.primaryCategory === "teaching_and_learning" ||
          /faculty|curriculum|training|pedagog/.test(searchText)
        ) {
          existing.facultySignals += 1;
        }

        if (insight.primaryCategory === "equity_access_and_inclusion") {
          existing.equitySignals += 1;
        }

        if (insight.investmentSignal?.amountUsd) {
          existing.investmentAmount += insight.investmentSignal.amountUsd;
        }

        const maturity = maturityMap.get(institution.name);
        if (maturity) {
          existing.overallLevel = maturity.overallLevel;
          existing.dimensions = maturity.dimensions;
          existing.lastUpdated = maturity.lastUpdated;
        }

        institutionMap.set(institution.name, existing);
      }
    }

    const investmentMap = new Map<string, InvestmentDeal>();

    for (const insight of insights) {
      const amountUsd = insight.investmentSignal?.amountUsd;
      if (!amountUsd) {
        continue;
      }

      const firstInstitution = insight.institutions[0]?.name ?? "Multiple institutions";
      const sourceLabel = insight.investmentSignal?.fundingSource ?? "Undisclosed";
      const sourceBucket = classifyFundingBucket(
        insight.title,
        sourceLabel,
        insight.investmentSignal?.description ?? "",
      );
      const key = `${insight.title.toLowerCase()}|${amountUsd}|${firstInstitution.toLowerCase()}`;

      investmentMap.set(key, {
        id: insight.id,
        institution: firstInstitution,
        title: insight.title,
        description: insight.investmentSignal?.description ?? insight.description,
        category: insight.primaryCategory,
        amountUsd,
        sourceLabel,
        sourceBucket,
        scale: insight.investmentSignal?.scale ?? "unknown",
        date: insight.date,
      });
    }

    const investments = Array.from(investmentMap.values()).sort((left, right) => {
      if (right.amountUsd !== left.amountUsd) {
        return right.amountUsd - left.amountUsd;
      }

      return right.date.localeCompare(left.date);
    });

    return {
      data,
      insights,
      institutions: Array.from(institutionMap.values()),
      investments,
      dateRange: {
        start: new Date(minTimestamp),
        end: new Date(maxTimestamp),
        midpoint: minTimestamp + (maxTimestamp - minTimestamp) / 2,
      },
    };
  } catch {
    return null;
  }
});

export function percentOf(part: number, total: number) {
  return percentage(part, total);
}
