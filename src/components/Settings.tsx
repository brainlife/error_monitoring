import React, { useState } from 'react';
import { getApiUrl, setApiUrl, apiFetch } from '../api';
import {
  Globe,
  Network,
  Key,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  ShieldAlert,
  RotateCw
} from 'lucide-react';


interface SettingsProps {
  onConfigChange: () => void;
}

type TabType = 'general' | 'api' | 'profile';

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
  const [apiToken, setApiToken] = useState(localStorage.getItem('amaretti_jwt') || '');
  const [refreshInterval, setRefreshInterval] = useState(localStorage.getItem('dashboard_refresh_interval') || '10000');
  const [telemetry, setTelemetry] = useState(localStorage.getItem('dashboard_telemetry') !== 'false');

  // Notification Banner
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Connection Diagnostics
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([
    { id: 'dns', name: 'Host Connection', detail: 'brainlife.io reachability', status: 'idle' },
    { id: 'auth', name: 'API Authentication', detail: 'JWT validation check', status: 'idle' },
    { id: 'api', name: 'Backend API Service', detail: '/resource endpoint check', status: 'idle' }
  ]);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [lastCheckedDiag, setLastCheckedDiag] = useState('Never checked');

  const runDiagnostics = async () => {
    setDiagnosticsLoading(true);
    setLastCheckedDiag('Checking...');
    
    const updated: DiagnosticItem[] = [...diagnostics].map(d => ({ ...d, status: 'checking', latency: undefined }));
    setDiagnostics(updated);

    const checkItem = async (id: string, checkFn: () => Promise<{ status: 'success' | 'error'; detail: string; latency: number }>) => {
      const t0 = performance.now();
      try {
        const res = await checkFn();
        setDiagnostics(prev => prev.map(d => d.id === id ? { ...d, status: res.status, detail: res.detail, latency: res.latency } : d));
      } catch (err) {
        const latency = Math.round(performance.now() - t0);
        setDiagnostics(prev => prev.map(d => d.id === id ? { ...d, status: 'error', detail: err instanceof Error ? err.message : 'Check failed', latency } : d));
      }
    };

    // 1. Host Reachability
    await checkItem('dns', async () => {
      const t0 = performance.now();
      await fetch(getApiUrl().replace(/\/amaretti\/?$/, '/health'), { method: 'GET' });
      const latency = Math.round(performance.now() - t0);
      return { status: 'success', detail: 'brainlife.io reachability verified', latency };
    });

    // 2. JWT Auth Check
    await checkItem('auth', async () => {
      const t0 = performance.now();
      const token = localStorage.getItem('amaretti_jwt');
      const latency = Math.round(performance.now() - t0);
      if (!token) {
        throw new Error('No JWT token found in localStorage');
      }
      return { status: 'success', detail: 'JWT token present', latency };
    });

    // 3. Backend API Service Check
    await checkItem('api', async () => {
      const t0 = performance.now();
      await apiFetch('/resource?limit=1');
      const latency = Math.round(performance.now() - t0);
      return { status: 'success', detail: 'Amaretti endpoints operational', latency };
    });

    setDiagnosticsLoading(false);
    setLastCheckedDiag('Just now');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    
    // Save to localStorage
    setApiUrl(apiUrl);
    if (apiToken) {
      localStorage.setItem('amaretti_jwt', apiToken);
    } else {
      localStorage.removeItem('amaretti_jwt');
    }
    localStorage.setItem('dashboard_refresh_interval', refreshInterval);
    localStorage.setItem('dashboard_telemetry', telemetry ? 'true' : 'false');
    
    onConfigChange();

    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 1000);
  };

  const handleDangerAction = (action: string) => {
    if (action === 'delete_config') {
      if (confirm('Are you sure you want to clear all configurations? This will remove all tokens and endpoints and return to defaults.')) {
        localStorage.removeItem('amaretti_jwt');
        localStorage.removeItem('amaretti_user');
        localStorage.removeItem('amaretti_api_url');
        localStorage.removeItem('dashboard_refresh_interval');
        localStorage.removeItem('dashboard_telemetry');
        window.location.reload();
      }
    }
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
              { id: 'general' as const, label: 'General', desc: 'Refresh interval & telemetry', icon: Globe },
              { id: 'api' as const, label: 'API & Authentication', desc: 'Manage API endpoint & JWT token', icon: Key },
              { id: 'profile' as const, label: 'User Profile', desc: 'View current active user details', icon: Shield }
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
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Refresh Interval</label>
                    <p className="text-[9px] text-text-faint mt-0.5">How often the dashboard auto-refreshes task lists and metrics</p>
                    <select
                      value={refreshInterval}
                      onChange={e => setRefreshInterval(e.target.value)}
                      className="w-full rounded-lg border border-border-glass bg-[#050811] px-3.5 py-2 text-xs text-text-main focus:border-accent-cyan/40 focus:outline-none"
                    >
                      <option value="5000">5 seconds (Real-time)</option>
                      <option value="10000">10 seconds (Standard)</option>
                      <option value="30000">30 seconds</option>
                      <option value="60000">1 minute</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.03]">
                    <div>
                      <div className="text-xs font-semibold text-text-main">Enable Anonymous Telemetry</div>
                      <div className="text-[9px] text-text-faint">Collect client latency details to improve Brainlife monitoring</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTelemetry(!telemetry)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${telemetry ? 'bg-accent-cyan' : 'bg-white/10'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-[#050811] transition-transform ${telemetry ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'api' && (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                      Backend API Base URL
                    </label>
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={e => setApiUrlState(e.target.value)}
                      placeholder="https://brainlife.io/api/amaretti"
                      className="w-full rounded-lg border border-border-glass bg-[#050811] px-3.5 py-2 text-xs text-text-main focus:border-accent-cyan/40 focus:outline-none font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                      JWT Authentication Token
                    </label>
                    <textarea
                      value={apiToken}
                      onChange={e => setApiToken(e.target.value)}
                      placeholder="Paste your amaretti_jwt token here..."
                      rows={4}
                      className="w-full rounded-lg border border-border-glass bg-[#050811] px-3.5 py-2 text-xs text-text-main focus:border-accent-cyan/40 focus:outline-none font-mono resize-none"
                    />
                    <p className="text-[9px] text-text-faint">Your authentication token is stored locally in your browser context.</p>
                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="space-y-5">
                  {localStorage.getItem('amaretti_user') ? (
                    (() => {
                      const userProfile = JSON.parse(localStorage.getItem('amaretti_user') || '{}');
                      return (
                        <div className="space-y-3.5">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <span className="text-[9px] font-bold text-text-faint uppercase tracking-wider">Full Name</span>
                              <div className="bg-[#161C26] border border-border-glass rounded-lg px-3 py-2 text-xs text-text-main font-semibold">
                                {userProfile.fullname || 'Not specified'}
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <span className="text-[9px] font-bold text-text-faint uppercase tracking-wider">Username Handle</span>
                              <div className="bg-[#161C26] border border-border-glass rounded-lg px-3 py-2 text-xs font-mono text-accent-cyan font-bold">
                                @{userProfile.username || 'Not specified'}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[9px] font-bold text-text-faint uppercase tracking-wider">Email Address</span>
                            <div className="bg-[#161C26] border border-border-glass rounded-lg px-3 py-2 text-xs text-text-muted">
                              {userProfile.email || 'No email associated'}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[9px] font-bold text-text-faint uppercase tracking-wider">Database ID / Sub</span>
                            <div className="bg-[#161C26] border border-border-glass rounded-lg px-3 py-2 text-xs font-mono text-text-faint">
                              {userProfile.id || 'Unknown'}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="py-8 text-center text-xs text-text-faint font-medium">
                      No logged in user profile found
                    </div>
                  )}
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-glass">
                <button
                  type="button"
                  onClick={() => {
                    setApiUrlState(getApiUrl());
                    setApiToken(localStorage.getItem('amaretti_jwt') || '');
                    setRefreshInterval('10000');
                    setTelemetry(true);
                  }}
                  className="rounded-lg border border-border-glass bg-[#161C26] hover:bg-[#1E2532] px-4 py-2.5 text-xs font-semibold text-text-muted hover:text-text-main transition-all cursor-pointer shadow-sm"
                >
                  Reset Defaults
                </button>
                <button
                  type="submit"
                  disabled={saveStatus === 'saving'}
                  className="rounded-lg bg-[#2D3748] hover:bg-[#1A202C] px-5 py-2.5 text-xs font-bold text-white active:scale-[0.98] transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
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
        <div className="bg-status-error/5 border border-status-error/20 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-status-error" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-status-error">
                Danger Zone
              </h4>
              <p className="text-[10px] text-text-faint mt-0.5">Sensitive actions to reset client credentials and connections</p>
            </div>
          </div>

          <div className="flex">
            <button
              type="button"
              onClick={() => handleDangerAction('delete_config')}
              className="px-4 py-2.5 rounded-xl border border-status-error/20 bg-status-error/[0.02] hover:bg-status-error/[0.08] hover:border-status-error/40 active:scale-[0.98] transition-all text-center cursor-pointer flex flex-col items-start gap-1"
            >
              <span className="text-[10px] font-bold text-status-error">Clear Configuration & Log Out</span>
              <span className="text-[8px] text-text-faint">Remove all saved JWT tokens and reset the API URL to default.</span>
            </button>
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
                </tr>
                <tr>
                  <td className="px-3.5 py-2 font-semibold text-text-faint">API Endpoint</td>
                  <td className="px-3.5 py-2 text-right text-text-main font-bold truncate max-w-[140px]" title={apiUrl}>{apiUrl}</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2 font-semibold text-text-faint">Auth Status</td>
                  <td className={`px-3.5 py-2 text-right font-bold ${apiToken ? 'text-status-success' : 'text-status-error'}`}>
                    {apiToken ? 'Authenticated' : 'Not configured'}
                  </td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2 font-semibold text-text-faint">Polling Interval</td>
                  <td className="px-3.5 py-2 text-right text-text-main font-bold">
                    {refreshInterval === '5000' ? '5s' : refreshInterval === '10000' ? '10s' : refreshInterval === '30000' ? '30s' : '60s'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
