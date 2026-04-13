"use client";

import { useState } from "react";

export type InitiativeTableRow = {
  id: string;
  institution: string;
  category: string;
  initiative: string;
  reportDate: string;
  monthLabel: string;
  sortDate: number;
  details: string;
  sourceUrl: string;
  sourceDomain: string;
};

type SortKey = "institution" | "category" | "initiative" | "sortDate" | "sourceDomain";
type SortDirection = "asc" | "desc";

type InitiativesTableProps = {
  rows: InitiativeTableRow[];
  categories: string[];
  months: string[];
  domains: string[];
};

function sortRows(rows: InitiativeTableRow[], key: SortKey, direction: SortDirection) {
  return [...rows].sort((left, right) => {
    let comparison = 0;

    if (key === "sortDate") {
      comparison = left.sortDate - right.sortDate;
    } else {
      comparison = left[key].localeCompare(right[key]);
    }

    return direction === "asc" ? comparison : -comparison;
  });
}

function sortIcon(activeKey: SortKey, activeDirection: SortDirection, columnKey: SortKey) {
  if (activeKey !== columnKey) {
    return "↕";
  }

  return activeDirection === "asc" ? "↑" : "↓";
}

export function InitiativesTable({
  rows,
  categories,
  months,
  domains,
}: InitiativesTableProps) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sortDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const filteredRows = rows.filter((row) => {
    if (categoryFilter && row.category !== categoryFilter) {
      return false;
    }

    if (monthFilter && row.monthLabel !== monthFilter) {
      return false;
    }

    if (domainFilter && row.sourceDomain !== domainFilter) {
      return false;
    }

    return true;
  });
  const visibleRows = sortRows(filteredRows, sortKey, sortDirection);

  function handleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "sortDate" ? "desc" : "asc");
  }

  function resetFilters() {
    setCategoryFilter("");
    setMonthFilter("");
    setDomainFilter("");
    setSortKey("sortDate");
    setSortDirection("desc");
  }

  return (
    <div className="dashboard-card overflow-hidden">
      <div className="border-b border-border px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="dashboard-kicker">Filter by</span>

          <label className="sr-only" htmlFor="category-filter">
            Filter initiatives by category
          </label>
          <select
            id="category-filter"
            className="rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-deep-teal"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="month-filter">
            Filter initiatives by month
          </label>
          <select
            id="month-filter"
            className="rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-deep-teal"
            value={monthFilter}
            onChange={(event) => setMonthFilter(event.target.value)}
          >
            <option value="">All months</option>
            {months.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="domain-filter">
            Filter initiatives by source domain
          </label>
          <select
            id="domain-filter"
            className="rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-deep-teal"
            value={domainFilter}
            onChange={(event) => setDomainFilter(event.target.value)}
          >
            <option value="">All source domains</option>
            {domains.map((domain) => (
              <option key={domain} value={domain}>
                {domain}
              </option>
            ))}
          </select>

          <button
            className="rounded-[10px] border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-deep-teal hover:text-deep-teal"
            type="button"
            onClick={resetFilters}
          >
            Reset
          </button>

          <span className="ml-auto text-sm text-muted">
            {visibleRows.length} initiative{visibleRows.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-surface">
            <tr className="border-b border-border">
              <th className="px-5 py-4 sm:px-6">
                <button
                  className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-deep-teal"
                  type="button"
                  onClick={() => handleSort("institution")}
                >
                  Institution / System
                  <span aria-hidden>{sortIcon(sortKey, sortDirection, "institution")}</span>
                </button>
              </th>
              <th className="px-5 py-4">
                <button
                  className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-deep-teal"
                  type="button"
                  onClick={() => handleSort("category")}
                >
                  Category
                  <span aria-hidden>{sortIcon(sortKey, sortDirection, "category")}</span>
                </button>
              </th>
              <th className="px-5 py-4">
                <button
                  className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-deep-teal"
                  type="button"
                  onClick={() => handleSort("initiative")}
                >
                  Initiative
                  <span aria-hidden>{sortIcon(sortKey, sortDirection, "initiative")}</span>
                </button>
              </th>
              <th className="px-5 py-4">
                <button
                  className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-deep-teal"
                  type="button"
                  onClick={() => handleSort("sortDate")}
                >
                  Report date
                  <span aria-hidden>{sortIcon(sortKey, sortDirection, "sortDate")}</span>
                </button>
              </th>
              <th className="px-5 py-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                  Key details
                </span>
              </th>
              <th className="px-5 py-4 sm:px-6">
                <button
                  className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-deep-teal"
                  type="button"
                  onClick={() => handleSort("sourceDomain")}
                >
                  Source
                  <span aria-hidden>{sortIcon(sortKey, sortDirection, "sourceDomain")}</span>
                </button>
              </th>
            </tr>
          </thead>

          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td className="px-5 py-12 text-center text-sm italic text-muted sm:px-6" colSpan={6}>
                  No initiatives match the current filters.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/80 transition-colors hover:bg-surface/60"
                >
                  <td className="px-5 py-4 align-top font-medium text-foreground sm:px-6">
                    {row.institution}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
                      {row.category}
                    </span>
                  </td>
                  <td className="px-5 py-4 align-top text-foreground">{row.initiative}</td>
                  <td className="px-5 py-4 align-top text-muted">{row.reportDate}</td>
                  <td className="min-w-[22rem] px-5 py-4 align-top text-muted">{row.details}</td>
                  <td className="px-5 py-4 align-top sm:px-6">
                    {row.sourceUrl ? (
                      <a
                        className="font-medium text-deep-teal transition-colors hover:text-cyan"
                        href={row.sourceUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {row.sourceDomain}
                      </a>
                    ) : (
                      <span className="text-muted">Unavailable</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
