import { useState } from 'react';
import { Server, Cloud, Cpu, Terminal, RefreshCw, Sparkles } from 'lucide-react';
import type { ComputeResource } from '../data';

interface ResourceGridProps {
  resources: ComputeResource[];
  onTest: (id: string) => void;
  testingId: string | null;
}

export default function ResourceGrid({ resources, onTest, testingId }: ResourceGridProps) {
  const [visibleCount, setVisibleCount] = useState(4);
  return (
    <section className="w-full">
      {/* Header */}
      <div className="mb-4.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-cyan/10 text-accent-cyan">
            <Cpu className="h-4 w-4 animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-main">
              Compute Resources
            </h2>
            <p className="text-[10px] text-text-muted mt-0.5">Real-time status and utilization</p>
          </div>
        </div>
        <button
          onClick={() => onTest('all')}
          disabled={testingId !== null}
          className="flex items-center gap-1.5 rounded-lg border border-border-glass bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-text-muted transition-all duration-200 hover:border-border-glass-hover hover:text-text-main hover:bg-white/[0.04] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${testingId !== null ? 'animate-spin' : ''}`} />
          Test All Resources
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {resources.slice(0, visibleCount).map((r) => {
          const isError = r.status === 'error';
          const isTesting = testingId === 'all' || testingId === r.id;

          // Resolve icon based on name
          let Icon = Server;
          let iconColor = 'text-accent-cyan';
          if (r.name.includes('AWS')) {
            Icon = Cloud;
            iconColor = 'text-status-running';
          } else if (r.name.includes('Docker')) {
            Icon = Terminal;
            iconColor = 'text-accent-purple';
          }

          return (
            <div
              key={r.id}
              className={`glass glass-hover relative overflow-hidden rounded-2xl p-4.5 transition-all duration-300 ${
                isError
                  ? 'border-status-error/30 shadow-[0_4px_24px_rgba(239,68,68,0.06)] hover:border-status-error/50'
                  : 'shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]'
              }`}
            >
              {/* Glow background */}
              <div
                className="absolute -right-8 -top-8 h-20 w-20 rounded-full blur-[24px]"
                style={{
                  backgroundColor: isError ? '#EF4444' : r.name.includes('AWS') ? '#00E5FF' : r.name.includes('Docker') ? '#8B5CF6' : '#10B981',
                  opacity: isError ? 0.08 : 0.05,
                }}
              />

              {/* Top Row: Icon and status */}
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">
                  <Icon className={`h-4.5 w-4.5 ${iconColor}`} strokeWidth={1.75} />
                </div>

                {/* Status Dot and Label */}
                <div className="flex items-center gap-1.5 rounded-full bg-white/[0.02] px-2 py-0.5 border border-white/[0.04] shrink-0">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isError
                        ? 'bg-status-error animate-pulse'
                        : 'bg-status-success shadow-[0_0_8px_#10B981] animate-pulse-glow'
                    }`}
                  />
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${isError ? 'text-status-error' : 'text-status-success'}`}>
                    {r.status === 'online' ? 'Online' : 'Error'}
                  </span>
                </div>
              </div>

              {/* Title & Subtitle stacked below */}
              <div className="mt-3">
                <h3 className="text-sm font-semibold text-text-main group-hover:text-accent-cyan transition-colors leading-tight truncate">
                  {r.name}
                </h3>
                <span className="text-[10px] text-text-faint mt-1 block truncate">{r.type}</span>
              </div>

              {/* Status details / metrics */}
              {isError ? (
                <div className="mt-5 flex flex-col items-center justify-center py-4 rounded-xl border border-status-error/10 bg-status-error/5">
                  <span className="text-xs font-medium text-status-error">Host unreachable</span>
                  <span className="text-[10px] text-text-faint mt-1">{r.detail}</span>
                </div>
              ) : (
                <div className="mt-5 space-y-3.5">
                  {/* CPU, Memory, Queue values */}
                  {r.cpu !== undefined && r.memory !== undefined && (
                    <div className="space-y-2.5">
                      {/* CPU Bar */}
                      <div>
                        <div className="flex justify-between text-[10px] text-text-muted mb-1 font-mono">
                          <span>CPU UTILIZATION</span>
                          <span className="text-text-main font-semibold">{r.cpu}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-accent-cyan to-status-running transition-all duration-500"
                            style={{ width: `${r.cpu}%` }}
                          />
                        </div>
                      </div>

                      {/* Memory Bar */}
                      <div>
                        <div className="flex justify-between text-[10px] text-text-muted mb-1 font-mono">
                          <span>MEMORY UTILIZATION</span>
                          <span className="text-text-main font-semibold">{r.memory}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-accent-purple to-accent-cyan transition-all duration-500"
                            style={{ width: `${r.memory}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AWS Batch specific layout */}
                  {r.vcpusCurrent !== undefined && r.vcpusMax !== undefined && (
                    <div className="space-y-2.5">
                      {/* vCPUs Bar */}
                      <div>
                        <div className="flex justify-between text-[10px] text-text-muted mb-1 font-mono">
                          <span>vCPUs ALLOCATED</span>
                          <span className="text-text-main font-semibold">
                            {r.vcpusCurrent} / {r.vcpusMax}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-status-running to-accent-purple transition-all duration-500"
                            style={{ width: `${(r.vcpusCurrent / r.vcpusMax) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Queue Details footer */}
                  <div className="flex items-center justify-between border-t border-white/[0.03] pt-3.5 text-[10px] text-text-muted">
                    {r.queueJobs !== undefined && (
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs font-semibold text-text-main">{r.queueJobs}</span>
                        <span>jobs in queue</span>
                      </div>
                    )}
                    {r.activeJobs !== undefined && (
                      <div className="flex items-center gap-1">
                        <span>active jobs:</span>
                        <span className="font-mono text-xs font-semibold text-text-main">{r.activeJobs}</span>
                      </div>
                    )}

                    {/* Sparkline line indicator */}
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-accent-cyan animate-pulse" />
                      <span className="text-[9px] uppercase tracking-wider text-text-faint">Optimized</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tags */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {r.tags?.map((tag, index) => (
                  <span
                    key={`${tag}-${index}`}
                    className="rounded bg-white/5 border border-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-text-muted hover:text-text-main hover:border-white/[0.08] transition-colors"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Action Test Button */}
              <button
                onClick={() => onTest(r.id)}
                disabled={isTesting}
                className="mt-3.5 w-full rounded-lg border border-border-glass bg-white/[0.01] py-1.5 font-mono text-[10px] font-medium text-text-muted hover:bg-white/[0.03] hover:text-text-main hover:border-white/[0.12] active:scale-[0.98] transition-all duration-150"
              >
                {isTesting ? 'CONNECTING...' : 'TEST CONNECTIVITY'}
              </button>
            </div>
          );
        })}
      </div>

      {resources.length > visibleCount && (
        <div className="mt-5 flex justify-center">
          <button
            onClick={() => setVisibleCount((prev) => prev + 4)}
            className="flex items-center gap-2 rounded-xl border border-border-glass bg-[#050811] px-5 py-2.5 text-xs font-bold text-text-muted hover:text-text-main hover:bg-white/[0.03] hover:border-white/20 active:scale-[0.98] transition-all select-none cursor-pointer"
          >
            View More Active Resources
          </button>
        </div>
      )}
    </section>
  );
}
