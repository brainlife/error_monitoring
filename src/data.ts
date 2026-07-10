export type TaskStatus = 'running' | 'finished' | 'failed' | 'queued' | 'cancelled' | 'unknown';

export type Runtime = string;

export interface Task {
  id: string;
  service: string;
  projectId: string;
  resource: string;
  status: TaskStatus;
  runtime: Runtime;
  startedAt: string;
  duration: string;
  message: string;
  startDate?: string;
  finishDate?: string;
  userId?: string;
}

export type ResourceStatus = 'online' | 'error' | 'degraded';

export interface ComputeResource {
  id: string;
  name: string;
  type: string;
  status: ResourceStatus;
  detail: string;
  cpu?: number;
  memory?: number;
  queueJobs?: number;
  activeJobs?: number;
  maxJobs?: number;
  vcpusCurrent?: number;
  vcpusMax?: number;
  tags?: string[];
}

export interface LogLine {
  ts: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'DEBUG' | 'WARNING';
  service: string;
  message: string;
  aws?: boolean;
}

export interface ServiceStat {
  service: string;
  total: number;
  running: number;
  finished: number;
  failed: number;
}

export const tasks: Task[] = [
  {
    id: 'tsk_a1f3',
    service: 'app-noop',
    projectId: 'prj-8842',
    resource: 'Carbonate',
    status: 'running',
    runtime: 'Carbonate',
    startedAt: '08:29:18 AM',
    duration: '00:14:22',
    message: 'Stage 3/5: preprocessing',
  },
  {
    id: 'tsk_b7c2',
    service: 'app-supertest',
    projectId: 'prj-8842',
    resource: 'AWS Batch',
    status: 'running',
    runtime: 'AWS Batch',
    startedAt: '08:28:44 AM',
    duration: '00:07:46',
    message: 'AWS Batch job 4f2a - container pulling',
  },
  {
    id: 'tsk_f8a9',
    service: 'app-fmriprep',
    projectId: 'prj-2210',
    resource: 'BigRed3',
    status: 'running',
    runtime: 'BigRed3',
    startedAt: '08:28:02 AM',
    duration: '00:36:33',
    message: 'fMRIPrep node 142/300',
  },
  {
    id: 'tsk_g3b7',
    service: 'app-noop',
    projectId: 'prj-5531',
    resource: 'Local Docker',
    status: 'queued',
    runtime: 'Local Docker',
    startedAt: '--',
    duration: '--',
    message: 'Waiting for resource slot',
  },
  {
    id: 'tsk_d2e8',
    service: 'app-noop',
    projectId: 'prj-5531',
    resource: 'Carbonate',
    status: 'failed',
    runtime: 'Carbonate',
    startedAt: '08:24:11 AM',
    duration: '00:03:51',
    message: 'SSH authentication failed',
  },
  {
    id: 'tsk_h1c6',
    service: 'app-supertest',
    projectId: 'prj-8842',
    resource: 'AWS Batch',
    status: 'failed',
    runtime: 'AWS Batch',
    startedAt: '08:21:02 AM',
    duration: '00:18:09',
    message: 'Container OOM killed - exit code 137',
  },
];

export const resources: ComputeResource[] = [
  {
    id: 'res-1',
    name: 'Carbonate',
    type: 'UIUC HPC Cluster',
    status: 'online',
    detail: 'Slurm + HPSS verified',
    cpu: 72,
    memory: 61,
    queueJobs: 34,
    tags: ['Slurm', 'HPSS'],
  },
  {
    id: 'res-2',
    name: 'BigRed3',
    type: 'Indiana University',
    status: 'online',
    detail: 'Slurm + HPSS verified',
    cpu: 58,
    memory: 48,
    queueJobs: 22,
    tags: ['Slurm', 'HPSS'],
  },
  {
    id: 'res-3',
    name: 'AWS Batch',
    type: 'us-east-1',
    status: 'online',
    detail: 'Queue amaretti-prod active',
    vcpusCurrent: 128,
    vcpusMax: 256,
    activeJobs: 43,
    queueJobs: 12,
    tags: ['AWS Batch'],
  },
  {
    id: 'res-4',
    name: 'Local Docker Host',
    type: 'amaretti.local',
    status: 'error',
    detail: 'Host unreachable',
    tags: ['Docker'],
  },
];

export const serviceStats: ServiceStat[] = [
  { service: 'app-noop', total: 38, running: 2, finished: 34, failed: 2 },
  { service: 'app-supertest', total: 24, running: 1, finished: 20, failed: 3 },
  { service: 'app-freesurfer', total: 16, running: 0, finished: 15, failed: 1 },
  { service: 'app-fmriprep', total: 12, running: 2, finished: 9, failed: 1 },
];

export const logStream: LogLine[] = [
  { ts: '08:42:11.123', level: 'INFO', service: 'app-noop', message: '[Task: 1287] Starting task Service: app-noop' },
  { ts: '08:42:11.456', level: 'INFO', service: 'app-noop', message: 'Pulling container image Image: brainlife/app-noop:latest' },
  { ts: '08:42:13.789', level: 'INFO', service: 'app-noop', message: 'Running on resource: Carbonate Node: c801 JobID: 987654' },
  { ts: '08:42:15.321', level: 'SUCCESS', service: 'app-noop', message: 'Step completed Duration: 12.53s' },
  { ts: '08:42:17.654', level: 'INFO', service: 'app-noop', message: 'Uploading results to HPSS Path: /hpss/proj/demo/output/' },
  { ts: '08:42:31.210', level: 'SUCCESS', service: 'app-noop', message: 'Task finished Exit code: 0' },
  { ts: '08:43:02.112', level: 'ERROR', service: 'app-supertest', message: '[Task: 1290] Container exited with non-zero code: 137' },
  { ts: '08:43:02.113', level: 'ERROR', service: 'app-supertest', message: '[Task: 1290] Out of memory Killed by OOM Killer' },
  { ts: '08:43:05.500', level: 'WARNING', service: 'app-fmriprep', message: '[Task: 1299] High memory usage Memory: 92% > threshold' },
  { ts: '08:43:10.777', level: 'INFO', service: 'app-fmriprep', message: '[Task: 1292] Queued in AWS Batch Queue: amaretti-queue' },
];

export const quickFilters = [
  'app-noop',
  'app-supertest',
  'app-fmriprep',
  'app-freesurfer',
  'prj-8842',
  'prj-2210',
  'prj-5531',
];
