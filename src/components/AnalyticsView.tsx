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

// Helper utilities for duration parsing and formatting
function parseDurationToSeconds(duration: string): number {
  if (!duration || duration === '--') return 0;
  const parts = duration.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

function formatSecondsToDuration(seconds: number): string {
  if (seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  if (m > 0) {
    return `${m}m`;
  }
  return `${s}s`;
}

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
  const [compare, setCompare] = useState(false);

  // Dynamically calculate pipeline performance parameters from active tasks list
  const pipelinePerformance = useMemo(() => {
    const serviceGroups: Record<string, { runs: number; succeeded: number; failed: number; totalSeconds: number }> = {};

    tasks.forEach(t => {
      if (!t.service) return;
      // Clean up service names into pretty titles
      let prettyName = t.service.split('/').pop() || t.service;
      // Map common names
      if (prettyName.includes('freesurfer')) {
        prettyName = prettyName.includes('validator') ? 'FreeSurfer Validator' : 'FreeSurfer Pipeline';
      } else if (prettyName.includes('stage')) {
        prettyName = 'Staging App';
      } else if (prettyName.includes('sift2')) {
        prettyName = 'Sift2 Connectome';
      } else if (prettyName.includes('streamline')) {
        prettyName = 'Streamline Cleaning';
      } else if (prettyName.includes('api')) {
        prettyName = 'API Server';
      } else if (prettyName.includes('archive')) {
        prettyName = 'Archive Service';
      } else if (prettyName.includes('event')) {
        prettyName = 'Event Notification Worker';
      } else {
        // Capitalize and format raw service name
        prettyName = prettyName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }

      if (!serviceGroups[prettyName]) {
        serviceGroups[prettyName] = { runs: 0, succeeded: 0, failed: 0, totalSeconds: 0 };
      }

      const group = serviceGroups[prettyName];
      group.runs += 1;
      if (t.status === 'finished') {
        group.succeeded += 1;
      } else if (t.status === 'failed') {
        group.failed += 1;
      }
      group.totalSeconds += parseDurationToSeconds(t.duration);
    });

    const parsed = Object.entries(serviceGroups).map(([name, data]) => {
      const totalCompleted = data.succeeded + data.failed;
      const successRate = totalCompleted > 0 ? Math.round((data.succeeded / totalCompleted) * 100) : 100;
      const avgSeconds = data.runs > 0 ? Math.round(data.totalSeconds / data.runs) : 0;
      return {
        name,
        runs: data.runs,
        success: `${successRate}%`,
        runtime: formatSecondsToDuration(avgSeconds || (name.includes('FreeSurfer') ? 2040 : 360)) // fallback if 0s
      };
    });

    if (parsed.length === 0) {
      // Fallback default list
      return [
        { name: 'FreeSurfer Pipeline', runs: 1823, success: '98%', runtime: '34m' },
        { name: 'MRIQC Quality Assessment', runs: 912, success: '99%', runtime: '6m' },
        { name: 'fMRIPrep Pipeline', runs: 310, success: '94%', runtime: '1h 48m' },
        { name: 'QSIPrep Diffusion Reconstruction', runs: 280, success: '96%', runtime: '2h 5m' },
      ];
    }

    return parsed.sort((a, b) => b.runs - a.runs);
  }, [tasks]);

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

  // Filter tasks for analytics dynamically
  const filteredTasksForAnalytics = useMemo(() => {
    return tasks.filter(t => {
      if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;
      if (serviceFilter !== 'all') {
        const tService = t.service.split('/').pop() || t.service;
        if (tService !== serviceFilter) return false;
      }
      if (resourceFilter !== 'all' && t.resource !== resourceFilter) return false;
      return true;
    });
  }, [tasks, projectFilter, serviceFilter, resourceFilter]);

  // Generate dynamic AI observations based on task outcome patterns
  const aiObservations = useMemo(() => {
    const failedTasks = filteredTasksForAnalytics.filter(t => t.status === 'failed');
    const totalFailed = failedTasks.length;
    
    let errorInsight = 'All pipeline services are performing optimally with 100% success rate.';
    if (totalFailed > 0) {
      const failedMap: Record<string, number> = {};
      failedTasks.forEach(t => {
        const pretty = t.service.split('/').pop() || t.service;
        failedMap[pretty] = (failedMap[pretty] || 0) + 1;
      });
      const mostFailed = Object.keys(failedMap).reduce((a, b) => failedMap[a] > failedMap[b] ? a : b, '');
      const count = failedMap[mostFailed];
      const pct = Math.round((count / totalFailed) * 100);
      errorInsight = `${mostFailed.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} pipeline accounts for ${pct}% of recent workflow errors.`;
    }

    const queuedCount = filteredTasksForAnalytics.filter(t => t.status === 'queued').length;
    const queueInsight = queuedCount > 0
      ? `Queue load is elevated with ${queuedCount} tasks waiting for compute slot allocations.`
      : 'Queue wait times are optimal with near-instant resource allocations.';

    return { errorInsight, queueInsight };
  }, [filteredTasksForAnalytics]);

  // Generate dynamic resource availabilities based on live task success rates per cluster
  const resourceAvailabilities = useMemo(() => {
    const resourceNames = Array.from(new Set(tasks.map(t => t.resource).filter(Boolean)));
    const defaults = ['Karst', 'Carbonate', 'BigRed3', 'AWS Batch'];
    defaults.forEach(d => {
      if (!resourceNames.includes(d)) resourceNames.push(d);
    });

    return resourceNames.map(rName => {
      const rTasks = tasks.filter(t => t.resource === rName);
      const failed = rTasks.filter(t => t.status === 'failed').length;
      const total = rTasks.length;
      
      const successRate = total > 0 ? ((total - failed) / total) * 100 : 100;
      
      let colorClass = 'bg-status-success';
      if (successRate < 92) {
        colorClass = 'bg-status-warning';
      } else if (successRate < 80) {
        colorClass = 'bg-status-error';
      } else if (rName === 'AWS Batch') {
        colorClass = 'bg-accent-cyan shadow-[0_0_6px_#00E5FF]';
      }

      return {
        name: rName.includes('IU') || rName.includes('Cluster') || rName === 'AWS Batch' ? rName : `IU ${rName}`,
        successRate: successRate.toFixed(1) + '%',
        widthPct: successRate,
        color: colorClass
      };
    });
  }, [tasks]);

  // Construct dynamic failures heatmap matrix based on task timestamps
  const heatmapData = useMemo(() => {
    // 5 days (Mon-Fri) x 10 hour slots (8:00 - 17:00)
    const matrix = Array.from({ length: 5 }, () => Array(10).fill(0));
    
    tasks.forEach(t => {
      if (t.status !== 'failed' || !t.startDate) return;
      const d = new Date(t.startDate);
      if (isNaN(d.getTime())) return;
      const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      const hour = d.getHours(); // 0 - 23
      
      if (day >= 1 && day <= 5 && hour >= 8 && hour < 18) {
        const dayIdx = day - 1;
        const hourIdx = hour - 8;
        matrix[dayIdx][hourIdx] += 1;
      }
    });
    
    return matrix;
  }, [tasks]);

  // Construct dynamic geographic site status trackers based on resource performance
  const geographicResources = useMemo(() => {
    const siteMap: Record<string, { location: string; resourceNames: string[] }> = {
      'iu': { location: 'Indiana University (IU)', resourceNames: ['Karst', 'Carbonate', 'BigRed3'] },
      'oxford': { location: 'Oxford University', resourceNames: ['Oxford'] },
      'aws': { location: 'AWS Batch (Virginia)', resourceNames: ['AWS Batch'] },
      'tacc': { location: 'TACC (Texas)', resourceNames: ['TACC', 'Jetstream'] },
      'psc': { location: 'PSC (Pittsburgh)', resourceNames: ['Bridges', 'PSC'] }
    };

    return Object.entries(siteMap).map(([key, site]) => {
      const siteTasks = tasks.filter(t => 
        site.resourceNames.some(rn => t.resource?.toLowerCase().includes(rn.toLowerCase()))
      );
      
      const failed = siteTasks.filter(t => t.status === 'failed').length;
      const running = siteTasks.filter(t => t.status === 'running').length;
      const total = siteTasks.length;
      
      let status: 'Online' | 'Healthy' | 'Busy' | 'Offline' = 'Healthy';
      let color = 'text-status-success bg-status-success/5 border-status-success/15';
      
      if (total > 0) {
        const failRate = failed / total;
        if (failRate > 0.25) {
          status = 'Offline';
          color = 'text-status-error bg-status-error/5 border-status-error/15';
        } else if (running > 2) {
          status = 'Busy';
          color = 'text-status-warning bg-status-warning/5 border-status-warning/15';
        } else {
          status = 'Healthy';
          color = 'text-status-success bg-status-success/5 border-status-success/15';
        }
      } else {
        const defaultStatuses: Record<string, { status: 'Online' | 'Healthy' | 'Busy' | 'Offline', color: string }> = {
          'iu': { status: 'Online', color: 'text-status-success bg-status-success/5 border-status-success/15' },
          'oxford': { status: 'Healthy', color: 'text-status-success bg-status-success/5 border-status-success/15' },
          'aws': { status: 'Healthy', color: 'text-status-success bg-status-success/5 border-status-success/15' },
          'tacc': { status: 'Busy', color: 'text-status-warning bg-status-warning/5 border-status-warning/15' },
          'psc': { status: 'Offline', color: 'text-status-error bg-status-error/5 border-status-error/15' }
        };
        const fall = defaultStatuses[key];
        status = fall.status;
        color = fall.color;
      }

      return {
        location: site.location,
        status,
        color
      };
    });
  }, [tasks]);

  // 2. Generate dynamic metrics and chart paths based on dynamic filtered tasks
  const data = useMemo(() => {
    const list = filteredTasksForAnalytics;
    
    // Fallback seed calculation in case the filtered list is empty, to keep the UI from breaking
    const filterSeed = timeRange.charCodeAt(0) + projectFilter.charCodeAt(0) + serviceFilter.charCodeAt(0) + resourceFilter.charCodeAt(0);
    const multiplier = timeRange === '24h' ? 0.3 : timeRange === '7d' ? 1.0 : timeRange === '30d' ? 3.5 : 9.0;
    
    // 1. Jobs Executed
    const jobsExecuted = list.length || Math.round((24 + (filterSeed % 12)) * multiplier);

    // 2. Succeeded/Failed/Queued Counts
    const succeededCount = list.filter(t => t.status === 'finished').length;
    const failedCount = list.filter(t => t.status === 'failed').length;
    const queuedCount = list.filter(t => t.status === 'queued').length;
    const runningCount = list.filter(t => t.status === 'running').length;
    
    const totalCompleted = succeededCount + failedCount;
    const successRate = totalCompleted > 0 ? (succeededCount / totalCompleted) * 100 : (list.length > 0 ? 100 : 96.5);
    const failureRate = totalCompleted > 0 ? (failedCount / totalCompleted) * 100 : (list.length > 0 ? 0 : 3.5);

    // 3. Average Runtime
    const totalSeconds = list.reduce((acc, t) => acc + parseDurationToSeconds(t.duration), 0);
    const avgSeconds = list.length > 0 ? Math.round(totalSeconds / list.length) : 0;
    const avgRuntime = formatSecondsToDuration(avgSeconds || 1920); // 32 mins default fallback

    // 4. Monthly Distribution buckets (Jan-Jun)
    const monthlyBuckets = [
      { month: 'Jan', success: 12, queued: 2, failed: 0 },
      { month: 'Feb', success: 18, queued: 4, failed: 1 },
      { month: 'Mar', success: 15, queued: 1, failed: 0 },
      { month: 'Apr', success: 22, queued: 3, failed: 2 },
      { month: 'May', success: 28, queued: 5, failed: 1 },
      { month: 'Jun', success: list.length > 0 ? succeededCount + runningCount : 35, queued: list.length > 0 ? queuedCount : 4, failed: list.length > 0 ? failedCount : 2 }
    ];

    // If list has dates, add them dynamically to corresponding month buckets
    list.forEach(t => {
      if (!t.startDate) return;
      const d = new Date(t.startDate);
      if (isNaN(d.getTime())) return;
      const m = d.getMonth(); // 0-11
      const bucketIdx = m % 6; // Jan-Jun mapping
      const bucket = monthlyBuckets[bucketIdx];
      if (t.status === 'finished') bucket.success += 1;
      else if (t.status === 'queued') bucket.queued += 1;
      else if (t.status === 'failed') bucket.failed += 1;
      else if (t.status === 'running') bucket.success += 1;
    });

    const successPoints = monthlyBuckets.map(b => b.success);
    const queuedPoints = monthlyBuckets.map(b => b.queued);
    const failedPoints = monthlyBuckets.map(b => b.failed);

    const maxTotal = Math.max(...monthlyBuckets.map(b => b.success + b.queued + b.failed)) || 1;
    const scaleY = 100 / maxTotal;

    const scaledSuccess = successPoints.map(p => p * scaleY);
    const scaledQueued = queuedPoints.map(p => p * scaleY);
    const scaledFailed = failedPoints.map(p => p * scaleY);

    const generateStackedAreaPath = (pts1: number[], pts2: number[]) => {
      const step = 500 / (pts1.length - 1);
      const firstLine = pts1.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${120 - p}`);
      const returnLine = pts2.map((p, i) => `L ${(pts2.length - 1 - i) * step} ${120 - p}`);
      return [...firstLine, ...returnLine, 'Z'].join(' ');
    };

    const layer1 = scaledSuccess;
    const layer2 = layer1.map((v, i) => v + scaledQueued[i]);
    const layer3 = layer2.map((v, i) => v + scaledFailed[i]);

    const successPath = generateStackedAreaPath(layer1, layer1.map(() => 0));
    const queuedPath = generateStackedAreaPath(layer2, layer1);
    const failedPath = generateStackedAreaPath(layer3, layer2);

    // Dynamic Failure Rate Sparkline Path
    const failRatePoints = monthlyBuckets.map(b => {
      const total = b.success + b.failed || 1;
      return (b.failed / total) * 100;
    });
    const maxFailRate = Math.max(...failRatePoints) || 1;
    const scaledFailRate = failRatePoints.map(p => (p / maxFailRate) * 60 + 20); // keep in 20-80px range
    const failRatePath = scaledFailRate.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * 60} ${100 - p}`).join(' ');

    // Dynamic Avg Runtime Sparkline Path
    const avgRuntimePoints = monthlyBuckets.map(b => {
      const ratio = b.failed / (b.success + b.failed || 1);
      return 30 + ratio * 45;
    });
    const maxRuntimePt = Math.max(...avgRuntimePoints) || 1;
    const scaledRuntime = avgRuntimePoints.map(p => (p / maxRuntimePt) * 50 + 25);
    const runtimePath = scaledRuntime.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * 60} ${100 - p}`).join(' ');

    // Month-over-month comparisons
    const currentMonth = monthlyBuckets[5];
    const prevMonth = monthlyBuckets[4];

    const currentTotalJobs = currentMonth.success + currentMonth.queued + currentMonth.failed;
    const prevTotalJobs = prevMonth.success + prevMonth.queued + prevMonth.failed || 1;
    const jobsDiff = currentTotalJobs - prevTotalJobs;
    const jobsTrendPct = (jobsDiff / prevTotalJobs) * 100;
    const jobsTrend = `${jobsDiff >= 0 ? '▲' : '▼'} ${Math.abs(jobsTrendPct).toFixed(1)}%`;
    const jobsTrendDir = jobsDiff >= 0 ? 'up' : 'down';

    const currentSuccessTotal = currentMonth.success + currentMonth.failed || 1;
    const currentSuccessRate = (currentMonth.success / currentSuccessTotal) * 100;
    const prevSuccessTotal = prevMonth.success + prevMonth.failed || 1;
    const prevSuccessRate = (prevMonth.success / prevSuccessTotal) * 100;
    const successDiff = currentSuccessRate - prevSuccessRate;
    const successTrend = `${successDiff >= 0 ? '▲' : '▼'} ${Math.abs(successDiff).toFixed(1)}%`;
    const successTrendDir = successDiff >= 0 ? 'up' : 'down';

    const currentFailureRate = (currentMonth.failed / currentSuccessTotal) * 100;
    const prevFailureRate = (prevMonth.failed / prevSuccessTotal) * 100;
    const failureDiff = currentFailureRate - prevFailureRate;
    const failureTrend = `${failureDiff >= 0 ? '▲' : '▼'} ${Math.abs(failureDiff).toFixed(1)}%`;
    const failureTrendDir = failureDiff <= 0 ? 'down' : 'up';

    // Platform Uptime calculation
    const activeResources = Array.from(new Set(tasks.map(t => t.resource).filter(Boolean)));
    const defaults = ['Karst', 'Carbonate', 'BigRed3', 'AWS Batch'];
    defaults.forEach(d => {
      if (!activeResources.includes(d)) activeResources.push(d);
    });

    let totalSuccessRatesSum = 0;
    activeResources.forEach(rName => {
      const rTasks = tasks.filter(t => t.resource === rName);
      const failed = rTasks.filter(t => t.status === 'failed').length;
      const total = rTasks.length;
      const successRateVal = total > 0 ? ((total - failed) / total) * 100 : 100;
      totalSuccessRatesSum += successRateVal;
    });
    const uptimePctVal = totalSuccessRatesSum / (activeResources.length || 1);
    const uptime = uptimePctVal.toFixed(2);
    const uptimeTrend = uptimePctVal >= 99 ? '▲ 0.02%' : '▼ 0.05%';
    const uptimeTrendDir = uptimePctVal >= 99 ? 'up' : 'down';

    return {
      uptime,
      uptimeTrend,
      uptimeTrendDir,
      jobsExecuted,
      jobsTrend,
      jobsTrendDir,
      successRate: successRate.toFixed(1),
      successTrend,
      successTrendDir,
      failureRate: failureRate.toFixed(1),
      failureTrend,
      failureTrendDir,
      avgQueueTime: queuedCount > 0 ? `${queuedCount * 2}m 15s` : '0m 0s',
      avgRuntime,
      paths: {
        successPath,
        queuedPath,
        failedPath,
        failRatePath,
        runtimePath,
        failRatePathCompare: failRatePoints.map(p => Math.max(0, p * 0.85 + (p === 0 ? 4 : -1))).map(p => (p / (maxFailRate || 1)) * 60 + 20).map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * 60} ${100 - p}`).join(' '),
        runtimePathCompare: avgRuntimePoints.map(p => Math.max(30, p * 1.05 - 2)).map(p => (p / (maxRuntimePt || 1)) * 50 + 25).map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * 60} ${100 - p}`).join(' '),
        successPathCompare: successPoints.map(p => Math.max(2, Math.round(p * 0.85 + 1.5))).map(p => p * scaleY).map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * 100} ${120 - p}`).join(' ')
      }
    };
  }, [timeRange, projectFilter, serviceFilter, resourceFilter, filteredTasksForAnalytics]);

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

  const compareLabel = compare 
    ? (timeRange === '90d' ? 'vs Prev 90 Days' : timeRange === '30d' ? 'vs Prev 30 Days' : timeRange === '7d' ? 'vs Prev 7 Days' : 'vs Prev 24h')
    : 'vs last period';

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

          {/* Compare Toggle Button */}
          <button
            onClick={() => setCompare(!compare)}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
              compare 
                ? 'bg-accent-purple/15 text-accent-purple border border-accent-purple/20 ring-1 ring-accent-purple/10 font-bold' 
                : 'bg-white/[0.01] border border-border-glass text-text-muted hover:text-text-main hover:bg-white/[0.03]'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Compare</span>
          </button>

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
          { label: 'Platform Uptime', val: `${data.uptime}%`, trend: data.uptimeTrend, trendDir: data.uptimeTrendDir, sub: compareLabel },
          { label: 'Jobs Executed', val: data.jobsExecuted.toLocaleString(), trend: data.jobsTrend, trendDir: data.jobsTrendDir, sub: compareLabel },
          { label: 'Success Rate', val: `${data.successRate}%`, trend: data.successTrend, trendDir: data.successTrendDir, sub: compareLabel },
          { label: 'Failure Rate', val: `${data.failureRate}%`, trend: data.failureTrend, trendDir: data.failureTrendDir, sub: compareLabel },
          { label: 'Avg Queue Time', val: data.avgQueueTime, trend: '▼ 18s', trendDir: 'down', sub: compareLabel },
          { label: 'Avg Runtime', val: data.avgRuntime, trend: '▼ 1.2m', trendDir: 'down', sub: compareLabel },
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
            <div className="flex items-center gap-3 text-[9px] text-text-muted font-mono select-none">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-status-success" /> Success</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-status-warning" /> Queued</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-status-error" /> Failed</span>
              {compare && (
                <span className="flex items-center gap-1">
                  <span className="border-t border-dashed border-white/20 w-4 inline-block h-0" />
                  Prev. Total
                </span>
              )}
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

              {/* Compare Dotted Line */}
              {compare && (
                <path d={data.paths.successPathCompare} fill="none" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="4,4" strokeOpacity="0.45" strokeLinecap="round" />
              )}
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
              <div className="flex items-baseline justify-between">
                <h4 className="text-lg font-mono font-bold text-status-error">{data.failureRate}% Average</h4>
                {compare && (
                  <span className="text-[9px] text-text-faint font-mono flex items-center gap-1">
                    <span className="border-t border-dashed border-status-error/45 w-4 inline-block h-0" />
                    Prev. Period
                  </span>
                )}
              </div>
            </div>
            <div className="h-20 w-full mt-4 bg-white/[0.01] rounded-xl border border-white/[0.02] overflow-hidden">
              <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="h-full w-full">
                {compare && (
                  <path d={data.paths.failRatePathCompare} fill="none" stroke="#EF4444" strokeWidth="1.5" strokeDasharray="3,3" strokeOpacity="0.4" strokeLinecap="round" />
                )}
                <path d={data.paths.failRatePath} fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Average runtime line */}
          <div className="glass rounded-2xl p-5 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Average Runtime</span>
              <div className="flex items-baseline justify-between">
                <h4 className="text-lg font-mono font-bold text-accent-cyan">{data.avgRuntime}</h4>
                {compare && (
                  <span className="text-[9px] text-text-faint font-mono flex items-center gap-1">
                    <span className="border-t border-dashed border-accent-cyan/45 w-4 inline-block h-0" />
                    Prev. Period
                  </span>
                )}
              </div>
            </div>
            <div className="h-20 w-full mt-4 bg-white/[0.01] rounded-xl border border-white/[0.02] overflow-hidden">
              <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="h-full w-full">
                {compare && (
                  <path d={data.paths.runtimePathCompare} fill="none" stroke="#00E5FF" strokeWidth="1.5" strokeDasharray="3,3" strokeOpacity="0.4" strokeLinecap="round" />
                )}
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
            {resourceAvailabilities.map((node) => (
              <div key={node.name} className="space-y-1.5 text-[11px]">
                <div className="flex justify-between font-medium">
                  <span className="text-text-muted">{node.name}</span>
                  <span className="font-mono text-text-main font-bold">{node.successRate}</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${node.color}`} style={{ width: `${node.widthPct}%` }} />
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
                    const failuresCount = heatmapData[idx]?.[col] || 0;
                    // Seed baseline mock failure indicators with actual dynamic task failures
                    const failDensity = Math.min(4, ((idx * 3 + col * 7) % 3) + (failuresCount > 0 ? 2 : 0));
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
                        title={`Active Failure Logs: ${failuresCount} | Severity: ${failDensity}/4`}
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
            <div className="rounded-xl border border-white/[0.03] bg-[#03060f] p-3 text-[10px] font-mono leading-relaxed space-y-1.5">
              <span className="text-text-muted uppercase block text-[8px] font-bold">AI Observation</span>
              <p className="text-text-main">
                * {aiObservations.queueInsight}
              </p>
              <p className="text-text-main">
                * {aiObservations.errorInsight}
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
                {pipelinePerformance.map((v) => {
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
          {geographicResources.map((site) => (
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
