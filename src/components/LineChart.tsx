"use client";

type Point = { label: string; value: number };

export function LineChart({
  points,
  color,
  unit,
}: {
  points: Point[];
  color: string;
  unit: string;
}) {
  if (!points.length) {
    return <div className="text-sm text-[var(--ink-faint)] py-5 text-center">Not enough sessions yet.</div>;
  }
  const w = 560;
  const h = 160;
  const padX = 12;
  const padY = 16;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = points.length > 1 ? (w - padX * 2) / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = padX + i * stepX;
    const y = h - padY - ((p.value - min) / range) * (h - padY * 2);
    return { x, y, ...p };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const avg = values.reduce((s, v) => s + v, 0) / values.length;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto overflow-visible">
        <line
          x1={padX}
          x2={w - padX}
          y1={h - padY - ((avg - min) / range) * (h - padY * 2)}
          y2={h - padY - ((avg - min) / range) * (h - padY * 2)}
          stroke="var(--chart-grid, #e1e0d9)"
          strokeDasharray="4 4"
        />
        <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={3} fill={color} />
        ))}
      </svg>
      <div className="text-xs text-[var(--ink-soft)] mt-1">
        Average: <span className="font-mono-ink">{avg.toFixed(1)}{unit}</span> over {points.length} session(s)
      </div>
    </div>
  );
}
