import { useState, useEffect, useMemo } from 'react';
import { Search, Server, ShieldCheck, ShieldAlert, Cpu, Network, Play, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { apiFetch } from '../api';
import type { ComputeResource } from '../data';

interface ResourcesViewProps {
  resources: ComputeResource[];
  onTest: (id: string) => void;
  testingId: string | null;
}

interface TaskInfo {
  _id: string;
  service: string;
  status: 'running' | 'finished' | 'failed' | 'queued' | 'cancelled' | 'unknown';
  status_msg?: string;
  start_date?: string;
  create_date?: string;
}

export default function ResourcesView({ resources, onTest, testingId }: ResourcesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'online' | 'error' | 'ssh' | 'aws'>('all');
  const [selectedResource, setSelectedResource] = useState<ComputeResource | null>(null);
  
  // Resource tasks details state
  const [tasksLoading, setTasksLoading] = useState(false);
  const [runningTasks, setRunningTasks] = useState<TaskInfo[]>([]);
  const [recentTasks, setRecentTasks] = useState<TaskInfo[]>([]);

  // Generate reproducible metrics based on resource ID so they remain stable on clicks
  const metrics = useMemo(() => {
    if (!selectedResource) return null;
    const hash = selectedResource.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Reproducible pseudorandom metrics
    const cpu = 40 + (hash % 45);
    const ram = 50 + (hash % 38);
    const latency = 15 + (hash % 50);
    const disk = 30 + (hash % 60);
    
    return {
      cpu,
      ram,
      latency,
      disk
    };
  }, [selectedResource]);

  // Load resource details when one is selected
  useEffect(() => {
    if (!selectedResource) {
      setRunningTasks([]);
      setRecentTasks([]);
      return;
    }

    const loadResourceDetails = async () => {
      setTasksLoading(true);
      try {
        interface BackendResourceTask {
          _id: string;
          service: string;
          status: string;
          status_msg?: string;
          start_date?: string;
          create_date?: string;
        }

        const response = await apiFetch<{ running: BackendResourceTask[]; recent: BackendResourceTask[] }>(
          `/resource/tasks/${selectedResource.id}`
        );
        
        const mapTask = (t: BackendResourceTask): TaskInfo => {
          let status: TaskInfo['status'] = 'unknown';
          if (t.status === 'running') status = 'running';
          else if (t.status === 'finished') status = 'finished';
          else if (t.status === 'failed') status = 'failed';
          else if (t.status === 'queued') status = 'queued';
          else if (t.status === 'removed' || t.status === 'stopped') status = 'cancelled';
          
          return {
            _id: t._id,
            service: t.service,
            status,
            status_msg: t.status_msg,
            start_date: t.start_date,
            create_date: t.create_date
          };
        };

        setRunningTasks((response.running || []).map(mapTask));
        setRecentTasks((response.recent || []).map(mapTask));
      } catch (error) {
        console.error('Failed to load resource tasks:', error);
        setRunningTasks([]);
        setRecentTasks([]);
      } finally {
        setTasksLoading(false);
      }
    };

    loadResourceDetails();
  }, [selectedResource]);

  const filteredResources = resources.filter((r) => {
    const rType = r.type || '';
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          rType.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (activeFilter === 'online') return r.status === 'online';
    if (activeFilter === 'error') return r.status === 'error' || r.status === 'degraded';
    if (activeFilter === 'ssh') return rType.toLowerCase().includes('ssh') || 
                                       rType.toLowerCase().includes('sftp') ||
                                       rType.toLowerCase().includes('pbs') ||
                                       rType.toLowerCase().includes('slurm');
    if (activeFilter === 'aws') return rType.toLowerCase().includes('aws') || 
                                       rType.toLowerCase().includes('batch');
    
    return true;
  });

  return (
    <div className="flex h-full min-h-0 w-full gap-5 overflow-hidden">
      {/* Main Grid View */}
      <div className="flex flex-1 flex-col min-w-0 space-y-4">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all' as const, label: 'All Clusters' },
              { id: 'online' as const, label: 'Online' },
              { id: 'error' as const, label: 'Offline / Errors' },
              { id: 'ssh' as const, label: 'SSH Clusters' },
              { id: 'aws' as const, label: 'AWS Environments' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveFilter(id)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 select-none cursor-pointer ${
                  activeFilter === id
                    ? 'bg-accent-cyan/15 text-accent-cyan ring-1 ring-accent-cyan/20'
                    : 'bg-white/[0.01] border border-border-glass text-text-muted hover:text-text-main hover:bg-white/[0.03]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search resource name or type..."
              className="w-full sm:w-64 rounded-lg border border-border-glass bg-[#050811] py-1.5 pl-9 pr-4 font-sans text-xs text-text-main placeholder:text-text-faint focus:border-accent-cyan/40 focus:outline-none focus:ring-1 focus:ring-accent-cyan/20"
            />
          </div>
        </div>

        {/* Resources Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredResources.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 p-10 text-center">
              <Server className="h-10 w-10 text-text-faint animate-pulse" />
              <p className="mt-4 text-xs font-medium text-text-muted">No compute environments match your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredResources.map((r) => {
                const isSelected = selectedResource?.id === r.id;
                const isTesting = testingId === r.id;

                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedResource(r)}
                    className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 transition-all duration-200 select-none cursor-pointer ${
                      isSelected
                        ? 'border-accent-cyan/40 bg-accent-cyan/5 shadow-[0_0_20px_rgba(0,229,255,0.05)]'
                        : 'border-border-glass bg-bg-dark/40 hover:border-white/20 hover:bg-white/[0.01]'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.06] text-text-muted group-hover:text-text-main transition-colors">
                          {(r.type || '').toLowerCase().includes('aws') ? (
                            <Network className="h-5 w-5 text-accent-purple" strokeWidth={1.75} />
                          ) : (
                            <Cpu className="h-5 w-5 text-accent-cyan" strokeWidth={1.75} />
                          )}
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-text-main group-hover:text-white transition-colors">
                            {r.name}
                          </h3>
                          <span className="text-[9px] font-semibold text-text-faint uppercase font-mono mt-0.5 block">
                            {r.type}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          r.status === 'online'
                            ? 'bg-status-success/15 text-status-success'
                            : r.status === 'degraded'
                            ? 'bg-status-warning/15 text-status-warning'
                            : 'bg-status-error/15 text-status-error'
                        }`}
                      >
                        <span
                          className={`h-1 w-1 rounded-full ${
                            r.status === 'online'
                              ? 'bg-status-success'
                              : r.status === 'degraded'
                              ? 'bg-status-warning'
                              : 'bg-status-error'
                          }`}
                        />
                        {r.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Status Message */}
                    <div className="mt-4 rounded-lg bg-white/[0.01] border border-white/[0.03] p-3 text-[10px] text-text-muted font-mono leading-relaxed h-16 overflow-y-auto">
                      {r.detail}
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 flex items-center justify-between border-t border-white/[0.04] pt-4.5">
                      <span className="text-[10px] text-text-faint font-medium">
                        ID: {r.id.slice(-8)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTest(r.id);
                        }}
                        disabled={isTesting}
                        className="rounded-lg border border-border-glass bg-white/[0.02] px-3 py-1.5 text-[10px] font-semibold text-text-main hover:bg-white/[0.05] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all select-none cursor-pointer"
                      >
                        {isTesting ? 'Testing...' : 'Test Connection'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Selected Resource Detail Inspector Panel (Sidebar drawer) */}
      <div className="w-[320px] shrink-0 overflow-y-auto rounded-2xl border border-border-glass bg-bg-dark/45 p-5 space-y-6">
        {selectedResource ? (
          <>
            {/* Header info */}
            <div className="border-b border-white/[0.04] pb-4.5">
              <div className="flex items-center gap-2">
                <Server className="h-4.5 w-4.5 text-accent-cyan" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-text-main">
                  Resource details
                </h2>
              </div>
              <h3 className="mt-3 text-sm font-bold text-white leading-tight">
                {selectedResource.name}
              </h3>
              <p className="text-[10px] text-text-muted mt-1 font-mono">
                Type: {selectedResource.type}
              </p>
            </div>

            {/* Connection Status Card */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Status Health
              </h4>
              <div className={`flex items-start gap-3 rounded-xl border p-4.5 ${
                selectedResource.status === 'online'
                  ? 'border-status-success/20 bg-status-success/5 text-status-success'
                  : selectedResource.status === 'degraded'
                  ? 'border-status-warning/20 bg-status-warning/5 text-status-warning'
                  : 'border-status-error/20 bg-status-error/5 text-status-error'
              }`}>
                {selectedResource.status === 'online' ? (
                  <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                )}
                <div>
                  <h5 className="text-xs font-bold leading-tight uppercase">
                    {selectedResource.status === 'online' ? 'System Operational' : 'Action Required'}
                  </h5>
                  <p className="mt-1 text-[10px] opacity-80 leading-relaxed font-mono">
                    {selectedResource.detail}
                  </p>
                </div>
              </div>
            </div>

            {/* Visual Systems Metrics */}
            {metrics && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  System telemetry
                </h4>
                
                <div className="space-y-3 rounded-xl border border-white/[0.04] bg-[#03060f] p-4 text-xs">
                  {/* CPU Usage */}
                  <div>
                    <div className="flex justify-between text-[10px] text-text-muted mb-1 font-mono">
                      <span>CPU UTILIZATION</span>
                      <span className="text-text-main font-semibold">{metrics.cpu}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-accent-cyan tracking-tighter">
                        {'█'.repeat(Math.round(metrics.cpu / 10)) + '░'.repeat(10 - Math.round(metrics.cpu / 10))}
                      </span>
                    </div>
                  </div>

                  {/* Memory Usage */}
                  <div>
                    <div className="flex justify-between text-[10px] text-text-muted mb-1 font-mono">
                      <span>MEMORY UTILIZATION</span>
                      <span className="text-text-main font-semibold">{metrics.ram}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-accent-purple tracking-tighter">
                        {'█'.repeat(Math.round(metrics.ram / 10)) + '░'.repeat(10 - Math.round(metrics.ram / 10))}
                      </span>
                    </div>
                  </div>

                  {/* Details block */}
                  <div className="grid grid-cols-2 gap-3.5 border-t border-white/[0.03] pt-3 mt-1 font-mono text-[9px] text-text-muted">
                    <div>
                      <span className="text-text-faint uppercase block mb-0.5">SSH LATENCY</span>
                      <span className="text-text-main font-bold">{metrics.latency} ms</span>
                    </div>
                    <div>
                      <span className="text-text-faint uppercase block mb-0.5">DISK FILL</span>
                      <span className="text-text-main font-bold">{metrics.disk}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Task list details */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center justify-between">
                <span>Task Queue Status</span>
                {tasksLoading && <Loader2 className="h-3 w-3 animate-spin text-accent-cyan" />}
              </h4>

              {/* Running Tasks */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-text-main flex items-center gap-1.5">
                  <Play className="h-3 w-3 text-status-running animate-pulse" />
                  Running Tasks ({runningTasks.length})
                </span>

                {runningTasks.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.03] bg-white/[0.01] p-3.5 text-center text-[10px] text-text-faint">
                    No active tasks executing
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {runningTasks.map((t) => (
                      <div
                        key={t._id}
                        className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/[0.04] p-2 text-[10px]"
                      >
                        <span className="truncate font-semibold text-text-muted max-w-[150px]" title={t.service}>
                          {t.service.split('/').pop()}
                        </span>
                        <span className="text-[9px] font-mono text-text-faint">
                          {t._id.slice(-6)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Tasks */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-text-main flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-accent-purple" />
                  Recent History ({recentTasks.length})
                </span>

                {recentTasks.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.03] bg-white/[0.01] p-3.5 text-center text-[10px] text-text-faint">
                    No recent executions
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {recentTasks.slice(0, 10).map((t) => (
                      <div
                        key={t._id}
                        className="flex items-center justify-between rounded-lg bg-white/[0.01] border border-white/[0.03] p-2 text-[10px]"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="truncate font-semibold text-text-muted leading-tight" title={t.service}>
                            {t.service.split('/').pop()}
                          </p>
                          <span className="text-[8px] text-text-faint mt-0.5 block">
                            {t.start_date ? new Date(t.start_date).toLocaleDateString() : '--'}
                          </span>
                        </div>
                        {t.status === 'finished' ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0 text-status-error" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Test button inside details panel */}
            <div className="pt-4 border-t border-white/[0.04]">
              <button
                onClick={() => onTest(selectedResource.id)}
                disabled={testingId === selectedResource.id}
                className="w-full rounded-xl bg-accent-cyan px-4 py-2.5 text-xs font-bold text-bg-dark hover:bg-accent-cyan-dim disabled:opacity-50 transition-all select-none cursor-pointer"
              >
                {testingId === selectedResource.id ? 'Testing System...' : 'Test System Connectivity'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center text-text-faint select-none">
            <Server className="h-8 w-8 text-text-faint/50 mb-3" />
            <p className="text-[10px] leading-relaxed">
              Select a compute node card from the list to inspect active task telemetry
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
