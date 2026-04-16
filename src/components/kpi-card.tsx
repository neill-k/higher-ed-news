type KpiCardProps = {
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
};

export function KpiCard({ label, value, trend, trendUp }: KpiCardProps) {
  return (
    <div className="flex flex-col gap-2 p-5 rounded-[var(--radius-xs)] border border-[var(--border-light)] bg-white flex-1 min-w-[160px]">
      <span className="text-xs text-[var(--muted-foreground)] font-medium">
        {label}
      </span>
      <span className="text-[28px] font-bold text-[var(--foreground)] leading-none tracking-tight">
        {value}
      </span>
      {trend && (
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full w-fit ${
            trendUp
              ? "bg-[var(--success)] text-[var(--success-fg)]"
              : "bg-[var(--error)] text-[var(--error-fg)]"
          }`}
        >
          {trendUp ? "\u2191" : "\u2193"} {trend}
        </span>
      )}
    </div>
  );
}
