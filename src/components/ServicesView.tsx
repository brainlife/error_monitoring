import { useState, useMemo } from 'react';
import {
  Search,
  Server,
  Cpu,
  Layers,
  ChevronRight,
  Sliders,
  CheckCircle2,
  PlayCircle,
  StopCircle,
  Activity,
  History,
  Workflow,
  ExternalLink,
  Info,
  Clock,
  Check
} from 'lucide-react';

interface ServiceData {
  id: string;
  name: string;
  category: 'Validator' | 'Application' | 'API' | 'Worker' | 'Storage' | 'Scheduler';
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  isRunning: boolean;
  version: string;
  owner: string;
  runningSince: string;
  lastRestart: string;
  healthScore: number;
  availability: number;
  errorRate: number;
  avgRuntime: string;
  avgWait: string;
  runningTasks: number;
  queuedTasks: number;
  failedTasks: number;
  completedToday: number;
  workers: number;
  resourceDistribution: { name: string; workers: number }[];
  executionTimeline: { label: string; time?: string; status: 'completed' | 'active' | 'pending' }[];
  dependencyGraph: string[];
  dependencyHealth: { name: string; status: 'healthy' | 'warning' | 'critical' | 'offline' }[];
  recentErrors: { time: string; severity: 'ERROR' | 'WARNING'; task: string; message: string }[];
  topErrorCategories: { category: string; count: number }[];
  performanceMetrics: {
    successRate: number[];
    runtimeTrend: number[];
    throughput: number[];
    queueTrend: number[];
  };
  versionHistory: { version: string; date: string; type: string; active: boolean }[];
  connectedResources: string[];
  connectedTasks: { id: string; status: 'running' | 'completed' | 'failed' }[];
  configuration: {
    workers: number;
    concurrency: number;
    memoryLimit: string;
    cpuLimit: string;
    timeout: string;
    retries: number;
  };
}

const SERVICE_METADATA_LOOKUP: Record<string, Partial<ServiceData>> = {
  'validator-neuro-freesurfer': {
    version: '2.4.2',
    owner: 'Brainlife',
    category: 'Validator',
    dependencyGraph: ['API', 'Scheduler', 'validator-neuro-freesurfer', 'FreeSurfer App', 'Archive Service', 'Upload'],
    dependencyHealth: [
      { name: 'Scheduler', status: 'healthy' },
      { name: 'MongoDB', status: 'healthy' },
      { name: 'Redis', status: 'healthy' },
      { name: 'Storage', status: 'warning' },
      { name: 'SSH', status: 'critical' }
    ],
    configuration: { workers: 12, concurrency: 4, memoryLimit: '16 GB', cpuLimit: '8 cores', timeout: '32 min', retries: 3 }
  },
  'brainlife/app-freesurfer': {
    version: '2.1.3',
    owner: 'Brainlife',
    category: 'Application',
    dependencyGraph: ['Scheduler', 'brainlife/app-freesurfer', 'Archive Service'],
    dependencyHealth: [
      { name: 'Scheduler', status: 'healthy' },
      { name: 'MongoDB', status: 'healthy' },
      { name: 'Storage', status: 'healthy' }
    ],
    configuration: { workers: 8, concurrency: 2, memoryLimit: '32 GB', cpuLimit: '16 cores', timeout: '3 hours', retries: 2 }
  },
  'brainlife/app-stage': {
    version: '1.4.0',
    owner: 'Brainlife',
    category: 'Application',
    dependencyGraph: ['API', 'brainlife/app-stage', 'Storage'],
    dependencyHealth: [
      { name: 'Storage', status: 'warning' },
      { name: 'Network Gateway', status: 'healthy' }
    ],
    configuration: { workers: 4, concurrency: 8, memoryLimit: '8 GB', cpuLimit: '4 cores', timeout: '12 min', retries: 5 }
  },
  'api-server': {
    version: '4.2.1',
    owner: 'Infrastructure Team',
    category: 'API',
    dependencyGraph: ['Load Balancer', 'api-server', 'MongoDB', 'Redis'],
    dependencyHealth: [
      { name: 'Load Balancer', status: 'healthy' },
      { name: 'MongoDB', status: 'healthy' },
      { name: 'Redis', status: 'healthy' }
    ],
    configuration: { workers: 16, concurrency: 200, memoryLimit: '4 GB', cpuLimit: '2 cores', timeout: '150 ms', retries: 0 }
  },
  'archive-service': {
    version: '3.0.1',
    owner: 'Data Archival Team',
    category: 'Storage',
    dependencyGraph: ['Archive service', 'HPSS Cluster', 'Object Storage'],
    dependencyHealth: [
      { name: 'HPSS Cluster', status: 'critical' },
      { name: 'Object Storage', status: 'healthy' }
    ],
    configuration: { workers: 6, concurrency: 5, memoryLimit: '12 GB', cpuLimit: '6 cores', timeout: '1 hour', retries: 4 }
  },
  'scheduler': {
    version: '1.9.5',
    owner: 'Workflow Team',
    category: 'Scheduler',
    dependencyGraph: ['Scheduler', 'MongoDB', 'Redis', 'Compute Clusters'],
    dependencyHealth: [
      { name: 'MongoDB', status: 'healthy' },
      { name: 'Redis', status: 'healthy' },
      { name: 'Karst', status: 'healthy' },
      { name: 'BigRed3', status: 'healthy' }
    ],
    configuration: { workers: 1, concurrency: 50, memoryLimit: '4 GB', cpuLimit: '4 cores', timeout: '5 min', retries: 10 }
  },
  'mongodb': {
    version: '6.0.5',
    owner: 'DBA Team',
    category: 'Storage',
    dependencyGraph: ['mongodb', 'Local Storage Volume'],
    dependencyHealth: [
      { name: 'Local Storage Volume', status: 'healthy' }
    ],
    configuration: { workers: 1, concurrency: 1000, memoryLimit: '64 GB', cpuLimit: '16 cores', timeout: '2 ms', retries: 0 }
  },
  'redis': {
    version: '7.0.10',
    owner: 'DBA Team',
    category: 'Storage',
    dependencyGraph: ['redis', 'Memory Pool'],
    dependencyHealth: [
      { name: 'Memory Pool', status: 'healthy' }
    ],
    configuration: { workers: 1, concurrency: 5000, memoryLimit: '16 GB', cpuLimit: '4 cores', timeout: '0.5 ms', retries: 0 }
  },
  'event-worker': {
    version: '2.0.0',
    owner: 'Infrastructure Team',
    category: 'Worker',
    dependencyGraph: ['Redis', 'event-worker', 'Slack Webhook'],
    dependencyHealth: [
      { name: 'Redis', status: 'healthy' },
      { name: 'Slack Webhook', status: 'healthy' }
    ],
    configuration: { workers: 10, concurrency: 20, memoryLimit: '2 GB', cpuLimit: '1 core', timeout: '10 sec', retries: 3 }
  },
  'brainlife/app-streamline-cleaning': {
    version: '1.0.2',
    owner: 'Brainlife',
    category: 'Application',
    dependencyGraph: ['Scheduler', 'brainlife/app-streamline-cleaning', 'Storage'],
    dependencyHealth: [
      { name: 'Scheduler', status: 'healthy' },
      { name: 'Storage', status: 'healthy' }
    ],
    configuration: { workers: 4, concurrency: 1, memoryLimit: '16 GB', cpuLimit: '8 cores', timeout: '1 hour', retries: 1 }
  },
  'brainlife/app-sift2-connectome-generation': {
    version: '1.1.0',
    owner: 'Brainlife',
    category: 'Application',
    dependencyGraph: ['Scheduler', 'brainlife/app-sift2-connectome-generation', 'Storage'],
    dependencyHealth: [
      { name: 'Scheduler', status: 'healthy' },
      { name: 'Storage', status: 'healthy' }
    ],
    configuration: { workers: 4, concurrency: 1, memoryLimit: '32 GB', cpuLimit: '16 cores', timeout: '2 hours', retries: 2 }
  }
};

// Helper to render sparklines inside React component
const Sparkline = ({ data, color = '#00E5FF' }: { data: number[]; color?: string }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 120;
  const height = 24;
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
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

interface ServicesViewProps {
  onNavigate: (view: 'dashboard' | 'resources' | 'services' | 'tasks' | 'analytics' | 'settings') => void;
  onSelectTask: (task: any) => void;
  tasksList: any[];
}

export default function ServicesView({ onNavigate, onSelectTask, tasksList }: ServicesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'healthy' | 'warning' | 'critical' | 'offline' | 'running' | 'stopped'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Validator' | 'Application' | 'API' | 'Worker' | 'Storage' | 'Scheduler'>('all');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('srv-1');

  const servicesList = useMemo(() => {
    // 1. Get unique service names from tasksList
    const serviceNames = Array.from(new Set(tasksList.map(t => t.service))).filter(Boolean);
    
    // Add default services if tasksList is empty or doesn't have them
    const defaultServices = [
      'validator-neuro-freesurfer',
      'brainlife/app-freesurfer',
      'brainlife/app-stage',
      'api-server',
      'archive-service',
      'scheduler',
      'mongodb',
      'redis',
      'event-worker',
      'brainlife/app-streamline-cleaning',
      'brainlife/app-sift2-connectome-generation'
    ];
    
    defaultServices.forEach(ds => {
      if (!serviceNames.includes(ds)) {
        serviceNames.push(ds);
      }
    });

    return serviceNames.map((name, index) => {
      const serviceTasks = tasksList.filter(t => t.service === name);
      const runningTasks = serviceTasks.filter(t => t.status === 'running').length;
      const queuedTasks = serviceTasks.filter(t => t.status === 'queued').length;
      const failedTasks = serviceTasks.filter(t => t.status === 'failed').length;
      const completedTasks = serviceTasks.filter(t => t.status === 'finished').length;
      const totalTasks = serviceTasks.length;

      // Determine live status based on task outcomes
      let status: 'healthy' | 'warning' | 'critical' | 'offline' = 'offline';
      let isRunning = false;

      if (totalTasks > 0) {
        isRunning = runningTasks > 0 || queuedTasks > 0;
        if (failedTasks > 0) {
          status = runningTasks > 0 ? 'warning' : 'critical';
        } else if (runningTasks > 0) {
          status = 'healthy';
        } else {
          status = 'healthy'; // if all succeeded
        }
      } else {
        // Fallback status for default services if no tasks exist
        const fallbackStatuses: Record<string, 'healthy' | 'warning' | 'critical' | 'offline'> = {
          'validator-neuro-freesurfer': 'healthy',
          'brainlife/app-freesurfer': 'healthy',
          'brainlife/app-stage': 'warning',
          'api-server': 'healthy',
          'archive-service': 'critical',
          'scheduler': 'healthy',
          'mongodb': 'healthy',
          'redis': 'healthy',
          'event-worker': 'healthy',
          'brainlife/app-streamline-cleaning': 'healthy',
          'brainlife/app-sift2-connectome-generation': 'offline'
        };
        status = fallbackStatuses[name] || 'healthy';
        isRunning = status === 'healthy' || status === 'warning';
      }

      // Compute resource distribution dynamically from tasks
      const resourcesMap: Record<string, number> = {};
      serviceTasks.forEach(t => {
        if (t.resource) {
          resourcesMap[t.resource] = (resourcesMap[t.resource] || 0) + 1;
        }
      });
      
      let resourceDistribution = Object.entries(resourcesMap).map(([resName, count]) => ({
        name: resName,
        workers: count
      }));
      
      // Fallback resource distribution if empty
      if (resourceDistribution.length === 0) {
        if (name.includes('freesurfer')) {
          resourceDistribution = [{ name: 'Karst', workers: 4 }, { name: 'BigRed3', workers: 2 }];
        } else if (name.includes('stage')) {
          resourceDistribution = [{ name: 'Carbonate', workers: 2 }, { name: 'AWS Batch', workers: 2 }];
        } else if (name.includes('archive') || name.includes('storage') || name.includes('mongodb') || name.includes('redis')) {
          resourceDistribution = [{ name: 'Carbonate Storage Node', workers: 1 }];
        } else {
          resourceDistribution = [{ name: 'AWS Batch', workers: 2 }];
        }
      }

      // Compute execution timeline dynamically from tasks
      let executionTimeline: ServiceData['executionTimeline'] = [
        { label: 'Started', time: '19:22', status: 'completed' },
        { label: 'Dataset Downloaded', time: '19:24', status: 'completed' },
        { label: 'Validation', time: '19:26', status: 'completed' },
        { label: 'Running Process', time: '19:35', status: 'active' },
        { label: 'Uploading Results', status: 'pending' },
        { label: 'Completed', status: 'pending' }
      ];
      
      if (serviceTasks.length > 0) {
        const lastTask = serviceTasks[0];
        executionTimeline = [
          { label: 'Job Received', time: lastTask.startedAt !== '--' ? lastTask.startedAt : 'Just now', status: 'completed' as const },
          { label: 'Resource Allocated', status: 'completed' as const },
          { 
            label: lastTask.status === 'running' 
              ? 'Running Execution' 
              : lastTask.status === 'failed' 
              ? 'Failed Execution' 
              : lastTask.status === 'queued'
              ? 'Queued'
              : 'Completed Execution', 
            status: lastTask.status === 'running' ? 'active' as const : lastTask.status === 'queued' ? 'pending' as const : 'completed' as const 
          },
          { label: 'Results Verification', status: lastTask.status === 'finished' ? 'completed' as const : 'pending' as const },
          { label: 'Finalized', status: lastTask.status === 'finished' ? 'completed' as const : 'pending' as const }
        ];
      }

      // Get configuration details
      const configMetadata = SERVICE_METADATA_LOOKUP[name] || {
        version: '1.0.0',
        owner: 'Brainlife',
        category: name.includes('validator') ? 'Validator' as const : 'Application' as const,
        dependencyGraph: ['Scheduler', name],
        dependencyHealth: [{ name: 'Scheduler', status: 'healthy' as const }],
        configuration: { workers: 4, concurrency: 2, memoryLimit: '8 GB', cpuLimit: '4 cores', timeout: '2 hours', retries: 3 }
      };

      // Compile recent errors dynamically from tasks
      const recentErrors = serviceTasks
        .filter(t => t.status === 'failed')
        .map(t => ({
          time: t.startedAt !== '--' ? t.startedAt : 'Recently',
          severity: 'ERROR' as const,
          task: t.id,
          message: t.message || 'Execution error'
        }));
      
      // Fallback error log if none
      if (recentErrors.length === 0 && status === 'critical') {
        recentErrors.push({
          time: 'Recently',
          severity: 'ERROR' as const,
          task: 'unknown',
          message: 'Connection timed out to cluster'
        });
      }

      // Compile connected tasks dynamically
      const connectedTasks = serviceTasks.slice(0, 5).map(t => ({
        id: t.id,
        status: t.status === 'finished' ? 'completed' as const : t.status === 'failed' ? 'failed' as const : 'running' as const
      }));

      // Calculate health score dynamically
      const errorRate = totalTasks > 0 ? (failedTasks / totalTasks) * 100 : (status === 'critical' ? 35 : status === 'warning' ? 5 : 0);
      const healthScore = totalTasks > 0 ? Math.round(100 - errorRate) : (status === 'critical' ? 42 : status === 'warning' ? 84 : 98);
      const availability = totalTasks > 0 ? parseFloat((((totalTasks - failedTasks) / totalTasks) * 100).toFixed(2)) : (status === 'critical' ? 88.4 : 99.9);

      // Average runtime
      let avgRuntime = configMetadata.configuration?.timeout || '2 hours';
      if (name.includes('freesurfer')) avgRuntime = '32 min';
      else if (name.includes('stage')) avgRuntime = '12 min';
      else if (name.includes('api')) avgRuntime = '150 ms';
      else if (name.includes('mongodb')) avgRuntime = '2 ms';
      else if (name.includes('redis')) avgRuntime = '0.5 ms';

      // Compile performance metric graphs
      const successRateHistory = Array.from({ length: 12 }, (_, i) => {
        if (i === 11) return healthScore;
        return 95 + Math.floor(Math.random() * 5);
      });
      const runtimeTrendHistory = Array.from({ length: 12 }, () => 20 + Math.floor(Math.random() * 15));
      const throughputHistory = Array.from({ length: 10 }, () => 100 + Math.floor(Math.random() * 150));
      const queueTrendHistory = Array.from({ length: 10 }, () => Math.floor(Math.random() * 8));

      return {
        id: `srv-${index + 1}`,
        name,
        category: configMetadata.category || 'Application',
        status,
        isRunning,
        version: configMetadata.version || '1.0.0',
        owner: configMetadata.owner || 'Brainlife',
        runningSince: isRunning ? 'July 4' : 'Disabled',
        lastRestart: isRunning ? '2 days ago' : '10 days ago',
        healthScore,
        availability,
        errorRate: parseFloat(errorRate.toFixed(2)),
        avgRuntime,
        avgWait: queuedTasks > 0 ? '2 min' : '0 ms',
        runningTasks: totalTasks > 0 ? runningTasks : (status === 'healthy' ? 3 : 0),
        queuedTasks: totalTasks > 0 ? queuedTasks : 0,
        failedTasks: totalTasks > 0 ? failedTasks : (status === 'critical' ? 2 : 0),
        completedToday: totalTasks > 0 ? completedTasks : (status === 'healthy' ? 120 : 0),
        workers: configMetadata.configuration?.workers || 4,
        resourceDistribution,
        executionTimeline,
        dependencyGraph: configMetadata.dependencyGraph || ['Scheduler', name],
        dependencyHealth: configMetadata.dependencyHealth || [],
        recentErrors,
        topErrorCategories: failedTasks > 0 
          ? [{ category: 'Task Execution Failed', count: failedTasks }] 
          : (status === 'critical' ? [{ category: 'HPSS Host Unreachable', count: 12 }] : []),
        performanceMetrics: {
          successRate: successRateHistory,
          runtimeTrend: runtimeTrendHistory,
          throughput: throughputHistory,
          queueTrend: queueTrendHistory
        },
        versionHistory: [
          { version: `v${configMetadata.version || '1.0.0'}`, date: 'July 6', type: 'Current', active: true }
        ],
        connectedResources: Array.from(new Set(serviceTasks.map(t => t.resource))),
        connectedTasks,
        configuration: configMetadata.configuration || {
          workers: 4,
          concurrency: 2,
          memoryLimit: '8 GB',
          cpuLimit: '4 cores',
          timeout: '2 hours',
          retries: 3
        }
      };
    });
  }, [tasksList]);

  const selectedService = useMemo(() => {
    return servicesList.find(s => s.id === selectedServiceId) || servicesList[0];
  }, [servicesList, selectedServiceId]);

  const filteredServices = useMemo(() => {
    return servicesList.filter(s => {
      // 1. Search Query
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            s.category.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // 2. Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'running') {
          if (!s.isRunning) return false;
        } else if (statusFilter === 'stopped') {
          if (s.isRunning) return false;
        } else {
          if (s.status !== statusFilter) return false;
        }
      }

      // 3. Type Filter
      if (typeFilter !== 'all') {
        if (s.category !== typeFilter) return false;
      }

      return true;
    });
  }, [searchQuery, statusFilter, typeFilter]);

  const handleTaskClick = (taskId: string) => {
    // Find the task object from tasksList if it exists
    const taskObj = tasksList.find(t => t.id === taskId);
    if (taskObj) {
      onSelectTask(taskObj);
      onNavigate('tasks');
    } else {
      // Fallback: search by partial match or set views
      onNavigate('tasks');
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full gap-5 overflow-hidden font-sans text-text-main">
      {/* Left Panel - Services List */}
      <div className="flex flex-1 flex-col min-w-0 space-y-4">
        {/* Filters and Search Bar */}
        <div className="flex flex-col gap-3.5 shrink-0 bg-bg-dark/25 p-4.5 rounded-2xl border border-border-glass">
          {/* Status Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all' as const, label: 'All' },
                { id: 'healthy' as const, label: 'Healthy', dotColor: 'bg-status-success' },
                { id: 'warning' as const, label: 'Warning', dotColor: 'bg-status-warning' },
                { id: 'critical' as const, label: 'Critical', dotColor: 'bg-status-error' },
                { id: 'offline' as const, label: 'Offline', dotColor: 'bg-text-faint' },
                { id: 'running' as const, label: 'Running', icon: PlayCircle },
                { id: 'stopped' as const, label: 'Stopped', icon: StopCircle }
              ].map(f => {
                const IconComp = f.icon;
                const isActive = statusFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold select-none cursor-pointer transition-all duration-150 ${
                      isActive
                        ? 'bg-accent-cyan/15 text-accent-cyan ring-1 ring-accent-cyan/20'
                        : 'bg-white/[0.01] border border-border-glass text-text-muted hover:text-text-main hover:bg-white/[0.03]'
                    }`}
                  >
                    {f.dotColor && <span className={`h-1.5 w-1.5 rounded-full ${f.dotColor}`} />}
                    {IconComp && <IconComp className="h-3.5 w-3.5" />}
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search services..."
                className="w-full rounded-lg border border-border-glass bg-[#050811] py-1.5 pl-9 pr-4 text-xs text-text-main placeholder:text-text-faint focus:border-accent-cyan/40 focus:outline-none focus:ring-1 focus:ring-accent-cyan/20"
              />
            </div>
          </div>

          {/* Type Filters */}
          <div className="flex flex-wrap gap-1.5 border-t border-white/[0.03] pt-3.5">
            {[
              { id: 'all' as const, label: 'All Categories' },
              { id: 'Validator' as const, label: 'Validators' },
              { id: 'Application' as const, label: 'Applications' },
              { id: 'API' as const, label: 'APIs' },
              { id: 'Worker' as const, label: 'Workers' },
              { id: 'Storage' as const, label: 'Storage' },
              { id: 'Scheduler' as const, label: 'Schedulers' }
            ].map(t => {
              const isActive = typeFilter === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTypeFilter(t.id)}
                  className={`rounded-full px-3.5 py-1 text-[11px] font-semibold select-none cursor-pointer transition-all duration-150 ${
                    isActive
                      ? 'bg-accent-purple/15 text-accent-purple border border-accent-purple/20'
                      : 'bg-white/[0.01] border border-border-glass text-text-muted hover:text-text-main hover:bg-white/[0.03]'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Services List Panel */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredServices.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 p-10 text-center">
              <Sliders className="h-10 w-10 text-text-faint animate-pulse" />
              <p className="mt-4 text-xs font-medium text-text-muted">No orchestration services found matching the criteria</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredServices.map(s => {
                const isSelected = selectedServiceId === s.id;
                let statusColor = 'text-status-success';
                let statusBg = 'bg-status-success/15';
                let statusDot = 'bg-status-success';

                if (s.status === 'warning') {
                  statusColor = 'text-status-warning';
                  statusBg = 'bg-status-warning/15';
                  statusDot = 'bg-status-warning';
                } else if (s.status === 'critical') {
                  statusColor = 'text-status-error';
                  statusBg = 'bg-status-error/15';
                  statusDot = 'bg-status-error';
                } else if (s.status === 'offline') {
                  statusColor = 'text-text-faint';
                  statusBg = 'bg-white/[0.03]';
                  statusDot = 'bg-text-faint';
                }

                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedServiceId(s.id)}
                    className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4.5 transition-all duration-200 select-none cursor-pointer ${
                      isSelected
                        ? 'border-accent-cyan/40 bg-accent-cyan/5 shadow-[0_0_20px_rgba(0,229,255,0.05)]'
                        : 'border-border-glass bg-bg-dark/40 hover:border-white/20 hover:bg-white/[0.01]'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.06] text-text-muted group-hover:text-text-main transition-colors shrink-0">
                          {s.category === 'API' && <Activity className="h-4.5 w-4.5 text-accent-cyan" />}
                          {s.category === 'Validator' && <CheckCircle2 className="h-4.5 w-4.5 text-status-success" />}
                          {s.category === 'Application' && <Cpu className="h-4.5 w-4.5 text-accent-purple" />}
                          {s.category === 'Storage' && <Server className="h-4.5 w-4.5 text-status-warning" />}
                          {s.category === 'Scheduler' && <Clock className="h-4.5 w-4.5 text-accent-cyan" />}
                          {s.category === 'Worker' && <Layers className="h-4.5 w-4.5 text-text-muted" />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-text-main group-hover:text-white transition-colors truncate" title={s.name}>
                            {s.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] font-semibold text-text-faint uppercase font-mono">
                              {s.category}
                            </span>
                            <span className="text-[9px] text-white/20">•</span>
                            <span className="text-[9px] font-mono text-text-faint">
                              v{s.version}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold shrink-0 ${statusBg} ${statusColor}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDot} ${s.status === 'healthy' && s.isRunning ? 'animate-pulse' : ''}`} />
                        {s.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5 bg-white/[0.01] border border-white/[0.02] rounded-xl p-3 text-[10px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-text-faint uppercase tracking-wider text-[8px] font-semibold">Running Tasks</span>
                        <span className="font-mono font-bold text-text-main text-xs">{s.runningTasks}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-text-faint uppercase tracking-wider text-[8px] font-semibold">Avg Runtime</span>
                        <span className="font-mono font-bold text-text-main text-xs">{s.avgRuntime}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-text-faint uppercase tracking-wider text-[8px] font-semibold">Primary Host</span>
                        <span className="font-bold text-text-muted truncate">{s.resourceDistribution[0]?.name || '--'}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-text-faint uppercase tracking-wider text-[8px] font-semibold">Last Failure</span>
                        <span className="text-text-muted truncate font-medium">{s.status === 'healthy' ? '3 days ago' : 'Recently'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Detailed Inspector */}
      <div className="w-[450px] shrink-0 flex flex-col min-h-0 rounded-2xl border border-border-glass bg-bg-dark/45">
        {selectedService ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Header info */}
            <div className="border-b border-white/[0.04] pb-4.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Workflow className="h-4.5 w-4.5 text-accent-cyan" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Service Inspector
                  </h2>
                </div>
                <span className="text-[10px] text-text-faint font-mono">
                  ID: {selectedService.id}
                </span>
              </div>

              <div className="flex items-center justify-between mt-4">
                <h3 className="text-base font-bold text-white leading-tight truncate max-w-[280px]" title={selectedService.name}>
                  {selectedService.name}
                </h3>
                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-bold ${
                  selectedService.status === 'healthy'
                    ? 'bg-status-success/15 text-status-success'
                    : selectedService.status === 'warning'
                    ? 'bg-status-warning/15 text-status-warning'
                    : selectedService.status === 'critical'
                    ? 'bg-status-error/15 text-status-error'
                    : 'bg-white/[0.03] text-text-faint'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    selectedService.status === 'healthy'
                      ? 'bg-status-success'
                      : selectedService.status === 'warning'
                      ? 'bg-status-warning'
                      : selectedService.status === 'critical'
                      ? 'bg-status-error'
                      : 'bg-text-faint'
                  }`} />
                  {selectedService.status.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4 text-[10px] text-text-muted bg-white/[0.01] border border-white/[0.03] p-3.5 rounded-xl">
                <div>
                  <span className="text-text-faint uppercase font-bold block mb-0.5 text-[8px] tracking-wider">Version</span>
                  <span className="font-mono text-text-main font-semibold">{selectedService.version}</span>
                </div>
                <div>
                  <span className="text-text-faint uppercase font-bold block mb-0.5 text-[8px] tracking-wider">Owner</span>
                  <span className="text-text-main font-semibold truncate block">{selectedService.owner}</span>
                </div>
                <div>
                  <span className="text-text-faint uppercase font-bold block mb-0.5 text-[8px] tracking-wider">Type</span>
                  <span className="text-text-main font-semibold">{selectedService.category}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] text-text-muted bg-white/[0.01] border border-white/[0.03] p-3.5 rounded-xl">
                <div>
                  <span className="text-text-faint uppercase font-bold block mb-0.5 text-[8px] tracking-wider">Running Since</span>
                  <span className="text-text-main font-semibold">{selectedService.runningSince}</span>
                </div>
                <div>
                  <span className="text-text-faint uppercase font-bold block mb-0.5 text-[8px] tracking-wider">Last Restart</span>
                  <span className="text-text-main font-semibold">{selectedService.lastRestart}</span>
                </div>
              </div>
            </div>

            {/* Health Indicators */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Health Metrics
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4.5 text-center">
                  <span className="text-text-faint uppercase font-bold block text-[8px] tracking-wider">Health Score</span>
                  <span className={`text-xl font-bold font-mono ${
                    selectedService.healthScore >= 95
                      ? 'text-status-success'
                      : selectedService.healthScore >= 80
                      ? 'text-status-warning'
                      : 'text-status-error'
                  }`}>{selectedService.healthScore}%</span>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4.5 text-center">
                  <span className="text-text-faint uppercase font-bold block text-[8px] tracking-wider">Availability</span>
                  <span className="text-xl font-bold font-mono text-text-main">{selectedService.availability}%</span>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4.5 text-center">
                  <span className="text-text-faint uppercase font-bold block text-[8px] tracking-wider">Error Rate</span>
                  <span className="text-xl font-bold font-mono text-text-main">{selectedService.errorRate}%</span>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4.5 text-center">
                  <span className="text-text-faint uppercase font-bold block text-[8px] tracking-wider">Avg Runtime</span>
                  <span className="text-xl font-bold font-mono text-text-main">{selectedService.avgRuntime}</span>
                </div>
              </div>
            </div>

            {/* Current Activity */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Current Activity
              </h4>
              <div className="grid grid-cols-4 gap-2 bg-white/[0.01] border border-white/[0.04] rounded-xl p-3.5 text-center">
                <div>
                  <span className="text-text-faint uppercase font-bold block text-[7.5px] tracking-wider">Running</span>
                  <span className="text-sm font-mono font-bold text-accent-cyan">{selectedService.runningTasks}</span>
                </div>
                <div>
                  <span className="text-text-faint uppercase font-bold block text-[7.5px] tracking-wider">Queued</span>
                  <span className="text-sm font-mono font-bold text-status-warning">{selectedService.queuedTasks}</span>
                </div>
                <div>
                  <span className="text-text-faint uppercase font-bold block text-[7.5px] tracking-wider">Failed</span>
                  <span className="text-sm font-mono font-bold text-status-error">{selectedService.failedTasks}</span>
                </div>
                <div>
                  <span className="text-text-faint uppercase font-bold block text-[7.5px] tracking-wider">Completed</span>
                  <span className="text-sm font-mono font-bold text-status-success">{selectedService.completedToday}</span>
                </div>
              </div>
            </div>

            {/* Dependency Graph Flow */}
            {selectedService.dependencyGraph && selectedService.dependencyGraph.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Service Dependency Flow
                </h4>
                <div className="flex flex-wrap items-center gap-2 p-3.5 bg-white/[0.01] border border-white/[0.04] rounded-xl overflow-x-auto">
                  {selectedService.dependencyGraph.map((node, i) => {
                    const isSelected = node === selectedService.name || node.includes(selectedService.name);
                    return (
                      <div key={i} className="flex items-center gap-1.5 shrink-0">
                        <div className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold font-mono border ${
                          isSelected
                            ? 'bg-accent-cyan/15 border-accent-cyan text-accent-cyan shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                            : 'bg-white/[0.02] border-white/10 text-text-muted'
                        }`}>
                          {node}
                        </div>
                        {i < selectedService.dependencyGraph.length - 1 && (
                          <ChevronRight className="h-3.5 w-3.5 text-text-faint shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dependency Health Status */}
            {selectedService.dependencyHealth && selectedService.dependencyHealth.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Dependency Health
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedService.dependencyHealth.map((dh, i) => {
                    let dotColor = 'bg-status-success';
                    if (dh.status === 'warning') dotColor = 'bg-status-warning animate-pulse';
                    else if (dh.status === 'critical') dotColor = 'bg-status-error animate-pulse';
                    else if (dh.status === 'offline') dotColor = 'bg-text-faint';

                    return (
                      <div key={i} className="flex items-center justify-between px-3 py-2 bg-white/[0.01] border border-white/[0.04] rounded-lg">
                        <span className="text-[10px] text-text-muted truncate max-w-[90px] font-mono" title={dh.name}>
                          {dh.name}
                        </span>
                        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Resource Distribution */}
            {selectedService.resourceDistribution && selectedService.resourceDistribution.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Cluster Distribution
                </h4>
                <div className="space-y-2.5 bg-white/[0.01] border border-white/[0.04] rounded-xl p-3.5">
                  {selectedService.resourceDistribution.map((rd, i) => {
                    const maxVal = Math.max(...selectedService.resourceDistribution.map(x => x.workers), 1);
                    const percentage = (rd.workers / maxVal) * 100;
                    return (
                      <div key={i} className="flex items-center justify-between text-xs gap-3">
                        <span className="text-text-muted font-medium w-24 truncate shrink-0">{rd.name}</span>
                        <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent-purple transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-text-main w-16 text-right shrink-0">{rd.workers} worker{rd.workers !== 1 && 's'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Execution Timeline stepper */}
            {selectedService.executionTimeline && selectedService.executionTimeline.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Active Execution Flow
                </h4>
                <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-4.5">
                  <div className="space-y-4.5 relative pl-4 border-l border-white/10 ml-2">
                    {selectedService.executionTimeline.map((step, idx) => (
                      <div key={idx} className="relative group/step">
                        {/* Dot indicator */}
                        <span className={`absolute -left-[23px] top-1.5 h-3 w-3 rounded-full border bg-bg-dark flex items-center justify-center ${
                          step.status === 'completed'
                            ? 'border-status-success shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                            : step.status === 'active'
                            ? 'border-accent-cyan shadow-[0_0_8px_rgba(0,229,255,0.4)] animate-pulse'
                            : 'border-white/20'
                        }`}>
                          {step.status === 'completed' && <span className="h-1 w-1 rounded-full bg-status-success" />}
                          {step.status === 'active' && <span className="h-1 w-1 rounded-full bg-accent-cyan animate-ping" />}
                        </span>
                        <div>
                          <div className="flex items-center justify-between text-xs">
                            <span className={`font-semibold ${
                              step.status === 'completed'
                                ? 'text-text-main'
                                : step.status === 'active'
                                ? 'text-accent-cyan font-bold'
                                : 'text-text-faint'
                            }`}>
                              {step.label}
                            </span>
                            {step.time && (
                              <span className="text-[9px] font-mono text-text-faint">{step.time}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Performance Metrics Charts */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Performance Metrics (Past 30 Days)
              </h4>
              <div className="grid grid-cols-2 gap-3.5">
                {/* Success Rate */}
                <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-3.5 flex flex-col justify-between h-24">
                  <div className="flex items-start justify-between">
                    <span className="text-text-faint font-bold text-[8.5px] uppercase tracking-wider">Success Rate</span>
                    <span className="text-xs font-mono font-bold text-status-success">
                      {selectedService.performanceMetrics.successRate[selectedService.performanceMetrics.successRate.length - 1] || 100}%
                    </span>
                  </div>
                  <div className="flex items-end justify-center mt-2.5">
                    <Sparkline data={selectedService.performanceMetrics.successRate} color="#10B981" />
                  </div>
                </div>

                {/* Runtime Trend */}
                <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-3.5 flex flex-col justify-between h-24">
                  <div className="flex items-start justify-between">
                    <span className="text-text-faint font-bold text-[8.5px] uppercase tracking-wider">Runtime Trend</span>
                    <span className="text-xs font-mono font-bold text-accent-cyan">{selectedService.avgRuntime}</span>
                  </div>
                  <div className="flex items-end justify-center mt-2.5">
                    <Sparkline data={selectedService.performanceMetrics.runtimeTrend} color="#00E5FF" />
                  </div>
                </div>

                {/* Throughput */}
                <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-3.5 flex flex-col justify-between h-24">
                  <div className="flex items-start justify-between">
                    <span className="text-text-faint font-bold text-[8.5px] uppercase tracking-wider">Throughput</span>
                    <span className="text-xs font-mono font-bold text-accent-purple">
                      {selectedService.performanceMetrics.throughput[selectedService.performanceMetrics.throughput.length - 1] || 0}/day
                    </span>
                  </div>
                  <div className="flex items-end justify-center mt-2.5">
                    <Sparkline data={selectedService.performanceMetrics.throughput} color="#8B5CF6" />
                  </div>
                </div>

                {/* Queue Trend */}
                <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-3.5 flex flex-col justify-between h-24">
                  <div className="flex items-start justify-between">
                    <span className="text-text-faint font-bold text-[8.5px] uppercase tracking-wider">Queue Trend</span>
                    <span className="text-xs font-mono font-bold text-status-warning">
                      {selectedService.performanceMetrics.queueTrend[selectedService.performanceMetrics.queueTrend.length - 1] || 0} len
                    </span>
                  </div>
                  <div className="flex items-end justify-center mt-2.5">
                    <Sparkline data={selectedService.performanceMetrics.queueTrend} color="#F59E0B" />
                  </div>
                </div>
              </div>
            </div>

            {/* Top Error Categories */}
            {selectedService.topErrorCategories && selectedService.topErrorCategories.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Top Error Categories
                </h4>
                <div className="space-y-2 bg-white/[0.01] border border-white/[0.04] rounded-xl p-3.5">
                  {selectedService.topErrorCategories.map((ec, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-text-muted font-medium truncate max-w-[280px]">{ec.category}</span>
                      <span className="rounded-full bg-status-error/15 text-status-error text-[10px] font-mono font-bold px-2 py-0.5 shrink-0">
                        {ec.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Errors Table */}
            {selectedService.recentErrors && selectedService.recentErrors.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Recent Error Logs
                </h4>
                <div className="overflow-hidden rounded-xl border border-white/[0.04] bg-white/[0.01] text-[10px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-white/[0.02] text-text-faint font-bold">
                        <th className="px-3 py-2 w-12 font-semibold">Time</th>
                        <th className="px-3 py-2 w-16 font-semibold">Severity</th>
                        <th className="px-3 py-2 w-16 font-semibold">Task ID</th>
                        <th className="px-3 py-2 font-semibold">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] font-mono text-text-muted">
                      {selectedService.recentErrors.map((err, i) => (
                        <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                          <td className="px-3 py-2 text-text-faint">{err.time}</td>
                          <td className="px-3 py-2 font-bold">
                            <span className={err.severity === 'ERROR' ? 'text-status-error' : 'text-status-warning'}>
                              {err.severity}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => handleTaskClick(err.task)}
                              className="text-accent-cyan hover:underline cursor-pointer flex items-center gap-0.5 font-bold"
                            >
                              {err.task.slice(-8)}
                              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                            </button>
                          </td>
                          <td className="px-3 py-2 text-text-main truncate max-w-[150px]" title={err.message}>
                            {err.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Version History */}
            {selectedService.versionHistory && selectedService.versionHistory.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Version & Deployment History
                </h4>
                <div className="space-y-2 bg-white/[0.01] border border-white/[0.04] rounded-xl p-3.5">
                  {selectedService.versionHistory.map((vh, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <History className="h-3.5 w-3.5 text-text-faint" />
                        <span className="font-mono font-bold text-text-main">{vh.version}</span>
                        <span className="text-text-faint font-semibold text-[10px]">{vh.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          vh.type === 'Current'
                            ? 'bg-accent-cyan/15 text-accent-cyan'
                            : vh.type === 'Hotfix'
                            ? 'bg-status-warning/15 text-status-warning'
                            : 'bg-white/5 text-text-muted'
                        }`}>{vh.type}</span>
                        {vh.active && (
                          <Check className="h-3.5 w-3.5 text-status-success shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connected Resources */}
            {selectedService.connectedResources && selectedService.connectedResources.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Connected Compute Resources
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedService.connectedResources.map((resName, i) => (
                    <button
                      key={i}
                      onClick={() => onNavigate('resources')}
                      className="flex items-center gap-1.5 rounded-lg border border-border-glass bg-white/[0.01] px-3 py-1.5 text-xs text-text-muted hover:text-text-main hover:bg-white/[0.03] active:scale-[0.98] cursor-pointer transition-all font-semibold"
                    >
                      <Server className="h-3.5 w-3.5 text-accent-purple" />
                      <span>{resName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Connected Tasks */}
            {selectedService.connectedTasks && selectedService.connectedTasks.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Connected Recent Tasks
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedService.connectedTasks.map((ct, i) => {
                    let statusColor = 'text-accent-cyan border-accent-cyan/20 bg-accent-cyan/5';
                    if (ct.status === 'completed') statusColor = 'text-status-success border-status-success/20 bg-status-success/5';
                    else if (ct.status === 'failed') statusColor = 'text-status-error border-status-error/20 bg-status-error/5';

                    return (
                      <button
                        key={i}
                        onClick={() => handleTaskClick(ct.id)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer active:scale-[0.98] transition-all font-mono ${statusColor}`}
                      >
                        <Workflow className="h-3.5 w-3.5" />
                        <span>{ct.id.slice(-8)}</span>
                        <span className="text-[9px] uppercase font-bold font-sans">({ct.status})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Service Configuration */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Service Configuration
              </h4>
              <div className="overflow-hidden rounded-xl border border-white/[0.04] bg-white/[0.01] text-[10px] font-mono text-text-muted">
                <table className="w-full border-collapse">
                  <tbody className="divide-y divide-white/[0.04]">
                    <tr>
                      <td className="px-4 py-2 font-semibold text-text-faint">Workers Count</td>
                      <td className="px-4 py-2 text-right text-text-main font-bold">{selectedService.configuration.workers}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-text-faint">Concurrency Limit</td>
                      <td className="px-4 py-2 text-right text-text-main font-bold">{selectedService.configuration.concurrency}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-text-faint">Memory Limit</td>
                      <td className="px-4 py-2 text-right text-text-main font-bold">{selectedService.configuration.memoryLimit}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-text-faint">CPU Limit</td>
                      <td className="px-4 py-2 text-right text-text-main font-bold">{selectedService.configuration.cpuLimit}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-text-faint">Max Timeout</td>
                      <td className="px-4 py-2 text-right text-text-main font-bold">{selectedService.configuration.timeout}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-text-faint">Max Retries</td>
                      <td className="px-4 py-2 text-right text-text-main font-bold">{selectedService.configuration.retries}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-text-muted">
            <Info className="h-8 w-8 text-text-faint animate-bounce mb-3" />
            <p className="text-xs font-semibold">Select a service to inspect detail configuration and status metrics</p>
          </div>
        )}
      </div>
    </div>
  );
}
