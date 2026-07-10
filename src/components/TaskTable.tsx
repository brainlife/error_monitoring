import { useMemo } from 'react';
import type { Task } from '../data';
import { Cloud, Server, Cpu, Terminal, ArrowUpRight } from 'lucide-react';

interface TaskTableProps {
  tasks: Task[];
  onSelect: (task: Task) => void;
  selectedId: string | null;
  projectNamesMap?: Record<string, string>;
  userNamesMap?: Record<string, string>;
}

const statusConfig = {
  running: { label: 'Running', dot: 'bg-status-running shadow-[0_0_8px_#00E5FF] animate-pulse', text: 'text-status-running' },
  finished: { label: 'Succeeded', dot: 'bg-status-success shadow-[0_0_6px_#10B981]', text: 'text-status-success' },
  failed: { label: 'Failed', dot: 'bg-status-error shadow-[0_0_6px_#EF4444]', text: 'text-status-error' },
  queued: { label: 'Queued', dot: 'bg-status-warning shadow-[0_0_6px_#F59E0B]', text: 'text-status-warning' },
  cancelled: { label: 'Cancelled', dot: 'bg-text-faint', text: 'text-text-muted' },
  unknown: { label: 'Unknown', dot: 'bg-accent-purple', text: 'text-accent-purple' },
};

export default function TaskTable({ tasks, onSelect, selectedId, projectNamesMap, userNamesMap }: TaskTableProps) {
  const sorted = useMemo(() => {
    // Sort so running and queued are on top
    const order = { running: 0, queued: 1, failed: 2, finished: 3, cancelled: 4, unknown: 5 };
    return [...tasks].sort((a, b) => order[a.status] - order[b.status]);
  }, [tasks]);

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
              <th className="px-5 py-3 font-medium">Resource</th>
              <th className="px-5 py-3 font-medium">Runtime</th>
              <th className="px-5 py-3 font-medium">Started</th>
              <th className="px-5 py-3 font-medium">Message</th>
              <th className="px-5 py-3 font-medium">User</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02]">
            {sorted.map((t) => {
              const cfg = statusConfig[t.status] || statusConfig.unknown;

              // Resolve resource icon
              let RIcon = Server;
              if (t.runtime.includes('AWS')) {
                RIcon = Cloud;
              } else if (t.runtime.includes('Docker')) {
                RIcon = Terminal;
              } else if (t.runtime.includes('BigRed3')) {
                RIcon = Cpu;
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
                    {t.id.slice(-8)}
                  </td>

                  {/* Service */}
                  <td className="px-5 py-3.5 font-mono text-text-main whitespace-nowrap">
                    {t.service.split('/').pop()}
                  </td>

                  {/* Project */}
                  <td className="px-5 py-3.5 font-sans text-text-faint whitespace-nowrap max-w-[140px] truncate" title={t.projectId}>
                    {projectNamesMap?.[t.projectId] || t.projectId.slice(-6)}
                  </td>

                  {/* Resource */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-text-muted">
                      <RIcon className="h-3.5 w-3.5 text-text-faint" strokeWidth={1.75} />
                      <span>{t.resource}</span>
                    </div>
                  </td>

                  {/* Runtime (duration) */}
                  <td className="px-5 py-3.5 font-mono text-text-faint whitespace-nowrap">
                    {t.duration}
                  </td>

                  {/* Started At */}
                  <td className="px-5 py-3.5 text-text-muted whitespace-nowrap">
                    {t.startedAt}
                  </td>

                  {/* Message */}
                  <td className="px-5 py-3.5 text-text-muted truncate max-w-[200px]" title={t.message}>
                    {t.message}
                  </td>

                  {/* User */}
                  <td className="px-5 py-3.5 text-text-muted font-semibold whitespace-nowrap">
                    {t.userId ? (userNamesMap?.[t.userId] || t.userId) : '--'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
