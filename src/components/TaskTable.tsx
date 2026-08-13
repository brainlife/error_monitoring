import { useMemo, useState } from 'react';
import type { Task, TaskStatus } from '../data';
import { Cloud, Server, Cpu, Terminal, ArrowUpRight } from 'lucide-react';
import { useDashboardStore } from '../store/useDashboardStore';

interface TaskTableProps {
  tasks: Task[];
  onSelect: (task: Task) => void;
  selectedId: string | null;
  projectNamesMap?: Record<string, string>;
  userNamesMap?: Record<string, string>;
  onNavigateToResource?: (resourceName: string) => void;
  onNavigateToUser?: (userId: string) => void;
}

const statusConfig: Record<TaskStatus, { label: string; dot: string; text: string }> = {
  requested: { label: 'Requested', dot: 'bg-status-warning shadow-[0_0_6px_#F59E0B] animate-pulse', text: 'text-status-warning' },
  running: { label: 'Running', dot: 'bg-status-running shadow-[0_0_8px_#00E5FF] animate-pulse', text: 'text-status-running' },
  finished: { label: 'Succeeded', dot: 'bg-status-success shadow-[0_0_6px_#10B981]', text: 'text-status-success' },
  failed: { label: 'Failed', dot: 'bg-status-error shadow-[0_0_6px_#EF4444]', text: 'text-status-error' },
  queued: { label: 'Queued', dot: 'bg-status-warning shadow-[0_0_6px_#F59E0B]', text: 'text-status-warning' },
  cancelled: { label: 'Cancelled', dot: 'bg-text-faint', text: 'text-text-muted' },
  unknown: { label: 'Unknown', dot: 'bg-accent-purple', text: 'text-accent-purple' },
};

export default function TaskTable({ 
  tasks, 
  onSelect, 
  selectedId, 
  projectNamesMap, 
  userNamesMap,
  onNavigateToResource,
  onNavigateToUser
}: TaskTableProps) {
  const [showAll, setShowAll] = useState(false);
  const { projectsList, instancesList } = useDashboardStore();

  const sorted = useMemo(() => {
    // Sort so running and queued are on top
    const order: Record<TaskStatus, number> = {
      running: 0,
      queued: 1,
      requested: 1,
      failed: 2,
      finished: 3,
      cancelled: 4,
      unknown: 5,
    };
    return [...tasks].sort((a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99));
  }, [tasks]);

  const displayedTasks = useMemo(() => {
    return showAll ? sorted : sorted.slice(0, 8);
  }, [sorted, showAll]);
  // console.log("tasks", tasks);
  return (
    <div className="glass overflow-hidden rounded-2xl w-full border border-border-glass">
      {/* Table Header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-main">
            Recent Tasks
          </h2>
          <p className="text-[10px] text-text-muted mt-0.5">Latest task executions</p>
        </div>
        <button className="flex items-center gap-1 text-[11px] font-semibold text-accent-cyan hover:text-accent-cyan-dim transition-colors">
          View all tasks
          <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/[0.04] text-[10px] uppercase tracking-wider text-text-faint bg-white/[0.01]">
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Task ID</th>
              <th className="px-5 py-3 font-medium">Service</th>
              <th className="px-5 py-3 font-medium">Project</th>
              <th className="px-5 py-3 font-medium">instance_id</th>
              <th className="px-5 py-3 font-medium">Resource</th>
              <th className="px-5 py-3 font-medium">Runtime</th>
              <th className="px-5 py-3 font-medium">Created</th>
              <th className="px-5 py-3 font-medium">Started</th>
              <th className="px-5 py-3 font-medium">Message</th>
              <th className="px-5 py-3 font-medium">User</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02]">
            {displayedTasks.map((t) => {
              const cfg = statusConfig[t.status] || statusConfig.unknown;
              const userId = t.userId;
              const resource = t.resource;

              // Resolve resource icon
              let RIcon = Server;
              if (t.runtime.includes('AWS')) {
                RIcon = Cloud;
              } else if (t.runtime.includes('Docker')) {
                RIcon = Terminal;
              } else if (t.runtime.includes('BigRed3')) {
                RIcon = Cpu;
              }
              // Resolve project ID with fallbacks
              let resolvedProjId = t.realProjectId || 'Unknown';
              let resolvedProjName = resolvedProjId !== 'Unknown' ? projectNamesMap?.[resolvedProjId] : '';

              if (resolvedProjId === 'Unknown') {
                // Fallback 1: Find another task with same instance_id that has a resolved project ID
                const sibling = tasks.find(s => s.projectId === t.projectId && s.realProjectId && s.realProjectId !== 'Unknown');
                if (sibling && sibling.realProjectId) {
                  resolvedProjId = sibling.realProjectId;
                  resolvedProjName = projectNamesMap?.[resolvedProjId] || '';
                }
              }

              if (resolvedProjId === 'Unknown') {
                // Fallback 2: Map using the instance's group_id
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
                <tr
                  key={t.id}
                  onClick={() => onSelect(t)}
                  className={`group cursor-pointer transition-all duration-200 hover:bg-white/[0.02] ${
                    selectedId === t.id ? 'bg-accent-cyan/[0.04]' : ''
                  }`}
                >
                  {/* Status */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      <span className={`font-semibold ${cfg.text}`}>{cfg.label}</span>
                    </div>
                  </td>

                  {/* Task ID */}
                  <td className="px-5 py-3.5 font-mono font-medium text-accent-cyan whitespace-nowrap">
                    {resolvedProjId !== 'Unknown' ? (
                      <a
                        href={`https://brainlife.io/project/${resolvedProjId}/process/${t.projectId}#task-${t.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline hover:text-accent-cyan-dim cursor-pointer transition-colors"
                      >
                        {t.id.slice(-8)}
                      </a>
                    ) : (
                      <span>{t.id.slice(-8)}</span>
                    )}
                  </td>

                  {/* Service */}
                  <td className="px-5 py-3.5 font-mono text-text-main whitespace-nowrap">
                    {t.service.split('/').pop()}
                  </td>

                  {/* Project */}
                  <td className="px-5 py-3.5 font-sans whitespace-nowrap max-w-[140px] truncate" title={resolvedProjId}>
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
                  <td className="px-5 py-3.5 font-sans whitespace-nowrap max-w-[140px] truncate" title={t.projectId}>
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

                  {/* Resource */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToResource?.(resource);
                      }}
                      className="flex items-center gap-2 text-text-muted hover:text-accent-cyan hover:underline cursor-pointer transition-colors text-left"
                    >
                      <RIcon className="h-3.5 w-3.5 text-text-faint group-hover:text-accent-cyan transition-colors" strokeWidth={1.75} />
                      <span>{resource}</span>
                    </button>
                  </td>

                  {/* Runtime (duration) */}
                  <td className="px-5 py-3.5 font-mono text-text-faint whitespace-nowrap">
                    {t.duration}
                  </td>

                  {/* Created At */}
                  <td className="px-5 py-3.5 text-text-faint font-mono whitespace-nowrap">
                    {t.createDate ? (() => {
                      const d = new Date(t.createDate);
                      const dateStr = d.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
                      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                      return `${dateStr} ${timeStr}`;
                    })() : '--'}
                  </td>

                  {/* Started At */}
                  <td className="px-5 py-3.5 text-text-muted whitespace-nowrap">
                    {t.startedAt}
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
                  <td className="px-5 py-3.5 text-text-muted font-semibold whitespace-nowrap">
                    {userId ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // console.log("[TaskTable] Clicking on user. t.userId (Sub ID):", userId, "Username:", userNamesMap?.[userId] || 'Unknown');
                          onNavigateToUser?.(userId);
                        }}
                        className="hover:text-accent-cyan hover:underline cursor-pointer transition-colors text-left font-semibold"
                      >
                        {userNamesMap?.[userId] || userId}
                      </button>
                    ) : '--'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sorted.length > 8 && (
        <div className="flex justify-center border-t border-white/[0.04] p-3 bg-white/[0.01]">
          <button
            onClick={() => setShowAll(!showAll)}
            className="rounded-lg border border-border-glass bg-white/[0.01] px-4 py-2 text-xs font-semibold text-accent-cyan hover:bg-white/[0.03] hover:text-accent-cyan-dim transition-all cursor-pointer select-none animate-fade-up"
          >
            {showAll ? 'Show Less' : `Read More (${sorted.length - 8} more tasks)`}
          </button>
        </div>
      )}
    </div>
  );
}
