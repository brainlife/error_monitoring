export type TaskStatus = 'running' | 'finished' | 'failed' | 'queued' | 'cancelled' | 'unknown';

export type Runtime = string;

export interface Task {
  id: string;
  service: string;
  projectId: string;
  realProjectId?: string;
  resource: string;
  status: TaskStatus;
  runtime: Runtime;
  startedAt: string;
  duration: string;
  message: string;
  startDate?: string;
  finishDate?: string;
  userId?: string;
  createDate?: string;
  groupName?: string;
  groupId?: string;
  datatype?: string;
  jobName?: string;
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
