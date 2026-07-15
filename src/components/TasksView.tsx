import { useState, useEffect, useMemo } from 'react';
import { Search, Play, Loader2, RefreshCw, StopCircle, Terminal, User, FileJson, ChevronDown, ChevronUp } from 'lucide-react';
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
  running: 'bg-status-running/10 text-status-running border-status-running/25 shadow-[0_0_8px_rgba(0,229,255,0.15)] animate-pulse-slow',
  finished: 'bg-status-success/10 text-status-success border-status-success/25',
  failed: 'bg-status-error/10 text-status-error border-status-error/25 shadow-[0_0_6px_rgba(239,68,68,0.1)]',
  queued: 'bg-status-warning/10 text-status-warning border-status-warning/25',
  cancelled: 'bg-white/[0.04] text-text-muted border-white/10',
  unknown: 'bg-accent-purple/10 text-accent-purple border-accent-purple/25',
};

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
  const [activeFilter, setActiveFilter] = useState<'all' | 'running' | 'finished' | 'failed' | 'queued' | 'cancelled'>('all');
  const { projectsList, instancesList, loadMoreTasks, hasMoreTasks } = useDashboardStore();
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

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

  // Apply filters and search query
  const filteredTasks = tasks.filter((t) => {
    const projectName = projectNamesMap?.[t.projectId] || t.projectId;
    const userName = t.userId ? (userNamesMap?.[t.userId] || t.userId) : '';
    const matchesSearch = t.service.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          userName.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (activeFilter === 'running') return t.status === 'running';
    if (activeFilter === 'finished') return t.status === 'finished';
    if (activeFilter === 'failed') return t.status === 'failed';
    if (activeFilter === 'queued') return t.status === 'queued';
    if (activeFilter === 'cancelled') return t.status === 'cancelled';
    
    return true;
  });

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
console.log(tasks)
  return (
    <div className="flex h-full min-h-0 w-full gap-5 overflow-hidden font-sans">
      {/* Left Tasks Grid/Table Panel */}
      <div className="flex flex-1 flex-col min-w-0 space-y-4">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all' as const, label: 'All Tasks' },
              { id: 'running' as const, label: 'Running' },
              { id: 'finished' as const, label: 'Finished' },
              { id: 'failed' as const, label: 'Failed' },
              { id: 'queued' as const, label: 'Queued' },
              { id: 'cancelled' as const, label: 'Cancelled' },
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

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by task ID, service, or project..."
                className="w-full sm:w-64 rounded-lg border border-border-glass bg-[#050811] py-1.5 pl-9 pr-4 text-xs text-text-main placeholder:text-text-faint focus:border-accent-cyan/40 focus:outline-none"
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
        <div className="flex-1 overflow-y-auto pr-1">
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
                                  : t.status === 'queued'
                                  ? 'bg-status-warning shadow-[0_0_6px_#F59E0B]'
                                  : 'bg-text-faint'
                              }`}
                            />
                            {t.status}
                          </span>
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
                        console.log("[TasksView] Clicking on user. selectedTask.userId (Sub ID):", selectedTask.userId, "Username:", ownerName);
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

            {/* Error Message Section */}
            {selectedTask.message && (
              <div className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Log status message
                </span>
                <div className="rounded-xl border border-status-error/10 bg-status-error/5 p-3.5 font-mono text-[10px] text-status-error leading-relaxed max-h-32 overflow-y-auto">
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
