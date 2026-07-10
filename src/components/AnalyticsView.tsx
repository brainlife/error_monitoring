import { useState, useMemo } from 'react';
import { 
  Download, 
  Activity, 
  Server, 
  Layers, 
  AlertTriangle,
  Sparkles,
  MapPin,
  LineChart
} from 'lucide-react';
import type { Task } from '../data';

interface AnalyticsViewProps {
  tasks: Task[];
  projectNamesMap?: Record<string, string>;
}

export default function AnalyticsView({ tasks, projectNamesMap }: AnalyticsViewProps) {
  // 1. Interactive filter states
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('7d');
  const [projectFilter, setProjectFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  
  // Drill-down validator state
  const [selectedValidator, setSelectedValidator] = useState<string | null>(null);

  // Dynamically extract unique items from active tasks prop
  const projectOptions = useMemo(() => {
    const ids = Array.from(new Set(tasks.map(t => t.projectId).filter(Boolean)));
    return ids.sort();
  }, [tasks]);

  const serviceOptions = useMemo(() => {
    const services = Array.from(new Set(tasks.map(t => t.service.split('/').pop() || t.service).filter(Boolean)));
    return services.sort();
  }, [tasks]);

  const resourceOptions = useMemo(() => {
    const resources = Array.from(new Set(tasks.map(t => t.resource).filter(Boolean)));
    return resources.sort();
  }, [tasks]);

  const projectSummaries = useMemo(() => {
    const map: Record<string, { name: string; jobs: number; success: number; failed: number; storage: string }> = {};
    
    tasks.forEach(t => {
      if (!t.projectId) return;
      if (!map[t.projectId]) {
        const hash = t.projectId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        map[t.projectId] = {
          name: projectNamesMap?.[t.projectId] || `Project ${t.projectId.slice(-6)}`,
          jobs: 0,
          success: 0,
          failed: 0,
          storage: `${(hash % 10) + 1} TB`
        };
      }
      
      const entry = map[t.projectId];
      entry.jobs++;
      if (t.status === 'finished') entry.success++;
      else if (t.status === 'failed') entry.failed++;
    });
    
    return Object.values(map).map(entry => {
      const total = entry.success + entry.failed || 1;
      const successPct = Math.round((entry.success / total) * 100);
      return {
        name: entry.name,
        jobs: entry.jobs.toLocaleString(),
        success: `${successPct}%`,
        storage: entry.storage
      };
    });
  }, [tasks, projectNamesMap]);

  // 2. Generate simulated metrics and chart paths based on filters
  const data = useMemo(() => {
    // Generate a seed based on selected filters to create responsive, dynamic charts
    const filterSeed = timeRange.charCodeAt(0) + projectFilter.charCodeAt(0) + serviceFilter.charCodeAt(0) + resourceFilter.charCodeAt(0);
    
    // Platform stats calculations
    const multiplier = timeRange === '24h' ? 0.3 : timeRange === '7d' ? 1.0 : timeRange === '30d' ? 3.5 : 9.0;
    const baseJobs = Math.round((5000 + (filterSeed % 2000)) * multiplier);
    const successRate = 95 + (filterSeed % 4.5);
    const failureRate = (100 - successRate).toFixed(1);
    
    // Generate paths for Task Executions stacked chart (6 points)
    const successPoints = [20, 35, 55, 45, 75, 90].map(v => v + (filterSeed % 15));
    const failedPoints = [5, 8, 12, 10, 8, 14].map(v => v + (filterSeed % 5));
    const queuedPoints = [10, 15, 8, 12, 20, 15].map(v => v + (filterSeed % 8));

    // SVG scaling helper (width 500, height 120)

    const generateStackedAreaPath = (pts1: number[], pts2: number[]) => {
      const step = 500 / (pts1.length - 1);
      const firstLine = pts1.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${120 - p}`);
      const returnLine = pts2.map((p, i) => `L ${(pts2.length - 1 - i) * step} ${120 - p}`);
      return [...firstLine, ...returnLine, 'Z'].join(' ');
    };

    // Calculate stacked layers
    const layer1 = successPoints; // Succeeded (Bottom)
    const layer2 = layer1.map((v, i) => v + queuedPoints[i]); // Succeeded + Queued
    const layer3 = layer2.map((v, i) => v + failedPoints[i]); // Total Stack (Succeeded + Queued + Failed)

    // Generate paths
    const successPath = generateStackedAreaPath(layer1, layer1.map(() => 0));
    const queuedPath = generateStackedAreaPath(layer2, layer1);
    const failedPath = generateStackedAreaPath(layer3, layer2);

    // Failure rate trends line path (width 300, height 100)
    const failRatePoints = [1.2, 1.8, 1.4, 2.5, 1.9, 1.2].map(v => v + (filterSeed % 1.5));
    const failRatePath = failRatePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * 60} ${100 - p * 25}`).join(' ');

    // Avg runtime points path
    const runtimePoints = [35, 38, 42, 36, 40, 38].map(v => v + (filterSeed % 8));
    const runtimePath = runtimePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * 60} ${100 - p * 1.8}`).join(' ');

    return {
      jobsExecuted: baseJobs,
      successRate: successRate.toFixed(1),
      failureRate,
      avgQueueTime: `${3 + (filterSeed % 3)}m ${10 + (filterSeed % 40)}s`,
      avgRuntime: `${30 + (filterSeed % 15)}m`,
      paths: {
        successPath,
        queuedPath,
        failedPath,
        failRatePath,
        runtimePath
      }
    };
  }, [timeRange, projectFilter, serviceFilter, resourceFilter]);

  // Export handlers
  const handleExport = (type: 'csv' | 'json') => {
    const dataStr = type === 'json' 
      ? JSON.stringify({ timeRange, projectFilter, tasksCount: tasks.length, timestamp: new Date().toISOString() }, null, 2)
      : 'TimeRange,Project,ServiceFilter,TasksCount\n' + `${timeRange},${projectFilter},${serviceFilter},${tasks.length}`;
    
    const blob = new Blob([dataStr], { type: type === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amaretti_analytics_${timeRange}.${type}`;
    a.click();
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col space-y-5 overflow-y-auto pr-1 font-sans text-text-main">
      
      {/* Filters & Header Toolbar */}
      <div className="glass rounded-2xl p-5 shrink-0 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)] bg-bg-dark/20">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-main">
            Platform Performance & Historical Insights
          </h2>
          <p className="text-[10px] text-text-muted">Explore pipeline execution efficiency and resource trends</p>
        </div>

        {/* Dynamic Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Time range selector */}
          <div className="flex rounded-lg border border-white/5 bg-white/[0.01] p-1 shrink-0">
            {(['24h', '7d', '30d', '90d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`rounded px-2.5 py-1 text-[10px] font-bold uppercase transition-all cursor-pointer ${
                  timeRange === r 
                    ? 'bg-accent-cyan/15 text-accent-cyan ring-1 ring-accent-cyan/10' 
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Project dropdown filter */}
          <select 
            value={projectFilter} 
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-lg border border-border-glass bg-[#050811] px-2.5 py-1.5 text-[10px] text-text-muted focus:outline-none cursor-pointer"
          >
            <option value="all">All Projects</option>
            {projectOptions.map((p) => (
              <option key={p} value={p}>{projectNamesMap?.[p] || `Project ${p.slice(-6)}`}</option>
            ))}
          </select>

          {/* Service dropdown filter */}
          <select 
            value={serviceFilter} 
            onChange={(e) => setServiceFilter(e.target.value)}
            className="rounded-lg border border-border-glass bg-[#050811] px-2.5 py-1.5 text-[10px] text-text-muted focus:outline-none cursor-pointer"
          >
            <option value="all">All Services</option>
            {serviceOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Resource dropdown filter */}
          <select 
            value={resourceFilter} 
            onChange={(e) => setResourceFilter(e.target.value)}
            className="rounded-lg border border-border-glass bg-[#050811] px-2.5 py-1.5 text-[10px] text-text-muted focus:outline-none cursor-pointer"
          >
            <option value="all">All Resources</option>
            {resourceOptions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Export tools */}
          <div className="flex gap-2">
            <button 
              onClick={() => handleExport('csv')}
              className="flex items-center gap-1.5 rounded-lg border border-border-glass bg-white/[0.01] px-3 py-1.5 text-[10px] font-semibold text-text-muted hover:text-text-main transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button 
              onClick={() => handleExport('json')}
              className="flex items-center gap-1.5 rounded-lg border border-border-glass bg-white/[0.01] px-3 py-1.5 text-[10px] font-semibold text-text-muted hover:text-text-main transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* Section 1 — Platform Health Overview (Executive Summary) */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Platform Uptime', val: '99.93%', trend: '▲ 0.04%', trendDir: 'up', sub: 'vs last period' },
          { label: 'Jobs Executed', val: data.jobsExecuted.toLocaleString(), trend: '▲ 12%', trendDir: 'up', sub: 'vs last period' },
          { label: 'Success Rate', val: `${data.successRate}%`, trend: '▲ 1.1%', trendDir: 'up', sub: 'vs last period' },
          { label: 'Failure Rate', val: `${data.failureRate}%`, trend: '▼ 0.6%', trendDir: 'down', sub: 'vs last period' },
          { label: 'Avg Queue Time', val: data.avgQueueTime, trend: '▼ 18s', trendDir: 'down', sub: 'vs last period' },
          { label: 'Avg Runtime', val: data.avgRuntime, trend: '▼ 1.2m', trendDir: 'down', sub: 'vs last period' },
        ].map((item) => (
          <div 
            key={item.label}
            className="glass relative overflow-hidden rounded-2xl p-4 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]"
          >
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">{item.label}</span>
            <div className="mt-3.5">
              <span className="font-mono text-xl font-bold text-white tracking-tight">{item.val}</span>
              <div className="mt-1.5 flex items-center justify-between text-[9px]">
                <span className={item.trendDir === 'up' ? 'text-status-success font-semibold' : 'text-status-error font-semibold'}>
                  {item.trend}
                </span>
                <span className="text-text-faint">{item.sub}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Section 2 — Task Performance Graphs */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Graph 1: Stacked Area chart */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-main flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-accent-cyan" />
              Task Executions Over Time
            </h3>
            <div className="flex gap-3 text-[9px] font-semibold text-text-muted">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-status-success" /> Success</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-status-warning" /> Queued</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-status-error" /> Failed</span>
            </div>
          </div>
          
          {/* Responsive SVG area charts */}
          <div className="relative h-32 w-full mt-6 bg-white/[0.01] rounded-xl border border-white/[0.02] overflow-hidden">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="h-full w-full">
              {/* Failed Layer */}
              <path d={data.paths.failedPath} fill="#EF4444" fillOpacity="0.12" stroke="none" />
              {/* Queued Layer */}
              <path d={data.paths.queuedPath} fill="#F59E0B" fillOpacity="0.12" stroke="none" />
              {/* Succeeded Layer */}
              <path d={data.paths.successPath} fill="#10B981" fillOpacity="0.2" stroke="none" />
              
              {/* Stroke Lines */}
              <path d={data.paths.successPath.split('L').slice(0, 6).join('L')} fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex justify-between font-mono text-[9px] text-text-faint px-1">
            <span>Jan</span>
            <span>Feb</span>
            <span>Mar</span>
            <span>Apr</span>
            <span>May</span>
            <span>Jun</span>
          </div>
        </div>

        {/* Runtime & Failure Line charts */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Failure rate line */}
          <div className="glass rounded-2xl p-5 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Failure Rate Trend</span>
              <h4 className="text-lg font-mono font-bold text-status-error">1.2% Average</h4>
            </div>
            <div className="h-20 w-full mt-4 bg-white/[0.01] rounded-xl border border-white/[0.02] overflow-hidden">
              <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="h-full w-full">
                <path d={data.paths.failRatePath} fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Average runtime line */}
          <div className="glass rounded-2xl p-5 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Average Runtime</span>
              <h4 className="text-lg font-mono font-bold text-accent-cyan">{data.avgRuntime}</h4>
            </div>
            <div className="h-20 w-full mt-4 bg-white/[0.01] rounded-xl border border-white/[0.02] overflow-hidden">
              <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="h-full w-full">
                <path d={data.paths.runtimePath} fill="none" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3 — Infrastructure Performance & Utilization */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Availability Horizonal bars */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-main flex items-center gap-2">
            <Server className="h-4.5 w-4.5 text-accent-purple" />
            Resource Availability
          </h3>
          <div className="space-y-3.5 mt-2">
            {[
              { name: 'IU Karst SSH', fill: 'w-[99.8%]', label: '99.8%', color: 'bg-status-success' },
              { name: 'IU Carbonate', fill: 'w-[91%]', label: '91.0%', color: 'bg-status-warning' },
              { name: 'BigRed Cluster', fill: 'w-[98%]', label: '98.0%', color: 'bg-status-success' },
              { name: 'AWS Batch', fill: 'w-[100%]', label: '100%', color: 'bg-accent-cyan shadow-[0_0_6px_#00E5FF]' },
            ].map((node) => (
              <div key={node.name} className="space-y-1.5 text-[11px]">
                <div className="flex justify-between font-medium">
                  <span className="text-text-muted">{node.name}</span>
                  <span className="font-mono text-text-main font-bold">{node.label}</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${node.color} ${node.fill}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hourly Failures Heatmap */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-main flex items-center gap-2">
              <AlertTriangle className="h-4.5 w-4.5 text-status-warning" />
              Hourly Failures Heatmap
            </h3>
            <span className="text-[8px] text-text-faint uppercase font-mono">Mon-Fri (08:00-18:00)</span>
          </div>

          <div className="grid grid-rows-5 gap-1.5 mt-2 font-mono text-[9px]">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, idx) => (
              <div key={day} className="grid grid-cols-[30px_1fr] items-center gap-2">
                <span className="text-text-faint">{day}</span>
                <div className="grid grid-cols-10 gap-1.5">
                  {[...Array(10)].map((_, col) => {
                    const failDensity = (idx * 3 + col * 7) % 5;
                    const color = failDensity === 4 
                      ? 'bg-status-error shadow-[0_0_4px_#EF4444]' 
                      : failDensity === 3 
                      ? 'bg-status-error/60' 
                      : failDensity === 2 
                      ? 'bg-status-warning/45' 
                      : 'bg-white/[0.04] border border-white/[0.02]';
                    return (
                      <div 
                        key={col} 
                        className={`h-4.5 rounded-md transition-all duration-300 hover:scale-110 cursor-pointer ${color}`} 
                        title={`Failures intensity: ${failDensity}/5`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trend Forecast & Predictive Storage */}
        <div className="glass rounded-2xl p-5 flex flex-col justify-between">
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-main flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-accent-cyan" />
              Trend Forecast & Analytics
            </h3>
            <p className="text-[10px] text-text-muted leading-relaxed">Predictive scaling indicators based on 90D telemetry</p>
          </div>

          <div className="space-y-3.5 mt-4 text-xs">
            {/* Storage projection */}
            <div className="rounded-xl border border-white/[0.03] bg-[#03060f] p-3">
              <div className="flex justify-between text-[10px] text-text-muted mb-1.5 font-mono">
                <span>ESTIMATED STORAGE 30D</span>
                <span className="text-accent-cyan font-bold">91 TB / 120 TB</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-accent-cyan to-accent-purple rounded-full w-[75%]" />
              </div>
              <span className="text-[9px] text-status-warning mt-1.5 block font-mono">
                ⚠️ Disk exhaust predicted: Oct 18, 2026
              </span>
            </div>

            {/* Performance insight */}
            <div className="rounded-xl border border-white/[0.03] bg-[#03060f] p-3 text-[10px] font-mono leading-relaxed space-y-1">
              <span className="text-text-muted uppercase block text-[8px] font-bold">AI Observation</span>
              <p className="text-text-main">
                * Queue wait times expected to surge by <span className="text-status-warning font-bold">14%</span> on Wednesday afternoons.
              </p>
              <p className="text-text-main">
                * FreeSurfer pipeline accounts for <span className="text-status-error font-bold">62%</span> of workflow errors.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4 & 5 — Validator & Project Performance */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        
        {/* Validator performance click-to-drilldown */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-main flex items-center gap-2">
              <Layers className="h-4.5 w-4.5 text-accent-cyan" />
              Validator / Pipeline Performance
            </h3>
            <span className="text-[8px] text-text-faint uppercase font-mono">Click rows to inspect failure history</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs select-none">
              <thead>
                <tr className="border-b border-white/[0.04] text-[9px] text-text-faint font-mono font-bold uppercase">
                  <th className="py-2.5">Pipeline</th>
                  <th className="py-2.5">Runs</th>
                  <th className="py-2.5">Success %</th>
                  <th className="py-2.5">Avg Runtime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {[
                  { name: 'FreeSurfer', runs: 1823, success: '98%', runtime: '34m' },
                  { name: 'MRIQC Quality Assessment', runs: 912, success: '99%', runtime: '6m' },
                  { name: 'fMRIPrep Pipeline', runs: 310, success: '94%', runtime: '1h 48m' },
                  { name: 'QSIPrep Diffusion Reconstruction', runs: 280, success: '96%', runtime: '2h 5m' },
                ].map((v) => {
                  const isSelected = selectedValidator === v.name;
                  return (
                    <tr 
                      key={v.name}
                      onClick={() => setSelectedValidator(isSelected ? null : v.name)}
                      className={`hover:bg-white/[0.01] cursor-pointer transition-colors duration-150 ${isSelected ? 'bg-accent-cyan/5 text-white font-bold' : 'text-text-muted'}`}
                    >
                      <td className="py-3 font-semibold">{v.name}</td>
                      <td className="py-3 font-mono">{v.runs}</td>
                      <td className="py-3 font-mono font-bold text-status-success">{v.success}</td>
                      <td className="py-3 font-mono">{v.runtime}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Drill down chart display */}
          {selectedValidator && (
            <div className="rounded-xl border border-accent-cyan/20 bg-accent-cyan/[0.02] p-4.5 mt-3 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent-cyan font-mono">
                  {selectedValidator} Failures Trend
                </span>
                <button 
                  onClick={() => setSelectedValidator(null)}
                  className="text-[9px] font-semibold text-text-faint hover:text-text-main"
                >
                  Close
                </button>
              </div>
              <div className="h-16 w-full bg-white/[0.01] rounded-lg border border-white/[0.04] overflow-hidden">
                <svg viewBox="0 0 400 80" preserveAspectRatio="none" className="h-full w-full">
                  <path d="M 0 60 L 80 40 L 160 70 L 240 20 L 320 50 L 400 10" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="flex justify-between font-mono text-[8px] text-text-faint">
                <span>Jan</span>
                <span>Feb</span>
                <span>Mar</span>
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
              </div>
            </div>
          )}
        </div>

        {/* Project performance metrics table */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-main flex items-center gap-2">
            <LineChart className="h-4.5 w-4.5 text-accent-purple" />
            Project Performance Summary
          </h3>
          
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.04] text-[9px] text-text-faint font-mono font-bold uppercase">
                  <th className="py-2.5">Project</th>
                  <th className="py-2.5">Jobs</th>
                  <th className="py-2.5">Success %</th>
                  <th className="py-2.5">Storage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02] text-text-muted">
                {projectSummaries.map((p) => (
                  <tr key={p.name} className="hover:bg-white/[0.01] transition-colors duration-150">
                    <td className="py-3 font-semibold text-text-main">{p.name}</td>
                    <td className="py-3 font-mono">{p.jobs}</td>
                    <td className="py-3 font-mono font-bold text-status-success">{p.success}</td>
                    <td className="py-3 font-mono">{p.storage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section 7 — Geographic Resource Health Map */}
      <div className="glass rounded-2xl p-5 space-y-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)] bg-bg-dark/20">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-main flex items-center gap-2">
          <MapPin className="h-4.5 w-4.5 text-status-success animate-bounce" />
          Geographic University Resources Status
        </h3>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 text-xs">
          {[
            { location: 'Indiana University (IU)', status: 'Online', color: 'text-status-success bg-status-success/5 border-status-success/15' },
            { location: 'Oxford University', status: 'Healthy', color: 'text-status-success bg-status-success/5 border-status-success/15' },
            { location: 'AWS Batch (Virginia)', status: 'Healthy', color: 'text-status-success bg-status-success/5 border-status-success/15' },
            { location: 'TACC (Texas)', status: 'Busy', color: 'text-status-warning bg-status-warning/5 border-status-warning/15' },
            { location: 'PSC (Pittsburgh)', status: 'Offline', color: 'text-status-error bg-status-error/5 border-status-error/15' },
          ].map((site) => (
            <div 
              key={site.location}
              className={`rounded-xl border p-3.5 space-y-1.5 flex flex-col justify-between ${site.color}`}
            >
              <span className="font-bold text-white block">{site.location}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider block font-bold">
                {site.status}
              </span>
            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
}
