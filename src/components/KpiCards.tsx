import { useMemo } from 'react';
import { Activity, CheckCircle2, XCircle, Clock, Heart, AlertTriangle, ShieldAlert, Server } from 'lucide-react';
import { useCountUp } from '../hooks/useCountUp';
import { useDashboardStore } from '../store/useDashboardStore';

import type { Task, ComputeResource } from '../data';

interface KpiCardsProps {
  running: number;
  finished: number;
  failed: number;
  total: number;
  resources: ComputeResource[];
  tasks: Task[];
  onNavigate?: (v: 'dashboard' | 'resources' | 'services' | 'tasks' | 'analytics' | 'settings') => void;
}

export default function KpiCards({ running, finished, failed, resources, tasks, onNavigate }: KpiCardsProps) {
  const { stuckThresholdMinutes, handleNavigateToTaskWithFilter } = useDashboardStore();

  const stuckCount = useMemo(() => {
    const now = Date.now();
    return tasks.filter(t => {
      if (t.status !== 'requested' && t.status !== 'queued') return false;
      const createdMs = t.createDate ? new Date(t.createDate).getTime() : (t.startDate ? new Date(t.startDate).getTime() : 0);
      if (!createdMs) return t.status === 'requested';
      const mins = Math.floor((now - createdMs) / 60000);
      return mins >= (stuckThresholdMinutes || 30) || t.status === 'requested';
    }).length;
  }, [tasks, stuckThresholdMinutes]);

  // Count queued tasks dynamically from task list
  const queued = tasks.filter(t => t.status === 'queued').length;

  // Dynamically compile critical alerts based on active resources and tasks status
  const criticalAlerts: { id: string; level: 'danger' | 'warning' | 'info'; text: string }[] = [];

  // Check for offline or degraded clusters from the live resources list
  resources.forEach(r => {
    // console.log(r)
    if (r.status === 'error') {
      criticalAlerts.push({
        id: `res-err-${r.id}`,
        level: 'danger',
        text: `${r.name} cluster is unreachable (Host connection timeout)`
      });
    } else if (r.status === 'degraded') {
      criticalAlerts.push({
        id: `res-deg-${r.id}`,
        level: 'warning',
        text: `${r.name} cluster connectivity is degraded (${r.detail || 'check nodes'})`
      });
    }
  });

  // Check for validator service failures in recent tasks list
  const validatorFailures = tasks.filter(t => t.service.includes('validator') && t.status === 'failed').length;
  if (validatorFailures > 0) {
    criticalAlerts.push({
      id: 'val-fail',
      level: 'warning',
      text: `Validator failures: ${validatorFailures} recent validator tasks failed`
    });
  }

  // Check for overall task pipeline failure rate
  if (failed > 15) {
    criticalAlerts.push({
      id: 'general-fail',
      level: 'warning',
      text: `${failed} recent tasks failed; check runner logs`
    });
  }

  // Check for excessive aws batch workload
  const awsBatchRunning = tasks.filter(t => t.resource === 'AWS Batch' && t.status === 'running').length;
  if (awsBatchRunning > 15) {
    criticalAlerts.push({
      id: 'aws-load',
      level: 'info',
      text: 'High active task load on AWS batch cluster'
    });
  }

  // Calculate health score dynamically
  const errorResources = resources.filter(r => r.status === 'error').length;
  const degradedResources = resources.filter(r => r.status === 'degraded').length;

  const healthScore = Math.max(
    70,
    Math.min(
      100,
      100 - (failed * 1.5) - (errorResources * 8) - (degradedResources * 4) - (validatorFailures * 2)
    )
  );

  return (
    <div className="space-y-5 w-full">
      {/* 1. Global Status (Health & Critical Alerts) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">

        {/* System Status Card */}
        <div className="glass relative overflow-hidden rounded-2xl p-5 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]">
          <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full blur-[30px] bg-accent-purple opacity-[0.08]" />

          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                System Status
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-purple/10 text-accent-purple">
                <Heart className="h-4.5 w-4.5 animate-pulse" strokeWidth={2} />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${healthScore > 90 ? 'bg-status-success' : healthScore > 80 ? 'bg-status-warning' : 'bg-status-error'
                  }`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${healthScore > 90 ? 'bg-status-success' : healthScore > 80 ? 'bg-status-warning' : 'bg-status-error'
                  }`}></span>
              </span>
              <span className={`text-[15px] font-extrabold tracking-wider uppercase font-mono ${healthScore > 90 ? 'text-status-success' : healthScore > 80 ? 'text-status-warning' : 'text-status-error'
                }`}>
                {healthScore > 90 ? 'Operational' : healthScore > 80 ? 'Degraded' : 'Critical'}
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-3.5 border-t border-white/[0.04] pt-4">
            <div className="flex items-center justify-between text-[11px] leading-none">
              <div className="flex items-center gap-2 text-text-muted">
                <AlertTriangle className={`h-4 w-4 shrink-0 ${criticalAlerts.length > 0 ? 'text-status-error' : 'text-text-faint'}`} />
                <span>Active Incidents</span>
              </div>
              <span className={`font-mono font-bold text-xs ${criticalAlerts.length > 0 ? 'text-status-error' : 'text-text-muted'
                }`}>
                {criticalAlerts.length}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] leading-none">
              <div className="flex items-center gap-2 text-text-muted">
                <Server className={`h-4 w-4 shrink-0 ${errorResources > 0 ? 'text-status-error' : 'text-text-faint'}`} />
                <span>Resources Offline</span>
              </div>
              <span className={`font-mono font-bold text-xs ${errorResources > 0 ? 'text-status-error' : 'text-text-muted'
                }`}>
                {errorResources}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] leading-none">
              <div className="flex items-center gap-2 text-text-muted">
                <Clock className={`h-4 w-4 shrink-0 ${queued > 0 ? 'text-status-warning' : 'text-text-faint'}`} />
                <span>Average Queue</span>
              </div>
              <span className={`font-mono font-bold text-xs ${queued > 0 ? 'text-accent-cyan' : 'text-text-muted'
                }`}>
                {queued > 0 ? `${queued * 3}m` : '0m'}
              </span>
            </div>
          </div>
        </div>

        {/* Critical Alerts Console */}
        <div className="glass relative overflow-hidden rounded-2xl p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]">
          <div className="flex items-center justify-between border-b border-white/[0.03] pb-2.5">
            <div className="flex items-center gap-2">
              {criticalAlerts.length === 0 ? (
                <CheckCircle2 className="h-4.5 w-4.5 text-status-success animate-pulse" />
              ) : (
                <ShieldAlert className="h-4.5 w-4.5 text-status-error animate-bounce" />
              )}
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-main">
                Critical Alerts
              </h3>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider font-mono ${criticalAlerts.length === 0
                ? 'bg-status-success/15 text-status-success'
                : 'bg-status-error/15 text-status-error'
              }`}>
              {criticalAlerts.length === 0 ? 'Healthy' : `${criticalAlerts.length} Active Issues`}
            </span>
          </div>

          <div className="mt-3.5 space-y-2">
            {criticalAlerts.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-status-success/15 bg-status-success/5 px-3.5 py-3 text-xs text-status-success/90">
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-status-success" />
                <span className="font-medium tracking-wide">All monitored systems and cluster nodes are fully operational</span>
              </div>
            ) : (
              criticalAlerts.slice(0, 3).map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => onNavigate && onNavigate('resources')}
                  className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs transition-colors duration-150 cursor-pointer ${alert.level === 'danger'
                      ? 'border-status-error/15 bg-status-error/5 text-status-error/95 hover:bg-status-error/8'
                      : alert.level === 'warning'
                        ? 'border-status-warning/15 bg-status-warning/5 text-status-warning/95 hover:bg-status-warning/8'
                        : 'border-accent-cyan/15 bg-accent-cyan/5 text-accent-cyan/95 hover:bg-accent-cyan/8'
                    }`}
                  title="Click to inspect compute resources"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="font-medium tracking-wide truncate">{alert.text}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* 2. Metrics Summary (Running, Succeeded, Failed, Stuck, Queued) */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">

        {/* Running KPI */}
        <div 
          onClick={() => {
            if (handleNavigateToTaskWithFilter) handleNavigateToTaskWithFilter(undefined, 'running');
            else if (onNavigate) onNavigate('tasks');
          }}
          className="glass relative overflow-hidden rounded-2xl p-4 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)] cursor-pointer hover:border-accent-cyan/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">Running</span>
            <Activity className="h-4 w-4 text-accent-cyan" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold tracking-tight text-text-main">
              <CountUpVal value={running} />
            </span>
            <span className="text-[9px] font-semibold text-accent-cyan">Active</span>
          </div>
        </div>

        {/* Succeeded KPI */}
        <div 
          onClick={() => {
            if (handleNavigateToTaskWithFilter) handleNavigateToTaskWithFilter(undefined, 'finished');
            else if (onNavigate) onNavigate('tasks');
          }}
          className="glass relative overflow-hidden rounded-2xl p-4 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)] cursor-pointer hover:border-status-success/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">Succeeded</span>
            <CheckCircle2 className="h-4 w-4 text-status-success" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold tracking-tight text-text-main">
              <CountUpVal value={finished} />
            </span>
            <span className="text-[9px] font-semibold text-status-success">Completed</span>
          </div>
        </div>

        {/* Failed KPI */}
        <div 
          onClick={() => {
            if (handleNavigateToTaskWithFilter) handleNavigateToTaskWithFilter(undefined, 'failed');
            else if (onNavigate) onNavigate('tasks');
          }}
          className="glass relative overflow-hidden rounded-2xl p-4 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)] cursor-pointer hover:border-status-error/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">Failed</span>
            <XCircle className="h-4 w-4 text-status-error" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold tracking-tight text-status-error">
              <CountUpVal value={failed} />
            </span>
            <span className="text-[9px] font-semibold text-status-error">Explorer ↗</span>
          </div>
        </div>

        {/* Stuck Requested KPI */}
        <div 
          onClick={() => {
            if (handleNavigateToTaskWithFilter) handleNavigateToTaskWithFilter(undefined, 'stuck');
            else if (onNavigate) onNavigate('tasks');
          }}
          className={`glass relative overflow-hidden rounded-2xl p-4 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)] cursor-pointer transition-all ${
            stuckCount > 0 
              ? 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]' 
              : 'hover:border-amber-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-amber-300 uppercase flex items-center gap-1">
              <Clock className="h-3 w-3 text-amber-400" />
              Stuck
            </span>
            <ShieldAlert className={`h-4 w-4 ${stuckCount > 0 ? 'text-amber-400 animate-pulse' : 'text-text-faint'}`} />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold tracking-tight text-amber-300">
              <CountUpVal value={stuckCount} />
            </span>
            <span className="text-[9px] font-semibold text-amber-400 font-mono">
              &gt;{stuckThresholdMinutes || 30}m ↗
            </span>
          </div>
        </div>

        {/* Queued KPI */}
        <div 
          onClick={() => {
            if (handleNavigateToTaskWithFilter) handleNavigateToTaskWithFilter(undefined, 'queued');
            else if (onNavigate) onNavigate('tasks');
          }}
          className="glass relative overflow-hidden rounded-2xl p-4 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)] cursor-pointer hover:border-status-warning/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">Queued</span>
            <Clock className="h-4 w-4 text-status-warning" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold tracking-tight text-text-main">
              <CountUpVal value={queued} />
            </span>
            <span className="text-[9px] font-semibold text-status-warning">Pending</span>
          </div>
        </div>

      </div>
    </div>
  );
}

function CountUpVal({ value }: { value: number }) {
  const count = useCountUp(value, 1000);
  return <>{count}</>;
}

