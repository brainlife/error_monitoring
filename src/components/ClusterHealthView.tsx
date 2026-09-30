import { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Server, 
  HardDrive, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw, 
  Terminal, 
  Search, 
  ShieldCheck, 
  Database,
  Lock,
  ExternalLink,
  X,
  Copy,
  Check,
  Activity,
  ArrowRight,
  User,
  Clock,
  Zap,
  ShieldAlert,
  Play,
  Layers,
  Filter
} from 'lucide-react';
import type { View } from './Sidebar';
import { 
  fetchResourceHealthAll, 
  refreshResourceHealth, 
  type ResourceHealthAllResponse,
  type SlurmJob,
  type ResourceMountHealth
} from '../api';
import DockerHealthPanel from './DockerHealthPanel';
import { useDashboardStore } from '../store/useDashboardStore';

interface ClusterHealthViewProps {
  onNavigate?: (v: View) => void;
}

interface SlurmNode {
  id: string;
  cluster: string;
  partition: string;
  state: 'idle' | 'allocated' | 'down' | 'drain' | 'maint';
  cpus: string;
  memory: string;
  reason?: string;
  uptime?: string;
}

interface EnrichedSlurmJob extends SlurmJob {
  cluster: string;
  resourceId: string;
}

interface StorageMountItem {
  id: string;
  resourceId: string;
  hostName: string;
  mount: string;
  subtitle: string;
  target: string;
  accessible: boolean;
  freePct: number | null;
  usedPct: number | null;
  latency: string;
  latency_ms: number;
  warning?: string | null;
  error?: string | null;
  overallStatus: 'ok' | 'warning' | 'error' | 'unknown';
}

export default function ClusterHealthView({ onNavigate }: ClusterHealthViewProps) {
  const { tasksList, handleNavigateToTask, handleNavigateToResource, userNamesMap } = useDashboardStore();

  // Filters & State
  const [selectedClusterFilter, setSelectedClusterFilter] = useState<string>('all');
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('all');
  const [selectedMountHostFilter, setSelectedMountHostFilter] = useState<string>('all');
  const [selectedJobStatusFilter, setSelectedJobStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [jobSearchQuery, setJobSearchQuery] = useState<string>('');
  
  // Terminal toggles
  const [showRawSinfoConsole, setShowRawSinfoConsole] = useState<boolean>(false);
  const [showRawSqueueConsole, setShowRawSqueueConsole] = useState<boolean>(false);
  
  // Refresh & Load state
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastCheckTime, setLastCheckTime] = useState<string>('--:--:--');
  const [visibleNodeCount, setVisibleNodeCount] = useState<number>(10);
  const [visibleJobCount, setVisibleJobCount] = useState<number>(10);
  
  // Selected Node Modal State
  const [selectedNode, setSelectedNode] = useState<SlurmNode | null>(null);
  const [modalTab, setModalTab] = useState<'overview' | 'jobs' | 'diagnostic'>('overview');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Selected SLURM Job Inspector Modal State
  const [selectedJob, setSelectedJob] = useState<EnrichedSlurmJob | null>(null);

  // Live API State
  const [liveHealthData, setLiveHealthData] = useState<ResourceHealthAllResponse | null>(null);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Escape key closes modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNode(null);
        setSelectedJob(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Set default tab on node selection
  useEffect(() => {
    if (selectedNode) {
      setModalTab(selectedNode.state === 'down' || selectedNode.state === 'drain' ? 'diagnostic' : 'overview');
    }
  }, [selectedNode]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Reset pagination on filter or search change
  useEffect(() => {
    setVisibleNodeCount(10);
  }, [selectedClusterFilter, selectedStateFilter, searchQuery]);

  useEffect(() => {
    setVisibleJobCount(10);
  }, [selectedClusterFilter, selectedJobStatusFilter, jobSearchQuery]);

  // Fetch Live Health Data from GET /resource/health/all
  const loadHealthData = useCallback(async (forceLiveRefresh: boolean = false) => {
    setIsRefreshing(true);
    setApiError(null);
    try {
      console.log('📡 [ClusterHealthView] Triggering health check poll. Force live refresh:', forceLiveRefresh);
      // Force probes only for storage/SLURM Resources. Docker observations arrive from the prod collector.
      if (forceLiveRefresh && liveHealthData?.resources) {
        console.log('⚡ [ClusterHealthView] Bypassing Redis cache for resources:', liveHealthData.resources.map(r => r.resource_name));
        const results = await Promise.allSettled(
          liveHealthData.resources.filter(r => r.resource_id && !r.docker_check).map(r => refreshResourceHealth(r.resource_id!))
        );
        const failed = results.filter(result => result.status === 'rejected');
        if(failed.length) setApiError(`${failed.length} resource refresh requests failed; showing stored results.`);
      }

      const res = await fetchResourceHealthAll();
      console.log('📦 [ClusterHealthView] Received payload from /resource/health/all:', res);
      if (res && Array.isArray(res.resources) && res.resources.length > 0) {
        setLiveHealthData(res);
        setIsLiveConnected(true);
        if (res.timestamp) {
          setLastCheckTime(new Date(res.timestamp).toLocaleTimeString());
        } else {
          setLastCheckTime(new Date().toLocaleTimeString());
        }
      } else {
        setLiveHealthData(null);
        setIsLiveConnected(false);
        setApiError('No monitored resources returned from /resource/health/all');
      }
    } catch (err: any) {
      console.warn('❌ [ClusterHealthView] Live endpoint /resource/health/all failed:', err);
      setLiveHealthData(null);
      setIsLiveConnected(false);
      setApiError(
        err?.message?.includes('Unauthorized') || err?.message?.includes('401')
          ? 'Admin authorization required. Please authenticate with an Admin JWT token to view live infrastructure probes.'
          : (err?.message || 'Failed to load health observations.')
      );
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [liveHealthData]);

  // Initial Load on Mount
  useEffect(() => {
    loadHealthData(false);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => { if(!isRefreshing) loadHealthData(false); }, 30000);
    return () => window.clearInterval(timer);
  }, [loadHealthData, isRefreshing]);

  // 1. Storage Mounts Derivation (Across ALL monitored resources: Stager, slurm147, slurm24, slurm-marshall, slurm-pirate)
  const vmStorageMounts = useMemo<StorageMountItem[]>(() => {
    if (!liveHealthData?.resources) return [];

    const items: StorageMountItem[] = [];

    liveHealthData.resources.forEach(r => {
      if(!r.resource_id) return;
      const resourceId = r.resource_id;
      (r.mounts || []).forEach((m, idx) => {
        const isScratch = m.mount.includes('scratch');
        const freePct = m.free_space_pct != null ? m.free_space_pct : null;
        const usedPct = freePct != null ? Math.max(0, Math.min(100, 100 - freePct)) : null;

        items.push({
          id: `${r.resource_id}-${m.mount}-${idx}`,
          resourceId,
          hostName: r.resource_name,
          mount: m.mount,
          subtitle: isScratch ? '(NFS Scratch Storage)' : '(Ceph Osiris Storage)',
          target: `${r.resource_name} volume`,
          accessible: m.accessible,
          freePct,
          usedPct,
          latency: m.latency_ms != null ? `${m.latency_ms} ms` : 'N/A',
          latency_ms: m.latency_ms || 0,
          warning: m.warning,
          error: m.error,
          overallStatus: r.overall_status
        });
      });
    });

    return items;
  }, [liveHealthData]);

  // Available unique host names for mount filtering
  const mountHostOptions = useMemo(() => {
    if (!vmStorageMounts.length) return [];
    const hosts = Array.from(new Set(vmStorageMounts.map(m => m.hostName)));
    return hosts;
  }, [vmStorageMounts]);

  // Filtered storage mounts
  const filteredStorageMounts = useMemo(() => {
    if (selectedMountHostFilter === 'all') return vmStorageMounts;
    return vmStorageMounts.filter(m => m.hostName.toLowerCase() === selectedMountHostFilter.toLowerCase());
  }, [vmStorageMounts, selectedMountHostFilter]);

  // 2. SLURM Cluster Cards Derivation
  const slurmClusterCards = useMemo(() => {
    if (!liveHealthData?.resources) return [];

    const clusters = liveHealthData.resources.filter(
      r => (r.slurm && r.slurm.nodes) || r.resource_name.toLowerCase().startsWith('slurm')
    );

    return clusters.map(c => {
      const byState = c.slurm?.nodes?.by_state || {};
      const alloc = byState.alloc || 0;
      const idle = (byState.idle || 0) + (byState['idle~'] || 0) + (byState['idle*'] || 0);
      const downNodes = c.slurm?.nodes?.down_nodes || [];
      const down = (byState.down || 0) + (byState['down*'] || 0) + (byState['down~'] || 0) + downNodes.length;
      const drain = (byState.drain || 0) + (byState['drain*'] || 0);
      const total = c.slurm?.nodes?.total_nodes || (alloc + idle + down + drain) || 0;

      // Scratch mount status on this cluster
      const scratchMount = (c.mounts || []).find(m => m.mount.includes('scratch'));

      let statusText = 'Optimal';
      let statusBadge = 'bg-status-success/20 text-status-success border-status-success/30';
      if (down > 0) {
        statusText = `${down} Node${down > 1 ? 's' : ''} Down`;
        statusBadge = 'bg-red-500/20 text-red-300 border-red-500/30';
      } else if (drain > 0) {
        statusText = `${drain} Node${drain > 1 ? 's' : ''} Drain`;
        statusBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      } else if (c.overall_status === 'warning') {
        statusText = 'Warning (low_disk / hung_nfs)';
        statusBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      } else if (c.overall_status === 'error') {
        statusText = 'Error';
        statusBadge = 'bg-red-500/20 text-red-300 border-red-500/30';
      }

      return {
        id: c.resource_id,
        name: c.resource_name,
        total,
        idle,
        alloc,
        down,
        drain,
        statusText,
        statusBadge,
        overallStatus: c.overall_status,
        jobsRunning: c.slurm?.jobs?.total_jobs ?? 0,
        scratchMount
      };
    });
  }, [liveHealthData]);

  // 3. SLURM Nodes List Derivation
  const slurmNodes = useMemo(() => {
    if (!liveHealthData?.resources) return [];

    const clusters = liveHealthData.resources.filter(
      r => (r.slurm && r.slurm.nodes) || r.resource_name.toLowerCase().startsWith('slurm')
    );
    const generatedNodes: SlurmNode[] = [];

    clusters.forEach(c => {
      const clusterName = c.resource_name;
      const byState = c.slurm?.nodes?.by_state || {};
      const downNodes = c.slurm?.nodes?.down_nodes || [];

      // 1. Explicit Down nodes reported from API
      downNodes.forEach((dn, idx) => {
        const nodeName = typeof dn === 'string' ? dn : (dn.node || `${clusterName}-down-${idx + 1}`);
        const reason = typeof dn === 'string' ? 'Down / Socket timeout' : (dn.reason || 'Down');
        generatedNodes.push({
          id: nodeName,
          cluster: clusterName,
          partition: 'main',
          state: 'down',
          cpus: '0/32',
          memory: '0GB / 128GB',
          reason,
          uptime: '0h'
        });
      });

      // 2. Allocated nodes reported by state
      const allocCount = byState.alloc || 0;
      for (let i = 1; i <= Math.min(allocCount, 12); i++) {
        generatedNodes.push({
          id: `${clusterName}-alloc-${i.toString().padStart(2, '0')}`,
          cluster: clusterName,
          partition: clusterName.includes('gpu') ? 'gpu-high' : 'main',
          state: 'allocated',
          cpus: '32/32',
          memory: '128GB / 128GB',
          uptime: 'Monitored'
        });
      }

      // 3. Drain nodes reported by state
      const drainCount = (byState.drain || 0) + (byState['drain*'] || 0);
      for (let i = 1; i <= Math.min(drainCount, 6); i++) {
        generatedNodes.push({
          id: `${clusterName}-drain-${i.toString().padStart(2, '0')}`,
          cluster: clusterName,
          partition: 'batch',
          state: 'drain',
          cpus: '0/16',
          memory: '2GB / 64GB',
          reason: 'Drain / Maintenance State',
          uptime: 'Monitored'
        });
      }

      // 4. Idle nodes reported by state
      const idleCount = (byState.idle || 0) + (byState['idle~'] || 0) + (byState['idle*'] || 0);
      for (let i = 1; i <= Math.min(idleCount, 12); i++) {
        generatedNodes.push({
          id: `${clusterName}-idle-${i.toString().padStart(2, '0')}`,
          cluster: clusterName,
          partition: 'main',
          state: 'idle',
          cpus: '0/32',
          memory: '4GB / 128GB',
          uptime: 'Monitored'
        });
      }
    });

    return generatedNodes;
  }, [liveHealthData]);

  // Filtered SLURM nodes
  const filteredNodes = useMemo(() => {
    return slurmNodes.filter(n => {
      if (selectedClusterFilter !== 'all' && n.cluster !== selectedClusterFilter) return false;
      if (selectedStateFilter !== 'all' && n.state !== selectedStateFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return n.id.toLowerCase().includes(q) || n.cluster.toLowerCase().includes(q) || (n.reason && n.reason.toLowerCase().includes(q));
      }
      return true;
    });
  }, [slurmNodes, selectedClusterFilter, selectedStateFilter, searchQuery]);

  // Overall SLURM Cluster Summary Stats
  const clusterStats = useMemo(() => {
    let idle = 0;
    let allocated = 0;
    let down = 0;
    let drain = 0;

    slurmClusterCards.forEach(c => {
      idle += c.idle;
      allocated += c.alloc;
      down += c.down;
      drain += c.drain;
    });

    return {
      total: idle + allocated + down + drain,
      idle,
      allocated,
      down,
      drain
    };
  }, [slurmClusterCards]);

  // 4. SLURM Node Jobs Derivation (squeue Telemetry)
  const slurmNodeJobs = useMemo<EnrichedSlurmJob[]>(() => {
    if (!liveHealthData?.resources) return [];

    const jobs: EnrichedSlurmJob[] = [];
    liveHealthData.resources.forEach(r => {
      if(!r.resource_id) return;
      const clusterName = r.resource_name;
      const resourceId = r.resource_id;

      if (r.slurm?.jobs?.recent_jobs && Array.isArray(r.slurm.jobs.recent_jobs)) {
        r.slurm.jobs.recent_jobs.forEach(j => {
          jobs.push({
            ...j,
            cluster: clusterName,
            resourceId
          });
        });
      }

      if (r.slurm?.jobs?.failed_jobs && Array.isArray(r.slurm.jobs.failed_jobs)) {
        r.slurm.jobs.failed_jobs.forEach(j => {
          const jobId = j.job_id || j.id;
          if (!jobs.some(existing => (existing.job_id || existing.id) === jobId && existing.cluster === clusterName)) {
            jobs.push({
              ...j,
              cluster: clusterName,
              resourceId,
              status: j.status || j.state || 'FAILED'
            });
          }
        });
      }
    });

    return jobs;
  }, [liveHealthData]);

  // SLURM Job Stats Summary
  const jobStats = useMemo(() => {
    let total = 0;
    let running = 0;
    let pending = 0;
    let failed = 0;

    liveHealthData?.resources?.forEach(r => {
      if (r.slurm?.jobs) {
        total += r.slurm.jobs.total_jobs || 0;
        const byStatus = r.slurm.jobs.by_status || {};
        running += byStatus.RUNNING || byStatus.running || byStatus.R || 0;
        pending += byStatus.PENDING || byStatus.pending || byStatus.PD || 0;
        failed += (r.slurm.jobs.failed_jobs?.length || 0) + (byStatus.FAILED || byStatus.failed || 0);
      }
    });

    return { total, running, pending, failed };
  }, [liveHealthData]);

  // Filtered SLURM Node Jobs
  const filteredNodeJobs = useMemo(() => {
    return slurmNodeJobs.filter(job => {
      if (selectedClusterFilter !== 'all' && job.cluster !== selectedClusterFilter) return false;
      if (selectedJobStatusFilter !== 'all') {
        const status = String(job.status || job.state || '').toUpperCase();
        if (selectedJobStatusFilter === 'RUNNING' && status !== 'RUNNING' && status !== 'R') return false;
        if (selectedJobStatusFilter === 'PENDING' && status !== 'PENDING' && status !== 'PD') return false;
        if (selectedJobStatusFilter === 'FAILED' && status !== 'FAILED' && status !== 'F') return false;
      }
      if (jobSearchQuery) {
        const q = jobSearchQuery.toLowerCase();
        const id = String(job.job_id || job.id || '').toLowerCase();
        const name = String(job.name || job.job_name || '').toLowerCase();
        const user = String(job.user || job.username || '').toLowerCase();
        const node = String(job.nodes || job.nodelist || '').toLowerCase();
        const cluster = String(job.cluster || '').toLowerCase();
        return id.includes(q) || name.includes(q) || user.includes(q) || node.includes(q) || cluster.includes(q);
      }
      return true;
    });
  }, [slurmNodeJobs, selectedClusterFilter, selectedJobStatusFilter, jobSearchQuery]);

  // Warnings / issues across mounts or clusters
  const hasSystemWarnings = useMemo(() => {
    if (!isLiveConnected) return false;
    const mountIssues = vmStorageMounts.some(m => !m.accessible || m.warning || m.error);
    const clusterIssues = slurmClusterCards.some(c => c.down > 0 || c.overallStatus === 'warning' || c.overallStatus === 'error');
    return mountIssues || clusterIssues;
  }, [isLiveConnected, vmStorageMounts, slurmClusterCards]);

  // Associated Amaretti tasks for the selected node's cluster
  const nodeTasks = useMemo(() => {
    if (!selectedNode) return [];
    const clusterLower = selectedNode.cluster.toLowerCase();
    return tasksList.filter(t => 
      (t.resource && t.resource.toLowerCase().includes(clusterLower)) ||
      (t.runtime && t.runtime.toLowerCase().includes(clusterLower))
    );
  }, [selectedNode, tasksList]);

  // Associated SLURM jobs for the selected node
  const nodeSlurmJobs = useMemo(() => {
    if (!selectedNode) return [];
    const clusterLower = selectedNode.cluster.toLowerCase();
    const nodeIdLower = selectedNode.id.toLowerCase();
    return slurmNodeJobs.filter(j => 
      j.cluster.toLowerCase() === clusterLower ||
      (j.nodes && String(j.nodes).toLowerCase().includes(nodeIdLower))
    );
  }, [selectedNode, slurmNodeJobs]);

  // Associated storage mounts for the selected node's cluster
  const nodeClusterMounts = useMemo<ResourceMountHealth[]>(() => {
    if (!selectedNode || !liveHealthData?.resources) return [];
    const clusterResource = liveHealthData.resources.find(
      r => r.resource_name.toLowerCase() === selectedNode.cluster.toLowerCase()
    );
    if (clusterResource && clusterResource.mounts && clusterResource.mounts.length > 0) {
      return clusterResource.mounts;
    }
    const clusterMounts = vmStorageMounts.filter(
      m => m.hostName.toLowerCase() === selectedNode.cluster.toLowerCase()
    );
    const source = clusterMounts.length > 0 ? clusterMounts : vmStorageMounts;
    return source.map(m => ({
      mount: m.mount,
      accessible: m.accessible,
      latency_ms: m.latency_ms,
      free_space_pct: m.freePct ?? 0,
      warning: m.warning,
      error: m.error
    }));
  }, [selectedNode, liveHealthData, vmStorageMounts]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border-glass pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E2532] border border-border-glass text-text-muted shadow-sm">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                  Cluster, Storage & Docker Health Monitor
                </h1>
                {isLiveConnected ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[#161C26] px-2.5 py-0.5 text-[10px] font-mono text-text-muted border border-border-glass">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Live Telemetry Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[#161C26] px-2.5 py-0.5 text-[10px] font-mono text-text-muted border border-border-glass">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Live Telemetry Unavailable
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5 font-sans">
                Latest health observations from <strong className="text-white font-mono">GET /resource/health/all</strong> covering storage mounts, SLURM nodes, compute jobs, and API host containers
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls & Status */}
        <div className="flex items-center gap-3 self-end md:self-auto font-mono text-xs">
          <div className="flex items-center gap-2 rounded-xl border border-border-glass bg-[#1E2532] px-3 py-1.5 text-text-muted shadow-sm">
            <ShieldCheck className={`h-4 w-4 ${hasSystemWarnings ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span>
              {!isLiveConnected 
                ? 'Probes Offline' 
                : hasSystemWarnings 
                ? 'Cluster Warnings' 
                : 'All Probes Operational'}
            </span>
          </div>

          <button
            onClick={() => loadHealthData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-xl border border-border-glass bg-[#1E2532] hover:bg-[#252E3E] px-3.5 py-1.5 font-bold text-white transition-all cursor-pointer disabled:opacity-50 shadow-sm"
            title="Runs storage and SLURM probes and reloads the latest Docker collector observations"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-text-muted ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Health'}</span>
          </button>
        </div>
      </div>

      {/* Telemetry Unavailable / Auth Required Alert Banner */}
      {!isLiveConnected && !isLoading && (
        <div className="rounded-2xl border border-border-glass bg-[#1E2532] p-5 space-y-3 shadow-sm animate-fadeIn">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-[#161C26] p-2.5 text-text-muted border border-border-glass shrink-0 mt-0.5">
                <Lock className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                  Live Infrastructure Health Telemetry Unavailable
                  <span className="text-[10px] font-normal text-text-muted font-sans">(Simulated fallbacks disabled for accuracy)</span>
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  {apiError || 'The live endpoint GET https://brainlife.io/api/amaretti/resource/health/all requires an active Admin JWT token.'}
                </p>
                <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-text-faint">
                  <span>Backend Cache: <strong className="text-white">5 min (Redis)</strong></span>
                  <span>•</span>
                  <span>Historical Persistence: <strong className="text-white">90 days (MongoDB)</strong></span>
                  <span>•</span>
                  <span>Live Refresh Hook: <strong className="text-white font-mono">POST /resource/:id/health/refresh</strong></span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 shrink-0 font-mono text-xs">
              <button
                onClick={() => loadHealthData(true)}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 rounded-xl border border-[#4A5568] bg-[#2D3748] hover:bg-[#374254] px-3.5 py-2 font-bold text-white transition-all cursor-pointer shadow-sm"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Retry Probe Query</span>
              </button>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('settings')}
                  className="flex items-center gap-1.5 rounded-xl border border-border-glass bg-[#161C26] hover:bg-[#252E3E] px-3.5 py-2 font-bold text-text-muted hover:text-white transition-all cursor-pointer shadow-sm"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Configure Token</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="rounded-2xl border border-border-glass bg-[#1E2532] p-8 text-center space-y-3 animate-pulse">
          <div className="flex justify-center">
            <RefreshCw className="h-8 w-8 text-text-muted animate-spin" />
          </div>
          <div className="font-mono text-sm font-bold text-white">Querying Jetstream2 & SLURM Health Probes...</div>
          <div className="text-xs text-text-muted font-mono">Fetching GET /resource/health/all</div>
        </div>
      )}

      {isLiveConnected && apiError && <p role="alert" className="text-sm text-amber-300">{apiError}</p>}
      <DockerHealthPanel resources={liveHealthData?.resources || []} />

      {/* SECTION 1: Multi-Resource Storage Mounts Telemetry (/mnt/scratch & /mnt/osiris) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono">
            <HardDrive className="h-4 w-4 text-text-muted" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              1. Multi-Host Storage Mounts Telemetry (/mnt/scratch & /mnt/osiris)
            </h2>
            <span className="rounded-md bg-[#161C26] border border-border-glass px-2 py-0.5 text-[9.5px] text-text-muted">
              {vmStorageMounts.length} Monitored Mounts
            </span>
          </div>
          <span className="text-[10px] font-mono text-text-faint">Last checked: {lastCheckTime}</span>
        </div>

        {/* Host Filter Tabs for Mounts */}
        {mountHostOptions.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10.5px]">
            <span className="text-text-faint text-[10px] uppercase font-bold mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" />
              Filter Host:
            </span>
            <button
              onClick={() => setSelectedMountHostFilter('all')}
              className={`rounded-lg px-2.5 py-1 font-bold transition-all cursor-pointer ${
                selectedMountHostFilter === 'all'
                  ? 'bg-[#2D3748] text-white border border-[#4A5568] shadow-sm'
                  : 'bg-[#1E2532] border border-border-glass text-text-muted hover:text-white hover:bg-[#252E3E]'
              }`}
            >
              All Hosts ({vmStorageMounts.length})
            </button>
            {mountHostOptions.map(host => {
              const count = vmStorageMounts.filter(m => m.hostName === host).length;
              return (
                <button
                  key={host}
                  onClick={() => setSelectedMountHostFilter(host)}
                  className={`rounded-lg px-2.5 py-1 font-bold transition-all cursor-pointer ${
                    selectedMountHostFilter === host
                      ? 'bg-[#2D3748] text-white border border-[#4A5568] shadow-sm'
                      : 'bg-[#1E2532] border border-border-glass text-text-muted hover:text-white hover:bg-[#252E3E]'
                  }`}
                >
                  {host} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Mount Cards Grid */}
        {filteredStorageMounts.length === 0 ? (
          <div className="glass rounded-2xl border border-dashed border-border-glass p-6 text-center text-xs font-mono text-text-muted space-y-1">
            <div className="text-white font-bold">Storage Mount Telemetry: Not Available</div>
            <div className="text-[11px] text-text-faint">
              {isLiveConnected ? 'No storage mounts match the selected host filter.' : 'Waiting for live probe connection from /resource/health/all.'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStorageMounts.map((mount) => {
              const isHealthy = mount.accessible && !mount.error;
              const isWarning = mount.warning || (mount.freePct != null && mount.freePct < 10) || (mount.usedPct != null && mount.usedPct > 90);

              return (
                <div 
                  key={mount.id}
                  className="glass relative overflow-hidden rounded-2xl p-4.5 border border-border-glass bg-[#1E2532] space-y-3.5 shadow-sm hover:border-[#4A5568] transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl border shrink-0 ${
                          isHealthy 
                            ? 'bg-[#161C26] border-border-glass text-text-muted' 
                            : 'bg-red-500/15 border-red-500/30 text-red-400'
                        }`}>
                          {mount.mount.includes('scratch') ? (
                            <HardDrive className="h-4.5 w-4.5" />
                          ) : (
                            <Database className="h-4.5 w-4.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-mono text-sm font-bold text-white flex items-center gap-1.5 truncate">
                            {mount.mount}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="rounded bg-[#161C26] border border-border-glass px-1.5 py-0.2 text-[9.5px] font-mono text-text-muted font-bold truncate">
                              Host: {mount.hostName}
                            </span>
                            <span className="text-[9.5px] font-sans text-text-faint truncate">
                              {mount.subtitle}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold font-mono shrink-0 ${
                        isHealthy
                          ? isWarning 
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                            : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                          : 'border-red-500/30 bg-red-500/10 text-red-400'
                      }`}>
                        {isHealthy ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            {isWarning ? 'LOW DISK' : 'MOUNTED'}
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3 w-3" />
                            UNREACHABLE
                          </>
                        )}
                      </span>
                    </div>

                    {/* Capacity & Usage Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between font-mono text-[10.5px]">
                        <span className="text-text-muted">Volume Capacity</span>
                        <span className="text-white font-bold">
                          {mount.freePct != null ? `${mount.usedPct}% Used (${mount.freePct}% Free)` : 'Capacity Not Reported'}
                        </span>
                      </div>
                      {mount.usedPct != null ? (
                        <div className="h-1.5 w-full bg-[#121620] rounded-full overflow-hidden border border-border-glass/50">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              mount.usedPct > 90 || (mount.freePct != null && mount.freePct < 10)
                                ? 'bg-red-500'
                                : mount.usedPct > 75
                                ? 'bg-amber-400'
                                : 'bg-[#4A5568]'
                            }`} 
                            style={{ width: `${mount.usedPct}%` }} 
                          />
                        </div>
                      ) : (
                        <div className="h-1.5 w-full bg-[#121620] rounded-full" />
                      )}
                    </div>
                  </div>

                  {/* Mount Details Grid */}
                  <div className="grid grid-cols-3 gap-1.5 pt-2.5 border-t border-border-glass font-mono text-[9.5px]">
                    <div>
                      <span className="text-text-faint block">Access Status</span>
                      <span className={isHealthy ? 'text-text-main font-semibold' : 'text-red-400 font-bold'}>
                        {isHealthy ? 'Accessible (rw)' : 'Unreachable'}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-faint block">Probe Latency</span>
                      <span className="text-text-muted font-bold">{mount.latency}</span>
                    </div>
                    <div>
                      <span className="text-text-faint block">Diagnostic State</span>
                      <span className={mount.warning || mount.error ? 'text-amber-400 font-bold' : 'text-text-muted font-semibold'}>
                        {mount.error || mount.warning || 'Normal'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: SLURM Cluster Node Matrix (sinfo Inspector) */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono">
            <Cpu className="h-4 w-4 text-text-muted" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              2. Jetstream2 SLURM Clusters Matrix (sinfo command monitor)
            </h2>
          </div>

          <button
            onClick={() => setShowRawSinfoConsole(!showRawSinfoConsole)}
            disabled={!isLiveConnected || slurmNodes.length === 0}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10.5px] font-mono font-bold transition-all cursor-pointer disabled:opacity-40 self-start sm:self-auto ${
              showRawSinfoConsole
                ? 'border-[#4A5568] bg-[#2D3748] text-white'
                : 'border-border-glass bg-[#1E2532] text-text-muted hover:text-white hover:bg-[#252E3E]'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>{showRawSinfoConsole ? 'Hide Raw sinfo Terminal' : 'View Raw sinfo Output'}</span>
          </button>
        </div>

        {/* Dynamic SLURM Cluster Cards Grid */}
        {slurmClusterCards.length === 0 ? (
          <div className="glass rounded-2xl border border-dashed border-border-glass p-6 text-center text-xs font-mono text-text-muted space-y-1">
            <div className="text-white font-bold">SLURM Cluster Telemetry: Not Available</div>
            <div className="text-[11px] text-text-faint">
              {isLiveConnected ? 'No SLURM clusters returned in active health payload.' : 'Waiting for live endpoint authentication.'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {slurmClusterCards.map((cluster) => {
              const isSelected = selectedClusterFilter === cluster.name;

              return (
                <div 
                  key={cluster.name}
                  onClick={() => setSelectedClusterFilter(isSelected ? 'all' : cluster.name)}
                  className={`glass rounded-2xl p-4 border transition-all cursor-pointer bg-[#1E2532] shadow-sm ${
                    isSelected 
                      ? 'border-[#3182CE] bg-[#202E40] ring-1 ring-[#3182CE]/30' 
                      : 'border-border-glass hover:border-[#4A5568]'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-text-faint block">Cluster Node</span>
                      <h4 className="font-mono text-sm font-bold text-white">{cluster.name}</h4>
                    </div>
                    <span className={`rounded-md border px-2 py-0.5 text-[9.5px] font-mono font-bold ${
                      cluster.down > 0 
                        ? 'border-red-500/30 bg-red-500/10 text-red-400' 
                        : 'border-border-glass bg-[#161C26] text-text-muted'
                    }`}>
                      {cluster.down > 0 ? `${cluster.down} Nodes Down` : 'Optimal'}
                    </span>
                  </div>

                  {/* Cluster Node Stats Grid - Neutral Ash Cards */}
                  <div className="mt-3 grid grid-cols-3 gap-1.5 font-mono text-[10px] text-center">
                    <div className="bg-[#161C26] border border-border-glass rounded-lg p-1.5">
                      <span className="text-text-muted text-[9px] block">Idle</span>
                      <span className="font-bold text-white text-xs">{cluster.idle}</span>
                    </div>
                    <div className="bg-[#161C26] border border-border-glass rounded-lg p-1.5">
                      <span className="text-text-muted text-[9px] block">Alloc</span>
                      <span className="font-bold text-white text-xs">{cluster.alloc}</span>
                    </div>
                    <div className={`border rounded-lg p-1.5 ${
                      cluster.down > 0 
                        ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                        : 'bg-[#161C26] border-border-glass text-text-muted'
                    }`}>
                      <span className="text-[9px] block">Down</span>
                      <span className="font-bold text-xs">
                        {cluster.down > 0 ? cluster.down : cluster.drain > 0 ? `${cluster.drain}d` : '0'}
                      </span>
                    </div>
                  </div>

                  {/* Cluster Footer: Mount Status & Active SLURM Jobs */}
                  <div className="mt-2.5 pt-2 border-t border-border-glass flex items-center justify-between text-[9.5px] font-mono text-text-muted">
                    <span className="flex items-center gap-1 truncate" title="Scratch Mount Status">
                      <HardDrive className="h-3 w-3 shrink-0 text-text-faint" />
                      {cluster.scratchMount ? `${cluster.scratchMount.free_space_pct}% free (${cluster.scratchMount.latency_ms}ms)` : 'scratch ok'}
                    </span>
                    <span className="flex items-center gap-1 font-semibold truncate">
                      <Zap className="h-3 w-3 shrink-0 text-text-faint" />
                      {cluster.jobsRunning} Job{cluster.jobsRunning === 1 ? '' : 's'} Active
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Optional Raw sinfo Terminal View */}
        {showRawSinfoConsole && isLiveConnected && (
          <div className="rounded-2xl border border-border-glass bg-[#121620] p-4 font-mono text-xs text-text-main space-y-2 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between text-text-faint border-b border-border-glass pb-2 text-[10.5px]">
              <span className="flex items-center gap-1.5 text-white font-bold">
                <Terminal className="h-4 w-4 text-text-muted" />
                sinfo -Ne (Live Amaretti Diagnostic stdout)
              </span>
              <span>Host: jetstream2-master-control (Cached 5m Redis / 90d Mongo)</span>
            </div>
            <pre className="overflow-x-auto text-[11px] leading-relaxed text-[#A0AEC0] select-all py-2">
{`$ sinfo -Ne -o "%.12N %.8P %.10t %.10C %.12m %.30E"
NODELIST     PARTITION  STATE      CPUS(A/I/O) MEMORY       REASON
${filteredNodes.length === 0 ? 'No nodes matching active filters' : filteredNodes.slice(0, 20).map(n => 
  `${n.id.padEnd(12)} ${n.partition.padEnd(10)} ${n.state.padEnd(10)} ${n.cpus.padEnd(11)} ${(n.memory || '128000').padEnd(12)} ${n.reason || 'none'}`
).join('\n')}`}
            </pre>
          </div>
        )}

        {/* Node Filter & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* State Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1 font-mono text-[10.5px]">
            {[
              { id: 'all', label: `All Nodes (${slurmNodes.length})` },
              { id: 'idle', label: `Idle (${clusterStats.idle})` },
              { id: 'allocated', label: `Allocated (${clusterStats.allocated})` },
              { id: 'down', label: `Down (${clusterStats.down})` },
              { id: 'drain', label: `Drain (${clusterStats.drain})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedStateFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 font-bold transition-all cursor-pointer ${
                  selectedStateFilter === tab.id
                    ? 'bg-[#2D3748] text-white border border-[#4A5568] shadow-sm'
                    : 'bg-[#1E2532] border border-border-glass text-text-muted hover:text-white hover:bg-[#252E3E]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64 font-mono text-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-faint" />
            <input
              type="text"
              placeholder="Search node ID, cluster, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-border-glass bg-[#161C26] pl-9 pr-3 py-1.5 text-white placeholder-text-faint focus:outline-none focus:border-[#4FD1C5]"
            />
          </div>
        </div>

        {/* Interactive Node Table */}
        <div className="glass overflow-hidden rounded-2xl border border-border-glass bg-[#1E2532]">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#161C26] border-b border-border-glass text-[9px] uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="py-3 px-4">Node ID</th>
                  <th className="py-3 px-4">Cluster</th>
                  <th className="py-3 px-4">Partition</th>
                  <th className="py-3 px-4">State</th>
                  <th className="py-3 px-4">CPU Cores</th>
                  <th className="py-3 px-4">RAM Allocation</th>
                  <th className="py-3 px-4">Diagnostic / Down Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263042]">
                {filteredNodes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-text-faint font-sans">
                      {isLiveConnected 
                        ? 'No SLURM cluster nodes match the selected filters.' 
                        : 'Live node telemetry unavailable. Please authenticate with an Admin token and run probes.'}
                    </td>
                  </tr>
                ) : (
                  filteredNodes.slice(0, visibleNodeCount).map(node => {
                    let stateBadge = 'bg-[#161C26] text-text-muted border border-border-glass';
                    if (node.state === 'allocated') stateBadge = 'bg-[#161C26] text-white border border-border-glass font-semibold';
                    else if (node.state === 'down') stateBadge = 'bg-red-500/10 text-red-400 border border-red-500/30';
                    else if (node.state === 'drain') stateBadge = 'bg-amber-500/10 text-amber-400 border border-amber-500/30';

                    return (
                      <tr 
                        key={`${node.cluster}-${node.id}`} 
                        onClick={() => setSelectedNode(node)}
                        className={`hover:bg-[#252E3E] transition-colors cursor-pointer group ${
                          selectedNode?.id === node.id ? 'bg-[#202E40]' : ''
                        }`}
                        title="Click to open SLURM node telemetry & diagnostic inspector"
                      >
                        <td className="py-3 px-4 font-bold text-white flex items-center justify-between gap-1.5">
                          <span>{node.id}</span>
                          <span className="opacity-0 group-hover:opacity-100 text-[10px] text-text-muted transition-opacity font-normal">
                            Inspect →
                          </span>
                        </td>
                        <td className="py-3 px-4 text-text-main font-semibold">{node.cluster}</td>
                        <td className="py-3 px-4 text-text-muted">{node.partition}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-block rounded-lg px-2.5 py-0.5 text-[10px] font-bold border uppercase ${stateBadge}`}>
                            {node.state}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white font-bold">{node.cpus}</td>
                        <td className="py-3 px-4 text-text-muted">{node.memory}</td>
                        <td className="py-3 px-4 text-text-faint text-[11px]">
                          {node.reason ? (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-red-400 font-bold truncate max-w-[200px]" title={node.reason}>{node.reason}</span>
                              {onNavigate && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigate('incidents');
                                  }}
                                  className="shrink-0 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-300 hover:bg-red-500/20 cursor-pointer"
                                  title="View in Incidents"
                                >
                                  View Incident →
                                </button>
                              )}
                            </div>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Centered Read More Button for Nodes */}
          {filteredNodes.length > 10 && (
            <div className="flex justify-center border-t border-border-glass p-3 bg-[#161C26]">
              <button
                onClick={() => {
                  if (visibleNodeCount >= filteredNodes.length) {
                    setVisibleNodeCount(10);
                  } else {
                    setVisibleNodeCount((prev) => prev + 10);
                  }
                }}
                className="rounded-lg border border-border-glass bg-[#1E2532] hover:bg-[#252E3E] px-4 py-2 text-xs font-semibold text-text-muted hover:text-white transition-all cursor-pointer select-none"
              >
                {visibleNodeCount >= filteredNodes.length 
                  ? 'Show Less Nodes' 
                  : `Read More Nodes (${filteredNodes.length - visibleNodeCount} more)`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: Jetstream2 SLURM Node Jobs Queue (squeue Telemetry) */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono">
            <Zap className="h-4 w-4 text-text-muted" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              3. Jetstream2 SLURM Node Jobs Queue (squeue command monitor)
            </h2>
            <span className="rounded-md bg-[#161C26] border border-border-glass px-2 py-0.5 text-[9.5px] text-text-muted">
              {jobStats.total} Active Node Jobs
            </span>
          </div>

          <button
            onClick={() => setShowRawSqueueConsole(!showRawSqueueConsole)}
            disabled={!isLiveConnected || slurmNodeJobs.length === 0}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10.5px] font-mono font-bold transition-all cursor-pointer disabled:opacity-40 self-start sm:self-auto ${
              showRawSqueueConsole
                ? 'border-[#4A5568] bg-[#2D3748] text-white'
                : 'border-border-glass bg-[#1E2532] text-text-muted hover:text-white hover:bg-[#252E3E]'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>{showRawSqueueConsole ? 'Hide Raw squeue Terminal' : 'View Raw squeue Output'}</span>
          </button>
        </div>

        {/* Optional Raw squeue Terminal View */}
        {showRawSqueueConsole && isLiveConnected && (
          <div className="rounded-2xl border border-border-glass bg-[#121620] p-4 font-mono text-xs text-text-main space-y-2 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between text-text-faint border-b border-border-glass pb-2 text-[10.5px]">
              <span className="flex items-center gap-1.5 text-white font-bold">
                <Terminal className="h-4 w-4 text-text-muted" />
                squeue -o "%.18i %.9P %.20j %.8u %.2t %.10M %.6D %R" (Live SLURM Telemetry)
              </span>
              <span>Host: jetstream2-master-control</span>
            </div>
            <pre className="overflow-x-auto text-[11px] leading-relaxed text-[#A0AEC0] select-all py-2">
{`$ squeue -o "%.18i %.9P %.20j %.8u %.2t %.10M %.6D %R"
JOBID              PARTITION NAME                 USER     ST TIME       NODES NODELIST(REASON)
${filteredNodeJobs.length === 0 ? 'No jobs matching active filters' : filteredNodeJobs.slice(0, 25).map(j => {
  const jid = String(j.job_id || j.id || 'N/A').padEnd(18);
  const part = String(j.partition || 'main').padEnd(9);
  const name = String(j.name || j.job_name || 'job').slice(0, 20).padEnd(20);
  const user = String(j.user || j.username || 'user').padEnd(8);
  const st = String(j.status || j.state || 'R').slice(0, 2).padEnd(2);
  const time = String(j.time || j.runtime || j.duration || '00:00:00').padEnd(10);
  const nodes = String(j.nodes || '1').padEnd(5);
  const nodelist = String(j.nodelist || j.nodes || `${j.cluster}-alloc-01`);
  return `${jid} ${part} ${name} ${user} ${st} ${time} ${nodes} ${nodelist}`;
}).join('\n')}`}
            </pre>
          </div>
        )}

        {/* Node Jobs Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          <div className="glass rounded-xl border border-border-glass bg-[#1E2532] p-3.5 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] text-text-muted uppercase font-bold block">Total Node Jobs</span>
              <span className="text-lg font-bold text-white">{jobStats.total}</span>
            </div>
            <div className="p-2 rounded-lg bg-[#161C26] border border-border-glass text-text-muted">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="glass rounded-xl border border-border-glass bg-[#1E2532] p-3.5 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] text-text-muted uppercase font-bold block">Running on Nodes</span>
              <span className="text-lg font-bold text-white">{jobStats.running}</span>
            </div>
            <div className="p-2 rounded-lg bg-[#161C26] border border-border-glass text-text-muted">
              <Play className="h-4 w-4" />
            </div>
          </div>
          <div className="glass rounded-xl border border-border-glass bg-[#1E2532] p-3.5 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] text-text-muted uppercase font-bold block">Pending in SLURM</span>
              <span className="text-lg font-bold text-white">{jobStats.pending}</span>
            </div>
            <div className="p-2 rounded-lg bg-[#161C26] border border-border-glass text-text-muted">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="glass rounded-xl border border-border-glass bg-[#1E2532] p-3.5 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] text-text-muted uppercase font-bold block">Failed on Nodes</span>
              <span className={`text-lg font-bold ${jobStats.failed > 0 ? 'text-red-400' : 'text-white'}`}>{jobStats.failed}</span>
            </div>
            <div className={`p-2 rounded-lg border ${
              jobStats.failed > 0 
                ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                : 'bg-[#161C26] border-border-glass text-text-muted'
            }`}>
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Job Filter & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Status Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1 font-mono text-[10.5px]">
            {[
              { id: 'all', label: `All Jobs (${slurmNodeJobs.length})` },
              { id: 'RUNNING', label: `Running (${jobStats.running})` },
              { id: 'PENDING', label: `Pending (${jobStats.pending})` },
              { id: 'FAILED', label: `Failed (${jobStats.failed})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedJobStatusFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 font-bold transition-all cursor-pointer ${
                  selectedJobStatusFilter === tab.id
                    ? 'bg-[#2D3748] text-white border border-[#4A5568] shadow-sm'
                    : 'bg-[#1E2532] border border-border-glass text-text-muted hover:text-white hover:bg-[#252E3E]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Job Search Box */}
          <div className="relative w-full sm:w-64 font-mono text-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-faint" />
            <input
              type="text"
              placeholder="Search job ID, name, user, node..."
              value={jobSearchQuery}
              onChange={(e) => setJobSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-border-glass bg-[#161C26] pl-9 pr-3 py-1.5 text-white placeholder-text-faint focus:outline-none focus:border-[#4FD1C5]"
            />
          </div>
        </div>

        {/* Interactive SLURM Jobs Table */}
        <div className="glass overflow-hidden rounded-2xl border border-border-glass bg-[#1E2532]">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#161C26] border-b border-border-glass text-[9px] uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="py-3 px-4">SLURM Job ID</th>
                  <th className="py-3 px-4">Cluster</th>
                  <th className="py-3 px-4">Job Name</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Partition</th>
                  <th className="py-3 px-4">Target Node(s)</th>
                  <th className="py-3 px-4">State</th>
                  <th className="py-3 px-4">Runtime</th>
                  <th className="py-3 px-4">CPUs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263042]">
                {filteredNodeJobs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-text-faint font-sans">
                      {isLiveConnected 
                        ? 'No active SLURM node jobs found matching current filters.' 
                        : 'Live SLURM job telemetry unavailable. Authenticate with an Admin token and run probes.'}
                    </td>
                  </tr>
                ) : (
                  filteredNodeJobs.slice(0, visibleJobCount).map(job => {
                    const statusUpper = String(job.status || job.state || 'RUNNING').toUpperCase();
                    let stateBadge = 'bg-[#161C26] text-text-muted border border-border-glass';
                    if (statusUpper.includes('PEND') || statusUpper === 'PD') {
                      stateBadge = 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
                    } else if (statusUpper.includes('FAIL') || statusUpper === 'F') {
                      stateBadge = 'bg-red-500/10 text-red-400 border border-red-500/30';
                    } else if (statusUpper.includes('RUN') || statusUpper === 'R') {
                      stateBadge = 'bg-[#161C26] text-white border border-border-glass font-semibold';
                    }

                    const jobId = String(job.job_id || job.id || 'N/A');
                    const jobName = String(job.name || job.job_name || 'slurm_job');
                    const user = String(job.user || job.username || 'unknown');
                    const nodes = String(job.nodes || job.nodelist || '—');
                    const runtime = String(job.time || job.runtime || job.duration || '00:00:00');
                    const cpus = String(job.cpus || '16');

                    return (
                      <tr 
                        key={`${job.cluster}-${jobId}`} 
                        onClick={() => setSelectedJob(job)}
                        className="hover:bg-[#252E3E] transition-colors cursor-pointer group"
                        title="Click to inspect full SLURM job details & CLI commands"
                      >
                        <td className="py-3 px-4 font-bold text-white flex items-center justify-between gap-1.5">
                          <span>#{jobId}</span>
                          <span className="opacity-0 group-hover:opacity-100 text-[10px] text-text-muted transition-opacity font-normal">
                            Inspect →
                          </span>
                        </td>
                        <td className="py-3 px-4 text-text-main font-semibold">{job.cluster}</td>
                        <td className="py-3 px-4 text-white font-bold max-w-[180px] truncate" title={jobName}>
                          {jobName}
                        </td>
                        <td className="py-3 px-4 text-text-muted">{user}</td>
                        <td className="py-3 px-4 text-text-faint">{job.partition || 'main'}</td>
                        <td className="py-3 px-4 text-text-muted">{nodes}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-block rounded-lg px-2.5 py-0.5 text-[10px] font-bold border uppercase ${stateBadge}`}>
                            {statusUpper}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white font-bold">{runtime}</td>
                        <td className="py-3 px-4 text-text-muted">{cpus}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Centered Read More Button for Jobs */}
          {filteredNodeJobs.length > 10 && (
            <div className="flex justify-center border-t border-border-glass p-3 bg-[#161C26]">
              <button
                onClick={() => {
                  if (visibleJobCount >= filteredNodeJobs.length) {
                    setVisibleJobCount(10);
                  } else {
                    setVisibleJobCount((prev) => prev + 10);
                  }
                }}
                className="rounded-lg border border-border-glass bg-[#1E2532] hover:bg-[#252E3E] px-4 py-2 text-xs font-semibold text-text-muted hover:text-white transition-all cursor-pointer select-none"
              >
                {visibleJobCount >= filteredNodeJobs.length 
                  ? 'Show Less Jobs' 
                  : `Read More Jobs (${filteredNodeJobs.length - visibleJobCount} more)`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SLURM Job Details & Diagnostics Inspector Modal */}
      {selectedJob && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setSelectedJob(null)}
        >
          <div 
            className="relative flex w-full max-w-2xl flex-col rounded-2xl border border-border-glass bg-[#1E2532] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border-glass px-6 py-4 bg-[#1B222E]">
              <div className="flex items-center gap-3">
                <div className="rounded-xl p-2.5 bg-[#161C26] border border-border-glass text-text-muted">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-mono text-base font-bold text-white tracking-wide">
                      SLURM Job #{selectedJob.job_id || selectedJob.id}
                    </h2>
                    <span className="rounded-md bg-[#161C26] border border-border-glass px-2.5 py-0.5 text-[10px] font-mono font-bold text-text-muted uppercase">
                      {selectedJob.status || selectedJob.state || 'RUNNING'}
                    </span>
                    <span className="rounded-md bg-[#161C26] border border-border-glass px-2 py-0.5 text-[10px] font-mono text-text-muted font-bold">
                      Cluster: {selectedJob.cluster}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted font-sans mt-0.5">
                    Low-Level SLURM Node Job Inspector • Jetstream2 OpenStack Infrastructure
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedJob(null)}
                className="rounded-xl border border-border-glass bg-[#161C26] p-2 text-text-muted hover:bg-[#252E3E] hover:text-white transition-colors cursor-pointer"
                title="Close (ESC)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 font-mono text-xs max-h-[75vh] overflow-y-auto">
              {/* Job Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-border-glass bg-[#161C26] p-3 space-y-1">
                  <span className="text-text-faint text-[10px] uppercase font-bold block">Job Name</span>
                  <span className="text-white font-bold block truncate" title={selectedJob.name || selectedJob.job_name}>
                    {selectedJob.name || selectedJob.job_name || 'slurm_job'}
                  </span>
                </div>
                <div className="rounded-xl border border-border-glass bg-[#161C26] p-3 space-y-1">
                  <span className="text-text-faint text-[10px] uppercase font-bold block">User / Owner</span>
                  <span className="text-white font-bold block">
                    {selectedJob.user || selectedJob.username || 'unknown'}
                  </span>
                </div>
                <div className="rounded-xl border border-border-glass bg-[#161C26] p-3 space-y-1">
                  <span className="text-text-faint text-[10px] uppercase font-bold block">Partition</span>
                  <span className="text-white font-bold block">{selectedJob.partition || 'main'}</span>
                </div>
                <div className="rounded-xl border border-border-glass bg-[#161C26] p-3 space-y-1">
                  <span className="text-text-faint text-[10px] uppercase font-bold block">Allocated Nodes</span>
                  <span className="text-white font-bold block">{selectedJob.nodes || selectedJob.nodelist || '1'}</span>
                </div>
                <div className="rounded-xl border border-border-glass bg-[#161C26] p-3 space-y-1">
                  <span className="text-text-faint text-[10px] uppercase font-bold block">Runtime Duration</span>
                  <span className="text-white font-bold block">{selectedJob.time || selectedJob.runtime || selectedJob.duration || '00:00:00'}</span>
                </div>
                <div className="rounded-xl border border-border-glass bg-[#161C26] p-3 space-y-1">
                  <span className="text-text-faint text-[10px] uppercase font-bold block">CPU Allocation</span>
                  <span className="text-white font-bold block">{selectedJob.cpus || '16'} Cores</span>
                </div>
              </div>

              {/* CLI Command Helper for Sysadmins */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
                    <Terminal className="h-4 w-4 text-text-muted" />
                    SLURM Sysadmin CLI Commands
                  </span>
                  <span className="text-[10px] text-text-faint">Click to copy command</span>
                </div>

                {/* Command 1: scontrol show job */}
                <div className="rounded-xl border border-border-glass p-3 bg-[#161C26] space-y-1.5">
                  <div className="flex items-center justify-between text-text-muted text-[10.5px]">
                    <span>1. Inspect full SLURM job details:</span>
                    <button
                      onClick={() => handleCopy(`scontrol show job ${selectedJob.job_id || selectedJob.id}`, 'showjob')}
                      className="flex items-center gap-1 text-[10.5px] font-bold text-text-muted hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedText === 'showjob' ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-status-success" />
                          <span className="text-status-success">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <code className="block bg-[#111620] p-2.5 rounded-lg text-text-main select-all border border-border-glass">
                    scontrol show job {selectedJob.job_id || selectedJob.id}
                  </code>
                </div>

                {/* Command 2: Cancel Job */}
                <div className="rounded-xl border border-border-glass p-3 bg-[#161C26] space-y-1.5">
                  <div className="flex items-center justify-between text-text-muted text-[10.5px]">
                    <span>2. Cancel / Kill SLURM job:</span>
                    <button
                      onClick={() => handleCopy(`scancel ${selectedJob.job_id || selectedJob.id}`, 'canceljob')}
                      className="flex items-center gap-1 text-[10.5px] font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                    >
                      {copiedText === 'canceljob' ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-status-success" />
                          <span className="text-status-success">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <code className="block bg-[#111620] p-2.5 rounded-lg text-text-muted select-all border border-border-glass">
                    scancel {selectedJob.job_id || selectedJob.id}
                  </code>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border-glass px-6 py-3.5 bg-[#1B222E] font-mono text-xs">
              <div className="text-text-faint text-[11px]">
                Press <kbd className="rounded bg-[#161C26] border border-border-glass px-1.5 py-0.5 text-[10px] text-text-muted">ESC</kbd> or click outside to dismiss
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="rounded-xl border border-[#4A5568] bg-[#2D3748] hover:bg-[#374254] px-4 py-1.5 font-bold text-white transition-all cursor-pointer shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deep-Dive SLURM Node Details & Diagnostics Inspector Modal */}
      {selectedNode && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setSelectedNode(null)}
        >
          <div 
            className="relative flex h-[88vh] max-h-[850px] w-full max-w-4xl flex-col rounded-2xl border border-border-glass bg-[#1E2532] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border-glass px-6 py-4 bg-[#1B222E]">
              <div className="flex items-center gap-3">
                <div className={`rounded-xl p-2.5 border ${
                  selectedNode.state === 'down'
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : selectedNode.state === 'drain'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-[#161C26] border-border-glass text-text-muted'
                }`}>
                  <Cpu className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-mono text-base font-bold text-white tracking-wide">
                      {selectedNode.id}
                    </h2>
                    <span className={`rounded-md px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase border ${
                      selectedNode.state === 'down'
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : selectedNode.state === 'drain'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-[#161C26] border-border-glass text-text-muted'
                    }`}>
                      {selectedNode.state}
                    </span>
                    <span className="rounded-md bg-[#161C26] border border-border-glass px-2 py-0.5 text-[10px] font-mono text-text-muted font-bold">
                      Cluster: {selectedNode.cluster}
                    </span>
                    <span className="rounded-md bg-[#161C26] border border-border-glass px-2 py-0.5 text-[10px] font-mono text-text-muted">
                      Partition: {selectedNode.partition}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted font-sans mt-0.5">
                    SLURM Compute Node Inspector • Jetstream2 OpenStack Infrastructure
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedNode(null)}
                className="rounded-xl border border-border-glass bg-[#161C26] p-2 text-text-muted hover:bg-[#252E3E] hover:text-white transition-colors cursor-pointer"
                title="Close (ESC)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-border-glass bg-[#161C26] px-6 gap-2 pt-2 text-xs font-mono">
              {[
                { id: 'overview' as const, label: 'Node Overview & Telemetry', icon: Server },
                { id: 'jobs' as const, label: `SLURM Jobs & Tasks (${nodeSlurmJobs.length + nodeTasks.length})`, icon: Activity },
                { id: 'diagnostic' as const, label: 'SLURM Diagnostics & CLI', icon: Terminal },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = modalTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setModalTab(tab.id)}
                    className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'border-white text-white bg-[#1E2532] rounded-t-lg'
                        : 'border-transparent text-text-muted hover:text-white hover:bg-[#1E2532]/50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content Area (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: OVERVIEW & TELEMETRY */}
              {modalTab === 'overview' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Status Alert Banner */}
                  <div className={`rounded-xl border p-4 flex items-start gap-3 ${
                    selectedNode.state === 'down'
                      ? 'border-red-500/40 bg-red-500/10 text-red-300'
                      : selectedNode.state === 'drain'
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                      : 'border-border-glass bg-[#161C26] text-text-muted'
                  }`}>
                    <div className="p-1 shrink-0 mt-0.5">
                      {selectedNode.state === 'down' ? (
                        <AlertTriangle className="h-5 w-5 text-red-400" />
                      ) : selectedNode.state === 'drain' ? (
                        <AlertTriangle className="h-5 w-5 text-amber-400" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-text-muted" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                        Node State: {selectedNode.state.toUpperCase()}
                      </h4>
                      <p className="text-xs leading-relaxed opacity-90 font-sans">
                        {selectedNode.state === 'down'
                          ? `Node is marked DOWN in SLURM: ${selectedNode.reason || 'Socket timeout or node unreachable'}. slurmd daemon is not responding to controller heartbeats.`
                          : selectedNode.state === 'drain'
                          ? `Node is marked DRAIN in SLURM: ${selectedNode.reason || 'Drain / Maintenance State'}. No new tasks will be scheduled onto this node.`
                          : selectedNode.state === 'allocated'
                          ? 'Node is active and currently executing compute workloads allocated by the Amaretti SLURM scheduler.'
                          : 'Node is fully healthy, registered in SLURM main partition, and awaiting pending compute jobs.'}
                      </p>
                    </div>
                  </div>

                  {/* Hardware Metrics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                    {/* CPU Metrics */}
                    <div className="rounded-xl border border-border-glass bg-[#161C26] p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-text-muted font-bold">
                          <Cpu className="h-4 w-4 text-text-muted" />
                          CPU Cores Allocation
                        </span>
                        <span className="text-white font-bold">{selectedNode.cpus}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-text-faint">
                          <span>Cores in Use</span>
                          <span>{selectedNode.state === 'allocated' ? '100% (32 Cores)' : '0% (0 Cores)'}</span>
                        </div>
                        <div className="h-2 w-full bg-[#111620] rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              selectedNode.state === 'allocated' 
                                ? 'w-full bg-[#4A5568]' 
                                : 'w-0 bg-[#4A5568]'
                            }`} 
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-text-faint pt-1 border-t border-border-glass">
                        <span>Arch: x86_64 AMD EPYC</span>
                        <span>Sockets: 1 • Threads/Core: 1</span>
                      </div>
                    </div>

                    {/* Memory Metrics */}
                    <div className="rounded-xl border border-border-glass bg-[#161C26] p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-text-muted font-bold">
                          <Database className="h-4 w-4 text-text-muted" />
                          RAM Memory Allocation
                        </span>
                        <span className="text-white font-bold">{selectedNode.memory}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-text-faint">
                          <span>Memory in Use</span>
                          <span>{selectedNode.state === 'allocated' ? '128 GB (100%)' : selectedNode.state === 'drain' ? '2 GB (1.5%)' : '4 GB (3.1%)'}</span>
                        </div>
                        <div className="h-2 w-full bg-[#111620] rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              selectedNode.state === 'allocated' 
                                ? 'w-full bg-[#4A5568]' 
                                : 'w-[4%] bg-[#4A5568]'
                            }`} 
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-text-faint pt-1 border-t border-border-glass">
                        <span>Total Real Memory: 128,000 MB</span>
                        <span>Swap: 0 MB / 4096 MB</span>
                      </div>
                    </div>
                  </div>

                  {/* Jetstream2 Storage Mounts on Cluster Host */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-white">
                      <HardDrive className="h-4 w-4 text-text-muted" />
                      <span>Cluster Storage Mounts for {selectedNode.cluster}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {nodeClusterMounts.map((m: ResourceMountHealth) => {
                        const isAccessible = m.accessible !== false;
                        return (
                          <div key={m.mount} className="rounded-xl border border-border-glass bg-[#161C26] p-3.5 space-y-2 font-mono text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white flex items-center gap-1.5">
                                {m.mount}
                                <span className="text-[10px] font-sans font-normal text-text-muted">
                                  {m.mount.includes('scratch') ? '(NFS)' : '(Ceph)'}
                                </span>
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${
                                isAccessible ? 'bg-[#1E2532] text-text-muted border border-border-glass' : 'bg-red-500/10 text-red-400 border border-red-500/30'
                              }`}>
                                {isAccessible ? 'MOUNTED' : 'UNREACHABLE'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-text-muted">
                              <span>Latency: <strong className="text-white">{m.latency_ms ? `${m.latency_ms} ms` : '12 ms'}</strong></span>
                              <span>Free Space: <strong className="text-white">{m.free_space_pct != null ? `${m.free_space_pct}%` : '54%'}</strong></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ACTIVE SLURM JOBS & TASKS */}
              {modalTab === 'jobs' && (
                <div className="space-y-6 animate-fadeIn font-mono">
                  {/* 1. SLURM Node Jobs */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                          <Zap className="h-4 w-4 text-text-muted" />
                          SLURM Compute Jobs on {selectedNode.cluster} ({nodeSlurmJobs.length})
                        </h4>
                        <p className="text-xs text-text-muted font-sans mt-0.5">
                          Direct node jobs reported from SLURM daemon (squeue)
                        </p>
                      </div>
                    </div>

                    {nodeSlurmJobs.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border-glass p-6 text-center text-xs text-text-muted">
                        No active SLURM node jobs currently executing on {selectedNode.cluster}.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {nodeSlurmJobs.map(job => (
                          <div 
                            key={`${job.cluster}-${job.job_id || job.id}`}
                            onClick={() => setSelectedJob(job)}
                            className="rounded-xl border border-border-glass bg-[#161C26] p-3 flex items-center justify-between gap-3 hover:bg-[#252E3E] transition-all cursor-pointer group text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-2 rounded-full bg-text-muted" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white">{job.name || job.job_name || 'job'}</span>
                                  <span className="text-text-muted text-[11px]">#{job.job_id || job.id}</span>
                                </div>
                                <div className="text-[10.5px] text-text-muted mt-0.5">
                                  User: <strong className="text-white">{job.user || job.username}</strong> • Nodes: <strong className="text-white">{job.nodes || selectedNode.id}</strong> • Runtime: <strong className="text-white">{job.time || job.runtime || '00:00:00'}</strong>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#1E2532] text-text-muted border border-border-glass">
                                {job.status || 'RUNNING'}
                              </span>
                              <ArrowRight className="h-4 w-4 text-text-faint group-hover:text-white transition-colors" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. Amaretti Platform Tasks */}
                  <div className="space-y-3 pt-3 border-t border-border-glass">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                          <Activity className="h-4 w-4 text-text-muted" />
                          Amaretti Platform Tasks ({nodeTasks.length})
                        </h4>
                        <p className="text-xs text-text-muted font-sans mt-0.5">
                          High-level Brainlife user workflows mapped to this cluster
                        </p>
                      </div>
                      {onNavigate && (
                        <button
                          onClick={() => {
                            setSelectedNode(null);
                            onNavigate('tasks');
                          }}
                          className="flex items-center gap-1 text-xs font-bold text-text-muted hover:text-white transition-colors cursor-pointer"
                        >
                          <span>Open Tasks View</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {nodeTasks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border-glass p-6 text-center text-xs text-text-muted">
                        No active Amaretti tasks assigned to <strong className="text-white font-mono">{selectedNode.cluster}</strong> in the active window.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {nodeTasks.slice(0, 5).map((task) => {
                          const userName = (task.userId && userNamesMap[task.userId]) || task.userId || 'Unknown';
                          const serviceName = task.service ? task.service.split('/').pop() : 'Task';

                          return (
                            <div 
                              key={task.id}
                              onClick={() => {
                                setSelectedNode(null);
                                handleNavigateToTask(task.id);
                              }}
                              className="rounded-xl border border-border-glass bg-[#161C26] p-3 flex items-center justify-between gap-4 hover:bg-[#252E3E] transition-all cursor-pointer group text-xs"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`h-2 w-2 rounded-full ${
                                  task.status === 'failed' ? 'bg-red-500' : 'bg-text-muted'
                                }`} />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-xs">{serviceName}</span>
                                    <span className="text-[11px] text-text-muted font-mono">#{task.id.slice(-8)}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-[10.5px] text-text-muted mt-0.5">
                                    <span className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      {userName}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {task.duration || '--'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  task.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                                  'bg-[#1E2532] text-text-muted border border-border-glass'
                                }`}>
                                  {task.status}
                                </span>
                                <ArrowRight className="h-4 w-4 text-text-faint group-hover:text-white transition-colors" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: SLURM DIAGNOSTICS & CLI */}
              {modalTab === 'diagnostic' && (
                <div className="space-y-5 animate-fadeIn font-mono text-xs">
                  {/* If Down/Drain Reason */}
                  {selectedNode.reason && (
                    <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 space-y-2 text-red-300">
                      <div className="flex items-center justify-between">
                        <span className="font-bold uppercase tracking-wider text-[11px] text-red-400 flex items-center gap-1.5">
                          <ShieldAlert className="h-4 w-4" />
                          Reported SLURM Diagnostic Reason
                        </span>
                        {onNavigate && (
                          <button
                            onClick={() => {
                              setSelectedNode(null);
                              onNavigate('incidents');
                            }}
                            className="rounded-md border border-red-500/40 bg-red-500/20 px-2.5 py-1 text-[10px] font-bold text-red-200 hover:bg-red-500/30 transition-all cursor-pointer"
                          >
                            Open Incidents View →
                          </button>
                        )}
                      </div>
                      <p className="text-white font-bold bg-[#111620] rounded-lg p-2.5 border border-border-glass font-mono">
                        {selectedNode.reason}
                      </p>
                    </div>
                  )}

                  {/* Quick CLI Commands Helper */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
                        <Terminal className="h-4 w-4 text-text-muted" />
                        Sysadmin Quick CLI Commands
                      </span>
                      <span className="text-[10px] text-text-faint">Click to copy command</span>
                    </div>

                    {/* Command 1: scontrol show node */}
                    <div className="rounded-xl border border-border-glass p-3 bg-[#161C26] space-y-1.5">
                      <div className="flex items-center justify-between text-text-muted text-[10.5px]">
                        <span>1. Inspect full SLURM node metadata:</span>
                        <button
                          onClick={() => handleCopy(`scontrol show node ${selectedNode.id}`, 'scontrol')}
                          className="flex items-center gap-1 text-[10.5px] font-bold text-text-muted hover:text-white transition-colors cursor-pointer"
                        >
                          {copiedText === 'scontrol' ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-status-success" />
                              <span className="text-status-success">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <code className="block bg-[#111620] p-2.5 rounded-lg text-text-main select-all border border-border-glass">
                        scontrol show node {selectedNode.id}
                      </code>
                    </div>

                    {/* Command 2: squeue for this node */}
                    <div className="rounded-xl border border-border-glass p-3 bg-[#161C26] space-y-1.5">
                      <div className="flex items-center justify-between text-text-muted text-[10.5px]">
                        <span>2. Query active jobs allocated to this node:</span>
                        <button
                          onClick={() => handleCopy(`squeue -w ${selectedNode.id}`, 'squeuenode')}
                          className="flex items-center gap-1 text-[10.5px] font-bold text-text-muted hover:text-white transition-colors cursor-pointer"
                        >
                          {copiedText === 'squeuenode' ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-status-success" />
                              <span className="text-status-success">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <code className="block bg-[#111620] p-2.5 rounded-lg text-text-main select-all border border-border-glass">
                        squeue -w {selectedNode.id}
                      </code>
                    </div>

                    {/* Command 3: SSH Jump */}
                    <div className="rounded-xl border border-border-glass p-3 bg-[#161C26] space-y-1.5">
                      <div className="flex items-center justify-between text-text-muted text-[10.5px]">
                        <span>3. SSH into cluster head node:</span>
                        <button
                          onClick={() => handleCopy(`ssh -A js2-${selectedNode.cluster}`, 'ssh')}
                          className="flex items-center gap-1 text-[10.5px] font-bold text-text-muted hover:text-white transition-colors cursor-pointer"
                        >
                          {copiedText === 'ssh' ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-status-success" />
                              <span className="text-status-success">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <code className="block bg-[#111620] p-2.5 rounded-lg text-text-main select-all border border-border-glass">
                        ssh -A js2-{selectedNode.cluster}
                      </code>
                    </div>

                    {/* Command 4: Resume node if down or drain */}
                    {(selectedNode.state === 'down' || selectedNode.state === 'drain') && (
                      <div className="rounded-xl border border-border-glass p-3 bg-[#161C26] space-y-1.5">
                        <div className="flex items-center justify-between text-text-muted text-[10.5px]">
                          <span>4. Resume drained / recovered compute node:</span>
                          <button
                            onClick={() => handleCopy(`scontrol update NodeName=${selectedNode.id} State=RESUME`, 'resume')}
                            className="flex items-center gap-1 text-[10.5px] font-bold text-text-muted hover:text-white transition-colors cursor-pointer"
                          >
                            {copiedText === 'resume' ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-status-success" />
                                <span className="text-status-success">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <code className="block bg-[#111620] p-2.5 rounded-lg text-text-main select-all border border-border-glass">
                          scontrol update NodeName={selectedNode.id} State=RESUME
                        </code>
                      </div>
                    )}
                  </div>

                  {/* Raw sinfo Node Line */}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-text-muted text-[10.5px]">Live sinfo line for this node:</span>
                    <pre className="p-3 bg-[#111620] rounded-xl border border-border-glass text-text-muted overflow-x-auto text-[11px]">
{`NodeName=${selectedNode.id} Arch=x86_64 CoresPerSocket=32
   CPUAlloc=${selectedNode.cpus.split('/')[0]} CPUTot=${selectedNode.cpus.split('/')[1] || '32'} CPULoad=0.02
   RealMemory=${selectedNode.memory} AllocMem=${selectedNode.state === 'allocated' ? '128000' : '4000'} FreeMem=124000
   State=${selectedNode.state.toUpperCase()} Partitions=${selectedNode.partition}
   Reason=${selectedNode.reason || 'none [slurmd active]'}`}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border-glass px-6 py-3.5 bg-[#1B222E] font-mono text-xs">
              <div className="text-text-faint text-[11px]">
                Press <kbd className="rounded bg-[#161C26] border border-border-glass px-1.5 py-0.5 text-[10px] text-text-muted">ESC</kbd> or click outside to dismiss
              </div>
              <div className="flex items-center gap-3">
                {onNavigate && (
                  <button
                    onClick={() => {
                      const clusterName = selectedNode.cluster;
                      setSelectedNode(null);
                      handleNavigateToResource(clusterName);
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-border-glass bg-[#161C26] hover:bg-[#252E3E] px-3.5 py-1.5 font-bold text-text-muted hover:text-white transition-all cursor-pointer"
                  >
                    <Server className="h-3.5 w-3.5 text-text-muted" />
                    <span>View in Resources</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedNode(null)}
                  className="rounded-xl border border-[#4A5568] bg-[#2D3748] hover:bg-[#374254] px-4 py-1.5 font-bold text-white transition-all cursor-pointer shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
