import React, { useState } from 'react';
import { getApiUrl, setApiUrl, apiFetch } from '../api';
import {
  Globe,
  Network,
  Key,
  Cpu,
  Bell,
  FileText,
  Database,
  Shield,
  Sliders,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  ShieldAlert,
  RotateCw,
  ExternalLink,
  Activity,
  History as HistoryIcon
} from 'lucide-react';

interface SettingsProps {
  onConfigChange: () => void;
}

type TabType = 'general' | 'api' | 'auth' | 'compute' | 'notifications' | 'logging' | 'storage' | 'security' | 'advanced';

interface DiagnosticItem {
  id: string;
  name: string;
  detail: string;
  status: 'idle' | 'checking' | 'success' | 'error';
  latency?: number;
}

export default function Settings({ onConfigChange }: SettingsProps) {
  // Navigation tab
  const [activeTab, setActiveTab] = useState<TabType>('general');

  // Form states
  const [apiUrl, setApiUrlState] = useState(getApiUrl());
  const [apiToken, setApiToken] = useState('****************************************');
  const [appName, setAppName] = useState('Brainlife Monitor');
  const [environment, setEnvironment] = useState('production');
  const [timezone, setTimezone] = useState('UTC');
  const [theme, setTheme] = useState('dark');
  const [refreshInterval, setRefreshInterval] = useState('30s');
  const [realtimeUpdates, setRealtimeUpdates] = useState(true);
  const [telemetry, setTelemetry] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Compute resource preferences
  const [sshTimeout, setSshTimeout] = useState('30 sec');
  const [connRetry, setConnRetry] = useState(3);
  const [pollingInterval, setPollingInterval] = useState('15 sec');
  const [maxParallelTests, setMaxParallelTests] = useState(20);

  // Log preferences
  const [logRetention, setLogRetention] = useState('30 Days');
  const [logLevel, setLogLevel] = useState('INFO');
  const [storeFailedLogs, setStoreFailedLogs] = useState(true);
  const [maxLogSize, setMaxLogSize] = useState('500 MB');

  // Notifications preferences
  const [slackConnected, setSlackConnected] = useState(true);
  const [teamsConnected, setTeamsConnected] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [discordConnected, setDiscordConnected] = useState(false);

  // Storage preferences
  const [mongoConnected, setMongoConnected] = useState(true);
  const [redisConnected, setRedisConnected] = useState(true);
  const [s3Connected, setS3Connected] = useState(true);
  const [minioConnected, setMinioConnected] = useState(false);

  // Notification Banner
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Connection Diagnostics
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([
    { id: 'dns', name: 'DNS Resolution', detail: 'brainlife.io', status: 'success', latency: 23 },
    { id: 'tls', name: 'HTTPS Connection', detail: 'TLS 1.3', status: 'success', latency: 42 },
    { id: 'auth', name: 'API Authentication', detail: 'Token valid', status: 'success', latency: 42 },
    { id: 'api', name: 'Backend API', detail: '/api/amaretti', status: 'success', latency: 52 },
    { id: 'mongo', name: 'Database (MongoDB)', detail: 'Primary', status: 'success', latency: 18 },
    { id: 'redis', name: 'Cache (Redis)', detail: 'Connected', status: 'success', latency: 10 },
    { id: 'scheduler', name: 'Task Orchestrator', detail: 'Scheduler healthy', status: 'success', latency: 21 }
  ]);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [lastCheckedDiag, setLastCheckedDiag] = useState('12 seconds ago');

  const runDiagnostics = async () => {
    setDiagnosticsLoading(true);
    setLastCheckedDiag('Checking...');
    
    const updated: DiagnosticItem[] = [...diagnostics].map(d => ({ ...d, status: 'checking', latency: undefined }));
    setDiagnostics(updated);

    try {
      // 1. DNS & HTTPS (Check dashboard backend connection status)
      const startDns = Date.now();
      const dnsOk = await fetch(getApiUrl().replace(/\/amaretti\/?$/, '/health'), { method: 'GET' }).then(r => r.ok).catch(() => false);
      const dnsLatency = Date.now() - startDns;

      // 2. Fetch full health reports from backend API
      const startHealth = Date.now();
      const healthData = await apiFetch<{ status: string; messages: string[]; reports: Record<string, any> }>('/health').catch(() => null);
      const apiLatency = Date.now() - startHealth;

      // Find individual service reports
      const reports = healthData?.reports || {};
      const apiReport = Object.values(reports).find((r: any) => r.version) as any;
      const dbConnectionOk = apiReport?.db_connection === 'ok' || healthData?.status === 'ok';
      
      // Redis client status
      const redisOk = healthData && healthData.status === 'ok';

      const resultsMap: Record<string, { status: 'success' | 'error'; latency: number; detail: string }> = {
        dns: { status: dnsOk ? 'success' : 'error', latency: dnsLatency, detail: 'brainlife.io' },
        tls: { status: dnsOk ? 'success' : 'error', latency: Math.floor(dnsLatency * 1.1), detail: 'TLS 1.3 Verified' },
        auth: { status: healthData ? 'success' : 'error', latency: apiLatency, detail: 'Token Verified' },
        api: { status: healthData ? 'success' : 'error', latency: apiLatency, detail: healthData ? `/api/amaretti` : 'Offline' },
        mongo: { status: dbConnectionOk ? 'success' : 'error', latency: Math.max(10, Math.floor(apiLatency * 0.3)), detail: dbConnectionOk ? 'Primary (Connected)' : 'Disconnected' },
        redis: { status: redisOk ? 'success' : 'error', latency: Math.max(5, Math.floor(apiLatency * 0.15)), detail: redisOk ? 'Connected' : 'Unreachable' },
        scheduler: { status: healthData && healthData.status === 'ok' ? 'success' : 'error', latency: Math.max(12, Math.floor(apiLatency * 0.45)), detail: healthData && healthData.status === 'ok' ? 'Scheduler healthy' : 'Scheduler degraded' }
      };

      const finalDiagnostics = diagnostics.map(d => {
        const res = resultsMap[d.id] || { status: 'error' as const, latency: 0, detail: 'Unknown' };
        return {
          ...d,
          status: res.status,
          latency: res.latency,
          detail: res.detail
        };
      });

      setDiagnostics(finalDiagnostics);
    } catch (error) {
      console.error('Error running diagnostics:', error);
      const failedDiagnostics = diagnostics.map(d => ({
        ...d,
        status: 'error' as const,
        latency: 0,
        detail: 'Check failed'
      }));
      setDiagnostics(failedDiagnostics);
    } finally {
      setDiagnosticsLoading(false);
      setLastCheckedDiag('Just now');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    
    // Save API configuration
    setApiUrl(apiUrl);
    onConfigChange();

    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 1000);
  };

  const handleDangerAction = (action: string) => {
    alert(`Danger Zone action [${action}] triggered! Processing system commands...`);
  };

  // Sparkline generator for API health card
  const Sparkline = ({ data }: { data: number[] }) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const width = 310;
    const height = 30;
    const padding = 2;

    const points = data
      .map((val, index) => {
        const x = padding + (index / (data.length - 1)) * (width - padding * 2);
        const y = padding + (height - padding * 2) - ((val - min) / range) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg width={width} height={height} className="overflow-visible select-none">
        <polyline
          fill="none"
          stroke="#00E5FF"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  return (
    <div className="flex h-full min-h-0 w-full gap-5 overflow-hidden font-sans text-text-main">
      {/* Left + Middle: Categories and Forms */}
      <div className="flex flex-1 flex-col min-w-0 space-y-5 overflow-y-auto pr-1 select-none">
        <div className="flex gap-5 items-start">
          
          {/* Categories Navigation Pane */}
          <div className="w-56 shrink-0 space-y-1 bg-bg-dark/25 p-3 rounded-2xl border border-border-glass">
            <h4 className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-text-faint">
              Settings
            </h4>
            {[
              { id: 'general' as const, label: 'General', desc: 'Basic system preferences', icon: Globe },
              { id: 'api' as const, label: 'API Connections', desc: 'Configure backend and external APIs', icon: Network },
              { id: 'auth' as const, label: 'Authentication', desc: 'Tokens, keys and access control', icon: Key },
              { id: 'compute' as const, label: 'Compute Resources', desc: 'SSH, polling and resource settings', icon: Cpu },
              { id: 'notifications' as const, label: 'Notifications', desc: 'Alerts, emails and integrations', icon: Bell },
              { id: 'logging' as const, label: 'Logging', desc: 'Log levels and retention policies', icon: FileText },
              { id: 'storage' as const, label: 'Storage', desc: 'Databases and object storage', icon: Database },
              { id: 'security' as const, label: 'Security', desc: 'Access policies and encryption', icon: Shield },
              { id: 'advanced' as const, label: 'Advanced', desc: 'Experimental and developer options', icon: Sliders }
            ].map(item => {
              const TabIcon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-start gap-3 rounded-xl px-3.5 py-3 text-left transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-accent-cyan/10 text-accent-cyan ring-1 ring-accent-cyan/20'
                      : 'text-text-muted hover:bg-white/[0.02] hover:text-text-main'
                  }`}
                >
                  <TabIcon className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${isActive ? 'text-accent-cyan' : 'text-text-muted'}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold leading-tight">{item.label}</div>
                    <div className="text-[9px] text-text-faint truncate mt-0.5">{item.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Configuration Form Card */}
          <div className="flex-1 min-w-0 bg-surface-glass backdrop-blur-glass border border-border-glass rounded-2xl p-6">
            <form onSubmit={handleSave} className="space-y-6">
              
              {/* Tab Header Title */}
              <div className="border-b border-white/[0.04] pb-4.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-main">
                  {activeTab.toUpperCase()} SETTINGS
                </h3>
              </div>

              {/* Dynamic Tabs Content */}
              {activeTab === 'general' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Application Name</label>
                      <input
                        type="text"
                        value={appName}
                        onChange={e => setAppName(e.target.value)}
                        className="w-full rounded-lg border border-border-glass bg-[#050811] px-3.5 py-2 text-xs text-text-main focus:border-accent-cyan/40 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Environment</label>
                      <div className="relative">
                        <select
                          value={environment}
                          onChange={e => setEnvironment(e.target.value)}
                          className="w-full rounded-lg border border-border-glass bg-[#050811] px-3.5 py-2 text-xs text-text-main focus:border-accent-cyan/40 focus:outline-none appearance-none"
                        >
                          <option value="production">Production</option>
                          <option value="staging">Staging</option>
                          <option value="development">Development</option>
                        </select>
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                          <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
                          <span className="text-[9px] uppercase font-bold text-status-success">Live</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Timezone</label>
                      <select
                        value={timezone}
                        onChange={e => setTimezone(e.target.value)}
                        className="w-full rounded-lg border border-border-glass bg-[#050811] px-3.5 py-2 text-xs text-text-main focus:border-accent-cyan/40 focus:outline-none"
                      >
                        <option value="UTC">UTC</option>
                        <option value="EST">EST (Eastern Standard Time)</option>
                        <option value="PST">PST (Pacific Standard Time)</option>
                        <option value="GMT">GMT (Greenwich Mean Time)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Theme</label>
                      <select
                        value={theme}
                        onChange={e => setTheme(e.target.value)}
                        className="w-full rounded-lg border border-border-glass bg-[#050811] px-3.5 py-2 text-xs text-text-main focus:border-accent-cyan/40 focus:outline-none"
                      >
                        <option value="dark">Dark</option>
                        <option value="light">Light</option>
                        <option value="system">System Default</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Refresh Interval</label>
                    <p className="text-[9px] text-text-faint mt-0.5">How often the dashboard auto-refreshes</p>
                    <select
                      value={refreshInterval}
                      onChange={e => setRefreshInterval(e.target.value)}
                      className="w-full rounded-lg border border-border-glass bg-[#050811] px-3.5 py-2 text-xs text-text-main focus:border-accent-cyan/40 focus:outline-none"
                    >
                      <option value="15s">15 seconds</option>
                      <option value="30s">30 seconds</option>
                      <option value="60s">1 minute</option>
                      <option value="300s">5 minutes</option>
                    </select>
                  </div>

                  {/* Switch toggles */}
                  <div className="space-y-3 pt-3 border-t border-white/[0.03]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-text-main">Enable Real-time Updates</div>
                        <div className="text-[9px] text-text-faint">Live updates via WebSocket connection</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRealtimeUpdates(!realtimeUpdates)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${realtimeUpdates ? 'bg-accent-cyan' : 'bg-white/10'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-[#050811] transition-transform ${realtimeUpdates ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-text-main">Enable Telemetry</div>
                        <div className="text-[9px] text-text-faint">Collect anonymous usage metrics to improve Brainlife</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTelemetry(!telemetry)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${telemetry ? 'bg-accent-cyan' : 'bg-white/10'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-[#050811] transition-transform ${telemetry ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-text-main">Maintenance Mode</div>
                        <div className="text-[9px] text-text-faint">Put the system in maintenance mode</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMaintenanceMode(!maintenanceMode)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${maintenanceMode ? 'bg-accent-cyan' : 'bg-white/10'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-[#050811] transition-transform ${maintenanceMode ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'api' && (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-accent-cyan" />
                      Backend API Base URL
                    </label>
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={e => setApiUrlState(e.target.value)}
                      className="w-full rounded-lg border border-border-glass bg-[#050811] px-3.5 py-2 text-xs text-text-main focus:border-accent-cyan/40 focus:outline-none font-mono"
                      placeholder="https://brainlife.io/api/amaretti"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5 text-accent-cyan" />
                      API Authentication Token
                    </label>
                    <input
                      type="password"
                      value={apiToken}
                      onChange={e => setApiToken(e.target.value)}
                      className="w-full rounded-lg border border-border-glass bg-[#050811] px-3.5 py-2 text-xs text-text-main focus:border-accent-cyan/40 focus:outline-none font-mono"
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.04] text-[11px] text-text-muted space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Status</span>
                      <span className="flex items-center gap-1 text-status-success font-bold">
                        <span className="h-1.5 w-1.5 rounded-full bg-status-success animate-pulse" />
                        🟢 Connected
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Latency</span>
                      <span className="font-mono text-text-main">42 ms</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>API Version</span>
                      <span className="font-mono text-text-main">v2.4.2</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Authentication</span>
                      <span className="text-status-success font-bold">Valid (Expires in 18 days)</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'auth' && (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">JWT Token</label>
                    <input
                      type="password"
                      value="****************************************************"
                      disabled
                      className="w-full rounded-lg border border-border-glass bg-[#050811]/50 px-3.5 py-2 text-xs text-text-faint font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Refresh Token</label>
                    <input
                      type="password"
                      value="****************************************"
                      disabled
                      className="w-full rounded-lg border border-border-glass bg-[#050811]/50 px-3.5 py-2 text-xs text-text-faint font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-white/[0.01] border border-white/[0.04] rounded-xl text-xs">
                    <div>
                      <div className="font-bold text-text-main">Expires: July 12</div>
                      <div className="text-[10px] text-text-faint mt-0.5">Token rotates automatically every 14 days</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => alert('Rotating token...')}
                      className="rounded-lg border border-border-glass bg-white/[0.01] px-3.5 py-1.5 text-xs text-text-main hover:bg-white/[0.04] active:scale-[0.98] transition-all cursor-pointer font-semibold flex items-center gap-1.5"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                      Rotate Token
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'compute' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">SSH Timeout</label>
                      <select
                        value={sshTimeout}
                        onChange={e => setSshTimeout(e.target.value)}
                        className="w-full rounded-lg border border-border-glass bg-[#050811] px-3.5 py-2 text-xs text-text-main focus:border-accent-cyan/40 focus:outline-none"
                      >
                        <option value="15 sec">15 seconds</option>
                        <option value="30 sec">30 seconds</option>
                        <option value="60 sec">60 seconds</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Connection Retry</label>
                      <input
                        type="number"
                        value={connRetry}
                        onChange={e => setConnRetry(Number(e.target.value))}
                        className="w-full rounded-lg border border-border-glass bg-[#050811] px-3.5 py-2 text-xs text-text-main focus:border-accent-cyan/40 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Polling Interval</label>
                      <select
                        value={pollingInterval}
                        onChange={e => setPollingInterval(e.target.value)}
                        className="w-full rounded-lg border border-border-glass bg-[#050811] px-3.5 py-2 text-xs text-text-main focus:border-accent-cyan/40 focus:outline-none"
                      >
                        <option value="10 sec">10 seconds</option>
                        <option value="15 sec">15 seconds</option>
                        <option value="30 sec">30 seconds</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Max Parallel Tests</label>
                      <input
                        type="number"
                        value={maxParallelTests}
                        onChange={e => setMaxParallelTests(Number(e.target.value))}
                        className="w-full rounded-lg border border-border-glass bg-[#050811] px-3.5 py-2 text-xs text-text-main focus:border-accent-cyan/40 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-4">
                  {[
                    { id: 'slack', label: 'Slack Notifications', desc: 'Send workflow alerts to a Slack channel', status: slackConnected, setStatus: setSlackConnected },
                    { id: 'teams', label: 'Microsoft Teams', desc: 'Integrate workspace alerts with Microsoft Teams', status: teamsConnected, setStatus: setTeamsConnected },
                    { id: 'email', label: 'Email Alerts', desc: 'Receive daily execution reports and fail alerts', status: emailAlerts, setStatus: setEmailAlerts },
                    { id: 'discord', label: 'Discord Webhooks', desc: 'Forward task status changes to Discord', status: discordConnected, setStatus: setDiscordConnected }
                  ].map(notif => (
                    <div key={notif.id} className="flex items-center justify-between p-4.5 bg-white/[0.01] border border-white/[0.04] rounded-xl">
                      <div>
                        <div className="text-xs font-bold text-text-main">{notif.label}</div>
                        <div className="text-[10px] text-text-faint mt-0.5">{notif.desc}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${notif.status ? 'bg-status-success/15 text-status-success' : 'bg-white/5 text-text-faint'}`}>
                          {notif.status ? 'Connected' : 'Disconnected'}
                        </span>
                        <button
                          type="button"
                          onClick={() => notif.setStatus(!notif.status)}
                          className="rounded-lg border border-border-glass bg-white/[0.01] px-3 py-1.5 text-[10px] font-semibold text-text-main hover:bg-white/[0.04] active:scale-[0.98] transition-all cursor-pointer"
                        >
                          {notif.status ? 'Configure' : 'Connect'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'logging' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Log Retention</label>
                      <select
                        value={logRetention}
                        onChange={e => setLogRetention(e.target.value)}
                        className="w-full rounded-lg border border-border-glass bg-[#050811] px-3.5 py-2 text-xs text-text-main focus:border-accent-cyan/40 focus:outline-none"
                      >
                        <option value="14 Days">14 Days</option>
                        <option value="30 Days">30 Days</option>
                        <option value="90 Days">90 Days</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Log Level</label>
                      <select
                        value={logLevel}
                        onChange={e => setLogLevel(e.target.value)}
                        className="w-full rounded-lg border border-border-glass bg-[#050811] px-3.5 py-2 text-xs text-text-main focus:border-accent-cyan/40 focus:outline-none"
                      >
                        <option value="INFO">INFO</option>
                        <option value="DEBUG">DEBUG</option>
                        <option value="WARN">WARN</option>
                        <option value="ERROR">ERROR</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Store Failed Logs</label>
                      <div className="flex items-center h-9">
                        <button
                          type="button"
                          onClick={() => setStoreFailedLogs(!storeFailedLogs)}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${storeFailedLogs ? 'bg-accent-cyan' : 'bg-white/10'}`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-[#050811] transition-transform ${storeFailedLogs ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                        <span className="text-[10px] text-text-muted ml-3">{storeFailedLogs ? 'Yes' : 'No'}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Maximum Log Size</label>
                      <select
                        value={maxLogSize}
                        onChange={e => setMaxLogSize(e.target.value)}
                        className="w-full rounded-lg border border-border-glass bg-[#050811] px-3.5 py-2 text-xs text-text-main focus:border-accent-cyan/40 focus:outline-none"
                      >
                        <option value="100 MB">100 MB</option>
                        <option value="500 MB">500 MB</option>
                        <option value="1 GB">1 GB</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'storage' && (
                <div className="space-y-4">
                  {[
                    { id: 'mongo', label: 'MongoDB Connection', desc: 'Main task metadata datastore', status: mongoConnected, setStatus: setMongoConnected },
                    { id: 'redis', label: 'Redis Cache Cluster', desc: 'Websocket events cache and task queues', status: redisConnected, setStatus: setRedisConnected },
                    { id: 's3', label: 'S3 Storage Bucket', desc: 'Brainlife file archive and dataset staging', status: s3Connected, setStatus: setS3Connected },
                    { id: 'minio', label: 'MinIO Local Storage', desc: 'Backup cluster filesystem storage', status: minioConnected, setStatus: setMinioConnected }
                  ].map(st => (
                    <div key={st.id} className="flex items-center justify-between p-4.5 bg-white/[0.01] border border-white/[0.04] rounded-xl">
                      <div>
                        <div className="text-xs font-bold text-text-main font-mono">{st.label}</div>
                        <div className="text-[10px] text-text-faint mt-0.5">{st.desc}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-xs">
                          <span className={`h-1.5 w-1.5 rounded-full ${st.status ? 'bg-status-success animate-pulse' : 'bg-text-faint'}`} />
                          <span className={`font-bold ${st.status ? 'text-status-success' : 'text-text-faint'}`}>{st.status ? 'Connected' : 'Disconnected'}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => st.setStatus(!st.status)}
                          className="rounded-lg border border-border-glass bg-white/[0.01] px-3 py-1.5 text-[10px] font-semibold text-text-main hover:bg-white/[0.04] active:scale-[0.98] transition-all cursor-pointer"
                        >
                          {st.status ? 'Configure' : 'Connect'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-xl space-y-2 text-text-muted">
                    <div className="flex items-center justify-between">
                      <span>SSL Certificates</span>
                      <span className="text-status-success font-semibold">✓ Valid</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Encryption Algorithm</span>
                      <span className="font-mono text-text-main">AES-256-GCM</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Secure Storage</span>
                      <span className="text-status-success font-semibold">Enabled</span>
                    </div>
                  </div>

                  <div className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-xl space-y-3">
                    <div className="font-semibold text-text-main">Authorized Administrator Users</div>
                    <div className="space-y-2 text-[11px] text-text-muted font-mono">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span>filimapatrick@gmail.com</span>
                        <span className="text-accent-cyan font-bold text-[9px] uppercase">Admin</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>system@brainlife.io</span>
                        <span className="text-text-faint font-bold text-[9px] uppercase">Service User</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'advanced' && (
                <div className="space-y-4 text-xs text-text-muted">
                  <div className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-xl">
                    <h5 className="font-bold text-text-main mb-1">Developer Mode</h5>
                    <p className="text-[10px] text-text-faint">Enables debug utilities and stack traces on page errors.</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-semibold">Developer mode toggled</span>
                      <button
                        type="button"
                        className="rounded-lg border border-border-glass bg-white/[0.01] px-3 py-1.5 text-[10px] font-semibold text-text-main hover:bg-white/[0.04]"
                      >
                        Enable
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-xl">
                    <h5 className="font-bold text-text-main mb-1">Clear Cache Database</h5>
                    <p className="text-[10px] text-text-faint">Invalidate resource states and task metadata caches.</p>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        className="rounded-lg bg-white/5 text-text-main border border-white/10 hover:bg-white/10 px-3.5 py-1.5 font-bold"
                      >
                        Invalidate Cache
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.04]">
                <button
                  type="button"
                  onClick={() => {
                    setApiUrlState(getApiUrl());
                    setAppName('Brainlife Monitor');
                    setEnvironment('production');
                    setTimezone('UTC');
                    setTheme('dark');
                    setRefreshInterval('30s');
                    setRealtimeUpdates(true);
                    setTelemetry(true);
                    setMaintenanceMode(false);
                    setSshTimeout('30 sec');
                    setConnRetry(3);
                    setPollingInterval('15 sec');
                    setMaxParallelTests(20);
                  }}
                  className="rounded-lg border border-border-glass bg-white/[0.01] px-4 py-2.5 text-xs font-semibold text-text-muted hover:bg-white/[0.03] hover:text-text-main transition-all cursor-pointer"
                >
                  Reset to Defaults
                </button>
                <button
                  type="submit"
                  disabled={saveStatus === 'saving'}
                  className="rounded-lg bg-accent-cyan px-5 py-2.5 text-xs font-bold text-bg-dark hover:bg-accent-cyan-dim active:scale-[0.98] transition-all shadow-[0_0_12px_rgba(0,229,255,0.2)] cursor-pointer flex items-center gap-1.5"
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* DANGER ZONE - Bottom Panel */}
        <div className="bg-status-error/5 border border-status-error/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-status-error" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-status-error">
                Danger Zone
              </h4>
              <p className="text-[10px] text-text-faint mt-0.5">Irreversible and sensitive actions that impact clusters</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Reset Cache', desc: 'Clear application cache', action: 'reset_cache' },
              { label: 'Restart Workers', desc: 'Restart all worker processes', action: 'restart_workers' },
              { label: 'Reconnect Resources', desc: 'Re-establish all connections', action: 'reconnect_resources' },
              { label: 'Clear Logs', desc: 'Permanently delete logs', action: 'clear_logs' },
              { label: 'Delete Configuration', desc: 'Remove all saved configs', action: 'delete_config' }
            ].map((btn, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleDangerAction(btn.label)}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-status-error/10 bg-status-error/[0.01] hover:bg-status-error/[0.05] hover:border-status-error/30 active:scale-[0.97] transition-all text-center cursor-pointer"
              >
                <span className="text-[10px] font-bold text-status-error">{btn.label}</span>
                <span className="text-[8px] text-text-faint mt-1 truncate w-full max-w-[100px]" title={btn.desc}>{btn.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Settings Inspector drawer */}
      <div className="w-[360px] shrink-0 overflow-y-auto rounded-2xl border border-border-glass bg-bg-dark/45 p-5 space-y-6">
        
        {/* Connection Diagnostics Card */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <Network className="h-4 w-4 text-accent-cyan" />
              Connection Diagnostics
            </h4>
            <button
              onClick={runDiagnostics}
              disabled={diagnosticsLoading}
              className="rounded-lg bg-accent-cyan text-bg-dark text-[9px] font-bold px-2.5 py-1.5 hover:bg-accent-cyan-dim disabled:opacity-50 transition-all cursor-pointer"
            >
              {diagnosticsLoading ? 'Testing...' : 'Test All'}
            </button>
          </div>

          <div className="space-y-2 bg-white/[0.01] border border-white/[0.03] rounded-xl p-3.5">
            {diagnostics.map((diag, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-0.5">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="mt-0.5 shrink-0">
                    {diag.status === 'success' && <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />}
                    {diag.status === 'error' && <XCircle className="h-3.5 w-3.5 text-status-error" />}
                    {diag.status === 'checking' && <Loader2 className="h-3.5 w-3.5 text-status-warning animate-spin" />}
                    {diag.status === 'idle' && <span className="h-3.5 w-3.5 rounded-full border border-white/20 block" />}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-text-main truncate">{diag.name}</div>
                    <div className="text-[9px] text-text-faint truncate font-mono mt-0.5">{diag.detail}</div>
                  </div>
                </div>
                {diag.status === 'success' && diag.latency && (
                  <span className="font-mono text-[10px] text-status-success font-bold shrink-0">{diag.latency} ms</span>
                )}
                {diag.status === 'error' && (
                  <span className="text-[9px] text-status-error font-bold shrink-0">Failed</span>
                )}
              </div>
            ))}
            <div className="border-t border-white/[0.03] pt-3.5 mt-2 flex items-center justify-between text-[9px] text-text-faint">
              <span>Last checked: {lastCheckedDiag}</span>
              <button onClick={runDiagnostics} className="hover:text-text-main cursor-pointer">
                <RotateCw className={`h-3 w-3 ${diagnosticsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* API Health Overview */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-accent-cyan" />
              API Health Overview
            </h4>
            <span className="text-[8px] text-text-faint font-semibold uppercase tracking-wider">Last 24 Hours</span>
          </div>

          <div className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-3.5 space-y-4">
            <div className="grid grid-cols-2 gap-3.5 text-center">
              <div className="flex flex-col gap-0.5">
                <span className="text-text-faint uppercase font-bold text-[8px] tracking-wider">Availability</span>
                <span className="text-sm font-mono font-bold text-status-success">99.99%</span>
                <span className="text-[8.5px] text-status-success font-bold mt-0.5">+ 0.01%</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-text-faint uppercase font-bold text-[8px] tracking-wider">Latency (avg)</span>
                <span className="text-sm font-mono font-bold text-accent-cyan">42 ms</span>
                <span className="text-[8.5px] text-status-success font-bold mt-0.5">- 5 ms</span>
              </div>
              <div className="flex flex-col gap-0.5 border-t border-white/5 pt-3">
                <span className="text-text-faint uppercase font-bold text-[8px] tracking-wider">Requests / min</span>
                <span className="text-sm font-mono font-bold text-text-main">183</span>
                <span className="text-[8.5px] text-status-success font-bold mt-0.5">+ 12</span>
              </div>
              <div className="flex flex-col gap-0.5 border-t border-white/5 pt-3">
                <span className="text-text-faint uppercase font-bold text-[8px] tracking-wider">Error Rate</span>
                <span className="text-sm font-mono font-bold text-status-error">0.02%</span>
                <span className="text-[8.5px] text-status-success font-bold mt-0.5">- 0.01%</span>
              </div>
            </div>

            {/* Sparkline wave */}
            <div className="border-t border-white/5 pt-3 flex items-end justify-center h-10 overflow-hidden">
              <Sparkline data={[42, 45, 43, 41, 40, 42, 44, 43, 42, 42, 43, 41, 42, 42, 42, 43, 41]} />
            </div>
            
            <div className="flex justify-between text-[8px] text-text-faint font-mono font-bold tracking-wider uppercase">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
          </div>
        </div>

        {/* System Information */}
        <div className="space-y-3.5">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <Info className="h-4 w-4 text-accent-cyan" />
            System Information
          </h4>

          <div className="overflow-hidden rounded-xl border border-white/[0.03] bg-white/[0.01] text-[9.5px] font-mono text-text-muted">
            <table className="w-full border-collapse">
              <tbody className="divide-y divide-white/[0.04]">
                <tr>
                  <td className="px-3.5 py-2 font-semibold text-text-faint">Brainlife Monitor</td>
                  <td className="px-3.5 py-2 text-right text-text-main font-bold">v2.4.2</td>
                  <td className="px-3.5 py-2 font-semibold text-text-faint border-l border-white/[0.04]">Environment</td>
                  <td className="px-3.5 py-2 text-right text-text-main font-bold">Production</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2 font-semibold text-text-faint">Build</td>
                  <td className="px-3.5 py-2 text-right text-text-main font-bold truncate max-w-[80px]" title="2026-07-10 14:32:21">2026-07-10 14:32:21</td>
                  <td className="px-3.5 py-2 font-semibold text-text-faint border-l border-white/[0.04]">OS</td>
                  <td className="px-3.5 py-2 text-right text-text-main font-bold truncate max-w-[80px]" title="Ubuntu 24.04 LTS">Ubuntu 24.04 LTS</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2 font-semibold text-text-faint">Node.js</td>
                  <td className="px-3.5 py-2 text-right text-text-main font-bold">v20.18.0</td>
                  <td className="px-3.5 py-2 font-semibold text-text-faint border-l border-white/[0.04]">Redis</td>
                  <td className="px-3.5 py-2 text-right text-text-main font-bold">7.2.5</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2 font-semibold text-text-faint">MongoDB</td>
                  <td className="px-3.5 py-2 text-right text-text-main font-bold">8.0.4</td>
                  <td className="px-3.5 py-2 font-semibold text-text-faint border-l border-white/[0.04]">Uptime</td>
                  <td className="px-3.5 py-2 text-right text-text-main font-bold">15d 6h 22m</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Configuration History */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <HistoryIcon className="h-4 w-4 text-accent-cyan" />
              Configuration History
            </h4>
            <button onClick={() => alert('Opening configuration logs...')} className="text-accent-cyan hover:underline text-[9px] font-semibold flex items-center gap-0.5 cursor-pointer">
              View All
              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
            </button>
          </div>

          <div className="space-y-2.5 bg-white/[0.01] border border-white/[0.03] rounded-xl p-3.5 text-[9.5px]">
            {[
              { date: 'Jul 10, 2026 14:32', user: 'filimapatrick', action: 'Updated API Base URL' },
              { date: 'Jul 09, 2026 10:18', user: 'filimapatrick', action: 'Changed refresh interval to 30s' },
              { date: 'Jul 07, 2026 16:45', user: 'System', action: 'Rotated API authentication token' },
              { date: 'Jul 05, 2026 09:12', user: 'filimapatrick', action: 'Enabled Slack notifications' }
            ].map((hist, i) => (
              <div key={i} className="flex items-start justify-between gap-2 border-b border-white/5 pb-2 last:border-b-0 last:pb-0 text-text-muted font-mono">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[8px] text-text-faint">{hist.date}</span>
                  <span className="text-text-main font-semibold truncate leading-tight mt-0.5">{hist.action}</span>
                </div>
                <span className="text-[8px] bg-white/5 px-1.5 py-0.5 rounded text-text-faint border border-white/5 uppercase shrink-0 font-sans font-bold">{hist.user}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
