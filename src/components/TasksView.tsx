import { useState, useEffect, useMemo } from 'react';
import { Search, Play, Loader2, RefreshCw, StopCircle, Terminal, User, FileJson, ChevronDown, ChevronUp, BarChart3, Activity, Clock, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';


import { apiFetch } from '../api';
import type { Task } from '../data';
import { useDashboardStore } from '../store/useDashboardStore';

interface TasksViewProps {
  tasks: Task[];
  onSelect: (task: Task | null) => void;
  selectedId: string | null;
  onRefresh: () => void;
  projectNamesMap?: Record<string, string>;
  userNamesMap?: Record<string, string>;
  onNavigateToResource?: (resourceName: string) => void;
  onNavigateToUser?: (userId: string) => void;
}

const statusColors = {
  requested: 'bg-amber-500/10 text-amber-400 border-amber-500/25 shadow-[0_0_8px_rgba(245,158,11,0.15)] animate-pulse',
  running: 'bg-status-running/10 text-status-running border-status-running/25 shadow-[0_0_8px_rgba(0,229,255,0.15)] animate-pulse-slow',
  finished: 'bg-status-success/10 text-status-success border-status-success/25',
  failed: 'bg-status-error/10 text-status-error border-status-error/25 shadow-[0_0_6px_rgba(239,68,68,0.1)]',
  queued: 'bg-status-warning/10 text-status-warning border-status-warning/25',
  cancelled: 'bg-white/[0.04] text-text-muted border-white/10',
  unknown: 'bg-accent-purple/10 text-accent-purple border-accent-purple/25',
};

export type StuckSeverity = 'WARNING' | 'ALERT' | 'CRITICAL';

export function getStuckSeverityInfo(pendingMinutes: number) {
  if (pendingMinutes >= 60) {
    return {
      severity: 'CRITICAL' as StuckSeverity,
      label: 'Critical: Severely Stalled',
      badgeLabel: '🔥 Critical (≥60m)',
      shortBadge: '🔥 ≥60m',
      colorClass: 'bg-red-500/20 text-red-300 border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.25)] animate-pulse-slow',
      bannerBg: 'border-red-500/40 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)] text-red-300',
      badgeBg: 'bg-red-500/20 text-red-300 border-red-500/40 font-mono',
      icon: '🔥'
    };
  } else if (pendingMinutes >= 30) {
    return {
      severity: 'ALERT' as StuckSeverity,
      label: 'Alert: Stuck in Requested',
      badgeLabel: '🚨 Alert (30–59m)',
      shortBadge: '🚨 30–59m',
      colorClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]',
      bannerBg: 'border-amber-500/30 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)] text-amber-300',
      badgeBg: 'bg-amber-400/20 text-amber-200 border-amber-500/30 font-mono',
      icon: '🚨'
    };
  } else {
    return {
      severity: 'WARNING' as StuckSeverity,
      label: 'Warning: Pending Delay',
      badgeLabel: '⚠️ Warning (15–29m)',
      shortBadge: '⚠️ 15–29m',
      colorClass: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.15)]',
      bannerBg: 'border-yellow-500/30 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.15)] text-yellow-300',
      badgeBg: 'bg-yellow-400/20 text-yellow-200 border-yellow-500/30 font-mono',
      icon: '⚠️'
    };
  }
}

export default function TasksView({ 
  tasks, 
  onSelect, 
  selectedId, 
  onRefresh, 
  projectNamesMap, 
  userNamesMap,
  onNavigateToResource,
  onNavigateToUser
}: TasksViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { 
    projectsList, 
    instancesList, 
    loadMoreTasks, 
    hasMoreTasks,
    resourcesList,
    stuckThresholdMinutes,
    setStuckThresholdMinutes,
    taskFilterState,
    setTaskFilterState
  } = useDashboardStore();

  const [activeFilter, setActiveFilter] = useState<'all' | 'running' | 'finished' | 'failed' | 'queued' | 'cancelled' | 'stuck'>(taskFilterState || 'all');
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (taskFilterState) {
      setActiveFilter(taskFilterState);
    }
  }, [taskFilterState]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      await loadMoreTasks();
    } catch (error) {
      console.error('Failed to load more tasks:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Reset page to 1 when filters or query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeFilter]);
  
  // Selected task detail details
  const [rawTask, setRawTask] = useState<Record<string, unknown> | null>(null);
  const [rawLoading, setRawLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [jsonExpanded, setJsonExpanded] = useState(false);

  const renderHighlightedJson = (obj: any) => {
    const jsonStr = JSON.stringify(obj, null, 2);
    const errorMsg = obj.status_msg || (selectedTask?.status === 'failed' ? selectedTask.message : null);
    if (!errorMsg || typeof errorMsg !== 'string') {
      return <pre className="text-accent-cyan/85 whitespace-pre-wrap break-all">{jsonStr}</pre>;
    }

    const parts = jsonStr.split(errorMsg);
    return (
      <pre className="text-accent-cyan/85 whitespace-pre-wrap break-all">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <mark className="bg-yellow-500/20 text-yellow-200 border border-yellow-500/30 px-1 py-0.5 rounded font-semibold select-all">
                {errorMsg}
              </mark>
            )}
          </span>
        ))}
      </pre>
    );
  };

  const selectedTask = useMemo(() => {
    return tasks.find(t => t.id === selectedId) || null;
  }, [tasks, selectedId]);

  const resolvedInspectorProj = useMemo(() => {
    if (!selectedTask) return null;
    let resolvedProjId = selectedTask.realProjectId || 'Unknown';
    let resolvedProjName = resolvedProjId !== 'Unknown' ? projectNamesMap?.[resolvedProjId] : '';

    if (resolvedProjId === 'Unknown') {
      const sibling = tasks.find(s => s.projectId === selectedTask.projectId && s.realProjectId && s.realProjectId !== 'Unknown');
      if (sibling && sibling.realProjectId) {
        resolvedProjId = sibling.realProjectId;
        resolvedProjName = projectNamesMap?.[resolvedProjId] || '';
      }
    }

    if (resolvedProjId === 'Unknown') {
      const instObj = instancesList.find(i => i._id === selectedTask.projectId);
      const resolvedProject = instObj && instObj.group_id !== undefined && instObj.group_id !== null
        ? projectsList.find(p => p.group_id !== undefined && p.group_id !== null && p.group_id.toString() === instObj.group_id.toString())
        : null;
      if (resolvedProject) {
        resolvedProjId = resolvedProject._id;
        resolvedProjName = resolvedProject.name;
      }
    }

    return { resolvedProjId, resolvedProjName };
  }, [selectedTask, tasks, instancesList, projectsList, projectNamesMap]);

  const ownerId = String(rawTask?.user_id || selectedTask?.userId || '');
  const ownerName = ownerId ? (userNamesMap?.[ownerId] || ownerId) : 'Unassigned';

  // Fetch raw database task object when selection changes
  useEffect(() => {
    if (!selectedId) {
      setRawTask(null);
      setJsonExpanded(false);
      return;
    }

    const fetchRawTask = async () => {
      setRawLoading(true);
      try {
        const response = await apiFetch<Record<string, unknown>>(`/task/${selectedId}`);
        setRawTask(response);
      } catch (error) {
        console.error('Failed to fetch raw task document details:', error);
        setRawTask(null);
      } finally {
        setRawLoading(false);
      }
    };

    fetchRawTask();
  }, [selectedId]);

  // Enhanced multi-field search and status filter
  const stuckTasksList = useMemo(() => {
    const now = Date.now();
    return tasks.filter(t => {
      if (t.status !== 'requested' && t.status !== 'queued') return false;
      const createdMs = t.createDate ? new Date(t.createDate).getTime() : (t.startDate ? new Date(t.startDate).getTime() : 0);
      if (!createdMs) return t.status === 'requested';
      const mins = Math.floor((now - createdMs) / 60000);
      return mins >= stuckThresholdMinutes || t.status === 'requested';
    });
  }, [tasks, stuckThresholdMinutes]);

  const selectedTaskDiagnostic = useMemo(() => {
    if (!selectedTask) return null;
    const isPendingState = selectedTask.status === 'requested' || selectedTask.status === 'queued';
    if (!isPendingState && selectedTask.status !== 'unknown') return null;

    const now = Date.now();
    const createdMs = selectedTask.createDate ? new Date(selectedTask.createDate).getTime() : 0;
    const pendingMinutes = createdMs ? Math.floor((now - createdMs) / 60000) : 0;

    const isStuck = pendingMinutes >= stuckThresholdMinutes || selectedTask.status === 'requested';
    const onlineResources = (resourcesList || []).filter(r => r.status === 'online');
    const hasOnlineResource = onlineResources.length > 0;

    let reason: 'SCHEDULER_STALLED' | 'RESOURCE_OFFLINE' | 'NORMAL' = 'NORMAL';
    if (isStuck) {
      reason = hasOnlineResource ? 'SCHEDULER_STALLED' : 'RESOURCE_OFFLINE';
    }

    const severityInfo = getStuckSeverityInfo(pendingMinutes);

    return {
      isStuck,
      pendingMinutes,
      hasOnlineResource,
      reason,
      severityInfo,
      onlineResourcesCount: onlineResources.length
    };
  }, [selectedTask, resourcesList, stuckThresholdMinutes]);

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tasks.filter((t) => {
      if (activeFilter === 'stuck') {
        const isStuckItem = stuckTasksList.some(st => st.id === t.id);
        if (!isStuckItem) return false;
      } else if (activeFilter !== 'all' && t.status !== activeFilter) {
        return false;
      }

      if (!query) return true;

      const projectName = (projectNamesMap?.[t.projectId] || '').toLowerCase();
      const realProjectName = (t.realProjectId ? (projectNamesMap?.[t.realProjectId] || '') : '').toLowerCase();
      const userName = (t.userId ? (userNamesMap?.[t.userId] || '') : '').toLowerCase();
      const serviceName = (t.service || '').toLowerCase();
      const jobName = (t.jobName || '').toLowerCase();
      const datatype = (t.datatype || '').toLowerCase();
      const groupId = (t.groupId || '').toLowerCase();
      const groupName = (t.groupName || '').toLowerCase();
      const taskId = (t.id || '').toLowerCase();
      const resource = (t.resource || '').toLowerCase();
      const message = (t.message || '').toLowerCase();

      return (
        taskId.includes(query) ||
        serviceName.includes(query) ||
        jobName.includes(query) ||
        projectName.includes(query) ||
        realProjectName.includes(query) ||
        t.projectId.toLowerCase().includes(query) ||
        (t.realProjectId && t.realProjectId.toLowerCase().includes(query)) ||
        userName.includes(query) ||
        (t.userId && t.userId.toLowerCase().includes(query)) ||
        datatype.includes(query) ||
        groupId.includes(query) ||
        groupName.includes(query) ||
        resource.includes(query) ||
        message.includes(query)
      );
    });
  }, [tasks, searchQuery, activeFilter, projectNamesMap, userNamesMap, stuckTasksList]);

  // Summary Analytics Calculations for Tasks
  const taskStatsSummary = useMemo(() => {
    const total = tasks.length;
    const finished = tasks.filter(t => t.status === 'finished').length;
    const failed = tasks.filter(t => t.status === 'failed').length;
    const running = tasks.filter(t => t.status === 'running').length;
    const queued = tasks.filter(t => t.status === 'queued').length;
    const cancelled = tasks.filter(t => t.status === 'cancelled').length;

    const completedTotal = finished + failed;
    const successRate = completedTotal > 0 ? (finished / completedTotal) * 100 : 100;

    // Service Breakdown
    const serviceCounts: Record<string, { service: string; count: number; finished: number; failed: number }> = {};
    tasks.forEach(t => {
      const sName = t.service ? (t.service.split('/').pop() || t.service) : 'Unknown';
      if (!serviceCounts[sName]) {
        serviceCounts[sName] = { service: sName, count: 0, finished: 0, failed: 0 };
      }
      serviceCounts[sName].count += 1;
      if (t.status === 'finished') serviceCounts[sName].finished += 1;
      if (t.status === 'failed') serviceCounts[sName].failed += 1;
    });

    const topServices = Object.values(serviceCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total,
      finished,
      failed,
      running,
      queued,
      cancelled,
      successRate: parseFloat(successRate.toFixed(1)),
      topServices
    };
  }, [tasks]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredTasks.length / 10));
  }, [filteredTasks]);

  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * 10;
    return filteredTasks.slice(start, start + 10);
  }, [filteredTasks, currentPage]);

  const pageButtons = useMemo(() => {
    const buttons: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) {
      buttons.push(i);
    }
    return buttons;
  }, [currentPage, totalPages]);

  const handleRerun = async (taskId: string) => {
    setActionLoading(true);
    try {
      await apiFetch<{ message: string; task: unknown }>(`/task/rerun/${taskId}`, { method: 'PUT' });
      onRefresh();
    } catch (error) {
      alert(`Rerun request failed: ${(error as Error).message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async (taskId: string) => {
    setActionLoading(true);
    try {
      await apiFetch<{ message: string; task: unknown }>(`/task/stop/${taskId}`, { method: 'PUT' });
      onRefresh();
    } catch (error) {
      alert(`Stop request failed: ${(error as Error).message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const [showAnalyticsSummary, setShowAnalyticsSummary] = useState(true);

  return (
    <div className="flex h-full min-h-0 w-full gap-5 overflow-hidden font-sans">
      {/* Left Tasks Grid/Table Panel */}
      <div className="flex flex-1 flex-col min-w-0 space-y-4 overflow-y-auto pr-1">

        {/* Top Header Controls (Analytics Toggle) */}
        <div className="flex items-center justify-between pb-1 shrink-0">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-text-faint flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-accent-cyan" />
            Workflow Execution Overview
          </span>
          <button
            onClick={() => setShowAnalyticsSummary(!showAnalyticsSummary)}
            className="flex items-center gap-1.5 rounded-lg border border-border-glass bg-white/[0.02] px-2.5 py-1 text-[10.5px] font-semibold text-text-muted hover:text-text-main hover:bg-white/[0.05] transition-all cursor-pointer select-none font-mono"
          >
            <BarChart3 className="h-3.5 w-3.5 text-accent-purple" />
            <span>{showAnalyticsSummary ? 'Hide Analytics Summary' : 'Show Analytics Summary'}</span>
            {showAnalyticsSummary ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Task Summary & Performance Dashboard Section (Collapsible) */}
        {showAnalyticsSummary && (
          <div className="space-y-4 shrink-0 animate-fade-in">
            {/* Top KPI Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass rounded-xl p-3.5 space-y-1">
              <span className="text-[9px] font-bold text-text-faint uppercase tracking-wider block">Total Tasks Monitored</span>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xl font-bold text-white">{taskStatsSummary.total.toLocaleString()}</span>
                <span className="text-[9px] font-mono text-accent-cyan font-bold">100% Volume</span>
              </div>
            </div>

            <div className="glass rounded-xl p-3.5 space-y-1">
              <span className="text-[9px] font-bold text-text-faint uppercase tracking-wider block">Task Success Rate</span>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xl font-bold text-status-success">{taskStatsSummary.successRate}%</span>
                <span className="text-[9px] font-mono text-status-success font-bold">▲ Optimal</span>
              </div>
            </div>

            <div className="glass rounded-xl p-3.5 space-y-1">
              <span className="text-[9px] font-bold text-text-faint uppercase tracking-wider block">Active Compute Tasks</span>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xl font-bold text-status-running">{taskStatsSummary.running + taskStatsSummary.queued}</span>
                <span className="text-[9px] font-mono text-text-muted font-normal">{taskStatsSummary.running} Run | {taskStatsSummary.queued} Queue</span>
              </div>
            </div>

            <div className="glass rounded-xl p-3.5 space-y-1">
              <span className="text-[9px] font-bold text-text-faint uppercase tracking-wider block">Task Failures</span>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xl font-bold text-status-error">{taskStatsSummary.failed}</span>
                <span className="text-[9px] font-mono text-status-error font-bold">
                  {taskStatsSummary.total > 0 ? ((taskStatsSummary.failed / taskStatsSummary.total) * 100).toFixed(1) : 0}% Rate
                </span>
              </div>
            </div>
          </div>

          {/* Visual Charts Grid (Status Distribution Donut + Top App Workloads Bar Graph) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chart 1: Task Status Distribution */}
            <div className="glass rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-main flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-accent-cyan" />
                  Task Execution Status Breakdown
                </h4>
                <span className="text-[9px] font-mono text-text-faint">Live Telemetry</span>
              </div>

              <div className="flex items-center gap-4 py-1">
                {/* SVG Donut */}
                <div className="relative h-20 w-20 shrink-0">
                  <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3.8" />
                    {(() => {
                      const total = taskStatsSummary.total || 1;
                      const finishedPct = (taskStatsSummary.finished / total) * 100;
                      const failedPct = (taskStatsSummary.failed / total) * 100;
                      const runningPct = (taskStatsSummary.running / total) * 100;
                      const queuedPct = (taskStatsSummary.queued / total) * 100;

                      let offset = 0;
                      const finishedDash = `${finishedPct} ${100 - finishedPct}`;
                      offset += finishedPct;
                      const failedDash = `${failedPct} ${100 - failedPct}`;
                      const failedOffset = 100 - offset;
                      offset += failedPct;
                      const runningDash = `${runningPct} ${100 - runningPct}`;
                      const runningOffset = 100 - offset;
                      offset += runningPct;
                      const queuedDash = `${queuedPct} ${100 - queuedPct}`;
                      const queuedOffset = 100 - offset;

                      return (
                        <>
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10B981" strokeWidth="3.8" strokeDasharray={finishedDash} strokeDashoffset="0" />
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#EF4444" strokeWidth="3.8" strokeDasharray={failedDash} strokeDashoffset={failedOffset} />
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#00E5FF" strokeWidth="3.8" strokeDasharray={runningDash} strokeDashoffset={runningOffset} />
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#F59E0B" strokeWidth="3.8" strokeDasharray={queuedDash} strokeDashoffset={queuedOffset} />
                        </>
                      );
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="font-mono text-[11px] font-bold text-white">{taskStatsSummary.successRate}%</span>
                    <span className="text-[7px] text-text-faint uppercase font-mono">Success</span>
                  </div>
                </div>

                {/* Status Legend Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 flex-1 font-mono text-[10px]">
                  <div className="flex items-center justify-between border-b border-white/[0.04] pb-1">
                    <span className="text-text-muted flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-success inline-block"></span>Finished</span>
                    <span className="text-white font-bold">{taskStatsSummary.finished}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/[0.04] pb-1">
                    <span className="text-text-muted flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-error inline-block"></span>Failed</span>
                    <span className="text-white font-bold">{taskStatsSummary.failed}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/[0.04] pb-1">
                    <span className="text-text-muted flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-running inline-block"></span>Running</span>
                    <span className="text-white font-bold">{taskStatsSummary.running}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/[0.04] pb-1">
                    <span className="text-text-muted flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-warning inline-block"></span>Queued</span>
                    <span className="text-white font-bold">{taskStatsSummary.queued}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart 2: Top Application Services Workload */}
            <div className="glass rounded-xl p-4 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-main flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-accent-purple" />
                  Top Applications Workloads
                </h4>
                <span className="text-[9px] font-mono text-text-faint">Top Executed Apps</span>
              </div>

              <div className="space-y-2 py-0.5">
                {taskStatsSummary.topServices.map((s) => {
                  const maxCount = taskStatsSummary.topServices[0]?.count || 1;
                  const pct = Math.round((s.count / maxCount) * 100);
                  const successPct = s.count > 0 ? Math.round((s.finished / s.count) * 100) : 100;
                  return (
                    <div key={s.service} className="space-y-1">
                      <div className="flex justify-between font-mono text-[9.5px]">
                        <span className="text-text-main font-semibold truncate max-w-[180px]">{s.service.toUpperCase()}</span>
                        <span className="text-text-muted"><span className="text-white font-bold">{s.count}</span> jobs ({successPct}% success)</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-accent-cyan to-accent-purple rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Filter bar */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2.5 shrink-0 pt-1">
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'all' as const, label: 'All Tasks' },
              { id: 'running' as const, label: 'Running' },
              { id: 'finished' as const, label: 'Finished' },
              { id: 'failed' as const, label: `Failed (${taskStatsSummary.failed}) 💥` },
              { id: 'stuck' as const, label: `Stuck (${stuckTasksList.length}) ⏳` },
              { id: 'queued' as const, label: 'Queued' },
              { id: 'cancelled' as const, label: 'Cancelled' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => {
                  setActiveFilter(id);
                  setTaskFilterState(id);
                }}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 select-none cursor-pointer whitespace-nowrap ${
                  activeFilter === id
                    ? id === 'stuck' 
                      ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                      : id === 'failed'
                      ? 'bg-status-error/20 text-status-error ring-1 ring-status-error/40'
                      : 'bg-accent-cyan/15 text-accent-cyan ring-1 ring-accent-cyan/20'
                    : 'bg-white/[0.01] border border-border-glass text-text-muted hover:text-text-main hover:bg-white/[0.03]'
                }`}
              >
                {label}
              </button>
            ))}

            {/* Stuck Threshold Selector Pill when Stuck filter active */}
            {activeFilter === 'stuck' && (
              <div className="ml-2 flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-mono text-amber-300">
                <Clock className="h-3 w-3 text-amber-400" />
                <span className="font-sans font-bold">Stuck Threshold:</span>
                {[15, 30, 60].map(mins => (
                  <button
                    key={mins}
                    onClick={() => setStuckThresholdMinutes(mins)}
                    className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold cursor-pointer transition-all ${
                      stuckThresholdMinutes === mins 
                        ? 'bg-amber-400 text-bg-dark shadow' 
                        : 'hover:bg-amber-400/20 text-amber-200'
                    }`}
                  >
                    &gt;{mins}m
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Task ID, Project, Group, User, Job Name, Datatype..."
                className="w-full sm:w-80 rounded-lg border border-border-glass bg-[#050811] py-1.5 pl-9 pr-4 text-xs text-text-main placeholder:text-text-faint focus:border-accent-cyan/40 focus:outline-none"
              />
            </div>
            
            <button
              onClick={onRefresh}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-glass bg-white/[0.01] text-text-muted hover:text-text-main hover:bg-white/[0.03] transition-all select-none cursor-pointer"
              title="Refresh Tasks List"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>


        {/* Task Grid Table */}
        <div className="flex-1 shrink-0">
          <div className="glass overflow-hidden rounded-2xl border border-border-glass bg-bg-dark/20">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.04] bg-white/[0.01] font-mono text-[9px] font-bold uppercase tracking-wider text-text-faint select-none">
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Task ID</th>
                  <th className="px-5 py-3.5">Service</th>
                  <th className="px-5 py-3.5">Project</th>
                  <th className="px-5 py-3.5">instance_id</th>
                  <th className="px-5 py-3.5">Created</th>
                  <th className="px-5 py-3.5">Start Time</th>
                  <th className="px-5 py-3.5">Duration</th>
                  <th className="px-5 py-3.5">Message</th>
                  <th className="px-5 py-3.5">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-xs text-text-faint font-medium">
                      No workflow tasks match your filters
                    </td>
                  </tr>
                ) : (
                  paginatedTasks.map((t) => {
                    const isSelected = selectedId === t.id;
                    return (
                      <tr
                        key={t.id}
                        onClick={() => onSelect(isSelected ? null : t)}
                        className={`group cursor-pointer select-none transition-colors duration-150 ${
                          isSelected
                            ? 'bg-accent-cyan/5 text-white'
                            : 'hover:bg-white/[0.01] text-text-muted'
                        }`}
                      >
                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                statusColors[t.status] || statusColors.unknown
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  t.status === 'running'
                                    ? 'bg-status-running shadow-[0_0_6px_#00E5FF] animate-pulse'
                                    : t.status === 'finished'
                                    ? 'bg-status-success shadow-[0_0_6px_#10B981]'
                                    : t.status === 'failed'
                                    ? 'bg-status-error shadow-[0_0_6px_#EF4444]'
                                    : t.status === 'queued' || t.status === 'requested'
                                    ? 'bg-amber-400 shadow-[0_0_6px_#F59E0B]'
                                    : 'bg-text-faint'
                                }`}
                              />
                              {t.status}
                            </span>
                            {/* Severity Pill if pending/stuck */}
                            {(() => {
                              if (t.status !== 'requested' && t.status !== 'queued') return null;
                              const now = Date.now();
                              const createdMs = t.createDate ? new Date(t.createDate).getTime() : 0;
                              if (!createdMs) return null;
                              const mins = Math.floor((now - createdMs) / 60000);
                              if (mins < 15) return null;
                              const sev = getStuckSeverityInfo(mins);
                              return (
                                <span 
                                  className={`rounded-md border px-1.5 py-0.5 text-[8.5px] font-bold font-mono whitespace-nowrap ${sev.badgeBg}`}
                                  title={`${sev.label} (${mins}m pending)`}
                                >
                                  {sev.shortBadge}
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                        {/* Task ID */}
                        {(() => {
                          let resolvedProjId = t.realProjectId || 'Unknown';
                          let resolvedProjName = resolvedProjId !== 'Unknown' ? projectNamesMap?.[resolvedProjId] : '';

                          if (resolvedProjId === 'Unknown') {
                            const sibling = tasks.find(s => s.projectId === t.projectId && s.realProjectId && s.realProjectId !== 'Unknown');
                            if (sibling && sibling.realProjectId) {
                              resolvedProjId = sibling.realProjectId;
                              resolvedProjName = projectNamesMap?.[resolvedProjId] || '';
                            }
                          }

                          if (resolvedProjId === 'Unknown') {
                            const instObj = instancesList.find(i => i._id === t.projectId);
                            const resolvedProject = instObj && instObj.group_id !== undefined && instObj.group_id !== null
                              ? projectsList.find(p => p.group_id !== undefined && p.group_id !== null && p.group_id.toString() === instObj.group_id.toString())
                              : null;
                            if (resolvedProject) {
                              resolvedProjId = resolvedProject._id;
                              resolvedProjName = resolvedProject.name;
                            }
                          }

                          return (
                            <>
                              <td className="px-5 py-3.5 font-mono text-[11px] font-bold group-hover:text-accent-cyan transition-colors">
                                {resolvedProjId !== 'Unknown' ? (
                                  <a
                                    href={`https://brainlife.io/project/${resolvedProjId}/process/${t.projectId}#task-${t.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="hover:underline hover:text-accent-cyan-dim cursor-pointer transition-colors text-accent-cyan"
                                  >
                                    {t.id.slice(-8)}
                                  </a>
                                ) : (
                                  <span>{t.id.slice(-8)}</span>
                                )}
                              </td>
                              {/* Service */}
                              <td className="px-5 py-3.5 font-semibold truncate max-w-[200px]" title={t.service}>
                                {t.service.split('/').pop()}
                              </td>
                              {/* Project */}
                              <td className="px-5 py-3.5 font-semibold max-w-[140px] truncate" title={resolvedProjId}>
                                {resolvedProjId !== 'Unknown' ? (
                                  <a
                                    href={`https://brainlife.io/project/${resolvedProjId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-accent-cyan hover:underline cursor-pointer transition-colors font-medium"
                                  >
                                    {resolvedProjName || resolvedProjId.slice(-6)}
                                  </a>
                                ) : (
                                  <span className="text-text-muted">Unknown Project</span>
                                )}
                              </td>
                              {/* instance_id */}
                              <td className="px-5 py-3.5 font-semibold max-w-[140px] truncate" title={t.projectId}>
                                {resolvedProjId !== 'Unknown' ? (
                                  <a
                                    href={`https://brainlife.io/project/${resolvedProjId}/process/${t.projectId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-text-faint hover:text-accent-cyan hover:underline font-mono"
                                  >
                                    {projectNamesMap?.[t.projectId] || t.projectId.slice(-6)}
                                  </a>
                                ) : (
                                  <span className="text-text-faint font-mono">
                                    {projectNamesMap?.[t.projectId] || t.projectId.slice(-6)}
                                  </span>
                                )}
                              </td>
                            </>
                          );
                        })()}
                        {/* Created At */}
                        <td className="px-5 py-3.5 text-xs font-mono text-text-faint">
                          {t.createDate ? (() => {
                            const d = new Date(t.createDate);
                            const dateStr = d.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
                            const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                            return `${dateStr} ${timeStr}`;
                          })() : '--'}
                        </td>
                        {/* Start Time */}
                        <td className="px-5 py-3.5 text-xs">
                          {t.startedAt}
                        </td>
                        {/* Duration */}
                        <td className="px-5 py-3.5 font-mono text-[10px]">
                          {t.duration}
                        </td>
                        {/* Message */}
                        <td className="px-5 py-3.5 text-text-muted relative group/msg max-w-[200px]">
                          <div className="truncate">
                            {t.message || '--'}
                          </div>
                          {t.message && (
                            <div className="absolute bottom-full left-1/2 mb-2.5 hidden group-hover/msg:block -translate-x-1/2 z-50 w-64 rounded-xl border border-border-glass bg-[#09111d] p-3 text-[11px] text-text-main shadow-[0_8px_24px_rgba(0,0,0,0.6)] font-sans whitespace-normal break-words pointer-events-none">
                              {t.message}
                              {/* Caret arrow */}
                              <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#09111d]" />
                            </div>
                          )}
                        </td>
                        {/* User */}
                        <td className="px-5 py-3.5 font-semibold text-xs">
                          {t.userId ? (userNamesMap?.[t.userId] || t.userId) : '--'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              </table>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/[0.04] p-3.5 bg-white/[0.01] select-none text-[10px] text-text-faint font-mono font-medium">
              <div>
                Showing {filteredTasks.length === 0 ? 0 : (currentPage - 1) * 10 + 1} - {Math.min(filteredTasks.length, currentPage * 10)} of {filteredTasks.length} loaded tasks
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || loadingMore}
                  className="rounded-lg border border-border-glass bg-white/[0.01] px-3 py-1.5 text-[10px] font-bold text-text-muted hover:text-text-main disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  Prev
                </button>

                {currentPage > 3 && (
                  <>
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={loadingMore}
                      className="rounded-lg border border-border-glass bg-white/[0.01] px-3 py-1.5 text-[10px] font-bold text-text-muted hover:text-text-main transition-all cursor-pointer"
                    >
                      1
                    </button>
                    {currentPage > 4 && <span className="px-1 text-text-faint">...</span>}
                  </>
                )}

                {pageButtons.map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    disabled={loadingMore}
                    className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold transition-all cursor-pointer ${
                      currentPage === pageNum
                        ? 'border-accent-cyan bg-accent-cyan/10 text-accent-cyan'
                        : 'border-border-glass bg-white/[0.01] text-text-muted hover:text-text-main'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && <span className="px-1 text-text-faint">...</span>}
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={loadingMore}
                      className="rounded-lg border border-border-glass bg-white/[0.01] px-3 py-1.5 text-[10px] font-bold text-text-muted hover:text-text-main transition-all cursor-pointer"
                    >
                      {totalPages}
                    </button>
                  </>
                )}

                <button
                  onClick={async () => {
                    if (currentPage === totalPages && hasMoreTasks) {
                      await handleLoadMore();
                      setCurrentPage((p) => p + 1);
                    } else {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                    }
                  }}
                  disabled={(currentPage === totalPages && !hasMoreTasks) || loadingMore}
                  className="flex items-center gap-1.5 rounded-lg border border-border-glass bg-white/[0.01] px-3 py-1.5 text-[10px] font-bold text-text-muted hover:text-text-main disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-accent-cyan" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <span>Next</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Selected Task Inspector Panel */}
      <div className="w-[320px] shrink-0 overflow-y-auto rounded-2xl border border-border-glass bg-bg-dark/45 p-5 space-y-6">
        {selectedTask ? (
          <>
            {/* Header Details */}
            <div className="border-b border-white/[0.04] pb-4.5">
              <div className="flex items-center gap-2">
                <Terminal className="h-4.5 w-4.5 text-accent-cyan" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-text-main font-mono">
                  Task telemetry
                </h2>
              </div>
              <h3 className="mt-3 text-sm font-bold text-white break-all leading-tight" title={selectedTask.service}>
                {selectedTask.service.split('/').pop()}
              </h3>
              <p className="text-[10px] text-text-muted mt-1 font-mono break-all">
                ID: {selectedTask.id}
              </p>
            </div>

            {/* General Metadata */}
            <div className="space-y-4 text-xs">
              {/* Status */}
              <div className="flex justify-between items-center border-b border-white/[0.02] pb-2">
                <span className="text-text-faint font-mono text-[10px] uppercase">Status</span>
                <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${
                  selectedTask.status === 'finished' ? 'text-status-success bg-status-success/5 border border-status-success/15' :
                  selectedTask.status === 'failed' ? 'text-status-error bg-status-error/5 border border-status-error/15' :
                  'text-status-running bg-status-running/5 border border-status-running/15'
                }`}>
                  {selectedTask.status}
                </span>
              </div>

              {/* Project */}
              <div className="flex justify-between items-center border-b border-white/[0.02] pb-2">
                <span className="text-text-faint font-mono text-[10px] uppercase">Project</span>
                <span className="font-semibold text-text-main max-w-[180px] truncate" title={resolvedInspectorProj?.resolvedProjId}>
                  {resolvedInspectorProj && resolvedInspectorProj.resolvedProjId !== 'Unknown' ? (
                    <a
                      href={`https://brainlife.io/project/${resolvedInspectorProj.resolvedProjId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-cyan hover:underline cursor-pointer transition-colors"
                    >
                      {resolvedInspectorProj.resolvedProjName || resolvedInspectorProj.resolvedProjId.slice(-6)}
                    </a>
                  ) : (
                    <span className="text-text-muted">Unknown Project</span>
                  )}
                </span>
              </div>

              {/* instance_id */}
              <div className="flex justify-between items-center border-b border-white/[0.02] pb-2">
                <span className="text-text-faint font-mono text-[10px] uppercase">instance_id</span>
                <span className="font-semibold text-text-main max-w-[180px] truncate" title={selectedTask.projectId}>
                  {resolvedInspectorProj && resolvedInspectorProj.resolvedProjId !== 'Unknown' ? (
                    <a
                      href={`https://brainlife.io/project/${resolvedInspectorProj.resolvedProjId}/process/${selectedTask.projectId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-text-faint hover:text-accent-cyan hover:underline font-mono"
                    >
                      {projectNamesMap?.[selectedTask.projectId] || selectedTask.projectId.slice(-6)}
                    </a>
                  ) : (
                    <span className="font-mono text-text-faint">
                      {projectNamesMap?.[selectedTask.projectId] || selectedTask.projectId.slice(-6)}
                    </span>
                  )}
                </span>
              </div>

              {/* Resource */}
              <div className="flex justify-between items-center border-b border-white/[0.02] pb-2">
                <span className="text-text-faint font-mono text-[10px] uppercase">Resource</span>
                <button
                  onClick={() => onNavigateToResource?.(selectedTask.resource)}
                  className="text-accent-cyan font-semibold truncate max-w-[180px] hover:underline cursor-pointer transition-colors text-right"
                >
                  {selectedTask.resource} →
                </button>
              </div>

              {/* User */}
              {!!ownerId && (
                <div className="flex justify-between items-center border-b border-white/[0.02] pb-2">
                  <span className="text-text-faint font-mono text-[10px] uppercase flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-text-faint" />
                    Owner
                  </span>
                  <button
                    onClick={() => {
                      if (selectedTask.userId) {
                        // console.log("[TasksView] Clicking on user. selectedTask.userId (Sub ID):", selectedTask.userId, "Username:", ownerName);
                        onNavigateToUser?.(selectedTask.userId);
                      }
                    }}
                    className="font-semibold text-accent-cyan truncate max-w-[160px] hover:underline cursor-pointer transition-colors text-right"
                    title={ownerName}
                  >
                    {ownerName} →
                  </button>
                </div>
              )}
            </div>

            {/* Resource & Scheduler Stuck Diagnostic Banner */}
            {selectedTaskDiagnostic && selectedTaskDiagnostic.isStuck && (
              <div className={`space-y-2 rounded-xl border p-3.5 ${selectedTaskDiagnostic.severityInfo.bannerBg}`}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider font-mono">
                    <ShieldAlert className="h-4 w-4 text-amber-400 animate-pulse" />
                    Stuck Diagnostic
                  </span>
                  <span className={`rounded border px-2 py-0.5 font-mono text-[9px] font-bold ${selectedTaskDiagnostic.severityInfo.badgeBg}`}>
                    {selectedTaskDiagnostic.severityInfo.badgeLabel}
                  </span>
                </div>

                <div className="text-[11px] font-sans leading-relaxed font-medium">
                  {selectedTaskDiagnostic.reason === 'SCHEDULER_STALLED' ? (
                    <div>
                      <p className="font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />
                        Compute Nodes Online ({selectedTaskDiagnostic.onlineResourcesCount} active)
                      </p>
                      <p className="mt-1 text-[10.5px] opacity-90">
                        Active online resources exist in system, but task has not been dispatched by the Amaretti scheduler ({selectedTaskDiagnostic.pendingMinutes}m elapsed).
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-bold text-status-error flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-status-error" />
                        Infrastructure Resource Shortage
                      </p>
                      <p className="mt-1 text-[10.5px] opacity-90">
                        All matching compute resources are offline, degraded, or at maximum execution capacity.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Message Section */}
            {selectedTask.message && (
              <div className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Log status message
                </span>
                <div className="rounded-xl border border-status-error/10 bg-status-error/5 p-3.5 font-mono text-[10px] text-status-error leading-relaxed max-h-32 overflow-y-auto select-text">
                  {selectedTask.message}
                </div>
              </div>
            )}

            {/* Action buttons (Rerun / Cancel) */}
            <div className="pt-2">
              {actionLoading ? (
                <button disabled className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-xs text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </button>
              ) : selectedTask.status === 'running' || selectedTask.status === 'queued' ? (
                <button
                  onClick={() => handleStop(selectedTask.id)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-status-error/30 bg-status-error/5 py-2.5 text-xs font-bold text-status-error hover:bg-status-error/10 active:scale-[0.98] transition-all select-none cursor-pointer"
                >
                  <StopCircle className="h-4 w-4" />
                  <span>Request Task Stop</span>
                </button>
              ) : (
                <button
                  onClick={() => handleRerun(selectedTask.id)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent-cyan py-2.5 text-xs font-bold text-bg-dark hover:bg-accent-cyan-dim active:scale-[0.98] transition-all select-none cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-bg-dark" />
                  <span>Rerun Task Workflow</span>
                </button>
              )}
            </div>

            {/* Raw JSON viewer */}
            <div className="border-t border-white/[0.04] pt-4.5 space-y-2">
              <button
                onClick={() => setJsonExpanded(!jsonExpanded)}
                className="flex w-full items-center justify-between font-mono text-[10px] uppercase text-text-muted hover:text-text-main transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <FileJson className="h-4 w-4 text-accent-purple" />
                  Raw database document
                </span>
                {jsonExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {jsonExpanded && (
                <div className="mt-2 rounded-xl border border-white/[0.03] bg-[#03060f] p-3 text-[10px] font-mono leading-relaxed overflow-x-auto max-h-72 select-text selection:bg-accent-cyan/20">
                  {rawLoading ? (
                    <div className="flex py-6 flex-col items-center justify-center gap-2 text-text-faint">
                      <Loader2 className="h-4 w-4 animate-spin text-accent-cyan" />
                      <span>Fetching document details...</span>
                    </div>
                  ) : rawTask ? (
                    renderHighlightedJson(rawTask)
                  ) : (
                    <span className="text-text-faint">No details found</span>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center text-text-faint select-none">
            <Terminal className="h-8 w-8 text-text-faint/50 mb-3" />
            <p className="text-[10px] leading-relaxed">
              Select any execution row in the grid table list to inspect workflow variables & trigger actions
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
