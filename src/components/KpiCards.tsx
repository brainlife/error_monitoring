import { Activity, CheckCircle2, XCircle, Clock, Heart, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useCountUp } from '../hooks/useCountUp';

interface KpiCardsProps {
  running: number;
  finished: number;
  failed: number;
  total: number;
}

export default function KpiCards({ running, finished, failed }: KpiCardsProps) {
  const queued = 11; // mock queuing factor

  // Dynamically compile critical alerts based on active metrics
  const criticalAlerts = [
    { id: '1', level: 'danger', text: 'Karst cluster unreachable (Host connection timeout)' },
    { id: '2', level: 'warning', text: 'Validator failures increased by 20% over last hour' },
    failed > 20 ? { id: '3', level: 'warning', text: `${failed} recent tasks failed; check runner logs` } : null,
    running > 15 ? { id: '4', level: 'info', text: 'High active task load on AWS batch cluster' } : null,
  ].filter(Boolean) as { id: string; level: string; text: string }[];

  const healthScore = Math.max(70, Math.min(100, 100 - (failed * 1.2) - (criticalAlerts.length * 5)));

  return (
    <div className="space-y-5 w-full">
      {/* 1. Global Status (Health & Critical Alerts) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        
        {/* System Health Card */}
        <div className="glass relative overflow-hidden rounded-2xl p-5 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]">
          <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full blur-[30px] bg-accent-purple opacity-[0.08]" />
          
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              System Health
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-purple/10 text-accent-purple">
              <Heart className="h-4.5 w-4.5 animate-pulse" strokeWidth={2} />
            </div>
          </div>

          <div className="mt-4.5 flex items-center gap-4">
            <CircularProgress percentage={healthScore} color={healthScore > 90 ? '#10B981' : healthScore > 80 ? '#F59E0B' : '#EF4444'} />
            <div>
              <div className="text-xs font-bold text-text-main">
                {healthScore > 90 ? 'Excellent' : healthScore > 80 ? 'Degraded' : 'Critical'}
              </div>
              <div className="mt-1 text-[10px] text-text-muted leading-relaxed">
                {healthScore > 90 ? 'All services routing normally' : 'Minor routing lag detected'}
              </div>
            </div>
          </div>
        </div>

        {/* Critical Alerts Console */}
        <div className="glass relative overflow-hidden rounded-2xl p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]">
          <div className="flex items-center justify-between border-b border-white/[0.03] pb-2.5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4.5 w-4.5 text-status-error animate-bounce" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-main">
                Critical Alerts
              </h3>
            </div>
            <span className="rounded-full bg-status-error/15 px-2.5 py-0.5 text-[9px] font-bold uppercase text-status-error tracking-wider font-mono">
              {criticalAlerts.length} Active Issues
            </span>
          </div>

          <div className="mt-3.5 space-y-2">
            {criticalAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs transition-colors duration-150 ${
                  alert.level === 'danger'
                    ? 'border-status-error/15 bg-status-error/5 text-status-error/95 hover:bg-status-error/8'
                    : alert.level === 'warning'
                    ? 'border-status-warning/15 bg-status-warning/5 text-status-warning/95 hover:bg-status-warning/8'
                    : 'border-accent-cyan/15 bg-accent-cyan/5 text-accent-cyan/95 hover:bg-accent-cyan/8'
                }`}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="font-medium tracking-wide truncate">{alert.text}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 2. Metrics Summary (Running, Succeeded, Failed, Queued) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        
        {/* Running KPI */}
        <div className="glass relative overflow-hidden rounded-2xl p-4.5 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">Running</span>
            <Activity className="h-4 w-4 text-accent-cyan" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold tracking-tight text-text-main">
              <CountUpVal value={running} />
            </span>
            <span className="text-[9px] font-semibold text-status-success">▲ 3 active</span>
          </div>
        </div>

        {/* Succeeded KPI */}
        <div className="glass relative overflow-hidden rounded-2xl p-4.5 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">Succeeded</span>
            <CheckCircle2 className="h-4 w-4 text-status-success" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold tracking-tight text-text-main">
              <CountUpVal value={finished} />
            </span>
            <span className="text-[9px] font-semibold text-status-success">▲ 32 today</span>
          </div>
        </div>

        {/* Failed KPI */}
        <div className="glass relative overflow-hidden rounded-2xl p-4.5 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">Failed</span>
            <XCircle className="h-4 w-4 text-status-error" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold tracking-tight text-text-main">
              <CountUpVal value={failed} />
            </span>
            <span className="text-[9px] font-semibold text-status-error">▼ 2 today</span>
          </div>
        </div>

        {/* Queued KPI */}
        <div className="glass relative overflow-hidden rounded-2xl p-4.5 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">Queued</span>
            <Clock className="h-4 w-4 text-status-warning" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold tracking-tight text-text-main">
              <CountUpVal value={queued} />
            </span>
            <span className="text-[9px] font-semibold text-status-warning">▲ 5 queued</span>
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

function CircularProgress({ percentage, color }: { percentage: number; color: string }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex h-11 w-11 items-center justify-center shrink-0">
      <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90">
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.04)"
          strokeWidth="3.5"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute font-mono text-[9px] font-bold text-text-main">
        {percentage}%
      </span>
    </div>
  );
}
