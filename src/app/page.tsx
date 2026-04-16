import { getScoutDashboardData } from "@/lib/yutori";
import { Sidebar } from "@/components/sidebar";
import { KpiCard } from "@/components/kpi-card";
import { HorizontalBarChart } from "@/components/horizontal-bar";

export default async function DashboardOverview() {
  const data = await getScoutDashboardData();

  // Derive leadership-relevant metrics
  const totalInitiatives = data.totals.initiatives;
  const totalInstitutions = data.totals.institutions;
  const totalGeographies = data.totals.geographies;
  const topCategory = data.categoryBreakdown[0];

  // Get the most recent update for the "signal" callout
  const latestUpdate = data.updates[0];

  // Flatten recent initiatives across updates for the table
  const recentInitiatives = data.updates
    .flatMap((u) =>
      u.initiatives.map((init) => ({
        institution: init.institution,
        title: init.title,
        description: init.description,
        categories: init.categories,
        date: new Date(u.timestamp).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      }))
    )
    .slice(0, 10);

  // Compute week-over-week pace
  const recentUpdates = data.updates.slice(0, 7);
  const avgInitiativesPerWeek =
    recentUpdates.length > 0
      ? Math.round(
          recentUpdates.reduce((s, u) => s + u.initiativeCount, 0) /
            Math.max(recentUpdates.length / 7, 1)
        )
      : 0;

  return (
    <div className="flex h-full w-full">
      <Sidebar />

      <main className="flex-1 overflow-y-auto bg-[var(--background)]">
        <div className="max-w-[1100px] mx-auto px-8 py-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-[22px] font-bold text-[var(--foreground)]">
                AI in Higher Education
              </h1>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                Strategic intelligence briefing {"\u2014"}{" "}
                {new Date().toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Signal callout */}
          {latestUpdate && (
            <div className="flex items-start gap-4 p-5 rounded-[var(--radius-xs)] bg-[#fdf8ed] border border-[#e8dbb8] mb-6">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--chart-1)] text-white text-xs font-bold shrink-0 mt-0.5">
                !
              </div>
              <div>
                <div className="text-[11px] font-medium text-[var(--chart-5)] uppercase tracking-wider mb-1">
                  Latest Signal
                </div>
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  {latestUpdate.title}
                </div>
                {latestUpdate.summary && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed max-w-[700px]">
                    {latestUpdate.summary.slice(0, 200)}
                    {latestUpdate.summary.length > 200 ? "..." : ""}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* KPI Row */}
          <div className="flex gap-4 mb-8">
            <KpiCard
              label="Institutions Making AI Moves"
              value={String(totalInstitutions)}
              trend={`across ${totalGeographies} countries`}
              trendUp
            />
            <KpiCard
              label="Initiatives Tracked"
              value={String(totalInitiatives)}
              trend={`~${avgInitiativesPerWeek}/week pace`}
              trendUp
            />
            <KpiCard
              label="Top Initiative Type"
              value={topCategory?.label ?? "N/A"}
              trend={`${topCategory?.value ?? 0} occurrences`}
              trendUp
            />
            <KpiCard
              label="Geographic Reach"
              value={`${totalGeographies}`}
              trend="countries & regions"
              trendUp
            />
          </div>

          {/* Two-column: Categories + Recent Headlines */}
          <div className="flex gap-6 mb-8">
            {/* Where the activity is */}
            <div className="flex-1 p-6 rounded-[var(--radius-m)] bg-[var(--tile)]">
              <h2 className="text-sm font-semibold text-[var(--foreground)] mb-1">
                Where the Activity Is
              </h2>
              <p className="text-[11px] text-[var(--muted-foreground)] mb-5">
                Initiative types across all tracked reports
              </p>
              <HorizontalBarChart items={data.categoryBreakdown} />
            </div>

            {/* Recent headlines */}
            <div className="flex-1 p-6 rounded-[var(--radius-m)] bg-[var(--tile)]">
              <h2 className="text-sm font-semibold text-[var(--foreground)] mb-1">
                Recent Headlines
              </h2>
              <p className="text-[11px] text-[var(--muted-foreground)] mb-5">
                Latest developments from the field
              </p>
              <ul className="flex flex-col gap-3">
                {data.updates.slice(0, 5).map((update) => (
                  <li
                    key={update.id}
                    className="flex gap-2 text-xs leading-relaxed"
                  >
                    <span className="text-[var(--chart-1)] mt-0.5 shrink-0">
                      {"\u2022"}
                    </span>
                    <div>
                      <span className="font-medium text-[var(--foreground)]">
                        {update.title}
                      </span>
                      <span className="text-[var(--muted-foreground)] ml-1">
                        {"\u2014"}{" "}
                        {update.initiativeCount} initiative
                        {update.initiativeCount !== 1 ? "s" : ""} across{" "}
                        {update.institutionCount} institution
                        {update.institutionCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Pace of change timeline */}
          <div className="p-6 rounded-[var(--radius-m)] bg-[var(--tile)] mb-8">
            <h2 className="text-sm font-semibold text-[var(--foreground)] mb-1">
              Pace of Change
            </h2>
            <p className="text-[11px] text-[var(--muted-foreground)] mb-5">
              New initiatives per reporting period
            </p>
            <div className="flex items-end gap-2 h-[120px]">
              {data.timeline.map((point) => {
                const maxVal = Math.max(
                  ...data.timeline.map((p) => p.value),
                  1
                );
                const heightPct = Math.round((point.value / maxVal) * 100);
                return (
                  <div
                    key={point.label}
                    className="flex flex-col items-center gap-1 flex-1"
                  >
                    <span className="text-[10px] font-medium text-[var(--foreground)] tabular-nums">
                      {point.value}
                    </span>
                    <div
                      className="w-full bg-[var(--chart-1)] rounded-t-[3px] transition-all min-h-[4px]"
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      {point.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Initiatives table */}
          <div className="p-6 rounded-[var(--radius-m)] bg-[var(--tile)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">
                  Recent Initiatives
                </h2>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                  What peer institutions are doing right now
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-light)]">
                    <th className="text-left py-2 font-medium text-[var(--muted-foreground)]">
                      Institution
                    </th>
                    <th className="text-left py-2 font-medium text-[var(--muted-foreground)]">
                      Initiative
                    </th>
                    <th className="text-left py-2 font-medium text-[var(--muted-foreground)]">
                      Type
                    </th>
                    <th className="text-left py-2 font-medium text-[var(--muted-foreground)]">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentInitiatives.map((init, i) => (
                    <tr
                      key={`${init.institution}-${i}`}
                      className="border-b border-[var(--border-light)] last:border-0"
                    >
                      <td className="py-2.5 pr-4 font-medium text-[var(--foreground)] whitespace-nowrap">
                        {init.institution}
                      </td>
                      <td className="py-2.5 pr-4 text-[var(--foreground)] max-w-[300px]">
                        {init.title}
                        {init.description && (
                          <span className="text-[var(--muted-foreground)]">
                            {" \u2014 "}
                            {init.description.slice(0, 80)}
                            {init.description.length > 80 ? "..." : ""}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        {init.categories[0] && (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--muted)] text-[var(--muted-foreground)]">
                            {init.categories[0]}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-[var(--muted-foreground)] whitespace-nowrap">
                        {init.date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
