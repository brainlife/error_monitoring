import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Terminal, Cloud, Trash2, ChevronDown, Plus, ExternalLink, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '../api';
import type { Task } from '../data';

interface LogLine {
  ts: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'DEBUG' | 'WARNING';
  service: string;
  message: string;
}

interface LogConsoleProps {
  task: Task | null;
}

const levelStyles: Record<LogLine['level'], string> = {
  INFO: 'text-[#00E5FF] font-semibold',
  SUCCESS: 'text-status-success font-semibold',
  WARN: 'text-status-warning font-semibold',
  WARNING: 'text-status-warning font-semibold',
  ERROR: 'text-status-error font-semibold animate-pulse',
  DEBUG: 'text-accent-purple font-semibold',
};

// Heuristic to parse raw text lines into structured LogLine objects
function parseRawLogs(rawText: string, serviceName: string): LogLine[] {
  if (!rawText) return [];
  const rawLines = rawText.split('\n');
  return rawLines
    .filter(line => line.trim().length > 0)
    .map((line, idx) => {
      let level: LogLine['level'] = 'INFO';
      const message = line;
      
      const upperLine = line.toUpperCase();
      if (upperLine.includes('ERROR') || upperLine.includes('FAIL') || upperLine.includes('CRITICAL')) {
        level = 'ERROR';
      } else if (upperLine.includes('SUCCESS') || upperLine.includes('OK') || upperLine.includes('FINISHED')) {
        level = 'SUCCESS';
      } else if (upperLine.includes('WARN')) {
        level = 'WARN';
      } else if (upperLine.includes('DEBUG')) {
        level = 'DEBUG';
      }

      // Generate simulated timestamps for visual premium structure
      const time = new Date();
      time.setSeconds(time.getSeconds() - (rawLines.length - idx));
      const ts = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + `.${(idx * 13) % 1000}`;

      return {
        ts,
        level,
        service: serviceName,
        message
      };
    });
}

export default function LogConsole({ task }: LogConsoleProps) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [visibleLogs, setVisibleLogs] = useState<LogLine[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch logs whenever the selected task changes or search query/filters change
  const fetchLogs = async (showLoading = true) => {
    const trimmedQuery = query.trim();
    const isServiceFilter = activeFilter && !['INFO', 'ERROR', 'WARN', 'SUCCESS', 'WARNING', 'DEBUG'].includes(activeFilter);

    if (trimmedQuery.length > 0 || isServiceFilter) {
      if (showLoading) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (trimmedQuery.length > 0) {
          params.append('q', trimmedQuery);
        }
        if (isServiceFilter && activeFilter) {
          params.append('service', activeFilter);
        }
        if (task) {
          params.append('project_id', task.projectId);
        }

        const response = await apiFetch<{ hits: any[]; total: number }>(`/task/logs/search?${params.toString()}`);
        
        // Map the Elasticsearch hits back to LogLines
        const lines: LogLine[] = [];
        response.hits.forEach(hit => {
          const parsed = parseRawLogs(hit.logs || '', hit.service);
          lines.push(...parsed);
        });
        setVisibleLogs(lines);
      } catch (error) {
        console.error('Failed to search logs in Elasticsearch:', error);
      } finally {
        if (showLoading) setLoading(false);
      }
      return;
    }

    if (!task) {
      setVisibleLogs([]);
      return;
    }

    if (showLoading) setLoading(true);
    try {
      const response = await apiFetch<{ content: string }>(`/task/${task.id}/logs`);
      const parsed = parseRawLogs(response.content || '', task.service);
      setVisibleLogs(parsed);
    } catch (error) {
      console.error(`Failed to fetch logs for task ${task.id}:`, error);
      setVisibleLogs([
        {
          ts: new Date().toLocaleTimeString(),
          level: 'ERROR',
          service: task.service,
          message: `[Dashboard Console Error] Failed to retrieve logs: ${(error as Error).message}`
        }
      ]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(true);
  }, [task]);

  // Debounced log query search from Elasticsearch
  useEffect(() => {
    if (!query && !activeFilter) return;
    const delayDebounce = setTimeout(() => {
      fetchLogs(false);
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [query, activeFilter]);

  // If task is running, poll for live updates every 4 seconds
  useEffect(() => {
    if (!task || task.status !== 'running') return;

    const interval = setInterval(() => {
      fetchLogs(false);
    }, 4000);

    return () => clearInterval(interval);
  }, [task]);

  // Auto-scroll to bottom on new log additions
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleLogs]);

  const filteredLogs = useMemo(() => {
    const q = query.toLowerCase().trim();
    return visibleLogs.filter((l) => {
      const matchesQuery =
        !q ||
        l.message.toLowerCase().includes(q) ||
        l.service.toLowerCase().includes(q) ||
        l.level.toLowerCase().includes(q);
      const matchesFilter =
        !activeFilter ||
        l.service === activeFilter ||
        l.level === activeFilter ||
        l.message.includes(activeFilter);
      return matchesQuery && matchesFilter;
    });
  }, [visibleLogs, query, activeFilter]);

  const handleClear = () => {
    setVisibleLogs([]);
  };

  const quickFilters = useMemo(() => {
    if (!task) return ['INFO', 'ERROR', 'WARN'];
    return ['INFO', 'ERROR', 'WARN', task.service];
  }, [task]);

  const [isCollapsed, setIsCollapsed] = useState(true);

  if (isCollapsed) {
    return (
      <div className="flex h-full w-12 flex-col items-center bg-bg-dark/60 shrink-0 border-l border-border-glass py-4 transition-all duration-300">
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-glass bg-white/[0.01] text-text-muted hover:text-text-main hover:bg-white/[0.03] transition-all cursor-pointer"
          title="Expand console"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="mt-8 flex flex-col items-center gap-1.5">
          <Terminal className="h-4 w-4 text-accent-cyan" />
          {task?.status === 'running' && (
            <span className="h-1.5 w-1.5 rounded-full bg-status-success animate-pulse" />
          )}
        </div>
        <div className="mt-12 select-none font-mono text-[9px] font-bold uppercase tracking-widest text-text-faint [writing-mode:vertical-lr] rotate-180">
          LOG CONSOLE
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg-dark/40 w-[420px] shrink-0 border-l border-border-glass transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-4 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="h-4.5 w-4.5 text-accent-cyan" strokeWidth={1.75} />
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-main flex items-center gap-2">
              Log Console
              {task?.status === 'running' && (
                <span className="flex items-center gap-1 rounded-full bg-status-success/15 px-2 py-0.5 text-[9px] font-bold text-status-success animate-pulse">
                  <span className="h-1 w-1 rounded-full bg-status-success" />
                  LIVE
                </span>
              )}
            </h2>
            <p className="text-[10px] text-text-muted mt-0.5">
              {loading ? 'Retrieving task logs...' : `Total logs: ${visibleLogs.length} events`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleClear}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-glass bg-white/[0.01] text-text-muted hover:text-text-main hover:bg-white/[0.03] transition-all duration-150 cursor-pointer"
            title="Clear console"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsCollapsed(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-glass bg-white/[0.01] text-text-muted hover:text-text-main hover:bg-white/[0.03] transition-all duration-150 cursor-pointer"
            title="Collapse console"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Control panel: Search & Filters */}
      <div className="p-4 border-b border-white/[0.03] shrink-0 bg-white/[0.01]">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search logs... (e.g. ERROR, service)"
            className="w-full rounded-lg border border-border-glass bg-[#050811] py-1.5 pl-9 pr-14 font-mono text-xs text-text-main placeholder:text-text-faint focus:border-accent-cyan/40 focus:outline-none focus:ring-1 focus:ring-accent-cyan/20"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/10 px-1 font-mono text-[9px] text-text-faint">
            ⌘K
          </div>
        </div>

        {/* Dropdowns */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button className="flex items-center justify-between rounded-lg border border-border-glass bg-white/[0.01] px-2.5 py-1.5 text-[10px] font-medium text-text-muted hover:border-white/[0.12] hover:text-text-main transition-colors">
            <span>All Services</span>
            <ChevronDown className="h-3.5 w-3.5 text-text-faint" />
          </button>
          <button className="flex items-center justify-between rounded-lg border border-border-glass bg-white/[0.01] px-2.5 py-1.5 text-[10px] font-medium text-text-muted hover:border-white/[0.12] hover:text-text-main transition-colors">
            <span>All Projects</span>
            <ChevronDown className="h-3.5 w-3.5 text-text-faint" />
          </button>
          <button className="flex items-center justify-between rounded-lg border border-border-glass bg-white/[0.01] px-2.5 py-1.5 text-[10px] font-medium text-text-muted hover:border-white/[0.12] hover:text-text-main transition-colors">
            <span>Last 24h</span>
            <ChevronDown className="h-3.5 w-3.5 text-text-faint" />
          </button>
        </div>

        {/* Quick Filter Chips */}
        <div className="mt-3.5 flex flex-wrap gap-1.5 max-h-[64px] overflow-y-auto pr-1">
          {quickFilters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter((cur) => (cur === f ? null : f))}
              className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-medium transition-all duration-150 ${
                activeFilter === f
                  ? 'bg-accent-cyan/20 text-accent-cyan ring-1 ring-accent-cyan/30'
                  : f === 'ERROR'
                  ? 'bg-status-error/15 text-status-error border border-status-error/20 hover:bg-status-error/25'
                  : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-text-main border border-white/[0.04]'
              }`}
            >
              {f}
            </button>
          ))}
          <button className="flex items-center gap-0.5 rounded border border-dashed border-white/20 bg-transparent px-1.5 py-0.5 font-mono text-[9px] text-text-faint hover:text-text-main hover:border-white/40 transition-colors">
            <Plus className="h-2.5 w-2.5" />
            Add filter
          </button>
        </div>
      </div>

      {/* Terminal panel */}
      <div className="flex-1 min-h-0 p-4">
        <div className="terminal-panel flex h-full flex-col overflow-hidden rounded-xl bg-[#03060f] border border-white/[0.04]">
          {/* Header tabs bar */}
          <div className="flex items-center justify-between border-b border-white/5 bg-[#050811]/90 px-3.5 py-2 shrink-0">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-status-error/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-status-warning/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-status-success/60" />
            </div>
            <span className="font-mono text-[9px] text-text-faint tracking-wider uppercase">
              {activeFilter ? `Filter: ${activeFilter}` : 'amaretti-core logs'}
            </span>
          </div>

          {/* Logs scroll area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[10px] leading-relaxed select-text selection:bg-accent-cyan/25 selection:text-white"
          >
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-text-faint">
                <Loader2 className="h-5 w-5 animate-spin text-accent-cyan" />
                <span>Loading live task logs...</span>
              </div>
            ) : !task ? (
              <div className="flex h-full items-center justify-center text-center text-text-faint px-6">
                Select a task from the dashboard grid to view execution logs
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-text-faint">
                No matching log events
              </div>
            ) : (
              filteredLogs.map((l, i) => {
                const highlightedMessage = l.message
                  .replace(/(\[Task: \S+\])/g, '<span class="text-[#00E5FF] font-semibold">$1</span>')
                  .replace(/(Image: \S+)/g, '<span class="text-accent-purple">$1</span>')
                  .replace(/(Resource: \S+|Node: \S+|JobID: \S+)/g, '<span class="text-status-warning">$1</span>')
                  .replace(/(Exit code: \d+)/g, '<span class="text-status-error font-bold">$1</span>');

                return (
                  <div
                    key={i}
                    className="flex items-start gap-2 border-b border-white/[0.01] py-1.5 transition-colors hover:bg-white/[0.01]"
                  >
                    <span className="shrink-0 text-text-faint select-none">{l.ts}</span>
                    <span className={`shrink-0 select-none uppercase ${levelStyles[l.level] || 'text-[#00E5FF]'}`}>
                      {l.level.padEnd(7)}
                    </span>
                    <span className="shrink-0 text-[#00E5FF] select-none font-semibold">
                      {l.service.split('/').pop()}
                    </span>
                    <span className="text-text-faint select-none">›</span>
                    <span
                      className="text-text-main/90 break-words"
                      dangerouslySetInnerHTML={{ __html: highlightedMessage }}
                    />
                  </div>
                );
              })
            )}

            {task?.status === 'running' && !loading && (
              <div className="flex items-center gap-2 py-1 select-none">
                <span className="text-text-faint text-[9px] tracking-wider uppercase">Streaming logs</span>
                <span className="h-3 w-1.5 animate-pulse bg-accent-cyan" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Diagnostic Panel */}
      <div className="border-t border-white/[0.04] p-4 shrink-0 flex items-center justify-between bg-white/[0.01]">
        <div className="text-xs">
          <span className="text-text-muted">Viewing Task ID:</span>{' '}
          <span className="font-mono font-bold text-accent-cyan">
            {task ? task.id.slice(-8) : '--'}
          </span>
        </div>
        <button 
          onClick={() => fetchLogs(true)}
          disabled={!task}
          className="flex items-center gap-1.5 rounded-lg border border-border-glass bg-white/[0.02] px-3.5 py-2 text-xs font-semibold text-text-main hover:bg-white/[0.05] hover:border-white/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          <Cloud className="h-4 w-4 text-status-running" />
          <span>Refresh Logs</span>
          <ExternalLink className="h-3.5 w-3.5 text-text-faint" />
        </button>
      </div>
    </div>
  );
}
