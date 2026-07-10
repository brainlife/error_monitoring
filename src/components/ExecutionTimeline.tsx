import { useMemo } from 'react';
import { Info } from 'lucide-react';
import type { Task } from '../data';

interface ExecutionTimelineProps {
  tasks: Task[];
}

interface TimelineEvent {
  id: string;
  status: 'running' | 'finished' | 'failed' | 'queued' | 'cancelled' | 'unknown';
  startPct: number;
  widthPct: number;
  tooltip: string;
}

interface ServiceTimeline {
  name: string;
  events: TimelineEvent[];
}

const statusColors = {
  running: 'bg-status-running shadow-[0_0_12px_#00E5FF] animate-pulse',
  finished: 'bg-status-success shadow-[0_0_8px_rgba(16,185,129,0.3)]',
  failed: 'bg-status-error shadow-[0_0_8px_rgba(239,68,68,0.3)]',
  queued: 'bg-status-warning shadow-[0_0_8px_rgba(245,158,11,0.3)]',
  cancelled: 'bg-text-faint',
  unknown: 'bg-accent-purple',
};

export default function ExecutionTimeline({ tasks }: ExecutionTimelineProps) {
  // Define time range: last 1 hour
  const timeWindow = 60 * 60 * 1000; // 1 hour in ms

  const { serviceTimelines, timestamps, overview } = useMemo(() => {
    const now = Date.now();
    const startTime = now - timeWindow;

    // 1. Generate dynamic timeline timestamp labels (10 min increments)
    const labels: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const t = new Date(now - i * 12 * 60 * 1000);
      labels.push(t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    labels.push('Now');

    // 2. Filter tasks within the timeline window (or tasks currently running)
    const activeTasks = tasks.filter(t => {
      if (!t.startDate) return false;
      const tStart = new Date(t.startDate).getTime();
      const tEnd = t.finishDate ? new Date(t.finishDate).getTime() : now;
      return tEnd >= startTime && tStart <= now;
    });

    // 3. Group tasks by service name
    const serviceMap: Record<string, TimelineEvent[]> = {};
    const overviewStats = { running: 0, finished: 0, failed: 0, queued: 0 };

    activeTasks.forEach((t) => {
      const tStart = new Date(t.startDate!).getTime();
      const tEnd = t.finishDate ? new Date(t.finishDate).getTime() : now;

      // Update overview counts
      if (t.status === 'running') overviewStats.running++;
      else if (t.status === 'finished') overviewStats.finished++;
      else if (t.status === 'failed') overviewStats.failed++;
      else if (t.status === 'queued') overviewStats.queued++;

      // Calculate relative start & width percentage
      const relativeStart = Math.max(0, tStart - startTime);
      const relativeEnd = Math.max(0, tEnd - startTime);

      const startPct = (relativeStart / timeWindow) * 100;
      const endPct = (relativeEnd / timeWindow) * 100;
      const widthPct = Math.max(3, endPct - startPct); // Minimum 3% width for visibility

      const durationSecs = Math.round((tEnd - tStart) / 1000);
      const durationStr = durationSecs > 60 
        ? `${(durationSecs / 60).toFixed(1)}m` 
        : `${durationSecs}s`;

      const event: TimelineEvent = {
        id: t.id,
        status: t.status,
        startPct,
        widthPct,
        tooltip: `${t.id.slice(-6)}: ${t.status.toUpperCase()} (${durationStr})`
      };

      const displayName = t.service.split('/').pop() || t.service;
      if (!serviceMap[displayName]) {
        serviceMap[displayName] = [];
      }
      serviceMap[displayName].push(event);
    });

    // Convert group map into array, sorted by service name and limited to 4 lanes
    const timelines: ServiceTimeline[] = Object.entries(serviceMap)
      .map(([name, events]) => ({ name, events }))
      .slice(0, 4);

    return {
      serviceTimelines: timelines,
      timestamps: labels,
      overview: overviewStats
    };
  }, [tasks, timeWindow]);

  return (
    <div className="glass overflow-hidden rounded-2xl p-5 w-full flex flex-col lg:flex-row gap-5">
      {/* Left Timeline Panel */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-main">
              Execution Timeline
            </h2>
            <div className="flex items-center gap-1 rounded bg-status-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-status-success animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
              Live
            </div>
          </div>
          <span className="text-xs text-text-muted">Live task activity</span>
        </div>

        {/* Timeline Grid Container */}
        <div className="relative mt-6">
          {/* Time Labels Header */}
          <div className="grid grid-cols-[120px_1fr] border-b border-white/[0.04] pb-2 font-mono text-[10px] text-text-faint">
            <span className="pl-2">Service</span>
            <div className="relative flex justify-between px-2">
              {timestamps.map((t, idx) => (
                <span
                  key={t}
                  className={`${
                    t === 'Now' ? 'text-accent-cyan font-semibold absolute right-0 translate-x-[40%]' : ''
                  }`}
                  style={t !== 'Now' ? { marginLeft: idx === 0 ? '0' : 'auto' } : undefined}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Lane grids with background vertical lines */}
          <div className="relative mt-2 divide-y divide-white/[0.03] border-b border-white/[0.04]">
            {/* Absolute positioned background grid lines */}
            <div className="absolute inset-0 grid grid-cols-6 pointer-events-none left-[120px] px-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="border-r border-dashed border-white/[0.03] h-full" />
              ))}
              {/* Vertical Glowing "Now" indicator */}
              <div className="absolute right-0 h-full border-r-2 border-dotted border-accent-cyan/40" />
            </div>

            {serviceTimelines.length === 0 ? (
              <div className="flex h-36 items-center justify-center text-text-faint font-sans text-xs">
                No active execution timeline logs for the last hour
              </div>
            ) : (
              serviceTimelines.map((service) => (
                <div
                  key={service.name}
                  className="grid grid-cols-[120px_1fr] items-center py-3.5 group hover:bg-white/[0.01] transition-colors"
                >
                  {/* Service Name */}
                  <div className="flex flex-col pl-2 min-w-0">
                    <span className="font-mono text-xs font-semibold text-text-main group-hover:text-accent-cyan transition-colors truncate" title={service.name}>
                      {service.name}
                    </span>
                  </div>

                  {/* Timeline bar lane */}
                  <div className="relative h-6 w-full px-2">
                    {service.events.map((evt) => (
                      <div
                        key={evt.id}
                        className={`group/evt absolute top-1/2 -translate-y-1/2 h-4.5 rounded-md cursor-pointer transition-all duration-300 hover:scale-y-110 ${
                          statusColors[evt.status] || statusColors.unknown
                        }`}
                        style={{
                          left: `${evt.startPct}%`,
                          width: `${evt.widthPct}%`,
                        }}
                      >
                        {/* Tooltip on Hover */}
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded border border-border-glass bg-bg-dark px-2 py-1 font-mono text-[9px] font-medium text-text-main opacity-0 shadow-xl transition-opacity duration-150 group-hover/evt:opacity-100 flex items-center gap-1">
                          <Info className="h-3 w-3 text-accent-cyan shrink-0" />
                          {evt.tooltip}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pulsing Dot at bottom of Now Line */}
          <div className="absolute right-0 top-6 bottom-0 w-0.5 flex justify-center pointer-events-none">
            <span className="absolute bottom-0 h-2.5 w-2.5 rounded-full bg-accent-cyan shadow-[0_0_8px_#00E5FF] animate-ping" />
            <span className="absolute bottom-0.5 h-1.5 w-1.5 rounded-full bg-accent-cyan" />
          </div>
        </div>
      </div>

      {/* Right Overview Panel */}
      <div className="w-full lg:w-48 shrink-0 flex flex-col justify-between rounded-xl bg-white/[0.01] border border-border-glass p-4.5">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Live Overview (1h)
          </h3>
          <div className="mt-3.5 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-status-running shadow-[0_0_6px_#00E5FF] animate-pulse" />
                <span className="text-text-muted">Running</span>
              </div>
              <span className="font-mono font-bold text-text-main">{overview.running}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-status-success shadow-[0_0_6px_#10B981]" />
                <span className="text-text-muted">Succeeded</span>
              </div>
              <span className="font-mono font-bold text-text-main">{overview.finished}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-status-error shadow-[0_0_6px_#EF4444]" />
                <span className="text-text-muted">Failed</span>
              </div>
              <span className="font-mono font-bold text-text-main">{overview.failed}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-status-warning shadow-[0_0_6px_#F59E0B]" />
                <span className="text-text-muted">Queued</span>
              </div>
              <span className="font-mono font-bold text-text-main">{overview.queued}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-white/[0.03]">
          <button className="text-[11px] font-semibold text-accent-cyan hover:text-accent-cyan-dim hover:underline transition-colors">
            View all tasks &gt;
          </button>
        </div>
      </div>
    </div>
  );
}
