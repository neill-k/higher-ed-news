type HorizontalBarProps = {
  items: Array<{ label: string; value: number }>;
  maxValue?: number;
};

export function HorizontalBarChart({ items, maxValue }: HorizontalBarProps) {
  const max = maxValue ?? Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs text-[var(--muted-foreground)] w-[140px] shrink-0 truncate">
            {item.label}
          </span>
          <div className="flex-1 h-[10px] bg-[var(--muted)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--chart-1)] rounded-full transition-all"
              style={{ width: `${Math.round((item.value / max) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-medium text-[var(--foreground)] w-[32px] text-right tabular-nums">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
