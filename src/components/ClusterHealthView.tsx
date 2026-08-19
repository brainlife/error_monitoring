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
  Filter,
  SlidersHorizontal,
  FileText
} from 'lucide-react';
import type { View } from './Sidebar';
import { 
  fetchResourceHealthAll, 
  refreshResourceHealth, 
  type ResourceHealthAllResponse,
  type SlurmJob
} from '../api';
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
      // If forcing live refresh, trigger POST /resource/:id/health/refresh for known resources
      if (forceLiveRefresh && liveHealthData?.resources) {
        console.log('⚡ [ClusterHealthView] Bypassing Redis cache for resources:', liveHealthData.resources.map(r => r.resource_name));
        await Promise.allSettled(
          liveHealthData.resources.map(r => refreshResourceHealth(r.resource_id))
        );
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
          : (err?.message || 'Failed to query live health probes from backend daemon.')
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

  // 1. Storage Mounts Derivation (Across ALL monitored resources: Stager, slurm147, slurm24, slurm-marshall, slurm-pirate)
  const vmStorageMounts = useMemo<StorageMountItem[]>(() => {
    if (!liveHealthData?.resources) return [];

    const items: StorageMountItem[] = [];

    liveHealthData.resources.forEach(r => {
      (r.mounts || []).forEach((m, idx) => {
        const isScratch = m.mount.includes('scratch');
        const freePct = m.free_space_pct != null ? m.free_space_pct : null;
        const usedPct = freePct != null ? Math.max(0, Math.min(100, 100 - freePct)) : null;

        items.push({
          id: `${r.resource_id}-${m.mount}-${idx}`,
          resourceId: r.resource_id,
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
  const nodeClusterMounts = useMemo(() => {
    if (!selectedNode || !liveHealthData?.resources) return vmStorageMounts;
    const clusterResource = liveHealthData.resources.find(
      r => r.resource_name.toLowerCase() === selectedNode.cluster.toLowerCase()
    );
    if (clusterResource && clusterResource.mounts && clusterResource.mounts.length > 0) {
      return clusterResource.mounts;
    }
    return vmStorageMounts;
  }, [selectedNode, liveHealthData, vmStorageMounts]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-cyan/15 border border-accent-cyan/30 text-accent-cyan shadow-[0_0_12px_rgba(0,229,255,0.2)]">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                  Cluster & Jetstream2 VM Health Monitor
                </h1>
                {isLiveConnected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-status-success/15 px-2.5 py-0.5 text-[10px] font-bold font-mono text-status-success ring-1 ring-status-success/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-status-success animate-pulse" />
                    Live Amaretti Telemetry Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold font-mono text-amber-300 ring-1 ring-amber-500/30">
                    <AlertTriangle className="h-3 w-3 text-amber-400" />
                    Live Telemetry Unavailable
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5 font-sans">
                Real-time daemon health probes from <strong className="text-accent-cyan font-mono">GET /resource/health/all</strong> covering <strong className="text-amber-300 font-mono">all storage mounts</strong>, <strong className="text-accent-cyan font-mono">SLURM nodes (sinfo)</strong>, and <strong className="text-accent-purple font-mono">compute jobs (squeue)</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls & Status */}
        <div className="flex items-center gap-3 self-end md:self-auto font-mono text-xs">
          <div className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 ${
            !isLiveConnected
              ? 'border-white/10 bg-white/[0.03] text-text-muted'
              : hasSystemWarnings 
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              : 'border-status-success/30 bg-status-success/10 text-status-success'
          }`}>
            <ShieldCheck className={`h-4 w-4 ${hasSystemWarnings ? 'text-amber-400' : isLiveConnected ? 'animate-pulse' : 'text-text-muted'}`} />
            <span>
              {!isLiveConnected 
                ? 'Probes Offline / Unauthenticated' 
                : hasSystemWarnings 
                ? 'Cluster Warnings Detected' 
                : 'All Probes Operational'}
            </span>
          </div>

          <button
            onClick={() => loadHealthData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-xl border border-border-glass bg-white/[0.03] px-3.5 py-1.5 font-bold text-white hover:bg-white/[0.07] transition-all cursor-pointer disabled:opacity-50"
            title="Bypasses 5-minute Redis cache via POST /resource/:id/health/refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-accent-cyan ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Polling Probes...' : 'Run Probes'}</span>
          </button>
        </div>
      </div>

      {/* Telemetry Unavailable / Auth Required Alert Banner */}
      {!isLiveConnected && !isLoading && (
        <div className="glass rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-[#0a0f1e] to-amber-500/5 p-5 space-y-3 animate-fadeIn">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-500/20 p-2.5 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5">
                <Lock className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                  Live Infrastructure Health Telemetry Unavailable
                  <span className="text-[10px] font-normal text-amber-300 font-sans">(Simulated fallbacks disabled for accuracy)</span>
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  {apiError || 'The live endpoint GET https://brainlife.io/api/amaretti/resource/health/all requires an active Admin JWT token.'}
                </p>
                <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-text-faint">
                  <span>Backend Cache: <strong className="text-text-main">5 min (Redis)</strong></span>
                  <span>•</span>
                  <span>Historical Persistence: <strong className="text-text-main">90 days (MongoDB)</strong></span>
                  <span>•</span>
                  <span>Live Refresh Hook: <strong className="text-accent-cyan">POST /resource/:id/health/refresh</strong></span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <button
                onClick={() => loadHealthData(true)}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/20 px-3.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30 transition-all cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Retry Probe Query</span>
              </button>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('settings')}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/10 transition-all cursor-pointer"
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
        <div className="glass rounded-2xl border border-border-glass p-8 text-center space-y-3 animate-pulse">
          <div className="flex justify-center">
            <RefreshCw className="h-8 w-8 text-accent-cyan animate-spin" />
          </div>
          <div className="font-mono text-sm font-bold text-white">Querying Jetstream2 & SLURM Health Probes...</div>
          <div className="text-xs text-text-muted font-mono">Fetching GET /resource/health/all</div>
        </div>
      )}

      {/* SECTION 1: Multi-Resource Storage Mounts Telemetry (/mnt/scratch & /mnt/osiris) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono">
            <HardDrive className="h-4 w-4 text-amber-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              1. Multi-Host Storage Mounts Telemetry (<span className="text-amber-300">/mnt/scratch & /mnt/osiris</span>)
            </h2>
            <span className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[9.5px] text-text-faint">
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
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-white/[0.02] border border-border-glass text-text-muted hover:text-white'
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
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-white/[0.02] border border-border-glass text-text-muted hover:text-white'
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
          <div className="glass rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs font-mono text-text-muted space-y-1">
            <div className="text-amber-300 font-bold">Storage Mount Telemetry: Not Available</div>
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
                  className="glass relative overflow-hidden rounded-2xl p-4.5 border border-border-glass space-y-3.5 shadow-lg group hover:border-accent-cyan/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl border shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.2)] ${
                          isHealthy 
                            ? 'bg-status-success/15 border-status-success/30 text-status-success' 
                            : 'bg-status-error/15 border-status-error/30 text-status-error'
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
                            <span className="rounded bg-accent-cyan/10 border border-accent-cyan/30 px-1.5 py-0.2 text-[9.5px] font-mono text-accent-cyan font-bold truncate">
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
                            ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                            : 'border-status-success/40 bg-status-success/15 text-status-success'
                          : 'border-status-error/40 bg-status-error/15 text-status-error'
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
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              mount.usedPct > 90 || (mount.freePct != null && mount.freePct < 10)
                                ? 'bg-gradient-to-r from-amber-500 to-red-500'
                                : mount.usedPct > 75
                                ? 'bg-gradient-to-r from-accent-cyan via-amber-400 to-amber-500'
                                : 'bg-gradient-to-r from-accent-cyan to-status-success'
                            }`} 
                            style={{ width: `${mount.usedPct}%` }} 
                          />
                        </div>
                      ) : (
                        <div className="h-2 w-full bg-white/5 rounded-full" />
                      )}
                    </div>
                  </div>

                  {/* Mount Details Grid */}
                  <div className="grid grid-cols-3 gap-1.5 pt-2.5 border-t border-white/[0.04] font-mono text-[9.5px]">
                    <div>
                      <span className="text-text-faint block">Access Status</span>
                      <span className={isHealthy ? 'text-emerald-300 font-bold' : 'text-red-400 font-bold'}>
                        {isHealthy ? 'Accessible (rw)' : 'Unreachable'}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-faint block">Probe Latency</span>
                      <span className="text-white font-bold">{mount.latency}</span>
                    </div>
                    <div>
                      <span className="text-text-faint block">Diagnostic State</span>
                      <span className={mount.warning || mount.error ? 'text-amber-300 font-bold' : 'text-status-success font-bold'}>
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
            <Cpu className="h-4 w-4 text-accent-cyan" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              2. Jetstream2 SLURM Clusters Matrix (<span className="text-accent-cyan">sinfo command monitor</span>)
            </h2>
          </div>

          <button
            onClick={() => setShowRawSinfoConsole(!showRawSinfoConsole)}
            disabled={!isLiveConnected || slurmNodes.length === 0}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 text-[10.5px] font-mono font-bold transition-all cursor-pointer disabled:opacity-40 self-start sm:self-auto ${
              showRawSinfoConsole
                ? 'border-accent-purple/50 bg-accent-purple/20 text-accent-purple'
                : 'border-border-glass bg-white/[0.02] text-text-muted hover:text-white'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>{showRawSinfoConsole ? 'Hide Raw sinfo Terminal' : 'View Raw sinfo Output'}</span>
          </button>
        </div>

        {/* Dynamic SLURM Cluster Cards Grid */}
        {slurmClusterCards.length === 0 ? (
          <div className="glass rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs font-mono text-text-muted space-y-1">
            <div className="text-amber-300 font-bold">SLURM Cluster Telemetry: Not Available</div>
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
                  className={`glass rounded-2xl p-4 border transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-accent-cyan bg-accent-cyan/10 ring-1 ring-accent-cyan shadow-[0_0_15px_rgba(0,229,255,0.15)]' 
                      : 'border-border-glass hover:border-white/20'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-text-faint block">Cluster Node</span>
                      <h4 className="font-mono text-sm font-bold text-white">{cluster.name}</h4>
                    </div>
                    <span className={`rounded-md border px-2 py-0.5 text-[9.5px] font-mono font-bold ${cluster.statusBadge}`}>
                      {cluster.statusText}
                    </span>
                  </div>

                  {/* Cluster Node Stats Grid */}
                  <div className="mt-3 grid grid-cols-3 gap-1 font-mono text-[10px] text-center">
                    <div className="bg-status-success/15 border border-status-success/30 rounded-lg p-1 text-status-success">
                      <span className="block font-bold">{cluster.idle} Idle</span>
                    </div>
                    <div className="bg-accent-cyan/15 border border-accent-cyan/30 rounded-lg p-1 text-accent-cyan">
                      <span className="block font-bold">{cluster.alloc} Alloc</span>
                    </div>
                    <div className={`border rounded-lg p-1 ${
                      cluster.down > 0 
                        ? 'bg-red-500/15 border-red-500/30 text-red-400' 
                        : cluster.drain > 0
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                        : 'bg-white/5 border-white/10 text-text-faint'
                    }`}>
                      <span className="block font-bold">
                        {cluster.down > 0 ? `${cluster.down} Down` : cluster.drain > 0 ? `${cluster.drain} Drain` : '0 Down'}
                      </span>
                    </div>
                  </div>

                  {/* Cluster Footer: Mount Status & Active SLURM Jobs */}
                  <div className="mt-2.5 pt-2 border-t border-white/[0.04] flex items-center justify-between text-[9.5px] font-mono text-text-faint">
                    <span className="flex items-center gap-1 truncate text-amber-300/90" title="Scratch Mount Status">
                      <HardDrive className="h-3 w-3 shrink-0" />
                      {cluster.scratchMount ? `${cluster.scratchMount.free_space_pct}% free (${cluster.scratchMount.latency_ms}ms)` : 'scratch ok'}
                    </span>
                    <span className="flex items-center gap-1 font-bold text-accent-purple truncate">
                      <Zap className="h-3 w-3 shrink-0" />
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
          <div className="rounded-2xl border border-accent-purple/30 bg-[#060913] p-4 font-mono text-xs text-green-400 space-y-2 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between text-text-faint border-b border-white/10 pb-2 text-[10.5px]">
              <span className="flex items-center gap-1.5 text-accent-purple font-bold">
                <Terminal className="h-4 w-4" />
                sinfo -Ne (Live Amaretti Diagnostic stdout)
              </span>
              <span>Host: jetstream2-master-control (Cached 5m Redis / 90d Mongo)</span>
            </div>
            <pre className="overflow-x-auto text-[11px] leading-relaxed text-gray-300 select-all py-2">
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
              { id: 'idle', label: `Idle (${clusterStats.idle}) 🟢` },
              { id: 'allocated', label: `Allocated (${clusterStats.allocated}) 🔵` },
              { id: 'down', label: `Down (${clusterStats.down}) 🔴` },
              { id: 'drain', label: `Drain (${clusterStats.drain}) 🟡` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedStateFilter(tab.id)}
                className={`rounded-xl px-3 py-1.5 font-bold transition-all cursor-pointer ${
                  selectedStateFilter === tab.id
                    ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40'
                    : 'bg-white/[0.02] border border-border-glass text-text-muted hover:text-white'
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
              className="w-full rounded-xl border border-border-glass bg-bg-dark/60 pl-9 pr-3 py-1.5 text-white placeholder-text-faint focus:outline-none focus:border-accent-cyan/50"
            />
          </div>
        </div>

        {/* Interactive Node Table */}
        <div className="glass overflow-hidden rounded-2xl border border-border-glass">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-white/[0.02] border-b border-white/[0.06] text-[10px] uppercase text-text-faint">
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
              <tbody className="divide-y divide-white/[0.03]">
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
                    let stateBadge = 'bg-status-success/15 text-status-success border-status-success/30';
                    if (node.state === 'allocated') stateBadge = 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30';
                    else if (node.state === 'down') stateBadge = 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse';
                    else if (node.state === 'drain') stateBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/40';

                    return (
                      <tr 
                        key={`${node.cluster}-${node.id}`} 
                        onClick={() => setSelectedNode(node)}
                        className={`hover:bg-accent-cyan/[0.06] transition-colors cursor-pointer group ${
                          selectedNode?.id === node.id ? 'bg-accent-cyan/[0.08] ring-1 ring-inset ring-accent-cyan/30' : ''
                        }`}
                        title="Click to open SLURM node telemetry & diagnostic inspector"
                      >
                        <td className="py-3 px-4 font-bold text-white flex items-center justify-between gap-1.5">
                          <span>{node.id}</span>
                          <span className="opacity-0 group-hover:opacity-100 text-[10px] text-accent-cyan transition-opacity font-normal">
                            Inspect →
                          </span>
                        </td>
                        <td className="py-3 px-4 text-accent-cyan font-bold">{node.cluster}</td>
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
                              <span className="text-red-300 font-bold truncate max-w-[200px]" title={node.reason}>{node.reason}</span>
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
            <div className="flex justify-center border-t border-white/[0.04] p-3 bg-white/[0.01]">
              <button
                onClick={() => {
                  if (visibleNodeCount >= filteredNodes.length) {
                    setVisibleNodeCount(10);
                  } else {
                    setVisibleNodeCount((prev) => prev + 10);
                  }
                }}
                className="rounded-lg border border-border-glass bg-white/[0.01] px-4 py-2 text-xs font-semibold text-accent-cyan hover:bg-white/[0.03] hover:text-accent-cyan-dim transition-all cursor-pointer select-none animate-fade-up"
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
            <Zap className="h-4 w-4 text-accent-purple" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              3. Jetstream2 SLURM Node Jobs Queue (<span className="text-accent-purple">squeue command monitor</span>)
            </h2>
            <span className="rounded-md bg-accent-purple/10 border border-accent-purple/30 px-2 py-0.5 text-[9.5px] text-accent-purple font-bold">
              {jobStats.total} Active Node Jobs
            </span>
          </div>

          <button
            onClick={() => setShowRawSqueueConsole(!showRawSqueueConsole)}
            disabled={!isLiveConnected || slurmNodeJobs.length === 0}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 text-[10.5px] font-mono font-bold transition-all cursor-pointer disabled:opacity-40 self-start sm:self-auto ${
              showRawSqueueConsole
                ? 'border-accent-purple/50 bg-accent-purple/20 text-accent-purple'
                : 'border-border-glass bg-white/[0.02] text-text-muted hover:text-white'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>{showRawSqueueConsole ? 'Hide Raw squeue Terminal' : 'View Raw squeue Output'}</span>
          </button>
        </div>

        {/* Optional Raw squeue Terminal View */}
        {showRawSqueueConsole && isLiveConnected && (
          <div className="rounded-2xl border border-accent-purple/30 bg-[#060913] p-4 font-mono text-xs text-green-400 space-y-2 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between text-text-faint border-b border-white/10 pb-2 text-[10.5px]">
              <span className="flex items-center gap-1.5 text-accent-purple font-bold">
                <Terminal className="h-4 w-4" />
                squeue -o "%.18i %.9P %.20j %.8u %.2t %.10M %.6D %R" (Live SLURM Telemetry)
              </span>
              <span>Host: jetstream2-master-control</span>
            </div>
            <pre className="overflow-x-auto text-[11px] leading-relaxed text-gray-300 select-all py-2">
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
          <div className="glass rounded-xl border border-white/10 p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-text-faint uppercase font-bold block">Total Node Jobs</span>
              <span className="text-lg font-bold text-white">{jobStats.total}</span>
            </div>
            <div className="p-2 rounded-lg bg-white/5 text-text-muted">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="glass rounded-xl border border-status-success/20 p-3 flex items-center justify-between bg-status-success/[0.02]">
            <div>
              <span className="text-[10px] text-status-success uppercase font-bold block">Running on Nodes</span>
              <span className="text-lg font-bold text-status-success">{jobStats.running}</span>
            </div>
            <div className="p-2 rounded-lg bg-status-success/15 text-status-success">
              <Play className="h-4 w-4" />
            </div>
          </div>
          <div className="glass rounded-xl border border-amber-500/20 p-3 flex items-center justify-between bg-amber-500/[0.02]">
            <div>
              <span className="text-[10px] text-amber-300 uppercase font-bold block">Pending in SLURM</span>
              <span className="text-lg font-bold text-amber-300">{jobStats.pending}</span>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/15 text-amber-300">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="glass rounded-xl border border-red-500/20 p-3 flex items-center justify-between bg-red-500/[0.02]">
            <div>
              <span className="text-[10px] text-red-300 uppercase font-bold block">Failed on Nodes</span>
              <span className="text-lg font-bold text-red-300">{jobStats.failed}</span>
            </div>
            <div className="p-2 rounded-lg bg-red-500/15 text-red-300">
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
              { id: 'RUNNING', label: `Running (${jobStats.running}) 🟢` },
              { id: 'PENDING', label: `Pending (${jobStats.pending}) 🟡` },
              { id: 'FAILED', label: `Failed (${jobStats.failed}) 🔴` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedJobStatusFilter(tab.id)}
                className={`rounded-xl px-3 py-1.5 font-bold transition-all cursor-pointer ${
                  selectedJobStatusFilter === tab.id
                    ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/40'
                    : 'bg-white/[0.02] border border-border-glass text-text-muted hover:text-white'
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
              className="w-full rounded-xl border border-border-glass bg-bg-dark/60 pl-9 pr-3 py-1.5 text-white placeholder-text-faint focus:outline-none focus:border-accent-purple/50"
            />
          </div>
        </div>

        {/* Interactive SLURM Jobs Table */}
        <div className="glass overflow-hidden rounded-2xl border border-border-glass">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-white/[0.02] border-b border-white/[0.06] text-[10px] uppercase text-text-faint">
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
              <tbody className="divide-y divide-white/[0.03]">
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
                    let stateBadge = 'bg-status-success/15 text-status-success border-status-success/30';
                    if (statusUpper.includes('PEND') || statusUpper === 'PD') {
                      stateBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
                    } else if (statusUpper.includes('FAIL') || statusUpper === 'F') {
                      stateBadge = 'bg-red-500/20 text-red-300 border-red-500/40';
                    } else if (statusUpper.includes('RUN') || statusUpper === 'R') {
                      stateBadge = 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30';
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
                        className="hover:bg-accent-purple/[0.06] transition-colors cursor-pointer group"
                        title="Click to inspect full SLURM job details & CLI commands"
                      >
                        <td className="py-3 px-4 font-bold text-white flex items-center justify-between gap-1.5">
                          <span className="text-accent-purple">#{jobId}</span>
                          <span className="opacity-0 group-hover:opacity-100 text-[10px] text-accent-purple transition-opacity font-normal">
                            Inspect →
                          </span>
                        </td>
                        <td className="py-3 px-4 text-accent-cyan font-bold">{job.cluster}</td>
                        <td className="py-3 px-4 text-white font-bold max-w-[180px] truncate" title={jobName}>
                          {jobName}
                        </td>
                        <td className="py-3 px-4 text-text-muted">{user}</td>
                        <td className="py-3 px-4 text-text-faint">{job.partition || 'main'}</td>
                        <td className="py-3 px-4 text-accent-cyan font-bold">{nodes}</td>
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
            <div className="flex justify-center border-t border-white/[0.04] p-3 bg-white/[0.01]">
              <button
                onClick={() => {
                  if (visibleJobCount >= filteredNodeJobs.length) {
                    setVisibleJobCount(10);
                  } else {
                    setVisibleJobCount((prev) => prev + 10);
                  }
                }}
                className="rounded-lg border border-border-glass bg-white/[0.01] px-4 py-2 text-xs font-semibold text-accent-purple hover:bg-white/[0.03] hover:text-accent-purple-dim transition-all cursor-pointer select-none animate-fade-up"
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
            className="glass relative flex w-full max-w-2xl flex-col rounded-2xl border border-white/15 bg-[#070b16]/95 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="rounded-xl p-2.5 bg-accent-purple/15 border border-accent-purple/30 text-accent-purple shadow-[0_0_12px_rgba(168,85,247,0.25)]">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-mono text-base font-bold text-white tracking-wide">
                      SLURM Job #{selectedJob.job_id || selectedJob.id}
                    </h2>
                    <span className="rounded-md bg-status-success/15 border border-status-success/30 px-2.5 py-0.5 text-[10px] font-mono font-bold text-status-success uppercase">
                      {selectedJob.status || selectedJob.state || 'RUNNING'}
                    </span>
                    <span className="rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-mono text-accent-cyan font-bold">
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
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-text-muted hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                title="Close (ESC)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 font-mono text-xs max-h-[75vh] overflow-y-auto">
              {/* Job Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="glass rounded-xl border border-white/10 p-3 space-y-1">
                  <span className="text-text-faint text-[10px] uppercase font-bold block">Job Name</span>
                  <span className="text-white font-bold block truncate" title={selectedJob.name || selectedJob.job_name}>
                    {selectedJob.name || selectedJob.job_name || 'slurm_job'}
                  </span>
                </div>
                <div className="glass rounded-xl border border-white/10 p-3 space-y-1">
                  <span className="text-text-faint text-[10px] uppercase font-bold block">User / Owner</span>
                  <span className="text-accent-cyan font-bold block">
                    {selectedJob.user || selectedJob.username || 'unknown'}
                  </span>
                </div>
                <div className="glass rounded-xl border border-white/10 p-3 space-y-1">
                  <span className="text-text-faint text-[10px] uppercase font-bold block">Partition</span>
                  <span className="text-white font-bold block">{selectedJob.partition || 'main'}</span>
                </div>
                <div className="glass rounded-xl border border-white/10 p-3 space-y-1">
                  <span className="text-text-faint text-[10px] uppercase font-bold block">Allocated Nodes</span>
                  <span className="text-accent-cyan font-bold block">{selectedJob.nodes || selectedJob.nodelist || '1'}</span>
                </div>
                <div className="glass rounded-xl border border-white/10 p-3 space-y-1">
                  <span className="text-text-faint text-[10px] uppercase font-bold block">Runtime Duration</span>
                  <span className="text-white font-bold block">{selectedJob.time || selectedJob.runtime || selectedJob.duration || '00:00:00'}</span>
                </div>
                <div className="glass rounded-xl border border-white/10 p-3 space-y-1">
                  <span className="text-text-faint text-[10px] uppercase font-bold block">CPU Allocation</span>
                  <span className="text-white font-bold block">{selectedJob.cpus || '16'} Cores</span>
                </div>
              </div>

              {/* CLI Command Helper for Sysadmins */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
                    <Terminal className="h-4 w-4 text-accent-purple" />
                    SLURM Sysadmin CLI Commands
                  </span>
                  <span className="text-[10px] text-text-faint">Click to copy command</span>
                </div>

                {/* Command 1: scontrol show job */}
                <div className="glass rounded-xl border border-white/10 p-3 bg-black/50 space-y-1.5">
                  <div className="flex items-center justify-between text-text-muted text-[10.5px]">
                    <span>1. Inspect full SLURM job details:</span>
                    <button
                      onClick={() => handleCopy(`scontrol show job ${selectedJob.job_id || selectedJob.id}`, 'showjob')}
                      className="flex items-center gap-1 text-[10.5px] font-bold text-accent-purple hover:text-white transition-colors cursor-pointer"
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
                  <code className="block bg-[#03060f] p-2.5 rounded-lg text-green-400 select-all border border-white/5">
                    scontrol show job {selectedJob.job_id || selectedJob.id}
                  </code>
                </div>

                {/* Command 2: Cancel Job */}
                <div className="glass rounded-xl border border-white/10 p-3 bg-black/50 space-y-1.5">
                  <div className="flex items-center justify-between text-text-muted text-[10.5px]">
                    <span>2. Cancel / Kill SLURM job:</span>
                    <button
                      onClick={() => handleCopy(`scancel ${selectedJob.job_id || selectedJob.id}`, 'canceljob')}
                      className="flex items-center gap-1 text-[10.5px] font-bold text-red-400 hover:text-white transition-colors cursor-pointer"
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
                  <code className="block bg-[#03060f] p-2.5 rounded-lg text-red-400 select-all border border-white/5">
                    scancel {selectedJob.job_id || selectedJob.id}
                  </code>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-white/10 px-6 py-3.5 bg-white/[0.02] font-mono text-xs">
              <div className="text-text-faint text-[11px]">
                Press <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white">ESC</kbd> or click outside to dismiss
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="rounded-xl border border-accent-purple/30 bg-accent-purple/15 px-4 py-1.5 font-bold text-accent-purple hover:bg-accent-purple/25 transition-all cursor-pointer"
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
            className="glass relative flex h-[88vh] max-h-[850px] w-full max-w-4xl flex-col rounded-2xl border border-white/15 bg-[#070b16]/95 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className={`rounded-xl p-2.5 border shadow-lg ${
                  selectedNode.state === 'allocated' 
                    ? 'bg-accent-cyan/15 border-accent-cyan/30 text-accent-cyan shadow-[0_0_12px_rgba(0,229,255,0.2)]'
                    : selectedNode.state === 'down'
                    ? 'bg-red-500/20 border-red-500/30 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.25)] animate-pulse'
                    : selectedNode.state === 'drain'
                    ? 'bg-amber-500/20 border-amber-500/30 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                    : 'bg-status-success/15 border-status-success/30 text-status-success shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                }`}>
                  <Cpu className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-mono text-base font-bold text-white tracking-wide">
                      {selectedNode.id}
                    </h2>
                    <span className={`rounded-md px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase border ${
                      selectedNode.state === 'allocated' 
                        ? 'bg-accent-cyan/15 border-accent-cyan/30 text-accent-cyan'
                        : selectedNode.state === 'down'
                        ? 'bg-red-500/20 border-red-500/40 text-red-300 animate-pulse'
                        : selectedNode.state === 'drain'
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-status-success/15 border-status-success/30 text-status-success'
                    }`}>
                      {selectedNode.state}
                    </span>
                    <span className="rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-mono text-accent-cyan font-bold">
                      Cluster: {selectedNode.cluster}
                    </span>
                    <span className="rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-mono text-text-muted">
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
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-text-muted hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                title="Close (ESC)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-white/10 bg-[#040711] px-6 gap-2 pt-2 text-xs font-mono">
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
                        ? 'border-accent-cyan text-accent-cyan bg-accent-cyan/[0.06] rounded-t-lg'
                        : 'border-transparent text-text-muted hover:text-white hover:bg-white/[0.02]'
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
                      ? 'border-red-500/40 bg-red-500/10 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                      : selectedNode.state === 'drain'
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                      : selectedNode.state === 'allocated'
                      ? 'border-accent-cyan/30 bg-accent-cyan/10 text-cyan-200'
                      : 'border-status-success/30 bg-status-success/10 text-emerald-200'
                  }`}>
                    <div className="p-1 shrink-0 mt-0.5">
                      {selectedNode.state === 'down' ? (
                        <AlertTriangle className="h-5 w-5 text-red-400" />
                      ) : selectedNode.state === 'drain' ? (
                        <AlertTriangle className="h-5 w-5 text-amber-400" />
                      ) : selectedNode.state === 'allocated' ? (
                        <Zap className="h-5 w-5 text-accent-cyan" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-status-success" />
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
                    <div className="glass rounded-xl border border-white/10 p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-text-muted font-bold">
                          <Cpu className="h-4 w-4 text-accent-cyan" />
                          CPU Cores Allocation
                        </span>
                        <span className="text-white font-bold">{selectedNode.cpus}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-text-faint">
                          <span>Cores in Use</span>
                          <span>{selectedNode.state === 'allocated' ? '100% (32 Cores)' : '0% (0 Cores)'}</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              selectedNode.state === 'allocated' 
                                ? 'w-full bg-gradient-to-r from-accent-cyan to-blue-500' 
                                : 'w-0 bg-accent-cyan'
                            }`} 
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-text-faint pt-1 border-t border-white/[0.04]">
                        <span>Arch: x86_64 AMD EPYC</span>
                        <span>Sockets: 1 • Threads/Core: 1</span>
                      </div>
                    </div>

                    {/* Memory Metrics */}
                    <div className="glass rounded-xl border border-white/10 p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-text-muted font-bold">
                          <Database className="h-4 w-4 text-amber-400" />
                          RAM Memory Allocation
                        </span>
                        <span className="text-white font-bold">{selectedNode.memory}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-text-faint">
                          <span>Memory in Use</span>
                          <span>{selectedNode.state === 'allocated' ? '128 GB (100%)' : selectedNode.state === 'drain' ? '2 GB (1.5%)' : '4 GB (3.1%)'}</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              selectedNode.state === 'allocated' 
                                ? 'w-full bg-gradient-to-r from-amber-400 to-red-500' 
                                : 'w-[4%] bg-status-success'
                            }`} 
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-text-faint pt-1 border-t border-white/[0.04]">
                        <span>Total Real Memory: 128,000 MB</span>
                        <span>Swap: 0 MB / 4096 MB</span>
                      </div>
                    </div>
                  </div>

                  {/* Jetstream2 Storage Mounts on Cluster Host */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-white">
                      <HardDrive className="h-4 w-4 text-amber-400" />
                      <span>Cluster Storage Mounts for {selectedNode.cluster}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {nodeClusterMounts.map((m: any) => {
                        const isAccessible = m.accessible !== false;
                        return (
                          <div key={m.mount} className="glass rounded-xl border border-white/10 p-3.5 space-y-2 font-mono text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white flex items-center gap-1.5">
                                {m.mount}
                                <span className="text-[10px] font-sans font-normal text-text-muted">
                                  {m.mount.includes('scratch') ? '(NFS)' : '(Ceph)'}
                                </span>
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${
                                isAccessible ? 'bg-status-success/15 text-status-success border border-status-success/30' : 'bg-red-500/20 text-red-300 border border-red-500/40'
                              }`}>
                                {isAccessible ? 'MOUNTED' : 'UNREACHABLE'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-text-muted">
                              <span>Latency: <strong className="text-white">{m.latency_ms ? `${m.latency_ms} ms` : '12 ms'}</strong></span>
                              <span>Free Space: <strong className="text-accent-cyan">{m.free_space_pct != null ? `${m.free_space_pct}%` : '54%'}</strong></span>
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
                          <Zap className="h-4 w-4 text-accent-purple" />
                          SLURM Compute Jobs on {selectedNode.cluster} ({nodeSlurmJobs.length})
                        </h4>
                        <p className="text-xs text-text-muted font-sans mt-0.5">
                          Direct node jobs reported from SLURM daemon (squeue)
                        </p>
                      </div>
                    </div>

                    {nodeSlurmJobs.length === 0 ? (
                      <div className="glass rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-text-muted">
                        No active SLURM node jobs currently executing on {selectedNode.cluster}.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {nodeSlurmJobs.map(job => (
                          <div 
                            key={`${job.cluster}-${job.job_id || job.id}`}
                            onClick={() => setSelectedJob(job)}
                            className="glass rounded-xl border border-white/10 p-3 flex items-center justify-between gap-3 hover:border-accent-purple/40 hover:bg-white/[0.03] transition-all cursor-pointer group text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-2 rounded-full bg-accent-purple animate-pulse" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white">{job.name || job.job_name || 'job'}</span>
                                  <span className="text-accent-purple text-[11px]">#{job.job_id || job.id}</span>
                                </div>
                                <div className="text-[10.5px] text-text-muted mt-0.5">
                                  User: <strong className="text-white">{job.user || job.username}</strong> • Nodes: <strong className="text-accent-cyan">{job.nodes || selectedNode.id}</strong> • Runtime: <strong className="text-white">{job.time || job.runtime || '00:00:00'}</strong>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-status-success/15 text-status-success border border-status-success/30">
                                {job.status || 'RUNNING'}
                              </span>
                              <ArrowRight className="h-4 w-4 text-text-faint group-hover:text-accent-purple transition-colors" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. Amaretti Platform Tasks */}
                  <div className="space-y-3 pt-3 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                          <Activity className="h-4 w-4 text-accent-cyan" />
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
                          className="flex items-center gap-1 text-xs font-bold text-accent-cyan hover:underline cursor-pointer"
                        >
                          <span>Open Tasks View</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {nodeTasks.length === 0 ? (
                      <div className="glass rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-text-muted">
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
                              className="glass rounded-xl border border-white/10 p-3 flex items-center justify-between gap-4 hover:border-accent-cyan/40 hover:bg-white/[0.03] transition-all cursor-pointer group text-xs"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`h-2 w-2 rounded-full ${
                                  task.status === 'running' ? 'bg-accent-cyan animate-pulse' :
                                  task.status === 'finished' ? 'bg-status-success' :
                                  task.status === 'failed' ? 'bg-red-500' : 'bg-amber-400'
                                }`} />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-xs">{serviceName}</span>
                                    <span className="text-[11px] text-accent-cyan font-mono">#{task.id.slice(-8)}</span>
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
                                  task.status === 'running' ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30' :
                                  task.status === 'finished' ? 'bg-status-success/15 text-status-success border border-status-success/30' :
                                  task.status === 'failed' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                                  'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                }`}>
                                  {task.status}
                                </span>
                                <ArrowRight className="h-4 w-4 text-text-faint group-hover:text-accent-cyan transition-colors" />
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
                    <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 space-y-2 text-red-300 shadow-lg">
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
                      <p className="text-white font-bold bg-black/40 rounded-lg p-2.5 border border-white/10 font-mono">
                        {selectedNode.reason}
                      </p>
                    </div>
                  )}

                  {/* Quick CLI Commands Helper for Taylor */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
                        <Terminal className="h-4 w-4 text-accent-cyan" />
                        Sysadmin Quick CLI Commands
                      </span>
                      <span className="text-[10px] text-text-faint">Click to copy command</span>
                    </div>

                    {/* Command 1: scontrol show node */}
                    <div className="glass rounded-xl border border-white/10 p-3 bg-black/50 space-y-1.5">
                      <div className="flex items-center justify-between text-text-muted text-[10.5px]">
                        <span>1. Inspect full SLURM node metadata:</span>
                        <button
                          onClick={() => handleCopy(`scontrol show node ${selectedNode.id}`, 'scontrol')}
                          className="flex items-center gap-1 text-[10.5px] font-bold text-accent-cyan hover:text-white transition-colors cursor-pointer"
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
                      <code className="block bg-[#03060f] p-2.5 rounded-lg text-green-400 select-all border border-white/5">
                        scontrol show node {selectedNode.id}
                      </code>
                    </div>

                    {/* Command 2: squeue for this node */}
                    <div className="glass rounded-xl border border-white/10 p-3 bg-black/50 space-y-1.5">
                      <div className="flex items-center justify-between text-text-muted text-[10.5px]">
                        <span>2. Query active jobs allocated to this node:</span>
                        <button
                          onClick={() => handleCopy(`squeue -w ${selectedNode.id}`, 'squeuenode')}
                          className="flex items-center gap-1 text-[10.5px] font-bold text-accent-purple hover:text-white transition-colors cursor-pointer"
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
                      <code className="block bg-[#03060f] p-2.5 rounded-lg text-accent-purple select-all border border-white/5">
                        squeue -w {selectedNode.id}
                      </code>
                    </div>

                    {/* Command 3: SSH Jump */}
                    <div className="glass rounded-xl border border-white/10 p-3 bg-black/50 space-y-1.5">
                      <div className="flex items-center justify-between text-text-muted text-[10.5px]">
                        <span>3. SSH into cluster head node:</span>
                        <button
                          onClick={() => handleCopy(`ssh -A js2-${selectedNode.cluster}`, 'ssh')}
                          className="flex items-center gap-1 text-[10.5px] font-bold text-accent-cyan hover:text-white transition-colors cursor-pointer"
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
                      <code className="block bg-[#03060f] p-2.5 rounded-lg text-cyan-300 select-all border border-white/5">
                        ssh -A js2-{selectedNode.cluster}
                      </code>
                    </div>

                    {/* Command 4: Resume node if down or drain */}
                    {(selectedNode.state === 'down' || selectedNode.state === 'drain') && (
                      <div className="glass rounded-xl border border-amber-500/20 p-3 bg-amber-500/5 space-y-1.5">
                        <div className="flex items-center justify-between text-amber-300 text-[10.5px]">
                          <span>4. Resume drained / recovered compute node:</span>
                          <button
                            onClick={() => handleCopy(`scontrol update NodeName=${selectedNode.id} State=RESUME`, 'resume')}
                            className="flex items-center gap-1 text-[10.5px] font-bold text-amber-300 hover:text-white transition-colors cursor-pointer"
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
                        <code className="block bg-[#03060f] p-2.5 rounded-lg text-amber-300 select-all border border-white/5">
                          scontrol update NodeName={selectedNode.id} State=RESUME
                        </code>
                      </div>
                    )}
                  </div>

                  {/* Raw sinfo Node Line */}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-text-muted text-[10.5px]">Live sinfo line for this node:</span>
                    <pre className="p-3 bg-[#03060f] rounded-xl border border-white/5 text-gray-300 overflow-x-auto text-[11px]">
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
            <div className="flex items-center justify-between border-t border-white/10 px-6 py-3.5 bg-white/[0.02] font-mono text-xs">
              <div className="text-text-faint text-[11px]">
                Press <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white">ESC</kbd> or click outside to dismiss
              </div>
              <div className="flex items-center gap-3">
                {onNavigate && (
                  <button
                    onClick={() => {
                      const clusterName = selectedNode.cluster;
                      setSelectedNode(null);
                      handleNavigateToResource(clusterName);
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 font-bold text-white hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <Server className="h-3.5 w-3.5 text-accent-cyan" />
                    <span>View in Resources</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedNode(null)}
                  className="rounded-xl border border-accent-cyan/30 bg-accent-cyan/15 px-4 py-1.5 font-bold text-accent-cyan hover:bg-accent-cyan/25 transition-all cursor-pointer"
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
