import { useMemo } from 'react';
import type { ServiceStat } from '../data';

interface DonutChartProps {
  data: ServiceStat[];
}

const segmentColors = [
  'hsl(180 100% 50%)',
  'hsl(200 95% 55%)',
  'hsl(145 80% 45%)',
  'hsl(35 90% 55%)',
  'hsl(355 85% 55%)',
];

export default function ServiceBreakdown({ data }: DonutChartProps) {
  const total = useMemo(() => data.reduce((s, d) => s + d.total, 0), [data]);

  // Build donut segments
  let cumulative = 0;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  const segments = data.map((d, i) => {
    const fraction = d.total / total;
    const dash = fraction * circumference;
    const offset = -cumulative * circumference;
    cumulative += fraction;
    return { ...d, dash, offset, color: segmentColors[i % segmentColors.length], fraction };
  });

  return (
    <div className="glass glass-hover animate-fade-up rounded-2xl p-5" style={{ animationDelay: '300ms' }}>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
        Tasks by Service
      </h2>
      <div className="flex items-center gap-6">
        {/* Donut */}
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
            <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
            {segments.map((s, i) => (
              <circle
                key={i}
                cx="64"
                cy="64"
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth="12"
                strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                strokeDashoffset={s.offset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.8s ease, stroke-dashoffset 0.8s ease' }}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-semibold text-text-main">{total}</span>
            <span className="text-[10px] uppercase tracking-wider text-text-faint">total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {segments.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
                <span className="truncate text-text-muted">{s.service.replace('brainlife/', '')}</span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-text-main">{s.total}</span>
                <span className="text-text-faint">{(s.fraction * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
