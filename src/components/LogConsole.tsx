import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Terminal, Cloud, Trash2, ChevronDown, Plus, ExternalLink, Loader2, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { apiFetch, getApiUrl, getJwtToken } from '../api';
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

  const [activeTab, setActiveTab] = useState<'logs' | 'warehouse'>('logs');
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [inputDatasets, setInputDatasets] = useState<any[]>([]);
  const [outputDatasets, setOutputDatasets] = useState<any[]>([]);
  const [inputCount, setInputCount] = useState(0);
  const [outputCount, setOutputCount] = useState(0);

  // Scan config object for 24-character hexadecimal MongoDB ObjectIDs
  const extractMongoIds = (obj: any): string[] => {
    const ids: string[] = [];
    const recurse = (val: any) => {
      if (!val) return;
      if (typeof val === 'string') {
        if (/^[0-9a-fA-F]{24}$/.test(val)) {
          ids.push(val);
        }
      } else if (typeof val === 'object') {
        for (const k in val) {
          recurse(val[k]);
        }
      }
    };
    recurse(obj);
    return ids;
  };

  const fetchWarehouseData = async () => {
    if (!task) return;
    console.log("[Warehouse Debug] Starting fetch for task ID:", task.id);
    setWarehouseLoading(true);
    try {
      const baseUrl = getApiUrl().replace(/\/amaretti\/?$/, '/warehouse');
      const token = getJwtToken();
      console.log("[Warehouse Debug] Token present:", !!token, token ? `${token.substring(0, 15)}...${token.slice(-15)}` : "none");
      const headers = new Headers();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      // 1. Fetch Outputs (prov.task_id = task.id OR prov.task._id = task.id OR archive_task_id = task.id)
      const outFind = JSON.stringify({
        $or: [
          { "prov.task_id": task.id },
          { "prov.task._id": task.id },
          { "archive_task_id": task.id }
        ]
      });
      const outUrl = `${baseUrl}/dataset?find=${encodeURIComponent(outFind)}&populate=project%20datatype&limit=100`;
      console.log("[Warehouse Debug] Fetching outputs URL:", outUrl);
      const outResponse = await fetch(outUrl, { headers });
      if (outResponse.ok) {
        const outRes = await outResponse.json();
        console.log("[Warehouse Debug] Raw Outputs Response:", outRes);
        const outList = outRes.datasets || outRes.results || outRes || [];
        console.log("[Warehouse Debug] Output datasets parsed:", outList);
        setOutputDatasets(Array.isArray(outList) ? outList : []);
        setOutputCount(outRes.count || 0);
      } else {
        console.warn("[Warehouse Debug] Output fetch failed with status:", outResponse.status);
      }

      // 2. Fetch Inputs (scan task.config values for 24-character ObjectIDs)
      console.log("[Warehouse Debug] Fetching Amaretti task config details...");
      const taskDetails = await apiFetch<any>(`/task/${task.id}`);
      const taskObj = taskDetails.task || taskDetails;
      console.log("[Warehouse Debug] Task details returned:", taskObj);
      if (taskObj && taskObj.config) {
        const inputIds = extractMongoIds(taskObj.config);
        console.log("[Warehouse Debug] Extracted Input ObjectIDs:", inputIds);
        if (inputIds.length > 0) {
          const inFind = JSON.stringify({ _id: { $in: inputIds } });
          const inUrl = `${baseUrl}/dataset?find=${encodeURIComponent(inFind)}&populate=project%20datatype&limit=100`;
          console.log("[Warehouse Debug] Fetching inputs URL:", inUrl);
          const inResponse = await fetch(inUrl, { headers });
          if (inResponse.ok) {
            const inRes = await inResponse.json();
            console.log("[Warehouse Debug] Raw Inputs Response:", inRes);
            const inList = inRes.datasets || inRes.results || inRes || [];
            console.log("[Warehouse Debug] Input datasets parsed:", inList);
            setInputDatasets(Array.isArray(inList) ? inList : []);
            setInputCount(inRes.count || 0);
          } else {
            console.warn("[Warehouse Debug] Input fetch failed with status:", inResponse.status);
          }
        } else {
          setInputDatasets([]);
          setInputCount(0);
        }
      } else {
        setInputDatasets([]);
        setInputCount(0);
      }
    } catch (err) {
      console.error('[Warehouse Debug] Failed to fetch warehouse datasets error:', err);
    } finally {
      setWarehouseLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'warehouse') {
      fetchWarehouseData();
    }
  }, [task?.id, activeTab]);

  useEffect(() => {
    setActiveTab('logs');
    setInputCount(0);
    setOutputCount(0);
    setInputDatasets([]);
    setOutputDatasets([]);
  }, [task?.id]);

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
  }, [task?.id]);

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

      {/* Tab Switcher */}
      {task && (
        <div className="flex border-b border-white/[0.04] bg-[#050811]/45 shrink-0 px-4 select-none">
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 text-xs font-semibold tracking-wider transition-all duration-150 border-b-2 cursor-pointer ${
              activeTab === 'logs'
                ? 'border-accent-cyan text-accent-cyan bg-white/[0.01]'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            Terminal Logs
          </button>
          <button
            onClick={() => setActiveTab('warehouse')}
            className={`px-4 py-2 text-xs font-semibold tracking-wider transition-all duration-150 border-b-2 cursor-pointer ${
              activeTab === 'warehouse'
                ? 'border-accent-cyan text-accent-cyan bg-white/[0.01]'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            Warehouse Data
          </button>
        </div>
      )}

      {activeTab === 'logs' && (
        <>
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
            <div className="mt-3 grid grid-cols-3 gap-2 select-none">
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
              <div className="flex items-center justify-between border-b border-white/5 bg-[#050811]/90 px-3.5 py-2 shrink-0 select-none">
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
        </>
      )}

      {activeTab === 'warehouse' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 font-sans select-none">
          {warehouseLoading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-text-faint">
              <Loader2 className="h-5 w-5 animate-spin text-accent-cyan" />
              <span>Fetching Warehouse datasets...</span>
            </div>
          ) : !task ? (
            <div className="flex h-64 items-center justify-center text-center text-text-faint px-6 text-xs">
              Select a task to inspect dataset records
            </div>
          ) : (
            <>
              {/* Inputs section */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5 animate-pulse">
                  <ChevronDown className="h-3.5 w-3.5 text-accent-cyan" />
                  Input Datasets ({inputDatasets.length > 0 ? inputDatasets.length : inputCount > 0 ? `${inputCount} Restricted` : '0'})
                </h3>
                {inputDatasets.length === 0 ? (
                  inputCount > 0 ? (
                    <div className="p-3 rounded-xl border border-status-warning/20 bg-status-warning/5 text-xs text-status-warning flex items-start gap-2 ml-4">
                      <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold uppercase tracking-wider text-[9px] mb-0.5">Access Restricted</div>
                        <p className="text-[10px] text-text-muted leading-relaxed">
                          {inputCount} input dataset{inputCount > 1 ? 's' : ''} detected, but access is restricted under your current credentials.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-text-faint pl-5 italic">No input datasets detected for this task.</p>
                  )
                ) : (
                  <div className="space-y-1.5 pl-4">
                    {inputDatasets.map((ds) => (
                      <div key={ds._id} className="p-3 rounded-xl border border-white/[0.03] bg-[#03060f] flex items-center justify-between text-xs hover:border-white/10 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-text-main flex items-center gap-1.5">
                            <span className="text-[9px] uppercase font-bold text-accent-cyan px-1 bg-accent-cyan/15 rounded shrink-0">
                              {ds.datatype?.name?.split('/').pop() || ds.datatype || 'Data'}
                            </span>
                            <span className="truncate font-mono" title={ds.desc || ds._id}>{ds.desc || ds._id.slice(-8)}</span>
                          </div>
                          <div className="text-[9px] text-text-faint mt-1">
                            Storage: <span className="font-mono text-text-muted">{ds.storage || 'S3 Bucket'}</span>
                            {ds.size && ` • ${Math.round(ds.size / 1024 / 1024)} MB`}
                          </div>
                        </div>
                        {ds.download_headers && (
                          <a
                            href={`${getApiUrl().replace(/\/amaretti\/?$/, '/warehouse')}/dataset/download/${ds._id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-accent-cyan hover:text-accent-cyan-dim flex items-center gap-1 hover:underline ml-2 shrink-0"
                          >
                            Download
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outputs section */}
              <div className="space-y-2 pt-2 border-t border-white/[0.03]">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5 animate-pulse">
                  <ChevronDown className="h-3.5 w-3.5 text-accent-cyan" />
                  Generated Outputs ({outputDatasets.length > 0 ? outputDatasets.length : outputCount > 0 ? `${outputCount} Restricted` : '0'})
                </h3>
                {outputDatasets.length === 0 ? (
                  outputCount > 0 ? (
                    <div className="p-3 rounded-xl border border-status-warning/20 bg-status-warning/5 text-xs text-status-warning flex items-start gap-2 ml-4">
                      <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold uppercase tracking-wider text-[9px] mb-0.5">Access Restricted</div>
                        <p className="text-[10px] text-text-muted leading-relaxed">
                          {outputCount} output dataset{outputCount > 1 ? 's' : ''} generated, but access is restricted under your current credentials.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-text-faint pl-5 italic">No output datasets generated yet.</p>
                  )
                ) : (
                  <div className="space-y-1.5 pl-4">
                    {outputDatasets.map((ds) => (
                      <div key={ds._id} className="p-3 rounded-xl border border-white/[0.03] bg-[#03060f] flex items-center justify-between text-xs hover:border-white/10 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-text-main flex items-center gap-1.5">
                            <span className="text-[9px] uppercase font-bold text-status-success px-1 bg-status-success/15 rounded shrink-0">
                              {ds.datatype?.name?.split('/').pop() || ds.datatype || 'Data'}
                            </span>
                            <span className="truncate font-mono" title={ds.desc || ds._id}>{ds.desc || ds._id.slice(-8)}</span>
                          </div>
                          <div className="text-[9px] text-text-faint mt-1">
                            Status: <span className={`font-bold uppercase text-[9px] ${ds.status === 'stored' ? 'text-status-success' : 'text-status-warning'}`}>{ds.status}</span>
                            {ds.size && ` • ${Math.round(ds.size / 1024 / 1024)} MB`}
                          </div>
                        </div>
                        <a
                          href={`${getApiUrl().replace(/\/amaretti\/?$/, '/warehouse')}/dataset/download/${ds._id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-accent-cyan hover:text-accent-cyan-dim flex items-center gap-1 hover:underline ml-2 shrink-0"
                        >
                          Download
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer Diagnostic Panel */}
      <div className="border-t border-white/[0.04] p-4 shrink-0 flex items-center justify-between bg-white/[0.01]">
        <div className="text-xs">
          <span className="text-text-muted">Viewing Task ID:</span>{' '}
          <span className="font-mono font-bold text-accent-cyan">
            {task ? task.id.slice(-8) : '--'}
          </span>
        </div>
        <button 
          onClick={() => activeTab === 'logs' ? fetchLogs(true) : fetchWarehouseData()}
          disabled={!task || (activeTab === 'warehouse' && warehouseLoading)}
          className="flex items-center gap-1.5 rounded-lg border border-border-glass bg-white/[0.02] px-3.5 py-2 text-xs font-semibold text-text-main hover:bg-white/[0.05] hover:border-white/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none select-none"
        >
          <Cloud className="h-4 w-4 text-status-running" />
          <span>{activeTab === 'logs' ? 'Refresh Logs' : 'Refresh Data'}</span>
          <ExternalLink className="h-3.5 w-3.5 text-text-faint" />
        </button>
      </div>
    </div>
  );
}
