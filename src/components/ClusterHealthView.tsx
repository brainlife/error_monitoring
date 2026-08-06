import { useState, useMemo } from 'react';
import { 
  Server, 
  HardDrive, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  RefreshCw, 
  Terminal, 
  Layers, 
  Search, 
  ShieldCheck, 
  Activity,
  ChevronRight,
  Database
} from 'lucide-react';
import type { View } from './Sidebar';

interface ClusterHealthViewProps {
  onNavigate?: (v: View) => void;
}

interface SlurmNode {
  id: string;
  cluster: 'slurm147' | 'slurm24' | 'slurm25' | 'slurm-pirate';
  partition: string;
  state: 'idle' | 'allocated' | 'down' | 'drain' | 'maint';
  cpus: string;
  memory: string;
  reason?: string;
  uptime: string;
}

const MOCK_SLURM_NODES: SlurmNode[] = [
  // slurm147 nodes
  { id: 'node147-01', cluster: 'slurm147', partition: 'main', state: 'allocated', cpus: '32/32', memory: '128GB / 128GB', uptime: '14d 6h' },
  { id: 'node147-02', cluster: 'slurm147', partition: 'main', state: 'allocated', cpus: '28/32', memory: '112GB / 128GB', uptime: '14d 6h' },
  { id: 'node147-03', cluster: 'slurm147', partition: 'main', state: 'idle', cpus: '0/32', memory: '4GB / 128GB', uptime: '14d 6h' },
  { id: 'node147-04', cluster: 'slurm147', partition: 'main', state: 'idle', cpus: '0/32', memory: '4GB / 128GB', uptime: '14d 6h' },
  { id: 'node147-05', cluster: 'slurm147', partition: 'main', state: 'down', cpus: '0/32', memory: '0GB / 128GB', reason: 'Node socket timeout / Unreachable', uptime: '0h' },
  { id: 'node147-06', cluster: 'slurm147', partition: 'main', state: 'down', cpus: '0/32', memory: '0GB / 128GB', reason: 'Kernel panic on boot', uptime: '0h' },
  
  // slurm24 nodes
  { id: 'node24-01', cluster: 'slurm24', partition: 'batch', state: 'allocated', cpus: '16/16', memory: '64GB / 64GB', uptime: '28d 12h' },
  { id: 'node24-02', cluster: 'slurm24', partition: 'batch', state: 'idle', cpus: '0/16', memory: '2GB / 64GB', uptime: '28d 12h' },
  { id: 'node24-03', cluster: 'slurm24', partition: 'batch', state: 'drain', cpus: '0/16', memory: '2GB / 64GB', reason: 'Scheduled OS kernel update', uptime: '28d 12h' },

  // slurm25 nodes
  { id: 'node25-01', cluster: 'slurm25', partition: 'gpu-high', state: 'allocated', cpus: '64/64', memory: '256GB / 256GB', uptime: '42d 1h' },
  { id: 'node25-02', cluster: 'slurm25', partition: 'gpu-high', state: 'allocated', cpus: '64/64', memory: '256GB / 256GB', uptime: '42d 1h' },
  { id: 'node25-03', cluster: 'slurm25', partition: 'gpu-high', state: 'idle', cpus: '0/64', memory: '8GB / 256GB', uptime: '42d 1h' },
  { id: 'node25-04', cluster: 'slurm25', partition: 'gpu-high', state: 'idle', cpus: '0/64', memory: '8GB / 256GB', uptime: '42d 1h' },

  // slurm-pirate nodes
  { id: 'pirate-01', cluster: 'slurm-pirate', partition: 'pirate-batch', state: 'allocated', cpus: '16/16', memory: '64GB / 64GB', uptime: '9d 4h' },
  { id: 'pirate-02', cluster: 'slurm-pirate', partition: 'pirate-batch', state: 'idle', cpus: '0/16', memory: '2GB / 64GB', uptime: '9d 4h' }
];

export default function ClusterHealthView({ onNavigate }: ClusterHealthViewProps) {
  const [selectedClusterFilter, setSelectedClusterFilter] = useState<string>('all');
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showRawSinfoConsole, setShowRawSinfoConsole] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>(() => new Date().toLocaleTimeString());

  // Re-check health probe simulation
  const handleRefreshProbes = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastCheckTime(new Date().toLocaleTimeString());
    }, 600);
  };

  // Filtered SLURM nodes
  const filteredNodes = useMemo(() => {
    return MOCK_SLURM_NODES.filter(n => {
      if (selectedClusterFilter !== 'all' && n.cluster !== selectedClusterFilter) return false;
      if (selectedStateFilter !== 'all' && n.state !== selectedStateFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return n.id.toLowerCase().includes(q) || n.cluster.toLowerCase().includes(q) || (n.reason && n.reason.toLowerCase().includes(q));
      }
      return true;
    });
  }, [selectedClusterFilter, selectedStateFilter, searchQuery]);

  // Overall SLURM Cluster Summary Stats
  const clusterStats = useMemo(() => {
    let idle = 0;
    let allocated = 0;
    let down = 0;
    let drain = 0;

    MOCK_SLURM_NODES.forEach(n => {
      if (n.state === 'idle') idle++;
      else if (n.state === 'allocated') allocated++;
      else if (n.state === 'down') down++;
      else if (n.state === 'drain') drain++;
    });

    return {
      total: MOCK_SLURM_NODES.length,
      idle,
      allocated,
      down,
      drain
    };
  }, []);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-cyan/15 border border-accent-cyan/30 text-accent-cyan shadow-[0_0_12px_rgba(0,229,255,0.2)]">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                Cluster & Jetstream2 VM Health Monitor
              </h1>
              <p className="text-xs text-text-muted mt-0.5 font-sans">
                Automated daily health checks for <strong className="text-accent-cyan font-mono">prod-xfer VM storage mounts</strong> and <strong className="text-amber-300 font-mono">SLURM cluster sinfo node states</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls & Status */}
        <div className="flex items-center gap-3 self-end md:self-auto font-mono text-xs">
          <div className="flex items-center gap-2 rounded-xl border border-status-success/30 bg-status-success/10 px-3 py-1.5 text-status-success">
            <ShieldCheck className="h-4 w-4 animate-pulse" />
            <span>All Probes Operational</span>
          </div>

          <button
            onClick={handleRefreshProbes}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-xl border border-border-glass bg-white/[0.03] px-3.5 py-1.5 font-bold text-white hover:bg-white/[0.07] transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-accent-cyan ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Checking...' : 'Run Probes'}</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: Jetstream2 VM Storage Mounts (prod-xfer) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono">
            <Server className="h-4 w-4 text-amber-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              1. Jetstream2 VM Storage Mounts (<span className="text-amber-300">prod-xfer</span>)
            </h2>
            <span className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[9.5px] text-text-faint">
              Host: js2-prod-xfer-01 (149.165.155.84)
            </span>
          </div>
          <span className="text-[10px] font-mono text-text-faint">Last checked: {lastCheckTime}</span>
        </div>

        {/* Mount Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mount 1: /mnt/scratch */}
          <div className="glass relative overflow-hidden rounded-2xl p-5 border border-border-glass space-y-4 shadow-lg group hover:border-accent-cyan/40 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-success/15 border border-status-success/30 text-status-success shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                  <HardDrive className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-mono text-sm font-bold text-white flex items-center gap-1.5">
                    /mnt/scratch
                    <span className="text-[9.5px] font-sans text-text-muted font-normal">(NFS Scratch Storage)</span>
                  </h3>
                  <p className="text-[10.5px] text-text-faint font-mono mt-0.5">
                    Target: prod-xfer VM volume
                  </p>
                </div>
              </div>

              <span className="flex items-center gap-1.5 rounded-full border border-status-success/40 bg-status-success/15 px-2.5 py-1 text-[10px] font-bold font-mono text-status-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                MOUNTED & HEALTHY
              </span>
            </div>

            {/* Capacity & Usage Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-text-muted">Volume Capacity</span>
                <span className="text-white font-bold">8.4 TB / 12.0 TB <span className="text-accent-cyan font-normal">(70% Used)</span></span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-accent-cyan to-status-success rounded-full" style={{ width: '70%' }} />
              </div>
            </div>

            {/* Mount Details Grid */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.04] font-mono text-[10px]">
              <div>
                <span className="text-text-faint block">Access Rights</span>
                <span className="text-emerald-300 font-bold">rw,nosuid,nodev</span>
              </div>
              <div>
                <span className="text-text-faint block">Mount Latency</span>
                <span className="text-white font-bold">12 ms</span>
              </div>
              <div>
                <span className="text-text-faint block">File Accessibility</span>
                <span className="text-status-success font-bold">✓ 1,420 files</span>
              </div>
            </div>
          </div>

          {/* Mount 2: /mnt/osiris */}
          <div className="glass relative overflow-hidden rounded-2xl p-5 border border-border-glass space-y-4 shadow-lg group hover:border-accent-cyan/40 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-success/15 border border-status-success/30 text-status-success shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-mono text-sm font-bold text-white flex items-center gap-1.5">
                    /mnt/osiris
                    <span className="text-[9.5px] font-sans text-text-muted font-normal">(Ceph Osiris Storage)</span>
                  </h3>
                  <p className="text-[10.5px] text-text-faint font-mono mt-0.5">
                    Target: prod-xfer VM volume
                  </p>
                </div>
              </div>

              <span className="flex items-center gap-1.5 rounded-full border border-status-success/40 bg-status-success/15 px-2.5 py-1 text-[10px] font-bold font-mono text-status-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                MOUNTED & HEALTHY
              </span>
            </div>

            {/* Capacity & Usage Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-text-muted">Volume Capacity</span>
                <span className="text-white font-bold">42.1 TB / 50.0 TB <span className="text-amber-300 font-normal">(84% Used)</span></span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-accent-cyan via-status-warning to-amber-500 rounded-full" style={{ width: '84%' }} />
              </div>
            </div>

            {/* Mount Details Grid */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.04] font-mono text-[10px]">
              <div>
                <span className="text-text-faint block">Access Rights</span>
                <span className="text-emerald-300 font-bold">rw,noatime</span>
              </div>
              <div>
                <span className="text-text-faint block">Mount Latency</span>
                <span className="text-white font-bold">18 ms</span>
              </div>
              <div>
                <span className="text-text-faint block">File Accessibility</span>
                <span className="text-status-success font-bold">✓ 8,950 archives</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: SLURM Cluster Node Matrix (sinfo Inspector) */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono">
            <Cpu className="h-4 w-4 text-accent-cyan" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              2. Jetstream2 SLURM Clusters Matrix (<span className="text-accent-cyan">sinfo command monitor</span>)
            </h2>
          </div>

          <button
            onClick={() => setShowRawSinfoConsole(!showRawSinfoConsole)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 text-[10.5px] font-mono font-bold transition-all cursor-pointer ${
              showRawSinfoConsole
                ? 'border-accent-purple/50 bg-accent-purple/20 text-accent-purple'
                : 'border-border-glass bg-white/[0.02] text-text-muted hover:text-white'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>{showRawSinfoConsole ? 'Hide Raw sinfo Terminal' : 'View Raw sinfo Output'}</span>
          </button>
        </div>

        {/* 4 SLURM Cluster Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* slurm147 */}
          <div 
            onClick={() => setSelectedClusterFilter(selectedClusterFilter === 'slurm147' ? 'all' : 'slurm147')}
            className={`glass rounded-2xl p-4 border transition-all cursor-pointer ${
              selectedClusterFilter === 'slurm147' 
                ? 'border-accent-cyan bg-accent-cyan/10 ring-1 ring-accent-cyan' 
                : 'border-border-glass hover:border-white/20'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-text-faint block">Cluster Node</span>
                <h4 className="font-mono text-sm font-bold text-white">slurm147</h4>
              </div>
              <span className="rounded-md bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 text-[9.5px] font-mono font-bold">
                2 Nodes Down
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1 font-mono text-[10px] text-center">
              <div className="bg-status-success/15 border border-status-success/30 rounded-lg p-1 text-status-success">
                <span className="block font-bold">2 Idle</span>
              </div>
              <div className="bg-accent-cyan/15 border border-accent-cyan/30 rounded-lg p-1 text-accent-cyan">
                <span className="block font-bold">2 Alloc</span>
              </div>
              <div className="bg-red-500/15 border border-red-500/30 rounded-lg p-1 text-red-400">
                <span className="block font-bold">2 Down</span>
              </div>
            </div>
          </div>

          {/* slurm24 */}
          <div 
            onClick={() => setSelectedClusterFilter(selectedClusterFilter === 'slurm24' ? 'all' : 'slurm24')}
            className={`glass rounded-2xl p-4 border transition-all cursor-pointer ${
              selectedClusterFilter === 'slurm24' 
                ? 'border-accent-cyan bg-accent-cyan/10 ring-1 ring-accent-cyan' 
                : 'border-border-glass hover:border-white/20'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-text-faint block">Cluster Node</span>
                <h4 className="font-mono text-sm font-bold text-white">slurm24</h4>
              </div>
              <span className="rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[9.5px] font-mono font-bold">
                1 Node Drain
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1 font-mono text-[10px] text-center">
              <div className="bg-status-success/15 border border-status-success/30 rounded-lg p-1 text-status-success">
                <span className="block font-bold">1 Idle</span>
              </div>
              <div className="bg-accent-cyan/15 border border-accent-cyan/30 rounded-lg p-1 text-accent-cyan">
                <span className="block font-bold">1 Alloc</span>
              </div>
              <div className="bg-amber-500/15 border border-amber-500/30 rounded-lg p-1 text-amber-300">
                <span className="block font-bold">1 Drain</span>
              </div>
            </div>
          </div>

          {/* slurm25 */}
          <div 
            onClick={() => setSelectedClusterFilter(selectedClusterFilter === 'slurm25' ? 'all' : 'slurm25')}
            className={`glass rounded-2xl p-4 border transition-all cursor-pointer ${
              selectedClusterFilter === 'slurm25' 
                ? 'border-accent-cyan bg-accent-cyan/10 ring-1 ring-accent-cyan' 
                : 'border-border-glass hover:border-white/20'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-text-faint block">Cluster Node</span>
                <h4 className="font-mono text-sm font-bold text-white">slurm25</h4>
              </div>
              <span className="rounded-md bg-status-success/20 text-status-success border border-status-success/30 px-2 py-0.5 text-[9.5px] font-mono font-bold">
                Optimal
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1 font-mono text-[10px] text-center">
              <div className="bg-status-success/15 border border-status-success/30 rounded-lg p-1 text-status-success">
                <span className="block font-bold">2 Idle</span>
              </div>
              <div className="bg-accent-cyan/15 border border-accent-cyan/30 rounded-lg p-1 text-accent-cyan">
                <span className="block font-bold">2 Alloc</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-1 text-text-faint">
                <span className="block font-bold">0 Down</span>
              </div>
            </div>
          </div>

          {/* slurm-pirate */}
          <div 
            onClick={() => setSelectedClusterFilter(selectedClusterFilter === 'slurm-pirate' ? 'all' : 'slurm-pirate')}
            className={`glass rounded-2xl p-4 border transition-all cursor-pointer ${
              selectedClusterFilter === 'slurm-pirate' 
                ? 'border-accent-cyan bg-accent-cyan/10 ring-1 ring-accent-cyan' 
                : 'border-border-glass hover:border-white/20'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-text-faint block">Cluster Node</span>
                <h4 className="font-mono text-sm font-bold text-white">slurm-pirate</h4>
              </div>
              <span className="rounded-md bg-status-success/20 text-status-success border border-status-success/30 px-2 py-0.5 text-[9.5px] font-mono font-bold">
                Optimal
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1 font-mono text-[10px] text-center">
              <div className="bg-status-success/15 border border-status-success/30 rounded-lg p-1 text-status-success">
                <span className="block font-bold">1 Idle</span>
              </div>
              <div className="bg-accent-cyan/15 border border-accent-cyan/30 rounded-lg p-1 text-accent-cyan">
                <span className="block font-bold">1 Alloc</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-1 text-text-faint">
                <span className="block font-bold">0 Down</span>
              </div>
            </div>
          </div>
        </div>

        {/* Optional Raw sinfo Terminal View */}
        {showRawSinfoConsole && (
          <div className="rounded-2xl border border-accent-purple/30 bg-[#060913] p-4 font-mono text-xs text-green-400 space-y-2 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between text-text-faint border-b border-white/10 pb-2 text-[10.5px]">
              <span className="flex items-center gap-1.5 text-accent-purple font-bold">
                <Terminal className="h-4 w-4" />
                sinfo -Ne (Simulated Terminal Output for Taylor)
              </span>
              <span>Host: jetstream2-master-control</span>
            </div>
            <pre className="overflow-x-auto text-[11px] leading-relaxed text-gray-300 select-all py-2">
{`$ sinfo -Ne -o "%.12N %.8P %.10t %.10C %.12m %.30E"
NODELIST     PARTITION  STATE      CPUS(A/I/O) MEMORY       REASON
node147-01   main*      allocated  32/0/0/32   128000       none
node147-02   main*      allocated  28/4/0/32   128000       none
node147-03   main*      idle       0/32/0/32   128000       none
node147-04   main*      idle       0/32/0/32   128000       none
node147-05   main*      down*      0/0/32/32   128000       Node socket timeout / Unreachable
node147-06   main*      down*      0/0/32/32   128000       Kernel panic on boot
node24-01    batch      allocated  16/0/0/16   64000        none
node24-02    batch      idle       0/16/0/16   64000        none
node24-03    batch      drain*     0/0/16/16   64000        Scheduled OS kernel update
node25-01    gpu-high   allocated  64/0/0/64   256000       none
pirate-01    pirate-b*  allocated  16/0/0/16   64000        none`}
            </pre>
          </div>
        )}

        {/* Node Filter & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* State Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1 font-mono text-[10.5px]">
            {[
              { id: 'all', label: `All Nodes (${MOCK_SLURM_NODES.length})` },
              { id: 'idle', label: `Idle (${clusterStats.idle}) 🟢` },
              { id: 'allocated', label: `Allocated (${clusterStats.allocated}) 🔵` },
              { id: 'down', label: `Down (${clusterStats.down}) 🔴` },
              { id: 'drain', label: `Drain (${clusterStats.drain}) 🟡` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedStateFilter(tab.id)}
                className={`rounded-xl px-3 py-1.5 font-bold transition-all cursor-pointer ${
                  selectedStateFilter === tab.id
                    ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40'
                    : 'bg-white/[0.02] border border-border-glass text-text-muted hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64 font-mono text-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-faint" />
            <input
              type="text"
              placeholder="Search node ID or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-border-glass bg-bg-dark/60 pl-9 pr-3 py-1.5 text-white placeholder-text-faint focus:outline-none focus:border-accent-cyan/50"
            />
          </div>
        </div>

        {/* Interactive Node Table */}
        <div className="glass overflow-hidden rounded-2xl border border-border-glass">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-white/[0.02] border-b border-white/[0.06] text-[10px] uppercase text-text-faint">
                <tr>
                  <th className="py-3 px-4">Node ID</th>
                  <th className="py-3 px-4">Cluster</th>
                  <th className="py-3 px-4">Partition</th>
                  <th className="py-3 px-4">State</th>
                  <th className="py-3 px-4">CPU Cores</th>
                  <th className="py-3 px-4">RAM Allocation</th>
                  <th className="py-3 px-4">Diagnostic / Down Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filteredNodes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-text-faint font-sans">
                      No SLURM cluster nodes match the selected filters
                    </td>
                  </tr>
                ) : (
                  filteredNodes.map(node => {
                    let stateBadge = 'bg-status-success/15 text-status-success border-status-success/30';
                    if (node.state === 'allocated') stateBadge = 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30';
                    else if (node.state === 'down') stateBadge = 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse';
                    else if (node.state === 'drain') stateBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/40';

                    return (
                      <tr key={node.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-bold text-white">{node.id}</td>
                        <td className="py-3 px-4 text-accent-cyan font-bold">{node.cluster}</td>
                        <td className="py-3 px-4 text-text-muted">{node.partition}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-block rounded-lg px-2.5 py-0.5 text-[10px] font-bold border uppercase ${stateBadge}`}>
                            {node.state}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white font-bold">{node.cpus}</td>
                        <td className="py-3 px-4 text-text-muted">{node.memory}</td>
                        <td className="py-3 px-4 text-text-faint text-[11px]">
                          {node.reason ? (
                            <span className="text-red-300 font-bold">{node.reason}</span>
                          ) : (
                            <span>—</span>
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
  );
}
