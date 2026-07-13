import { useState, useMemo, useEffect } from 'react';
import { 
  AlertOctagon, 
  CheckCircle, 
  User, 
  ShieldAlert, 
  Activity, 
  Eye 
} from 'lucide-react';
import type { Task } from '../data';
import { apiFetch } from '../api';

interface Incident {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  status: 'Triggered' | 'Acknowledged' | 'Resolved';
  resource: string;
  triggeredAt: string;
  duration: string;
  assignee: string | null;
  message: string;
  taskId?: string;
}

function getTimelineTimes(triggeredAt: string) {
  let baseHour = 3;
  let baseMin = 21;

  const timeMatch = triggeredAt.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    baseHour = parseInt(timeMatch[1], 10);
    baseMin = parseInt(timeMatch[2], 10);
    
    if (triggeredAt.toLowerCase().includes('pm') && baseHour < 12) {
      baseHour += 12;
    }
    if (triggeredAt.toLowerCase().includes('am') && baseHour === 12) {
      baseHour = 0;
    }
  } else {
    // If relative format like "July 11, 01:05", try parsing that format
    const longTimeMatch = triggeredAt.match(/(\d{1,2}):(\d{2})/);
    if (longTimeMatch) {
      baseHour = parseInt(longTimeMatch[1], 10);
      baseMin = parseInt(longTimeMatch[2], 10);
    } else {
      // fallback
      baseHour = 3;
      baseMin = 21;
    }
  }

  const formatTime = (h: number, m: number) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h % 24)}:${pad(m % 60)}`;
  };

  const t1 = formatTime(baseHour, baseMin);
  const t2 = formatTime(baseHour + Math.floor((baseMin + 3) / 60), (baseMin + 3) % 60);
  const t3 = formatTime(baseHour + Math.floor((baseMin + 5) / 60), (baseMin + 5) % 60);
  const t4 = formatTime(baseHour + Math.floor((baseMin + 9) / 60), (baseMin + 9) % 60);

  return [t1, t2, t3, t4];
}

interface IncidentsViewProps {
  tasks: Task[];
  usersList: { _id: string; sub: number; username: string; fullname: string; scopes?: { brainlife?: string[] } }[];
  onNavigateToTask?: (taskId: string) => void;
  onNavigateToResource?: (resourceName: string) => void;
  initialSelectedIncidentId?: string | null;
}

export default function IncidentsView({ 
  tasks, 
  usersList,
  onNavigateToTask,
  onNavigateToResource,
  initialSelectedIncidentId
}: IncidentsViewProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('active');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  
  const [taskLogs, setTaskLogs] = useState<string>('');
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  useEffect(() => {
    if (initialSelectedIncidentId) {
      setSelectedIncidentId(initialSelectedIncidentId);
    }
  }, [initialSelectedIncidentId]);
  
  // Custom manual incidents list state
  const [incidents, setIncidents] = useState<Incident[]>([]);

  // Filter team options dynamically for task force assignment (admins who have both user and admin scopes)
  const adminUsers = useMemo(() => {
    return usersList
      .filter(u => {
        const blScopes = u.scopes?.brainlife;
        if (!blScopes) return false;
        return blScopes.includes('user') && blScopes.includes('admin');
      })
      .map(u => u.fullname || u.username);
  }, [usersList]);

  const teamList = useMemo(() => {
    const list = [...adminUsers];
    if (list.length === 0) {
      // Fallback baseline team list if API returns empty
      return ['Patrick Filima', 'Niklas', 'Ferdinand', 'syurk', 'Unassigned'];
    }
    if (!list.includes('Unassigned')) {
      list.push('Unassigned');
    }
    return list;
  }, [adminUsers]);

  // Initialize/refresh incidents combining static system issues and live task errors
  useEffect(() => {
    // 1. Static base infrastructure incidents
    const baseIncidents: Incident[] = [
      {
        id: 'inc-sys-101',
        title: 'IU Karst SSH Host Unreachable',
        severity: 'CRITICAL',
        status: 'Triggered',
        resource: 'Karst',
        triggeredAt: 'July 11, 01:05',
        duration: '18m',
        assignee: null,
        message: 'Ping requests to IU Karst cluster SSH gateway timed out. Automation scripts fail to allocate batch processes.'
      },
      {
        id: 'inc-sys-102',
        title: 'Archive Storage Node: Disk space alert',
        severity: 'WARNING',
        status: 'Acknowledged',
        resource: 'Carbonate Storage Node',
        triggeredAt: 'July 10, 22:15',
        duration: '3h 8m',
        assignee: 'Niklas',
        message: 'Carbonate cluster archive filesystem has reached 91% capacity threshold. Predictive storage AI expects depletion in 90 days.'
      },
      {
        id: 'inc-sys-103',
        title: 'Database Replication Lag Spike',
        severity: 'INFO',
        status: 'Resolved',
        resource: 'mongodb',
        triggeredAt: 'July 10, 19:30',
        duration: '12m',
        assignee: 'Ferdinand',
        message: 'MongoDB replica set nodes reported synchronization latency above 5 seconds. Automatically resolved by write-concern reconciliation.'
      }
    ];

    // 2. Scan live task list for failures and inject as critical incidents
    const failedTasks = tasks.filter(t => t.status === 'failed');
    const taskIncidents: Incident[] = failedTasks.map((t) => {
      // Create a deterministic triggered time from task metadata
      const timeStr = t.startedAt !== '--' ? t.startedAt : 'Recently';
      return {
        id: `inc-task-${t.id.slice(-6)}`,
        title: `Pipeline Execution Failure: ${t.service.split('/').pop()}`,
        severity: 'CRITICAL',
        status: 'Triggered',
        resource: t.resource || 'Unknown cluster',
        triggeredAt: timeStr,
        duration: t.duration !== '--' ? t.duration : '8m',
        assignee: null,
        message: t.message || `The brainlife execution worker encountered a critical error during task process. Task ID: ${t.id}`,
        taskId: t.id
      };
    });

    const incomingList = [...taskIncidents, ...baseIncidents];

    setIncidents(prev => {
      // Map existing status and assignee by incident ID to preserve local state
      const stateMap: Record<string, { status: Incident['status']; assignee: string | null }> = {};
      prev.forEach(inc => {
        stateMap[inc.id] = { status: inc.status, assignee: inc.assignee };
      });

      return incomingList.map(inc => {
        const localState = stateMap[inc.id];
        if (localState) {
          return {
            ...inc,
            status: localState.status,
            assignee: localState.assignee
          };
        }
        return inc;
      });
    });
  }, [tasks]);

  // Acknowledge incident handler
  const handleAcknowledge = (id: string, assignee: string) => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id === id) {
        return {
          ...inc,
          status: 'Acknowledged',
          assignee: assignee === 'Unassigned' ? null : assignee
        };
      }
      return inc;
    }));
  };

  // Resolve incident handler
  const handleResolve = (id: string) => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id === id) {
        return {
          ...inc,
          status: 'Resolved',
          duration: inc.status === 'Triggered' ? 'Under 1 min' : inc.duration
        };
      }
      return inc;
    }));
  };

  // Assign user owner handler
  const handleAssign = (id: string, assignee: string) => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id === id) {
        return {
          ...inc,
          assignee: assignee === 'Unassigned' ? null : assignee,
          status: inc.status === 'Triggered' ? 'Acknowledged' : inc.status
        };
      }
      return inc;
    }));
  };

  // Filtered list computed from current selections
  const filteredList = useMemo(() => {
    return incidents.filter(inc => {
      if (filter === 'active') return inc.status === 'Triggered' || inc.status === 'Acknowledged';
      if (filter === 'resolved') return inc.status === 'Resolved';
      return true;
    });
  }, [incidents, filter]);

  // Get selected incident details
  const selectedIncident = useMemo(() => {
    return incidents.find(inc => inc.id === selectedIncidentId) || null;
  }, [incidents, selectedIncidentId]);

  // Load logs for the selected incident if it corresponds to a task failure
  useEffect(() => {
    if (!selectedIncident || !selectedIncident.taskId) {
      setTaskLogs('');
      return;
    }

    const fetchIncidentLogs = async () => {
      setLoadingLogs(true);
      try {
        const response = await apiFetch<{ content: string }>(`/task/${selectedIncident.taskId}/logs`);
        if (response && response.content) {
          // Grab warning/error lines if any, otherwise grab the last 15 lines of stdout
          const lines = response.content.split('\n');
          const errorLines = lines.filter(l => {
            const upper = l.toUpperCase();
            return upper.includes('ERROR') || upper.includes('FAIL') || upper.includes('CRITICAL');
          });
          if (errorLines.length > 0) {
            setTaskLogs(errorLines.slice(-10).join('\n'));
          } else {
            setTaskLogs(lines.slice(-15).join('\n'));
          }
        } else {
          setTaskLogs('No logs found for this task execution.');
        }
      } catch (err) {
        console.error('Failed to retrieve task logs for incident diagnostic:', err);
        setTaskLogs(`[Diagnostic Error] Failed to fetch task logs: ${(err as Error).message}`);
      } finally {
        setLoadingLogs(false);
      }
    };

    fetchIncidentLogs();
  }, [selectedIncidentId, selectedIncident?.taskId]);

  // Generate timeline steps dynamically for the selected incident
  const timelineSteps = useMemo(() => {
    if (!selectedIncident) return [];

    const times = getTimelineTimes(selectedIncident.triggeredAt);
    
    let step2Label = 'Assigned';
    if (selectedIncident.assignee) {
      step2Label = `Assigned to ${selectedIncident.assignee}`;
    }

    let step3Label = 'Resource restarted';
    const res = selectedIncident.resource.toLowerCase();
    if (res.includes('karst')) {
      step3Label = 'Failover cluster routing initialized';
    } else if (res.includes('mongo')) {
      step3Label = 'Replica write-concern reconciled';
    } else if (res.includes('storage')) {
      step3Label = 'Storage archive migration triggered';
    } else if (selectedIncident.id.includes('task')) {
      step3Label = 'Container resource restarted';
    }

    const steps = [
      {
        time: times[0],
        label: 'Incident created',
        status: 'completed' as const
      },
      {
        time: times[1],
        label: step2Label,
        status: (selectedIncident.status === 'Acknowledged' || selectedIncident.status === 'Resolved') ? 'completed' as const : 'current' as const
      },
      {
        time: times[2],
        label: step3Label,
        status: selectedIncident.status === 'Resolved' ? 'completed' as const : (selectedIncident.status === 'Acknowledged' ? 'current' as const : 'pending' as const)
      },
      {
        time: times[3],
        label: 'Resolved',
        status: selectedIncident.status === 'Resolved' ? 'completed' as const : 'pending' as const
      }
    ];

    return steps;
  }, [selectedIncident]);

  // Aggregate KPI stats
  const stats = useMemo(() => {
    const triggered = incidents.filter(i => i.status === 'Triggered').length;
    const acked = incidents.filter(i => i.status === 'Acknowledged').length;
    const resolved = incidents.filter(i => i.status === 'Resolved').length;
    const critical = incidents.filter(i => i.severity === 'CRITICAL' && i.status !== 'Resolved').length;

    return {
      triggered,
      acked,
      resolved,
      critical
    };
  }, [incidents]);

  return (
    <div className="flex h-full min-h-0 w-full gap-5 overflow-hidden font-sans text-text-main">
      
      {/* Left Incident List Grid */}
      <div className="flex flex-1 flex-col min-w-0 space-y-4">
        
        {/* Header Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex gap-1.5">
            {[
              { id: 'active' as const, label: 'Active Incidents' },
              { id: 'resolved' as const, label: 'Resolved History' },
              { id: 'all' as const, label: 'All Incidents' }
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setFilter(btn.id)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  filter === btn.id
                    ? 'bg-accent-cyan/15 text-accent-cyan ring-1 ring-accent-cyan/20'
                    : 'bg-white/[0.01] border border-border-glass text-text-muted hover:text-text-main hover:bg-white/[0.03]'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[10px] text-text-muted font-mono">
            <Activity className="h-3.5 w-3.5 text-accent-cyan animate-pulse" />
            <span>INCIDENT WATCHDOG ACTIVE</span>
          </div>
        </div>

        {/* Operational KPI summary metrics */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 shrink-0">
          {[
            { label: 'Active Alarms', val: stats.triggered, color: 'text-status-error', bg: 'bg-status-error/5 border-status-error/15' },
            { label: 'Under Review', val: stats.acked, color: 'text-status-warning', bg: 'bg-status-warning/5 border-status-warning/15' },
            { label: 'Resolved Today', val: stats.resolved, color: 'text-status-success', bg: 'bg-status-success/5 border-status-success/15' },
            { label: 'Critical Severity', val: stats.critical, color: 'text-accent-purple', bg: 'bg-accent-purple/5 border-accent-purple/15' }
          ].map((card, idx) => (
            <div key={idx} className={`glass rounded-2xl border p-4.5 flex flex-col justify-between ${card.bg}`}>
              <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">{card.label}</span>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className={`font-mono text-xl font-bold tracking-tight ${card.color}`}>{card.val}</span>
                <span className="text-[8px] text-text-faint font-semibold uppercase tracking-wider font-mono">Real-time</span>
              </div>
            </div>
          ))}
        </div>

        {/* Table List container */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="glass overflow-hidden rounded-2xl border border-border-glass bg-bg-dark/20">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs select-none">
                <thead>
                  <tr className="border-b border-white/[0.04] bg-white/[0.01] font-mono text-[9px] font-bold uppercase tracking-wider text-text-faint">
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Alarm Description</th>
                    <th className="px-4 py-3">Source Node</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Triggered At</th>
                    <th className="px-4 py-3">Active Duration</th>
                    <th className="px-4 py-3">Assignee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02] text-text-muted">
                  {filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-xs text-text-faint font-semibold">
                        No active system incidents or outages detected
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((inc) => {
                      const isSelected = selectedIncidentId === inc.id;
                      
                      const sevColors = 
                        inc.severity === 'CRITICAL' ? 'text-status-error bg-status-error/5 border border-status-error/15 font-bold shadow-[0_0_6px_rgba(239,68,68,0.1)]' :
                        inc.severity === 'WARNING' ? 'text-status-warning bg-status-warning/5 border border-status-warning/15 font-bold' :
                        'text-accent-cyan bg-accent-cyan/5 border border-accent-cyan/15 font-bold';

                      const statusColors = 
                        inc.status === 'Triggered' ? 'text-status-error bg-status-error/5 border-status-error/15 font-bold animate-pulse' :
                        inc.status === 'Acknowledged' ? 'text-status-warning bg-status-warning/5 border-status-warning/15' :
                        'text-status-success bg-status-success/5 border-status-success/15';

                      return (
                        <tr
                          key={inc.id}
                          onClick={() => setSelectedIncidentId(isSelected ? null : inc.id)}
                          className={`hover:bg-white/[0.01] cursor-pointer transition-colors duration-150 ${
                            isSelected ? 'bg-accent-cyan/5 text-white font-bold' : ''
                          }`}
                        >
                          {/* Severity */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex rounded-md px-2 py-0.5 text-[9px] uppercase tracking-wider ${sevColors}`}>
                              {inc.severity}
                            </span>
                          </td>

                          {/* Title */}
                          <td className="px-4 py-3 font-semibold text-text-main max-w-[200px] truncate" title={inc.title}>
                            {inc.title}
                          </td>

                          {/* Source Node */}
                          <td className="px-4 py-3 font-mono text-[10px] font-semibold whitespace-nowrap">
                            {inc.resource}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider ${statusColors}`}>
                              <span className={`h-1 w-1 rounded-full ${
                                inc.status === 'Triggered' ? 'bg-status-error animate-ping' :
                                inc.status === 'Acknowledged' ? 'bg-status-warning' :
                                'bg-status-success'
                              }`} />
                              {inc.status}
                            </span>
                          </td>

                          {/* Triggered At */}
                          <td className="px-4 py-3 text-text-faint whitespace-nowrap">
                            {inc.triggeredAt}
                          </td>

                          {/* Duration */}
                          <td className="px-4 py-3 font-mono text-[10px] text-text-faint whitespace-nowrap">
                            {inc.duration}
                          </td>

                          {/* Assignee */}
                          <td className="px-4 py-3 font-semibold text-text-faint whitespace-nowrap">
                            {inc.assignee ? (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3 text-accent-cyan" />
                                {inc.assignee}
                              </span>
                            ) : (
                              <span className="text-text-faint italic font-normal">Unassigned</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Right Incident Diagnostics Inspector Panel */}
      <div className="w-[320px] shrink-0 overflow-y-auto rounded-2xl border border-border-glass bg-bg-dark/45 p-5 space-y-5">
        {selectedIncident ? (
          <>
            {/* Header Title */}
            <div className="border-b border-white/[0.04] pb-4.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <AlertOctagon className="h-4.5 w-4.5 text-status-error" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-text-faint font-mono">Incident Diagnostics</span>
              </div>
              <h3 className="text-sm font-bold text-white leading-tight">
                {selectedIncident.title}
              </h3>
              <p className="font-mono text-[9px] text-text-faint tracking-tight break-all uppercase">
                ID: {selectedIncident.id}
              </p>
            </div>

            {/* Incident Details Metadata list */}
            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center border-b border-white/[0.02] pb-1.5">
                <span className="text-text-faint font-mono text-[9px] uppercase">Node Resource</span>
                <button
                  onClick={() => onNavigateToResource?.(selectedIncident.resource)}
                  className="font-semibold text-accent-cyan font-mono hover:underline cursor-pointer transition-colors text-right"
                >
                  {selectedIncident.resource} →
                </button>
              </div>

              <div className="flex justify-between items-center border-b border-white/[0.02] pb-1.5">
                <span className="text-text-faint font-mono text-[9px] uppercase">Triggered At</span>
                <span className="font-semibold text-text-main">{selectedIncident.triggeredAt}</span>
              </div>

              <div className="flex justify-between items-center border-b border-white/[0.02] pb-1.5">
                <span className="text-text-faint font-mono text-[9px] uppercase">Duration Active</span>
                <span className="font-mono font-semibold text-text-main">{selectedIncident.duration}</span>
              </div>

              <div className="flex justify-between items-center border-b border-white/[0.02] pb-1.5">
                <span className="text-text-faint font-mono text-[9px] uppercase">Current Assignee</span>
                <span className="font-semibold text-text-main">
                  {selectedIncident.assignee || 'Unassigned'}
                </span>
              </div>
            </div>

            {/* Error Message logs */}
            <div className="space-y-2">
              <span className="text-text-faint font-mono text-[9px] uppercase block">Diagnostics Details</span>
              <div className="rounded-xl border border-white/[0.03] bg-[#050811] p-3 text-[10px] text-text-muted leading-relaxed font-mono whitespace-pre-wrap max-h-48 overflow-y-auto select-text selection:bg-accent-cyan/25 selection:text-white">
                {loadingLogs ? (
                  <span className="text-text-faint italic animate-pulse">Fetching incident logs from Elasticsearch...</span>
                ) : (
                  taskLogs || selectedIncident.message
                )}
              </div>
            </div>

            {/* Incident Timeline */}
            <div className="space-y-3 border-t border-white/[0.04] pt-4">
              <span className="text-text-faint font-mono text-[9px] uppercase block">Incident Timeline</span>
              <div className="relative space-y-3 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-[1px] before:bg-white/[0.08]">
                {timelineSteps.map((step, idx) => {
                  const isCompleted = step.status === 'completed';
                  const isCurrent = step.status === 'current';
                  const isPending = step.status === 'pending';

                  return (
                    <div key={idx} className="relative pl-6 text-[11px] flex items-center justify-between min-h-[20px]">
                      {/* Timeline dot */}
                      <span className={`absolute left-[5px] top-1/2 -translate-y-1/2 h-2 w-2 rounded-full border ${
                        isCompleted 
                          ? 'bg-status-success border-status-success/35 shadow-[0_0_6px_rgba(16,185,129,0.5)]' 
                          : isCurrent 
                          ? 'bg-status-warning border-status-warning/35 animate-pulse shadow-[0_0_6px_rgba(245,158,11,0.5)]' 
                          : 'bg-[#050811] border-white/10 text-text-faint'
                      }`} />
                      
                      <span className={`font-semibold leading-tight pr-2 ${isPending ? 'text-text-faint italic font-normal' : 'text-text-main font-bold'}`}>
                        {step.label}
                      </span>
                      
                      <span className="font-mono text-[9px] text-text-faint font-bold leading-none shrink-0">
                        {step.time}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action operations controls */}
            <div className="space-y-3.5 border-t border-white/[0.04] pt-4.5">
              
              {/* Owner Assignment selection */}
              <div className="space-y-1.5">
                <span className="text-text-faint font-mono text-[9px] uppercase block">Assign Task Force</span>
                <select
                  value={selectedIncident.assignee || 'Unassigned'}
                  onChange={(e) => handleAssign(selectedIncident.id, e.target.value)}
                  className="w-full rounded-lg border border-border-glass bg-[#050811] py-1.5 px-3 text-xs text-text-main focus:border-accent-cyan/40 focus:outline-none cursor-pointer"
                >
                  {teamList.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Status Update Action Buttons */}
              <div className="flex gap-2">
                {selectedIncident.status === 'Triggered' && (
                  <button
                    onClick={() => handleAcknowledge(selectedIncident.id, 'Patrick Filima')}
                    className="flex-1 flex justify-center items-center gap-1.5 rounded-lg bg-accent-cyan py-2 px-3 text-xs font-bold text-[#050811] hover:bg-accent-cyan-dim active:scale-[0.98] transition-all cursor-pointer shadow-[0_0_12px_rgba(0,229,255,0.2)]"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Acknowledge
                  </button>
                )}
                
                {selectedIncident.status !== 'Resolved' && (
                  <button
                    onClick={() => handleResolve(selectedIncident.id)}
                    className="flex-1 flex justify-center items-center gap-1.5 rounded-lg border border-status-success/20 bg-status-success/5 py-2 px-3 text-xs font-bold text-status-success hover:bg-status-success/10 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Resolve
                  </button>
                )}
              </div>
            </div>

            {selectedIncident.taskId && (
              <div className="border-t border-white/[0.04] pt-4 text-[9px] text-text-faint font-mono leading-relaxed">
                🔗 Mapped Task ID:{' '}
                <button
                  onClick={() => onNavigateToTask?.(selectedIncident.taskId!)}
                  className="text-accent-cyan hover:underline cursor-pointer font-bold inline-block mt-0.5 text-left"
                >
                  {selectedIncident.taskId} →
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center space-y-2 select-none">
            <ShieldAlert className="h-9 w-9 text-text-faint" strokeWidth={1.5} />
            <div>
              <span className="text-xs font-semibold text-text-muted block">No Incident Selected</span>
              <span className="text-[10px] text-text-faint mt-1 block">Click any card row in the table to display diagnostic details and update status</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
