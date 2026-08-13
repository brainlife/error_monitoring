export function getApiUrl(): string {
  return localStorage.getItem('amaretti_api_url') || import.meta.env.VITE_API_URL || 'https://brainlife.io/api/amaretti';
}

export function setApiUrl(url: string): void {
  localStorage.setItem('amaretti_api_url', url);
}

export function getJwtToken(): string {
  return localStorage.getItem('amaretti_jwt') || '';
}

export function setJwtToken(token: string): void {
  localStorage.setItem('amaretti_jwt', token);
}

export interface UserProfile {
  id: string;
  username: string;
  fullname: string;
  email: string;
}

export function getUserProfile(): UserProfile | null {
  const userJson = localStorage.getItem('amaretti_user');
  if (!userJson) return null;
  try {
    return JSON.parse(userJson) as UserProfile;
  } catch {
    return null;
  }
}

export async function login(username: string, password: string): Promise<boolean> {
  const apiUrl = getApiUrl().replace(/\/$/, '');

  // Construct Auth API URL from Amaretti API URL
  const authBaseUrl = apiUrl.replace(/\/amaretti$/, '/auth');
  const authUrl = `${authBaseUrl}/local/auth`;

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    let errorMessage = 'Authentication failed';
    try {
      const errBody = await response.json();
      if (errBody && errBody.message) {
        errorMessage = errBody.message;
      }
    } catch {
      // ignore JSON parse error
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  if (data && data.jwt) {
    setJwtToken(data.jwt);

    // Decode JWT payload (standard JWT is header.payload.signature)
    try {
      const payloadPart = data.jwt.split('.')[1];
      const payloadDecoded = JSON.parse(atob(payloadPart));
      // console.log('Payload decoded:', payloadDecoded);
      const userProfile: UserProfile = {
        id: payloadDecoded.sub || '1',
        username: payloadDecoded.username || payloadDecoded.sub || username,
        fullname: payloadDecoded.fullname || payloadDecoded.username || username,
        email: payloadDecoded.email || ''
      };

      localStorage.setItem('amaretti_user', JSON.stringify(userProfile));

    } catch (decodeErr) {
      console.warn('Failed to decode JWT payload, setting fallback user profile:', decodeErr);
      const fallbackProfile: UserProfile = {
        id: '1',
        username: username,
        fullname: username,
        email: ''
      };
      localStorage.setItem('amaretti_user', JSON.stringify(fallbackProfile));
    }

    return true;
  }

  return false;
}

export function logout(): void {
  localStorage.removeItem('amaretti_jwt');
  localStorage.removeItem('amaretti_user');
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiUrl().replace(/\/$/, ''); // Remove trailing slash if any
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  const token = getJwtToken();

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody && errBody.message) {
        errorMessage = errBody.message;
      }
    } catch {
      // ignore JSON parse error
    }
    throw new Error(errorMessage);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  return {} as Promise<T>;
}

export async function fetchWarehouseProjects(): Promise<{ _id: string; name: string; desc?: string; group_id?: number }[]> {
  const baseUrl = getApiUrl().replace(/\/amaretti\/?$/, '/warehouse');
  const token = getJwtToken();
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const url = `${baseUrl}/project?select=name%20desc&limit=500&admin=true`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch warehouse projects: ${response.status}`);
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray(data.results)) {
    return data.results;
  }
  if (data && Array.isArray(data.projects)) {
    return data.projects;
  }
  return [];
}

export async function fetchAuthUsers(): Promise<{ _id: string; sub: number; username: string; fullname: string; scopes?: { brainlife?: string[] } }[]> {
  const baseUrl = getApiUrl().replace(/\/amaretti\/?$/, '/auth');
  const token = getJwtToken();
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const url = `${baseUrl}/users?limit=10000`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch auth users: ${response.status}`);
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray(data.users)) {
    return data.users;
  }
  return [];
}

export interface WarehouseApp {

  _id: string;
  name: string;
  github?: string;
  doi?: string;
  deprecated?: boolean;
  removed?: boolean;
  stats?: {
    requested?: number;
    users?: number;
    success_rate?: number;
    runtime_mean?: number;
    groups?: number;
  };
}

export async function fetchWarehouseApps(): Promise<WarehouseApp[]> {
  const baseUrl = getApiUrl().replace(/\/amaretti\/?$/, '/warehouse');
  const token = getJwtToken();
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const url = `${baseUrl}/app?limit=1000`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch warehouse apps: ${response.status}`);
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray(data.apps)) {
    return data.apps;
  }
  if (data && Array.isArray(data.results)) {
    return data.results;
  }
  return [];
}

export interface ResourceMountHealth {
  mount: string;
  accessible: boolean;
  latency_ms: number;
  free_space_pct: number;
  warning?: string | null;
  error?: string | null;
}

export interface ResourceSlurmNodeState {
  alloc?: number;
  idle?: number;
  'idle~'?: number;
  'idle*'?: number;
  down?: number;
  'down*'?: number;
  'down~'?: number;
  drain?: number;
  'drain*'?: number;
  maint?: number;
  [key: string]: number | undefined;
}

export interface ResourceDownNode {
  node: string;
  reason?: string;
}

export interface ResourceSlurmHealth {
  nodes: {
    total_nodes: number;
    by_state: ResourceSlurmNodeState;
    down_nodes: (string | ResourceDownNode)[];
  } | null;
  jobs: {
    total_jobs: number;
    by_status: Record<string, number>;
    recent_jobs?: any[];
    failed_jobs?: any[];
  } | null;
}

export interface MonitoredResourceHealth {
  resource_id: string;
  resource_name: string;
  last_check: string;
  overall_status: 'ok' | 'warning' | 'error' | 'unknown';
  mounts: ResourceMountHealth[];
  slurm: ResourceSlurmHealth;
  error_history?: any[];
}

export interface ResourceHealthAllResponse {
  timestamp: string;
  resources: MonitoredResourceHealth[];
}

export async function fetchResourceHealthAll(): Promise<ResourceHealthAllResponse> {
  console.group('🌐 [Amaretti API] GET /resource/health/all');
  console.log('Requesting: /resource/health/all');
  try {
    const data = await apiFetch<ResourceHealthAllResponse>('/resource/health/all');
    console.log('Response Payload:', data);
    console.log('Monitored Resources Count:', data?.resources?.length ?? 0);
    console.table(data?.resources?.map(r => ({
      ID: r.resource_id,
      Name: r.resource_name,
      Status: r.overall_status,
      Mounts: r.mounts?.length ?? 0,
      TotalNodes: r.slurm?.nodes?.total_nodes ?? 'N/A',
      LastCheck: r.last_check
    })));
    console.groupEnd();
    return data;
  } catch (err) {
    console.error('Fetch /resource/health/all Failed:', err);
    console.groupEnd();
    throw err;
  }
}

export async function refreshResourceHealth(resourceId: string): Promise<any> {
  return apiFetch<any>(`/resource/${resourceId}/health/refresh`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}


