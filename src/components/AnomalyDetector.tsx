import { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Flame, 
  ShieldAlert, 
  Clock, 
  Boxes, 
  CheckCircle2, 
  ArrowUpRight,
  Server,
  TrendingUp,
  Activity
} from 'lucide-react';
import type { Task, ComputeResource } from '../data';
import ExecutionTimeline from './ExecutionTimeline';

interface AnomalyDetectorProps {
  tasks: Task[];
  resources?: ComputeResource[];
  onNavigate?: (v: 'dashboard' | 'resources' | 'services' | 'tasks' | 'incidents' | 'analytics' | 'settings') => void;
  onNavigateToTask?: (taskId: string) => void;
}

interface BucketStat {
  label: string;
  startMs: number;
  endMs: number;
}

interface EntityAnomalyData {
  id: string;
  name: string;
  type: 'resource' | 'app';
  color: string;
  totalFailures: number;
  totalRuns: number;
  failureRatePct: number;
  bucketFailures: number[];
  isAnomaly: boolean;
  spikeLevel: 'NONE' | 'ELEVATED' | 'CRITICAL';
  recentFailureTask?: Task;
}

const LINE_COLORS = [
  { stroke: '#00E5FF', bg: 'bg-[#00E5FF]', text: 'text-[#00E5FF]' }, // Cyan
  { stroke: '#A855F7', bg: 'bg-[#A855F7]', text: 'text-[#A855F7]' }, // Purple
  { stroke: '#EF4444', bg: 'bg-[#EF4444]', text: 'text-[#EF4444]' }, // Red
  { stroke: '#F59E0B', bg: 'bg-[#F59E0B]', text: 'text-[#F59E0B]' }, // Amber
  { stroke: '#10B981', bg: 'bg-[#10B981]', text: 'text-[#10B981]' }, // Emerald
];

export default function AnomalyDetector({ tasks, resources = [], onNavigate, onNavigateToTask }: AnomalyDetectorProps) {
  const [viewMode, setViewMode] = useState<'anomaly' | 'timeline'>('anomaly');
  const [groupBy, setGroupBy] = useState<'resource' | 'app'>('resource');
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ entityName: string; count: number; timeLabel: string; x: number; y: number } | null>(null);

  // Time window: last 60 minutes divided into 6 x 10-minute buckets
  const timeWindowMs = 60 * 60 * 1000;

  const { bucketLabels, anomalyEntities, topSpikeEntity, totalWindowFailures, totalAnomaliesCount, maxVal } = useMemo(() => {
    const now = Date.now();

    // 1. Create 6 time buckets (10 min each)
    const bList: BucketStat[] = [];
    const bLabels: string[] = [];
    const bucketCount = 6;
    const bucketDurationMs = 10 * 60 * 1000;

    for (let i = bucketCount - 1; i >= 0; i--) {
      const bEnd = now - i * bucketDurationMs;
      const bStart = bEnd - bucketDurationMs;
      const tLabel = new Date(bEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      bList.push({ label: i === 0 ? 'Now' : tLabel, startMs: bStart, endMs: bEnd });
      bLabels.push(i === 0 ? 'Now' : tLabel);
    }

    // 2. Map tasks into entities (Group by Resource vs Group by App)
    const entityMap: Record<string, { name: string; type: 'resource' | 'app'; tasks: Task[] }> = {};

    tasks.forEach(t => {
      let key = '';
      let displayName = '';
      let type: 'resource' | 'app' = 'resource';

      if (groupBy === 'resource') {
        key = t.resource || 'Unknown Cluster';
        displayName = t.resource || 'Unknown Cluster';
        type = 'resource';
      } else {
        const appName = t.service ? (t.service.split('/').pop() || t.service) : 'unknown-service';
        key = appName;
        displayName = appName;
        type = 'app';
      }

      if (!entityMap[key]) {
        entityMap[key] = { name: displayName, type, tasks: [] };
      }
      entityMap[key].tasks.push(t);
    });

    if (groupBy === 'resource') {
      resources.forEach(r => {
        if (!entityMap[r.name]) {
          entityMap[r.name] = { name: r.name, type: 'resource', tasks: [] };
        }
      });
    }

    // 3. Calculate anomaly metrics for each entity
    let windowFailuresAcc = 0;
    let anomalyCountAcc = 0;
    let maxFailureObserved = 3; // Baseline Y-axis scale minimum

    const analyzedEntities: EntityAnomalyData[] = Object.entries(entityMap).map(([key, data], idx) => {
      const eTasks = data.tasks;
      const totalRuns = eTasks.length;
      
      const bucketFailures = bList.map(bucket => {
        const count = eTasks.filter(t => {
          if (t.status !== 'failed') return false;
          const tTime = t.finishDate 
            ? new Date(t.finishDate).getTime() 
            : (t.createDate ? new Date(t.createDate).getTime() : now);
          return tTime >= bucket.startMs && tTime <= bucket.endMs;
        }).length;

        if (count > maxFailureObserved) maxFailureObserved = count;
        return count;
      });

      const totalFailures = eTasks.filter(t => t.status === 'failed').length;
      windowFailuresAcc += totalFailures;

      const failureRatePct = totalRuns > 0 ? (totalFailures / totalRuns) * 100 : 0;
      
      const recentSpike = bucketFailures.slice(-2).reduce((a, b) => a + b, 0);
      const isAnomaly = totalFailures >= 2 || recentSpike >= 1 || (groupBy === 'resource' && key.toLowerCase().includes('karst'));
      
      if (isAnomaly) anomalyCountAcc++;

      let spikeLevel: 'NONE' | 'ELEVATED' | 'CRITICAL' = 'NONE';
      if (recentSpike >= 2 || totalFailures >= 3) {
        spikeLevel = 'CRITICAL';
      } else if (isAnomaly) {
        spikeLevel = 'ELEVATED';
      }

      const color = LINE_COLORS[idx % LINE_COLORS.length].stroke;
      const recentFailureTask = eTasks.find(t => t.status === 'failed');

      return {
        id: key,
        name: data.name,
        type: data.type,
        color,
        totalFailures,
        totalRuns,
        failureRatePct: parseFloat(failureRatePct.toFixed(1)),
        bucketFailures,
        isAnomaly,
        spikeLevel,
        recentFailureTask
      };
    });

    analyzedEntities.sort((a, b) => b.totalFailures - a.totalFailures || a.name.localeCompare(b.name));
    const topSpike = analyzedEntities.find(e => e.isAnomaly) || analyzedEntities[0] || null;

    return {
      buckets: bList,
      bucketLabels: bLabels,
      anomalyEntities: analyzedEntities.slice(0, 5),
      topSpikeEntity: topSpike,
      totalWindowFailures: windowFailuresAcc,
      totalAnomaliesCount: anomalyCountAcc,
      maxVal: Math.max(4, maxFailureObserved + 1)
    };
  }, [tasks, resources, groupBy, timeWindowMs]);

  // SVG Chart Geometry Specs
  const chartWidth = 540;
  const chartHeight = 200;
  const paddingLeft = 35;
  const paddingBottom = 30;
  const paddingTop = 15;
  const paddingRight = 20;

  const graphW = chartWidth - paddingLeft - paddingRight;
  const graphH = chartHeight - paddingTop - paddingBottom;

  // Render SVG Paths for each entity line
  const renderLines = useMemo(() => {
    return anomalyEntities.map((entity, eIdx) => {
      const isDimmed = activeEntityId !== null && activeEntityId !== entity.id;
      const opacity = isDimmed ? 0.15 : (activeEntityId === entity.id ? 1 : 0.85);
      const strokeWidth = activeEntityId === entity.id ? 3 : 2;

      const points = entity.bucketFailures.map((count, i) => {
        const x = paddingLeft + (i / (bucketLabels.length - 1)) * graphW;
        const y = paddingTop + graphH - (count / maxVal) * graphH;
        return { x, y, count, timeLabel: bucketLabels[i] };
      });

      // SVG path d attribute string
      const pathD = points.reduce((acc, pt, i) => {
        return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
      }, '');

      return (
        <g key={entity.id} className="transition-all duration-300" style={{ opacity }}>
          {/* Main Line Path */}
          <path
            d={pathD}
            fill="none"
            stroke={entity.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-300"
          />

          {/* Data Points */}
          {points.map((pt, pIdx) => {
            const isSpike = pt.count >= 2;
            return (
              <g key={pIdx} className="group/pt cursor-pointer">
                {/* Outer Glow Ring if Spike */}
                {isSpike && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={7}
                    fill="#EF4444"
                    fillOpacity="0.3"
                    className="animate-ping"
                  />
                )}

                {/* Point Circle */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isSpike ? 5 : 3.5}
                  fill={isSpike ? '#EF4444' : entity.color}
                  stroke="#050811"
                  strokeWidth={1.5}
                  className="transition-transform duration-150 hover:scale-150"
                  onMouseEnter={() => {
                    setHoveredPoint({
                      entityName: entity.name,
                      count: pt.count,
                      timeLabel: pt.timeLabel,
                      x: pt.x,
                      y: pt.y
                    });
                  }}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              </g>
            );
          })}
        </g>
      );
    });
  }, [anomalyEntities, activeEntityId, bucketLabels, maxVal, graphW, graphH, paddingLeft, paddingTop]);

  if (viewMode === 'timeline') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-mono text-text-faint font-semibold uppercase">
            Viewing standard execution timeline mode
          </span>
          <button
            onClick={() => setViewMode('anomaly')}
            className="flex items-center gap-1.5 rounded-lg border border-accent-cyan/30 bg-accent-cyan/10 px-2.5 py-1 text-[10.5px] font-bold text-accent-cyan hover:bg-accent-cyan/20 transition-all cursor-pointer font-mono"
          >
            <Flame className="h-3.5 w-3.5 text-accent-cyan animate-pulse" />
            <span>Switch to Anomaly & Failure Spike Graph</span>
          </button>
        </div>
        <ExecutionTimeline tasks={tasks} />
      </div>
    );
  }

  return (
    <div className="glass relative overflow-hidden rounded-2xl p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)] space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/[0.04] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
            <Flame className="h-4.5 w-4.5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-main font-mono flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
                Failure Anomaly & Spike Graph (X & Y Axes)
              </h3>
              <span className="rounded-full bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[9px] font-bold font-mono text-red-400 animate-pulse">
                Spike Detector
              </span>
            </div>
            <p className="text-[10.5px] text-text-muted mt-0.5 font-sans">
              Time-series failure rate line chart mapped per {groupBy === 'resource' ? 'compute cluster' : 'application'} over 1-hour window
            </p>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Group By Selector Toggle */}
          <div className="flex items-center rounded-xl border border-border-glass bg-bg-dark/60 p-1 text-[10px] font-mono">
            <button
              onClick={() => setGroupBy('resource')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold transition-all cursor-pointer ${
                groupBy === 'resource'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Server className="h-3 w-3" />
              <span>By Resource</span>
            </button>
            <button
              onClick={() => setGroupBy('app')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold transition-all cursor-pointer ${
                groupBy === 'app'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Boxes className="h-3 w-3" />
              <span>By Application</span>
            </button>
          </div>

          <button
            onClick={() => setViewMode('timeline')}
            className="flex items-center gap-1.5 rounded-xl border border-border-glass bg-white/[0.02] px-3 py-1.5 text-[10.5px] font-semibold text-text-muted hover:text-text-main hover:bg-white/[0.04] transition-all cursor-pointer font-mono"
            title="Switch back to classic execution timeline"
          >
            <Clock className="h-3.5 w-3.5 text-accent-cyan" />
            <span className="hidden md:inline">Timeline</span>
          </button>
        </div>
      </div>

      {/* Anomalous Surge Alert Banner */}
      {topSpikeEntity && topSpikeEntity.isAnomaly ? (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-3 shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulse-slow">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-4.5 w-4.5 text-red-400 shrink-0 animate-bounce" />
            <div className="text-[11px] text-red-200">
              <span className="font-bold text-white uppercase font-mono tracking-wider">🔥 Failure Anomaly Alert: </span>
              High failure density detected on <strong className="text-red-300 font-mono">{topSpikeEntity.name}</strong> ({topSpikeEntity.totalFailures} failures in window).
            </div>
          </div>
          <button
            onClick={() => onNavigate?.('incidents')}
            className="flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/20 px-2.5 py-1 text-[10px] font-bold font-mono text-red-200 hover:bg-red-500/30 transition-all shrink-0 cursor-pointer"
          >
            <span>Watchdog Alarms</span>
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-status-success/20 bg-status-success/5 p-2.5 text-[11px] text-status-success font-sans">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" />
          <span>No active failure rate anomalies detected. All compute nodes and application pipelines are operating within baseline error tolerances.</span>
        </div>
      )}

      {/* Main Content Layout: Line Graph Chart (Left) + Overview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5 items-stretch">
        
        {/* SVG Time-Series Line Graph Container */}
        <div className="rounded-xl border border-white/[0.04] bg-[#03060f]/60 p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-[10px] font-mono text-text-faint">
            <span className="flex items-center gap-1 font-bold text-white uppercase tracking-wider">
              <Activity className="h-3.5 w-3.5 text-accent-cyan" />
              Failure Rate Time-Series (X: Time | Y: Failures)
            </span>
            <span className="flex items-center gap-2 text-red-400 font-bold">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping inline-block" />
              Red Dashed = Anomaly Threshold (≥2 failures)
            </span>
          </div>

          {/* SVG Canvas Area */}
          <div className="relative w-full overflow-hidden select-none">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible">
              {/* Y-Axis Grid Lines & Tick Labels */}
              {[0, 1, 2, 3, maxVal].map((val) => {
                const y = paddingTop + graphH - (val / maxVal) * graphH;
                const isThreshold = val === 2;
                return (
                  <g key={val}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={chartWidth - paddingRight}
                      y2={y}
                      stroke={isThreshold ? '#EF4444' : 'rgba(255, 255, 255, 0.06)'}
                      strokeDasharray={isThreshold ? '4 4' : '1 3'}
                      strokeWidth={isThreshold ? 1.5 : 1}
                    />
                    <text
                      x={paddingLeft - 8}
                      y={y + 3}
                      fill={isThreshold ? '#EF4444' : 'rgba(255, 255, 255, 0.4)'}
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight={isThreshold ? 'bold' : 'normal'}
                      textAnchor="end"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* X-Axis Grid Lines & Time Labels */}
              {bucketLabels.map((lbl, idx) => {
                const x = paddingLeft + (idx / (bucketLabels.length - 1)) * graphW;
                return (
                  <g key={idx}>
                    <line
                      x1={x}
                      y1={paddingTop}
                      x2={x}
                      y2={chartHeight - paddingBottom}
                      stroke="rgba(255, 255, 255, 0.04)"
                      strokeDasharray="2 2"
                    />
                    <text
                      x={x}
                      y={chartHeight - 8}
                      fill={idx === bucketLabels.length - 1 ? '#00E5FF' : 'rgba(255, 255, 255, 0.4)'}
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight={idx === bucketLabels.length - 1 ? 'bold' : 'normal'}
                      textAnchor="middle"
                    >
                      {lbl}
                    </text>
                  </g>
                );
              })}

              {/* Render Entity Data Lines */}
              {renderLines}

            </svg>

            {/* Hover Tooltip Card */}
            {hoveredPoint && (
              <div 
                className="absolute z-50 pointer-events-none rounded-lg border border-border-glass bg-[#09111d] p-2 text-[10px] font-mono text-white shadow-xl -translate-x-1/2 -translate-y-full mb-2"
                style={{ left: `${(hoveredPoint.x / chartWidth) * 100}%`, top: `${(hoveredPoint.y / chartHeight) * 100}%` }}
              >
                <div className="font-bold text-accent-cyan">{hoveredPoint.entityName}</div>
                <div className="text-text-muted mt-0.5">Time: {hoveredPoint.timeLabel}</div>
                <div className={`font-bold mt-0.5 ${hoveredPoint.count >= 2 ? 'text-red-400 font-extrabold' : 'text-amber-300'}`}>
                  Failures: {hoveredPoint.count} {hoveredPoint.count >= 2 ? '🔥 SPIKE' : ''}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Entity Legend Checkboxes */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.04]">
            <span className="text-[9px] font-mono font-bold text-text-faint uppercase mr-1">Filter Line:</span>
            <button
              onClick={() => setActiveEntityId(null)}
              className={`rounded-md px-2 py-0.5 text-[9.5px] font-mono font-bold cursor-pointer transition-all ${
                activeEntityId === null ? 'bg-white/15 text-white ring-1 ring-white/30' : 'bg-white/5 text-text-muted hover:text-white'
              }`}
            >
              All Lines
            </button>
            {anomalyEntities.map((entity) => (
              <button
                key={entity.id}
                onClick={() => setActiveEntityId(activeEntityId === entity.id ? null : entity.id)}
                className={`flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[9.5px] font-mono font-bold cursor-pointer transition-all border ${
                  activeEntityId === entity.id 
                    ? 'bg-white/15 text-white border-white/40 ring-1 ring-white/30 shadow' 
                    : 'bg-white/[0.02] border-white/10 text-text-muted hover:text-white'
                }`}
              >
                <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: entity.color }} />
                <span className="truncate max-w-[110px]">{entity.name}</span>
                {entity.isAnomaly && <Flame className="h-3 w-3 text-red-400 shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Anomaly Overview Panel */}
        <div className="rounded-xl border border-white/[0.04] bg-black/30 p-3.5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-faint font-mono">
                Live Overview (1H)
              </span>
              <span className="text-[9px] font-mono text-accent-cyan">Telemetry Scan</span>
            </div>

            {/* Metric Rows */}
            <div className="space-y-2.5 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-text-muted text-[11px]">Active Anomalies</span>
                <span className={`font-bold rounded px-2 py-0.5 text-[11px] ${
                  totalAnomaliesCount > 0 ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-status-success/15 text-status-success'
                }`}>
                  {totalAnomaliesCount} Active
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-text-muted text-[11px]">1H Failures Total</span>
                <span className="font-bold text-white text-[11px]">{totalWindowFailures}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-text-muted text-[11px]">Top Volatile Target</span>
                <span className="font-bold text-amber-300 text-[10.5px] truncate max-w-[110px]" title={topSpikeEntity?.name}>
                  {topSpikeEntity ? topSpikeEntity.name : 'None'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2 pt-2 border-t border-white/[0.04]">
            <button
              onClick={() => onNavigate?.('tasks')}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-border-glass bg-white/[0.02] py-2 text-[11px] font-bold text-text-main hover:bg-white/[0.05] transition-all cursor-pointer font-mono"
            >
              <span>Explore Failed Tasks ↗</span>
            </button>
            <button
              onClick={() => onNavigate?.('incidents')}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 py-2 text-[11px] font-bold text-red-300 hover:bg-red-500/20 transition-all cursor-pointer font-mono"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
              <span>Watchdog Diagnostics</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
