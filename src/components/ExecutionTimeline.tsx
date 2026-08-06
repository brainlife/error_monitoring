import { useState, useMemo } from 'react';
import { 
  Activity, 
  Clock, 
  BarChart2, 
  CheckCircle2, 
  AlertCircle, 
  Hourglass,
  Layers,
  Filter,
  Info
} from 'lucide-react';
import type { Task } from '../data';

interface ExecutionTimelineProps {
  tasks: Task[];
}

interface TimeBucketData {
  label: string;
  startMs: number;
  endMs: number;
  running: number;
  succeeded: number;
  failed: number;
  queued: number;
  total: number;
}

export default function ExecutionTimeline({ tasks }: ExecutionTimelineProps) {
  const [selectedService, setSelectedService] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'graph' | 'lanes'>('graph');
  const [hoveredBucket, setHoveredBucket] = useState<TimeBucketData | null>(null);

  const timeWindow = 60 * 60 * 1000; // 1 hour in ms

  // Calculate distinct service list
  const serviceList = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => {
      if (t.service) {
        set.add(t.service.split('/').pop() || t.service);
      }
    });
    return Array.from(set).sort();
  }, [tasks]);

  const { bucketData, bucketLabels, overviewStats, maxVal, activeServicesMap } = useMemo(() => {
    const now = Date.now();
    const windowStart = now - timeWindow;
    const bucketCount = 6;
    const bucketDurationMs = 10 * 60 * 1000;

    const bList: TimeBucketData[] = [];
    const bLabels: string[] = [];

    for (let i = bucketCount - 1; i >= 0; i--) {
      const bEnd = now - i * bucketDurationMs;
      const bStart = bEnd - bucketDurationMs;
      const tLabel = new Date(bEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      
      bList.push({
        label: i === 0 ? 'Now' : tLabel,
        startMs: bStart,
        endMs: bEnd,
        running: 0,
        succeeded: 0,
        failed: 0,
        queued: 0,
        total: 0
      });
      bLabels.push(i === 0 ? 'Now' : tLabel);
    }

    // Filter tasks by selected service
    const filteredTasks = tasks.filter(t => {
      if (selectedService !== 'all') {
        const sName = t.service ? (t.service.split('/').pop() || t.service) : '';
        if (sName !== selectedService) return false;
      }
      return true;
    });

    const overview = { running: 0, finished: 0, failed: 0, queued: 0 };
    let peakVolume = 4;

    // Service map for lanes mode
    const sMap: Record<string, { running: number; finished: number; failed: number; queued: number; tasks: Task[] }> = {};

    filteredTasks.forEach(t => {
      const tStart = t.startDate ? new Date(t.startDate).getTime() : (t.createDate ? new Date(t.createDate).getTime() : now);
      const tEnd = t.finishDate ? new Date(t.finishDate).getTime() : now;

      if (tEnd >= windowStart && tStart <= now) {
        // Overview accumulation
        if (t.status === 'running') overview.running++;
        else if (t.status === 'finished') overview.finished++;
        else if (t.status === 'failed') overview.failed++;
        else if (t.status === 'queued' || t.status === 'requested') overview.queued++;

        // Bucket distribution
        bList.forEach(bucket => {
          if (tStart <= bucket.endMs && tEnd >= bucket.startMs) {
            if (t.status === 'running') bucket.running++;
            else if (t.status === 'finished') bucket.succeeded++;
            else if (t.status === 'failed') bucket.failed++;
            else if (t.status === 'queued' || t.status === 'requested') bucket.queued++;
            
            bucket.total = bucket.running + bucket.succeeded + bucket.failed + bucket.queued;
            if (bucket.total > peakVolume) peakVolume = bucket.total;
          }
        });

        // Map by service name for lane view
        const sName = t.service ? (t.service.split('/').pop() || t.service) : 'unknown';
        if (!sMap[sName]) {
          sMap[sName] = { running: 0, finished: 0, failed: 0, queued: 0, tasks: [] };
        }
        sMap[sName].tasks.push(t);
        if (t.status === 'running') sMap[sName].running++;
        else if (t.status === 'finished') sMap[sName].finished++;
        else if (t.status === 'failed') sMap[sName].failed++;
        else if (t.status === 'queued' || t.status === 'requested') sMap[sName].queued++;
      }
    });

    return {
      bucketData: bList,
      bucketLabels: bLabels,
      overviewStats: overview,
      maxVal: Math.max(5, peakVolume + 2),
      activeServicesMap: sMap
    };
  }, [tasks, selectedService, timeWindow]);

  // Graph SVG Dimensions
  const chartWidth = 540;
  const chartHeight = 185;
  const paddingLeft = 45;
  const paddingBottom = 30;
  const paddingTop = 20;
  const paddingRight = 20;

  const graphW = chartWidth - paddingLeft - paddingRight;
  const graphH = chartHeight - paddingTop - paddingBottom;
  const slotW = graphW / bucketData.length;
  const barW = Math.min(28, slotW * 0.55);

  return (
    <div className="glass overflow-hidden rounded-2xl p-5 w-full flex flex-col lg:flex-row gap-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]">
      {/* Left Timeline & Graph Content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/[0.04] pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-text-main font-mono">
                  Execution Workload Graph (X & Y Axes)
                </h2>
                <span className="flex items-center gap-1 rounded bg-status-success/15 px-1.5 py-0.5 text-[9.5px] font-bold text-status-success animate-pulse font-mono">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
                  Live Telemetry
                </span>
              </div>
              <p className="text-[10.5px] text-text-muted mt-0.5">
                Real-time task activity & volume distribution over the past 1-hour window
              </p>
            </div>
          </div>

          {/* Service Selector & Mode Switcher */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Service Filter Dropdown */}
            <div className="flex items-center gap-1.5 rounded-xl border border-border-glass bg-bg-dark/60 px-2.5 py-1 text-[10.5px] font-mono">
              <Filter className="h-3 w-3 text-text-muted" />
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="bg-transparent text-text-main focus:outline-none cursor-pointer font-semibold max-w-[140px] truncate"
              >
                <option value="all" className="bg-bg-dark text-white">All Services</option>
                {serviceList.map(s => (
                  <option key={s} value={s} className="bg-bg-dark text-white">{s}</option>
                ))}
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-border-glass bg-bg-dark/60 p-1 text-[10px] font-mono">
              <button
                onClick={() => setViewMode('graph')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold transition-all cursor-pointer ${
                  viewMode === 'graph'
                    ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40 shadow-sm'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <BarChart2 className="h-3 w-3" />
                <span>Graph</span>
              </button>
              <button
                onClick={() => setViewMode('lanes')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold transition-all cursor-pointer ${
                  viewMode === 'lanes'
                    ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40 shadow-sm'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <Layers className="h-3 w-3" />
                <span>Lanes</span>
              </button>
            </div>
          </div>
        </div>

        {/* View Mode 1: Stacked Bar & Line Graph with X & Y Axes */}
        {viewMode === 'graph' ? (
          <div className="rounded-xl border border-white/[0.04] bg-[#03060f]/60 p-4 relative select-none">
            {/* SVG Graph Canvas */}
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible">
              {/* Y-Axis Horizontal Grid Lines & Ticks */}
              {[0, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), maxVal].map((val, idx) => {
                const y = paddingTop + graphH - (val / maxVal) * graphH;
                return (
                  <g key={idx}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={chartWidth - paddingRight}
                      y2={y}
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeDasharray="2 2"
                    />
                    <text
                      x={paddingLeft - 8}
                      y={y + 3}
                      fill="rgba(255, 255, 255, 0.4)"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* X-Axis Vertical Grid Lines & Time Bucket Labels */}
              {bucketData.map((b, i) => {
                const xCenter = paddingLeft + (i + 0.5) * slotW;
                return (
                  <g key={i}>
                    <line
                      x1={xCenter}
                      y1={paddingTop}
                      x2={xCenter}
                      y2={chartHeight - paddingBottom}
                      stroke="rgba(255, 255, 255, 0.03)"
                      strokeDasharray="2 2"
                    />
                    <text
                      x={xCenter}
                      y={chartHeight - 6}
                      fill={i === bucketData.length - 1 ? '#00E5FF' : 'rgba(255, 255, 255, 0.4)'}
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight={i === bucketData.length - 1 ? 'bold' : 'normal'}
                      textAnchor="middle"
                    >
                      {b.label}
                    </text>
                  </g>
                );
              })}

              {/* Stacked Execution Bars for Each Time Slot */}
              {bucketData.map((b, i) => {
                const xCenter = paddingLeft + (i + 0.5) * slotW;
                const xBar = xCenter - barW / 2;

                // Stack Segment Heights
                const succH = (b.succeeded / maxVal) * graphH;
                const failH = (b.failed / maxVal) * graphH;
                const runH = (b.running / maxVal) * graphH;
                const qH = (b.queued / maxVal) * graphH;

                let currentY = paddingTop + graphH;

                // 1. Succeeded Segment (Green)
                currentY -= succH;
                const succY = currentY;

                // 2. Failed Segment (Red)
                currentY -= failH;
                const failY = currentY;

                // 3. Running Segment (Cyan)
                currentY -= runH;
                const runY = currentY;

                // 4. Queued Segment (Amber)
                currentY -= qH;
                const qY = currentY;

                return (
                  <g 
                    key={i} 
                    className="cursor-pointer group/bar transition-all"
                    onMouseEnter={() => setHoveredBucket(b)}
                    onMouseLeave={() => setHoveredBucket(null)}
                  >
                    {/* Background Bar Hover Overlay */}
                    <rect
                      x={xBar - 4}
                      y={paddingTop}
                      width={barW + 8}
                      height={graphH}
                      fill="rgba(255, 255, 255, 0.03)"
                      rx={6}
                      className="opacity-0 group-hover/bar:opacity-100 transition-opacity"
                    />

                    {/* Succeeded Segment (Green #10B981) */}
                    {succH > 0 && (
                      <rect
                        x={xBar}
                        y={succY}
                        width={barW}
                        height={succH}
                        fill="#10B981"
                        rx={failH === 0 && runH === 0 && qH === 0 ? 4 : 0}
                        className="transition-all hover:brightness-125"
                      />
                    )}

                    {/* Failed Segment (Red #EF4444) */}
                    {failH > 0 && (
                      <rect
                        x={xBar}
                        y={failY}
                        width={barW}
                        height={failH}
                        fill="#EF4444"
                        rx={runH === 0 && qH === 0 ? 4 : 0}
                        className="transition-all hover:brightness-125 animate-pulse-slow"
                      />
                    )}

                    {/* Running Segment (Cyan #00E5FF) */}
                    {runH > 0 && (
                      <rect
                        x={xBar}
                        y={runY}
                        width={barW}
                        height={runH}
                        fill="#00E5FF"
                        rx={qH === 0 ? 4 : 0}
                        className="transition-all hover:brightness-125"
                      />
                    )}

                    {/* Queued / Requested Segment (Amber #F59E0B) */}
                    {qH > 0 && (
                      <rect
                        x={xBar}
                        y={qY}
                        width={barW}
                        height={qH}
                        fill="#F59E0B"
                        rx={4}
                        className="transition-all hover:brightness-125"
                      />
                    )}

                    {/* Empty Slot Placeholder Dot if 0 tasks */}
                    {b.total === 0 && (
                      <circle
                        cx={xCenter}
                        cy={paddingTop + graphH - 4}
                        r={2}
                        fill="rgba(255, 255, 255, 0.15)"
                      />
                    )}
                  </g>
                );
              })}

            </svg>

            {/* Hover Tooltip Card */}
            {hoveredBucket && (
              <div className="absolute z-50 pointer-events-none rounded-xl border border-border-glass bg-[#09111d] p-3 text-[10.5px] font-mono text-white shadow-2xl -translate-y-full top-12 left-1/2 -translate-x-1/2 min-w-[180px] space-y-1.5 border-accent-cyan/30">
                <div className="font-bold text-accent-cyan flex justify-between border-b border-white/10 pb-1">
                  <span>Time Bucket: {hoveredBucket.label}</span>
                  <span>{hoveredBucket.total} Tasks</span>
                </div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between text-[#10B981]">
                    <span>🟢 Succeeded:</span>
                    <span className="font-bold">{hoveredBucket.succeeded}</span>
                  </div>
                  <div className="flex justify-between text-[#EF4444]">
                    <span>🔴 Failed:</span>
                    <span className="font-bold">{hoveredBucket.failed}</span>
                  </div>
                  <div className="flex justify-between text-[#00E5FF]">
                    <span>🔵 Running:</span>
                    <span className="font-bold">{hoveredBucket.running}</span>
                  </div>
                  <div className="flex justify-between text-[#F59E0B]">
                    <span>🟡 Queued / Requested:</span>
                    <span className="font-bold">{hoveredBucket.queued}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Color Legend Bar below graph */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-white/[0.04] text-[10px] font-mono">
              <span className="flex items-center gap-1.5 text-text-muted">
                <span className="h-2.5 w-2.5 rounded bg-[#10B981] inline-block" />
                <span>🟢 Succeeded</span>
              </span>
              <span className="flex items-center gap-1.5 text-text-muted">
                <span className="h-2.5 w-2.5 rounded bg-[#EF4444] inline-block" />
                <span>🔴 Failed</span>
              </span>
              <span className="flex items-center gap-1.5 text-text-muted">
                <span className="h-2.5 w-2.5 rounded bg-[#00E5FF] inline-block" />
                <span>🔵 Running</span>
              </span>
              <span className="flex items-center gap-1.5 text-text-muted">
                <span className="h-2.5 w-2.5 rounded bg-[#F59E0B] inline-block" />
                <span>🟡 Queued / Requested</span>
              </span>
            </div>
          </div>
        ) : (
          /* View Mode 2: Service Breakdown Lanes */
          <div className="space-y-2.5">
            {Object.entries(activeServicesMap).map(([sName, sData]) => (
              <div key={sName} className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3 flex items-center justify-between font-mono text-xs">
                <div className="truncate max-w-[200px]" title={sName}>
                  <span className="font-bold text-white block truncate">{sName}</span>
                  <span className="text-[9.5px] text-text-faint">{sData.tasks.length} tasks in window</span>
                </div>
                <div className="flex items-center gap-3 text-[10.5px]">
                  <span className="text-[#10B981] font-bold">{sData.finished} 🟢 Succeeded</span>
                  <span className="text-[#EF4444] font-bold">{sData.failed} 🔴 Failed</span>
                  <span className="text-[#F59E0B] font-bold">{sData.queued} 🟡 Requested</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Overview Panel (100% Color Matched) */}
      <div className="w-full lg:w-48 shrink-0 flex flex-col justify-between rounded-xl bg-white/[0.01] border border-border-glass p-4.5">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted font-mono">
            Live Overview (1h)
          </h3>
          <div className="mt-3.5 space-y-2.5 text-xs font-mono">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_6px_#00E5FF] animate-pulse" />
                <span className="text-text-muted">Running</span>
              </div>
              <span className="font-bold text-text-main">{overviewStats.running}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]" />
                <span className="text-text-muted">Succeeded</span>
              </div>
              <span className="font-bold text-text-main">{overviewStats.finished}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#EF4444] shadow-[0_0_6px_#EF4444]" />
                <span className="text-text-muted">Failed</span>
              </div>
              <span className="font-bold text-text-main">{overviewStats.failed}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B]" />
                <span className="text-text-muted">Queued / Requested</span>
              </div>
              <span className="font-bold text-text-main">{overviewStats.queued}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-white/[0.03]">
          <span className="text-[10px] font-mono text-text-faint block">
            {selectedService === 'all' ? 'All Services Filtered' : `Filter: ${selectedService}`}
          </span>
        </div>
      </div>
    </div>
  );
}
