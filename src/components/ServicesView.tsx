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

const mockServices: ServiceData[] = [
  {
    id: 'srv-1',
    name: 'validator-neuro-freesurfer',
    category: 'Validator',
    status: 'healthy',
    isRunning: true,
    version: '2.4.2',
    owner: 'Brainlife',
    runningSince: 'July 4',
    lastRestart: '2 days ago',
    healthScore: 98,
    availability: 99.9,
    errorRate: 0.8,
    avgRuntime: '32 min',
    avgWait: '2 min',
    runningTasks: 12,
    queuedTasks: 2,
    failedTasks: 0,
    completedToday: 183,
    workers: 12,
    resourceDistribution: [
      { name: 'Karst', workers: 6 },
      { name: 'BigRed3', workers: 2 },
      { name: 'Carbonate', workers: 0 },
      { name: 'AWS Batch', workers: 4 }
    ],
    executionTimeline: [
      { label: 'Started', time: '19:22', status: 'completed' },
      { label: 'Dataset Downloaded', time: '19:24', status: 'completed' },
      { label: 'Validation', time: '19:26', status: 'completed' },
      { label: 'Running FreeSurfer', time: '19:35', status: 'active' },
      { label: 'Uploading Results', status: 'pending' },
      { label: 'Completed', status: 'pending' }
    ],
    dependencyGraph: ['API', 'Scheduler', 'validator-neuro-freesurfer', 'FreeSurfer App', 'Archive Service', 'Upload'],
    dependencyHealth: [
      { name: 'Scheduler', status: 'healthy' },
      { name: 'MongoDB', status: 'healthy' },
      { name: 'Redis', status: 'healthy' },
      { name: 'Storage', status: 'warning' },
      { name: 'SSH', status: 'critical' }
    ],
    recentErrors: [
      { time: '19:34', severity: 'ERROR', task: '54da767c', message: 'SSH timeout trying to connect to Karst' },
      { time: '19:10', severity: 'WARNING', task: '54da3c20', message: 'Staging retry triggered - attempt 2/5' },
      { time: '18:43', severity: 'ERROR', task: '54d9d711', message: 'Required dataset anatomical_t1 missing' }
    ],
    topErrorCategories: [
      { category: 'Dataset Download Failed', count: 43 },
      { category: 'SSH Timeout', count: 21 },
      { category: 'Permission Denied', count: 12 },
      { category: 'Resource Busy', count: 7 }
    ],
    performanceMetrics: {
      successRate: [100, 99, 98, 98, 99, 100, 98, 97, 98, 98, 99, 98],
      runtimeTrend: [30, 31, 35, 34, 32, 33, 31, 32, 34, 33, 32, 32],
      throughput: [150, 180, 200, 220, 250, 240, 260, 280, 290, 300],
      queueTrend: [5, 8, 12, 15, 10, 8, 5, 4, 3, 2]
    },
    versionHistory: [
      { version: 'v2.4.2', date: 'July 6', type: 'Current', active: true },
      { version: 'v2.4.1', date: 'June 29', type: 'Hotfix', active: false },
      { version: 'v2.4.0', date: 'June 21', type: 'Deployment', active: false }
    ],
    connectedResources: ['Carbonate', 'BigRed3', 'AWS Batch'],
    connectedTasks: [
      { id: '54da767c', status: 'running' },
      { id: '54da3c20', status: 'completed' },
      { id: '54d9d711', status: 'failed' }
    ],
    configuration: {
      workers: 12,
      concurrency: 4,
      memoryLimit: '16 GB',
      cpuLimit: '8 cores',
      timeout: '2 hours',
      retries: 3
    }
  },
  {
    id: 'srv-2',
    name: 'brainlife/app-freesurfer',
    category: 'Application',
    status: 'healthy',
    isRunning: true,
    version: '2.1.3',
    owner: 'Brainlife',
    runningSince: 'June 20',
    lastRestart: '5 days ago',
    healthScore: 97,
    availability: 99.5,
    errorRate: 1.1,
    avgRuntime: '34 min',
    avgWait: '4 min',
    runningTasks: 8,
    queuedTasks: 1,
    failedTasks: 0,
    completedToday: 142,
    workers: 8,
    resourceDistribution: [
      { name: 'Karst', workers: 4 },
      { name: 'BigRed3', workers: 4 }
    ],
    executionTimeline: [
      { label: 'Job Received', time: '17:00', status: 'completed' },
      { label: 'Container Pull', time: '17:02', status: 'completed' },
      { label: 'Execution', time: '17:05', status: 'active' },
      { label: 'Cleanup & Upload', status: 'pending' }
    ],
    dependencyGraph: ['Scheduler', 'brainlife/app-freesurfer', 'Archive Service'],
    dependencyHealth: [
      { name: 'Scheduler', status: 'healthy' },
      { name: 'MongoDB', status: 'healthy' },
      { name: 'Storage', status: 'healthy' }
    ],
    recentErrors: [
      { time: '16:40', severity: 'ERROR', task: '54da5fe6', message: 'Memory limit exceeded (OOM)' }
    ],
    topErrorCategories: [
      { category: 'Out of Memory', count: 18 },
      { category: 'Storage Read Error', count: 4 }
    ],
    performanceMetrics: {
      successRate: [95, 96, 97, 98, 97, 98, 96, 97, 98, 98, 97, 97],
      runtimeTrend: [38, 37, 36, 35, 34, 33, 34, 35, 33, 34, 34, 34],
      throughput: [110, 120, 115, 130, 125, 142, 138, 145, 140, 142],
      queueTrend: [4, 5, 3, 2, 4, 3, 2, 1, 1, 1]
    },
    versionHistory: [
      { version: 'v2.1.3', date: 'June 20', type: 'Current', active: true },
      { version: 'v2.1.2', date: 'June 10', type: 'Deployment', active: false }
    ],
    connectedResources: ['Carbonate', 'BigRed3'],
    connectedTasks: [
      { id: '54da5fe6', status: 'running' }
    ],
    configuration: {
      workers: 8,
      concurrency: 2,
      memoryLimit: '32 GB',
      cpuLimit: '16 cores',
      timeout: '4 hours',
      retries: 2
    }
  },
  {
    id: 'srv-3',
    name: 'brainlife/app-stage',
    category: 'Application',
    status: 'warning',
    isRunning: true,
    version: '1.4.0',
    owner: 'Brainlife',
    runningSince: 'July 1',
    lastRestart: '10 days ago',
    healthScore: 84,
    availability: 98.2,
    errorRate: 3.4,
    avgRuntime: '12 min',
    avgWait: '6 min',
    runningTasks: 18,
    queuedTasks: 12,
    failedTasks: 2,
    completedToday: 320,
    workers: 4,
    resourceDistribution: [
      { name: 'Carbonate', workers: 2 },
      { name: 'AWS Batch', workers: 2 }
    ],
    executionTimeline: [
      { label: 'Queued', time: '19:00', status: 'completed' },
      { label: 'Resources Allocated', time: '19:06', status: 'completed' },
      { label: 'Download Initiated', time: '19:07', status: 'completed' },
      { label: 'Verification', time: '19:15', status: 'active' },
      { label: 'Completed', status: 'pending' }
    ],
    dependencyGraph: ['API', 'brainlife/app-stage', 'Storage'],
    dependencyHealth: [
      { name: 'Storage', status: 'warning' },
      { name: 'Network Gateway', status: 'healthy' }
    ],
    recentErrors: [
      { time: '19:22', severity: 'WARNING', task: '54da3c20', message: 'High latency on storage mount' },
      { time: '19:01', severity: 'ERROR', task: '54d9f18a', message: 'Connection timeout to staging bucket' }
    ],
    topErrorCategories: [
      { category: 'Staging Bucket Timeout', count: 28 },
      { category: 'Storage Read Failure', count: 15 }
    ],
    performanceMetrics: {
      successRate: [98, 97, 95, 92, 90, 88, 85, 84, 84, 84, 84, 84],
      runtimeTrend: [8, 9, 10, 12, 11, 13, 14, 15, 12, 12, 12, 12],
      throughput: [280, 290, 310, 320, 300, 310, 330, 320, 320, 320],
      queueTrend: [4, 6, 8, 12, 18, 17, 19, 22, 18, 18, 18, 18]
    },
    versionHistory: [
      { version: 'v1.4.0', date: 'June 28', type: 'Deployment', active: true }
    ],
    connectedResources: ['Carbonate', 'AWS Batch'],
    connectedTasks: [
      { id: '54da3c20', status: 'running' }
    ],
    configuration: {
      workers: 4,
      concurrency: 8,
      memoryLimit: '8 GB',
      cpuLimit: '4 cores',
      timeout: '30 min',
      retries: 5
    }
  },
  {
    id: 'srv-4',
    name: 'api-server',
    category: 'API',
    status: 'healthy',
    isRunning: true,
    version: '3.8.1',
    owner: 'Brainlife Team',
    runningSince: 'June 1',
    lastRestart: '39 days ago',
    healthScore: 99.8,
    availability: 99.99,
    errorRate: 0.05,
    avgRuntime: '150 ms',
    avgWait: '0 ms',
    runningTasks: 3,
    queuedTasks: 0,
    failedTasks: 0,
    completedToday: 8520,
    workers: 3,
    resourceDistribution: [{ name: 'AWS Local Cluster', workers: 3 }],
    executionTimeline: [
      { label: 'HTTP Request Received', time: '22:30', status: 'completed' },
      { label: 'JWT Auth Verified', time: '22:30', status: 'completed' },
      { label: 'Query Executed', time: '22:30', status: 'completed' },
      { label: 'HTTP Response 200 OK', time: '22:30', status: 'completed' }
    ],
    dependencyGraph: ['Load Balancer', 'api-server', 'mongodb', 'redis'],
    dependencyHealth: [
      { name: 'mongodb', status: 'healthy' },
      { name: 'redis', status: 'healthy' }
    ],
    recentErrors: [],
    topErrorCategories: [],
    performanceMetrics: {
      successRate: [100, 100, 100, 99.9, 100, 100, 100, 100, 100, 100, 100, 100],
      runtimeTrend: [140, 150, 160, 150, 145, 148, 152, 150, 149, 150, 150, 150],
      throughput: [500, 600, 700, 800, 750, 780, 820, 850, 830, 852],
      queueTrend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    versionHistory: [{ version: 'v3.8.1', date: 'May 28', type: 'Deployment', active: true }],
    connectedResources: ['AWS Batch'],
    connectedTasks: [],
    configuration: {
      workers: 3,
      concurrency: 1000,
      memoryLimit: '4 GB',
      cpuLimit: '2 cores',
      timeout: '30s',
      retries: 0
    }
  },
  {
    id: 'srv-5',
    name: 'archive-service',
    category: 'Storage',
    status: 'critical',
    isRunning: true,
    version: '2.0.1',
    owner: 'Brainlife Devs',
    runningSince: 'July 8',
    lastRestart: '2 hours ago',
    healthScore: 42,
    availability: 88.4,
    errorRate: 35.2,
    avgRuntime: '4.5 min',
    avgWait: '12 min',
    runningTasks: 2,
    queuedTasks: 45,
    failedTasks: 18,
    completedToday: 42,
    workers: 1,
    resourceDistribution: [{ name: 'Carbonate Storage Node', workers: 1 }],
    executionTimeline: [
      { label: 'Archive Request', time: '22:12', status: 'completed' },
      { label: 'Connecting to HPSS', time: '22:12', status: 'active' },
      { label: 'SSH connection timed out', status: 'pending' }
    ],
    dependencyGraph: ['api-server', 'archive-service', 'HPSS Storage'],
    dependencyHealth: [
      { name: 'HPSS Storage', status: 'critical' },
      { name: 'Network Connection', status: 'warning' }
    ],
    recentErrors: [
      { time: '22:15', severity: 'ERROR', task: '54d9d711', message: 'Connection timed out to HPSS server' },
      { time: '22:01', severity: 'ERROR', task: '54da767c', message: 'SSH transport verification failed' }
    ],
    topErrorCategories: [
      { category: 'HPSS Host Unreachable', count: 62 },
      { category: 'SSH Connection Refused', count: 44 }
    ],
    performanceMetrics: {
      successRate: [99, 98, 95, 90, 80, 70, 60, 50, 45, 42, 42, 42],
      runtimeTrend: [120, 180, 240, 270, 270, 270, 270, 270, 270, 270, 270, 270],
      throughput: [120, 110, 95, 80, 60, 45, 40, 42, 41, 42, 42, 42],
      queueTrend: [2, 5, 12, 22, 35, 41, 45, 45, 45, 45]
    },
    versionHistory: [
      { version: 'v2.0.1', date: 'July 6', type: 'Hotfix', active: true },
      { version: 'v2.0.0', date: 'July 2', type: 'Deployment', active: false }
    ],
    connectedResources: ['Carbonate'],
    connectedTasks: [{ id: '54d9d711', status: 'failed' }],
    configuration: {
      workers: 1,
      concurrency: 2,
      memoryLimit: '16 GB',
      cpuLimit: '4 cores',
      timeout: '1 hour',
      retries: 3
    }
  },
  {
    id: 'srv-6',
    name: 'scheduler',
    category: 'Scheduler',
    status: 'healthy',
    isRunning: true,
    version: '1.2.0',
    owner: 'Brainlife Team',
    runningSince: 'June 1',
    lastRestart: '39 days ago',
    healthScore: 99.9,
    availability: 100,
    errorRate: 0.0,
    avgRuntime: '5 ms',
    avgWait: '0 ms',
    runningTasks: 1,
    queuedTasks: 0,
    failedTasks: 0,
    completedToday: 125000,
    workers: 1,
    resourceDistribution: [{ name: 'AWS Cluster', workers: 1 }],
    executionTimeline: [{ label: 'Idle / Polling Queue', status: 'completed' }],
    dependencyGraph: ['api-server', 'scheduler', 'mongodb'],
    dependencyHealth: [
      { name: 'mongodb', status: 'healthy' }
    ],
    recentErrors: [],
    topErrorCategories: [],
    performanceMetrics: {
      successRate: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
      runtimeTrend: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      throughput: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
      queueTrend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    versionHistory: [{ version: 'v1.2.0', date: 'June 1', type: 'Deployment', active: true }],
    connectedResources: ['AWS Batch'],
    connectedTasks: [],
    configuration: {
      workers: 1,
      concurrency: 1,
      memoryLimit: '2 GB',
      cpuLimit: '1 core',
      timeout: 'Infinite',
      retries: 10
    }
  },
  {
    id: 'srv-7',
    name: 'mongodb',
    category: 'Storage',
    status: 'healthy',
    isRunning: true,
    version: '6.0.5',
    owner: 'Infrastructure',
    runningSince: 'June 1',
    lastRestart: '39 days ago',
    healthScore: 99.9,
    availability: 99.99,
    errorRate: 0.01,
    avgRuntime: '2 ms',
    avgWait: '0 ms',
    runningTasks: 0,
    queuedTasks: 0,
    failedTasks: 0,
    completedToday: 4520100,
    workers: 3,
    resourceDistribution: [{ name: 'MongoDB ReplicaSet', workers: 3 }],
    executionTimeline: [{ label: 'Active', status: 'completed' }],
    dependencyGraph: ['mongodb'],
    dependencyHealth: [],
    recentErrors: [],
    topErrorCategories: [],
    performanceMetrics: {
      successRate: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
      runtimeTrend: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      throughput: [45000, 48000, 50000, 47000, 49000, 52000, 51000, 50000, 52010, 52010],
      queueTrend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    versionHistory: [{ version: 'v6.0.5', date: 'June 1', type: 'Deployment', active: true }],
    connectedResources: [],
    connectedTasks: [],
    configuration: {
      workers: 3,
      concurrency: 5000,
      memoryLimit: '64 GB',
      cpuLimit: '16 cores',
      timeout: '5s',
      retries: 3
    }
  },
  {
    id: 'srv-8',
    name: 'redis',
    category: 'Storage',
    status: 'healthy',
    isRunning: true,
    version: '7.0.10',
    owner: 'Infrastructure',
    runningSince: 'June 1',
    lastRestart: '39 days ago',
    healthScore: 100,
    availability: 100,
    errorRate: 0.0,
    avgRuntime: '0.5 ms',
    avgWait: '0 ms',
    runningTasks: 0,
    queuedTasks: 0,
    failedTasks: 0,
    completedToday: 9812000,
    workers: 1,
    resourceDistribution: [{ name: 'Redis Cache Cluster', workers: 1 }],
    executionTimeline: [{ label: 'Active', status: 'completed' }],
    dependencyGraph: ['redis'],
    dependencyHealth: [],
    recentErrors: [],
    topErrorCategories: [],
    performanceMetrics: {
      successRate: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
      runtimeTrend: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      throughput: [95000, 98000, 100000, 97000, 99000, 102000, 101000, 100000, 102000, 102000],
      queueTrend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    versionHistory: [{ version: 'v7.0.10', date: 'June 1', type: 'Deployment', active: true }],
    connectedResources: [],
    connectedTasks: [],
    configuration: {
      workers: 1,
      concurrency: 10000,
      memoryLimit: '16 GB',
      cpuLimit: '4 cores',
      timeout: '1s',
      retries: 0
    }
  },
  {
    id: 'srv-9',
    name: 'event-worker',
    category: 'Worker',
    status: 'healthy',
    isRunning: true,
    version: '1.8.2',
    owner: 'Brainlife Team',
    runningSince: 'July 5',
    lastRestart: '5 days ago',
    healthScore: 99.4,
    availability: 99.9,
    errorRate: 0.2,
    avgRuntime: '80 ms',
    avgWait: '1 ms',
    runningTasks: 1,
    queuedTasks: 0,
    failedTasks: 0,
    completedToday: 51200,
    workers: 2,
    resourceDistribution: [{ name: 'AWS Event Cluster', workers: 2 }],
    executionTimeline: [{ label: 'Processing Event Stream', status: 'completed' }],
    dependencyGraph: ['redis', 'event-worker', 'mongodb'],
    dependencyHealth: [
      { name: 'redis', status: 'healthy' },
      { name: 'mongodb', status: 'healthy' }
    ],
    recentErrors: [],
    topErrorCategories: [],
    performanceMetrics: {
      successRate: [100, 100, 99.8, 99.9, 100, 100, 100, 100, 100, 100, 100, 100],
      runtimeTrend: [80, 82, 85, 80, 78, 80, 81, 79, 80, 80, 80, 80],
      throughput: [450, 480, 500, 470, 490, 520, 510, 500, 520, 520],
      queueTrend: [0, 1, 0, 0, 0, 1, 0, 0, 0, 0]
    },
    versionHistory: [{ version: 'v1.8.2', date: 'July 5', type: 'Deployment', active: true }],
    connectedResources: ['AWS Batch'],
    connectedTasks: [],
    configuration: {
      workers: 2,
      concurrency: 20,
      memoryLimit: '4 GB',
      cpuLimit: '2 cores',
      timeout: '5 min',
      retries: 3
    }
  },
  {
    id: 'srv-10',
    name: 'brainlife/app-streamline-cleaning',
    category: 'Application',
    status: 'healthy',
    isRunning: true,
    version: '1.2.0',
    owner: 'Brainlife',
    runningSince: 'July 2',
    lastRestart: '8 days ago',
    healthScore: 98.5,
    availability: 99.8,
    errorRate: 0.2,
    avgRuntime: '10 min',
    avgWait: '1 min',
    runningTasks: 2,
    queuedTasks: 0,
    failedTasks: 0,
    completedToday: 95,
    workers: 4,
    resourceDistribution: [
      { name: 'Karst', workers: 2 },
      { name: 'Carbonate', workers: 2 }
    ],
    executionTimeline: [
      { label: 'Job Received', time: '22:00', status: 'completed' },
      { label: 'Cleaning Streamlines', time: '22:01', status: 'active' },
      { label: 'Stage Out', status: 'pending' }
    ],
    dependencyGraph: ['Scheduler', 'brainlife/app-streamline-cleaning', 'Archive Service'],
    dependencyHealth: [
      { name: 'Scheduler', status: 'healthy' },
      { name: 'MongoDB', status: 'healthy' }
    ],
    recentErrors: [],
    topErrorCategories: [],
    performanceMetrics: {
      successRate: [100, 100, 100, 99.5, 100, 100, 100, 100, 100, 100, 100, 100],
      runtimeTrend: [10, 10, 11, 10, 9, 10, 10, 10, 10, 10, 10, 10],
      throughput: [80, 85, 90, 82, 88, 92, 95, 95, 95, 95],
      queueTrend: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0]
    },
    versionHistory: [{ version: 'v1.2.0', date: 'July 2', type: 'Deployment', active: true }],
    connectedResources: ['Carbonate', 'Karst'],
    connectedTasks: [{ id: '54da767c', status: 'running' }],
    configuration: {
      workers: 4,
      concurrency: 4,
      memoryLimit: '16 GB',
      cpuLimit: '8 cores',
      timeout: '1 hour',
      retries: 3
    }
  },
  {
    id: 'srv-11',
    name: 'brainlife/app-sift2-connectome-generation',
    category: 'Application',
    status: 'offline',
    isRunning: false,
    version: '1.0.5',
    owner: 'Brainlife',
    runningSince: 'Disabled',
    lastRestart: '10 days ago',
    healthScore: 0,
    availability: 0,
    errorRate: 100,
    avgRuntime: '12 min',
    avgWait: '--',
    runningTasks: 0,
    queuedTasks: 0,
    failedTasks: 0,
    completedToday: 0,
    workers: 0,
    resourceDistribution: [],
    executionTimeline: [{ label: 'Inactive / Disabled', status: 'pending' }],
    dependencyGraph: ['Scheduler', 'brainlife/app-sift2-connectome-generation'],
    dependencyHealth: [],
    recentErrors: [],
    topErrorCategories: [],
    performanceMetrics: {
      successRate: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      runtimeTrend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      throughput: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      queueTrend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    versionHistory: [{ version: 'v1.0.5', date: 'June 5', type: 'Deployment', active: true }],
    connectedResources: [],
    connectedTasks: [],
    configuration: {
      workers: 0,
      concurrency: 0,
      memoryLimit: '32 GB',
      cpuLimit: '16 cores',
      timeout: '2 hours',
      retries: 2
    }
  }
];

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

  const selectedService = useMemo(() => {
    return mockServices.find(s => s.id === selectedServiceId) || mockServices[0];
  }, [selectedServiceId]);

  const filteredServices = useMemo(() => {
    return mockServices.filter(s => {
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
